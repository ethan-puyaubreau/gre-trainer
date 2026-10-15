import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import type { Rng } from '../../../engine/rng';
import { lin, num } from '../../../engine/tex';
import { QC_WORDS, qcEnd, qcSamples, randomReals } from './util';

/** Multiply both sides of x < y by a number whose sign is fixed, derived, or free (QC). */
interface ScaleParams {
  kind: 'num' | 'let' | 'prod' | 'diff';
  names: [string, string];
  mv: string[];
  c: number;
  s: number;
  minus: boolean;
  /** sign of the multiplier: +1, -1, or 0 when the statement leaves it free */
  sign: number;
  /** prod only: sign of the helper factor (free case: sign of the product) */
  v: number;
}

const mult = (p: ScaleParams) => (p.kind === 'num' ? num(p.c) : p.kind === 'diff' ? `(${p.mv[0]} - ${p.mv[1]})` : p.mv[0]);

function expr(p: ScaleParams, v: string): string {
  if (p.kind === 'num') return p.minus ? lin([[p.s, ''], [-p.c, v]]) : lin([[p.c, v], [p.s, '']]);
  const t = `${mult(p)}${v}`;
  return p.minus ? `${p.s} - ${t}` : p.s ? `${t} + ${p.s}` : t;
}

function info(p: ScaleParams): string {
  const [x, y] = p.names;
  const [u, w] = p.mv;
  const base = `$${x} < ${y}$`;
  if (p.kind === 'num') return base;
  const side = (g: number) => (g > 0 ? '>' : '<');
  if (p.kind === 'let') return p.sign === 0 ? `${base} and $${u} \\ne 0$` : `${base} and $${u} ${side(p.sign)} 0$`;
  if (p.kind === 'diff') return p.sign === 0 ? `${base} and $${u} \\ne ${w}$` : `${base} and $${u} ${side(p.sign)} ${w}$`;
  if (p.sign === 0) return `${base} and $${u}${w} ${side(p.v)} 0$`;
  return `${base}, $${u}${w} ${side(p.sign * p.v)} 0$ and $${w} ${side(p.v)} 0$`;
}

function reasonText(p: ScaleParams): string {
  const [u, w] = p.mv;
  const sgn = (g: number) => (g > 0 ? 'positive' : 'negative');
  if (p.kind === 'let') return `$${u} ${p.sign > 0 ? '>' : '<'} 0$, so the multiplier is ${sgn(p.sign)}`;
  if (p.kind === 'diff') return `$${u} ${p.sign > 0 ? '>' : '<'} ${w}$, so $${u} - ${w}$ is ${sgn(p.sign)}`;
  return `$${u}${w}$ is ${sgn(p.sign * p.v)} and $${w}$ is ${sgn(p.v)}, so $${u}$ is ${sgn(p.sign)}`;
}

function answerOf(p: ScaleParams): QCChoice {
  if (p.sign === 0) return 'D';
  return (p.minus ? -p.sign : p.sign) > 0 ? 'B' : 'A';
}

function build(p: ScaleParams): QCQuestion {
  const [x, y] = p.names;
  const answer = answerOf(p);
  const M = mult(p);
  const val = (m: number, v: number) => (p.minus ? p.s - m * v : m * v + p.s);
  const demo = (sg: number) => {
    const m = p.kind === 'num' ? p.c : 2 * sg;
    const lead = p.kind === 'num' ? 'For' : `With multiplier $${num(m)}$ and`;
    return `${lead} $${x} = 1$, $${y} = 2$, Quantity A is $${num(val(m, 1))}$ and Quantity B is $${num(val(m, 2))}$.`;
  };
  const traps: QCQuestion['traps'] = {};
  let explanation: string;
  if (p.sign === 0) {
    explanation = `Both quantities use the multiplier $${M}$, and nothing fixes its sign, so test one value of each sign.

${demo(1)} ${demo(-1)}

The comparison changes with the sign of the multiplier. ${qcEnd('D')}

Trap: assuming the order of $${x} < ${y}$ survives treats the multiplier as positive. Rule: a negative factor reverses an inequality, so a free sign means D.`;
    traps.A = 'alg-ineq-scale-assumed-sign';
    traps.B = 'alg-ineq-scale-assumed-sign';
  } else {
    const pos = p.sign > 0;
    const known = p.kind === 'num' ? `The multiplier $${num(p.c)}$ is ${pos ? 'positive' : 'negative'}.` : `Here ${reasonText(p)}.`;
    const flipLine = p.minus ? ` Subtracting each from $${p.s}$ then reverses the order once more.` : '';
    explanation = `Both quantities apply the same multiplier to $${x}$ and $${y}$, so its sign decides. ${known}

Multiplying $${x} < ${y}$ by a ${pos ? 'positive' : 'negative'} number ${pos ? 'keeps' : 'reverses'} the order, and adding the same number to both sides changes nothing.${flipLine} ${qcEnd(answer)}

Check: ${demo(p.sign)}

Trap: keeping the order of $${x} < ${y}$ whatever the multiplier is the usual slip. Rule: a negative factor reverses the inequality.`;
    if (p.kind !== 'num') traps.D = 'alg-ineq-scale-variable-d';
    if (answer === 'A') traps.B = 'alg-ineq-scale-kept-order';
    else if (p.minus) traps.A = 'alg-ineq-scale-kept-order';
  }
  return { format: 'qc', info: info(p), quantityA: `$${expr(p, x)}$`, quantityB: `$${expr(p, y)}$`, answer, traps, explanation };
}

