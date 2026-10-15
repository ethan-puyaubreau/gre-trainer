import { Frac } from '../../../engine/frac';
import { lin, num } from '../../../engine/tex';
import type { QCChoice, Template, Trap } from '../../../engine/types';
import { qcEnd, qcSamples } from './util';

/* Compare two powers with different bases whose exponents contain a variable: rewrite with one base,
   then compare the exponents over the values the condition allows (QC). */

interface Dom {
  int: boolean;
  lo: number | null;
  loIn: boolean;
  hi: number | null;
  hiIn: boolean;
}

interface P {
  g: number;
  e1: number;
  e2: number;
  /** exponent of quantity A is a1 n + b1, of quantity B is a2 n + b2 */
  a1: number;
  b1: number;
  a2: number;
  b2: number;
  dom: Dom;
  v: string;
}

const inDom = (d: Dom, x: number) => (d.lo === null || (d.loIn ? x >= d.lo : x > d.lo)) && (d.hi === null || (d.hiIn ? x <= d.hi : x < d.hi)) && (!d.int || Number.isInteger(x));

function domText(d: Dom, v: string): string {
  if (d.int) {
    if (d.lo === 1 && d.loIn && d.hi === null) return `$${v}$ is a positive integer`;
    if (d.lo === 0 && d.loIn && d.hi === null) return `$${v}$ is a nonnegative integer`;
    if (d.lo !== null && d.hi === null) return d.loIn ? `$${v}$ is an integer and $${v} \\ge ${num(d.lo)}$` : `$${v}$ is an integer greater than $${num(d.lo)}$`;
    if (d.lo === null && d.hi !== null) return d.hiIn ? `$${v}$ is an integer and $${v} \\le ${num(d.hi)}$` : `$${v}$ is an integer less than $${num(d.hi)}$`;
    if (d.lo !== null && d.hi !== null) return `$${v}$ is an integer and $${num(d.lo)} \\le ${v} \\le ${num(d.hi)}$`;
    return `$${v}$ is an integer`;
  }
  if (d.lo !== null && d.hi === null) return `$${v} ${d.loIn ? '\\ge' : '>'} ${num(d.lo)}$`;
  if (d.lo === null && d.hi !== null) return `$${v} ${d.hiIn ? '\\le' : '<'} ${num(d.hi)}$`;
  return `$${num(d.lo!)} ${d.loIn ? '\\le' : '<'} ${v} ${d.hiIn ? '\\le' : '<'} ${num(d.hi!)}$`;
}

/** Sign of (exponent of A) - (exponent of B), written in base g, over a list of points. */
function relOver(c1: Frac, c0: Frac, pts: Frac[]): QCChoice {
  const signs = new Set(pts.map((x) => Math.sign(c1.mul(x).add(c0).n)));
  if (signs.size === 0) throw new Error('empty domain');
  if (signs.size > 1) return 'D';
  const s = [...signs][0];
  return s > 0 ? 'A' : s < 0 ? 'B' : 'C';
}

/** Exact candidate points of the domain: all integers nearby, or the boundaries, the root and points around them. */
function candidates(d: Dom, root: Frac | null): Frac[] {
  const out: Frac[] = [];
  const add = (x: Frac) => inDom(d, x.toNumber()) && out.push(x);
  if (d.int) {
    for (let x = -60; x <= 60; x++) add(new Frac(x));
    return out;
  }
  const eps = new Frac(1, 100);
  const base: Frac[] = [new Frac(-1000), new Frac(1000)];
  for (const b of [d.lo, d.hi]) if (b !== null) base.push(new Frac(b));
  if (root) base.push(root);
  for (const b of base) {
    add(b);
    add(b.add(eps));
    add(b.sub(eps));
  }
  return out;
}

