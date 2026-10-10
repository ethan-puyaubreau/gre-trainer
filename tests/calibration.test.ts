import { describe, expect, it } from 'vitest';
import { calibrate, MIN_PER_CELL } from '../src/mastery/calibration';
import type { AttemptRecord, SectionRecord } from '../src/store/progress';

type Diff = 1 | 2 | 3;

// Section attempts by default, with a distinct seed per call so every qid is unique.
let seed = 0;
const rec = (
  skillId: string,
  d: Diff,
  correct: boolean,
  timeMs = 60_000,
  hinted = false,
  mode: AttemptRecord['mode'] = 'section',
): AttemptRecord => ({
  qid: `${skillId}.t#${++seed}#${d}`,
  skillId,
  templateId: `${skillId}.t`,
  correct,
  timeMs,
  at: 0,
  mode,
  traps: [],
  hinted,
});
const many = (n: number, f: (i: number) => AttemptRecord) => Array.from({ length: n }, (_, i) => f(i));
const area = (id: string) => (id.startsWith('arith') ? 'arithmetic' : 'algebra');

/** Sections whose parts have the given level (1 easy, 2 medium, 3 hard) and list these attempts as their questions. */
const sectionOf = (level: Diff, attempts: AttemptRecord[]): SectionRecord => ({
  at: 0,
  parts: [
    {
      questions: attempts.length,
      correct: attempts.filter((a) => a.correct).length,
      limitSec: 1,
      usedSec: 1,
      difficulty: level,
      qids: attempts.map((a) => a.qid),
      results: attempts.map((a) => a.correct),
    },
  ],
});
/** Attempts of a medium-level section, with the section record. */
const medium = (attempts: AttemptRecord[]) => ({ history: attempts, sections: [sectionOf(2, attempts)] });

describe('difficulty calibration', () => {
  it('counts answers, successes and time per difficulty, overall and per area', () => {
    const { history, sections } = medium([rec('arith.a', 1, true, 30_000), rec('arith.a', 1, false, 90_000), rec('alg.b', 3, true)]);
    const c = calibrate(history, sections, area);
    expect(c.overall[0]).toEqual({ n: 2, correct: 1, timeMs: 120_000 });
    expect(c.overall[2]).toEqual({ n: 1, correct: 1, timeMs: 60_000 });
    expect(c.byArea.arithmetic?.[0].n).toBe(2);
    expect(c.byArea.algebra?.[2].n).toBe(1);
  });

  it('ignores practice attempts and attempts from easy or hard parts', () => {
    const practice = [rec('arith.a', 2, true, 1, false, 'practice'), rec('arith.a', 3, false, 1, false, 'practice')];
    const easy = [rec('arith.a', 1, true), rec('arith.a', 2, false)];
    const hard = [rec('arith.a', 3, true), rec('arith.a', 2, true)];
    const counted = rec('arith.a', 2, true);
    // The practice attempts share a qid with a medium part: the mode still rules them out.
    const sections = [sectionOf(1, easy), sectionOf(3, hard), sectionOf(2, [counted, ...practice])];
    const c = calibrate([...practice, ...easy, ...hard, counted], sections, area);
    expect(c.overall.map((cell) => cell.n)).toEqual([0, 1, 0]);
    // A section attempt missing from every part (an interrupted section) is not counted either.
    expect(calibrate([rec('arith.a', 2, true)], [], area).overall.every((cell) => cell.n === 0)).toBe(true);
  });

  it('counts the medium parts of a section that also has other levels', () => {
    const a = rec('arith.a', 2, true);
    const b = rec('arith.a', 3, false);
    const other = rec('arith.a', 1, true);
    const s: SectionRecord = { at: 0, parts: [sectionOf(2, [a, b]).parts[0], sectionOf(3, [other]).parts[0]] };
    const c = calibrate([a, b, other], [s], area);
    expect(c.overall.map((cell) => cell.n)).toEqual([0, 1, 1]);
  });

  it('skips hinted answers and ids without a difficulty', () => {
    const hinted = rec('arith.a', 2, true, 1, true);
    const bad = { ...rec('arith.a', 2, true), qid: 'bad' };
    const sections = [sectionOf(2, [hinted, bad])];
    expect(calibrate([hinted, bad], sections, area).overall.every((cell) => cell.n === 0)).toBe(true);
  });

  it('flags a skill only when a harder level beats an easier one on enough answers', () => {
    const inverted = [...many(MIN_PER_CELL, (i) => rec('arith.a', 2, i < 4)), ...many(MIN_PER_CELL, (i) => rec('arith.a', 3, i < 8))];
    const s = [sectionOf(2, inverted)];
    expect(calibrate(inverted, s, area).inverted).toEqual([{ skillId: 'arith.a', easier: 2, rates: [null, 0.4, 0.8] }]);
    // Same rates on too few answers: not flagged.
    expect(calibrate(inverted.slice(1), s, area).inverted).toEqual([]);
    // Success falling with difficulty: not flagged.
    const ordered = [...many(MIN_PER_CELL, () => rec('alg.b', 1, true)), ...many(MIN_PER_CELL, (i) => rec('alg.b', 2, i < 5))];
    expect(calibrate(ordered, [sectionOf(2, ordered)], area).inverted).toEqual([]);
  });
});
