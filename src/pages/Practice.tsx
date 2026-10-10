import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calculator } from '../components/Calculator';
import { LevelChange } from '../components/LevelChange';
import { QuestionView } from '../components/QuestionView';
import { Rich, RichInline } from '../components/Rich';
import { formatClock, PaceBar, useStopwatch } from '../components/Timer';
import { AREA_NAMES, SKILLS, skillById, templateById, templatesBySkill, TRAPS } from '../content';
import { generateQuestion, poolSeed } from '../engine/generate';
import { grade, isAnswered, type GradeResult, type Response } from '../engine/grade';
import { createRng, randomSeed } from '../engine/rng';
import type { Area, Question } from '../engine/types';
import { LEVEL_NAMES, nextStep, type AttemptOutcome } from '../mastery/model';
import { nextPick, type Pick, type PracticeScope } from '../mastery/scheduler';
import { go, href } from '../router';
import { useProgress } from '../store/progress';
import '../fx-practice.css';

function scopeFromRoute(route: string[]): PracticeScope {
  if (route[0] === 'skill' && route[1]) return { kind: 'skill', skillId: route[1] };
  if (route[0] === 'unit' && route[1] && route[2]) return { kind: 'unit', area: route[1] as Area, unit: route[2] };
  if (route[0] === 'area' && route[1]) return { kind: 'smart', areas: [route[1] as Area] };
  if (route[0] === 'review') return { kind: 'review' };
  return { kind: 'smart' };
}

function scopeTitle(scope: PracticeScope): string {
  switch (scope.kind) {
    case 'skill':
      return skillById.get(scope.skillId)?.name ?? 'Skill practice';
    case 'unit':
      return `${AREA_NAMES[scope.area]}: ${scope.unit}`;
    case 'review':
      return 'Spaced review';
    case 'smart':
      return scope.areas ? `${AREA_NAMES[scope.areas[0]]}: mixed practice` : 'Smart practice';
  }
}

const REASON: Record<Pick['reason'], [string, string]> = {
  repair: ['Comeback: same skill, new style', 'chip-warn'],
  review: ['Spaced review', 'chip-accent'],
  practice: ['Practice', 'chip'],
  new: ['New skill', 'chip-good'],
  focus: ['Skill focus', 'chip'],
};

interface Current {
  pick: Pick;
  question: Question;
}

