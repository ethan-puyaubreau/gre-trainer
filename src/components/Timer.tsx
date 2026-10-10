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

/** Per-question pace bar: green, then orange after 75% of the pace, red after the pace. */
export function PaceBar({ elapsedMs, paceSec, hidden }: { elapsedMs: number; paceSec: number; hidden?: boolean }) {
  const ratio = elapsedMs / (paceSec * 1000);
  const cls = ratio > 1 ? 'pace-red' : ratio > 0.75 ? 'pace-orange' : 'pace-green';
  return (
    <div className={`pace ${cls}`} title={`GRE pace: ${formatClock(paceSec * 1000)} per question`}>
      <div className="bar">
        <div style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
      <span className="time">{hidden ? '•:••' : formatClock(elapsedMs)}</span>
      <span className="muted small">/ {formatClock(paceSec * 1000)}</span>
    </div>
  );
}
