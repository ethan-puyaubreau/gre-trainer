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
  /**
   * Spacing of made-up distractors when traps and fillers run out on one side of the answer.
   * Set it for "approximately" questions so no invented choice sits close to the answer.
   */
  step?: FracLike;
}

/** Step for made-up distractors around a value: 1 for small integers, 10 for hundreds, 1/d for fractions. */
function syntheticStep(correct: Frac): Frac {
  if (!correct.isInt()) return new Frac(1, correct.d);
  const a = Math.abs(correct.n);
  if (a < 20) return new Frac(1);
  return new Frac(10 ** Math.max(0, Math.floor(Math.log10(a)) - 1));
}

/**
 * Build numeric choices: unique values, traps kept in priority, then fillers, ordered ascending
 * (or descending). The correct answer lands at a random position (as uniform as the traps allow):
 * fillers are taken from the side that still needs values, then made-up neighbors if needed.
 */
export function numericChoices(rng: Rng, opts: NumericChoiceOpts): { choices: Choice[]; answer: number } {
  const count = opts.count ?? 5;
  const correct = toFrac(opts.correct);
  const order = opts.order ?? 'asc';
  type Item = { v: Frac; trap?: string; correct?: boolean };
  const used: Frac[] = [correct];
  const has = (v: Frac) => used.some((u) => u.eq(v));
  const below: Item[] = [];
  const above: Item[] = [];
  const traps = (opts.traps ?? [])
    .map((t) => ({ v: toFrac(t.value), trap: t.trap }))
    .filter((t, i, arr) => !t.v.eq(correct) && arr.findIndex((u) => u.v.eq(t.v)) === i);
  // Uniform random target index (in ascending order), like the real test. Traps are kept in priority
  // order when they fit on their side of the target.
  let target = rng.int(0, count - 1);
  for (const t of traps) {
    const side = t.v.lt(correct) ? below : above;
    const cap = order === 'random' ? count - 1 : t.v.lt(correct) ? target : count - 1 - target;
    if (side.length < cap && below.length + above.length < count - 1) {
      used.push(t.v);
      side.push({ v: t.v, trap: t.trap });
    }
  }

  let items: Item[];
  if (order === 'random') {
    const pool = [...below, ...above];
    for (const f of opts.fillers ?? []) {
      const v = toFrac(f);
      if (pool.length < count - 1 && !has(v)) {
        used.push(v);
        pool.push({ v });
      }
    }
    items = [{ v: correct, correct: true }, ...pool];
  } else {
    const fillers = (opts.fillers ?? []).map(toFrac).filter((v, i, arr) => !has(v) && arr.findIndex((w) => w.eq(v)) === i);
    const fillBelow = fillers.filter((v) => v.lt(correct));
    const fillAbove = fillers.filter((v) => v.gt(correct));
    const nonNegative = correct.sign() >= 0;
    const step = opts.step !== undefined ? toFrac(opts.step) : syntheticStep(correct);
    const take = (side: 'below' | 'above', need: number): number => {
      const list = side === 'below' ? below : above;
      const src = side === 'below' ? fillBelow : fillAbove;
      while (need > 0 && src.length) {
        const v = src.shift()!;
        if (has(v)) continue;
        used.push(v);
        list.push({ v });
        need--;
      }
      for (let k = 1; need > 0 && k <= 60; k++) {
        const v = side === 'below' ? correct.sub(step.mul(k)) : correct.add(step.mul(k));
        if (has(v) || (nonNegative && v.sign() < 0)) continue;
        used.push(v);
        list.push({ v });
        need--;
      }
      return need; // shortfall
    };
    const shortBelow = take('below', target - below.length);
    if (shortBelow > 0) target -= shortBelow;
    const shortAbove = take('above', count - 1 - target - above.length);
    if (shortAbove > 0) take('below', shortAbove);
    items = [...below, { v: correct, correct: true }, ...above];
    if (items.length !== count) throw new Error('numericChoices: could not fill choices');
  }

  const ordered =
    order === 'random' ? rng.shuffle(items) : [...items].sort((a, b) => (order === 'asc' ? a.v.cmp(b.v) : b.v.cmp(a.v)));
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

/**
 * Choices for values that are not exact fractions (radicals, multiples of π...): give the correct
 * value and a priority-ordered list of candidate distractors with their numeric values. Picks a
 * uniform random position for the answer, takes candidates from each side of it in priority order,
 * and sorts the result ascending. Candidates equal in value to the answer or to each other are skipped.
 */
export function valuedChoices(
  rng: Rng,
  correct: { text: Rich; value: number },
  candidates: { text: Rich; value: number; trap?: string }[],
  count = 5,
): { choices: Choice[]; answer: number } {
  const same = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  const uniq: typeof candidates = [];
  for (const c of candidates) {
    if (same(c.value, correct.value) || uniq.some((u) => same(u.value, c.value) || u.text === c.text)) continue;
    uniq.push(c);
  }
  const below = uniq.filter((c) => c.value < correct.value);
  const above = uniq.filter((c) => c.value > correct.value);
  if (below.length + above.length < count - 1) throw new Error('valuedChoices: not enough distinct candidates');
  let target = rng.int(0, count - 1);
  target = Math.min(target, below.length);
  target = Math.max(target, count - 1 - above.length);
  const picked = [...below.slice(0, target), ...above.slice(0, count - 1 - target)];
  const all = [{ ...correct, ok: true }, ...picked].sort((a, b) => a.value - b.value);
  return {
    choices: all.map((c) => ({ text: c.text, ...('trap' in c && c.trap ? { trap: c.trap } : {}) })),
    answer: all.findIndex((c) => 'ok' in c),
  };
}
