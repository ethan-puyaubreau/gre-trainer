import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calculator } from '../components/Calculator';
import { QuestionView } from '../components/QuestionView';
import { Rich } from '../components/Rich';
import { formatClock } from '../components/Timer';
import { AREA_NAMES, AREAS, skillById, TEMPLATES } from '../content';
import { generateQuestion } from '../engine/generate';
import { grade, isAnswered, type Response } from '../engine/grade';
import { createRng, randomSeed, type Rng } from '../engine/rng';
import type { Area, Difficulty, Format, Question, Template } from '../engine/types';
import { href } from '../router';
import { useProgress, type SectionPart } from '../store/progress';

/* ------------------------------------------------------------------ section building */

type Level = 'easy' | 'medium' | 'hard';

interface SectionSpec {
  questions: number;
  minutes: number;
  /** Format slots, QC first like the official sections. */
  formats: Record<Format, number>;
}

const SPECS: Record<'s1' | 's2', SectionSpec> = {
  s1: { questions: 12, minutes: 21, formats: { qc: 4, mcs: 5, mcm: 1, ne: 2 } },
  s2: { questions: 15, minutes: 26, formats: { qc: 5, mcs: 6, mcm: 2, ne: 2 } },
};

const DIFF_WEIGHTS: Record<Level, [number, number, number]> = {
  easy: [0.45, 0.5, 0.05],
  medium: [0.15, 0.6, 0.25],
  hard: [0.0, 0.4, 0.6],
};

function pickDifficulty(rng: Rng, level: Level): Difficulty {
  const [a, b] = DIFF_WEIGHTS[level];
  const r = rng.next();
  return r < a ? 1 : r < a + b ? 2 : 3;
}

export interface BuiltSection {
  questions: Question[];
  /** Data interpretation sets as [first, last] question indices. */
  sets: [number, number][];
}

export function buildSection(rng: Rng, spec: SectionSpec, level: Level, areas: Area[]): BuiltSection {
  const pool = TEMPLATES.filter((t) => areas.includes(skillById.get(t.skill)!.area));

  // One data interpretation set (2-3 questions on a shared figure) when a family is available.
  const families = new Map<string, Template<any>[]>();
  for (const t of pool) if (t.set) families.set(t.set, [...(families.get(t.set) ?? []), t]);
  const famList = [...families.values()].filter((f) => f.length >= 2);
  let setQuestions: Question[] = [];
  let setFamily: string | undefined;
  if (famList.length) {
    const fam = rng.pick(famList);
    setFamily = fam[0].set;
    const seed = randomSeed();
    const d = pickDifficulty(rng, level);
    setQuestions = rng.sample(fam, Math.min(3, fam.length)).map((t) => generateQuestion(t, seed, d));
  }

  const usedSkills = new Set<string>();
  const usedTemplates = new Set<string>(setQuestions.map((q) => q.templateId));
  const out: Question[] = [];
  let slots: Format[] = (Object.entries(spec.formats) as [Format, number][]).flatMap(([f, n]) => Array<Format>(n).fill(f));
  // The set replaces non-QC slots, taken from the end (numeric entry / select-all first).
  for (let k = 0; k < setQuestions.length; k++) {
    const i = slots.map((f) => f !== 'qc').lastIndexOf(true);
    slots = slots.filter((_, j) => j !== i);
  }
  const regularPool = pool.filter((t) => !setFamily || t.set !== setFamily);
  const areaCycle = rng.shuffle(areas);
  slots.forEach((format, i) => {
    const preferredArea = areaCycle[i % areaCycle.length];
    const candidates = (filter: (t: Template<any>) => boolean) => regularPool.filter((t) => t.format === format && filter(t));
    const tiers = [
      candidates((t) => skillById.get(t.skill)!.area === preferredArea && !usedSkills.has(t.skill)),
      candidates((t) => !usedSkills.has(t.skill)),
      candidates((t) => !usedTemplates.has(t.id)),
      candidates(() => true),
      regularPool.filter((t) => !usedTemplates.has(t.id)),
      regularPool.length ? regularPool : pool,
    ];
    const tier = tiers.find((c) => c.length)!;
    const t = rng.pick(tier);
    usedSkills.add(t.skill);
    usedTemplates.add(t.id);
    out.push(generateQuestion(t, randomSeed(), pickDifficulty(rng, level)));
  });
  // QC first like the official sections, then the other formats, then the data interpretation set.
  const qc = out.filter((q) => q.format === 'qc');
  const rest = rng.shuffle(out.filter((q) => q.format !== 'qc'));
  const questions = [...qc, ...rest, ...setQuestions];
  const sets: [number, number][] = setQuestions.length ? [[questions.length - setQuestions.length, questions.length - 1]] : [];
  return { questions, sets };
}

