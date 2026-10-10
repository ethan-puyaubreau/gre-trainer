import { flaggedChoices, qcCompare, textChoices } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { lin, num, poly } from '../../../engine/tex';
import type { Difficulty, QCChoice, QCQuestion, Template } from '../../../engine/types';
import {
  N,
  SPECIAL,
  V,
  add,
  allowedValues,
  evalEx,
  lx,
  mul,
  neg,
  polyEx,
  pow,
  qcEnd,
  qcSamples,
  randomReals,
  sameFunction,
  texEx,
  div,
  type Ex,
} from './util';

/* ================================================================== 1. Identities reveal the target (QC) */

type IdVariant = 'factored' | 'sumsq' | 'average' | 'circle' | 'recip';

interface IdParams {
  variant: IdVariant;
  /** factored: [alpha, beta, p, q, N]; sumsq: [sign, S, P]; average: [a, bKind]; circle: [S, s, cond]; recip: [s] */
  nums: number[];
  /** Quantity B as an expression in z (average) or a plain number. */
  B: number;
}

const ID_VARIANTS: Record<Difficulty, IdVariant[]> = {
  1: ['factored', 'average', 'sumsq'],
  2: ['factored', 'average', 'sumsq', 'circle', 'recip'],
  3: ['factored', 'sumsq', 'circle', 'recip', 'average'],
};

function pickB(rng: { chance(p: number): boolean; int(a: number, b: number): number; pick<T>(x: readonly T[]): T }, truth: number, trapVals: number[]): number {
  if (rng.chance(0.35)) return truth;
  const traps = trapVals.filter((t) => t !== truth);
  if (traps.length && rng.chance(0.5)) return rng.pick(traps);
  let b: number;
  do b = truth + rng.pick([-3, -2, -1, 1, 2, 3]);
  while (traps.includes(b));
  return b;
}

