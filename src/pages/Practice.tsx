import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Calculator } from '../components/Calculator';
import { LessonView } from '../components/LessonView';
import { LevelChange } from '../components/LevelChange';
import { QuestionView } from '../components/QuestionView';
import { Rich, RichInline } from '../components/Rich';
import { SessionRecap } from '../components/SessionRecap';
import { formatClock, PaceBar, useStopwatch } from '../components/Timer';
import { AREA_NAMES, SKILLS, skillById, templateById, templatesBySkill, TRAPS } from '../content';
import { LESSONS, lessonDue } from '../content/lessons';
import { generateQuestion, parseQuestionId, poolSeed } from '../engine/generate';
import { grade, isAnswered, type GradeResult, type Response } from '../engine/grade';
import { createRng, randomSeed } from '../engine/rng';
import type { Area, Question } from '../engine/types';
import { isOnPace, LEVEL_NAMES, nextStep, type AttemptOutcome } from '../mastery/model';
import { nextPick, type Pick, type PracticeScope } from '../mastery/scheduler';
import {
  dodgedTraps,
  earnsReward,
  FULL_CARD,
  hintText,
  paceJudged,
  replayIds,
  replaySeed,
  replayStep,
  resumeReplay,
  summarize,
  type HintLevel,
  type SessionOutcome,
} from '../mastery/session';
import { href } from '../router';
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

const DIFF_NAMES = ['easy', 'medium', 'hard'];

/** Same breakpoint as the small-screen rules in styles.css and fx-practice.css. */
const SMALL = '(max-width: 640px)';
/** On a phone Check and Next share one spot: a tap this soon after the result is the second half of a double tap, not "next". */
const NEXT_GUARD_MS = 500;
function useSmallScreen(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(SMALL);
      m.addEventListener('change', onChange);
      return () => m.removeEventListener('change', onChange);
    },
    () => window.matchMedia(SMALL).matches,
  );
}

const REASON: Record<Pick['reason'], [string, string]> = {
  repair: ['Comeback after a miss', 'chip-warn'],
  review: ['Spaced review', 'chip-accent'],
  practice: ['Practice', 'chip'],
  new: ['New skill', 'chip-good'],
  focus: ['Skill focus', 'chip'],
};

/** The last hint step: the skill's worked example with the full card, or the full card alone when it has no lesson. */
const lastHint = (skillId: string) => (LESSONS[skillId] ? 'Worked example' : 'Full card');
const hintLabel = (level: HintLevel, last: string) => ['Hint', 'Another hint', `Show ${last.toLowerCase()}`, `${last} shown`][level];
const lastHintCost = (last: string) => `${last}: this answer will not count toward mastery`;

interface Result {
  grade: GradeResult;
  outcome: AttemptOutcome;
  timeMs: number;
  /** Trap ids carried by wrong choices the user left alone (clean correct answers only, see earnsReward). */
  dodged: string[];
}

interface Current {
  pick: Pick;
  question: Question;
}

