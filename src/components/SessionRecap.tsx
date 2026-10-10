import { useEffect, useRef } from 'react';
import { skillById } from '../content';
import { LEVEL_NAMES } from '../mastery/model';
import type { SessionSummary, SkillMove } from '../mastery/session';
import { href } from '../router';

const STAGGER_MS = 40;

function MoveRow({ move, index }: { move: SkillMove; index: number }) {
  const delay = index * STAGGER_MS;
  return (
    <li className="recap-row" style={{ animationDelay: `${delay}ms` }}>
      <span className="recap-name">{skillById.get(move.skillId)?.name ?? move.skillId}</span>
      <span className="recap-levels">
        <i className={`level-dot level-${move.from}`} />
        <span className="recap-arrow" style={{ animationDelay: `${delay + 80}ms` }}>
          →
        </span>
        <i className={`level-dot level-${move.to} recap-to`} style={{ animationDelay: `${delay + 140}ms` }} />
      </span>
      <span className="muted small recap-names">
        {LEVEL_NAMES[move.from]} → {LEVEL_NAMES[move.to]}
      </span>
    </li>
  );
}

/** End-of-session card. `exhausted`: nothing is left to practice in this selection, so there is nothing to keep going with. */
export function SessionRecap({ summary, onKeep, exhausted }: { summary: SessionSummary; onKeep: () => void; exhausted?: boolean }) {
  const keep = useRef<HTMLButtonElement>(null);
  const smart = useRef<HTMLAnchorElement>(null);
  useEffect(() => (keep.current ?? smart.current)?.focus(), []);
  const { answered, correct, accuracy, dodged, up, down } = summary;
  return (
    <div className="card session-recap">
      <h2>Session recap</h2>
      <div className="recap-stats">
        <div className="stat">
          <b>{answered}</b>
          <span>Answered</span>
        </div>
        <div className="stat">
          <b>{correct}</b>
          <span>Correct</span>
        </div>
        <div className="stat">
          <b>{accuracy}%</b>
          <span>Accuracy</span>
        </div>
        <div className="stat">
          <b>{dodged}</b>
          <span>Traps dodged</span>
        </div>
      </div>

      {up.length > 0 && (
        <>
          <h3>Moved up</h3>
          <ul className="recap-list">
            {up.map((m, i) => (
              <MoveRow key={m.skillId} move={m} index={i} />
            ))}
          </ul>
        </>
      )}
      {down.length > 0 && (
        <>
          <h3>Back for review</h3>
          <ul className="recap-list">
            {down.map((m, i) => (
              <MoveRow key={m.skillId} move={m} index={up.length + i} />
            ))}
          </ul>
        </>
      )}
      {up.length + down.length === 0 && <p className="muted small">No skill changed level this session.</p>}
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
        <a className="btn" href={href('')}>
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