/* ------------------------------------------------------------------ component */

interface RunningSection {
  index: number; // 0 or 1
  spec: SectionSpec;
  level: Level;
  questions: Question[];
  sets: [number, number][];
  responses: (Response | undefined)[];
  marked: boolean[];
  timeSpent: number[];
  endsAt: number;
  startedAt: number;
}

type Phase =
  | { kind: 'setup' }
  | { kind: 'running'; sec: RunningSection }
  | { kind: 'between'; done: SectionResult[] }
  | { kind: 'results'; done: SectionResult[] };

interface SectionResult {
  sec: RunningSection;
  correct: boolean[];
  usedSec: number;
}

export function SectionSim() {
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' });
  const [length, setLength] = useState<'full' | 's1' | 's2'>('full');
  const [areas, setAreas] = useState<Area[]>(AREAS.filter((a) => a.templates.length).map((a) => a.area));
  const completed = useRef<SectionResult[]>([]);
  const store = useProgress();

  const start = (index: number, level: Level, specKey: 's1' | 's2') => {
    const spec = SPECS[specKey];
    const rng = createRng(randomSeed());
    const { questions, sets } = buildSection(rng, spec, level, areas);
    const now = Date.now();
    if (index === 0) completed.current = [];
    setPhase({
      kind: 'running',
      sec: {
        index,
        spec,
        level,
        questions,
        sets,
        responses: questions.map(() => undefined),
        marked: questions.map(() => false),
        timeSpent: questions.map(() => 0),
        startedAt: now,
        endsAt: now + spec.minutes * 60_000,
      },
    });
  };

  const finish = useCallback(
    (sec: RunningSection) => {
      const correct = sec.questions.map((q, i) => grade(q, sec.responses[i]).correct);
      const usedSec = Math.min(sec.spec.minutes * 60, Math.round((Date.now() - sec.startedAt) / 1000));
      sec.questions.forEach((q, i) => {
        const g = grade(q, sec.responses[i]);
        store.recordAttempt({
          question: q,
          correct: g.correct,
          timeMs: sec.timeSpent[i],
          hinted: false,
          traps: g.traps,
          mode: 'section',
          response: sec.responses[i],
        });
      });
      const done = [...completed.current, { sec, correct, usedSec }];
      completed.current = done;
      const twoSections = length === 'full';
      if (twoSections && done.length === 1) setPhase({ kind: 'between', done });
      else {
        const parts: SectionPart[] = done.map((d) => ({
          questions: d.sec.questions.length,
          correct: d.correct.filter(Boolean).length,
          limitSec: d.sec.spec.minutes * 60,
          usedSec: d.usedSec,
          difficulty: d.sec.level === 'easy' ? 1 : d.sec.level === 'medium' ? 2 : 3,
          qids: d.sec.questions.map((q) => q.id),
          results: d.correct,
        }));
        store.recordSection({ at: Date.now(), parts });
        setPhase({ kind: 'results', done });
      }
    },
    [length, store],
  );

  if (phase.kind === 'setup') {
    const available = AREAS.filter((a) => a.templates.length);
    return (
      <div>
        <h1>Section test</h1>
        <div className="card">
          <p style={{ marginTop: 0 }}>
            Same format as the current GRE: <strong>Section 1</strong> has 12 questions in 21 minutes, <strong>Section 2</strong> has 15 questions in 26
            minutes and gets easier or harder depending on how Section 1 went. You can move freely within a section, mark questions and use the review
            screen. The on-screen calculator follows the order of operations and has a Transfer Display button for numeric entry.
          </p>
          <h3>Length</h3>
          <div className="tabs">
            {(
              [
                ['full', 'Full Quant: 2 sections (47 min)'],
                ['s1', 'One section: 12 q / 21 min'],
                ['s2', 'One section: 15 q / 26 min'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} className={length === k ? 'on' : ''} onClick={() => setLength(k)}>
                {label}
              </button>
            ))}
          </div>
          <h3>Content</h3>
          <div className="tabs">
            {available.map((a) => {
              const on = areas.includes(a.area);
              return (
                <button
                  key={a.area}
                  className={on ? 'on' : ''}
                  onClick={() => setAreas(on ? areas.filter((x) => x !== a.area) : [...areas, a.area])}
                  disabled={on && areas.length === 1}
                >
                  {AREA_NAMES[a.area]}
                </button>
              );
            })}
          </div>
          <p className="muted small">
            Results feed your mastery: a correct answer in a timed section counts as on pace, a miss sends the skill to the repair queue.
          </p>
          <button className="btn btn-primary btn-big" onClick={() => start(0, 'medium', length === 's2' ? 's2' : 's1')} disabled={!areas.length}>
            Start
          </button>
        </div>
      </div>
    );
  }

  if (phase.kind === 'between') {
    const s1 = phase.done[0];
    const ratio = s1.correct.filter(Boolean).length / s1.correct.length;
    const level: Level = ratio >= 0.75 ? 'hard' : ratio >= 0.42 ? 'medium' : 'easy';
    return (
      <div className="card" style={{ maxWidth: 620, margin: '40px auto', textAlign: 'center' }}>
        <h2 style={{ marginTop: 0 }}>Section 1 is over</h2>
        <p>
          Section 2 has <strong>15 questions</strong> and <strong>26 minutes</strong>. Its difficulty depends on your Section 1 performance, as on the real
          test. Scores are shown at the end.
        </p>
        <button className="btn btn-primary btn-big" onClick={() => start(1, level, 's2')}>
          Start Section 2
        </button>
      </div>
    );
  }

  if (phase.kind === 'results') return <Results done={phase.done} onRestart={() => setPhase({ kind: 'setup' })} />;

  return (
    <Exam key={`${phase.sec.index}-${phase.sec.startedAt}`} sec={phase.sec} total={length === 'full' ? 2 : 1} onFinish={finish} />
  );
}

