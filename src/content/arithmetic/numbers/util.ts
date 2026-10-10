// Small helpers shared by the fractions / decimals / percent / ratio / rate templates.

import { Frac, type FracLike } from '../../../engine/frac';
import { decimal } from '../../../engine/tex';
import type { Rng } from '../../../engine/rng';
import type { Choice, QCChoice, QuestionBody, Rich } from '../../../engine/types';

export const F = (n: number, d = 1) => new Frac(n, d);
export const toF = (x: FracLike): Frac => (x instanceof Frac ? x : Frac.of(x));

/** Exact Frac from a short decimal literal such as 0.85 or 12.5 (at most 6 decimals). */
export function fd(x: number): Frac {
  return new Frac(Math.round(x * 1e6), 1e6);
}

/** Float equality with a relative tolerance. */
export function close(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Purely relative float equality (for very small or very large values). */
export function relClose(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) <= eps * Math.max(Math.abs(a), Math.abs(b));
}

/** TeX for a terminating Frac as a decimal (1234.5 -> 1{,}234.5). */
export const dec = (x: Frac): string => decimal(x);

/** TeX for a Frac: decimal when it terminates with at most `maxPlaces` places, \frac otherwise. */
export function decOrFrac(x: Frac, maxPlaces = 4): string {
  if (x.isTerminating()) {
    const s = x.toDecimalString();
    const places = s.includes('.') ? s.split('.')[1].length : 0;
    if (places <= maxPlaces) return decimal(x);
  }
  return x.toTex();
}

/** Mixed number TeX for a positive Frac: 100/3 -> 33\tfrac{1}{3}. */
export function mixedTex(x: Frac): string {
  if (x.isInt()) return decimal(x);
  const neg = x.n < 0;
  const a = x.abs();
  const whole = Math.floor(a.n / a.d);
  const rest = a.sub(whole);
  const body = whole === 0 ? rest.toTex() : `${whole}\\tfrac{${rest.n}}{${rest.d}}`;
  return (neg ? '-' : '') + body;
}

/** Percent TeX (inside math): 8 -> 8\%, 12.5 -> 12.5\%, 100/3 -> 33\tfrac{1}{3}\%. */
export function pct(p: FracLike): string {
  const x = toF(p);
  const places = x.isTerminating() ? (x.toDecimalString().split('.')[1] ?? '').length : 99;
  return `${places <= 3 ? decimal(x) : mixedTex(x)}\\%`;
}

/** Money from an exact Frac amount of dollars: always 2 decimals unless whole. */
export function usdF(x: Frac, forceCents = false): string {
  const v = x.toNumber();
  if (x.isInt() && !forceCents) return usdRaw(v);
  return usdRaw(v, 2);
}

function usdRaw(x: number, places?: number): string {
  const neg = x < 0;
  const abs = Math.abs(x);
  const s = places === undefined ? String(abs) : abs.toFixed(places);
  const [i, d] = s.split('.');
  return (neg ? '-' : '') + '\\$' + Number(i).toLocaleString('en-US') + (d ? '.' + d : '');
}

export const QC_REL: Record<QCChoice, string> = {
  A: 'Quantity A is greater',
  B: 'Quantity B is greater',
  C: 'the two quantities are equal',
  D: 'the relationship cannot be determined',
};

/** "So Quantity A is greater (A)." */
export const qcEnd = (a: QCChoice): string => `So ${QC_REL[a]} (${a}).`;

/** Swap A and B in a QC answer (for templates that randomly swap the columns). */
export function swapQC(a: QCChoice): QCChoice {
  return a === 'A' ? 'B' : a === 'B' ? 'A' : a;
}

export function pickWeighted<T>(rng: Rng, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [it, w] of items) {
    r -= w;
    if (r < 0) return it;
  }
  return items[items.length - 1][0];
}

export interface NumChoices {
  choices: Choice[];
  answer: number;
  /** Values of the choices in display order. */
  values: Frac[];
}

/**
 * Numeric choices like engine/build numericChoices, but also returns the ordered values (checks
 * need them). Traps are kept first, then fillers, then nearby values.
 */
