import { describe, expect, it } from 'vitest';
import { calibrate, MIN_PER_CELL } from '../src/mastery/calibration';
import type { AttemptRecord } from '../src/store/progress';

const rec = (skillId: string, d: 1 | 2 | 3, correct: boolean, timeMs = 60_000, hinted = false): AttemptRecord => ({
  qid: `${skillId}.t#7#${d}`,
  skillId,
  templateId: `${skillId}.t`,
  correct,
  timeMs,
  at: 0,
  mode: 'practice',
  traps: [],
  hinted,
});
const many = (n: number, f: (i: number) => AttemptRecord) => Array.from({ length: n }, (_, i) => f(i));
const area = (id: string) => (id.startsWith('arith') ? 'arithmetic' : 'algebra');

describe('difficulty calibration', () => {
  it('counts answers, successes and time per difficulty, overall and per area', () => {
    const c = calibrate([rec('arith.a', 1, true, 30_000), rec('arith.a', 1, false, 90_000), rec('alg.b', 3, true)], area);
    expect(c.overall[0]).toEqual({ n: 2, correct: 1, timeMs: 120_000 });
    expect(c.overall[2]).toEqual({ n: 1, correct: 1, timeMs: 60_000 });
    expect(c.byArea.arithmetic?.[0].n).toBe(2);
    expect(c.byArea.algebra?.[2].n).toBe(1);
  });

  it('skips hinted answers and ids without a difficulty', () => {
    const c = calibrate([rec('arith.a', 2, true, 1, true), { ...rec('arith.a', 2, true), qid: 'bad' }], area);
    expect(c.overall.every((cell) => cell.n === 0)).toBe(true);
  });

  it('flags a skill only when a harder level beats an easier one on enough answers', () => {
    const inverted = [
      ...many(MIN_PER_CELL, (i) => rec('arith.a', 2, i < 4)),
      ...many(MIN_PER_CELL, (i) => rec('arith.a', 3, i < 8)),
    ];
    expect(calibrate(inverted, area).inverted).toEqual([{ skillId: 'arith.a', easier: 2, rates: [null, 0.4, 0.8] }]);
    // Same rates on too few answers: not flagged.
    expect(calibrate(inverted.slice(1), area).inverted).toEqual([]);
    // Success falling with difficulty: not flagged.
    const ordered = [...many(MIN_PER_CELL, () => rec('alg.b', 1, true)), ...many(MIN_PER_CELL, (i) => rec('alg.b', 2, i < 5))];
    expect(calibrate(ordered, area).inverted).toEqual([]);
  });
});