/* ------------------------------------------------------------------ exam screen */

function Exam({ sec: initial, total, onFinish }: { sec: RunningSection; total: number; onFinish: (sec: RunningSection) => void }) {
  const [sec, setSec] = useState(initial);
  const [idx, setIdx] = useState(0);
  const [review, setReview] = useState(false);
  const [calc, setCalc] = useState(false);
  const [hideClock, setHideClock] = useState(!useProgress.getState().settings.showTimer);
  const [now, setNow] = useState(Date.now());
  const enteredAt = useRef(Date.now());
  const finished = useRef(false);

  const commitTime = useCallback(() => {
    const t = Date.now();
    const spent = t - enteredAt.current;
    enteredAt.current = t;
    setSec((s) => {
      if (review) return s;
      const timeSpent = [...s.timeSpent];
      timeSpent[idx] += spent;
      return { ...s, timeSpent };
    });
  }, [idx, review]);

  const goTo = (i: number) => {
    commitTime();
    setReview(false);
    setIdx(i);
  };
  const openReview = () => {
    commitTime();
    setReview(true);
  };

  const end = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    const t = Date.now();
    const spent = review ? 0 : t - enteredAt.current;
    const timeSpent = [...sec.timeSpent];
    timeSpent[idx] += spent;
    onFinish({ ...sec, timeSpent });
  }, [sec, idx, review, onFinish]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const remaining = sec.endsAt - now;
  useEffect(() => {
    if (remaining <= 0) end();
  }, [remaining, end]);

  const q = sec.questions[idx];
  const setResponse = (r: Response) =>
    setSec((s) => {
      const responses = [...s.responses];
      responses[idx] = r;
      return { ...s, responses };
    });
  const toggleMark = () =>
    setSec((s) => {
      const marked = [...s.marked];
      marked[idx] = !marked[idx];
      return { ...s, marked };
    });

  const answered = sec.responses.filter((r) => isAnswered(r)).length;
  const low = remaining < 5 * 60_000;

  return (
    <div>
      <div className="exam-bar">
        <strong>
          Section {sec.index + 1} of {total}
        </strong>
        <span>{review ? 'Review' : `Question ${idx + 1} of ${sec.questions.length}`}</span>
        <span className="spacer" />
        <span className={`exam-clock ${low ? 'low' : ''}`}>{hideClock ? '' : formatClock(remaining)}</span>
        <button className="btn" onClick={() => setHideClock((v) => !v)}>
          {hideClock ? 'Show time' : 'Hide time'}
        </button>
        <button className={`btn ${calc ? 'on' : ''}`} onClick={() => setCalc((v) => !v)}>
          Calculator
        </button>
        {!review && (
          <button className={`btn ${sec.marked[idx] ? 'on' : ''}`} onClick={toggleMark}>
            {sec.marked[idx] ? 'Marked' : 'Mark'}
          </button>
        )}
        <button className={`btn ${review ? 'on' : ''}`} onClick={() => (review ? goTo(idx) : openReview())}>
          Review
        </button>
        {!review && (
          <>
            <button className="btn" onClick={() => goTo(idx - 1)} disabled={idx === 0}>
              Back
            </button>
            <button className="btn" onClick={() => (idx === sec.questions.length - 1 ? openReview() : goTo(idx + 1))}>
              Next
            </button>
          </>
        )}
      </div>
      <div className="exam-body">
        {review ? (
          <div>
            <p style={{ marginTop: 0 }}>
              {answered} of {sec.questions.length} answered. Click a question to go back to it.
            </p>
            <table className="review-table">
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Status</th>
                  <th>Marked</th>
                </tr>
              </thead>
              <tbody>
                {sec.questions.map((qq, i) => (
                  <tr key={qq.id} className="clickable" onClick={() => goTo(i)}>
                    <td>{i + 1}</td>
                    <td>{isAnswered(sec.responses[i]) ? 'Answered' : <span style={{ color: 'var(--bad)' }}>Not answered</span>}</td>
                    <td>{sec.marked[i] ? '⚑' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row" style={{ marginTop: 16 }}>
              <span className="spacer" />
              <button
                className="btn btn-primary"
                onClick={() => {
                  const missing = sec.questions.length - answered;
                  if (missing === 0 || window.confirm(`${missing} question${missing > 1 ? 's are' : ' is'} not answered. End the section anyway?`)) end();
                }}
              >
                End section
              </button>
            </div>
          </div>
        ) : (
          <>
            {sec.sets
              .filter(([a, b]) => idx >= a && idx <= b)
              .map(([a, b]) => (
                <p key={a} className="instruction" style={{ marginTop: 0 }}>
                  Questions {a + 1} to {b + 1} are based on the following data.
                </p>
              ))}
            <QuestionView key={q.id} q={q} response={sec.responses[idx]} onChange={setResponse} />
          </>
        )}
      </div>
      {calc && (
        <Calculator
          onClose={() => setCalc(false)}
          onTransfer={!review && q.format === 'ne' && !q.fractionBoxes ? (v) => setResponse({ format: 'ne', value: v }) : undefined}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ results */

function Results({ done, onRestart }: { done: SectionResult[]; onRestart: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const all = done.flatMap((d) => d.sec.questions.map((q, i) => ({ q, ok: d.correct[i], r: d.sec.responses[i], t: d.sec.timeSpent[i], s: d.sec.index })));
  const correct = all.filter((x) => x.ok).length;
  const byArea = useMemo(() => {
    const m = new Map<Area, { n: number; ok: number }>();
    for (const x of all) {
      const a = skillById.get(x.q.skillId)!.area;
      const e = m.get(a) ?? { n: 0, ok: 0 };
      e.n++;
      if (x.ok) e.ok++;
      m.set(a, e);
    }
    return [...m];
  }, [all]);
  return (
    <div>
      <h1>Results</h1>
      <div className="card">
        <div className="row" style={{ gap: 28 }}>
          <div className="stat">
            <b>
              {correct}/{all.length}
            </b>
            <span>correct ({Math.round((100 * correct) / all.length)}%)</span>
          </div>
          {done.map((d) => (
            <div className="stat" key={d.sec.index}>
              <b>
                {d.correct.filter(Boolean).length}/{d.correct.length}
              </b>
              <span>
                Section {d.sec.index + 1} ({d.sec.level}) · {formatClock(d.usedSec * 1000)} used
              </span>
            </div>
          ))}
          {byArea.map(([a, e]) => (
            <div className="stat" key={a}>
              <b>
                {e.ok}/{e.n}
              </b>
              <span>{AREA_NAMES[a]}</span>
            </div>
          ))}
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          The real test equates the raw score (number correct, no penalty for wrong answers) to a 130–170 scale; ETS does not publish the conversion, so
          this page reports raw results only. Missed skills were added to your repair queue.
        </p>
      </div>
      <h2>Questions</h2>
      <div className="card" style={{ padding: 0 }}>
        <table className="review-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Skill</th>
              <th>Result</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {all.map((x, i) => (
              <Fragment key={x.q.id}>
                <tr className="clickable" onClick={() => setOpen(open === x.q.id ? null : x.q.id)}>
                  <td>
                    S{x.s + 1}·{i + 1 - (x.s ? done[0].sec.questions.length : 0)}
                  </td>
                  <td>{skillById.get(x.q.skillId)?.name}</td>
                  <td>{x.ok ? <span className="chip chip-good">correct</span> : <span className="chip chip-bad">{isAnswered(x.r) ? 'wrong' : 'blank'}</span>}</td>
                  <td className={x.t > 105_000 ? 'muted' : ''}>{formatClock(x.t)}</td>
                </tr>
                {open === x.q.id && (
                  <tr>
                    <td colSpan={4} style={{ background: 'var(--surface)' }}>
                      <QuestionView q={x.q} response={x.r} locked reveal />
                      <h3>Explanation</h3>
                      <Rich text={x.q.explanation} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={onRestart}>
          New section test
        </button>
        <a className="btn" href={href('practice')}>
          Repair missed skills
        </a>
      </div>
    </div>
  );
}