function build(rng: Parameters<Template<P>['generate']>[0], d: 1 | 2 | 3): P {
  const g = d === 1 ? 2 : rng.pick(d === 2 ? [2, 3] : [2, 2, 3, 5]);
  const emax = g === 2 ? 3 : 2;
  const es = g === 5 ? [1, 2] : Array.from({ length: emax }, (_, i) => i + 1);
  const [e1, e2] = rng.sample(es, 2);
  const eq = rng.chance(0.14);
  let a1 = 1;
  let a2 = 1;
  let b1 = 0;
  let b2 = 0;
  const sg = () => (d === 3 && rng.chance(0.3) ? -1 : 1);
  if (eq) {
    const m = Math.max(e1, e2) / Math.min(e1, e2);
    if (Number.isInteger(m)) {
      const base = [rng.int(1, 2) * sg(), rng.int(0, 3)];
      if (e1 > e2) [a2, b2, a1, b1] = [base[0] * m, base[1] * m, base[0], base[1]];
      else [a1, b1, a2, b2] = [base[0] * m, base[1] * m, base[0], base[1]];
    }
  }
  if (!(a1 !== 1 || a2 !== 1 || b1 !== 0 || b2 !== 0)) {
    // not an equal pair: free parameters
    a1 = d === 1 ? 1 : rng.int(1, d === 2 ? 2 : 3) * sg();
    a2 = d === 1 ? 1 : rng.int(1, d === 2 ? 2 : 3) * sg();
    b1 = d === 1 ? rng.int(0, 3) : rng.int(-2, d === 2 ? 5 : 6);
    b2 = d === 1 ? rng.int(0, 5) : rng.int(-2, d === 2 ? 5 : 6);
  }
  // domain
  const kind = rng.pick(d === 1 ? ['posint', 'posint', 'intge', 'ints-range'] : d === 2 ? ['posint', 'intge', 'ints-range', 'real-gt', 'real-lt', 'int-lt'] : ['intge', 'real-gt', 'real-lt', 'int-lt', 'int-gt', 'ints-range', 'int', 'real-ge']);
  const dom: Dom = { int: false, lo: null, loIn: false, hi: null, hiIn: false };
  const L = rng.int(-2, 4);
  if (kind === 'posint') Object.assign(dom, { int: true, lo: 1, loIn: true });
  else if (kind === 'intge') Object.assign(dom, { int: true, lo: rng.int(0, 4), loIn: true });
  else if (kind === 'int-gt') Object.assign(dom, { int: true, lo: L, loIn: false });
  else if (kind === 'int-lt') Object.assign(dom, { int: true, hi: L + 2, hiIn: false });
  else if (kind === 'int') Object.assign(dom, { int: true });
  else if (kind === 'ints-range') Object.assign(dom, { int: true, lo: L, loIn: true, hi: L + rng.int(2, 5), hiIn: true });
  else if (kind === 'real-gt') Object.assign(dom, { lo: L, loIn: false });
  else if (kind === 'real-ge') Object.assign(dom, { lo: L, loIn: true });
  else Object.assign(dom, { hi: L + 2, hiIn: false });
  return { g, e1, e2, a1, b1, a2, b2, dom, v: rng.pick(['n', 'n', 'k', 't', 'x']) };
}

function answerOf(P: P): QCChoice {
  const c1 = new Frac(P.e1 * P.a1 - P.e2 * P.a2);
  const c0 = new Frac(P.e1 * P.b1 - P.e2 * P.b2);
  const root = c1.n === 0 ? null : c0.neg().div(c1);
  return relOver(c1, c0, candidates(P.dom, root));
}

const powTex = (g: number, e: number, a: number, b: number, v: string) => `${num(g ** e)}^{${lin([[a, v], [b, '']])}}`;

