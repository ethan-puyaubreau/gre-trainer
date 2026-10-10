import { qcCompare } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { gcd } from '../../../engine/math';
import { lin, num } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template } from '../../../engine/types';
import { SPECIAL, intExcept, qcEnd, qcSamples, randomReals, times } from './util';

/* ================================================================== 1. Linear comparison under a one-sided condition (QC) */

interface ThresholdParams {
  /** A = (a y + b)/c, B = d y + e */
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  lo: number | null;
  hi: number | null;
  v: string;
}


const thresholdQC: Template<ThresholdParams> = {
  id: 'alg.qc-algebra.threshold-qc',
  skill: 'alg.qc-algebra',
  format: 'qc',
  style: 'simplify a linear comparison, then use the condition',
  generate(rng, d) {
    const v = rng.pick(['y', 'w', 'x', 'n', 't']);
    let a: number;
    let b: number;
    let c: number;
    let dd: number;
    let e: number;
    let m: Frac;
    do {
      if (d === 1 && rng.chance(0.4)) {
        // degenerate form: y versus a constant
        a = 1;
        b = 0;
        c = 1;
        dd = 0;
        e = intExcept(rng, -9, 9, 0);
      } else {
        a = intExcept(rng, -5, 7, 0);
        b = rng.int(-12, 12);
        c = d === 1 ? 1 : rng.pick([1, 1, 2, 3, 4, 5]);
        dd = rng.int(-4, 5);
        e = rng.int(-9, 9);
      }
      m = new Frac(a, c).sub(dd);
    } while (m.n === 0 || (c > 1 && gcd(gcd(a, b), c) > 1));
    // A - B = m y + n, zero at t
    const n = new Frac(b, c).sub(e);
    const t = n.neg().div(m);
    const tLo = Math.floor(t.toNumber());
    const tHi = Math.ceil(t.toNumber());
    const goal = rng.pick(['det', 'det', 'D'] as const);
    const side = rng.pick(['gt', 'lt'] as const);
    let lo: number | null = null;
    let hi: number | null = null;
    if (side === 'gt') lo = goal === 'det' ? tHi + rng.int(0, 3) : tLo - rng.int(1, 4);
    else hi = goal === 'det' ? tLo - rng.int(0, 3) : tHi + rng.int(1, 4);
    if (d === 3 && rng.chance(0.4)) {
      // a two-sided condition
      if (lo !== null) hi = lo + rng.int(2, 6);
      else lo = hi! - rng.int(2, 6);
    }
    // Answer: sign of m y + n over the allowed interval (open).
    const signAt = (y: Frac) => m.mul(y).add(n).sign();
    const inside = (lo === null || t.gt(lo)) && (hi === null || t.lt(hi));
    let answer: QCChoice;
    if (inside) answer = 'D';
    else {
      const probe = lo !== null && hi !== null ? new Frac(lo + hi, 2) : lo !== null ? frac(lo + 1) : frac(hi! - 1);
      answer = signAt(probe) > 0 ? 'A' : 'B';
    }
    const numer = a < 0 && b > 0 ? lin([[b, ''], [a, v]]) : lin([[a, v], [b, '']]);
    const Atex = c === 1 ? numer : `\\dfrac{${numer}}{${c}}`;
    const Btex = lin([[dd, v], [e, '']]);
    const info = lo !== null && hi !== null ? `$${num(lo)} < ${v} < ${num(hi)}$` : lo !== null ? `$${v} > ${num(lo)}$` : `$${v} < ${num(hi!)}$`;
    const traps: QCQuestion['traps'] = {};
    // The answer you get when you forget to flip the sign.
    if (m.n < 0 && answer !== 'D') traps[answer === 'A' ? 'B' : 'A'] = 'alg-no-flip';
    if (answer !== 'D') traps.D = 'alg-qc-variable-d';
    else {
      const probe = lo !== null ? frac(lo + 1) : frac(hi! - 1);
      const s = signAt(probe);
      if (s !== 0) traps[s > 0 ? 'A' : 'B'] = 'tested-one-value';
    }
    // Steps of the simplification.
    const steps: string[] = [`$${Atex} \\;?\\; ${Btex}$`];
    const trivial = a === 1 && b === 0 && c === 1 && dd === 0;
    const L: [number, number] = [a, b];
    const R: [number, number] = [dd * c, e * c];
    if (c !== 1) steps.push(`Multiply both sides by ${c}: $${lin([[a, v], [b, '']])} \\;?\\; ${lin([[dd * c, v], [e * c, '']])}$`);
    const coefY = L[0] - R[0];
    const cons = R[1] - L[1];
    if (!trivial) steps.push(`Collect $${v}$ on the left and the numbers on the right: $${lin([[coefY, v]])} \\;?\\; ${num(cons)}$`);
    if (coefY !== 1)
      steps.push(
        coefY < 0
          ? `Divide by $${coefY}$. Dividing by a negative number reverses an inequality, so from here on "Quantity A is greater" means $${v} < ${t.toTex()}$.`
          : `Divide by ${coefY}: $${v} \\;?\\; ${t.toTex()}$`,
      );
    const mPos = coefY > 0;
    const meaning = `Quantity A is greater exactly when $${v} ${mPos ? '>' : '<'} ${t.toTex()}$, and Quantity B is greater when $${v} ${mPos ? '<' : '>'} ${t.toTex()}$.`;
    const verdict = inside
      ? `The condition ${info} allows values of $${v}$ on both sides of $${t.toTex()}$.`
      : `The condition ${info} puts every allowed $${v}$ ${lo !== null && (hi === null || t.cmp(lo) <= 0) ? 'above' : 'below'} $${t.toTex()}$.`;
    return {
      params: { a, b, c, d: dd, e, lo, hi, v },
      q: {
        format: 'qc',
        info,
        quantityA: `$${Atex}$`,
        quantityB: `$${Btex}$`,
        answer,
        traps: Object.keys(traps).length ? traps : undefined,
        explanation: trivial
          ? `Quantity A is $${v}$ itself, so compare $${v}$ with $${num(e)}$. ${verdict} ${qcEnd(answer)}`
          : `Simplify the comparison, applying the same step to both quantities:
${steps.map((s0) => `- ${s0}`).join('\n')}

${meaning} ${verdict} ${qcEnd(answer)}`,
      },
    };
  },
  check(q, { a, b, c, d, e, lo, hi }, rng) {
    if (q.format !== 'qc') return 'wrong format';
    const ok = (y: number) => (lo === null || y > lo) && (hi === null || y < hi);
    const ys = [...SPECIAL, ...randomReals(rng, 300)].filter(ok);
    for (const bnd of [lo, hi]) if (bnd !== null) for (let j = 1; j <= 400; j++) ys.push(bnd + (lo === bnd ? 1 : -1) * j * 0.01);
    const samples = ys.filter(ok).map((y) => [(a * y + b) / c, d * y + e] as [number, number]);
    const expected = qcSamples(samples, 1e-12);
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

/* ================================================================== 2. Complete the square / quadratic versus linear (QC) */

interface SquareParams {
  kind: 'square' | 'relation';
  /** square: A = x^2 + p, B = 2hx + q (swapped if swap); relation: y = s x^2 + b x + c */
  k: number[];
  swap: boolean;
  lo: number | null;
  hi: number | null;
}

const squareQC: Template<SquareParams> = {
  id: 'alg.qc-algebra.square-qc',
  skill: 'alg.qc-algebra',
  format: 'qc',
  style: 'quadratic versus linear: complete the square',
  generate(rng, d) {
    const kind: SquareParams['kind'] = rng.pick(d === 1 ? ['square'] : ['square', 'relation']);
    const swap = rng.chance(0.4);
    let info: string | undefined;
    let A: string;
    let B: string;
    let answer: QCChoice;
    const traps: QCQuestion['traps'] = {};
    let explanation: string;
    let k: number[];
    let lo: number | null = null;
    let hi: number | null = null;
    if (kind === 'square') {
      const h = intExcept(rng, -4, 4, 0);
      const kk = rng.pick(d === 1 ? [1, 2, 3, 0, -2] : [1, 2, 0, -1, -3, 4]);
      const q = rng.int(-8, 8);
      const p = q + kk + h * h;
      // optional one-sided condition away from h
      const useCond = d >= 2 && rng.chance(0.4);
      if (useCond) {
        if (rng.chance(0.5)) lo = h + rng.int(0, 2);
        else hi = h - rng.int(0, 2);
      }
      const gap = lo !== null ? lo - h : hi !== null ? h - hi : null; // distance from h to the allowed region (>= 0)
      // A - B = (x - h)^2 + kk. With a bound, (x - h)^2 > gap^2 strictly.
      const determined = gap === null ? kk > 0 : gap * gap + kk >= 0;
      answer = !determined ? 'D' : swap ? 'B' : 'A';
      const qa = `x^2 ${p < 0 ? '-' : '+'} ${Math.abs(p)}`.replace(/ \+ 0$/, '');
      const qb = lin([[2 * h, 'x'], [q, '']]);
      A = `$${swap ? qb : qa}$`;
      B = `$${swap ? qa : qb}$`;
      info = lo !== null ? `$x > ${num(lo)}$` : hi !== null ? `$x < ${num(hi)}$` : undefined;
      if (answer === 'D') traps[swap ? 'B' : 'A'] = kk === 0 && gap === null ? 'alg-strict-vs-equal' : 'tested-one-value';
      else traps.D = 'alg-qc-variable-d';
      const sq = `(x ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2`;
      const diff = `${sq}${kk === 0 ? '' : kk > 0 ? ` + ${kk}` : ` - ${-kk}`}`;
      let why: string;
      if (gap === null) {
        why =
          kk > 0
            ? `A square is never negative, so the difference is at least ${kk}: $${qa}$ is always greater.`
            : kk === 0
              ? `The difference is a square: it is 0 at $x = ${h}$ and positive for every other $x$. The quantities are equal in one case and different in the others.`
              : `The difference is $${kk}$ at $x = ${h}$ but positive for $x$ far from $${h}$, such as $x = ${h + 10}$.`;
      } else {
        const bound = lo !== null ? `x > ${num(lo)}` : `x < ${num(hi!)}`;
        why = determined
          ? `With $${bound}$, $x$ ${gap === 0 ? 'is never' : `is more than ${gap} away from`} $${h}$${gap === 0 ? '' : ''}, so $${sq} > ${gap * gap}$ and the difference is greater than $${gap * gap + kk}$${gap * gap + kk === 0 ? '' : ', a positive number'}.`
          : `With $${bound}$, $x$ can be close to the bound, where the difference is about $${gap * gap + kk}$ (negative), or far away, where it is positive.`;
      }
      explanation = `Subtract: $(${qa}) - (${qb}) = ${lin([[1, 'x^2'], [-2 * h, 'x'], [p - q, '']])} = ${diff}$, by completing the square ($${sq} = ${lin([[1, 'x^2'], [-2 * h, 'x'], [h * h, '']])}$).

${why} ${qcEnd(answer)}`;
      k = [p, h, q, kk];
    } else {
      // y = s x^2 + b x + c with s = ±1; y - x = s x^2 + (b - 1) x + c
      const s = rng.pick([1, -1]);
      const hh = rng.int(-3, 3); // vertex of y - x at x = hh
      const det = rng.pick(['pos', 'zero', 'neg', 'neg']);
      // y - x = s (x - hh)^2 + kk
      const kk = det === 'zero' ? 0 : det === 'neg' ? s * rng.int(1, 4) : -s * rng.int(1, 9);
      const bb = 1 - 2 * s * hh;
      const cc = s * hh * hh + kk;
      k = [s, bb, cc, hh, kk];
      info = `$y = ${lin([[s, 'x^2'], [bb, 'x'], [cc, '']])}$`;
      A = swap ? '$y$' : '$x$';
      B = swap ? '$x$' : '$y$';
      // y - x has constant sign s (never 0) when kk has the sign of s
      let yMinusX: QCChoice; // 'A' means y > x always
      if (kk === 0 || Math.sign(kk) !== s) yMinusX = 'D';
      else yMinusX = s > 0 ? 'A' : 'B';
      answer = yMinusX === 'D' ? 'D' : (yMinusX === 'A') !== swap ? 'B' : 'A';
      if (answer === 'D') traps[rng.pick(['A', 'B'] as const)] = 'tested-one-value';
      else {
        traps.D = 'alg-qc-variable-d';
        traps[answer === 'A' ? 'B' : 'A'] = 'alg-square-bigger';
      }
      const sqTerm = `(x ${hh > 0 ? '-' : '+'} ${Math.abs(hh)})^2`.replace('(x + 0)', 'x').replace('(x - 0)', 'x');
      const form = `${s < 0 ? '-' : ''}${sqTerm}${kk === 0 ? '' : kk > 0 ? ` + ${kk}` : ` - ${-kk}`}`;
      const xs = [hh, hh + 5];
      const val = (x: number) => s * (x - hh) ** 2 + kk;
      explanation = `Compare $x$ with $y$ by looking at $y - x = ${lin([[s, 'x^2'], [bb - 1, 'x'], [cc, '']])} = ${form}$.

${
        yMinusX === 'D'
          ? `At $x = ${xs[0]}$, $y - x = ${val(xs[0])}$; at $x = ${xs[1]}$, $y - x = ${val(xs[1])}$. The sign changes${kk === 0 ? ' (or is 0)' : ''}, so the comparison depends on $x$.`
          : `Since ${s > 0 ? `$${sqTerm} \\ge 0$, the difference is at least ${kk}` : `$-${sqTerm} \\le 0$, the difference is at most $${kk}$`}: $y$ is always ${s > 0 ? 'greater' : 'less'} than $x$.`
      } ${qcEnd(answer)}`;
    }
    return {
      params: { kind, k: k!, swap, lo, hi },
      q: { format: 'qc', info, quantityA: A!, quantityB: B!, answer: answer!, traps: Object.keys(traps).length ? traps : undefined, explanation: explanation! },
    };
  },
  check(q, { kind, k, swap, lo, hi }, rng) {
    if (q.format !== 'qc') return 'wrong format';
    const ok = (x: number) => (lo === null || x > lo) && (hi === null || x < hi);
    const xs = [...SPECIAL, ...randomReals(rng, 300)];
    for (const bnd of [lo, hi]) if (bnd !== null) for (let j = 1; j <= 300; j++) xs.push(bnd + (lo === bnd ? 1 : -1) * j * 0.01);
    const samples: [number, number][] = xs.filter(ok).map((x) => {
      if (kind === 'square') {
        const [p, h, qq] = k;
        const a = x * x + p;
        const b = 2 * h * x + qq;
        return swap ? [b, a] : [a, b];
      }
      const [s, bb, cc] = k;
      const y = s * x * x + bb * x + cc;
      return swap ? [y, x] : [x, y];
    });
    const expected = qcSamples(samples, 1e-12);
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

/* ================================================================== 3. Sign conditions, rational expressions, swapped constants (QC) */

type SignCond = 'neg-pos' | 'both-neg' | 'both-pos' | 'frac-big';
type SignPair = 'diff-sum' | 'x2y-xy2' | 'ratios' | 'prod-sum' | 'squares' | 'square-sum';

const SIGN_COND_TEX: Record<SignCond, string> = {
  'neg-pos': 'x < 0 < y',
  'both-neg': 'x < y < 0',
  'both-pos': '0 < x < y',
  'frac-big': '0 < x < 1 < y',
};

const SIGN_TABLE: Record<SignPair, Record<SignCond, QCChoice>> = {
  'diff-sum': { 'neg-pos': 'B', 'both-neg': 'A', 'both-pos': 'B', 'frac-big': 'B' },
  'x2y-xy2': { 'neg-pos': 'A', 'both-neg': 'B', 'both-pos': 'B', 'frac-big': 'B' },
  ratios: { 'neg-pos': 'D', 'both-neg': 'A', 'both-pos': 'B', 'frac-big': 'B' },
  'prod-sum': { 'neg-pos': 'D', 'both-neg': 'A', 'both-pos': 'D', 'frac-big': 'B' },
  squares: { 'neg-pos': 'D', 'both-neg': 'A', 'both-pos': 'B', 'frac-big': 'B' },
  'square-sum': { 'neg-pos': 'B', 'both-neg': 'A', 'both-pos': 'A', 'frac-big': 'A' },
};

const PAIR_TEX: Record<SignPair, [string, string]> = {
  'diff-sum': ['x - y', 'x + y'],
  'x2y-xy2': ['x^2y', 'xy^2'],
  ratios: ['\\dfrac{x}{y}', '\\dfrac{y}{x}'],
  'prod-sum': ['xy', 'x + y'],
  squares: ['x^2', 'y^2'],
  'square-sum': ['(x + y)^2', 'x^2 + y^2'],
};

const pairValue = (p: SignPair, x: number, y: number): [number, number] => {
  switch (p) {
    case 'diff-sum':
      return [x - y, x + y];
    case 'x2y-xy2':
      return [x * x * y, x * y * y];
    case 'ratios':
      return [x / y, y / x];
    case 'prod-sum':
      return [x * y, x + y];
    case 'squares':
      return [x * x, y * y];
    case 'square-sum':
      return [(x + y) ** 2, x * x + y * y];
  }
};

const PAIR_REASON: Record<SignPair, string> = {
  'diff-sum': 'Subtract $x$ from both quantities: the comparison becomes $-y$ versus $y$, which depends only on the sign of $y$.',
  'x2y-xy2': 'The difference is $x^2y - xy^2 = xy(x - y)$. Here $x < y$, so $x - y < 0$; the sign of $xy$ decides.',
  ratios: 'Both quotients have the same sign as $xy$, and their product is 1, so the one with the larger size is the one whose numerator is farther from 0.',
  'prod-sum': 'Think about signs and sizes of $xy$ and $x + y$, then test values.',
  squares: 'Comparing $x^2$ with $y^2$ is comparing the distances $|x|$ and $|y|$ from 0.',
  'square-sum': 'Expand: $(x + y)^2 = x^2 + 2xy + y^2$, so the comparison is $2xy$ versus 0, the sign of $xy$.',
};

const SIGN_EXAMPLES: Record<SignCond, [number, number][]> = {
  'neg-pos': [[-1, 2], [-3, 1], [-2, 2], [-1, 3], [-0.5, 4], [-4, 0.5], [-2, 1]],
  'both-neg': [[-3, -1], [-2, -1], [-5, -2]],
  'both-pos': [[1, 2], [3, 4], [1, 3], [0.5, 1], [2, 5]],
  'frac-big': [[0.5, 2], [0.25, 3]],
};

interface SignParams {
  kind: 'signs' | 'rational' | 'swapped';
  cond: SignCond | null;
  pair: SignPair | null;
  /** rational: [form, c] with condition interval lo/hi; swapped: [a, b, rel] */
  k: number[];
  lo: number | null;
  hi: number | null;
}

const fmt = (v: number) => {
  for (const dd of [1, 2, 4]) if (Number.isInteger(v * dd)) return new Frac(v * dd, dd).toTex();
  return num(v);
};

const signCasesQC: Template<SignParams> = {
  id: 'alg.qc-algebra.sign-cases-qc',
  skill: 'alg.qc-algebra',
  format: 'qc',
  style: 'use the signs given in the condition',
  generate(rng, d) {
    const kind: SignParams['kind'] = rng.pick(d === 1 ? ['signs', 'swapped'] : ['signs', 'rational', 'swapped']);
    let info: string | undefined;
    let A: string;
    let B: string;
    let answer: QCChoice;
    const traps: QCQuestion['traps'] = {};
    let explanation: string;
    let cond: SignCond | null = null;
    let pair: SignPair | null = null;
    let k: number[] = [];
    let lo: number | null = null;
    let hi: number | null = null;
    if (kind === 'signs') {
      cond = rng.pick(['neg-pos', 'both-neg', 'both-pos', 'frac-big'] as SignCond[]);
      pair = rng.pick(Object.keys(SIGN_TABLE) as SignPair[]);
      answer = SIGN_TABLE[pair][cond];
      info = `$${SIGN_COND_TEX[cond]}$`;
      [A, B] = PAIR_TEX[pair].map((t) => `$${t}$`);
      const exs = SIGN_EXAMPLES[cond];
      const rel = (p: [number, number]) => {
        const [u, w] = pairValue(pair!, p[0], p[1]);
        return u > w ? 'A' : u < w ? 'B' : 'C';
      };
      let exampleText: string;
      if (answer === 'D') {
        const e1 = exs.find((p) => rel(p) !== 'C')!;
        const e2 = exs.find((p) => rel(p) !== rel(e1))!;
        const show = (p: [number, number]) => {
          const [u, w] = pairValue(pair!, p[0], p[1]);
          return `$x = ${fmt(p[0])}$, $y = ${fmt(p[1])}$ give $${fmt(u)}$ and $${fmt(w)}$`;
        };
        exampleText = `For example, ${show(e1)}, while ${show(e2)}.`;
        traps[rel(e1) as QCChoice] = 'tested-one-value';
      } else {
        const e1 = exs[0];
        const [u, w] = pairValue(pair, e1[0], e1[1]);
        exampleText = `A check with $x = ${fmt(e1[0])}$ and $y = ${fmt(e1[1])}$: Quantity A is $${fmt(u)}$ and Quantity B is $${fmt(w)}$, consistent with this.`;
        traps.D = 'alg-qc-variable-d';
        if (pair === 'squares' || pair === 'ratios') traps[answer === 'A' ? 'B' : 'A'] = 'alg-magnitude-vs-value';
      }
      explanation = `${PAIR_REASON[pair]} With $${SIGN_COND_TEX[cond]}$: ${signReason(pair, cond, answer)}

${exampleText} ${qcEnd(answer)}`;
    } else if (kind === 'rational') {
      const form = rng.pick([0, 1]);
      if (form === 0) {
        // A = 1/x, B = (x + c)/x^2 : B - A = c/x^2
        const c = intExcept(rng, -5, 5, 0);
        const cond0 = rng.pick(['pos', 'neg']);
        if (cond0 === 'pos') lo = 0;
        else hi = 0;
        info = cond0 === 'pos' ? '$x > 0$' : '$x < 0$';
        A = '$\\dfrac{1}{x}$';
        B = `$\\dfrac{${lin([[1, 'x'], [c, '']])}}{x^2}$`;
        answer = c > 0 ? 'B' : 'A';
        traps.D = 'alg-qc-variable-d';
        traps.C = 'tested-one-value';
        explanation = `Split Quantity B into two fractions: $\\dfrac{${lin([[1, 'x'], [c, '']])}}{x^2} = \\dfrac{x}{x^2} ${c > 0 ? '+' : '-'} \\dfrac{${Math.abs(c)}}{x^2} = \\dfrac{1}{x} ${c > 0 ? '+' : '-'} \\dfrac{${Math.abs(c)}}{x^2}$.

Both quantities contain $\\dfrac{1}{x}$, and $\\dfrac{${Math.abs(c)}}{x^2}$ is positive for every nonzero $x$, so Quantity B is ${c > 0 ? 'greater' : 'less'} than Quantity A whatever the sign of $x$. ${qcEnd(answer)}`;
        k = [0, c];
      } else {
        // A = x/(x+1), B = (x+1)/(x+2): B - A = 1/((x+1)(x+2))
        const region = rng.pick(['pos', 'mid', 'neg-big'] as const);
        if (region === 'pos') lo = 0;
        else if (region === 'mid') {
          lo = -2;
          hi = -1;
        } else hi = -2;
        info = region === 'pos' ? '$x > 0$' : region === 'mid' ? '$-2 < x < -1$' : '$x < -2$';
        A = '$\\dfrac{x}{x + 1}$';
        B = '$\\dfrac{x + 1}{x + 2}$';
        answer = region === 'mid' ? 'A' : 'B';
        traps.D = 'alg-qc-variable-d';
        if (region === 'mid') traps.B = 'alg-cross-multiply-sign';
        explanation = `Subtract: $\\dfrac{x + 1}{x + 2} - \\dfrac{x}{x + 1} = \\dfrac{(x + 1)^2 - x(x + 2)}{(x + 1)(x + 2)} = \\dfrac{1}{(x + 1)(x + 2)}$.

The sign depends only on the denominator. ${
          region === 'mid'
            ? 'For $-2 < x < -1$, $x + 1 < 0 < x + 2$, so the denominator is negative and Quantity B is less. (Cross-multiplying without checking the signs of the denominators would give the wrong answer here.)'
            : region === 'pos'
              ? 'For $x > 0$ both factors are positive, so the difference is positive.'
              : 'For $x < -2$ both factors are negative, so their product is positive and the difference is positive.'
        } ${qcEnd(answer)}`;
        k = [1, 0];
      }
    } else {
      const a = rng.int(1, 9);
      const b = intExcept(rng, 1, 9, a);
      const rel = rng.pick(d === 1 ? ['y>x', 'x>y', 'none', 'eq'] : ['y>x', 'x>y', 'none', 'none', 'eq', 'eq']);
      info = rel === 'y>x' ? '$y > x$' : rel === 'x>y' ? '$x > y$' : rel === 'eq' ? '$x = y$' : undefined;
      A = `$(x + ${a})(y + ${b})$`;
      B = `$(x + ${b})(y + ${a})$`;
      // A - B = (a - b)(y - x)
      const sgnYX = rel === 'y>x' ? 1 : rel === 'x>y' ? -1 : rel === 'eq' ? 0 : null;
      answer = sgnYX === null ? 'D' : qcCompare((a - b) * sgnYX, 0);
      if (answer === 'D') traps.C = 'alg-same-numbers-equal';
      else if (answer !== 'C') {
        traps.C = 'alg-same-numbers-equal';
        traps.D = 'alg-qc-variable-d';
      } else traps.D = 'alg-qc-variable-d';
      explanation = `Expand both: Quantity A is $${lin([[1, 'xy'], [b, 'x'], [a, 'y'], [a * b, '']])}$ and Quantity B is $${lin([[1, 'xy'], [a, 'x'], [b, 'y'], [a * b, '']])}$. Subtract the common terms $xy$ and $${a * b}$: compare $${lin([[b, 'x'], [a, 'y']])}$ with $${lin([[a, 'x'], [b, 'y']])}$, that is, $${lin([[a - b, 'y']])}$ with $${lin([[a - b, 'x']])}$.

So Quantity A minus Quantity B is $${times(a - b, 'y - x')}$. ${
        sgnYX === null
          ? 'Nothing tells whether $y$ is greater than $x$: with $x = y$ the quantities are equal, and otherwise they differ.'
          : sgnYX === 0
            ? 'With $x = y$ the difference is 0.'
            : `Here $y - x$ is ${sgnYX > 0 ? 'positive' : 'negative'} and $${a - b}$ is ${a - b > 0 ? 'positive' : 'negative'}.`
      } ${qcEnd(answer)}`;
      k = [a, b, sgnYX === null ? 9 : sgnYX];
    }
    return {
      params: { kind, cond, pair, k, lo, hi },
      q: { format: 'qc', info, quantityA: A!, quantityB: B!, answer: answer!, traps: Object.keys(traps).length ? traps : undefined, explanation: explanation! },
    };
  },
  check(q, { kind, cond, pair, k, lo, hi }, rng) {
    if (q.format !== 'qc') return 'wrong format';
    const samples: [number, number][] = [];
    if (kind === 'signs') {
      for (let i = 0; i < 600; i++) {
        const scale = rng.pick([1, 10, 100]);
        let x = 0;
        let y = 0;
        if (cond === 'neg-pos') {
          x = -rng.next() * scale;
          y = rng.next() * scale;
        } else if (cond === 'both-neg') {
          const u = -rng.next() * scale;
          const w = -rng.next() * scale;
          [x, y] = [Math.min(u, w), Math.max(u, w)];
        } else if (cond === 'both-pos') {
          const u = rng.next() * scale;
          const w = rng.next() * scale;
          [x, y] = [Math.min(u, w), Math.max(u, w)];
        } else {
          x = rng.next();
          y = 1 + rng.next() * scale;
        }
        if (x === 0 || y === 0 || x === y) continue;
        samples.push(pairValue(pair!, x, y));
      }
    } else if (kind === 'rational') {
      const xs = [...SPECIAL, ...randomReals(rng, 300)].filter((x) => x !== 0 && x !== -1 && x !== -2 && (lo === null || x > lo) && (hi === null || x < hi));
      for (const x of xs) samples.push(k[0] === 0 ? [1 / x, (x + k[1]) / (x * x)] : [x / (x + 1), (x + 1) / (x + 2)]);
    } else {
      const [a, b, rel] = k;
      for (let i = 0; i < 300; i++) {
        const x = (rng.next() * 2 - 1) * rng.pick([1, 10, 50]);
        let y = (rng.next() * 2 - 1) * rng.pick([1, 10, 50]);
        if (rel === 0) y = x;
        else if (rel === 1 && y <= x) y = x + rng.next() * 5 + 0.01;
        else if (rel === -1 && y >= x) y = x - rng.next() * 5 - 0.01;
        samples.push([(x + a) * (y + b), (x + b) * (y + a)]);
      }
      if (rel === 9) samples.push([(1 + a) * (1 + b), (1 + b) * (1 + a)]);
    }
    const expected = qcSamples(samples, 1e-9);
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

function signReason(pair: SignPair, cond: SignCond, ans: QCChoice): string {
  const r: Record<SignPair, Partial<Record<SignCond, string>>> = {
    'diff-sum': { 'neg-pos': '$y > 0$, so $-y < y$.', 'both-neg': '$y < 0$, so $-y > y$.', 'both-pos': '$y > 0$, so $-y < y$.', 'frac-big': '$y > 0$, so $-y < y$.' },
    'x2y-xy2': { 'neg-pos': '$xy < 0$ and $x - y < 0$, so the difference is positive.', 'both-neg': '$xy > 0$ and $x - y < 0$, so the difference is negative.', 'both-pos': '$xy > 0$ and $x - y < 0$, so the difference is negative.', 'frac-big': '$xy > 0$ and $x - y < 0$, so the difference is negative.' },
    ratios: { 'neg-pos': 'both are negative, and which one is farther from 0 depends on whether $|x|$ or $|y|$ is larger, which the condition does not say.', 'both-neg': '$|x| > |y|$, so $\\frac{x}{y} > 1 > \\frac{y}{x}$.', 'both-pos': '$x < y$, so $\\frac{x}{y} < 1 < \\frac{y}{x}$.', 'frac-big': '$x < y$, so $\\frac{x}{y} < 1 < \\frac{y}{x}$.' },
    'prod-sum': { 'neg-pos': '$xy$ is negative, and $x + y$ can be negative or positive.', 'both-neg': '$xy > 0$ while $x + y < 0$.', 'both-pos': 'both are positive, and either can be larger.', 'frac-big': 'since $x < 1$, $xy < y < x + y$.' },
    squares: { 'neg-pos': 'nothing says whether $|x|$ or $|y|$ is larger.', 'both-neg': '$x < y < 0$ means $|x| > |y|$.', 'both-pos': '$0 < x < y$ means $|x| < |y|$.', 'frac-big': '$|x| < 1 < |y|$.' },
    'square-sum': { 'neg-pos': '$xy < 0$.', 'both-neg': '$xy > 0$.', 'both-pos': '$xy > 0$.', 'frac-big': '$xy > 0$.' },
  };
  void ans;
  return r[pair][cond] ?? '';
}

/* ================================================================== 4. Words to algebra (QC) */

interface WordParams {
  kind: 'order' | 'older-by' | 'twice' | 'percent' | 'more-than';
  k: number[];
}

const NAMES = [
  ['Ana', 'Ben'],
  ['Carla', 'Dev'],
  ['Elena', 'Farid'],
  ['Grace', 'Hugo'],
  ['Ines', 'Jonah'],
  ['Kemal', 'Lena'],
];

const translateQC: Template<WordParams> = {
  id: 'alg.qc-algebra.translate-qc',
  skill: 'alg.qc-algebra',
  format: 'qc',
  style: 'translate words into algebra, then compare',
  generate(rng, d) {
    const kind: WordParams['kind'] = rng.pick(d === 1 ? ['order', 'older-by', 'percent'] : ['order', 'older-by', 'twice', 'percent', 'more-than']);
    const [P, Q] = rng.pick(NAMES);
    let info: string;
    let A: string;
    let B: string;
    let answer: QCChoice;
    const traps: QCQuestion['traps'] = {};
    let explanation: string;
    let k: number[];
    if (kind === 'order') {
      const m = rng.pick([2, 3]);
      const bounded = rng.chance(0.45);
      info = bounded ? `${P} is younger than ${Q}, and ${Q} is less than ${m === 2 ? 'twice' : 'three times'} as old as ${P}.` : `${P} is younger than ${Q}.`;
      A = `${m === 2 ? 'Twice' : 'Three times'} ${P}'s age`;
      B = `${Q}'s age`;
      answer = bounded ? 'A' : 'D';
      if (answer === 'D') {
        traps.A = 'tested-one-value';
        traps.B = 'tested-one-value';
      } else traps.D = 'alg-qc-variable-d';
      explanation = `Let $p$ be ${P}'s age and $q$ be ${Q}'s age. The information says $p < q$${bounded ? ` and $q < ${m}p$` : ''}. Compare $${m}p$ with $q$.

${
        bounded
          ? `The second statement is exactly $q < ${m}p$, so Quantity A is greater.`
          : `With $p = 6$ and $q = 10$: $${m}p = ${6 * m} > 10$. With $p = 4$ and $q = ${4 * m + 5}$: $${m}p = ${4 * m} < ${4 * m + 5}$. Both pairs satisfy $p < q$.`
      } ${qcEnd(answer)}`;
      k = [m, bounded ? 1 : 0];
    } else if (kind === 'older-by') {
      const dd = rng.int(3, 12);
      const shift = rng.pick([dd, dd, dd + 2, dd - 1]);
      info = `${Q} is ${dd} years older than ${P}.`;
      A = `${P}'s age ${shift} years from now`;
      B = `${Q}'s age now`;
      answer = qcCompare(shift, dd);
      if (answer !== 'D') traps.D = 'alg-qc-variable-d';
      explanation = `Let $p$ be ${P}'s age now. Then ${Q}'s age now is $p + ${dd}$, and ${P}'s age ${shift} years from now is $p + ${shift}$.

Subtract $p$ from both: compare ${shift} with ${dd}. ${qcEnd(answer)}`;
      k = [dd, shift];
    } else if (kind === 'twice') {
      const t = rng.int(3, 10);
      const variant = rng.pick(['future', 'plus']);
      info = `${Q} is twice as old as ${P}.`;
      if (variant === 'future') {
        A = `Twice ${P}'s age ${t} years from now`;
        B = `${Q}'s age ${t} years from now`;
        answer = 'A';
        traps.C = 'alg-translation-slip';
        traps.D = 'alg-qc-variable-d';
        explanation = `Let $p$ be ${P}'s age now, so ${Q} is $2p$. In ${t} years: Quantity A is $2(p + ${t}) = 2p + ${2 * t}$ and Quantity B is $2p + ${t}$.

The difference is ${t} years, always. ${qcEnd(answer)}`;
      } else {
        A = `${P}'s age plus ${t}`;
        B = `${Q}'s age`;
        answer = 'D';
        traps.C = 'tested-one-value';
        explanation = `Let $p$ be ${P}'s age, so ${Q}'s age is $2p$. Compare $p + ${t}$ with $2p$, that is (subtracting $p$), ${t} with $p$.

${P}'s age could be less than ${t}, equal to it, or greater. ${qcEnd(answer)}`;
      }
      k = [t, variant === 'future' ? 1 : 0];
    } else if (kind === 'percent') {
      const n = rng.pick([100, 200, 50, 300, 100]);
      const r = new Frac(n, 100);
      const bOpt = rng.pick(['same', 'same', 'x2', 'big']);
      const Bcoef = bOpt === 'same' ? r : bOpt === 'x2' ? frac(1) : r.mul(2);
      info = '$x > 0$';
      A = `$x$ percent of $${n}x$`;
      const coefTex = (c: Frac) => (c.eq(1) ? '' : c.isInt() ? `${c.n}` : `\\frac{${c.n}}{${c.d}}`);
      B = `$${coefTex(Bcoef)}x^2$`;
      answer = qcCompare(r, Bcoef);
      const wrong = qcCompare(new Frac(n), Bcoef); // x% read as x
      if (wrong !== answer) traps[wrong] = 'alg-percent-as-number';
      if (answer !== 'D') traps.D = 'alg-qc-variable-d';
      explanation = `"$x$ percent of $${n}x$" means $\\dfrac{x}{100} \\cdot ${n}x = ${coefTex(r)}x^2$.

Compare $${coefTex(r)}x^2$ with $${coefTex(Bcoef)}x^2$: since $x^2 > 0$, only the coefficients matter. ${qcEnd(answer)}

Reading "$x$ percent" as $x$ (instead of $\\frac{x}{100}$) gives $${n}x^2$.`;
      k = [n, Bcoef.n, Bcoef.d];
    } else {
      // more-than: k more teachers than students, t teachers; total vs 2t - k
      const kk = rng.int(4, 20);
      const ctx = rng.pick([
        ['teachers', 'students', 'meeting'],
        ['members', 'guests', 'club dinner'],
        ['adults', 'children', 'concert'],
      ]);
      const bOpt = rng.pick(['right', 'right', 'wrong-sign', 'double']);
      info = `At a ${ctx[2]}, there are ${kk} more ${ctx[0]} than ${ctx[1]}. The number of ${ctx[0]} is $t$.`;
      A = `The total number of ${ctx[0]} and ${ctx[1]} at the ${ctx[2]}`;
      B = bOpt === 'right' ? `$2t - ${kk}$` : bOpt === 'wrong-sign' ? `$2t + ${kk}$` : `$2t$`;
      answer = bOpt === 'right' ? 'C' : 'B';
      if (answer === 'C') traps.A = 'alg-translation-direction';
      else traps.C = 'alg-translation-direction';
      traps.D = 'alg-qc-variable-d';
      explanation = `There are ${kk} FEWER ${ctx[1]} than ${ctx[0]}, so the number of ${ctx[1]} is $t - ${kk}$. The total is $t + (t - ${kk}) = 2t - ${kk}$.

Compare $2t - ${kk}$ with ${B}. ${qcEnd(answer)}

Writing the ${ctx[1]} as $t + ${kk}$ reverses the relationship.`;
      k = [kk, bOpt === 'right' ? 0 : bOpt === 'wrong-sign' ? 1 : 2];
    }
    return {
      params: { kind, k: k! },
      q: { format: 'qc', info: info!, quantityA: A!, quantityB: B!, answer: answer!, traps: Object.keys(traps).length ? traps : undefined, explanation: explanation! },
    };
  },
  check(q, { kind, k }, rng) {
    if (q.format !== 'qc') return 'wrong format';
    const samples: [number, number][] = [];
    for (let i = 0; i < 400; i++) {
      const p = 0.5 + rng.next() * rng.pick([5, 30, 80]);
      if (kind === 'order') {
        const [m, bounded] = k;
        // q in (p, m p) if bounded, else any q > p
        const qv = bounded ? p + (m * p - p) * (0.001 + 0.998 * rng.next()) : p + rng.next() * rng.pick([0.5, 5, 50, 200]);
        samples.push([m * p, qv]);
      } else if (kind === 'older-by') {
        const [dd, shift] = k;
        samples.push([p + shift, p + dd]);
      } else if (kind === 'twice') {
        const [t, future] = k;
        samples.push(future ? [2 * (p + t), 2 * p + t] : [p + t, 2 * p]);
      } else if (kind === 'percent') {
        const [n, bn, bd] = k;
        const x = p;
        samples.push([(x / 100) * (n * x), (bn / bd) * x * x]);
      } else {
        const [kk, bOpt] = k;
        const t = kk + 1 + Math.floor(rng.next() * 100);
        const others = t - kk;
        samples.push([t + others, bOpt === 0 ? 2 * t - kk : bOpt === 1 ? 2 * t + kk : 2 * t]);
      }
    }
    const expected = qcSamples(samples, 1e-9);
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

export const comparisonTemplates = [thresholdQC, squareQC, signCasesQC, translateQC];
