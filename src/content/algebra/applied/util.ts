// Helpers shared by the applied-algebra templates (coordinate geometry, graphs, sequences, word
// problems, rates, mixtures and interest). Nothing here decides an answer key on its own.

import { Frac, frac, type FracLike } from '../../../engine/frac';
import { numericChoices, type NumericChoiceOpts } from '../../../engine/build';
import type { Rng } from '../../../engine/rng';
import { decimal, num, poly, usd } from '../../../engine/tex';
import type { Choice, QCChoice, QuestionBody } from '../../../engine/types';

export const F = (x: FracLike): Frac => (x instanceof Frac ? x : frac(x));

/** Exact Frac from a short decimal written as a JS number (0.05 -> 1/20). */
export function dec(x: number): Frac {
  const s = x.toString();
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`dec: unsupported number ${s}`);
  const [, d = ''] = s.split('.');
  return new Frac(Math.round(x * 10 ** d.length), 10 ** d.length);
}

const QC_END: Record<QCChoice, string> = {
  A: 'Quantity A is greater',
  B: 'Quantity B is greater',
  C: 'The two quantities are equal',
  D: 'The relationship cannot be determined from the information given',
};

/** Closing sentence of a QC explanation: "Quantity A is greater (A)." */
export const qcEnd = (a: QCChoice) => `${QC_END[a]} (${a}).`;

/** Number in TeX: fractions as \frac, terminating values as decimals when `asDecimal`. */
export function tx(x: FracLike, asDecimal = false): string {
  const f = F(x);
  if (asDecimal && f.isTerminating()) return decimal(f);
  return num(f);
}

/** Decimal TeX of an exact value (must terminate). */
export const dx = (x: FracLike) => decimal(F(x));

/** Money from an exact value (cents shown only when needed, or always with `cents`). */
export function money(x: FracLike, cents = false): string {
  const f = F(x);
  if (!f.mul(100).isInt()) throw new Error(`money: ${f} is not a whole number of cents`);
  return cents || !f.isInt() ? usd(f.toNumber(), 2) : usd(f.toNumber());
}

/** "y = mx + b" in TeX. */
export const lineTex = (m: FracLike, b: FracLike, lhs = 'y') => `${lhs} = ${poly([F(m), F(b)])}`;

/** "(a, b)" in TeX for a point with exact coordinates. */
export const ptTex = (x: FracLike, y: FracLike) => `(${tx(x)}, ${tx(y)})`;

/** Signed term for "+ 3" / "- 3" after something else. */
export const signed = (x: FracLike) => (F(x).sign() < 0 ? `- ${tx(F(x).neg())}` : `+ ${tx(x)}`);

/* ---------------------------------------------------------------------------------------------
 * Plotting: sample y = f(x) and keep the parts inside the axes window (exact for piecewise-linear
 * functions as long as every kink is in `include`).
 * ------------------------------------------------------------------------------------------- */