const identityQC: Template<IdParams> = {
  id: 'alg.expressions.identity-qc',
  skill: 'alg.expressions',
  format: 'qc',
  style: 'use an identity to get a value without solving',
  generate(rng, d) {
    const variant = rng.pick(ID_VARIANTS[d]);
    let info: string;
    let A: string;
    let Btex: string;
    let B = 0;
    let answer: QCChoice;
    let traps: QCQuestion['traps'] = {};
    let explanation: string;
    let nums: number[];

    if (variant === 'factored') {
      const ab = rng.pick(d === 1 ? [[1, 1], [2, 1]] : d === 2 ? [[1, 1], [2, 1], [1, 2], [3, 1]] : [[2, 1], [3, 1], [1, 3], [3, 2], [2, 3]]);
      const [al, be] = ab;
      const [p, q] = rng.sample(d === 1 ? [2, 3] : [2, 3, 4, 5], 2);
      const T = rng.int(2, d === 3 ? 20 : 12);
      const Nn = p * q * T;
      const f1 = `(${lin([[p * al, 'x'], [-p * be, 'y']])})`;
      const f2 = `(${lin([[q * al, 'x'], [q * be, 'y']])})`;
      const minusFirst = rng.chance(0.5);
      info = `$${minusFirst ? f1 + f2 : f2 + f1} = ${num(Nn)}$`;
      const target = lin([[al * al, 'x^{2}'], [-be * be, 'y^{2}']]);
      A = `$${target}$`;
      const trapVals = [Nn / p, Nn / q, Nn];
      B = pickB(rng, T, trapVals);
      Btex = `$${num(B)}$`;
      answer = qcCompare(T, B);
      if (answer !== 'D') traps.D = 'alg-qc-unsolvable-d';
      for (const tv of [Nn / p, Nn / q]) {
        const ta = qcCompare(tv, B);
        if (ta !== answer && !traps[ta]) traps[ta] = 'alg-dropped-factor';
      }
      const pair = `(${lin([[al, 'x'], [-be, 'y']])})(${lin([[al, 'x'], [be, 'y']])})`;
      explanation = `One equation cannot give both $x$ and $y$, but it does not need to: look for the expression in Quantity A. Factor each parenthesis:

$$${f1}${f2} = ${p}(${lin([[al, 'x'], [-be, 'y']])}) \\cdot ${q}(${lin([[al, 'x'], [be, 'y']])}) = ${p * q}${pair}$$

and $${pair} = ${target}$ (difference of squares). So $${p * q}(${target}) = ${num(Nn)}$, which gives $${target} = ${T}$.

Compare $${T}$ with $${num(B)}$. ${qcEnd(answer)}

Pulling out only one of the factors $${p}$ and $${q}$ gives $${num(Nn / q)}$ or $${num(Nn / p)}$ instead of $${T}$.`;
      nums = [al, be, p, q, Nn];
    } else if (variant === 'sumsq') {
      const sign = d === 1 ? 1 : rng.pick([1, -1]);
      let s: number;
      let P: number;
      do {
        s = rng.int(2, d === 3 ? 9 : 7);
        P = rng.int(-12, 12);
      } while (P === 0 || (sign === 1 ? s * s - 4 * P < 1 : s * s + 4 * P < 1));
      const S = s * s;
      const T = S - 2 * sign * P;
      const halfTrap = S - sign * P;
      B = pickB(rng, T, [halfTrap, S]);
      info = `$(x ${sign > 0 ? '+' : '-'} y)^2 = ${S}$ and $xy = ${num(P)}$`;
      A = `$x^2 + y^2$`;
      Btex = `$${num(B)}$`;
      answer = qcCompare(T, B);
      const t1 = qcCompare(halfTrap, B);
      if (t1 !== answer) traps[t1] = 'alg-middle-term-half';
      const t2 = qcCompare(S, B);
      if (t2 !== answer && !traps[t2]) traps[t2] = 'square-of-sum';
      if (answer !== 'D' && !traps.D) traps.D = 'alg-qc-unsolvable-d';
      explanation = `Expand the square: $(x ${sign > 0 ? '+' : '-'} y)^2 = x^2 ${sign > 0 ? '+' : '-'} 2xy + y^2$. So $x^2 + y^2 = ${S} ${sign > 0 ? '-' : '+'} 2(${num(P)}) = ${num(T)}$. There is no need to find $x$ and $y$.

Compare $${num(T)}$ with $${num(B)}$. ${qcEnd(answer)}

The middle term is $2xy$, not $xy$: using $xy$ gives $${num(halfTrap)}$, and dropping it gives $${S}$.`;
      nums = [sign, S, P];
    } else if (variant === 'average') {
      const a = rng.int(1, d === 1 ? 4 : 6);
      // B kinds: 0 -> z^2 (A), 1 -> z^2 + a^2 (C), 2 -> z^2 + 2a^2 (B), 3 -> 2z^2 (D)
      const kind = rng.pick(d === 1 ? [0, 1, 0, 1, 2] : [0, 1, 2, 3, 1, 3]);
      const a2 = a * a;
      Btex = kind === 0 ? '$z^2$' : kind === 1 ? `$z^2 + ${a2}$` : kind === 2 ? `$z^2 + ${2 * a2}$` : '$2z^2$';
      answer = (['A', 'C', 'B', 'D'] as QCChoice[])[kind];
      info = `$x = (z - ${a})^2$ and $y = (z + ${a})^2$`;
      A = 'The average (arithmetic mean) of $x$ and $y$';
      if (answer !== 'D') traps.D = 'alg-qc-variable-d';
      else traps.A = 'tested-one-value';
      if (kind === 0) traps.C = 'square-of-sum';
      const cmp =
        kind === 0
          ? `$z^2 + ${a2}$ is always ${a2} more than $z^2$`
          : kind === 1
            ? 'the two expressions are identical'
            : kind === 2
              ? `$z^2 + ${a2}$ is always ${a2} less than $z^2 + ${2 * a2}$`
              : `$(z^2 + ${a2}) - 2z^2 = ${a2} - z^2$, which is positive for $z = 0$ and negative for $z = ${a + 1}$`;
      explanation = `Expand both squares: $x = z^2 - ${2 * a}z + ${a2}$ and $y = z^2 + ${2 * a}z + ${a2}$. The middle terms cancel when you add: $x + y = 2z^2 + ${2 * a2}$, so the average is $z^2 + ${a2}$.

Compare $z^2 + ${a2}$ with ${Btex}: ${cmp}. ${qcEnd(answer)}`;
      nums = [a, kind];
    } else if (variant === 'circle') {
      const S = rng.pick([10, 13, 17, 20, 25, 29, 36, 50]);
      const s = rng.pick([1, -1]);
      const cond = rng.pick(d === 2 ? [0, 0, 1, 2] : [0, 1, 2]); // 0 none, 1 xy > 0, 2 xy < 0
      const condText = cond === 0 ? '' : cond === 1 ? ', $x > 0$, and $y > 0$' : ', $x > 0$, and $y < 0$';
      info = `$x^2 + y^2 = ${S}$${condText}`.replace(/^(\$[^$]*\$), \$x > 0\$/, '$1, $x > 0$');
      if (cond !== 0) info = `$x^2 + y^2 = ${S}$, $x > 0$, and $y ${cond === 1 ? '>' : '<'} 0$`;
      A = `$(x ${s > 0 ? '+' : '-'} y)^2$`;
      Btex = `$${S}$`;
      B = S;
      // A - B = 2 s xy
      answer = cond === 0 ? 'D' : s * (cond === 1 ? 1 : -1) > 0 ? 'A' : 'B';
      traps = { C: 'square-of-sum' };
      if (answer === 'D') traps.A = 'tested-one-value';
      explanation = `Expand: $(x ${s > 0 ? '+' : '-'} y)^2 = x^2 + y^2 ${s > 0 ? '+' : '-'} 2xy = ${S} ${s > 0 ? '+' : '-'} 2xy$. So the comparison is $${s > 0 ? '' : '-'}2xy$ versus 0, and only the sign of $xy$ matters.

${
        cond === 0
          ? `Nothing fixes the sign of $xy$: with $x = y = \\sqrt{${S / 2 === Math.floor(S / 2) ? S / 2 : `${S}/2`}}$ it is positive, with $x = -y$ it is negative.`
          : cond === 1
            ? 'Here $x$ and $y$ are both positive, so $xy > 0$.'
            : 'Here $x > 0$ and $y < 0$, so $xy < 0$.'
      } ${qcEnd(answer)}

$(x ${s > 0 ? '+' : '-'} y)^2 \\ne x^2 + y^2$: the middle term $2xy$ is what decides.`;
      nums = [S, s, cond];
    } else {
      const s = rng.pick([3, 4, 5, 6, -3, -4, -5]);
      const T = s * s - 2;
      B = pickB(rng, T, [s * s, s * s + 2]);
      info = `$x + \\dfrac{1}{x} = ${num(s)}$`;
      A = '$x^2 + \\dfrac{1}{x^2}$';
      Btex = `$${num(B)}$`;
      answer = qcCompare(T, B);
      const t1 = qcCompare(s * s, B);
      if (t1 !== answer) traps[t1] = 'square-of-sum';
      if (!traps.D) traps.D = 'alg-qc-unsolvable-d';
      explanation = `Square the given equation: $\\left(x + \\dfrac{1}{x}\\right)^2 = x^2 + 2 \\cdot x \\cdot \\dfrac{1}{x} + \\dfrac{1}{x^2} = x^2 + 2 + \\dfrac{1}{x^2}$.

So $x^2 + 2 + \\dfrac{1}{x^2} = ${s * s}$ and Quantity A is $${s * s} - 2 = ${T}$. Compare $${T}$ with $${num(B)}$. ${qcEnd(answer)}

The cross term is $2 \\cdot x \\cdot \\frac{1}{x} = 2$; forgetting it gives $${s * s}$.`;
      nums = [s];
    }
    if (traps && Object.keys(traps).length === 0) traps = undefined;
    if (traps) delete traps[answer];
    return {
      params: { variant, nums, B },
      q: { format: 'qc', info, quantityA: A, quantityB: Btex, answer, traps, explanation },
    };
  },
  check(q, { variant, nums, B }, rng) {
    if (q.format !== 'qc') return 'wrong format';
    const samples: [number, number][] = [];
    if (variant === 'factored') {
      const [al, be, p, qq, Nn] = nums;
      const f = (x: number, y: number) => (p * al * x - p * be * y) * (qq * al * x + qq * be * y) - Nn;
      for (const y of [...randomReals(rng, 40), 0, 1, -2, 3.5]) {
        // f is negative where the first factor vanishes and grows without bound: bisect for x.
        let lo = (be * y) / al;
        let hi = lo + 1000;
        for (let i = 0; i < 200; i++) {
          const mid = (lo + hi) / 2;
          if (f(mid, y) < 0) lo = mid;
          else hi = mid;
        }
        const x = (lo + hi) / 2;
        samples.push([al * al * x * x - be * be * y * y, B]);
      }
    } else if (variant === 'sumsq') {
      const [sign, S, P] = nums;
      for (const r of [Math.sqrt(S), -Math.sqrt(S)]) {
        // sign 1: x + y = r, xy = P. sign -1: x - y = r, x(-y) = -P.
        const sum = r;
        const prod = sign === 1 ? P : -P;
        const disc = sum * sum - 4 * prod;
        const x = (sum + Math.sqrt(disc)) / 2;
        const w = (sum - Math.sqrt(disc)) / 2;
        const y = sign === 1 ? w : -w;
        if (Math.abs(x * y - P) > 1e-6) return 'bad sample';
        samples.push([x * x + y * y, B]);
      }
    } else if (variant === 'average') {
      const [a, kind] = nums;
      for (const z of allowedValues(rng, () => true, 100)) {
        const x = (z - a) ** 2;
        const y = (z + a) ** 2;
        const b = kind === 0 ? z * z : kind === 1 ? z * z + a * a : kind === 2 ? z * z + 2 * a * a : 2 * z * z;
        samples.push([(x + y) / 2, b]);
      }
    } else if (variant === 'circle') {
      const [S, s, cond] = nums;
      for (let i = 0; i < 400; i++) {
        const t = rng.next() * 2 * Math.PI;
        const x = Math.sqrt(S) * Math.cos(t);
        const y = Math.sqrt(S) * Math.sin(t);
        if (cond === 1 && !(x > 0 && y > 0)) continue;
        if (cond === 2 && !(x > 0 && y < 0)) continue;
        samples.push([(x + s * y) ** 2, S]);
      }
    } else {
      const [s] = nums;
      for (const sg of [1, -1]) {
        const x = (s + sg * Math.sqrt(s * s - 4)) / 2;
        samples.push([x * x + 1 / (x * x), B]);
      }
    }
    const expected = qcSamples(samples);
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

/* ================================================================== 2. Expand special products (MCS) */

/** Linear form p·x + q·y (two variables) or p·x + q (one variable). */
type Lin = [number, number];
interface ProdTerm {
  c: number;
  l1: Lin;
  l2: Lin;
}
type Quad = [number, number, number];

interface ExpandParams {
  twoVar: boolean;
  terms: ProdTerm[];
  options: Quad[];
}

const linTex = ([p, q]: Lin, two: boolean) => lin([[p, 'x'], [q, two ? 'y' : '']]);
const quadTex = ([a, b, c]: Quad, two: boolean) =>
  two ? lin([[a, 'x^{2}'], [b, 'xy'], [c, 'y^{2}']]) : poly([a, b, c]);
const termTex = (t: ProdTerm, two: boolean, first: boolean) => {
  const same = t.l1[0] === t.l2[0] && t.l1[1] === t.l2[1];
  const body = same ? `(${linTex(t.l1, two)})^2` : `(${linTex(t.l1, two)})(${linTex(t.l2, two)})`;
  const k = Math.abs(t.c);
  const coef = k === 1 ? '' : `${k}`;
  if (first) return (t.c < 0 ? '-' : '') + coef + body;
  return (t.c < 0 ? ' - ' : ' + ') + coef + body;
};
const prodQuad = (t: ProdTerm): Quad => [t.l1[0] * t.l2[0], t.l1[0] * t.l2[1] + t.l1[1] * t.l2[0], t.l1[1] * t.l2[1]];
const addQ = (a: Quad, b: Quad): Quad => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scaleQ = (a: Quad, k: number): Quad => [a[0] * k, a[1] * k, a[2] * k];
const qKey = (a: Quad) => a.join(',');

const expandMCS: Template<ExpandParams> = {
  id: 'alg.expressions.expand-mcs',
  skill: 'alg.expressions',
  format: 'mcs',
  style: 'expand and simplify squares and products',
  generate(rng, d) {
    const twoVar = d === 3 ? rng.chance(0.6) : d === 2 ? rng.chance(0.25) : false;
    let terms: ProdTerm[];
    let R: Quad;
    do {
      const p1 = d === 1 ? 1 : rng.pick([1, 1, 2, 3]);
      const q1 = rng.int(1, 6) * rng.sign();
      const t1: ProdTerm = { c: d === 3 && rng.chance(0.3) ? 2 : 1, l1: [p1, q1], l2: [p1, q1] };
      const kind = rng.pick(['square', 'conj', 'general'] as const);
      const p2 = d === 1 ? 1 : rng.pick([1, 1, 2, 3]);
      const q2 = rng.int(1, 6) * rng.sign();
      const l2: Lin = [p2, q2];
      const l3: Lin = kind === 'square' ? [p2, q2] : kind === 'conj' ? [p2, -q2] : [d === 1 ? 1 : rng.pick([1, 2]), rng.int(1, 6) * rng.sign()];
      const t2: ProdTerm = { c: rng.chance(0.75) ? -1 : 1, l1: l2, l2: l3 };
      terms = [t1, t2];
      R = addQ(scaleQ(prodQuad(t1), t1.c), scaleQ(prodQuad(t2), t2.c));
    } while (R.filter((x) => x !== 0).length < 2 || terms[1].l1.join() === terms[0].l1.join());

    // Mistaken expansions.
    const sqNoMiddle = (t: ProdTerm): Quad => {
      const same = t.l1.join() === t.l2.join();
      return same ? [t.l1[0] ** 2, 0, t.l1[1] ** 2] : prodQuad(t);
    };
    const sqHalfMiddle = (t: ProdTerm): Quad => {
      const same = t.l1.join() === t.l2.join();
      return same ? [t.l1[0] ** 2, t.l1[0] * t.l1[1], t.l1[1] ** 2] : prodQuad(t);
    };
    const minusFirstOnly = (t: ProdTerm): Quad => {
      const p = prodQuad(t);
      return t.c < 0 ? [-Math.abs(t.c) * p[0], Math.abs(t.c) * p[1], Math.abs(t.c) * p[2]] : scaleQ(p, t.c);
    };
    const wrongs: { v: Quad; trap?: string }[] = [];
    const combine = (f: (t: ProdTerm) => Quad, scaled = true) =>
      terms.map((t) => (scaled ? scaleQ(f(t), t.c) : f(t))).reduce(addQ);
    wrongs.push({ v: combine(sqNoMiddle), trap: 'square-of-sum' });
    if (terms[1].c < 0) wrongs.push({ v: addQ(scaleQ(prodQuad(terms[0]), terms[0].c), minusFirstOnly(terms[1])), trap: 'alg-distribute-minus' });
    wrongs.push({ v: combine(sqHalfMiddle), trap: 'alg-middle-term-half' });
    const fillers: Quad[] = [
      [R[0], -R[1], R[2]],
      [R[0], R[1], -R[2]],
      [R[0], 2 * R[1], R[2]],
      [R[0] + 1, R[1], R[2]],
      [R[0], R[1], R[2] + (R[2] > 0 ? -2 : 2)],
      [R[0], R[1] + 4, R[2]],
      [R[0], R[1] - 4, R[2]],
      [R[0], R[1], 2 * R[2]],
      [R[0] - 1, R[1], R[2]],
    ];
    const seen = new Set([qKey(R)]);
    const chosen: { v: Quad; trap?: string }[] = [];
    for (const w of [...wrongs, ...rng.shuffle(fillers).map((v) => ({ v }))]) {
      if (chosen.length === 4) break;
      if (seen.has(qKey(w.v)) || w.v.every((x) => x === 0)) continue;
      seen.add(qKey(w.v));
      chosen.push(w);
    }
    const { choices, answer } = textChoices(
      rng,
      `$${quadTex(R, twoVar)}$`,
      chosen.map((w) => ({ text: `$${quadTex(w.v, twoVar)}$`, ...(w.trap ? { trap: w.trap } : {}) })),
    );
    const options: Quad[] = choices.map((c) => {
      if (c.text === `$${quadTex(R, twoVar)}$`) return R;
      return chosen.find((w) => `$${quadTex(w.v, twoVar)}$` === c.text)!.v;
    });
    const expr = terms.map((t, i) => termTex(t, twoVar, i === 0)).join('');
    const steps = terms
      .map((t) => {
        const same = t.l1.join() === t.l2.join();
        const lhs = same ? `(${linTex(t.l1, twoVar)})^2` : `(${linTex(t.l1, twoVar)})(${linTex(t.l2, twoVar)})`;
        return `$${lhs} = ${quadTex(prodQuad(t), twoVar)}$`;
      })
      .join(' and ');
    const sq = terms.find((t) => t.l1.join() === t.l2.join())!;
    const neg2 = terms[1].c < 0;
    return {
      params: { twoVar, terms, options },
      q: {
        format: 'mcs',
        stem: `Which of the following is equivalent to $${expr}$ for all ${twoVar ? 'numbers $x$ and $y$' : 'values of $x$'}?`,
        choices,
        answer,
        explanation: `Expand each product: ${steps}.

${neg2 ? `Subtract the second result, changing the sign of every one of its terms` : 'Combine like terms'}: the result is $${quadTex(R, twoVar)}$.

Watch the middle term of a square: $(${linTex(sq.l1, twoVar)})^2$ has the middle term $2 \\cdot ${num(sq.l1[0])}x \\cdot ${
          sq.l1[1] < 0 ? `(${num(sq.l1[1])}${twoVar ? 'y' : ''})` : `${num(sq.l1[1])}${twoVar ? 'y' : ''}`
        }$, which is easy to drop.`,
      },
    };
  },
  check(q, { twoVar, terms, options }, rng) {
    if (q.format !== 'mcs') return 'wrong format';
    const pts = Array.from({ length: 6 }, () => [rng.next() * 10 - 5, twoVar ? rng.next() * 10 - 5 : 1]);
    const target = (x: number, y: number) => terms.reduce((s, t) => s + t.c * (t.l1[0] * x + t.l1[1] * y) * (t.l2[0] * x + t.l2[1] * y), 0);
    const matches = options.flatMap((o, i) => (pts.every(([x, y]) => Math.abs(o[0] * x * x + o[1] * x * y + o[2] * y * y - target(x, y)) < 1e-7) ? [i] : []));
    if (options.some((o, i) => q.choices[i].text !== `$${quadTex(o, twoVar)}$`)) return 'choice text mismatch';
    if (matches.length !== 1) return `${matches.length} matching choices`;
    return matches[0] === q.answer ? null : `expected choice ${matches[0]}`;
  },
};

/* ================================================================== 3. Factor out a common power (NE) */

interface PowParams {
  kind: 'value' | 'k' | 'ratio' | 'square';
  b: number;
  v: number;
  m: number;
  n: number;
  sign: 1 | -1;
}

const powerFactorNE: Template<PowParams> = {
  id: 'alg.expressions.power-factor-ne',
  skill: 'alg.expressions',
  format: 'ne',
  style: 'factor out a common power to evaluate',
  generate(rng, d) {
    const kind = rng.pick(d === 1 ? (['value', 'k'] as const) : d === 2 ? (['value', 'k', 'square'] as const) : (['value', 'ratio', 'square'] as const));
    const b = rng.pick(kind === 'square' ? [2, 3] : d === 1 ? [2, 3] : [2, 3, 5]);
    let answer: number;
    let stem: string;
    let explanation: string;
    let traps: { value: Frac; trap: string }[] = [];
    let v = 0;
    let m = 0;
    let n = 0;
    let sign: 1 | -1 = -1;
    if (kind === 'value') {
      do v = rng.int(3, d === 1 ? 12 : 20);
      while (Math.log(v) / Math.log(b) === Math.round(Math.log(v) / Math.log(b)));
      m = rng.int(1, b === 5 ? 2 : 3);
      n = d === 3 ? rng.int(0, m - 1) : 0;
      sign = d === 1 ? -1 : rng.pick([1, -1]);
      answer = v * (b ** m + sign * b ** n);
      const e2 = n === 0 ? `${b}^{x}` : `${b}^{x + ${n}}`;
      stem = `If $${b}^{x} = ${v}$, what is the value of $${b}^{x + ${m}} ${sign < 0 ? '-' : '+'} ${e2}$?`;
      const inside = `${b}^{${m}} ${sign < 0 ? '-' : '+'} ${n === 0 ? '1' : `${b}^{${n}}`}`;
      explanation = `Factor out $${b}^{x}$: $${b}^{x + ${m}} ${sign < 0 ? '-' : '+'} ${e2} = ${b}^{x}(${inside}) = ${v}(${b ** m + sign * b ** n})$.

So the value is $${num(answer)}$. You never need $x$ itself (it is not an integer).`;
      if (sign < 0 && n === 0) {
        explanation += ` Note that $${b}^{x + ${m}} - ${b}^{x} \\ne ${b}^{${m}}$: exponents subtract only when powers are divided.`;
        traps = [{ value: frac(b ** m), trap: 'alg-power-difference' }];
      }
    } else if (kind === 'k') {
      m = rng.int(1, 3);
      sign = rng.pick([1, -1]);
      answer = b ** m + sign;
      stem = `If $${b}^{n + ${m}} ${sign < 0 ? '-' : '+'} ${b}^{n} = k \\cdot ${b}^{n}$ for every integer $n$, what is the value of $k$?`;
      explanation = `Factor $${b}^{n}$ out of both terms: $${b}^{n + ${m}} ${sign < 0 ? '-' : '+'} ${b}^{n} = ${b}^{n} \\cdot ${b}^{${m}} ${sign < 0 ? '-' : '+'} ${b}^{n} \\cdot 1 = ${b}^{n}(${b ** m} ${sign < 0 ? '-' : '+'} 1)$.

So $k = ${answer}$.`;
      traps = [{ value: frac(b ** m), trap: 'alg-factor-dropped-one' }];
    } else if (kind === 'ratio') {
      m = rng.int(2, 3);
      sign = -1;
      // (b^{n+m} - b^n) / (b^{n+1} - b^n) = (b^m - 1)/(b - 1)
      answer = (b ** m - 1) / (b - 1);
      stem = `For every integer $n$, what is the value of $\\dfrac{${b}^{n + ${m}} - ${b}^{n}}{${b}^{n + 1} - ${b}^{n}}$?`;
      explanation = `Factor $${b}^{n}$ out of the numerator and the denominator: $\\dfrac{${b}^{n}(${b}^{${m}} - 1)}{${b}^{n}(${b} - 1)} = \\dfrac{${b ** m - 1}}{${b - 1}} = ${answer}$.

Do not subtract exponents across a difference: $${b}^{n + ${m}} - ${b}^{n}$ is not $${b}^{${m}}$.`;
      traps = [{ value: frac(b ** (m - 1)), trap: 'alg-power-difference' }];
    } else {
      do v = rng.int(3, 15);
      while (Math.log(v) / Math.log(b) === Math.round(Math.log(v) / Math.log(b)));
      m = 1;
      answer = v * v + b * v;
      stem = `If $${b}^{x} = ${v}$, what is the value of $${b * b}^{x} + ${b}^{x + 1}$?`;
      explanation = `Rewrite both terms with $${b}^{x}$: $${b * b}^{x} = (${b}^{2})^{x} = (${b}^{x})^{2} = ${v}^2 = ${v * v}$, and $${b}^{x + 1} = ${b} \\cdot ${b}^{x} = ${b * v}$.

The value is $${v * v} + ${b * v} = ${answer}$. Note that $${b * b}^{x}$ is $(${b}^{x})^2$, not $${b} \\cdot ${b}^{x}$.`;
      traps = [{ value: frac(2 * b * v), trap: 'alg-power-base-mult' }];
    }
    traps = traps.filter((t) => !t.value.eq(answer));
    return {
      params: { kind, b, v, m, n, sign },
      q: { format: 'ne', stem, answer: frac(answer), traps, explanation },
    };
  },
  check(q, { kind, b, v, m, n, sign }) {
    if (q.format !== 'ne') return 'wrong format';
    let expected: number;
    if (kind === 'value' || kind === 'square') {
      const x = Math.log(v) / Math.log(b);
      expected = kind === 'value' ? Math.pow(b, x + m) + sign * Math.pow(b, x + n) : Math.pow(b * b, x) + Math.pow(b, x + 1);
    } else {
      const N0 = 4n;
      const B = BigInt(b);
      const bn = B ** N0;
      if (kind === 'k') {
        const top = B ** (N0 + BigInt(m)) + BigInt(sign) * bn;
        if (top % bn !== 0n) return 'k not an integer';
        expected = Number(top / bn);
      } else {
        const top = B ** (N0 + BigInt(m)) - bn;
        const bottom = B ** (N0 + 1n) - bn;
        if (top % bottom !== 0n) return 'ratio not an integer';
        expected = Number(top / bottom);
      }
    }
    return Math.abs(q.answer.toNumber() - expected) < 1e-6 * Math.max(1, Math.abs(expected)) ? null : `expected ${expected}`;
  },
};

/* ================================================================== 4. Equivalent forms of a factored expression (MCM) */

interface EquivParams {
  target: Ex;
  options: Ex[];
  excluded: number | null;
}

/** "u - x" written with the constant first. */
const rev = (u: number) => add(N(u), mul(N(-1), V('x')));

const equivalentMCM: Template<EquivParams> = {
  id: 'alg.expressions.equivalent-mcm',
  skill: 'alg.expressions',
  format: 'mcm',
  style: 'which factored or simplified forms are equivalent',
  generate(rng, d) {
    const rational = d === 3 ? rng.chance(0.6) : d === 2 ? rng.chance(0.25) : false;
    const k = d === 1 ? rng.pick([1, 2, 3]) : rng.pick([2, 3, 4, 5]);
    let u: number;
    let v: number;
    do {
      u = rng.int(1, 7) * rng.sign();
      v = rng.int(1, 7) * rng.sign();
    } while (u === v || u === -v);
    const expanded = polyEx([k, -k * (u + v), k * u * v]);
    const cands: { e: Ex; ok: boolean; trap?: string; why: string }[] = [];
    let target: Ex;
    let excluded: number | null = null;
    const xu = lx(1, -u);
    const xv = lx(1, -v);
    const kTex = k === 1 ? '' : `${k}`;
    if (!rational) {
      target = expanded;
      cands.push({ e: mul(N(k), xu, xv), ok: true, why: 'the factored form; expanding it gives back the expression' });
      cands.push({ e: mul(N(k), rev(u), rev(v)), ok: true, why: `both factors are reversed, and $(-1)(-1) = 1$` });
      if (k !== 1) cands.push({ e: mul(lx(k, -k * u), xv), ok: true, why: `the factor $${k}$ was multiplied into the first parenthesis` });
      cands.push({ e: mul(N(-k), rev(u), xv), ok: true, why: `$-(${texEx(rev(u))}) = ${texEx(xu)}$` });
      cands.push({ e: mul(N(k), lx(1, u), lx(1, v)), ok: false, trap: 'alg-factor-sign', why: `the signs are wrong: it expands to $${texEx(polyEx([k, k * (u + v), k * u * v]))}$` });
      cands.push({ e: mul(N(k), rev(u), xv), ok: false, trap: 'alg-reversed-factor', why: `reversing one factor changes the sign: this is the opposite of the expression` });
      if (k !== 1) cands.push({ e: mul(xu, xv), ok: false, trap: 'alg-dropped-factor', why: `the common factor $${k}$ is missing` });
      if (k !== 1) cands.push({ e: mul(lx(k, -u), xv), ok: false, trap: 'alg-distribute-partial', why: `only the $x$ term was multiplied by $${k}$` });
      // A factor pair with the right product but the wrong sum.
      const prod = u * v;
      const alt = [1, 2, 3, 4, 6].map((a) => [a, prod / a]).filter(([a, b]) => Number.isInteger(b) && a + b !== u + v && a !== b && Math.abs(b) <= 12);
      if (alt.length) {
        const [a, b] = rng.pick(alt);
        cands.push({ e: mul(N(k), lx(1, -a), lx(1, -b)), ok: false, trap: 'alg-factor-pair', why: `it expands to $${texEx(polyEx([k, -k * (a + b), k * u * v]))}$: the constant term is right, the $x$ term is not` });
      }
    } else {
      const flip = rng.chance(0.5);
      excluded = u;
      const den = flip ? rev(u) : xu;
      target = div(expanded, den);
      const s = flip ? -1 : 1;
      cands.push({ e: mul(N(s * k), xv), ok: true, why: `the factor $${texEx(xu)}$ cancels${flip ? ', leaving a factor of $-1$' : ''}` });
      cands.push({ e: lx(s * k, -s * k * v), ok: true, why: `the simplified form, multiplied out` });
      cands.push({ e: mul(N(-s * k), rev(v)), ok: true, why: `$-(${texEx(rev(v))}) = ${texEx(xv)}$` });
      cands.push({ e: mul(N(-s * k), xv), ok: false, trap: 'alg-reversed-factor', why: flip ? `$${texEx(rev(u))}$ is $-(${texEx(xu)})$, so a factor of $-1$ remains` : 'the sign is wrong' });
      cands.push({ e: mul(N(s * k), lx(1, v)), ok: false, trap: 'alg-factor-sign', why: `the sign of $${num(v)}$ is wrong` });
      cands.push({ e: mul(N(s * k), xu), ok: false, trap: 'alg-cancel-wrong-factor', why: `the factor that cancels is $${texEx(xu)}$, so $${texEx(xv)}$ remains` });
      if (k !== 1) cands.push({ e: lx(s * k, -s * v), ok: false, trap: 'alg-distribute-partial', why: `only the $x$ term was multiplied by $${s * k}$` });
    }
    // Drop wrong candidates that print the same as, or equal, an earlier candidate.
    const uniq: typeof cands = [];
    for (const c of cands) {
      if (uniq.some((u0) => texEx(u0.e) === texEx(c.e))) continue;
      if (!c.ok && uniq.some((u0) => !u0.ok && sameFunction(u0.e, c.e, ['x'], rng))) continue;
      uniq.push(c);
    }
    const goodPool = rng.shuffle(uniq.filter((c) => c.ok));
    const badPool = rng.shuffle(uniq.filter((c) => !c.ok));
    const nGood = rng.int(1, Math.min(3, goodPool.length));
    const total = rng.pick([5, 5, 6]);
    const picked = rng.shuffle([...goodPool.slice(0, nGood), ...badPool.slice(0, total - nGood)]);
    const { choices, answer } = flaggedChoices(
      picked.map((c) => ({ text: `$${texEx(c.e)}$`, correct: c.ok, ...(c.trap ? { trap: c.trap } : {}) })),
    );
    const factored = `${kTex}(${texEx(xu)})(${texEx(xv)})`;
    const lines = picked.map((c) => `- $${texEx(c.e)}$: ${c.ok ? 'equivalent' : 'not equivalent'}, ${c.why}.`).join('\n');
    const intro = rational
      ? `Factor the numerator: $${texEx(expanded)} = ${factored}$. For $x \\ne ${num(u)}$ the factor $${texEx(xu)}$ cancels${
          excluded !== null && (target as { b: Ex }).b && texEx((target as { b: Ex }).b) !== texEx(xu) ? `, but $${texEx(rev(u))} = -(${texEx(xu)})$, so the expression equals $${texEx(mul(N(-k), xv))}$` : `, so the expression equals $${texEx(mul(N(k), xv))}$`
        }.`
      : `Factor: $${texEx(expanded)} = ${factored}$${k !== 1 ? ` (take out $${k}$, then find two numbers with product $${num(u * v)}$ and sum $${num(u + v)}$)` : ` (two numbers with product $${num(u * v)}$ and sum $${num(u + v)}$)`}.`;
    return {
      params: { target, options: picked.map((c) => c.e), excluded },
      q: {
        format: 'mcm',
        stem: `Which of the following expressions are equivalent to $${texEx(target)}$ for all ${excluded !== null ? `$x \\ne ${num(excluded)}$` : 'values of $x$'}?`,
        instruction: 'Indicate all such expressions.',
        choices,
        answer,
        explanation: `${intro} Then compare each choice with that form:
${lines}

A quick test: plug in a value such as $x = ${excluded === 0 ? 1 : 0}$ and compare.`,
      },
    };
  },
  check(q, { target, options }, rng) {
    if (q.format !== 'mcm') return 'wrong format';
    if (options.some((o, i) => q.choices[i].text !== `$${texEx(o)}$`)) return 'choice text mismatch';
    const expected = options.flatMap((o, i) => (sameFunction(o, target, ['x'], rng) ? [i] : []));
    // Sanity: special values too.
    for (const i of expected) for (const x of SPECIAL.slice(0, 25)) {
      const a = evalEx(options[i], { x });
      const b = evalEx(target, { x });
      if (Number.isFinite(b) && Math.abs(a - b) > 1e-7 * Math.max(1, Math.abs(b))) return `choice ${i} differs at ${x}`;
    }
    return JSON.stringify(expected) === JSON.stringify(q.answer) ? null : `expected ${expected}`;
  },
};

export const expressionTemplates = [identityQC, expandMCS, powerFactorNE, equivalentMCM];

// Shared with other files of this folder.
export { rev, pow, neg };