export function Practice({ route }: { route: string[] }) {
  const scope = useMemo(() => scopeFromRoute(route), [route.join('/')]);
  const store = useProgress();
  const [current, setCurrent] = useState<Current | null>(null);
  const [response, setResponse] = useState<Response | undefined>();
  const [hinted, setHinted] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [result, setResult] = useState<{ grade: GradeResult; outcome: AttemptOutcome; timeMs: number } | null>(null);
  const [session, setSession] = useState({ answered: 0, correct: 0, streak: 0 });
  const [calcOpen, setCalcOpen] = useState(false);
  const [empty, setEmpty] = useState(false);
  const recent = useRef<string[]>([]);
  const lastSkill = useRef<string | undefined>(undefined);

  const elapsed = useStopwatch(!!current && !result, current?.question.id);

  const next = useCallback(() => {
    const s = useProgress.getState();
    const rng = createRng(randomSeed());
    const recentTemplates = [...s.history.slice(-12).map((h) => h.templateId), ...recent.current].slice(-12);
    const pick = nextPick(
      rng,
      {
        skills: SKILLS,
        templatesBySkill,
        states: s.skills,
        remediation: s.remediation,
        seq: s.seq,
        now: Date.now(),
        recentTemplates,
        lastSkill: lastSkill.current,
      },
      scope,
    );
    if (!pick) {
      setEmpty(true);
      setCurrent(null);
      return;
    }
    const t = templateById.get(pick.templateId)!;
    const question = generateQuestion(t, poolSeed(), pick.difficulty);
    recent.current = [...recent.current, pick.templateId].slice(-12);
    lastSkill.current = pick.skillId;
    setEmpty(false);
    setCurrent({ pick, question });
    setResponse(undefined);
    setHinted(false);
    setShowHint(false);
    setResult(null);
  }, [scope]);

  useEffect(() => {
    next();
    setSession({ answered: 0, correct: 0, streak: 0 });
  }, [next]);

  const submit = useCallback(() => {
    if (!current || result || !isAnswered(response)) return;
    const g = grade(current.question, response);
    const timeMs = elapsed;
    const outcome = store.recordAttempt({
      question: current.question,
      correct: g.correct,
      timeMs,
      hinted,
      traps: g.traps,
      mode: 'practice',
      response,
    });
    setResult({ grade: g, outcome, timeMs });
    setSession((s) => ({ answered: s.answered + 1, correct: s.correct + (g.correct ? 1 : 0), streak: g.correct ? s.streak + 1 : 0 }));
  }, [current, result, response, elapsed, hinted, store]);

  // Keyboard: letters / digits pick a choice, Enter submits or goes to the next question.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current) return;
      const target = e.target as HTMLElement;
      const typing = target.tagName === 'INPUT' || target.closest('.calc');
      if (e.key === 'Enter') {
        if (target.closest('.calc, a, summary, textarea')) return;
        // Enter activates any focused button except an answer choice (those still check / advance).
        const btn = target.closest('button');
        if (btn && !btn.closest('.choices')) return;
        e.preventDefault();
        if (result) next();
        else submit();
        return;
      }
      if (typing || result || e.metaKey || e.ctrlKey || e.altKey) return;
      const q = current.question;
      const k = e.key.toUpperCase();
      const idx = /^[1-8]$/.test(k) ? Number(k) - 1 : /^[A-H]$/.test(k) ? k.charCodeAt(0) - 65 : -1;
      if (idx < 0) return;
      if (q.format === 'qc' && idx < 4) setResponse({ format: 'qc', choice: 'ABCD'[idx] as 'A' });
      if (q.format === 'mcs' && idx < q.choices.length) setResponse({ format: 'mcs', choice: idx });
      if (q.format === 'mcm' && idx < q.choices.length) {
        const prev = response?.format === 'mcm' ? response.choices : [];
        setResponse({ format: 'mcm', choices: prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx].sort((a, b) => a - b) });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, result, response, next, submit]);

  if (empty) {
    return (
      <div className="card empty">
        <h2>Nothing to practice here right now</h2>
        <p>{scope.kind === 'review' ? 'No skill is due for review. Come back later, or keep practicing.' : 'This selection has no questions yet.'}</p>
        <a className="btn btn-primary" href={href('practice')}>
          Smart practice
        </a>
      </div>
    );
  }
  if (!current) return null;

  const { question, pick } = current;
  const skill = skillById.get(question.skillId)!;
  const template = templateById.get(question.templateId)!;
  const st = store.skills[skill.id];
  const level = st?.level ?? 0;
  const paceSec = store.settings.paceSec;
  const [reasonText, reasonCls] = REASON[pick.reason];
  const nChoices = question.format === 'qc' ? 4 : question.format === 'ne' ? 0 : question.choices.length;

  return (
    <div className="practice-fx">
      <div className="row" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>{scopeTitle(scope)}</h1>
        <span className="spacer" />
        <span className="chip">
          Session: {session.correct}/{session.answered}
          {session.streak >= 3 ? ` · streak ${session.streak}` : ''}
        </span>
        <button className={`btn ${calcOpen ? 'btn-primary' : ''}`} onClick={() => setCalcOpen((v) => !v)}>
          Calculator
        </button>
      </div>

      <div className="question-card">
        <div className="question-meta">
          <span className={`chip ${reasonCls}`}>{reasonText}</span>
          <a className="chip chip-accent" href={href('practice', 'skill', skill.id)} title="Practice only this skill">
            <i className={`level-dot level-${level}`} /> {skill.name} · {LEVEL_NAMES[level]}
          </a>
          <span className="chip" title={template.style}>
            {template.style}
          </span>
          <span className="chip">{'●'.repeat(question.difficulty) + '○'.repeat(3 - question.difficulty)}</span>
          <span className="spacer" />
          {store.settings.showTimer || result ? (
            <PaceBar elapsedMs={result ? result.timeMs : elapsed} paceSec={paceSec} />
          ) : (
            <span className="muted small">Timer hidden</span>
          )}
        </div>

        <QuestionView key={question.id} q={question} response={response} onChange={setResponse} locked={!!result} reveal={!!result} autoFocus />

        {!result && (
          <div className="row" style={{ marginTop: 18 }}>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setShowHint((v) => !v);
                setHinted(true);
              }}
              title="Showing the strategy card means this answer will not count toward mastery"
            >
              {showHint ? 'Hide strategy' : 'Show strategy (hint)'}
            </button>
            <span className="spacer" />
            <span className="muted small">
              <span className="kbd">Enter</span> to check
            </span>
            <button className="btn btn-primary btn-big" onClick={submit} disabled={!isAnswered(response)}>
              Check
            </button>
          </div>
        )}
        {showHint && !result && (
          <div className="strategy-box">
            <Rich text={skill.strategy} />
          </div>
        )}

        {result && (
          <Feedback
            result={result}
            question={question}
            paceSec={paceSec}
            skillName={skill.name}
            hinted={hinted}
            strategy={skill.strategy}
            onNext={next}
            nextStepText={nextStep(result.outcome.state)}
          />
        )}
      </div>

      {calcOpen && (
        <Calculator
          onClose={() => setCalcOpen(false)}
          onTransfer={
            question.format === 'ne' && !result
              ? (v) => {
                  if (!question.fractionBoxes) return setResponse({ format: 'ne', value: v });
                  // fraction boxes take integers only: ignore a decimal result
                  if (!/^-?\d+$/.test(v)) return;
                  setResponse({ format: 'ne', num: v, den: response?.format === 'ne' && 'den' in response ? response.den : '' });
                }
              : undefined
          }
        />
      )}
      <div className="muted small" style={{ marginTop: 14 }}>
        Keys:{' '}
        {nChoices > 0 && (
          <>
            <span className="kbd">A</span>–<span className="kbd">{String.fromCharCode(64 + nChoices)}</span> or <span className="kbd">1</span>–
            <span className="kbd">{nChoices}</span> to pick,{' '}
          </>
        )}
        <span className="kbd">Enter</span> to check / next. <a href={href('')}>Back to dashboard</a> ·{' '}
        <a href="#" onClick={(e) => (e.preventDefault(), go('strategies', skill.id))}>
          Strategy card
        </a>
      </div>
    </div>
  );
}

