// Small formatting / choice helpers shared by the shapes templates.

import { numericChoices } from '../../../engine/build';
import { Frac, type FracLike } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import { squareOut } from '../../../engine/math';
import { lin, num } from '../../../engine/tex';
import type { Choice, QCChoice, QCQuestion } from '../../../engine/types';

/** Linear expression c·x + k as TeX ("3x + 20", "x - 10", "65"). */
export const linTex = (c: number, k: number, v = 'x') => lin([[c, v], [k, '']]);

/** Figure label for an angle c·x + k: "(3x + 20)°", "2x°", "65°". */
export function angleLabel(c: number, k: number, v = 'x'): string {
  if (c === 0) return `$${num(k)}^\\circ$`;
  if (k === 0) return `$${linTex(c, 0, v)}^\\circ$`;
  return `$(${linTex(c, k, v)})^\\circ$`;
}

/** The same expression written for an equation: "3x + 20" or "65". */
export const exprTex = (c: number, k: number, v = 'x') => (c === 0 ? num(k) : linTex(c, k, v));

/** Drop the trap on the correct QC letter (a trap cannot point at the right answer). */
export function qcTraps(answer: QCChoice, t: Partial<Record<QCChoice, string | undefined>>): QCQuestion['traps'] {
  const out: Partial<Record<QCChoice, string>> = {};
  for (const [k, v] of Object.entries(t)) if (k !== answer && v) out[k as QCChoice] = v;
  return Object.keys(out).length ? out : undefined;
}

export const QC_SAY: Record<QCChoice, string> = {
  A: 'Quantity A is greater',
  B: 'Quantity B is greater',
  C: 'the two quantities are equal',
  D: 'the relationship cannot be determined',
};

/* ------------------------------------------------------------------ surds c·√r */

export interface Surd {
  c: Frac;
  r: number;
}

/** c·√r with r reduced to its squarefree part. */
export function surd(c: FracLike, r = 1): Surd {
  const [o, i] = squareOut(r);
  return { c: Frac.of(c).mul(o), r: i };
}
export const surdVal = (s: Surd) => s.c.toNumber() * Math.sqrt(s.r);
export const surdMul = (a: Surd, b: Surd): Surd => surd(a.c.mul(b.c), a.r * b.r);
/** a / b, rationalized. */
export const surdDiv = (a: Surd, b: Surd): Surd => surd(a.c.div(b.c.mul(b.r)), a.r * b.r);
export const surdKey = (s: Surd) => `${s.c.toString()}|${s.r}`;

export function surdTex(s: Surd): string {
  if (s.r === 1) return s.c.toTex();
  const root = `\\sqrt{${s.r}}`;
  const n = s.c.n;
  const d = s.c.d;
  const sign = n < 0 ? '-' : '';
  const an = Math.abs(n);
  if (d === 1) return `${sign}${an === 1 ? '' : num(an)}${root}`;
  return `${sign}\\frac{${an === 1 ? '' : num(an)}${root}}{${num(d)}}`;
}

/** Five (or `count`) surd choices: correct + traps + fillers, unique by value, ascending. */
export function surdChoices(
  correct: Surd,
  traps: { v: Surd; trap?: string }[],
  fillers: Surd[],
  count = 5,
): { choices: Choice[]; answer: number; values: Surd[] } {
  const items: { v: Surd; trap?: string; ok?: boolean }[] = [{ v: correct, ok: true }];
  const has = (v: Surd) => items.some((it) => Math.abs(surdVal(it.v) - surdVal(v)) < 1e-9);
  for (const t of traps) if (items.length < count && surdVal(t.v) > 0 && !has(t.v)) items.push(t);
  for (const f of fillers) if (items.length < count && surdVal(f) > 0 && !has(f)) items.push({ v: f });
  let m = 2;
  while (items.length < count) {
    const f = surd(correct.c.mul(m), correct.r);
    if (!has(f)) items.push({ v: f });
    m++;
  }
  items.sort((a, b) => surdVal(a.v) - surdVal(b.v));
  return {
    choices: items.map((it) => ({ text: `$${surdTex(it.v)}$`, ...(it.trap ? { trap: it.trap } : {}) })),
    answer: items.findIndex((it) => it.ok),
    values: items.map((it) => it.v),
  };
}

/** Index of the single value matching `target` numerically, or an error string. */
export function matchIndex(values: number[], target: number, eps = 1e-7): number | string {
  const hits = values.flatMap((v, i) => (Math.abs(v - target) <= eps * Math.max(1, Math.abs(target)) ? [i] : []));
  if (hits.length !== 1) return `${hits.length} choices match ${target}`;
  return hits[0];
}

/** Common check tail for MCS: the stored answer must be the unique choice equal to `target`. */
export function checkMcs(answer: number, values: number[], target: number): string | null {
  const i = matchIndex(values, target);
  if (typeof i === 'string') return i;
  return i === answer ? null : `answer should be choice ${i} (${target})`;
}

/** Common check tail for MCM. */
export function checkMcm(answer: number[], expected: number[]): string | null {
  return JSON.stringify(answer) === JSON.stringify(expected) ? null : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(answer)}`;
}

/** Number of decimal places needed to write a terminating fraction. */
export function isNiceDecimal(f: Frac, maxPlaces = 2): boolean {
  if (!f.isTerminating()) return false;
  const s = f.toDecimalString();
  const dot = s.indexOf('.');
  return dot < 0 || s.length - dot - 1 <= maxPlaces;
}

/** Positive integer (or terminating decimal) choices, ascending, with their numeric values for check(). */
export function intChoices(rng: Rng, correct: number, traps: { value: number; trap: string }[], fillers: number[], fmt: (v: Frac) => string = (v) => `$${v.isInt() ? num(v.n) : v.toDecimalString()}$`) {
  const toF = (v: number) => (Number.isInteger(v) ? Frac.of(v) : new Frac(Math.round(v * 100), 100));
  const ok = (v: number) => Number.isFinite(v) && v > 0 && Math.abs(v * 100 - Math.round(v * 100)) < 1e-9;
  const okTraps = traps.filter((t) => ok(t.value) && Math.abs(t.value - correct) > 1e-9).map((t) => ({ value: toF(t.value), trap: t.trap }));
  const { choices, answer } = numericChoices(rng, {
    correct: toF(correct),
    traps: okTraps,
    fillers: fillers.filter(ok).map(toF),
    format: fmt,
  });
  return { choices, answer, values: choices.map((c) => Number(c.text.replace(/[^0-9.]/g, ''))) };
}

/** Substitution shown in an explanation: evalTex(3, 10, 25) -> "3(25) + 10". */
export const evalTex = (c: number, k: number, x: number) => `${c === 1 ? '' : c}(${x})${k === 0 ? '' : ` ${k < 0 ? '-' : '+'} ${Math.abs(k)}`}`;
