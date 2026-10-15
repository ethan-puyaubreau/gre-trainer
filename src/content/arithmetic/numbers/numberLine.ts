import { flaggedChoices, qcCompare, qcFromSamples } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import { decimal, num } from '../../../engine/tex';
import { term } from '../../../engine/text';
import type { Difficulty, NumberLineFigure, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { expectMCM, expectMCS, expectNE, expectQC, extremeIndex, F, numChoices, pickWeighted, qcEnd, qcFromFloatSamples, spreadFillers, swapQC } from './util';

/** Coordinate display: integers plainly, terminating values as decimals (when asked), else fractions. */
function coordTex(x: Frac, style: 'decimal' | 'fraction'): string {
  if (x.isInt()) return num(x.toNumber());
  if (style === 'decimal' && x.isTerminating()) return decimal(x);
  return x.toTex();
}

const paren = (t: string) => (t.startsWith('-') ? `(${t})` : t);

/* ================================================================== 1. Segment relations between four points (MCS) */

interface SegParams {
  A: Frac;
  D: Frac;
  r: [number, number, number];
  ask: 'B' | 'C';
  values: Frac[];
}

const FRAC_ENDS: [Frac, Frac][] = [
  [F(1, 4), F(1, 2)],
  [F(1, 3), F(1, 2)],
  [F(1, 5), F(1, 2)],
  [F(1, 3), F(2, 3)],
  [F(2, 5), F(3, 5)],
  [F(1, 4), F(3, 4)],
  [F(1, 6), F(1, 2)],
  [F(1, 2), F(1)],
  [F(1, 3), F(1)],
  [F(3, 4), F(1)],
];
const NEG_ENDS: [Frac, Frac][] = [
  [F(-1, 2), F(1, 4)],
  [F(-1, 3), F(1, 2)],
  [F(-2, 3), F(1, 3)],
  [F(-1, 4), F(1, 2)],
  [F(-3, 4), F(1, 2)],
  [F(-1), F(1, 2)],
];
const RATIOS: [number, number, number][] = [
  [1, 2, 3],
  [1, 3, 2],
  [2, 3, 1],
  [3, 2, 1],
  [2, 1, 3],
  [1, 4, 1],
  [2, 3, 2],
];

const segmentRatio: Template<SegParams> = {
  id: 'arith.number-line.segment-ratio',
  skill: 'arith.number-line',
  format: 'mcs',
  style: 'coordinate of a point from segment relations',
  generate(rng, d) {
    let A: Frac;
    let D: Frac;
    let r: [number, number, number];
    if (d === 1) {
      r = [1, 2, 1];
      A = F(rng.int(-12, 0));
      D = A.add(rng.pick([12, 24]));
    } else if (d === 2) {
      const k = rng.pick([2, 3, 4]);
      r = [1, k, 1];
      do [A, D] = rng.pick(FRAC_ENDS);
      while (k === 3 && A.eq(F(1, 3)) && D.eq(F(1, 2))); // the published example
    } else {
      r = rng.chance(0.6) ? rng.pick(RATIOS) : [1, rng.pick([3, 4]), 1];
      [A, D] = rng.chance(0.5) ? rng.pick(NEG_ENDS) : rng.pick(FRAC_ENDS);
    }
    if (A.eq(F(1, 3)) && D.eq(F(1, 2)) && r.join() === '1,3,1') r = [1, 4, 1]; // the published example
    const ask: 'B' | 'C' = rng.pick(['B', 'C'] as const);
    const total = r[0] + r[1] + r[2];
    const len = D.sub(A);
    const u = len.div(total);
    const B = A.add(u.mul(r[0]));
    const C = D.sub(u.mul(r[2]));
    const correct = ask === 'B' ? B : C;
    const other = ask === 'B' ? C : B;
    const thirds = ask === 'B' ? A.add(len.div(3)) : A.add(len.mul(2).div(3));
    const u2 = len.div(total - 1);
    const fewer = ask === 'B' ? A.add(u2.mul(r[0])) : D.sub(u2.mul(r[2]));
    const style = d === 1 ? 'decimal' : 'fraction';
    // the middle segment used as the step, and the whole length divided by the middle part only
    const wrongStep = ask === 'B' ? A.add(u.mul(r[1])) : D.sub(u.mul(r[1]));
    const partOfPart = ask === 'B' ? A.add(len.mul(r[0]).div(r[1])) : D.sub(len.mul(r[2]).div(r[1]));
    const trapList = [
      { value: thirds, trap: 'num-equal-segments' },
      { value: fewer, trap: 'num-segment-count' },
      { value: other, trap: 'num-wrong-point' },
      { value: wrongStep, trap: 'num-wrong-segment' },
      { value: partOfPart, trap: 'num-ratio-part-whole' },
    ].filter((t) => t.value.gt(A) && t.value.lt(D));
    const offs = [u.div(2), u.div(3), u, u.mul(3).div(2), u.mul(2).div(3), u.div(4)];
    const inside = (x: Frac) => x.gt(A) && x.lt(D) && (d > 1 || x.isInt());
    const { choices, answer, values } = numChoices(rng, {
      correct,
      traps: trapList,
      fillers: spreadFillers(
        rng,
        correct,
        trapList.map((t) => t.value),
        offs.map((o) => correct.sub(o)).filter(inside),
        offs.map((o) => correct.add(o)).filter(inside),
      ),
      format: (v) => `$${coordTex(v, style)}$`,
      allowNonPositive: true,
    });
    const isEnds = r[0] === 1 && r[2] === 1;
    const relation = isEnds ? `$AB = CD$ and $BC = ${r[1]} \\cdot AB$` : `$AB : BC : CD = ${r[0]} : ${r[1]} : ${r[2]}$`;
    const At = coordTex(A, style);
    const Dt = coordTex(D, style);
    const pad = len.toNumber() * 0.12;
    const figure: NumberLineFigure = {
      kind: 'numberLine',
      min: A.toNumber() - pad,
      max: D.toNumber() + pad,
      points: [
        { at: A.toNumber(), name: 'A', value: `$${At}$` },
        { at: B.toNumber(), name: 'B' },
        { at: C.toNumber(), name: 'C' },
        { at: D.toNumber(), name: 'D', value: `$${Dt}$` },
      ],
    };
    const shownVal = (v: Frac) => !v.eq(correct) && values.some((x) => x.eq(v));
    const trapBits = [
      shownVal(thirds) ? `splitting $AD$ into three equal parts gives $${coordTex(thirds, style)}$, but the segments are not equal` : '',
      shownVal(fewer) ? `using ${total - 1} parts instead of ${total} gives $${coordTex(fewer, style)}$` : '',
      shownVal(other) ? `$${coordTex(other, style)}$ is the coordinate of the other point, $${ask === 'B' ? 'C' : 'B'}$` : '',
      shownVal(wrongStep) ? `$${coordTex(wrongStep, style)}$ uses the middle segment as the step` : '',
    ].filter(Boolean);
    const trapLine = trapBits.length ? `Trap: ${trapBits.slice(0, 2).join('; ')}.` : '';
    const units = isEnds ? `Let $AB = CD = u$. Then $BC = ${term(r[1], 'u')}$` : `Let $AB = ${term(r[0], 'u')}$, $BC = ${term(r[1], 'u')}$, and $CD = ${term(r[2], 'u')}$`;
    const sumU = isEnds ? `u + ${term(r[1], 'u')} + u` : `${term(r[0], 'u')} + ${term(r[1], 'u')} + ${term(r[2], 'u')}`;
    const find =
      ask === 'B'
        ? `$B = A + ${r[0] === 1 ? '' : r[0]}u = ${At} + ${paren(coordTex(u.mul(r[0]), style))} = ${coordTex(B, style)}$`
        : `$C = D - ${r[2] === 1 ? '' : r[2]}u = ${Dt} - ${paren(coordTex(u.mul(r[2]), style))} = ${coordTex(C, style)}$`;
    return {
      params: { A, D, r, ask, values },
      q: {
        format: 'mcs',
        figure,
        stem: `On the number line above, the coordinates of $A$ and $D$ are shown. If ${relation}, what is the coordinate of $${ask}$?`,
        choices,
        answer,
        explanation: `${units}, so $AD = ${sumU} = ${total}u$. Since $AD = ${Dt} - ${paren(At)} = ${coordTex(len, style)}$, $u = ${coordTex(u, style)}$.

${find}.

Check: $AB + BC + CD = ${coordTex(B.sub(A), style)} + ${coordTex(C.sub(B), style)} + ${coordTex(D.sub(C), style)} = ${coordTex(len, style)}$.

${trapLine}`,
      },
    };
  },
  check(q, { A, D, r, ask, values }) {
    // Verify each choice: rebuild the configuration from it and test the stated relation.
    const ok = values.map((v) => {
      let AB: Frac;
      let BC: Frac;
      let CD: Frac;
      if (ask === 'B') {
        AB = v.sub(A);
        CD = AB.mul(r[2]).div(r[0]);
        BC = D.sub(CD).sub(v);
      } else {
        CD = D.sub(v);
        AB = CD.mul(r[0]).div(r[2]);
        BC = v.sub(A.add(AB));
      }
      return AB.sign() > 0 && BC.sign() > 0 && CD.sign() > 0 && BC.mul(r[0]).eq(AB.mul(r[1])) && A.add(AB).add(BC).add(CD).eq(D);
    });
    const hits = ok.flatMap((x, i) => (x ? [i] : []));
    return expectMCS(q, hits.length === 1 ? hits[0] : -1);
  },
};

/* ================================================================== 2. Farthest from / closest to a number (MCS) */

interface FarParams {
  mode: 'far' | 'close';
  c: Frac;
  values: Frac[];
}

const farthestClosest: Template<FarParams> = {
  id: 'arith.number-line.farthest',
  skill: 'arith.number-line',
  format: 'mcs',
  style: 'which number is farthest from (or closest to) a point',
  generate(rng, d) {
    const style = d === 3 ? 'fraction' : 'decimal';
    for (;;) {
      const mode: FarParams['mode'] = rng.chance(d === 1 ? 0.5 : 0.4) ? 'far' : 'close';
      let c: Frac;
      let vals: Frac[];
      if (d === 1 && mode === 'far') {
        c = F(rng.int(1, 6) * rng.sign());
        const s = rng.pick([4, 6, 8, 12]);
        vals = [-2 * s, -s, 0, s, 2 * s].map((x) => F(x));
      } else if (d === 1) {
        c = F(rng.int(2, 9) * rng.sign());
        vals = rng.sample(
          Array.from({ length: 25 }, (_, i) => F(i - 12)),
          5,
        );
      } else if (d === 2) {
        c = F(rng.int(-14, 14), 4);
        if (c.isInt()) continue;
        const pool = Array.from({ length: 41 }, (_, i) => F(i - 20, 4));
        vals = rng.sample(pool, 5);
      } else {
        const den = rng.pick([3, 4, 6]);
        c = F(rng.int(-3 * den, 3 * den), den);
        if (c.isInt()) continue;
        const pool: Frac[] = [];
        for (const q of [2, 3, 4, 5, 6]) for (let p = -4 * q; p <= 4 * q; p++) pool.push(F(p, q));
        const uniq = pool.filter((x, i) => pool.findIndex((y) => y.eq(x)) === i && !x.eq(c));
        vals = rng.sample(uniq, 5);
      }
      if (vals.some((v) => v.eq(c))) continue;
      vals.sort((x, y) => x.cmp(y));
      const dist = vals.map((v) => v.sub(c).abs().toNumber());
      const target = extremeIndex(dist, mode === 'far' ? 'max' : 'min');
      if (target < 0) continue;
      // Real slips: the greatest size, the greatest (or least) value, the biggest number on the same side as c (far);
      // the size closest to 0, the size closest to |c| on the other side of 0 (close).
      type Slip = 'maxAbs' | 'maxVal' | 'minVal' | 'sameSide' | 'minAbs' | 'mirror';
      const uniq = (xs: number[], kind: 'max' | 'min') => extremeIndex(xs, kind);
      const slipIdx: { i: number; kind: Slip }[] =
        mode === 'far'
          ? [
              { i: uniq(vals.map((v) => v.abs().toNumber()), 'max'), kind: 'maxAbs' },
              { i: uniq(vals.map((v) => v.toNumber()), 'max'), kind: 'maxVal' },
              { i: uniq(vals.map((v) => v.toNumber()), 'min'), kind: 'minVal' },
              { i: uniq(vals.map((v) => (v.sign() === c.sign() ? v.abs().toNumber() : -1)), 'max'), kind: 'sameSide' },
            ]
          : [
              { i: uniq(vals.map((v) => v.abs().toNumber()), 'min'), kind: 'minAbs' },
              { i: uniq(vals.map((v) => (v.sign() === -c.sign() ? v.add(c).abs().toNumber() : 1e9)), 'min'), kind: 'mirror' },
            ];
      const slipMap = new Map<number, Slip>();
      for (const sl of slipIdx) if (sl.i >= 0 && sl.i !== target && !slipMap.has(sl.i)) slipMap.set(sl.i, sl.kind);
      if (slipMap.size < 2) continue;
      // Second-best must be clearly different for the "close" questions at d1/d2.
      const sortedD = [...dist].sort((x, y) => (mode === 'far' ? y - x : x - y));
      if (Math.abs(sortedD[0] - sortedD[1]) < (d === 3 ? 0.05 : 0.2)) continue;
      const fmt = (v: Frac) => coordTex(v, style);
      const choices = vals.map((v, i) => ({ text: `$${fmt(v)}$`, ...(slipMap.has(i) ? { trap: 'num-distance-abs' } : {}) }));
      const ct = fmt(c);
      const lines = vals.map((v, i) => `$|${fmt(v)} - ${paren(ct)}| = ${coordTex(v.sub(c).abs(), style)}$${i === target ? ' ←' : ''}`).join(', ');
      const away = (i: number) => coordTex(vals[i].sub(c).abs(), style);
      const best = coordTex(vals[target].sub(c).abs(), style);
      const noteOf = (i: number, kind: Slip) =>
        ({
          maxAbs: `$${fmt(vals[i])}$ has the greatest size, but size is the distance from 0, not from $${ct}$: it is $${away(i)}$ away`,
          maxVal: `$${fmt(vals[i])}$ is the greatest number, but "farthest" means the greatest distance from $${ct}$, not the greatest value ($${away(i)}$ away)`,
          minVal: `$${fmt(vals[i])}$ is the least number, but "farthest" means the greatest distance from $${ct}$ ($${away(i)}$ away)`,
          sameSide: `$${fmt(vals[i])}$ is the greatest in size on the same side of 0 as $${ct}$, so it is close to $${ct}$: only $${away(i)}$ away`,
          minAbs: `$${fmt(vals[i])}$ is closest to 0, but the question is about distance from $${ct}$: it is $${away(i)}$ away`,
          mirror: `$${fmt(vals[i])}$ has the size closest to that of $${ct}$, but it is on the other side of 0, so it is $${away(i)}$ away`,
        })[kind];
      const notes = [...slipMap].slice(0, 2).map(([i, kind]) => noteOf(i, kind));
      return {
        params: { mode, c, values: vals },
        q: {
          format: 'mcs',
          stem: `Which of the following numbers is ${mode === 'far' ? 'farthest from' : 'closest to'} the number $${ct}$ on the number line?`,
          choices,
          answer: target,
          explanation: `The distance between $x$ and $${ct}$ is $|x - ${paren(ct)}|$, so compute it for every choice: ${lines}.

The ${mode === 'far' ? 'greatest' : 'least'} distance, $${best}$, belongs to $${fmt(vals[target])}$.

Trap: ${notes.join('; ')}. Distance is always measured from the given number.`,
        },
      };
    }
  },
  check(q, { mode, c, values }) {
    const dist = values.map((v) => Math.abs(v.toNumber() - c.toNumber()));
    return expectMCS(q, extremeIndex(dist, mode === 'far' ? 'max' : 'min'));
  },
};

/* ================================================================== 3. Letters on the number line: what must be true (MCM) */

/** 1: x < -1, 2: -1 < x < 0, 3: 0 < x < 1, 4: x > 1. With no ±1 ticks only the sign matters. */
type Region = 1 | 2 | 3 | 4;

interface Letter {
  name: string;
  at: number;
  region: Region;
}

type Fam = 'prod2' | 'diff' | 'prod3' | 'quot' | 'sum' | 'sq' | 'cube' | 'recip' | 'abs';

interface Stmt {
  fam: Fam;
  xs: number[];
  rel: '>' | '<';
}

interface SignParams {
  ticks: boolean;
  letters: Letter[];
  stmts: Stmt[];
}

const LETTER_SETS = [
  ['r', 's', 't', 'u'],
  ['a', 'b', 'c', 'd'],
  ['p', 'q', 'r', 's'],
  ['w', 'x', 'y', 'z'],
];

const neg = (r: Region) => r <= 2;

/** Truth by reasoning on regions (generate side). */
function stmtTruth(s: Stmt, L: Letter[]): boolean {
  const sg = (i: number) => (neg(L[i].region) ? -1 : 1);
  const want = (positive: boolean) => (s.rel === '>' ? positive : !positive);
  const reg = L[s.xs[0]].region;
  switch (s.fam) {
    case 'prod2':
    case 'quot':
      return want(sg(s.xs[0]) * sg(s.xs[1]) > 0);
    case 'prod3':
      return want(sg(s.xs[0]) * sg(s.xs[1]) * sg(s.xs[2]) > 0);
    case 'diff':
      return want(L[s.xs[0]].at > L[s.xs[1]].at);
    case 'sum':
      return want(sg(s.xs[0]) > 0);
    case 'sq': // x^2 > x except on (0, 1)
      return want(reg !== 3);
    case 'cube': // x^3 > x on (-1, 0) and (1, inf)
      return want(reg === 2 || reg === 4);
    case 'recip': // 1/x > x on (-inf, -1) and (0, 1)
      return want(reg === 1 || reg === 3);
    case 'abs': // |x| > 1 outside [-1, 1]
      return want(reg === 1 || reg === 4);
  }
}

function stmtTex(s: Stmt, L: Letter[]): string {
  const n = s.xs.map((i) => L[i].name);
  const r = s.rel;
  switch (s.fam) {
    case 'prod2':
      return `${n[0]}${n[1]} ${r} 0`;
    case 'prod3':
      return `${n[0]}${n[1]}${n[2]} ${r} 0`;
    case 'quot':
      return `\\frac{${n[0]}}{${n[1]}} ${r} 0`;
    case 'diff':
      return `${n[0]} - ${n[1]} ${r} 0`;
    case 'sum':
      return `${n[0]} + ${n[1]} ${r} 0`;
    case 'sq':
      return `${n[0]}^2 ${r} ${n[0]}`;
    case 'cube':
      return `${n[0]}^3 ${r} ${n[0]}`;
    case 'recip':
      return `\\frac{1}{${n[0]}} ${r} ${n[0]}`;
    case 'abs':
      return `|${n[0]}| ${r} 1`;
  }
}

function stmtEval(s: Stmt, v: number[]): boolean {
  const x = v[s.xs[0]];
  const y = v[s.xs[1]];
  const z = v[s.xs[2]];
  let lhs: number;
  let rhs = 0;
  switch (s.fam) {
    case 'prod2':
      lhs = x * y;
      break;
    case 'prod3':
      lhs = x * y * z;
      break;
    case 'quot':
      lhs = x / y;
      break;
    case 'diff':
      lhs = x - y;
      break;
    case 'sum':
      lhs = x + y;
      break;
    case 'sq':
      lhs = x * x;
      rhs = x;
      break;
    case 'cube':
      lhs = x * x * x;
      rhs = x;
      break;
    case 'recip':
      lhs = 1 / x;
      rhs = x;
      break;
    case 'abs':
      lhs = Math.abs(x);
      rhs = 1;
      break;
  }
  return s.rel === '>' ? lhs > rhs : lhs < rhs;
}

const REGION_TEX = (name: string, r: Region) => [``, `${name} < -1`, `-1 < ${name} < 0`, `0 < ${name} < 1`, `${name} > 1`][r];

function stmtReason(s: Stmt, L: Letter[], ticks: boolean): string {
  const n = s.xs.map((i) => L[i].name);
  const sw = (i: number) => (neg(L[s.xs[i]].region) ? 'negative' : 'positive');
  const reg = L[s.xs[0]].region;
  const x = n[0];
  switch (s.fam) {
    case 'prod2':
    case 'quot': {
      const pos = neg(L[s.xs[0]].region) === neg(L[s.xs[1]].region);
      return `$${n[0]}$ is ${sw(0)} and $${n[1]}$ is ${sw(1)}, so the ${s.fam === 'prod2' ? 'product' : 'quotient'} is ${pos ? 'positive' : 'negative'}`;
    }
    case 'prod3': {
      const negs = s.xs.filter((i) => neg(L[i].region)).length;
      return `${negs === 0 ? 'none' : negs} of the three ${negs === 1 ? 'is' : 'are'} negative, so the product is ${negs % 2 === 0 ? 'positive' : 'negative'}`;
    }
    case 'diff':
      return `$${n[0]}$ is to the ${L[s.xs[0]].at > L[s.xs[1]].at ? 'right' : 'left'} of $${n[1]}$, so $${n[0]} - ${n[1]}$ is ${L[s.xs[0]].at > L[s.xs[1]].at ? 'positive' : 'negative'}`;
    case 'sum':
      return `both are ${sw(0)}, so the sum is ${sw(0)}`;
    case 'sq':
      return reg === 3
        ? `for $0 < ${x} < 1$, squaring makes the number smaller: $${x}^2 < ${x}$`
        : reg === 4
          ? `for $${x} > 1$, squaring makes the number larger: $${x}^2 > ${x}$`
          : `$${x}^2$ is positive and $${x}$ is negative, so $${x}^2 > ${x}$`;
    case 'cube':
      return reg === 1
        ? `for $${x} < -1$, cubing moves the number farther below $-1$: $${x}^3 < ${x}$`
        : reg === 2
          ? `for $-1 < ${x} < 0$, cubing moves the number closer to 0, so $${x}^3 > ${x}$`
          : reg === 3
            ? `for $0 < ${x} < 1$, cubing makes the number smaller: $${x}^3 < ${x}$`
            : `for $${x} > 1$, cubing makes the number larger: $${x}^3 > ${x}$`;
    case 'recip':
      return reg === 1
        ? `for $${x} < -1$, $\\frac{1}{${x}}$ is between $-1$ and 0, so $\\frac{1}{${x}} > ${x}$`
        : reg === 2
          ? `for $-1 < ${x} < 0$, $\\frac{1}{${x}} < -1 < ${x}$`
          : reg === 3
            ? `for $0 < ${x} < 1$, $\\frac{1}{${x}} > 1 > ${x}$`
            : `for $${x} > 1$, $\\frac{1}{${x}} < 1 < ${x}$`;
    case 'abs':
      return ticks ? `$${REGION_TEX(x, reg)}$, so $|${x}| ${reg === 1 || reg === 4 ? '>' : '<'} 1$` : '';
  }
}

function stmtTrap(s: Stmt, L: Letter[]): string | undefined {
  const reg = L[s.xs[0]].region;
  if (s.fam === 'sq' || s.fam === 'cube') return reg === 3 || reg === 4 ? 'fraction-power-grows' : 'negative-fraction-sign';
  if (s.fam === 'recip') return 'reciprocal-direction';
  if (s.fam === 'abs') return 'num-abs-vs-one';
  return 'num-sign-rules';
}

const BOUNDS: Record<Region, [number, number]> = { 1: [-2.7, -1.3], 2: [-0.85, -0.2], 3: [0.2, 0.85], 4: [1.3, 2.7] };

function placeLetters(rng: Rng, d: Difficulty): Letter[] {
  const names = rng.pick(LETTER_SETS);
  if (d === 1) {
    // Sign only: 3 letters, both signs present.
    const nNeg = rng.pick([1, 2]);
    for (;;) {
      const negs = Array.from({ length: nNeg }, () => -rng.int(3, 27) / 10);
      const poss = Array.from({ length: 3 - nNeg }, () => rng.int(3, 27) / 10);
      const all = [...negs, ...poss].sort((a, b) => a - b);
      if (all.some((x, i) => i > 0 && x - all[i - 1] < 0.5)) continue;
      return all.map((at, i) => ({ name: names[i], at, region: (at < 0 ? 2 : 3) as Region }));
    }
  }
  const nL = d === 2 ? rng.pick([3, 4]) : 4;
  const regions = (nL === 4 ? [1, 2, 3, 4] : rng.sample([1, 2, 3, 4], 3).sort()) as Region[];
  return regions.map((reg, i) => {
    const [lo, hi] = BOUNDS[reg];
    return { name: names[i], at: rng.int(Math.round(lo * 20), Math.round(hi * 20)) / 20, region: reg };
  });
}

const signsMCM: Template<SignParams> = {
  id: 'arith.number-line.signs-mcm',
  skill: 'arith.number-line',
  format: 'mcm',
  style: 'letters on a number line: which statements must be true',
  generate(rng, d) {
    const ticks = d > 1;
    const L = placeLetters(rng, d);
    const idx = L.map((_, i) => i);
    const pairs = idx.flatMap((i) => idx.filter((j) => j !== i).map((j) => [i, j]));
    const cands: Stmt[] = [];
    const rel = () => rng.pick(['>', '<'] as const);
    for (const [i, j] of pairs) {
      if (i < j) cands.push({ fam: 'prod2', xs: [i, j], rel: rel() });
      cands.push({ fam: 'diff', xs: [i, j], rel: rel() });
      if (d > 1 && neg(L[i].region) !== neg(L[j].region)) cands.push({ fam: 'quot', xs: [i, j], rel: rel() });
      if (i < j && neg(L[i].region) === neg(L[j].region)) cands.push({ fam: 'sum', xs: [i, j], rel: rel() });
    }
    if (L.length >= 3 && d > 1) cands.push({ fam: 'prod3', xs: rng.sample(idx, 3).sort(), rel: rel() });
    const powerCands: Stmt[] = [];
    if (ticks) for (const i of idx) for (const fam of ['sq', 'cube', 'recip', 'abs'] as Fam[]) powerCands.push({ fam, xs: [i], rel: rel() });
    const n = d === 1 ? 3 : d === 2 ? 4 : 5;
    for (let tries = 0; ; tries++) {
      const nPow = ticks ? Math.min(powerCands.length, d === 2 ? 2 : 3) : 0;
      const picked = [...rng.sample(powerCands, nPow), ...rng.sample(cands, n - nPow)];
      // No two statements about the same expression.
      const keys = picked.map((s) => `${s.fam}:${[...s.xs].sort().join(',')}`);
      if (new Set(keys).size < picked.length) continue;
      const truth = picked.map((s) => stmtTruth(s, L));
      const nTrue = truth.filter(Boolean).length;
      if (nTrue === 0 || nTrue === n) continue;
      if (d === 1 && picked.filter((s) => s.fam === 'diff').length > 1) continue;
      const stmts = rng.shuffle(picked);
      const { choices, answer } = flaggedChoices(
        stmts.map((s) => {
          const t = stmtTruth(s, L);
          const trap = t ? undefined : stmtTrap(s, L);
          return { text: `$${stmtTex(s, L)}$`, correct: t, ...(trap ? { trap } : {}) };
        }),
      );
      const figure: NumberLineFigure = {
        kind: 'numberLine',
        min: -3,
        max: 3,
        points: L.map((l) => ({ at: l.at, name: l.name })),
        ticks: ticks
          ? [
              { at: -1, label: '$-1$' },
              { at: 0, label: '$0$' },
              { at: 1, label: '$1$' },
            ]
          : [{ at: 0, label: '$0$' }],
      };
      const order = ticks
        ? (() => {
            const marks: { at: number; t: string }[] = [
              ...L.map((l) => ({ at: l.at, t: l.name })),
              { at: -1, t: '-1' },
              { at: 0, t: '0' },
              { at: 1, t: '1' },
            ].sort((a, b) => a.at - b.at);
            return marks.map((m) => m.t).join(' < ');
          })()
        : [...L.map((l) => ({ at: l.at, t: l.name })), { at: 0, t: '0' }]
            .sort((a, b) => a.at - b.at)
            .map((m) => m.t)
            .join(' < ');
      const lines = stmts.map((s) => `- $${stmtTex(s, L)}$: ${stmtReason(s, L, ticks)} ${stmtTruth(s, L) ? '✓' : '✗'}`);
      const names = L.map((l) => `$${l.name}$`);
      const nameList = names.length === 3 ? `${names[0]}, ${names[1]}, and ${names[2]}` : `${names[0]}, ${names[1]}, ${names[2]}, and ${names[3]}`;
      return {
        params: { ticks, letters: L, stmts },
        q: {
          format: 'mcm',
          figure,
          stem: `The numbers ${nameList} are shown on the number line above. Which of the following statements must be true?`,
          instruction: 'Indicate all such statements.',
          choices,
          answer,
          explanation: `Read only the order from the figure: $${order}$.
${lines.join('\n')}`,
        },
      };
    }
  },
  check(q, { ticks, letters, stmts }, rng) {
    // Sample random positions that respect the regions and the order shown, and test every statement.
    const lo: Record<Region, number> = ticks ? { 1: -6, 2: -1, 3: 0, 4: 1 } : { 1: -6, 2: -6, 3: 0, 4: 0 };
    const hi: Record<Region, number> = ticks ? { 1: -1, 2: 0, 3: 1, 4: 6 } : { 1: 0, 2: 0, 3: 6, 4: 6 };
    const ok = stmts.map(() => true);
    // Letters that share a region keep their left-to-right order: sample, sort, assign.
    const groups = new Map<number, number[]>();
    letters.forEach((l, i) => {
      const key = ticks ? l.region : neg(l.region) ? 2 : 3;
      groups.set(key, [...(groups.get(key) ?? []), i]);
    });
    for (let t = 0; t < 150; t++) {
      const v: number[] = letters.map(() => 0);
      for (const [key, members] of groups) {
        const r = key as Region;
        const xs = members.map(() => {
          let x: number;
          do x = lo[r] + rng.next() * (hi[r] - lo[r]);
          while (x === lo[r] || x === hi[r]);
          return x;
        });
        xs.sort((a, b) => a - b);
        [...members].sort((i, j) => letters[i].at - letters[j].at).forEach((i, k) => (v[i] = xs[k]));
      }
      stmts.forEach((st, i) => {
        if (!stmtEval(st, v)) ok[i] = false;
      });
    }
    return expectMCM(
      q,
      ok.flatMap((x, i) => (x ? [i] : [])),
    );
  },
};

/* ================================================================== 4. Equally spaced tick marks (NE) */

interface TickParams {
  a: Frac;
  b: Frac;
  ia: number;
  ib: number;
  ip: number;
}

const tickMarks: Template<TickParams> = {
  id: 'arith.number-line.tick-marks',
  skill: 'arith.number-line',
  format: 'ne',
  style: 'value of a point between equally spaced tick marks',
  generate(rng, d) {
    let a: Frac;
    let s: Frac;
    let m: number;
    let style: 'decimal' | 'fraction' = 'decimal';
    if (d === 1) {
      m = rng.pick([4, 5, 8, 10]);
      const width = rng.pick([1, 2, 3]);
      s = F(width, m);
      a = F(rng.int(-5, 3));
    } else if (d === 2) {
      m = rng.pick([3, 4, 5, 6]);
      s = rng.pick([F(1, 5), F(1, 4), F(3, 10), F(2, 5), F(1, 20), F(3, 20)]);
      a = s.mul(rng.int(-8, 10));
    } else if (rng.chance(0.6)) {
      style = 'fraction';
      const pairs: [Frac, Frac, number][] = [
        [F(1, 4), F(1, 2), 5],
        [F(1, 4), F(1, 3), 4],
        [F(1, 3), F(1, 2), 4],
        [F(1, 5), F(1, 3), 4],
        [F(2, 3), F(3, 4), 5],
        [F(1, 2), F(2, 3), 4],
        [F(-1, 2), F(1, 3), 5],
        [F(-1, 3), F(1, 4), 7],
      ];
      const [x, y, mm] = rng.pick(pairs);
      a = x;
      m = mm;
      s = y.sub(x).div(m);
    } else {
      m = rng.pick([4, 5, 6]);
      s = rng.pick([F(3, 20), F(3, 10), F(7, 20), F(1, 8), F(3, 8)]);
      a = s.mul(rng.int(-12, -2));
    }
    const ia = d === 1 ? 0 : rng.int(0, 2);
    const ib = ia + m;
    const N = ib + (d === 1 ? 0 : rng.int(0, 2));
    let ip: number;
    do ip = rng.int(0, N);
    while (ip === ia || ip === ib || (d === 1 && (ip < ia || ip > ib)));
    const b = a.add(s.mul(m));
    const at = (i: number) => a.add(s.mul(i - ia));
    const P = at(ip);
    const fractionBoxes = style === 'fraction' || !P.isTerminating();
    const s2 = b.sub(a).div(m + 1);
    const P2 = a.add(s2.mul(ip - ia));
    if (P2.eq(P)) return tickMarks.generate(rng, d); // counting marks instead of intervals would give the same point: draw again
    const trapOk = fractionBoxes || P2.isTerminating();
    const fmt = (x: Frac) => coordTex(x, style);
    const figure: NumberLineFigure = {
      kind: 'numberLine',
      min: at(0).toNumber() - s.toNumber() * 0.6,
      max: at(N).toNumber() + s.toNumber() * 0.6,
      points: [{ at: P.toNumber(), name: 'P' }],
      ticks: Array.from({ length: N + 1 }, (_, i) => ({ at: at(i).toNumber(), ...(i === ia ? { label: `$${fmt(a)}$` } : i === ib ? { label: `$${fmt(b)}$` } : {}) })),
    };
    const k = ip - ia;
    return {
      params: { a, b, ia, ib, ip },
      q: {
        format: 'ne',
        figure,
        stem: `On the number line above, the tick marks are equally spaced. What is the coordinate of point $P$?`,
        answer: P,
        ...(fractionBoxes ? { fractionBoxes: true } : {}),
        traps: trapOk ? [{ value: P2, trap: 'num-ticks-vs-intervals' }] : [],
        explanation: `From $${fmt(a)}$ to $${fmt(b)}$ there are ${m} equal intervals (count the spaces between the tick marks, not the marks). Each interval is $\\frac{${fmt(b)} - ${paren(fmt(a))}}{${m}} = ${fmt(s)}$.

Point $P$ is ${Math.abs(k)} interval${Math.abs(k) === 1 ? '' : 's'} to the ${k > 0 ? 'right' : 'left'} of $${fmt(a)}$: $${fmt(a)} ${k > 0 ? '+' : '-'} ${Math.abs(k)} \\cdot ${paren(fmt(s))} = ${fmt(P)}$.${
          trapOk ? `\n\nDividing by ${m + 1} (the number of tick marks) instead of ${m} gives $${fmt(P2)}$.` : ''
        }`,
      },
    };
  },
  check(q, { a, b, ia, ib, ip }) {
    // Linear interpolation between the two labeled ticks, in floating point.
    const x = a.toNumber() + ((b.toNumber() - a.toNumber()) * (ip - ia)) / (ib - ia);
    return expectNE(q, x, 1e-9);
  },
};

/* ================================================================== 5. Distances on the number line (QC) */

interface DistParams {
  mode: 'two' | 'mid' | 'mids';
  a: Frac;
  d1: Frac;
  b: Frac;
  d2: Frac;
  /** mid: R = a, S = b, w = d1. mids: RS = a, RT = d1, b = which quantity B is (0: ST, 1: RS, 2: half of RT) */
  swap: boolean;
}

const distanceQC: Template<DistParams> = {
  id: 'arith.number-line.distance-qc',
  skill: 'arith.number-line',
  format: 'qc',
  style: 'points at a given distance, midpoints',
  generate(rng, d) {
    const mode = pickWeighted<DistParams['mode']>(rng, [
      ['two', 4.5],
      ['mid', 3],
      ['mids', 3],
    ]);
    const swap = rng.chance(0.4);
    if (mode === 'mids') {
      // R, S, T with S between R and T; RS = a, RT = b. Distance between the midpoints of RS and ST is b / 2.
      const style = d === 1 ? 1 : 10;
      const which = d === 3 && rng.chance(0.25) ? 2 : rng.chance(0.7) ? 0 : 1;
      let a: Frac;
      let b: Frac;
      const kase = rng.pick(['C', 'more', 'less'] as const);
      do {
        b = F(2 * rng.int(4, 30), style);
        a = kase === 'C' ? b.div(2) : kase === 'more' ? b.div(2).add(F(rng.int(1, 6), style)) : b.div(2).sub(F(rng.int(1, 6), style));
      } while (!a.gt(0) || !a.lt(b));
      const t = (x: Frac) => coordTex(x, 'decimal');
      const half = b.div(2);
      const other = which === 0 ? b.sub(a) : which === 1 ? a : half;
      const rel = qcCompare(half, other);
      const answer = swap ? swapQC(rel) : rel;
      const naive = a.add(b).div(2);
      const naiveRel = qcCompare(naive, other);
      const naiveAns = swap ? swapQC(naiveRel) : naiveRel;
      const traps: QCQuestion['traps'] = naiveAns !== answer ? { [naiveAns]: 'num-wrong-point' } : undefined;
      const qa = 'The distance between the midpoint of $RS$ and the midpoint of $ST$';
      const qb = which === 0 ? 'The length of $ST$' : which === 1 ? 'The length of $RS$' : 'Half the length of $RT$';
      return {
        params: { mode, a, d1: b, b: F(which), d2: F(0), swap },
        q: {
          format: 'qc',
          info: `Points $R$, $S$, and $T$ lie on a number line, with $S$ between $R$ and $T$. $RS = ${t(a)}$ and $RT = ${t(b)}$.`,
          quantityA: swap ? qb : qa,
          quantityB: swap ? qa : qb,
          answer,
          traps,
          explanation: `Put $R$ at 0. Then $S$ is at $${t(a)}$ and $T$ is at $${t(b)}$. The midpoint of $RS$ is at $${t(a.div(2))}$ and the midpoint of $ST$ is at $\\frac{${t(a)} + ${t(b)}}{2} = ${t(naive)}$, so the distance between the midpoints is $${t(naive)} - ${t(a.div(2))} = ${t(half)}$: always half of $RT$, wherever $S$ is.

${which === 0 ? `$ST = ${t(b)} - ${t(a)} = ${t(b.sub(a))}$.` : which === 1 ? `$RS = ${t(a)}$.` : `Half of $RT$ is $${t(half)}$.`} ${qcEnd(answer)}`,
        },
      };
    }
    if (mode === 'two') {
      const target = pickWeighted<QCChoice>(rng, [
        ['A', 1],
        ['B', 1],
        ['D', 1.4],
      ]);
      for (;;) {
        const scale = d === 3 ? 2 : 1;
        const a = F(rng.int(-8, 8), scale);
        const b = F(rng.int(-8, 8), scale);
        const d1 = F(rng.int(1, 7), scale);
        const d2 = F(rng.int(1, 7), scale);
        const xs = [a.sub(d1), a.add(d1)];
        const ys = [b.sub(d2), b.add(d2)];
        // Interval reasoning: compare the extreme possible values.
        const rel: QCChoice = xs[0].gt(ys[1]) ? 'A' : xs[1].lt(ys[0]) ? 'B' : 'D';
        if (rel !== target) continue;
        if (a.eq(b)) continue;
        const naive = a.add(d1).cmp(b.add(d2));
        const naiveRel: QCChoice = naive > 0 ? 'A' : naive < 0 ? 'B' : 'C';
        const answer = swap ? swapQC(rel) : rel;
        const naiveAns = swap ? swapQC(naiveRel) : naiveRel;
        const traps: QCQuestion['traps'] = naiveAns !== answer ? { [naiveAns]: 'num-abs-one-solution' } : undefined;
        const t = (x: Frac) => coordTex(x, 'decimal');
        const info =
          d === 3
            ? `$|x - ${paren(t(a))}| = ${t(d1)}$ and $|y - ${paren(t(b))}| = ${t(d2)}$`
            : `On the number line, the distance between $x$ and $${t(a)}$ is $${t(d1)}$, and the distance between $y$ and $${t(b)}$ is $${t(d2)}$.`;
        const why =
          rel === 'D'
            ? (() => {
                const prs = xs.flatMap((x) => ys.map((y) => [x, y] as const)).sort((p1, p2) => p2[0].sub(p2[1]).cmp(p1[0].sub(p1[1])));
                const big = prs[0];
                const small = prs[prs.length - 1];
                const sym = (x: Frac, y: Frac) => (x.gt(y) ? '>' : x.lt(y) ? '<' : '=');
                return `With $x = ${t(big[0])}$ and $y = ${t(big[1])}$, $x ${sym(big[0], big[1])} y$; with $x = ${t(small[0])}$ and $y = ${t(small[1])}$, $x ${sym(small[0], small[1])} y$.`;
              })()
            : rel === 'A'
              ? `Even the smallest possible $x$, $${t(xs[0])}$, is greater than the largest possible $y$, $${t(ys[1])}$.`
              : `Even the largest possible $x$, $${t(xs[1])}$, is less than the smallest possible $y$, $${t(ys[0])}$.`;
        return {
          params: { mode, a, d1, b, d2, swap },
          q: {
            format: 'qc',
            info,
            quantityA: swap ? '$y$' : '$x$',
            quantityB: swap ? '$x$' : '$y$',
            answer,
            traps,
            explanation: `A point at distance $${t(d1)}$ from $${t(a)}$ can be on either side: $x = ${t(xs[0])}$ or $x = ${t(xs[1])}$. Likewise $y = ${t(ys[0])}$ or $y = ${t(ys[1])}$.

${why}

${rel !== 'D' || naiveAns === answer ? '' : `Using only the points to the right ($x = ${t(xs[1])}$, $y = ${t(ys[1])}$) misses the other cases. `}${qcEnd(answer)}`,
          },
        };
      }
    }
    // midpoint: S is the midpoint of RT; compare T with w.
    const style = d === 3 ? 'fraction' : 'decimal';
    let R: Frac;
    let S: Frac;
    if (d === 1) {
      R = F(rng.int(-9, 2));
      S = R.add(rng.int(2, 6));
    } else if (d === 2) {
      R = F(rng.int(-40, 10), 10);
      S = R.add(F(rng.int(8, 40), 10));
    } else {
      const fr = [F(1, 3), F(1, 4), F(2, 3), F(3, 4), F(1, 6), F(5, 6), F(2, 5)];
      R = rng.pick(fr).neg();
      S = rng.pick(fr.filter((x) => !x.eq(R.neg())));
    }
    if (rng.chance(0.4)) [R, S] = [S, R]; // sometimes T is on the left
    const T = S.mul(2).sub(R);
    const kase = pickWeighted(rng, [
      ['C', 3],
      ['near', 3],
      ['avg', 2],
    ] as ['C' | 'near' | 'avg', number][]);
    let w: Frac;
    let trapC = false;
    if (kase === 'C') w = T;
    else if (kase === 'near') w = T.add((style === 'fraction' ? F(1, 12) : d === 1 ? F(1) : F(1, 10)).mul(rng.sign()));
    else {
      w = R.add(S).div(2);
      trapC = true;
    }
    const rel = qcFromSamples([[T, w]]);
    const answer = swap ? swapQC(rel) : rel;
    const traps: QCQuestion['traps'] = trapC ? { C: 'num-wrong-point' } : undefined;
    const t = (x: Frac) => coordTex(x, style);
    const lo = Math.min(R.toNumber(), T.toNumber());
    const hi = Math.max(R.toNumber(), T.toNumber());
    const pad = (hi - lo) * 0.15;
    const figure: NumberLineFigure = {
      kind: 'numberLine',
      min: lo - pad,
      max: hi + pad,
      points: [
        { at: R.toNumber(), name: 'R', value: `$${t(R)}$` },
        { at: S.toNumber(), name: 'S', value: `$${t(S)}$` },
        { at: T.toNumber(), name: 'T' },
      ],
    };
    const qa = `The coordinate of $T$`;
    const qb = `$${t(w)}$`;
    return {
      params: { mode, a: R, d1: w, b: S, d2: F(0), swap },
      q: {
        format: 'qc',
        figure,
        info: `On the number line above, $S$ is the midpoint of segment $RT$.`,
        quantityA: swap ? qb : qa,
        quantityB: swap ? qa : qb,
        answer,
        traps,
        explanation: `$RS = ${S.gt(R) ? `${t(S)} - ${paren(t(R))}` : `${t(R)} - ${paren(t(S))}`} = ${t(S.sub(R).abs())}$. Since $S$ is the midpoint, $ST = RS$, so $T = ${t(S)} ${T.gt(S) ? '+' : '-'} ${t(S.sub(R).abs())} = ${t(T)}$.

Compare $${t(T)}$ with $${t(w)}$.${trapC ? ` (The value $${t(w)}$ is the midpoint of $R$ and $S$, not the coordinate of $T$.)` : ''} ${qcEnd(answer)}`,
      },
    };
  },
  check(q, { mode, a, d1, b, d2, swap }) {
    if (mode === 'mids') {
      // Place the points and measure.
      const R = 0;
      const S = R + a.toNumber();
      const T = R + d1.toNumber();
      const m1 = (R + S) / 2;
      const m2 = (S + T) / 2;
      const A = Math.abs(m2 - m1);
      const B = b.eq(0) ? T - S : b.eq(1) ? S - R : (T - R) / 2;
      return expectQC(q, qcFromFloatSamples([swap ? [B, A] : [A, B]], 1e-9));
    }
    if (mode === 'two') {
      // Enumerate the four possible (x, y) pairs.
      const xs = [a.toNumber() - d1.toNumber(), a.toNumber() + d1.toNumber()];
      const ys = [b.toNumber() - d2.toNumber(), b.toNumber() + d2.toNumber()];
      const samples = xs.flatMap((x) => ys.map((y) => (swap ? [y, x] : [x, y]) as [number, number]));
      return expectQC(q, qcFromSamples(samples));
    }
    // T is the point with |T - S| = |S - R| other than R.
    const R = a.toNumber();
    const S = b.toNumber();
    const cands = [S + Math.abs(S - R), S - Math.abs(S - R)].filter((x) => Math.abs(x - R) > 1e-12);
    const T = cands[0];
    const w = d1.toNumber();
    return expectQC(q, qcFromSamples([swap ? [w, T] : [T, w]]));
  },
};

export const numberLineTemplates = [segmentRatio, farthestClosest, signsMCM, tickMarks, distanceQC];