export function numChoices(
  rng: Rng,
  opts: {
    correct: Frac;
    traps?: { value: Frac; trap: string }[];
    fillers?: Frac[];
    format: (v: Frac) => Rich;
    order?: 'asc' | 'keep';
    count?: number;
    /** Allow negative or zero filler values (default: only if the correct value is not positive). */
    allowNonPositive?: boolean;
  },
): NumChoices {
  const count = opts.count ?? 5;
  const items: { v: Frac; trap?: string; ok?: boolean }[] = [{ v: opts.correct, ok: true }];
  const okSign = (v: Frac) => opts.allowNonPositive || opts.correct.sign() <= 0 || v.sign() > 0;
  const has = (v: Frac) => items.some((it) => it.v.eq(v));
  const texts = new Set<string>([opts.format(opts.correct)]);
  const tryAdd = (v: Frac, trap?: string) => {
    if (items.length >= count || has(v) || !okSign(v)) return;
    const t = opts.format(v);
    if (texts.has(t)) return;
    texts.add(t);
    items.push(trap ? { v, trap } : { v });
  };
  for (const t of opts.traps ?? []) tryAdd(t.value, t.trap);
  for (const f of opts.fillers ?? []) tryAdd(f);
  const c = opts.correct;
  const base = c.isInt() ? new Frac(Math.max(1, Math.round(Math.abs(c.toNumber()) / 10))) : new Frac(1, c.d);
  let step = 1;
  while (items.length < count) {
    tryAdd(c.add(base.mul(step * (rng.chance(0.5) ? 1 : -1))));
    step++;
    if (step > 80) throw new Error('numChoices: could not fill choices');
  }
  const ordered = opts.order === 'keep' ? items : [...items].sort((a, b) => a.v.cmp(b.v));
  return {
    choices: ordered.map((it) => ({ text: opts.format(it.v), ...(it.trap ? { trap: it.trap } : {}) })),
    answer: ordered.findIndex((it) => it.ok),
    values: ordered.map((it) => it.v),
  };
}

/* ------------------------------------------------------------------ check helpers */

export function expectQC(q: QuestionBody, expected: QCChoice): string | null {
  if (q.format !== 'qc') return 'wrong format';
  return q.answer === expected ? null : `expected ${expected}, got ${q.answer}`;
}

export function expectMCS(q: QuestionBody, expected: number): string | null {
  if (q.format !== 'mcs') return 'wrong format';
  if (expected < 0) return 'no choice matches';
  return q.answer === expected ? null : `expected choice ${expected}, got ${q.answer}`;
}

export function expectMCM(q: QuestionBody, expected: number[]): string | null {
  if (q.format !== 'mcm') return 'wrong format';
  if (!expected.length) return 'no correct choice';
  return JSON.stringify(q.answer) === JSON.stringify(expected) ? null : `expected [${expected}], got [${q.answer}]`;
}

export function expectNE(q: QuestionBody, expected: number, eps = 1e-9): string | null {
  if (q.format !== 'ne') return 'wrong format';
  return close(q.answer.toNumber(), expected, eps) ? null : `expected ${expected}, got ${q.answer}`;
}

/** Index of the single value (float) matching `target`; -1 if none, -2 if several. */
export function uniqueIndex(values: number[], target: number, eps = 1e-9): number {
  const hits = values.flatMap((v, i) => (close(v, target, eps) ? [i] : []));
  return hits.length === 1 ? hits[0] : hits.length === 0 ? -1 : -2;
}

/** Index of the max (or min) of a list, -2 if the extreme is not unique. */
export function extremeIndex(values: number[], kind: 'max' | 'min'): number {
  const best = kind === 'max' ? Math.max(...values) : Math.min(...values);
  const hits = values.flatMap((v, i) => (close(v, best, 1e-12) ? [i] : []));
  return hits.length === 1 ? hits[0] : -2;
}

/** A few rational sample points, dense in [lo, hi] (inclusive), with denominators up to `den`. */
export function gridFracs(lo: Frac, hi: Frac, den: number): Frac[] {
  const out: Frac[] = [];
  const start = Math.ceil(lo.toNumber() * den);
  const end = Math.floor(hi.toNumber() * den);
  for (let k = start; k <= end; k++) {
    const x = new Frac(k, den);
    if (!x.lt(lo) && !x.gt(hi)) out.push(x);
  }
  return out;
}

/** Small capitalization helper for sentences built from parts. */
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "2, 3, and 5" style lists. */
export function listAnd(items: string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}