const comparePowersQC: Template<P> = {
  id: 'alg.exponent-equations.compare-powers-qc',
  skill: 'alg.exponent-equations',
  format: 'qc',
  style: 'compare powers with different bases and a variable exponent',
  generate(rng, d) {
    const target = rng.pick<QCChoice>(['A', 'B', 'A', 'B', 'C', 'D', 'D']);
    let P: P = build(rng, d);
    for (let i = 0; i < 300 && answerOf(P) !== target; i++) P = build(rng, d);
    const { g, e1, e2, a1, b1, a2, b2, dom, v } = P;
    const answer = answerOf(P);
    const c1 = e1 * a1 - e2 * a2;
    const c0 = e1 * b1 - e2 * b2;
    const rel = (x: number): QCChoice => {
      const t = c1 * x + c0;
      return t > 0 ? 'A' : t < 0 ? 'B' : 'C';
    };
    const exA = lin([[e1 * a1, v], [e1 * b1, '']]);
    const exB = lin([[e2 * a2, v], [e2 * b2, '']]);
    const rw = (e: number, a: number, b: number, ex: string) => (e === 1 ? `$${powTex(g, e, a, b, v)}$ already has base ${g}` : `$${powTex(g, e, a, b, v)} = (${g}^{${e}})^{${lin([[a, v], [b, '']])}} = ${g}^{${ex}}$`);
    const diffTex = `${lin([[c1, v], [c0, '']])}`;
    const root0 = c1 === 0 ? null : -c0 / c1;
    // two allowed values that disagree (D)
    let dText = '';
    if (answer === 'D') {
      const pts: number[] = [];
      for (let k = 0; k <= 12; k++) for (const x of k === 0 ? [0] : [k, -k]) pts.push(x);
      if (!dom.int) for (const x of [0.5, 1.5, 2.5, -0.5, -1.5]) pts.push(x);
      const near = [...(root0 === null ? [] : [root0]), ...[dom.lo, dom.hi].filter((b): b is number => b !== null)];
      for (const c of near) for (let j = -3; j <= 3; j++) pts.push(Math.round(c) + j, ...(dom.int ? [] : [c + j / 2]));
      pts.sort((p, q) => Math.abs(p) - Math.abs(q));
      const seen: { r: QCChoice; t: string }[] = [];
      for (const x of pts) {
        if (!inDom(dom, x)) continue;
        const r = rel(x);
        if (seen.some((s) => s.r === r)) continue;
        const word = r === 'A' ? 'Quantity A is greater' : r === 'B' ? 'Quantity B is greater' : 'the quantities are equal';
        seen.push({ r, t: `$${v} = ${num(x)}$ gives exponents $${num(e1 * a1 * x + e1 * b1)}$ and $${num(e2 * a2 * x + e2 * b2)}$, so ${word}` });
        if (seen.length === 2) break;
      }
      dText = `Two allowed values disagree: ${seen[0].t}; but ${seen[1].t}.`;
    }
    const root = c1 === 0 ? null : new Frac(-c0, c1);
    const rootText = root ? `The difference of the exponents is $${diffTex}$, which is 0 only at $${v} = ${root.toTex()}$.` : `The difference of the exponents is the constant $${diffTex === '0' ? '0' : diffTex}$.`;
    let verdict: string;
    if (answer === 'C') verdict = 'The exponents are equal for every value, so the two quantities are the same number.';
    else if (answer === 'D') verdict = dText;
    else verdict = `On the allowed values the difference $${diffTex}$ is always ${answer === 'A' ? 'positive' : 'negative'}, so the larger exponent belongs to Quantity ${answer}.`;
    // naive comparisons that give a wrong letter
    const traps: Partial<Record<QCChoice, string>> = {};
    const bigBase: QCChoice = g ** e1 > g ** e2 ? 'A' : 'B';
    if (bigBase !== answer) traps[bigBase] = 'alg-qc-bigger-base';
    const naive = relOver(new Frac(a1 - a2), new Frac(b1 - b2), candidates(dom, a1 === a2 ? null : new Frac(b2 - b1, a1 - a2)));
    if (naive !== answer && naive !== 'D' && !traps[naive]) traps[naive] = 'alg-ignore-base';
    if (answer === 'D') {
      const first = [...candidates(dom, null)].sort((p, q) => Math.abs(p.toNumber()) - Math.abs(q.toNumber()))[0];
      const lr = rel(first.toNumber());
      if (lr !== 'D' && !traps[lr]) traps[lr] = 'tested-one-value';
    } else if (!traps.D) traps.D = 'alg-qc-variable-d';
    return {
      params: P,
      q: {
        format: 'qc',
        info: domText(dom, v),
        quantityA: `$${powTex(g, e1, a1, b1, v)}$`,
        quantityB: `$${powTex(g, e2, a2, b2, v)}$`,
        answer,
        traps,
        explanation: `The bases differ, so rewrite both quantities with base ${g}. Quantity A: ${rw(e1, a1, b1, exA)}. Quantity B: ${rw(e2, a2, b2, exB)}.

Since ${g} is greater than 1, the quantity with the larger exponent is the larger number. ${rootText} ${verdict} ${qcEnd(answer)}

Rule: put both powers on one base, then compare exponents over every allowed value.`,
      },
    };
  },
  check(q, P) {
    if (q.format !== 'qc') return 'wrong format';
    const { g, e1, e2, a1, b1, a2, b2, dom } = P;
    const xs: number[] = [];
    for (let x = -40; x <= 40; x++) xs.push(x);
    if (!dom.int) {
      for (let i = 0; i < 160; i++) xs.push(-40 + 80 * (i / 160) + 0.013);
      for (const b of [dom.lo, dom.hi]) if (b !== null) for (const e of [1e-3, 1e-2, 0.1]) xs.push(b + e, b - e, b);
      const c1 = e1 * a1 - e2 * a2;
      if (c1 !== 0) {
        const r = -(e1 * b1 - e2 * b2) / c1;
        for (const e of [1e-3, 1e-2, 0.1, 0]) xs.push(r + e, r - e);
      }
    }
    const samples = xs.filter((x) => inDom(dom, x)).map((x) => [Math.pow(g ** e1, a1 * x + b1), Math.pow(g ** e2, a2 * x + b2)] as [number, number]);
    if (!samples.length) return 'no admissible sample';
    const exp = qcSamples(samples, 1e-9);
    return exp === q.answer ? null : `expected ${exp}`;
  },
};

export const comparePowersTemplate = comparePowersQC;
export const comparePowersTraps: Record<string, Trap> = {
  'alg-qc-bigger-base': {
    label: 'The bigger base gives the bigger power',
    fix: 'The exponents matter as much as the bases: $4^{n}$ and $2^{2n}$ are the same number. Rewrite both powers on one base before deciding.',
  },
};
