// Builders that generators use to assemble answer choices consistently.

import { Frac, type FracLike } from './frac';
import type { Rng } from './rng';
import type { Choice, QCChoice, Rich } from './types';

export const QC_CHOICES: QCChoice[] = ['A', 'B', 'C', 'D'];

export const QC_TEXT: Record<QCChoice, string> = {
  A: 'Quantity A is greater.',
  B: 'Quantity B is greater.',
  C: 'The two quantities are equal.',
  D: 'The relationship cannot be determined from the information given.',
};

const toFrac = (x: FracLike): Frac => (x instanceof Frac ? x : Frac.of(x));

/** Compare two exact values: A if a > b, B if a < b, C if equal. */
export function qcCompare(a: FracLike, b: FracLike): QCChoice {
  const c = toFrac(a).cmp(toFrac(b));
  return c > 0 ? 'A' : c < 0 ? 'B' : 'C';
}

/** Same with plain numbers (use only when both sides are exact in floating point or far apart). */
export function qcCompareNum(a: number, b: number, eps = 1e-9): QCChoice {
  if (Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b))) return 'C';
  return a > b ? 'A' : 'B';
}

/**
 * QC answer from many (A, B) samples drawn from the allowed values: if every sample agrees the
 * answer is that relation, otherwise D. Used by check() functions to verify "cannot be determined".
 */
export function qcFromSamples(samples: Iterable<[number | Frac, number | Frac]>): QCChoice {
  const seen = new Set<QCChoice>();
  for (const [a, b] of samples) {
    const r = a instanceof Frac || b instanceof Frac ? qcCompare(toFrac(a), toFrac(b)) : qcCompareNum(a, b);
    seen.add(r);
    if (seen.size > 1) return 'D';
  }
  if (seen.size === 0) throw new Error('qcFromSamples: no samples');
  return [...seen][0];
}

export interface NumericChoiceOpts {
  correct: FracLike;
  /** Wrong values coming from specific mistakes (kept first). */
  traps?: { value: FracLike; trap: string }[];
  /** Other plausible wrong values, used in order until there are `count` choices. */
  fillers?: FracLike[];
  /** Number of choices (5 for GRE single-answer questions). */
  count?: number;
  /** How each value is displayed (rich text). */
  format: (v: Frac) => Rich;
  /** 'asc' (GRE default for numbers), 'desc', or 'random'. */
  order?: 'asc' | 'desc' | 'random';
}

/**
 * Build numeric choices: unique values, traps kept in priority, filled up to `count`, then ordered.
 * If traps + fillers are not enough, nearby values around the correct answer are added.
 */
export function numericChoices(rng: Rng, opts: NumericChoiceOpts): { choices: Choice[]; answer: number } {
  const count = opts.count ?? 5;
  const correct = toFrac(opts.correct);
  const items: { v: Frac; trap?: string; correct?: boolean }[] = [{ v: correct, correct: true }];
  const has = (v: Frac) => items.some((it) => it.v.eq(v));
  for (const t of opts.traps ?? []) {
    const v = toFrac(t.value);
    if (items.length < count && !has(v)) items.push({ v, trap: t.trap });
  }
  for (const f of opts.fillers ?? []) {
    const v = toFrac(f);
    if (items.length < count && !has(v)) items.push({ v });
  }
  let step = 1;
  const base = correct.isInt() ? new Frac(Math.max(1, Math.round(Math.abs(correct.toNumber()) / 10))) : new Frac(1, correct.d);
  while (items.length < count) {
    const cand = correct.add(base.mul(step * (rng.chance(0.5) ? 1 : -1)));
    if (!has(cand) && (correct.sign() < 0 || cand.sign() >= 0)) items.push({ v: cand });
    step++;
    if (step > 50) throw new Error('numericChoices: could not fill choices');
  }
  const order = opts.order ?? 'asc';
  const ordered =
    order === 'random'
      ? rng.shuffle(items)
      : [...items].sort((a, b) => (order === 'asc' ? a.v.cmp(b.v) : b.v.cmp(a.v)));
  const texts = ordered.map((it) => opts.format(it.v));
  if (new Set(texts).size !== texts.length) throw new Error(`numericChoices: two choices display the same: ${texts.join(' | ')}`);
  return {
    choices: ordered.map((it, i) => ({ text: texts[i], ...(it.trap ? { trap: it.trap } : {}) })),
    answer: ordered.findIndex((it) => it.correct),
  };
}

/**
 * Text choices: one correct + wrong ones (each may carry a trap id).
 * order 'random' shuffles, 'fixed' keeps [correct, ...wrong] order shuffled only if asked.
 */
export function textChoices(
  rng: Rng,
  correct: Rich,
  wrong: Choice[],
  order: 'random' | 'keep' = 'random',
): { choices: Choice[]; answer: number } {
  const all: (Choice & { ok?: boolean })[] = [{ text: correct, ok: true }, ...wrong];
  const texts = all.map((c) => c.text);
  if (new Set(texts).size !== texts.length) throw new Error(`textChoices: duplicate choices: ${texts.join(' | ')}`);
  const ordered = order === 'random' ? rng.shuffle(all) : all;
  return {
    choices: ordered.map(({ ok: _ok, ...c }) => c),
    answer: ordered.findIndex((c) => c.ok),
  };
}

/**
 * Choices with a fixed order where correctness is known per item (for "Indicate all" questions or
 * when the order is meaningful, e.g. times of day). Returns ascending answer indices.
 */
export function flaggedChoices(items: (Choice & { correct: boolean })[]): { choices: Choice[]; answer: number[] } {
  const texts = items.map((c) => c.text);
  if (new Set(texts).size !== texts.length) throw new Error(`flaggedChoices: duplicate choices: ${texts.join(' | ')}`);
  return {
    choices: items.map(({ correct: _c, ...c }) => c),
    answer: items.flatMap((c, i) => (c.correct ? [i] : [])),
  };
}

/** Letter label for a choice index: 0 -> A. */
export const letter = (i: number) => String.fromCharCode(65 + i);
