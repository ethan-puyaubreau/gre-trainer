import { Frac } from '../../../engine/frac';
import { num, poly } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import { QC_WORDS, qcEnd, qcSamples } from './util';

/** f(k) against f(-k): only the odd terms of f decide (QC). */
type Cond = 'pos' | 'neg' | 'nonzero' | 'gt-m' | 'lt-m' | 'mid-pos' | 'mid-neg' | 'sq';
interface OddParams {
  name: string;
  v: string;
  /** coefficients of x^3, x^2, x, 1 */
  co: [number, number, number, number];
  m: number;
  cond: Cond;
}

/** The allowed values as open intervals (null = unbounded), or the two points +-m. */
function pieces(cond: Cond, m: number): [number | null, number | null][] | 'points' {
  switch (cond) {
    case 'pos': return [[0, null]];
    case 'neg': return [[null, 0]];
    case 'nonzero': return [[null, 0], [0, null]];
    case 'gt-m': return [[m, null]];
    case 'lt-m': return [[null, -m]];
    case 'mid-pos': return [[0, m]];
    case 'mid-neg': return [[-m, 0]];
    default: return 'points';
  }
}

function condTex(p: OddParams): string {
  const k = p.v;
  const m = num(p.m);
  return {
    pos: `${k} > 0`, neg: `${k} < 0`, nonzero: `${k} \\ne 0`, 'gt-m': `${k} > ${m}`, 'lt-m': `${k} < ${num(-p.m)}`,
    'mid-pos': `0 < ${k} < ${m}`, 'mid-neg': `${num(-p.m)} < ${k} < 0`, sq: `${k}^2 = ${p.m * p.m}`,
  }[p.cond];
}

const fAt = (co: OddParams['co'], x: Frac) => x.mul(x).mul(x).mul(co[0]).add(x.mul(x).mul(co[1])).add(x.mul(co[2])).add(co[3]);
const fNum = (co: OddParams['co'], x: number) => co[0] * x ** 3 + co[1] * x ** 2 + co[2] * x + co[3];
const inRegion = (p: OddParams, k: number) => {
  const ps = pieces(p.cond, p.m);
  if (ps === 'points') return Math.abs(k) === p.m;
  return ps.some(([lo, hi]) => (lo === null || k > lo) && (hi === null || k < hi));
};

/** Exact grid of allowed values for generate(). */
function grid(p: OddParams): Frac[] {
  const out: Frac[] = [];
  for (let i = -48; i <= 48; i++) {
    const k = new Frac(i, 4);
    if (inRegion(p, i / 4)) out.push(k);
  }
  return out;
}

function build(p: OddParams): { q: QCQuestion; answer: QCChoice } {
  const { name: f, v: k, co } = p;
  const cmpAt = (x: Frac): QCChoice => {
    const a = fAt(co, x);
    const b = fAt(co, x.neg());
    return a.gt(b) ? 'A' : a.lt(b) ? 'B' : 'C';
  };
  const seen = new Set(grid(p).map(cmpAt));
  const answer: QCChoice = seen.size === 1 ? [...seen][0] : 'D';
  const showOne = (x: number) => `$${f}(${num(x)}) = ${num(fNum(co, x))}$ and $${f}(${num(-x)}) = ${num(fNum(co, -x))}$`;
  // integer demonstrations that are allowed by the condition
  const ints = [1, 2, 3, 4, 5, 6, 7, -1, -2, -3, -4, -5, -6, -7].filter((x) => inRegion(p, x));
  const res = (x: number): QCChoice => (fNum(co, x) > fNum(co, -x) ? 'A' : fNum(co, x) < fNum(co, -x) ? 'B' : 'C');
  const cf = (c: number) => (c === 1 ? '' : c === -1 ? '-' : num(c));
  const odd = poly(co[0] ? [co[0], 0, co[2], 0] : [co[2], 0], k);
  const oddTerms = co[0] ? `$${cf(co[0])}x^3$ and $${cf(co[2])}x$` : `$${cf(co[2])}x$`;
  const traps: QCQuestion['traps'] = {};
  let tail: string;
  let body: string;
  if (answer === 'D') {
    const x1 = ints.find((x) => res(x) === 'A');
    const x2 = ints.find((x) => res(x) === 'B');
    body = `The difference is $2(${odd})$, which changes sign, so test allowed values. ${x1 !== undefined && x2 !== undefined ? `For $${k} = ${num(x1)}$: ${showOne(x1)}, so A is greater. For $${k} = ${num(x2)}$: ${showOne(x2)}, so B is greater.` : ''}`;
    tail = `${qcEnd('D')}`;
    traps.C = 'alg-fnodd-even-assumed';
  } else if (answer === 'C') {
    body = `Here $${k}^2 = ${p.m * p.m}$, so ${k} is $${num(p.m)}$ or $${num(-p.m)}$, and the odd terms cancel. Check: ${showOne(p.m)}.`;
    tail = qcEnd('C');
    traps.D = 'alg-fnodd-two-values-d';
  } else {
    const x0 = ints[0];
    body = `Over the allowed values the difference $2(${odd})$ keeps one sign. Check: ${showOne(x0)}, so ${answer === 'A' ? 'A' : 'B'} is greater.`;
    tail = qcEnd(answer);
    traps.D = 'alg-fnodd-unknown-sign';
    traps[answer === 'A' ? 'B' : 'A'] = 'alg-fnodd-even-assumed';
  }
  const explanation = `Compare $${f}(${k})$ with $${f}(-${k})$: the even terms (the square term and the constant) take the same value at ${'$'}${k}${'$'} and $-${k}$, so they cancel.

Only the odd terms ${oddTerms} matter: $${f}(${k}) - ${f}(-${k}) = 2(${odd})$. ${body} ${tail}

Trap: treating $${f}$ as even, with $${f}(${k}) = ${f}(-${k})$, ignores the odd terms. Rule: for $${f}(${k})$ against $${f}(-${k})$, only odd powers survive.`;
  return {
    answer,
    q: {
      format: 'qc',
      info: `$${f}(x) = ${poly(co, 'x')}$ and $${condTex(p)}$`,
      quantityA: `$${f}(${k})$`,
      quantityB: `$${f}(-${k})$`,
      answer,
      traps,
      explanation,
    },
  };
}

