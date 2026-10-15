import { useEffect, useRef, useState } from 'react';

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Elapsed milliseconds since `key` changed, paused while `running` is false. */
export function useStopwatch(running: boolean, key: unknown): number {
  const [elapsed, setElapsed] = useState(0);
  const base = useRef(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    base.current = 0;
    start.current = null;
    setElapsed(0);
  }, [key]);

  useEffect(() => {
    if (!running) {
      if (start.current !== null) {
        base.current += performance.now() - start.current;
        start.current = null;
      }
      setElapsed(base.current);
      return;
    }
    start.current = performance.now();
    const id = window.setInterval(() => {
      if (start.current !== null) setElapsed(base.current + performance.now() - start.current);
    }, 250);
    return () => {
      window.clearInterval(id);
      if (start.current !== null) {
        base.current += performance.now() - start.current;
        start.current = null;
      }
    };
  }, [running, key]);

  return elapsed;
}

/**
 * Per-question pace bar: green, then orange after 75% of the pace, red once over. `over` lets the caller decide what
 * "over" means (the model gives hard questions more time); `neutral` greys the bar out, with no judgment.
 */
export function PaceBar({
  elapsedMs,
  paceSec,
  hidden,
  neutral,
  over,
}: {
  elapsedMs: number;
  paceSec: number;
  hidden?: boolean;
  neutral?: boolean;
  over?: boolean;
}) {
  const ratio = elapsedMs / (paceSec * 1000);
  const cls = neutral ? 'pace-neutral' : (over ?? ratio > 1) ? 'pace-red' : ratio > 0.75 ? 'pace-orange' : 'pace-green';
  const title = neutral
    ? `Reference pace: ${formatClock(paceSec * 1000)} per question. Speed counts once the skill is Proficient.`
    : `GRE pace: ${formatClock(paceSec * 1000)} per question, with extra time on hard questions`;
  return (
    <div className={`pace ${cls}`} title={title}>
      <div className="bar">
        <div style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
      <span className="time">{hidden ? '•:••' : formatClock(elapsedMs)}</span>
      <span className="muted small">/ {formatClock(paceSec * 1000)}</span>
    </div>
  );
}
