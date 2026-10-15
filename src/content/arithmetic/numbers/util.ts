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

/** Like qcFromSamples for floats, but with a purely relative tolerance (safe for tiny values). */
export function qcFromFloatSamples(samples: Iterable<[number, number]>, eps = 1e-12): QCChoice {
  const seen = new Set<QCChoice>();
  for (const [a, b] of samples) {
    seen.add(relClose(a, b, eps) ? 'C' : a > b ? 'A' : 'B');
    if (seen.size > 1) return 'D';
  }
  if (seen.size === 0) throw new Error('qcFromFloatSamples: no samples');
  return [...seen][0];
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

/** Plain-text number (outside math) with thousands separators, also for decimals: 6652.8 -> "6,652.8". */
export function plainNum(x: Frac | number): string {
  const s = x instanceof Frac ? (x.isTerminating() ? x.toDecimalString() : x.toNumber().toFixed(4)) : String(Number(x.toFixed(10)));
  const neg = s.startsWith('-');
  const [i, d] = (neg ? s.slice(1) : s).split('.');
  return (neg ? '-' : '') + Number(i).toLocaleString('en-US') + (d ? '.' + d : '');
}

/** Money for use INSIDE math: thousands separators as {,} so KaTeX does not add a space. */
export function usdM(x: Frac, forceCents = false): string {
  return usdF(x, forceCents).replace(/,/g, '{,}');
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

/** Step for made-up distractors: 1 for small integers, 10 for hundreds, 1/d for fractions (as in engine/build). */
function syntheticStep(correct: Frac): Frac {
  if (!correct.isInt()) return new Frac(1, correct.d);
  const a = Math.abs(correct.n);
  if (a < 20) return new Frac(1);
  return new Frac(10 ** Math.max(0, Math.floor(Math.log10(a)) - 1));
}

/**
 * Numeric choices with the same placement rule as engine/build numericChoices (the answer lands at a
 * uniform random position of the ascending list; traps are kept in priority order when they fit on
 * their side; fillers, then made-up neighbors, fill each side), but it also returns the ordered values
 * that the checks need.
 */
export function numChoices(
  rng: Rng,
  opts: {
    correct: Frac;
    traps?: { value: Frac; trap: string }[];
    fillers?: Frac[];
    format: (v: Frac) => Rich;
    count?: number;
    /** Allow negative or zero distractors (default: only if the correct value is not positive). */
    allowNonPositive?: boolean;
    /**
     * 'asc' (default): ascending order; the answer's rank is drawn among the ranks that keep at least half of
     * the wrong choices named. 'shuffled': all the traps are kept (up to count - 1) and the choices are
     * shuffled; use it when the real mistakes all fall on one side of the answer.
     */
    order?: 'asc' | 'shuffled';
  },
): NumChoices {
  const count = opts.count ?? 5;
  const correct = opts.correct;
  type Item = { v: Frac; trap?: string; ok?: boolean };
  const okSign = (v: Frac) => opts.allowNonPositive || correct.sign() <= 0 || v.sign() > 0;
  const used: Frac[] = [correct];
  const texts = new Set<string>([opts.format(correct)]);
  const usable = (v: Frac) => {
    if (!okSign(v) || used.some((u) => u.eq(v))) return false;
    const t = opts.format(v);
    if (texts.has(t)) return false;
    return true;
  };
  const accept = (v: Frac) => {
    used.push(v);
    texts.add(opts.format(v));
  };
  const below: Item[] = [];
  const above: Item[] = [];
  // Named traps first. In ascending order the rank of the answer is drawn among the ranks that keep at least
  // half of the wrong choices named; in shuffled order every trap is kept.
  const shuffled = opts.order === 'shuffled';
  const trapPool: { value: Frac; trap: string }[] = [];
  for (const t of opts.traps ?? []) if (usable(t.value) && !trapPool.some((u) => u.value.eq(t.value))) trapPool.push(t);
  const lowT = trapPool.filter((t) => t.value.lt(correct));
  const upT = trapPool.filter((t) => t.value.gt(correct));
  const need = count - 1;
  const named = (t: number) => Math.min(t, lowT.length) + Math.min(need - t, upT.length);
  const minNamed = shuffled ? Math.min(need, lowT.length + upT.length) : Math.min(Math.ceil(need / 2), lowT.length + upT.length);
  const ranks = Array.from({ length: need + 1 }, (_, t) => t).filter((t) => named(t) >= minNamed);
  let target = ranks.length ? rng.pick(ranks) : rng.int(0, need);
  for (const t of lowT.slice(0, target)) {
    accept(t.value);
    below.push({ v: t.value, trap: t.trap });
  }
  for (const t of upT.slice(0, need - target)) {
    accept(t.value);
    above.push({ v: t.value, trap: t.trap });
  }
  const fillers = opts.fillers ?? [];
  const step = syntheticStep(correct);
  const take = (lower: boolean, need: number): number => {
    const list = lower ? below : above;
    for (const v of fillers) {
      if (need <= 0) break;
      if ((lower ? v.lt(correct) : v.gt(correct)) && usable(v)) {
        accept(v);
        list.push({ v });
        need--;
      }
    }
    for (let k = 1; need > 0 && k <= 80; k++) {
      const v = lower ? correct.sub(step.mul(k)) : correct.add(step.mul(k));
      if (usable(v)) {
        accept(v);
        list.push({ v });
        need--;
      }
    }
    return need;
  };
  const shortBelow = take(true, target - below.length);
  if (shortBelow > 0) target -= shortBelow;
  const shortAbove = take(false, count - 1 - target - above.length);
  if (shortAbove > 0) take(true, shortAbove);
  let items: Item[] = [...below, { v: correct, ok: true }, ...above].sort((a, b) => a.v.cmp(b.v));
  if (items.length !== count) throw new Error('numChoices: could not fill choices');
  if (shuffled) items = rng.shuffle(items);
  return {
    choices: items.map((it) => ({ text: opts.format(it.v), ...(it.trap ? { trap: it.trap } : {}) })),
    answer: items.findIndex((it) => it.ok),
    values: items.map((it) => it.v),
  };
}

/**
 * Fillers chosen so that the correct value lands at a random rank among `count` ascending choices.
 * `below` / `above` are candidate wrong values smaller / larger than the correct one.
 */
export function spreadFillers(rng: Rng, correct: Frac, traps: Frac[], below: Frac[], above: Frac[], count = 5): Frac[] {
  const uniq: Frac[] = [];
  for (const t of traps) if (!t.eq(correct) && !uniq.some((u) => u.eq(t))) uniq.push(t);
  const used = uniq.slice(0, count - 1);
  const nb = used.filter((t) => t.lt(correct)).length;
  const na = used.length - nb;
  const free = count - 1 - used.length;
  const fresh = (xs: Frac[]) => xs.filter((x, i) => !x.eq(correct) && !used.some((u) => u.eq(x)) && xs.findIndex((y) => y.eq(x)) === i);
  const B = rng.shuffle(fresh(below.filter((x) => x.lt(correct))));
  const A = rng.shuffle(fresh(above.filter((x) => x.gt(correct))));
  // target rank of the correct answer, kept feasible
  const lo = nb;
  const hi = count - 1 - na;
  let rank = rng.int(Math.min(lo, hi), Math.max(lo, hi));
  rank = Math.max(nb, Math.min(rank, nb + Math.min(free, B.length)));
  let needB = Math.min(rank - nb, B.length);
  let needA = free - needB;
  if (needA > A.length) {
    needA = A.length;
    needB = Math.min(free - needA, B.length);
  }
  return [...B.slice(0, needB), ...A.slice(0, needA), ...B.slice(needB), ...A.slice(needA)];
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
