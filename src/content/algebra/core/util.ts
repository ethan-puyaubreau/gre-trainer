// Helpers shared by the core algebra templates: a tiny expression tree (printed to TeX and
// evaluated numerically, so check() functions can test equivalence by plugging in numbers),
// sampling helpers for QC checks, and small text helpers.

import { Frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { QCChoice } from '../../../engine/types';
import type { Rng } from '../../../engine/rng';

export const QC_WORDS: Record<QCChoice, string> = {
  A: 'Quantity A is greater',
  B: 'Quantity B is greater',
  C: 'the two quantities are equal',
  D: 'the relationship cannot be determined',
};

/** Closing sentence of a QC explanation: "So Quantity A is greater. (A)" */
export const qcEnd = (a: QCChoice) => `So ${QC_WORDS[a]}. (${a})`;

const UNITS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const WORDS = Array.from({ length: 100 }, (_, n) =>
  n < 20 ? UNITS[n] : TENS[Math.floor(n / 10)] + (n % 10 ? `-${UNITS[n % 10].toLowerCase()}` : ''),
);
/** Inverse of countWord (-1 when the text is not a count word). */
export const wordCount = (w: string) => WORDS.indexOf(w);
export const countWord = (n: number) => (n >= 0 && n < WORDS.length ? WORDS[n] : String(n));

/* ---------------------------------------------------------------------------------------------
 * Expression trees
 * ------------------------------------------------------------------------------------------- */

export type Ex =
  | { k: 'n'; v: Frac }
  | { k: 'v'; s: string }
  | { k: 'add'; t: Ex[] }
  | { k: 'mul'; f: Ex[] }
  | { k: 'pow'; b: Ex; e: Ex }
  | { k: 'div'; a: Ex; b: Ex }
  | { k: 'neg'; a: Ex }
  | { k: 'abs'; a: Ex };

export const N = (v: number | Frac): Ex => ({ k: 'n', v: v instanceof Frac ? v : new Frac(v) });
export const V = (s: string): Ex => ({ k: 'v', s });
export const add = (...t: Ex[]): Ex => ({ k: 'add', t });
export const mul = (...f: Ex[]): Ex => ({ k: 'mul', f });
export const pow = (b: Ex, e: Ex | number): Ex => ({ k: 'pow', b, e: typeof e === 'number' ? N(e) : e });
export const div = (a: Ex, b: Ex): Ex => ({ k: 'div', a, b });
export const neg = (a: Ex): Ex => ({ k: 'neg', a });
export const abs = (a: Ex): Ex => ({ k: 'abs', a });

/** p·v + q with zero terms dropped (p·v first). */
export function lx(p: number | Frac, q: number | Frac, v = 'x'): Ex {
  const P = p instanceof Frac ? p : new Frac(p);
  const Q = q instanceof Frac ? q : new Frac(q);
  const terms: Ex[] = [];
  if (P.n !== 0) terms.push(P.eq(1) ? V(v) : mul(N(P), V(v)));
  if (Q.n !== 0) terms.push(N(Q));
  if (terms.length === 0) return N(0);
  return terms.length === 1 ? terms[0] : add(...terms);
}

/** Polynomial in one variable from coefficients (highest power first), as a tree. */
export function polyEx(coefs: (number | Frac)[], v = 'x'): Ex {
  const deg = coefs.length - 1;
  const terms: Ex[] = [];
  coefs.forEach((c0, i) => {
    const c = c0 instanceof Frac ? c0 : new Frac(c0);
    if (c.n === 0) return;
    const p = deg - i;
    const vp = p === 0 ? null : p === 1 ? V(v) : pow(V(v), p);
    terms.push(vp === null ? N(c) : c.eq(1) ? vp : mul(N(c), vp));
  });
  if (!terms.length) return N(0);
  return terms.length === 1 ? terms[0] : add(...terms);
}

const isNegNum = (e: Ex) => e.k === 'n' && e.v.n < 0;

/** Split a term into (is negative, TeX of its absolute value) for printing inside a sum. */
function signed(e: Ex): [boolean, string] {
  if (e.k === 'n' && e.v.n < 0) return [true, num(e.v.neg())];
  if (e.k === 'neg') return [true, e.a.k === 'add' ? `(${texEx(e.a)})` : texEx(e.a)];
  if (e.k === 'mul' && e.f.length > 0 && isNegNum(e.f[0])) {
    const c = (e.f[0] as { k: 'n'; v: Frac }).v.neg();
    return [true, texEx(mul(N(c), ...e.f.slice(1)))];
  }
  if (e.k === 'div' && (isNegNum(e.a) || e.a.k === 'neg')) {
    const top = e.a.k === 'neg' ? e.a.a : N((e.a as { k: 'n'; v: Frac }).v.neg());
    return [true, texEx(div(top, e.b))];
  }
  return [false, texEx(e)];
}

function factorTex(e: Ex): string {
  if (e.k === 'add' || e.k === 'neg' || isNegNum(e)) return `(${texEx(e)})`;
  return texEx(e);
}

/** TeX of an expression tree (to put inside $...$). */
export function texEx(e: Ex): string {
  switch (e.k) {
    case 'n':
      return num(e.v);
    case 'v':
      return e.s;
    case 'add':
      return e.t
        .map((t, i) => {
          const [isNeg, body] = signed(t);
          if (i === 0) return (isNeg ? '-' : '') + body;
          return (isNeg ? ' - ' : ' + ') + body;
        })
        .join('');
    case 'mul': {
      let out = '';
      e.f.forEach((f, i) => {
        if (i === 0 && f.k === 'n' && e.f.length > 1) {
          if (f.v.eq(1)) return;
          if (f.v.eq(-1)) {
            out += '-';
            return;
          }
          out += f.v.isInt() ? num(f.v) : f.v.n < 0 ? `-${num(f.v.neg())}` : num(f.v);
          return;
        }
        const t = factorTex(f);
        const startsWithDigit = /^[0-9]/.test(t) && !(f.k === 'div');
        const needDot = out !== '' && out !== '-' && (startsWithDigit || f.k === 'n' || (f.k === 'pow' && f.b.k === 'n'));
        out += (needDot ? ' \\cdot ' : '') + t;
      });
      return out;
    }
    case 'pow': {
      const b = e.b.k === 'v' || (e.b.k === 'n' && e.b.v.isInt() && e.b.v.n >= 0) ? texEx(e.b) : `\\left(${texEx(e.b)}\\right)`;
      return `${b}^{${texEx(e.e)}}`;
    }
    case 'div':
      return `\\dfrac{${texEx(e.a)}}{${texEx(e.b)}}`;
    case 'neg':
      return `-${e.a.k === 'add' || isNegNum(e.a) ? `(${texEx(e.a)})` : texEx(e.a)}`;
    case 'abs':
      return `\\left|${texEx(e.a)}\\right|`;
  }
}

/** Numeric value of an expression tree for the given variable values. */
export function evalEx(e: Ex, env: Record<string, number>): number {
  switch (e.k) {
    case 'n':
      return e.v.toNumber();
    case 'v': {
      const v = env[e.s];
      if (v === undefined) throw new Error(`evalEx: no value for ${e.s}`);
      return v;
    }
    case 'add':
      return e.t.reduce((s, t) => s + evalEx(t, env), 0);
    case 'mul':
      return e.f.reduce((p, f) => p * evalEx(f, env), 1);
    case 'pow':
      return Math.pow(evalEx(e.b, env), evalEx(e.e, env));
    case 'div':
      return evalEx(e.a, env) / evalEx(e.b, env);
    case 'neg':
      return -evalEx(e.a, env);
    case 'abs':
      return Math.abs(evalEx(e.a, env));
  }
}

/** Relative closeness for floating-point comparisons in checks. */
export const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

/**
 * True when two expressions agree at many random points of the variables (each drawn from
 * [lo, hi], skipping points where either side is not finite).
 */
export function sameFunction(a: Ex, b: Ex, vars: string[], rng: Rng, lo = -6, hi = 6, tries = 12): boolean {
  let tested = 0;
  for (let i = 0; i < tries * 4 && tested < tries; i++) {
    const env: Record<string, number> = {};
    for (const v of vars) env[v] = lo + (hi - lo) * rng.next();
    const x = evalEx(a, env);
    const y = evalEx(b, env);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    tested++;
    if (!close(x, y, 1e-8)) return false;
  }
  return tested > 0;
}

/* ---------------------------------------------------------------------------------------------
 * Sampling helpers for QC checks
 * ------------------------------------------------------------------------------------------- */

/** Special values worth plugging in: integers, simple fractions, tiny and huge numbers. */
export const SPECIAL = (() => {
  const out: number[] = [];
  for (let i = -12; i <= 12; i++) out.push(i);
  for (const d of [2, 3, 4, 5, 10])
    for (let n = -3 * d; n <= 3 * d; n++) if (n % d !== 0) out.push(n / d);
  out.push(0.01, -0.01, 0.001, -0.001, 50, -50, 100, -100, 1000, -1000);
  return out;
})();

/**
 * QC answer from (A, B) samples with a purely relative tolerance (so tiny values still compare
 * correctly): D as soon as two samples disagree.
 */
export function qcSamples(samples: Iterable<[number, number]>, eps = 1e-9): QCChoice {
  const seen = new Set<QCChoice>();
  for (const [a, b] of samples) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const r: QCChoice = Math.abs(a - b) <= eps * Math.max(Math.abs(a), Math.abs(b)) ? 'C' : a > b ? 'A' : 'B';
    seen.add(r);
    if (seen.size > 1) return 'D';
  }
  if (seen.size === 0) throw new Error('qcSamples: no samples');
  return [...seen][0];
}

