import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { skillById, templateById, TRAPS } from '../content';
import { generateQuestion, parseQuestionId } from '../engine/generate';
import { LEVEL_NAMES } from '../mastery/model';
import { stemPreview, type SessionOutcome, type SessionSummary, type SkillMove } from '../mastery/session';
import { reducedMotion } from '../motion';
import { href } from '../router';
import { QuestionView } from './QuestionView';
import { Rich, RichInline } from './Rich';

/** Entry order of the cascade: `--i` times the stagger step set in fx-practice.css gives each element's delay. */
const at = (i: number) => ({ '--i': i }) as CSSProperties;
/** Count-up duration, the same as --dur-slow. */
const COUNT_MS = 600;
/** Same step as --stagger in fx-practice.css. */
const STAGGER_MS = 40;

/** Counts from 0 to `to` once `delay` has passed; with reduced motion the final value is there from the first render. */
function CountUp({ to, delay, suffix = '' }: { to: number; delay: number; suffix?: string }) {
  const [v, setV] = useState(() => (reducedMotion() ? to : 0));
  useEffect(() => {
    if (reducedMotion()) {
      setV(to);
      return;
    }
    let raf = 0;
    let t0 = 0;
    const step = (now: number) => {
      t0 ||= now + delay;
      const k = Math.min(1, Math.max(0, (now - t0) / COUNT_MS));
      setV(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, delay]);
  return (
    <>
      {v}
      {suffix}
    </>
  );
}

function MoveRow({ move, index }: { move: SkillMove; index: number }) {
  return (
    <li className="recap-row recap-in" style={at(index)}>
      <span className="recap-name">{skillById.get(move.skillId)?.name ?? move.skillId}</span>
      <span className="recap-levels">
        <i className={`level-dot level-${move.from}`} />
        <span className="recap-arrow">→</span>
        <i className={`level-dot level-${move.to} recap-to`} />
      </span>
      <span className="muted small recap-names">
        {LEVEL_NAMES[move.from]} → {LEVEL_NAMES[move.to]}
      </span>
    </li>
  );
}

/** A missed question: a preview line, the trap that was picked, and the full question with its explanation opening in place. */
function MissRow({ miss, index }: { miss: SessionOutcome; index: number }) {
  const [open, setOpen] = useState(false);
  // The id is enough to rebuild the question the user saw.
  const q = useMemo(() => {
    const p = parseQuestionId(miss.questionId);
    const t = p && templateById.get(p.templateId);
    return p && t ? generateQuestion(t, p.seed, p.difficulty) : null;
  }, [miss.questionId]);
  if (!q) return null;
  const traps = miss.traps.map((id) => TRAPS[id]).filter(Boolean);
  return (
    <li className="recap-miss recap-in" style={at(index)}>
      <div className="recap-miss-head">
        <span className="recap-name">{skillById.get(q.skillId)?.name ?? q.skillId}</span>
        {traps.map((t, i) => (
          <span key={i} className="recap-trap small">
            Trap: <RichInline text={t.label} />
          </span>
        ))}
      </div>
      <div className="recap-stem muted small">
        <RichInline text={stemPreview(q)} />
      </div>
      <details onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary>{open ? 'Hide explanation' : 'Show explanation'}</summary>
        {open && (
          <div className="recap-detail">
            <QuestionView q={q} response={miss.response} locked reveal />
            {traps.map((t, i) => (
              <div className="trap-box" key={i}>
                <strong>
                  Trap: <RichInline text={t.label} />
                </strong>
                <Rich text={t.fix} />
              </div>
            ))}
            <h4>Explanation</h4>
            <Rich className="explanation" text={q.explanation} />
          </div>
        )}
      </details>
    </li>
  );
}

/**
 * End-of-session card. `exhausted`: nothing is left to practice in this selection, so there is nothing to keep going with.
 * `onReplay` starts a run on the missed questions' templates with new numbers (the button shows only when something was missed).
 */
export function SessionRecap({
  summary,
  onKeep,
  onReplay,
  exhausted,
}: {
  summary: SessionSummary;
  onKeep: () => void;
  onReplay?: () => void;
  exhausted?: boolean;
}) {
  const keep = useRef<HTMLButtonElement>(null);
  const smart = useRef<HTMLAnchorElement>(null);
  useEffect(() => (keep.current ?? smart.current)?.focus(), []);
  const { answered, correct, accuracy, dodged, up, down, missed } = summary;
  const stats: [number, string, string?][] = [
    [answered, 'Answered'],
    [correct, 'Correct'],
    [accuracy, 'Accuracy', '%'],
    [dodged, 'Traps dodged'],
  ];
  // The cascade runs through the counters, then the skill rows, then the missed questions.
  const upAt = stats.length;
  const downAt = upAt + up.length;
  const missAt = downAt + down.length;
  return (
    <div className="card session-recap">
      <h2>Session recap</h2>
      <div className="recap-stats">
        {stats.map(([n, label, suffix], i) => (
          <div className="stat recap-in" style={at(i)} key={label}>
            <b>
              <CountUp to={n} delay={i * STAGGER_MS} suffix={suffix} />
            </b>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {up.length > 0 && (
        <>
          <h3>Moved up</h3>
          <ul className="recap-list">
            {up.map((m, i) => (
              <MoveRow key={m.skillId} move={m} index={upAt + i} />
            ))}
          </ul>
        </>
      )}
      {down.length > 0 && (
        <>
          <h3>Back for review</h3>
          <ul className="recap-list">
            {down.map((m, i) => (
              <MoveRow key={m.skillId} move={m} index={downAt + i} />
            ))}
          </ul>
        </>
      )}
      {up.length + down.length === 0 && <p className="muted small">No skill ended the session at a different level.</p>}
      {missed.length > 0 && (
        <>
          <h3>To review</h3>
          <ul className="recap-list">
            {missed.map((m, i) => (
              <MissRow key={`${m.questionId}:${i}`} miss={m} index={missAt + i} />
            ))}
          </ul>
        </>
      )}
      {exhausted && <p className="muted small">Nothing else is due in this selection.</p>}

      <div className="row" style={{ marginTop: 18 }}>
        {exhausted ? (
          <a ref={smart} className="btn btn-primary" href={href('practice')}>
            Smart practice
          </a>
        ) : (
          <button ref={keep} className="btn btn-primary" onClick={onKeep}>
            Keep practicing
          </button>
        )}
        {onReplay && missed.length > 0 && (
          <button className="btn" onClick={onReplay} title="The same kinds of question as the ones you missed, with new numbers">
            Replay my traps
          </button>
        )}
        <a className="btn" href={href('')}>
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