export function Practice({ route }: { route: string[] }) {
  const scope = useMemo(() => scopeFromRoute(route), [route.join('/')]);
  const store = useProgress();
  const [current, setCurrent] = useState<Current | null>(null);
  const [response, setResponse] = useState<Response | undefined>();
  // Hint steps taken before the answer; the attempt records this level.
  const [hintLevel, setHintLevel] = useState<HintLevel>(0);
  // After the result the full card is free: this only shows or hides it.
  const [cardOpen, setCardOpen] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [session, setSession] = useState({ answered: 0, correct: 0, streak: 0 });
  const [outcomes, setOutcomes] = useState<SessionOutcome[]>([]);
  const [recap, setRecap] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [empty, setEmpty] = useState(false);
  const recent = useRef<string[]>([]);
  const lastSkill = useRef<string | undefined>(undefined);
  // "Replay my traps": ids of the missed questions still to replay, served before the scheduler. null when no replay is running.
  const replay = useRef<string[] | null>(null);

  // A skill met for the first time shows its lesson before the question (the question is already easy: difficulty 1).
  const lessonSkill = current?.question.skillId;
  const gated =
    !!lessonSkill && lessonDue(lessonSkill, { enabled: store.settings.lessons, level: store.skills[lessonSkill]?.level ?? 0, seen: store.lessonsSeen });

  const elapsed = useStopwatch(!!current && !result && !recap && !gated, current?.question.id);

  // On a phone the Hint and Check buttons are a bar pinned to the bottom; a new hint opens above it, so bring it into view.
  const small = useSmallScreen();
  const panel = useRef<HTMLDivElement>(null);
  const resultAt = useRef(0);
  useEffect(() => {
    if (small && hintLevel > 0) panel.current?.scrollIntoView({ block: 'nearest' });
  }, [small, hintLevel]);

  const next = useCallback(() => {
    // A replay ends on the recap once its queue is served.
    const step = replayStep(replay.current);
    if (step.kind === 'end') {
      replay.current = null;
      setRecap(true);
      return;
    }
    if (step.kind === 'serve') replay.current = step.rest;
    // The same template and difficulty as the miss, with new numbers.
    const old = step.kind === 'serve' ? parseQuestionId(step.id) : null;
    const s = useProgress.getState();
    const rng = createRng(randomSeed());
    const recentTemplates = [...s.history.slice(-12).map((h) => h.templateId), ...recent.current].slice(-12);
    const pick: Pick | null = old
      ? { skillId: templateById.get(old.templateId)!.skill, templateId: old.templateId, difficulty: old.difficulty, reason: 'repair' }
      : nextPick(
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
    const question = generateQuestion(t, old ? replaySeed(old.seed) : poolSeed(), pick.difficulty);
    recent.current = [...recent.current, pick.templateId].slice(-12);
    lastSkill.current = pick.skillId;
    setEmpty(false);
    setCurrent({ pick, question });
    setResponse(undefined);
    setHintLevel(0);
    setCardOpen(false);
    setResult(null);
    // The new card starts at the top: after a deep scroll the old one left the viewport above it.
    if (window.matchMedia(SMALL).matches) window.scrollTo({ top: 0 });
  }, [scope]);

  useEffect(() => {
    replay.current = null;
    next();
    setSession({ answered: 0, correct: 0, streak: 0 });
    setOutcomes([]);
    setRecap(false);
  }, [next]);

  const submit = useCallback(() => {
    if (!current || result || !response || !isAnswered(response)) return;
    const g = grade(current.question, response);
    const timeMs = elapsed;
    const outcome = store.recordAttempt({
      question: current.question,
      correct: g.correct,
      timeMs,
      hintLevel,
      traps: g.traps,
      mode: 'practice',
      response,
      repair: current.pick.remediation,
    });
    // Rewards (traps dodged, streak) go to clean answers only; an unclean correct answer neither earns nor breaks the streak.
    const earned = earnsReward({
      correct: g.correct,
      hintLevel,
      difficulty: current.question.difficulty,
      timeMs,
      paceSec: store.settings.paceSec,
      level: outcome.from,
    });
    const dodged = earned ? dodgedTraps(current.question, response) : [];
    resultAt.current = Date.now();
    setResult({ grade: g, outcome, timeMs, dodged });
    setOutcomes((o) => [
      ...o,
      {
        skillId: current.question.skillId,
        from: outcome.from,
        to: outcome.to,
        correct: g.correct,
        dodged: dodged.length,
        questionId: current.question.id,
        response,
        traps: g.traps,
      },
    ]);
    setSession((s) => ({ answered: s.answered + 1, correct: s.correct + (g.correct ? 1 : 0), streak: !g.correct ? 0 : earned ? s.streak + 1 : s.streak }));
  }, [current, result, response, elapsed, hintLevel, store]);

  // Keyboard: letters / digits pick a choice, Enter submits or goes to the next question.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current || recap || gated) return;
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
  }, [current, recap, gated, result, response, next, submit]);

  const summary = useMemo(() => summarize(outcomes), [outcomes]);
  const restart = () => {
    setSession({ answered: 0, correct: 0, streak: 0 });
    setOutcomes([]);
    setRecap(false);
  };
  // After End session a replay with questions left resumes; one already served in full is over and the scheduler takes back.
  const keepPracticing = () => {
    replay.current = resumeReplay(replay.current);
    restart();
    if (result) next();
  };
  const replayTraps = () => {
    replay.current = replayIds(summary.missed);
    restart();
    next();
  };

  if (empty) {
    if (outcomes.length > 0) {
      return (
        <div className="practice-fx">
          <h1>{scopeTitle(scope)}</h1>
          <SessionRecap summary={summary} onKeep={keepPracticing} onReplay={replayTraps} exhausted />
        </div>
      );
    }
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
  if (recap) {
    return (
      <div className="practice-fx">
        <h1>{scopeTitle(scope)}</h1>
        <SessionRecap summary={summary} onKeep={keepPracticing} onReplay={replayTraps} />
      </div>
    );
  }

  const { question, pick } = current;
  const skill = skillById.get(question.skillId)!;
  if (gated) {
    const start = () => {
      store.markLessonSeen(skill.id);
      window.scrollTo({ top: 0 });
    };
    return (
      <div className="practice-fx">
        <h1>{scopeTitle(scope)}</h1>
        <div className="card">
          <div className="row">
            <h2 style={{ margin: 0 }}>{skill.name}</h2>
            <span className="chip chip-good">New skill</span>
          </div>
          <p className="muted">A short lesson before your first question. Reading it costs nothing.</p>
          <LessonView skillId={skill.id}>
            <div className="row" style={{ marginTop: 18 }}>
              <button className="btn btn-primary btn-big" onClick={start}>
                Start with an easy question
              </button>
              <button className="btn" onClick={start}>
                I know this, test me
              </button>
            </div>
          </LessonView>
        </div>
      </div>
    );
  }
  const template = templateById.get(question.templateId)!;
  const st = store.skills[skill.id];
  const level = st?.level ?? 0;
  const paceSec = store.settings.paceSec;
  // Speed is judged from Proficient on, at the level the answer was given (the result has already moved the skill).
  const judged = paceJudged(result ? result.outcome.from : level);
  const shownMs = result ? result.timeMs : elapsed;
  const [reasonText, reasonCls] = REASON[pick.reason];
  // Mixed practice hides the skill and the style until the result: naming them would give the topic away.
  const mixed = scope.kind !== 'skill';
  const showLabels = !mixed || !!result;
  const reveal = mixed ? ' label-reveal' : '';
  const diffText = `Difficulty: ${DIFF_NAMES[question.difficulty - 1]} (${question.difficulty} of 3)`;
  const nChoices = question.format === 'qc' ? 4 : question.format === 'ne' ? 0 : question.choices.length;
  const stepHint = () => setHintLevel((l) => Math.min(l + 1, FULL_CARD) as HintLevel);
  const last = lastHint(skill.id);
  // One panel: the hint steps before the answer, the free full card after the result.
  const panelText = result ? (cardOpen ? skill.strategy : '') : hintText(skill.strategy, hintLevel, LESSONS[skill.id]?.example);
  // Hint and Check, then the big Next button once there is a result (it sits in the feedback title on a wide screen).
  // On a phone this is a bar pinned to the bottom of the screen at the end of the card, after the hint panel, so a new hint opens above it.
  const actions = result ? (
    small && (
      <div key="next" className="row action-bar">
        {/* detail is 0 for a click from the keyboard or a screen reader, which cannot double tap: only touch and mouse wait. */}
        <button
          autoFocus
          className="btn btn-primary btn-big"
          onClick={(e) => {
            if (e.detail > 0 && Date.now() - resultAt.current < NEXT_GUARD_MS) return;
            next();
          }}
        >
          Next question →
        </button>
      </div>
    )
  ) : (
    <div key="check" className={small ? 'row action-bar' : 'row'} style={small ? undefined : { marginTop: 18 }}>
      <button
        className="btn btn-ghost"
        onClick={stepHint}
        disabled={hintLevel === FULL_CARD}
        aria-describedby={hintLevel === FULL_CARD - 1 ? 'hint-cost' : undefined}
        title={`Three steps: the first line, the bullets, then ${last === 'Full card' ? 'the full card' : 'a worked example with the full card'}. Only the last step costs the mastery credit.`}
      >
        {hintLabel(hintLevel, last)}
      </button>
      {hintLevel === FULL_CARD - 1 && (
        <span id="hint-cost" className="hint-cost small">
          {lastHintCost(last)}
        </span>
      )}
      <span className="spacer" />
      <span className="muted small enter-hint">
        <span className="kbd">Enter</span> to check
      </span>
      <button className="btn btn-primary btn-big" onClick={submit} disabled={!isAnswered(response)}>
        Check
      </button>
    </div>
  );

  return (
    <div className="practice-fx">
      {/* The two groups flow as one row on a wide screen and stack on a phone (display: contents, see fx-practice.css). */}
      <div className="row practice-head" style={{ marginBottom: 12 }}>
        <div className="practice-title">
          <h1 style={{ margin: 0 }}>{scopeTitle(scope)}</h1>
          <span className="spacer" />
          <span className="chip">
            Session: {session.correct}/{session.answered}
          </span>
          <Streak n={session.streak} />
        </div>
        <div className="practice-tools">
          <button className="btn btn-ghost" onClick={() => setRecap(true)} disabled={outcomes.length === 0} title="See how this session went">
            End session
          </button>
          <button className={`btn ${calcOpen ? 'btn-primary' : ''}`} onClick={() => setCalcOpen((v) => !v)}>
            Calculator
          </button>
        </div>
      </div>

      <div className="question-card">
        <div className="question-meta">
          <span className={`chip ${reasonCls}`}>{reasonText}</span>
          {showLabels && (
            <>
              <a className={`chip chip-accent${reveal}`} href={href('practice', 'skill', skill.id)} title="Practice only this skill">
                <i className={`level-dot level-${level}`} />
                <span className="chip-text">
                  {skill.name} · {LEVEL_NAMES[level]}
                </span>
              </a>
              <span className={`chip${reveal}`} title={`Question type: ${template.style}`}>
                <span className="chip-text">{template.style}</span>
              </span>
            </>
          )}
          <span className="chip" role="img" aria-label={diffText} title={diffText}>
            {'●'.repeat(question.difficulty) + '○'.repeat(3 - question.difficulty)}
          </span>
          <span className="spacer" />
          {store.settings.showTimer || result ? (
            <PaceBar
              elapsedMs={shownMs}
              paceSec={paceSec}
              neutral={!judged}
              over={judged ? !isOnPace(shownMs, question.difficulty, paceSec) : undefined}
            />
          ) : (
            <span className="muted small">Timer hidden</span>
          )}
        </div>

        <QuestionView key={question.id} q={question} response={response} onChange={setResponse} locked={!!result} reveal={!!result} autoFocus />

        {!small && actions}

        {result && (
          <Feedback
            result={result}
            question={question}
            paceSec={paceSec}
            skillName={skill.name}
            hintLevel={hintLevel}
            onNext={small ? undefined : next}
            nextStepText={nextStep(result.outcome.state)}
          />
        )}
        {panelText && (
          <div className="strategy-box" ref={panel}>
            {!result && (
              <p className={`small hint-note${hintLevel === FULL_CARD ? ' hint-cost' : ' muted'}`}>
                {hintLevel === FULL_CARD ? lastHintCost(last) : `Hint ${hintLevel} of ${FULL_CARD}`}
              </p>
            )}
            <Rich text={panelText} />
          </div>
        )}
        {small && actions}
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
        <span className="kbd">Enter</span> to check / next. <a href={href('')}>Back to dashboard</a>
        {result && (
          <>
            {' · '}
            <button type="button" className="link-btn" onClick={() => setCardOpen((v) => !v)} aria-expanded={cardOpen}>
              {cardOpen ? 'Hide strategy card' : 'Show strategy card'}
            </button>
          </>
        )}
      </div>
      <div className="muted small" style={{ marginTop: 6 }}>
        Difficulty dots: ●○○ easy, ●●○ medium, ●●● hard. Easy questions do not count toward mastery.
      </div>
    </div>
  );
}

