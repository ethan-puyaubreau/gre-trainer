// Helpers shared by the descriptive-statistics templates. The "brute" helpers below use methods
// that differ from the closed forms the generators use (rank counting instead of sorting, explicit
// expansion of frequency tables, numerical integration), so check() functions can rely on them.

import { Frac, frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { QCChoice } from '../../../engine/types';

export const QC_WORDS: Record<QCChoice, string> = {
  A: 'Quantity A is greater',
  B: 'Quantity B is greater',
  C: 'the two quantities are equal',
  D: 'the relationship cannot be determined',
};

export const sortAsc = (xs: readonly number[]): number[] => [...xs].sort((a, b) => a - b);
export const total = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0);

/** Exact mean of integers. */
export const meanF = (xs: readonly number[]): Frac => new Frac(total(xs), xs.length);

/** Exact mean of Fracs. */
export const meanFracs = (xs: readonly Frac[]): Frac => xs.reduce((s, x) => s.add(x), frac(0)).div(xs.length);

/** Exact median of integers (sorting). */
export function medianF(xs: readonly number[]): Frac {
  const s = sortAsc(xs);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? frac(s[m]) : new Frac(s[m - 1] + s[m], 2);
}

/** Quartiles of an even-length list: Q1 and Q3 are the medians of the lower and upper halves. */
export function quartilesF(xs: readonly number[]): { q1: Frac; q2: Frac; q3: Frac } {
  if (xs.length % 2) throw new Error('quartilesF: even-length lists only');
  const s = sortAsc(xs);
  const h = s.length / 2;
  return { q1: medianF(s.slice(0, h)), q2: medianF(s), q3: medianF(s.slice(h)) };
}

/** k-th smallest value (1-based) by rank counting, without sorting. */
export function kthByRank(xs: readonly number[], k: number): number {
  for (const x of xs) {
    const below = xs.filter((y) => y < x).length;
    const atMost = xs.filter((y) => y <= x).length;
    if (below < k && k <= atMost) return x;
  }
  throw new Error('kthByRank: k out of range');
}

/** Median by rank counting (independent of medianF). */
export function medianByRank(xs: readonly number[]): Frac {
  const n = xs.length;
  if (n % 2) return frac(kthByRank(xs, (n + 1) / 2));
  return new Frac(kthByRank(xs, n / 2) + kthByRank(xs, n / 2 + 1), 2);
}

/** Population standard deviation (floating point). */
export function popSD(xs: readonly number[]): number {
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}

/** Floating-point median (for simulations with real-valued data). */
export function medianNum(xs: readonly number[]): number {
  const s = sortAsc(xs);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Number as TeX: decimals when they terminate, fractions otherwise. */
export function fTex(x: Frac): string {
  return x.isTerminating() ? num(x.isInt() ? x.n : x.toNumber()) : x.toTex();
}

/** Comma-separated list in TeX. */
export const listTex = (xs: readonly (number | string)[]): string =>
  xs.map((x) => (typeof x === 'number' ? num(x) : x)).join(',\\ ');

/** Standard normal density. */
const phi = (z: number) => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);

/** P(0 <= Z <= z) for z >= 0 by composite Simpson integration (symmetric by construction). */
function areaFromZero(z: number): number {
  if (z === 0) return 0;
  const a = Math.abs(Math.min(z, 12));
  const n = 400;
  const h = a / n;
  let s = phi(0) + phi(a);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * phi(i * h);
  return (s * h) / 3;
}

/** Standard normal CDF by numerical integration (independent of the 68-95 rule of thumb). */
export function normalCdf(z: number): number {
  return z >= 0 ? 0.5 + areaFromZero(z) : 0.5 - areaFromZero(-z);
}

/** Percent of a normal(mu, sigma) population between lo and hi (use +-Infinity for open ends). */
export function normalPercent(mu: number, sigma: number, lo: number, hi: number): number {
  const c = (x: number) => (x === Infinity ? 1 : x === -Infinity ? 0 : normalCdf((x - mu) / sigma));
  return 100 * (c(hi) - c(lo));
}

/** "1 standard deviation", "1.5 standard deviations". */
export function sdUnits(k: Frac | number): string {
  const v = k instanceof Frac ? k : frac(k);
  return `${fTex(v)} standard deviation${v.eq(1) ? '' : 's'}`;
}
