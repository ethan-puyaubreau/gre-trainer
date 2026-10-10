// Shared helpers for the counting / probability / sets / data interpretation templates.
// The brute-force counters are used by check() functions to re-derive answers independently.

import { Frac, frac } from '../../../engine/frac';
import { decimal, num } from '../../../engine/tex';
import type { QuestionBody } from '../../../engine/types';

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