/** (A, B) pairs for random reals that satisfy the stated conditions. */
function sample(p: ScaleParams, rng: Rng): [number, number][] {
  const out: [number, number][] = [];
  const r = randomReals(rng, 800);
  for (let i = 0; i + 3 < r.length; i += 4) {
    const x = r[i];
    const y = x + Math.abs(r[i + 1]) + 0.01;
    const u = r[i + 2];
    const w = r[i + 3];
    let m = u;
    if (u === 0 || w === 0) continue;
    if (p.kind === 'num') m = p.c;
    else if (p.kind === 'prod') {
      if (p.sign === 0 ? Math.sign(u * w) !== p.v : Math.sign(w) !== p.v || Math.sign(u) !== p.sign) continue;
    } else if (p.sign !== 0 && Math.sign(u) !== p.sign) continue;
    const f = (v: number) => (p.minus ? p.s - m * v : m * v + p.s);
    out.push([f(x), f(y)]);
  }
  return out;
}

const scaleQC: Template<ScaleParams> = {
  id: 'alg.inequalities.scale-qc',
  skill: 'alg.inequalities',
  format: 'qc',
  style: 'multiply an inequality by a number of known, derived or free sign',
  generate(rng, d) {
    const names = rng.pick([['x', 'y'], ['m', 'n'], ['p', 'q']] as [string, string][]);
    const minus = rng.chance(0.4);
    const s = rng.int(minus ? 1 : 0, 9);
    let p: ScaleParams;
    if (d === 1) {
      const c = rng.pick([-1, 1]) * rng.int(2, 9);
      p = { kind: 'num', names, mv: [], c, s, minus, sign: Math.sign(c), v: 1 };
    } else if (d === 2) {
      p = { kind: 'let', names, mv: rng.pick([['t'], ['k'], ['c']]), c: 0, s, minus, sign: rng.pick([1, -1, 0, 0]), v: 1 };
    } else {
      const kind = rng.pick(['prod', 'diff'] as const);
      const mv = kind === 'prod' ? rng.pick([['u', 'v'], ['a', 'b'], ['r', 's']]) : rng.pick([['u', 'w'], ['a', 'b'], ['r', 's']]);
      p = { kind, names, mv, c: 0, s: rng.int(1, 9), minus, sign: rng.pick([1, -1, 0, 0]), v: rng.pick([1, -1]) };
    }
    return { q: build(p), params: p };
  },
  check(q, p, rng) {
    if (q.format !== 'qc') return 'wrong format';
    const again = build(p);
    if (q.quantityA !== again.quantityA || q.quantityB !== again.quantityB || q.info !== again.info) return 'text mismatch';
    const truth = qcSamples(sample(p, rng));
    return truth === q.answer ? null : `expected ${truth} (${QC_WORDS[truth]})`;
  },
};

export const scaleTemplates = [scaleQC];

export const scaleTraps: Record<string, Trap> = {
  'alg-ineq-scale-assumed-sign': {
    label: 'Assumed the multiplier is positive',
    fix: 'If the sign of the multiplier is not given, test one positive and one negative value: a negative factor reverses the inequality.',
  },
  'alg-ineq-scale-kept-order': {
    label: 'Kept the order of the inequality after multiplying by a negative',
    fix: 'Multiplying both sides of $x < y$ by a negative number $k$ gives $kx > ky$.',
  },
  'alg-ineq-scale-variable-d': {
    label: 'Chose D only because the multiplier is a variable',
    fix: 'A letter can still have a known sign. Read the conditions and decide the sign before you choose D.',
  },
};
