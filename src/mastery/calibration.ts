// Checks that the declared difficulty levels behave as declared: success should fall from 1 to 3.
// Only section-test questions of a medium-level section are counted: there the difficulty is drawn at random
// (see DIFF_WEIGHTS in section.ts), independent of the learner. In practice mode the mastery model raises the
// difficulty after clean streaks and lowers it after a miss, so practice rates are confounded by the learner's state.

import { parseQuestionId } from '../engine/generate';
import type { Area, Difficulty } from '../engine/types';
import type { AttemptRecord, SectionRecord } from '../store/progress';

export interface Cell {
  n: number;
  correct: number;
  timeMs: number;
}

/** One cell per difficulty, index 0 = difficulty 1. */
export type Row = [Cell, Cell, Cell];

export interface Inversion {
  skillId: string;
  /** The easier level of the first adjacent pair where the harder level has a higher success rate. */
  easier: 1 | 2;
  /** Success rate per difficulty, null below MIN_PER_CELL answers. */
  rates: [number | null, number | null, number | null];
}

export interface Calibration {
  overall: Row;
  byArea: Partial<Record<Area, Row>>;
  inverted: Inversion[];
}

/** ponytail: fixed floor against noise on a single user's data, a binomial test if it flags too much. */
export const MIN_PER_CELL = 10;

const emptyRow = (): Row => [
  { n: 0, correct: 0, timeMs: 0 },
  { n: 0, correct: 0, timeMs: 0 },
  { n: 0, correct: 0, timeMs: 0 },
];

function add(row: Row, d: Difficulty, h: AttemptRecord) {
  const c = row[d - 1];
  c.n++;
  c.correct += h.correct ? 1 : 0;
  c.timeMs += h.timeMs;
}

/** Counts section attempts whose question sits in a medium-level part. Hinted answers are left out: a hint makes any level easier. */
export function calibrate(history: AttemptRecord[], sections: SectionRecord[], areaOf: (skillId: string) => Area | undefined): Calibration {
  const medium = new Set(sections.flatMap((s) => s.parts.filter((p) => p.difficulty === 2).flatMap((p) => p.qids)));
  const overall = emptyRow();
  const byArea: Partial<Record<Area, Row>> = {};
  const bySkill = new Map<string, Row>();
  for (const h of history) {
    const d = h.hinted || h.mode !== 'section' || !medium.has(h.qid) ? undefined : parseQuestionId(h.qid)?.difficulty;
    if (!d) continue;
    add(overall, d, h);
    const a = areaOf(h.skillId);
    if (a) add((byArea[a] ??= emptyRow()), d, h);
    if (!bySkill.has(h.skillId)) bySkill.set(h.skillId, emptyRow());
    add(bySkill.get(h.skillId)!, d, h);
  }
  const inverted: Inversion[] = [];
  for (const [skillId, row] of bySkill) {
    const rates = row.map((c) => (c.n >= MIN_PER_CELL ? c.correct / c.n : null)) as Inversion['rates'];
    const easier = ([1, 2] as const).find((k) => rates[k - 1] !== null && rates[k] !== null && rates[k]! > rates[k - 1]!);
    if (easier) inverted.push({ skillId, easier, rates });
  }
  return { overall, byArea, inverted };
}
