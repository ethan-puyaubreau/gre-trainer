// Shared helpers for the counting / probability / sets / data interpretation templates.
// The brute-force counters are used by check() functions to re-derive answers independently.

import { Frac, frac } from '../../../engine/frac';
import { decimal, num } from '../../../engine/tex';
import { valuedChoices } from '../../../engine/build';
import type { Rng } from '../../../engine/rng';
import type { Choice, QuestionBody } from '../../../engine/types';

export const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export const word = (n: number) => WORDS[n] ?? String(n);
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Calls cb with every k-element subset of {0, ..., n-1} (as an ascending index array). */
export function forEachCombination(n: number, k: number, cb: (members: number[]) => void): void {
  const cur: number[] = [];
  const rec = (start: number) => {
    if (cur.length === k) {
      cb(cur);
      return;
    }
    for (let i = start; i <= n - (k - cur.length); i++) {
      cur.push(i);
      rec(i + 1);
      cur.pop();
    }
  };
  rec(0);
}

/** Number of k-element subsets satisfying pred, by enumeration. */
export function countCombinations(n: number, k: number, pred: (members: number[]) => boolean = () => true): number {
  let c = 0;
  forEachCombination(n, k, (m) => {
    if (pred(m)) c++;
  });
  return c;
}

/** Number of ordered selections of k distinct items out of n satisfying pred, by enumeration. */
export function countSequences(n: number, k: number, pred: (seq: number[]) => boolean = () => true): number {
  let c = 0;
  const used = new Array<boolean>(n).fill(false);
  const cur: number[] = [];
  const rec = () => {
    if (cur.length === k) {
      if (pred(cur)) c++;
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      used[i] = true;
      cur.push(i);
      rec();
      cur.pop();
      used[i] = false;
    }
  };
  rec();
  return c;
}

