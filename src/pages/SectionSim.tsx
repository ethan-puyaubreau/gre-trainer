import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calculator } from '../components/Calculator';
import { Modal } from '../components/Modal';
import { QuestionView } from '../components/QuestionView';
import { Rich } from '../components/Rich';
import { formatClock } from '../components/Timer';
import { AREA_NAMES, AREAS, skillById } from '../content';
import { grade, isAnswered, type Response } from '../engine/grade';
import { createRng, randomSeed } from '../engine/rng';
import type { Area } from '../engine/types';
import { buildSection, choiceKeyResponse, loadRun, routeSection2, saveRun, SPECS, type Level, type RunningSection, type SectionResult } from '../mastery/section';
import { href } from '../router';
import { useProgress, type SectionPart } from '../store/progress';

/* ------------------------------------------------------------------ component */

type Phase =
  | { kind: 'setup' }
  | { kind: 'running'; sec: RunningSection }
  | { kind: 'between'; done: SectionResult[] }
  | { kind: 'results'; done: SectionResult[] };

export function SectionSim() {
  // A section in progress survives navigation and reload (sessionStorage); an expired one is finished by Exam on mount.
  const [saved] = useState(loadRun);
  const [phase, setPhase] = useState<Phase>(() =>
    saved ? (saved.sec ? { kind: 'running', sec: saved.sec } : { kind: 'between', done: saved.done }) : { kind: 'setup' },
  );
  const [length, setLength] = useState<'full' | 's1' | 's2'>(saved?.length ?? 'full');
  const [areas, setAreas] = useState<Area[]>(AREAS.filter((a) => a.templates.length).map((a) => a.area));
  const completed = useRef<SectionResult[]>(saved?.done ?? []);
  const store = useProgress();

  // Exam saves the running section as it changes; the other phases are saved or forgotten here.
  useEffect(() => {
    if (phase.kind === 'between') saveRun({ length, done: phase.done });
    else if (phase.kind !== 'running') saveRun(null);
  }, [phase, length]);

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
        // A blank is not evidence about the skill: it would cost a level and queue a repair for a question never attempted.
        if (!isAnswered(sec.responses[i])) return;
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
              <button key={k} className={length === k ? 'on' : ''} aria-pressed={length === k} onClick={() => setLength(k)}>
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
                  aria-pressed={on}
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
    const level = routeSection2(s1.correct.filter(Boolean).length, s1.correct.length);
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
    <Exam
      key={`${phase.sec.index}-${phase.sec.startedAt}`}
      sec={phase.sec}
      total={length === 'full' ? 2 : 1}
      onFinish={finish}
      onChange={(sec) => saveRun({ length, done: completed.current, sec })}
    />
  );
}

/* ------------------------------------------------------------------ exam screen */

function Exam({
  sec: initial,
  total,
  onFinish,
  onChange,
}: {
  sec: RunningSection;
  total: number;
  onFinish: (sec: RunningSection) => void;
  onChange: (sec: RunningSection) => void;
}) {
  const [sec, setSec] = useState(initial);
  const [idx, setIdx] = useState(0);
  const [review, setReview] = useState(false);
  const [calc, setCalc] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [hideClock, setHideClock] = useState(!useProgress.getState().settings.showTimer);
  const [now, setNow] = useState(Date.now());
  const enteredAt = useRef(Date.now());
  const finished = useRef(false);

  const commitTime = useCallback(() => {
    // Time stops at the deadline: a tab that slept past it must not bill hours to the current question.
    const t = Math.min(Date.now(), initial.endsAt);
    const spent = Math.max(0, t - enteredAt.current);
    enteredAt.current = t;
    setSec((s) => {
      if (review) return s;
      const timeSpent = [...s.timeSpent];
      timeSpent[idx] += spent;
      return { ...s, timeSpent };
    });
  }, [idx, review, initial.endsAt]);

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
    const t = Math.min(Date.now(), sec.endsAt);
    const spent = review ? 0 : Math.max(0, t - enteredAt.current);
    const timeSpent = [...sec.timeSpent];
    timeSpent[idx] += spent;
    onFinish({ ...sec, timeSpent });
  }, [sec, idx, review, onFinish]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => onChange(sec), [sec]);

  // Reloading or closing the tab with a section running asks first (in-app navigation is covered by the saved run).
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
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

  // Keyboard: letters / digits pick a choice (not while typing or in the calculator). Sections have no per-question submit, so no Enter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (review || target.tagName === 'INPUT' || target.closest?.('.calc') || e.metaKey || e.ctrlKey || e.altKey) return;
      const r = choiceKeyResponse(q, e.key, sec.responses[idx]);
      if (r) setResponse(r);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [review, q, idx, sec.responses]);

  const answered = sec.responses.filter((r) => isAnswered(r)).length;
  const missing = sec.questions.length - answered;
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
                    <td>
                      {/* No handler of its own: its click bubbles to the row, which does the work. */}
                      <button type="button" className="btn btn-ghost" style={{ padding: 0 }} aria-label={`Go to question ${i + 1}`}>
                        {i + 1}
                      </button>
                    </td>
                    <td>{isAnswered(sec.responses[i]) ? 'Answered' : <span style={{ color: 'var(--bad)' }}>Not answered</span>}</td>
                    <td>{sec.marked[i] ? '⚑' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row" style={{ marginTop: 16 }}>
              <span className="spacer" />
              <button className="btn btn-primary" onClick={() => (missing === 0 ? end() : setConfirmEnd(true))}>
                End section
              </button>
            </div>
            <Modal open={confirmEnd} title="End this section?" onClose={() => setConfirmEnd(false)}>
              <p>
                {missing} question{missing > 1 ? 's are' : ' is'} not answered. Once the section has ended you cannot go back to it.
              </p>
              <div className="modal-actions">
                <button className="btn" onClick={() => setConfirmEnd(false)}>
                  Keep working
                </button>
                <button className="btn btn-primary" onClick={end}>
                  End section
                </button>
              </div>
            </Modal>
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
                    {/* No handler of its own: its click bubbles to the row, which does the work. */}
                    <button type="button" className="btn btn-ghost" style={{ padding: 0 }} aria-expanded={open === x.q.id}>
                      S{x.s + 1}·{i + 1 - (x.s ? done[0].sec.questions.length : 0)}
                    </button>
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