/** Streak chip from 3 on: pops on each increment; when the streak breaks its bar drains and the chip leaves. */
function Streak({ n }: { n: number }) {
  // Last streak >= 3, kept so the bar can drain after a break instead of vanishing.
  const [shown, setShown] = useState(0);
  const live = n >= 3;
  if (live && n !== shown) setShown(n);
  useEffect(() => {
    if (live || !shown) return;
    const t = window.setTimeout(() => setShown(0), 800);
    return () => window.clearTimeout(t);
  }, [live, shown]);
  if (!shown) return null;
  return (
    <span className={`streak${live ? '' : ' broken'}`}>
      <span key={shown} className="chip chip-accent streak-chip">
        Streak {shown}
      </span>
      <span className="streak-bar">
        <i style={{ transform: `scaleX(${live ? 1 : 0})` }} />
      </span>
    </span>
  );
}

function Feedback({
  result,
  question,
  paceSec,
  skillName,
  hintLevel,
  onNext,
  nextStepText,
}: {
  result: Result;
  question: Question;
  paceSec: number;
  skillName: string;
  hintLevel: HintLevel;
  /** Absent on a phone, where the Next button is the bar pinned to the bottom. */
  onNext?: () => void;
  nextStepText: string;
}) {
  const { grade: g, outcome, timeMs } = result;
  const judged = paceJudged(outcome.from);
  const onPace = isOnPace(timeMs, question.difficulty, paceSec);
  const traps = g.traps.map((id) => TRAPS[id]).filter(Boolean);
  const dodged = result.dodged.filter((id) => TRAPS[id]);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  // Focusing Next also brings the result into view; without that button (the pinned bar has focus) do it directly.
  useEffect(() => {
    if (nextBtn.current) nextBtn.current.focus();
    else box.current?.scrollIntoView({ block: 'nearest' });
  }, []);
  // Why a correct answer may not move the skill. Credit rule: the model (a style needs difficulty 2 or 3 and no full card; only the pace gates Mastered).
  const creditNote =
    hintLevel === FULL_CARD
      ? `Correct, but with the ${lastHint(question.skillId).toLowerCase()} open this answer does not count toward mastery.`
      : question.difficulty < 2
        ? 'Correct. Easy questions do not count toward mastery.'
        : judged && !onPace
          ? outcome.from === 4
            ? 'Correct, but over the pace: a Mastered skill is confirmed only by answers on pace.'
            : 'Correct, and this question type counts. It was over the pace, though, and Mastered needs an answer on pace.'
          : '';
  return (
    <div className={`feedback ${g.correct ? 'ok' : 'ko'}`} ref={box}>
      <div className="feedback-title">
        <span style={{ color: g.correct ? 'var(--good)' : 'var(--bad)' }}>{g.correct ? 'Correct' : g.invalid ? 'Not a valid answer' : 'Not quite'}</span>
        <span className={`chip ${judged ? (onPace ? 'chip-good' : 'chip-warn') : ''}`}>
          {formatClock(timeMs)}
          {judged && (onPace ? ' (on pace)' : ' (over the pace)')}
        </span>
        {hintLevel === FULL_CARD && <span className="chip chip-warn">hint used</span>}
        <span className="spacer" />
        {onNext && (
          <button ref={nextBtn} className="btn btn-primary" onClick={onNext}>
            Next question →
          </button>
        )}
      </div>

      <p className="small" style={{ margin: '10px 0 0' }}>
        <strong>{skillName}</strong>:{' '}
        {outcome.from !== outcome.to ? <LevelChange from={outcome.from} to={outcome.to} /> : <span className="chip">{LEVEL_NAMES[outcome.to]}</span>}{' '}
        {g.correct ? `${creditNote} ${nextStepText}`.trim() : 'This skill comes back within a few questions with new numbers, then again tomorrow in a different question type.'}
      </p>

      {dodged.length > 0 && (
        <p className="trap-dodged small">
          <strong>{dodged.length > 1 ? 'Traps dodged' : 'Trap dodged'}:</strong>{' '}
          {dodged.map((id, i) => (
            <Fragment key={id}>
              {i > 0 && ', '}
              <RichInline text={TRAPS[id].label} />
            </Fragment>
          ))}
        </p>
      )}

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
    </div>
  );
}