/** Calls cb with every permutation of items (the array passed to cb is reused). */
export function forEachPermutation<T>(items: readonly T[], cb: (perm: T[]) => void): void {
  const a = items.slice();
  const n = a.length;
  const rec = (i: number) => {
    if (i === n) {
      cb(a);
      return;
    }
    for (let j = i; j < n; j++) {
      [a[i], a[j]] = [a[j], a[i]];
      rec(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
  };
  rec(0);
}

/**
 * Round an exact value to `places` decimal places (half up). Returns null on an exact tie, so
 * generators can avoid questions whose rounding is ambiguous.
 */
export function roundFrac(f: Frac, places: number): Frac | null {
  const scale = 10 ** places;
  const v = f.mul(scale);
  const fl = Math.floor(v.n / v.d);
  const rest = v.sub(fl);
  const c = rest.cmp(frac(1, 2));
  if (c === 0) return null;
  return frac(c > 0 ? fl + 1 : fl, scale);
}

/** Float rounding used by checks (independent of roundFrac). */
export const roundNum = (x: number, places: number) => Math.round(x * 10 ** places + 1e-9) / 10 ** places;

/** Distance of an exact value from the nearest rounding tie, in units of the last place (0.5 = far). */
export function tieDistance(f: Frac, places: number): number {
  const v = f.toNumber() * 10 ** places;
  return Math.abs(v - Math.floor(v) - 0.5);
}

/** Probability as a 2-place decimal in TeX: 0.85, 0.80. */
export const dec2 = (f: Frac) => `$${f.toNumber().toFixed(2)}$`;

/** A fraction in TeX, integers without a denominator. */
export const fracTex = (f: Frac) => f.toTex();

/** Percent in TeX: 15\%, -8\%, 12.5\%. */
export const pctTex = (f: Frac | number) => `${typeof f === 'number' ? num(f) : f.isInt() ? num(f) : decimal(f)}\\%`;

/** Signed percent for tables of changes: +10%, -8%. */
export const signedPct = (p: number) => (p > 0 ? `$+${p}\\%$` : `$${p}\\%$`);

/** Money in thousands of dollars to a plain dollar string with commas: 480 -> "\$480,000". */
export const thousandsUsd = (k: number) => `\\$${(k * 1000).toLocaleString('en-US')}`;

/** Exact Frac from a decimal number with at most `places` decimals (e.g. 0.35). */
export const fd = (x: number, places = 4) => frac(Math.round(x * 10 ** places), 10 ** places);

/** Index of the value closest to target (ties are reported as -1). */
export function nearestIndex(values: number[], target: number): number {
  let best = -1;
  let bestD = Infinity;
  let tie = false;
  values.forEach((v, i) => {
    const d = Math.abs(v - target);
    if (d < bestD - 1e-12) {
      best = i;
      bestD = d;
      tie = false;
    } else if (Math.abs(d - bestD) <= 1e-12) tie = true;
  });
  return tie ? -1 : best;
}

/** Compare the text of the chosen choice with the expected rich text. */
export function mcsCheck(q: QuestionBody, expected: string): string | null {
  if (q.format !== 'mcs') return 'wrong format';
  return q.choices[q.answer]?.text === expected ? null : `expected ${expected}, keyed ${q.choices[q.answer]?.text}`;
}

/** Compare a select-all answer with the expected truth value of every choice. */
export function mcmCheck(q: QuestionBody, truth: boolean[]): string | null {
  if (q.format !== 'mcm') return 'wrong format';
  if (truth.length !== q.choices.length) return 'choice count mismatch';
  const expected = truth.flatMap((t, i) => (t ? [i] : []));
  return JSON.stringify(expected) === JSON.stringify(q.answer) ? null : `expected ${JSON.stringify(expected)}, keyed ${JSON.stringify(q.answer)}`;
}

/** Compare a numeric-entry answer with an expected exact value. */
export function neCheck(q: QuestionBody, expected: Frac): string | null {
  if (q.format !== 'ne') return 'wrong format';
  return q.answer.eq(expected) ? null : `expected ${expected.toString()}, keyed ${q.answer.toString()}`;
}

/** Compare a numeric-entry answer with a float value (for checks done in floating point). */
export function neCheckNum(q: QuestionBody, expected: number, eps = 1e-6): string | null {
  if (q.format !== 'ne') return 'wrong format';
  const a = q.answer.toNumber();
  return Math.abs(a - expected) <= eps * Math.max(1, Math.abs(expected)) ? null : `expected ${expected}, keyed ${a}`;
}

/**
 * Select-one numeric choices with the answer at a uniform random position (via valuedChoices).
 * `cands` are priority-ordered distractors (traps first); fillers correct ± k·step are added after
 * them. Every kept value is at least `minGap` from the others, so "closest to" questions have a
 * unique nearest choice. Returns the numeric value of each choice (in choice order) for checks.
 */
export function spacedChoices(
  rng: Rng,
  correct: number,
  cands: { v: number; trap?: string }[],
  opts: { step: number; minGap?: number; min?: number; max?: number; format: (v: number) => string },
): { choices: Choice[]; answer: number; values: number[] } {
  const clean = (x: number) => Number(x.toFixed(9));
  const minGap = opts.minGap ?? opts.step;
  const lo = opts.min ?? -Infinity;
  const hi = opts.max ?? Infinity;
  const kept: { v: number; trap?: string }[] = [];
  const ok = (v: number) => v >= lo && v <= hi && Math.abs(v - correct) >= minGap - 1e-9 && kept.every((k) => Math.abs(k.v - v) >= minGap - 1e-9);
  for (const c of cands) {
    const v = clean(c.v);
    if (ok(v)) kept.push({ v, ...(c.trap ? { trap: c.trap } : {}) });
  }
  for (let k = 1; k <= 12; k++)
    for (const s of [-1, 1]) {
      const v = clean(correct + s * k * opts.step);
      if (ok(v)) kept.push({ v });
    }
  const byText = new Map<string, number>([[opts.format(correct), correct]]);
  const candidates = kept.map((k) => {
    const text = opts.format(k.v);
    byText.set(text, k.v);
    return { text, value: k.v, ...(k.trap ? { trap: k.trap } : {}) };
  });
  const { choices, answer } = valuedChoices(rng, { text: opts.format(correct), value: correct }, candidates);
  return { choices, answer, values: choices.map((c) => byText.get(c.text)!) };
}

/** Word choices for "for how many" questions: a window of five consecutive counts containing the answer. */
export function countWordChoices(rng: Rng, count: number, max: number): { choices: Choice[]; answer: number } {
  const names = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];
  const start = rng.int(Math.max(0, count - 4), Math.min(count, max - 4));
  return { choices: [0, 1, 2, 3, 4].map((k) => ({ text: names[start + k] })), answer: count - start };
}

/** Fast plain-text number with thousands commas and at most `maxDec` decimals (no Intl). */
export function commas(x: number, maxDec = 2): string {
  const neg = x < 0;
  const r = Number(Math.abs(x).toFixed(maxDec));
  const [i, d] = r.toString().split('.');
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + int + (d ? '.' + d : '');
}

/**
 * Select-one choices made only of the right value and named mistakes, ascending, the right one at a
 * random rank (uniform, pulled into the ranks the mistakes allow). A mistake that gives the right
 * value is not a distractor and is left out; a `must` mistake (one the explanation cites) that gives
 * the right value, or too few different mistakes, make this return null so the generator draws again.
 * Mistakes are used in the order given, `must` ones first on their side of the right value.
 * With `uniformRank` the right value takes any rank the mistakes allow with equal chance (for counts, where few ranks are possible).
 * `minGap` keeps every value at least that far from the right one and from the others kept before
 * it (for "closest to" questions). `used` lists the mistakes that became choices, so an explanation
 * can cite one of them; `values` is the value of each choice, in choice order.
 */
export function trapOnlyChoices<T extends { value: Frac | number; trap: string; must?: boolean }>(
  rng: Rng,
  correct: Frac | number,
  traps: T[],
  format: (v: Frac) => string,
  count = 5,
  minGap = 0,
  uniformRank = false,
): { choices: Choice[]; answer: number; used: T[]; values: Frac[] } | null {
  const right = Frac.of(correct);
  const far = (a: Frac, b: Frac) => minGap <= 0 || Math.abs(a.sub(b).toNumber()) >= minGap - 1e-9;
  const seen: { v: Frac; item: T; must: boolean }[] = [];
  for (const t of traps) {
    const v = Frac.of(t.value);
    if (v.eq(right)) {
      if (t.must) return null;
      continue;
    }
    const dup = seen.find((x) => x.v.eq(v));
    if (dup) {
      dup.must ||= !!t.must;
      continue;
    }
    if (far(v, right) && seen.every((x) => far(v, x.v))) seen.push({ v, item: t, must: !!t.must });
  }
  const below = seen.filter((x) => x.v.lt(right));
  const above = seen.filter((x) => x.v.gt(right));
  const mustBelow = below.filter((x) => x.must).length;
  const mustAbove = above.filter((x) => x.must).length;
  // Rank of the right value: uniform, then pulled into the range the mistakes allow (as numericChoices does).
  const lo = Math.max(mustBelow, count - 1 - above.length);
  const hi = Math.min(below.length, count - 1 - mustAbove);
  if (lo > hi) return null;
  const r = uniformRank ? lo + rng.int(0, hi - lo) : Math.min(Math.max(rng.int(0, count - 1), lo), hi);
  const take = (list: typeof seen, k: number) => [...list.filter((x) => x.must), ...list.filter((x) => !x.must)].slice(0, k);
  const all = [
    ...take(below, r).map((x) => ({ v: x.v, item: x.item, ok: false })),
    { v: right, item: null, ok: true },
    ...take(above, count - 1 - r).map((x) => ({ v: x.v, item: x.item, ok: false })),
  ].sort((a, b) => a.v.cmp(b.v));
  return {
    choices: all.map((x) => ({ text: format(x.v), ...(x.item ? { trap: x.item.trap } : {}) })),
    answer: all.findIndex((x) => x.ok),
    used: all.flatMap((x) => (x.item ? [x.item] : [])),
    values: all.map((x) => x.v),
  };
}

/**
 * trapOnlyChoices for whole numbers, with a last resort: when `pad` is set and the mistakes of this
 * dataset are too few or too close together, the missing choices are made up around the right value,
 * as spacedChoices does. Without `pad` the result is null in that case, so the caller draws again.
 */
export function trapChoicesOrPad<T extends { value: number; trap: string }>(
  rng: Rng,
  correct: number,
  traps: T[],
  opts: { step: number; minGap: number; min?: number; max?: number; pad: boolean; format: (v: number) => string },
): { choices: Choice[]; answer: number; used: T[]; values: number[] } | null {
  const named = trapOnlyChoices(rng, correct, traps, (v) => opts.format(v.toNumber()), 5, opts.minGap);
  if (named) return { choices: named.choices, answer: named.answer, used: named.used, values: named.values.map((v) => v.toNumber()) };
  if (!opts.pad) return null;
  const sc = spacedChoices(rng, correct, traps.map((t) => ({ v: t.value, trap: t.trap })), opts);
  return { choices: sc.choices, answer: sc.answer, used: traps.filter((t) => sc.choices.some((c) => c.trap === t.trap)), values: sc.values };
}