/** Random reals spread over several scales. */
export function randomReals(rng: Rng, count = 200): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const scale = rng.pick([0.1, 1, 5, 20, 200]);
    out.push((rng.next() * 2 - 1) * scale);
  }
  return out;
}

/** Values of x allowed by a predicate, from special values and random reals. */
export function allowedValues(rng: Rng, ok: (x: number) => boolean, count = 200): number[] {
  return [...SPECIAL, ...randomReals(rng, count)].filter(ok);
}

/** Integer in [lo, hi] other than the excluded values. */
export function intExcept(rng: Rng, lo: number, hi: number, ...not: number[]): number {
  let x: number;
  do x = rng.int(lo, hi);
  while (not.includes(x));
  return x;
}

/** "+ 3" / "- 3" for writing a TeX step with a signed constant. */
export const sgn = (c: number | Frac) => {
  const f = c instanceof Frac ? c : new Frac(c);
  return f.n < 0 ? `- ${num(f.neg())}` : `+ ${num(f)}`;
};

/**
 * Filler values on both sides of the answer (alternating above and below). numericChoices picks a
 * random position for the answer and takes fillers from the side that still needs values.
 */
export function sideFill(_rng: Rng, center: number | Frac, step: number | Frac = 1, count = 8): Frac[] {
  const c = center instanceof Frac ? center : new Frac(center);
  const st = step instanceof Frac ? step : new Frac(step);
  const out: Frac[] = [];
  for (let k = 1; k <= count; k++) out.push(c.add(st.mul((k % 2 ? 1 : -1) * Math.ceil(k / 2))));
  return out;
}

/** Trap list passed through (numericChoices keeps the traps that fit around the answer position). */
export function someTraps<T>(_rng: Rng, traps: T[]): T[] {
  return traps;
}

/** m times an expression, for explanations: "5", "-(5)", "3(5)". */
export const times = (m: number, inner: string) => (m === 1 ? inner : m === -1 ? `-(${inner})` : `${m}(${inner})`);
/** b^e without a visible exponent 1. */
export const powT = (b: number | string, e: number | string) => (e === 1 || e === '1' ? `${b}` : `${b}^{${e}}`);