export interface Window {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

function clipSegment(p: [number, number], q: [number, number], w: Window): [[number, number], [number, number]] | null {
  let t0 = 0;
  let t1 = 1;
  const dx2 = q[0] - p[0];
  const dy2 = q[1] - p[1];
  const tests: [number, number][] = [
    [-dx2, p[0] - w.xMin],
    [dx2, w.xMax - p[0]],
    [-dy2, p[1] - w.yMin],
    [dy2, w.yMax - p[1]],
  ];
  for (const [pp, qq] of tests) {
    if (pp === 0) {
      if (qq < 0) return null;
    } else {
      const r = qq / pp;
      if (pp < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
    }
  }
  if (t0 > t1) return null;
  return [
    [p[0] + t0 * dx2, p[1] + t0 * dy2],
    [p[0] + t1 * dx2, p[1] + t1 * dy2],
  ];
}

export function plot(
  f: (x: number) => number,
  w: Window,
  opts: { from?: number; to?: number; step?: number; include?: number[] } = {},
): [number, number][][] {
  const from = opts.from ?? w.xMin;
  const to = opts.to ?? w.xMax;
  const step = opts.step ?? 0.05;
  const xs = new Set<number>();
  for (let i = 0; from + i * step <= to + 1e-9; i++) xs.add(Number((from + i * step).toFixed(6)));
  xs.add(to);
  for (const x of opts.include ?? []) if (x >= from && x <= to) xs.add(x);
  const sorted = [...xs].sort((a, b) => a - b);
  const pts = sorted.map((x) => [x, f(x)] as [number, number]);
  const out: [number, number][][] = [];
  let cur: [number, number][] | null = null;
  const r = (v: number) => Number(v.toFixed(4));
  for (let i = 0; i + 1 < pts.length; i++) {
    const seg = clipSegment(pts[i], pts[i + 1], w);
    if (!seg) {
      cur = null;
      continue;
    }
    const [a, b] = seg.map(([x, y]) => [r(x), r(y)] as [number, number]);
    if (cur && Math.abs(cur[cur.length - 1][0] - a[0]) < 1e-6 && Math.abs(cur[cur.length - 1][1] - a[1]) < 1e-6) cur.push(b);
    else {
      cur = [a, b];
      out.push(cur);
    }
  }
  return out.filter((c) => c.length >= 2);
}

/**
 * Solid dots for unlabeled points. A hidden point name also hides the renderer's dot, so draw it
 * with circles instead: a ring (radius 2.4 px, stroke 1.6 px) plus a tiny circle inside it whose
 * stroke fills the center, giving a solid dot of about 3.2 px radius. Pixel size assumes the
 * renderer's 340 px for the larger side of the window.
 */
export function dots(names: string[], w: Window): { center: string; r: number; shade?: boolean }[] {
  const px = Math.max(w.xMax - w.xMin, w.yMax - w.yMin) / 340;
  return [...names.map((center) => ({ center, r: 2.4 * px })), ...names.map((center) => ({ center, r: 0.8 * px }))];
}

/* ---------------------------------------------------------------------------------------------
 * Choices that carry a hidden exact value, so check() can map each displayed text back to it.
 * ------------------------------------------------------------------------------------------- */

/** Values of the displayed choices of an MCS question, or null when the texts do not match. */
export function choiceValuesMatch(q: QuestionBody, values: Frac[], fmt: (v: Frac) => string): string | null {
  if (q.format !== 'mcs' && q.format !== 'mcm') return 'wrong format';
  if (q.choices.length !== values.length) return 'choice count mismatch';
  for (let i = 0; i < values.length; i++) if (q.choices[i].text !== fmt(values[i])) return `choice ${i} text does not match its value`;
  return null;
}

/**
 * numericChoices that also returns the exact value behind each displayed choice (so check() can
 * grade by value). Extra fallback distractors (correct ± k * unit) are appended to the fillers so
 * the builder never invents values of its own.
 */
export function valuedChoices(
  rng: Rng,
  opts: NumericChoiceOpts & { unit?: FracLike; positive?: boolean },
): { choices: Choice[]; answer: number; values: Frac[] } {
  const correct = F(opts.correct);
  const unit = F(opts.unit ?? 1);
  const fallback: Frac[] = [];
  const okBelow = (v: Frac) => (opts.positive ? v.sign() > 0 : v.sign() >= 0 || correct.sign() < 0);
  for (let k = 1; k <= 12; k++) {
    fallback.push(correct.add(unit.mul(k)));
    if (okBelow(correct.sub(unit.mul(k)))) fallback.push(correct.sub(unit.mul(k)));
  }
  // Positive quantities (times, lengths): add fractions of the answer so nothing below needs to be 0.
  if (opts.positive) for (let j = 9; j >= 1; j--) fallback.push(correct.mul(j).div(10));
  const fillers = [...(opts.fillers ?? []).map(F), ...fallback];
  const { choices, answer } = numericChoices(rng, { ...opts, fillers });
  // The builder may also invent neighbors with its own step (see syntheticStep in engine/build.ts).
  const a = Math.abs(correct.n);
  const engineStep = !correct.isInt() ? new Frac(1, correct.d) : a < 20 ? frac(1) : frac(10 ** Math.max(0, Math.floor(Math.log10(a)) - 1));
  const synthetic: Frac[] = [];
  for (let k = 1; k <= 60; k++) synthetic.push(correct.add(engineStep.mul(k)), correct.sub(engineStep.mul(k)));
  const pool = [correct, ...(opts.traps ?? []).map((t) => F(t.value)), ...fillers, ...synthetic];
  const values = choices.map((c) => {
    const v = pool.find((x) => opts.format(x) === c.text);
    if (!v) throw new Error(`valuedChoices: no value for choice ${c.text}`);
    return v;
  });
  return { choices, answer, values };
}

/** Index of the single choice whose value satisfies `ok`, or an error. */
export function uniqueIndex<T>(items: T[], ok: (t: T) => boolean): number | string {
  const hits = items.flatMap((t, i) => (ok(t) ? [i] : []));
  if (hits.length !== 1) return `${hits.length} choices satisfy the condition`;
  return hits[0];
}

export function expectMcs(q: QuestionBody, idx: number | string): string | null {
  if (typeof idx === 'string') return idx;
  if (q.format !== 'mcs') return 'wrong format';
  return q.answer === idx ? null : `expected choice ${idx}, got ${q.answer}`;
}

export function expectMcm(q: QuestionBody, flags: boolean[]): string | null {
  if (q.format !== 'mcm') return 'wrong format';
  const exp = flags.flatMap((f, i) => (f ? [i] : []));
  return JSON.stringify(exp) === JSON.stringify(q.answer) ? null : `expected ${JSON.stringify(exp)}, got ${JSON.stringify(q.answer)}`;
}

export function expectQc(q: QuestionBody, a: QCChoice): string | null {
  if (q.format !== 'qc') return 'wrong format';
  return q.answer === a ? null : `expected ${a}, got ${q.answer}`;
}

export function expectNe(q: QuestionBody, v: FracLike): string | null {
  if (q.format !== 'ne') return 'wrong format';
  return q.answer.eq(F(v)) ? null : `expected ${F(v)}, got ${q.answer}`;
}

/** Choices in a given order, each flagged correct or not, with optional trap ids. */
export type Flagged = Choice & { correct: boolean };

/** Proper-case names for word problems. */
export const NAMES = ['Ana', 'Ben', 'Carla', 'Dev', 'Elena', 'Femi', 'Grace', 'Hiro', 'Ines', 'Jamal', 'Kara', 'Luis', 'Maya', 'Noah', 'Omar', 'Priya', 'Quinn', 'Rosa', 'Sam', 'Tara'];
export { trapChoices } from '../core/util';
