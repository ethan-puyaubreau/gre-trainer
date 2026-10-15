// Small formatting / choice helpers shared by the shapes templates.

import { Frac, type FracLike } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import { squareOut } from '../../../engine/math';
import { lin, num } from '../../../engine/tex';
import type { Choice, QCChoice, QCQuestion } from '../../../engine/types';
import { Redraw } from '../redraw';

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

/**
 * Position of the correct answer among the feasible ones: among the positions where every wrong choice names a
 * mistake; when no position can name them all, among those that name the most. A high position needs more
 * mistakes below the key, so it is feasible less often: the weight 1 + 0.1 K evens that out.
 */
export function pickPosition<T extends { K: number }>(rng: Rng, plan: T[], kept: (p: T) => number, wrong: number): T {
  const full = plan.filter((p) => kept(p) >= wrong);
  const best = Math.max(...plan.map(kept));
  const pool = full.length ? full : plan.filter((p) => kept(p) === best);
  const weights = pool.map((p) => 1 + 0.1 * p.K);
  let r = rng.next() * weights.reduce((x, y) => x + y, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/**
 * Pick `count` choices (correct + traps + fillers) so that the correct one can land in any position:
 * the number of fillers below / above the correct value is drawn at random among the feasible splits.
 * Candidates are used in the order given (put the most plausible first). Sorted ascending by value.
 */
export function positioned<T>(
  rng: Rng,
  correct: T,
  traps: { v: T; trap?: string }[],
  cands: T[],
  val: (t: T) => number,
  count = 5,
  must = 0,
): { v: T; trap?: string; ok?: boolean }[] {
  const same = (a: T, b: T) => Math.abs(val(a) - val(b)) < 1e-9;
  const good = (t: T) => Number.isFinite(val(t)) && val(t) > 0;
  const c0 = val(correct);
  const uniqTraps: { v: T; trap?: string; must?: boolean }[] = [];
  traps.forEach((t, i) => {
    if (t.trap && Number.isFinite(val(t.v)) && same(t.v, correct)) throw new Redraw('a trap equals the answer');
    if (good(t.v) && !same(t.v, correct) && !uniqTraps.some((u) => same(u.v, t.v))) uniqTraps.push({ ...t, must: i < must });
    else if (i < must) throw new Redraw('a trap cited in the explanation cannot be shown');
  });
  const pool: T[] = [];
  for (const c of cands) if (good(c) && !same(c, correct) && !uniqTraps.some((u) => same(u.v, c)) && !pool.some((x) => same(x, c))) pool.push(c);
  const below = pool.filter((c) => val(c) < c0);
  const above = pool.filter((c) => val(c) > c0);
  // Pick the position of the correct value that keeps the most traps (every wrong choice should name a mistake),
  // at random among the positions that keep as many as the best one.
  const tb = uniqTraps.filter((t) => val(t.v) < c0);
  const ta = uniqTraps.filter((t) => val(t.v) > c0);
  const mb = tb.filter((t) => t.must).length;
  const ma = ta.filter((t) => t.must).length;
  const plan = [0, 1, 2, 3, 4]
    .filter((k) => k < count)
    .map((K) => {
      const nb = Math.min(tb.length, K);
      const na = Math.min(ta.length, count - 1 - K);
      return { K, nb, na, ok: K - nb <= below.length && count - 1 - K - na <= above.length && K >= mb && count - 1 - K >= ma };
    })
    .filter((p) => p.ok);
  if (!plan.length) throw new Redraw('not enough candidate choices');
  const pick = pickPosition(rng, plan, (p) => p.nb + p.na, count - 1);
  const items: { v: T; trap?: string; ok?: boolean }[] = [{ v: correct, ok: true }];
  for (const t of tb.slice(0, pick.nb)) items.push(t);
  for (const t of ta.slice(0, pick.na)) items.push(t);
  for (const c of below.slice(0, pick.K - pick.nb)) items.push({ v: c });
  for (const c of above.slice(0, count - 1 - pick.K - pick.na)) items.push({ v: c });
  return items.sort((a, b) => val(a.v) - val(b.v));
}

/** Factors that special-triangle ratios turn into one another (a side over another side, a square of a ratio...). */
export const SURD_FACTORS = {
  two: surd(2, 1),
  half: surd(new Frac(1, 2), 1),
  r2: surd(1, 2),
  ir2: surd(new Frac(1, 2), 2),
  r3: surd(1, 3),
  ir3: surd(new Frac(1, 3), 3),
  tor3: surd(new Frac(2, 3), 3),
  r3h: surd(new Frac(1, 2), 3),
  four: surd(4, 1),
  quarter: surd(new Frac(1, 4), 1),
};

/** The key times each factor named in `ids`, tagged with the slip that factor stands for (the key itself is skipped). */
export function factorTraps(key: Surd, ids: Partial<Record<keyof typeof SURD_FACTORS, string>>): { v: Surd; trap: string }[] {
  const out: { v: Surd; trap: string }[] = [];
  for (const [name, trap] of Object.entries(ids) as [keyof typeof SURD_FACTORS, string][]) {
    const v = surdMul(key, SURD_FACTORS[name]);
    if (Math.abs(surdVal(v) - surdVal(key)) > 1e-9) out.push({ v, trap });
  }
  return out;
}

/** Five (or `count`) surd choices: correct + traps + fillers, unique by value, ascending, correct at a random position. */
export function surdChoices(
  rng: Rng,
  correct: Surd,
  traps: { v: Surd; trap?: string }[],
  fillers: Surd[],
  count = 5,
  must = 0,
): { choices: Choice[]; answer: number; values: Surd[] } {
  const auto: Surd[] = [];
  for (const f of [new Frac(1, 2), new Frac(3, 4), new Frac(2, 3), new Frac(1, 3), new Frac(1, 4)]) auto.push(surd(correct.c.mul(f), correct.r));
  for (const f of [2, new Frac(3, 2), 3, new Frac(4, 3), 4]) auto.push(surd(correct.c.mul(f), correct.r));
  const items = positioned(rng, correct, traps, [...fillers, ...auto], surdVal, count, must);
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

/** Positive integer (or 2-decimal) choices, ascending, correct at a random position, with numeric values for check(). */
export function intChoices(
  rng: Rng,
  correct: number,
  traps: { value: number | Frac; trap: string }[],
  fillers: (number | Frac)[],
  fmt: (v: Frac) => string = (v) => `$${v.isInt() ? num(v.n) : v.toDecimalString()}$`,
  must = 0,
) {
  const toN = (v: number | Frac) => (v instanceof Frac ? v.toNumber() : v);
  const ok = (v: number) => Number.isFinite(v) && v > 0 && Math.abs(v * 100 - Math.round(v * 100)) < 1e-9;
  const toF = (v: number) => (Number.isInteger(v) ? Frac.of(v) : new Frac(Math.round(v * 100), 100));
  const step = correct >= 50 ? 10 : correct >= 15 ? 5 : correct >= 4 ? 2 : 1;
  const auto: number[] = [];
  for (let i = 1; i <= 6; i++) auto.push(correct - i * step, correct + i * step);
  const items = positioned(
    rng,
    correct,
    traps.map((t, i) => ({ v: toN(t.value), trap: t.trap, keep: ok(toN(t.value)), must: i < must })).flatMap((t) => {
      if (t.keep) return [{ v: t.v, trap: t.trap }];
      if (t.must) throw new Redraw('a trap cited in the explanation cannot be shown');
      return [];
    }),
    [...fillers.map(toN), ...auto].filter(ok),
    (v) => v,
    5,
    must,
  );
  const texts = items.map((it) => fmt(toF(it.v)));
  if (new Set(texts).size !== texts.length) throw new Error(`intChoices: duplicate display ${texts.join(' | ')}`);
  return {
    choices: items.map((it, i) => ({ text: texts[i], ...(it.trap ? { trap: it.trap } : {}) })),
    answer: items.findIndex((it) => it.ok),
    values: items.map((it) => it.v),
  };
}

/** Substitution shown in an explanation: evalTex(3, 10, 25) -> "3(25) + 10". */
export const evalTex = (c: number, k: number, x: number) => `${c === 1 ? '' : c}(${x})${k === 0 ? '' : ` ${k < 0 ? '-' : '+'} ${Math.abs(k)}`}`;