const oddPartQC: Template<OddParams> = {
  id: 'alg.functions.odd-part-qc',
  skill: 'alg.functions',
  format: 'qc',
  style: 'compare f(k) with f(-k) using the odd terms',
  generate(rng, d) {
    for (;;) {
      const name = rng.pick(['f', 'g', 'h']);
      const v = rng.pick(['k', 't', 'n']);
      let co: OddParams['co'];
      let cond: Cond;
      let m = 0;
      const e = rng.pick([-1, 1]) * rng.int(1, 5);
      const c = rng.int(-9, 9);
      if (d === 1) {
        co = [0, e, rng.pick([-1, 1]) * rng.int(1, 6), c];
        cond = rng.pick(['pos', 'neg', 'pos', 'neg', 'nonzero']);
      } else if (d === 2) {
        const sg = rng.pick([-1, 1]);
        co = [sg * rng.int(1, 3), rng.chance(0.7) ? e : 0, sg * rng.int(1, 6), c];
        cond = rng.pick(['pos', 'neg', 'pos', 'neg', 'nonzero']);
      } else {
        m = rng.int(2, 4);
        const dd = rng.pick([-1, 1]) * rng.int(1, 2);
        co = [dd, rng.chance(0.7) ? e : 0, -dd * m * m, c];
        cond = rng.pick(['gt-m', 'lt-m', 'mid-pos', 'mid-neg', 'sq', 'pos', 'nonzero']);
      }
      const p: OddParams = { name, v, co, m, cond };
      const { q } = build(p);
      if (q.answer === 'D' && !/so A is greater/.test(q.explanation)) continue; // needs two disagreeing demos
      return { q, params: p };
    }
  },
  check(q, p, rng) {
    if (q.format !== 'qc') return 'wrong format';
    const ps = pieces(p.cond, p.m);
    const samples: [number, number][] = [];
    for (let i = 0; i < 300; i++) {
      let k: number;
      if (ps === 'points') k = rng.sign() * p.m;
      else {
        const [lo, hi] = rng.pick(ps);
        const u = rng.next() * 0.98 + 0.01;
        k = lo !== null && hi !== null ? lo + u * (hi - lo) : lo !== null ? lo + u * 12 : hi! - u * 12;
      }
      samples.push([fNum(p.co, k), fNum(p.co, -k)]);
    }
    const truth = qcSamples(samples, 1e-9);
    return truth === q.answer ? null : `expected ${truth} (${QC_WORDS[truth]})`;
  },
};

export const oddPartTemplates = [oddPartQC];

export const oddPartTraps: Record<string, Trap> = {
  'alg-fnodd-even-assumed': {
    label: 'Treated the function as even: $f(k) = f(-k)$',
    fix: 'Only the even terms ($x^2$, constants) are the same at $k$ and $-k$. The odd terms ($x$, $x^3$) change sign, so they decide the comparison.',
  },
  'alg-fnodd-unknown-sign': {
    label: 'Chose D although the allowed values fix the sign of the difference',
    fix: 'Factor the difference of the odd terms and read its sign on the allowed values before you decide the answer is D.',
  },
  'alg-fnodd-two-values-d': {
    label: 'Chose D because the variable has two possible values',
    fix: 'Two allowed values do not make D when both give the same comparison: test both before you choose.',
  },
};