function Feedback({
  result,
  question,
  paceSec,
  skillName,
  hinted,
  strategy,
  onNext,
  nextStepText,
}: {
  result: { grade: GradeResult; outcome: AttemptOutcome; timeMs: number };
  question: Question;
  paceSec: number;
  skillName: string;
  hinted: boolean;
  strategy: string;
  onNext: () => void;
  nextStepText: string;
}) {
  const { grade: g, outcome, timeMs } = result;
  const slow = timeMs > paceSec * 1000;
  const traps = g.traps.map((id) => TRAPS[id]).filter(Boolean);
  const nextBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => nextBtn.current?.focus(), []);
  return (
    <div className={`feedback ${g.correct ? 'ok' : 'ko'}`}>
      <div className="feedback-title">
        <span style={{ color: g.correct ? 'var(--good)' : 'var(--bad)' }}>{g.correct ? 'Correct' : g.invalid ? 'Not a valid answer' : 'Not quite'}</span>
        <span className={`chip ${slow ? 'chip-warn' : 'chip-good'}`}>
          {formatClock(timeMs)} {slow ? `(over the ${formatClock(paceSec * 1000)} pace)` : '(on pace)'}
        </span>
        {hinted && <span className="chip chip-warn">hint used</span>}
        <span className="spacer" />
        <button ref={nextBtn} className="btn btn-primary" onClick={onNext}>
          Next question →
        </button>
      </div>

      <p className="small" style={{ margin: '10px 0 0' }}>
        <strong>{skillName}</strong>:{' '}
        {outcome.from !== outcome.to ? <LevelChange from={outcome.from} to={outcome.to} /> : <span className="chip">{LEVEL_NAMES[outcome.to]}</span>}{' '}
        {!g.correct
          ? 'This skill comes back in a different style within a few questions, and again tomorrow.'
          : !outcome.clean
            ? 'Correct, but it only counts as practice: answer on pace without hints to move toward mastery.'
            : nextStepText}
      </p>

      {traps.map((t, i) => (
        <div className="trap-box" key={i}>
          <strong>
            Trap: <RichInline text={t.label} />
          </strong>
          <Rich text={t.fix} />
        </div>
      ))}

      <h3>Explanation</h3>
      <Rich className="explanation" text={question.explanation} />

      <details style={{ marginTop: 12 }}>
        <summary>Strategy card for this skill</summary>
        <div className="strategy-box">
          <Rich text={strategy} />
        </div>
      </details>
    </div>
  );
}
