import { flaggedChoices, qcCompare, qcFromSamples } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { gcd } from '../../../engine/math';
import type { Rng } from '../../../engine/rng';
import { num, paren, poly } from '../../../engine/tex';
import type { GeometryFigure, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { choiceValuesMatch, dots, valuedChoices, expectMcm, expectMcs, expectNe, expectQc, lineTex, ptTex, qcEnd, uniqueIndex } from './util';

type Pt = [number, number];

/* =============================================================================================
 * 1. Points above / below a line through the origin (QC, figure) [BOOK AL-15]
 * =========================================================================================== */

interface L6 {
  p1: string;
  p2: string;
  q1: string;
  q2: string;
  r1: string;
  r2: string;
}

interface SideCmp {
  id: string;
  m: 1 | -1 | 2;
  needsR: boolean;
  A: (L: L6) => string;
  B: (L: L6) => string;
  val: (P: Pt, Q: Pt, R: Pt) => [number, number];
  ans: QCChoice;
  why: (L: L6) => string;
}

const SIDE_CMPS: SideCmp[] = [
  // ---- y = x
  {
    id: '1a', m: 1, needsR: false, ans: 'A',
    A: (L) => `${L.q1} + ${L.p2}`, B: (L) => `${L.p1} + ${L.q2}`,
    val: (P, Q) => [Q[0] + P[1], P[0] + Q[1]],
    why: (L) => `Add the inequalities $${L.p2} > ${L.p1}$ and $${L.q1} > ${L.q2}$: $${L.q1} + ${L.p2} > ${L.p1} + ${L.q2}$.`,
  },
  {
    id: '1b', m: 1, needsR: false, ans: 'B',
    A: (L) => `${L.p1} + ${L.q2}`, B: (L) => `${L.q1} + ${L.p2}`,
    val: (P, Q) => [P[0] + Q[1], Q[0] + P[1]],
    why: (L) => `Add the inequalities $${L.p1} < ${L.p2}$ and $${L.q2} < ${L.q1}$: $${L.p1} + ${L.q2} < ${L.q1} + ${L.p2}$.`,
  },
  {
    id: '1c', m: 1, needsR: false, ans: 'A',
    A: (L) => `${L.p2} - ${L.p1}`, B: (L) => `${L.q2} - ${L.q1}`,
    val: (P, Q) => [P[1] - P[0], Q[1] - Q[0]],
    why: (L) => `Quantity A is positive because $${L.p2} > ${L.p1}$, and Quantity B is negative because $${L.q2} < ${L.q1}$.`,
  },
  {
    id: '1d', m: 1, needsR: false, ans: 'B',
    A: (L) => `${L.p1} - ${L.p2}`, B: (L) => `${L.q1} - ${L.q2}`,
    val: (P, Q) => [P[0] - P[1], Q[0] - Q[1]],
    why: (L) => `Quantity A is negative because $${L.p1} < ${L.p2}$, and Quantity B is positive because $${L.q1} > ${L.q2}$.`,
  },
  {
    id: '1e', m: 1, needsR: true, ans: 'A',
    A: (L) => `${L.r1} + ${L.p2}`, B: (L) => `${L.r2} + ${L.p1}`,
    val: (P, _Q, R) => [R[0] + P[1], R[1] + P[0]],
    why: (L) => `Since $(${L.r1}, ${L.r2})$ is on the line, $${L.r1} = ${L.r2}$. Removing that common part leaves $${L.p2}$ versus $${L.p1}$, and $${L.p2} > ${L.p1}$.`,
  },
  {
    id: '1f', m: 1, needsR: true, ans: 'B',
    A: (L) => `${L.r1} + ${L.q2}`, B: (L) => `${L.r2} + ${L.q1}`,
    val: (_P, Q, R) => [R[0] + Q[1], R[1] + Q[0]],
    why: (L) => `Since $(${L.r1}, ${L.r2})$ is on the line, $${L.r1} = ${L.r2}$. Removing that common part leaves $${L.q2}$ versus $${L.q1}$, and $${L.q2} < ${L.q1}$.`,
  },
  {
    id: '1g', m: 1, needsR: true, ans: 'C',
    A: (L) => `${L.r2} - ${L.r1}`, B: () => `0`,
    val: (_P, _Q, R) => [R[1] - R[0], 0],
    why: (L) => `Every point on the line $y = x$ has equal coordinates, so $${L.r2} = ${L.r1}$ and $${L.r2} - ${L.r1} = 0$.`,
  },
  // ---- y = -x
  {
    id: '2a', m: -1, needsR: false, ans: 'A',
    A: (L) => `${L.p1} + ${L.p2}`, B: (L) => `${L.q1} + ${L.q2}`,
    val: (P, Q) => [P[0] + P[1], Q[0] + Q[1]],
    why: (L) => `Above the line, $${L.p1} + ${L.p2} > 0$; below it, $${L.q1} + ${L.q2} < 0$. So Quantity A is positive and Quantity B is negative.`,
  },
  {
    id: '2b', m: -1, needsR: false, ans: 'B',
    A: (L) => `${L.q2}`, B: (L) => `-${L.q1}`,
    val: (_P, Q) => [Q[1], -Q[0]],
    why: (L) => `Below the line means $${L.q2} < -${L.q1}$, which is exactly the comparison asked.`,
  },
  {
    id: '2c', m: -1, needsR: false, ans: 'B',
    A: (L) => `-${L.p1}`, B: (L) => `${L.p2}`,
    val: (P) => [-P[0], P[1]],
    why: (L) => `Above the line means $${L.p2} > -${L.p1}$, which is exactly the comparison asked.`,
  },
  {
    id: '2d', m: -1, needsR: false, ans: 'A',
    A: (L) => `${L.p2} - ${L.q2}`, B: (L) => `${L.q1} - ${L.p1}`,
    val: (P, Q) => [P[1] - Q[1], Q[0] - P[0]],
    why: (L) => `Add $${L.p1} + ${L.q2}$ to both quantities: the comparison becomes $${L.p1} + ${L.p2}$ (positive) versus $${L.q1} + ${L.q2}$ (negative).`,
  },
  {
    id: '2e', m: -1, needsR: true, ans: 'C',
    A: (L) => `${L.r1} + ${L.r2}`, B: () => `0`,
    val: (_P, _Q, R) => [R[0] + R[1], 0],
    why: (L) => `A point on the line $y = -x$ satisfies $${L.r2} = -${L.r1}$, so $${L.r1} + ${L.r2} = 0$.`,
  },
  {
    id: '2f', m: -1, needsR: true, ans: 'C',
    A: (L) => `${L.r2}`, B: (L) => `-${L.r1}`,
    val: (_P, _Q, R) => [R[1], -R[0]],
    why: (L) => `A point on the line $y = -x$ satisfies $${L.r2} = -${L.r1}$.`,
  },
  {
    id: '2g', m: -1, needsR: true, ans: 'A',
    A: (L) => `${L.r1} + ${L.r2}`, B: (L) => `${L.q1} + ${L.q2}`,
    val: (_P, Q, R) => [R[0] + R[1], Q[0] + Q[1]],
    why: (L) => `On the line, $${L.r1} + ${L.r2} = 0$; below the line, $${L.q1} + ${L.q2} < 0$.`,
  },
  // ---- y = 2x
  {
    id: '3a', m: 2, needsR: false, ans: 'A',
    A: (L) => `${L.p2} - 2${L.p1}`, B: (L) => `${L.q2} - 2${L.q1}`,
    val: (P, Q) => [P[1] - 2 * P[0], Q[1] - 2 * Q[0]],
    why: (L) => `Quantity A is positive because $${L.p2} > 2${L.p1}$, and Quantity B is negative because $${L.q2} < 2${L.q1}$.`,
  },
  {
    id: '3b', m: 2, needsR: false, ans: 'B',
    A: (L) => `2${L.p1} + ${L.q2}`, B: (L) => `2${L.q1} + ${L.p2}`,
    val: (P, Q) => [2 * P[0] + Q[1], 2 * Q[0] + P[1]],
    why: (L) => `Add the inequalities $2${L.p1} < ${L.p2}$ and $${L.q2} < 2${L.q1}$: $2${L.p1} + ${L.q2} < ${L.p2} + 2${L.q1}$.`,
  },
  {
    id: '3c', m: 2, needsR: false, ans: 'A',
    A: (L) => `${L.p2} + 2${L.q1}`, B: (L) => `2${L.p1} + ${L.q2}`,
    val: (P, Q) => [P[1] + 2 * Q[0], 2 * P[0] + Q[1]],
    why: (L) => `Add the inequalities $${L.p2} > 2${L.p1}$ and $2${L.q1} > ${L.q2}$: $${L.p2} + 2${L.q1} > 2${L.p1} + ${L.q2}$.`,
  },
  {
    id: '3d', m: 2, needsR: false, ans: 'B',
    A: (L) => `${L.q2} - ${L.p2}`, B: (L) => `2${L.q1} - 2${L.p1}`,
    val: (P, Q) => [Q[1] - P[1], 2 * Q[0] - 2 * P[0]],
    why: (L) => `Add $${L.p2} - 2${L.q1}$ to both quantities: the comparison becomes $${L.q2} - 2${L.q1}$ (negative, since the point is below the line) versus $${L.p2} - 2${L.p1}$ (positive, since the point is above it).`,
  },
  {
    id: '3e', m: 2, needsR: true, ans: 'C',
    A: (L) => `${L.r2}`, B: (L) => `2${L.r1}`,
    val: (_P, _Q, R) => [R[1], 2 * R[0]],
    why: (L) => `A point on the line $y = 2x$ satisfies $${L.r2} = 2${L.r1}$.`,
  },
  {
    id: '3f', m: 2, needsR: true, ans: 'A',
    A: (L) => `${L.p2} - ${L.r2}`, B: (L) => `2${L.p1} - 2${L.r1}`,
    val: (P, _Q, R) => [P[1] - R[1], 2 * P[0] - 2 * R[0]],
    why: (L) => `Since $${L.r2} = 2${L.r1}$, add $${L.r2}$ to both quantities: the comparison becomes $${L.p2}$ versus $2${L.p1}$, and $${L.p2} > 2${L.p1}$ above the line.`,
  },
];

const LETTER_PAIRS: [string, string][] = [
  ['a', 'b'],
  ['c', 'd'],
  ['g', 'h'],
  ['j', 'k'],
  ['p', 'q'],
  ['r', 's'],
  ['u', 'v'],
  ['w', 'z'],
];

interface SideParams {
  cmpId: string;
  m: 1 | -1 | 2;
  P: Pt;
  Q: Pt;
  R: Pt | null;
}

const SIDE_WINDOWS: Record<1 | -1 | 2, { xMin: number; xMax: number; yMin: number; yMax: number }> = {
  1: { xMin: -1, xMax: 7, yMin: -1, yMax: 7 },
  [-1]: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
  2: { xMin: -2, xMax: 5, yMin: -2, yMax: 9 },
};

function sidePoint(rng: Rng, m: number, side: 1 | -1 | 0, w: (typeof SIDE_WINDOWS)[1], avoid: Pt[]): Pt | null {
  for (let tries = 0; tries < 400; tries++) {
    let p: Pt;
    if (side === 0) {
      const x = rng.int(2 * (w.xMin + 1), 2 * (w.xMax - 1)) / 2;
      p = [x, m * x];
      if (p[1] < w.yMin + 1 || p[1] > w.yMax - 1) continue;
    } else {
      p = [rng.int(2 * (w.xMin + 1), 2 * (w.xMax - 1)) / 2, rng.int(2 * (w.yMin + 1), 2 * (w.yMax - 1)) / 2];
      const dist = (p[1] - m * p[0]) / Math.hypot(1, m);
      if (side * dist < 1.1) continue;
    }
    if (Math.hypot(p[0], p[1]) < 1.5) continue;
    // keep points (and their labels) off the axes
    if (side !== 0 && (Math.abs(p[0]) < 1 || Math.abs(p[1]) < 1)) continue;
    if (avoid.some((a) => Math.hypot(a[0] - p[0], a[1] - p[1]) < 2)) continue;
    return p;
  }
  return null;
}

const aboveBelowQC: Template<SideParams> = {
  id: 'alg.coordinate.above-below-qc',
  skill: 'alg.coordinate',
  format: 'qc',
  style: 'points above and below a line through the origin (figure)',
  generate(rng, d) {
    const m: 1 | -1 | 2 = d === 1 ? 1 : d === 2 ? rng.pick([1, -1] as const) : rng.pick([-1, 2] as const);
    const useR = rng.chance(d === 1 ? 0.35 : 0.3);
    const pool = SIDE_CMPS.filter((c) => c.m === m && c.needsR === useR);
    const cmp = rng.pick(pool);
    const [lp, lq, lr] = rng.sample(LETTER_PAIRS, 3);
    const L: L6 = { p1: lp[0], p2: lp[1], q1: lq[0], q2: lq[1], r1: lr[0], r2: lr[1] };
    const w = SIDE_WINDOWS[m];
    const k = m === 1 ? rng.pick([4, 5]) : m === -1 ? rng.pick([-3, -4]) : rng.pick([3, 4]);
    const K: Pt = [k, m * k];
    let P: Pt | null = null;
    let Q: Pt | null = null;
    let R: Pt | null = null;
    for (let tries = 0; tries < 100; tries++) {
      P = sidePoint(rng, m, 1, w, [K]);
      Q = P && sidePoint(rng, m, -1, w, [K, P]);
      R = useR && P && Q ? sidePoint(rng, m, 0, w, [K, P, Q]) : null;
      if (P && Q && (R || !useR)) break;
    }
    if (!P || !Q || (useR && !R)) throw new Error('above-below: could not place the points');

    // Labels: off-line points get their label pushed away from the line, on-line points to one side.
    const nrm = [-m / Math.hypot(1, m), 1 / Math.hypot(1, m)]; // unit normal pointing "above"
    const off = (p: Pt, s: number, dist: number): [number, number] => [p[0] + s * nrm[0] * dist, p[1] + s * nrm[1] * dist];
    const labelDist = m === 2 ? 0.85 : 0.7;
    const kTex = `(${num(K[0])}, ${num(K[1])})`;
    const labels: { at: [number, number]; text: string }[] = [
      { at: off(P, 1, labelDist), text: `$(${L.p1}, ${L.p2})$` },
      { at: off(Q, -1, labelDist), text: `$(${L.q1}, ${L.q2})$` },
      { at: off(K, R ? 1 : -1, labelDist + 0.5), text: `$${kTex}$` },
      { at: [m === -1 ? -0.4 : 0.4, -0.45], text: '$O$' },
    ];
    if (R) labels.push({ at: off(R, -1, labelDist + 0.5), text: `$(${L.r1}, ${L.r2})$` });
    const points: Record<string, Pt> = { P, Q, K };
    if (R) points.R = R;
    const figure: GeometryFigure = {
      kind: 'geometry',
      points,
      hideLabels: Object.keys(points),
      circles: dots(Object.keys(points), w),
      axes: { ...w, step: 1 },
      lines: [{ through: [[0, 0], [K[0], K[1]]], label: '$\\ell$' }],
      labels,
    };

    const eq = m === 1 ? 'y = x' : m === -1 ? 'y = -x' : 'y = 2x';
    const rhs = (xs: string) => (m === 1 ? xs : m === -1 ? `-${xs}` : `2${xs}`);
    const answer = cmp.ans;
    const traps: QCQuestion['traps'] = answer === 'C' ? { D: 'algw-point-on-line' } : { [answer === 'A' ? 'B' : 'A']: 'algw-swap-coordinates' };
    const facts = `Line $\\ell$ passes through the origin and $${kTex}$, so its equation is $${eq}$. A point is above $\\ell$ when its $y$-coordinate is greater than $${rhs('x')}$ and below $\\ell$ when it is less. From the figure, $(${L.p1}, ${L.p2})$ is above $\\ell$, so $${L.p2} > ${rhs(L.p1)}$, and $(${L.q1}, ${L.q2})$ is below $\\ell$, so $${L.q2} < ${rhs(L.q1)}$.${
      R ? ` The point $(${L.r1}, ${L.r2})$ is on $\\ell$, so $${L.r2} = ${rhs(L.r1)}$.` : ''
    }`;
    return {
      params: { cmpId: cmp.id, m, P, Q, R },
      q: {
        format: 'qc',
        figure,
        info: R ? `In the $xy$-plane above, the point $(${L.r1}, ${L.r2})$ lies on line $\\ell$.` : undefined,
        quantityA: `$${cmp.A(L)}$`,
        quantityB: `$${cmp.B(L)}$`,
        answer,
        traps,
        explanation: `${facts}

${cmp.why(L)} ${qcEnd(answer)}

You never need the actual coordinates: the position of each point relative to $\\ell$ gives an inequality, and that is enough.`,
      },
    };
  },
  check(q, { cmpId, m, P, Q, R }, rng) {
    const cmp = SIDE_CMPS.find((c) => c.id === cmpId);
    if (!cmp) return 'unknown comparison';
    const side = (p: Pt) => Math.sign(p[1] - m * p[0]);
    if (side(P) !== 1 || side(Q) !== -1 || (R && side(R) !== 0)) return 'figure points are on the wrong side of the line';
    // Sample arbitrary points with the same positions relative to the line.
    const samples: [number, number][] = [cmp.val(P, Q, R ?? [0, 0])];
    for (let i = 0; i < 400; i++) {
      const a: Pt = [rng.next() * 40 - 20, 0];
      a[1] = m * a[0] + 0.001 + rng.next() * 15;
      const b: Pt = [rng.next() * 40 - 20, 0];
      b[1] = m * b[0] - 0.001 - rng.next() * 15;
      const t = rng.next() * 40 - 20;
      samples.push(cmp.val(a, b, [t, m * t]));
    }
    return expectQc(q, qcFromSamples(samples));
  },
};

/* =============================================================================================
 * 2. Parallel / perpendicular line through a point: intercept (MCS) [GEN AL-G32]
 * =========================================================================================== */

interface PerpParams {
  rel: 'parallel' | 'perp';
  form: 'slope' | 'standard';
  /** Given line: slope form y = m x + b, or standard form A x + B y = C. */
  m: Frac;
  b: Frac;
  A: number;
  B: number;
  C: number;
  p: number;
  q: number;
  ask: 'y' | 'x';
  values: Frac[];
}

const SLOPES_D2 = [frac(2), frac(3), frac(-2), frac(-3), frac(1, 2), frac(-1, 2), frac(1, 3), frac(-1, 3), frac(2, 3), frac(-2, 3), frac(3, 2), frac(-3, 2), frac(4), frac(-1, 4)];

const fmtChoice = (v: Frac) => `$${num(v)}$`;

const perpendicularLine: Template<PerpParams> = {
  id: 'alg.coordinate.parallel-perpendicular',
  skill: 'alg.coordinate',
  format: 'mcs',
  style: 'intercept of a parallel or perpendicular line through a point',
  generate(rng, d) {
    let rel: PerpParams['rel'];
    let form: PerpParams['form'] = 'slope';
    let m: Frac;
    let A = 0;
    let B = 0;
    let C = 0;
    if (d === 1) {
      rel = 'parallel';
      m = frac(rng.pick([1, 2, 3, 4]) * rng.sign());
    } else if (d === 2) {
      rel = rng.chance(0.8) ? 'perp' : 'parallel';
      m = rng.pick(SLOPES_D2);
    } else {
      rel = rng.chance(0.7) ? 'perp' : 'parallel';
      form = 'standard';
      do {
        A = rng.int(1, 5);
        B = rng.int(2, 5) * rng.sign();
      } while (gcd(A, B) !== 1);
      m = frac(-A, B);
    }
    const s = rel === 'parallel' ? m : m.inv().neg(); // slope of the new line k
    const ask: PerpParams['ask'] = d === 3 && rng.chance(0.5) ? 'x' : 'y';
    // Build k first: intercept (or x-intercept) an integer, then a lattice point on it.
    let p = 0;
    let q = 0;
    let bk = frac(0);
    let answer: Frac;
    if (ask === 'y') {
      bk = frac(rng.int(-8, 8));
      const t = rng.pick([1, 2, -1, -2, 3]);
      p = t * s.d;
      q = bk.add(s.mul(p)).toNumber();
      answer = bk;
    } else {
      const x0 = rng.int(-6, 6);
      let t: number;
      do t = rng.pick([1, 2, -1, -2]);
      while (t * s.n === 0);
      p = x0 + t * s.d;
      q = t * s.n;
      bk = frac(q).sub(s.mul(p));
      answer = frac(x0);
    }
    // Given line.
    let b = frac(0);
    if (form === 'slope') {
      do b = frac(rng.int(-7, 7));
      while (rel === 'parallel' && b.eq(bk));
    } else {
      do C = rng.int(-12, 12);
      while (C === 0 || (rel === 'parallel' && frac(C, B).eq(bk)));
      b = frac(C, B);
    }
    const yInt = (slope: Frac, sign = 1) => frac(q).sub(slope.mul(p).mul(sign)); // q - slope*p (sign error with -1)
    const xInt = (slope: Frac, intercept: Frac) => (slope.n === 0 ? null : intercept.neg().div(slope));
    const traps: { value: Frac; trap: string }[] = [];
    const push = (v: Frac | null, trap: string) => {
      if (v && !v.eq(answer) && Math.abs(v.toNumber()) < 100) traps.push({ value: v, trap });
    };
    const wrongSlopes: { slope: Frac; trap: string }[] =
      rel === 'perp'
        ? [
            { slope: m.inv(), trap: form === 'standard' ? 'algw-standard-form-slope' : 'algw-perp-no-sign' },
            { slope: m.neg(), trap: 'algw-perp-no-reciprocal' },
            { slope: m, trap: 'algw-parallel-perp' },
          ]
        : [
            { slope: m.inv().neg(), trap: 'algw-parallel-perp' },
            ...(form === 'standard' ? [{ slope: m.neg(), trap: 'algw-standard-form-slope' }] : []),
          ];
    if (ask === 'y') {
      if (rel === 'parallel') push(b, 'algw-kept-intercept');
      for (const w of wrongSlopes) push(yInt(w.slope), w.trap);
      push(yInt(s, -1), 'algw-intercept-sign');
    } else {
      push(bk, 'algw-x-vs-y-intercept');
      push(bk.div(s), 'algw-intercept-sign');
      for (const w of wrongSlopes) push(xInt(w.slope, yInt(w.slope)), w.trap);
    }
    const dir = rng.sign();
    const fillers = [answer.add(dir), answer.add(2 * dir), answer.sub(dir), answer.add(3 * dir), answer.sub(2 * dir)];
    const { choices, answer: idx, values } = valuedChoices(rng, { correct: answer, traps: traps.slice(0, 3), fillers, format: fmtChoice });

    const givenTex = form === 'slope' ? lineTex(m, b) : `${A === 1 ? '' : A}x ${B < 0 ? '-' : '+'} ${Math.abs(B)}y = ${num(C)}`;
    const relWord = rel === 'parallel' ? 'parallel' : 'perpendicular';
    const stem = `In the $xy$-plane, line $k$ passes through the point $${ptTex(p, q)}$ and is ${relWord} to the line with equation $${givenTex}$. What is the ${
      ask === 'y' ? '$y$' : '$x$'
    }-intercept of line $k$?`;
    const slopeStep =
      form === 'slope'
        ? `The line $${givenTex}$ has slope $${num(m)}$.`
        : `Solve $${givenTex}$ for $y$: $${lineTex(m, b)}$, so its slope is $${num(m)}$ (not $${num(m.neg())}$).`;
    const relStep =
      rel === 'parallel'
        ? `A parallel line has the same slope, $${num(s)}$.`
        : `A perpendicular line has the negative reciprocal slope: $-\\frac{1}{${num(m)}}${m.isInt() ? '' : ''} = ${num(s)}$.`;
    const kLine = lineTex(s, bk);
    const subst = `Substitute $${ptTex(p, q)}$ into $y = ${s.eq(1) ? '' : s.eq(-1) ? '-' : num(s)}x + b$: $${num(q)} = ${num(s.mul(p))} + b$, so $b = ${num(bk)}$ and $k$ is $${kLine}$.`;
    const finish =
      ask === 'y'
        ? `The $y$-intercept is $${num(answer)}$.`
        : `Its $x$-intercept is where $y = 0$: $0 = ${num(s)}x ${bk.sign() < 0 ? '-' : '+'} ${num(bk.abs())}$, so $x = ${num(answer)}$.`;
    const trapNote =
      rel === 'perp'
        ? `Using $${num(m.inv())}$ (reciprocal without the sign change) or $${num(m.neg())}$ (sign change without the reciprocal) gives a wrong line.`
        : ask === 'y'
          ? `The intercept of the given line, $${num(b)}$, is not the answer: $k$ has the same slope but passes through a different point.`
          : `Do not stop at the $y$-intercept $${num(bk)}$: the question asks where $k$ crosses the $x$-axis.`;
    return {
      params: { rel, form, m, b, A, B, C, p, q, ask, values },
      q: {
        format: 'mcs',
        stem,
        choices,
        answer: idx,
        explanation: `${slopeStep} ${relStep}

${subst} ${finish}

${trapNote}`,
      },
    };
  },
  check(q, prm) {
    const err = choiceValuesMatch(q, prm.values, fmtChoice);
    if (err) return err;
    // Direction of the given line from two of its points.
    let dir: [Frac, Frac];
    if (prm.form === 'slope') dir = [frac(1), prm.m.add(prm.b).sub(prm.b)];
    else {
      const y0 = frac(prm.C, prm.B);
      const y1 = frac(prm.C - prm.A * prm.B, prm.B);
      dir = [frac(prm.B), y1.sub(y0)];
    }
    const idx = uniqueIndex(prm.values, (v) => {
      const other: [Frac, Frac] = prm.ask === 'y' ? [frac(0), v] : [v, frac(0)];
      const dk: [Frac, Frac] = [frac(prm.p).sub(other[0]), frac(prm.q).sub(other[1])];
      if (dk[0].n === 0 && dk[1].n === 0) return false;
      const dot = dir[0].mul(dk[0]).add(dir[1].mul(dk[1]));
      const cross = dir[0].mul(dk[1]).sub(dir[1].mul(dk[0]));
      return prm.rel === 'perp' ? dot.n === 0 : cross.n === 0;
    });
    return expectMcs(q, idx);
  },
};

/* =============================================================================================
 * 3. Distance and midpoint (NE) [GEN AL-G34]
 * =========================================================================================== */

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [4, 3, 5],
  [6, 8, 10],
  [8, 6, 10],
  [5, 12, 13],
  [12, 5, 13],
  [9, 12, 15],
  [8, 15, 17],
  [15, 8, 17],
];

interface DistParams {
  mode: 'distance' | 'mid-length' | 'mid-sum' | 'unknown';
  P: Pt;
  Q: Pt;
  M: Pt;
  /** For 'unknown': known point, y of the other point, distance, sign condition on t. */
  y2: number;
  c: number;
  sign: 1 | -1;
}

const distanceMidpoint: Template<DistParams> = {
  id: 'alg.coordinate.distance-midpoint',
  skill: 'alg.coordinate',
  format: 'ne',
  style: 'distance between points, midpoint, unknown coordinate',
  generate(rng, d) {
    const mode: DistParams['mode'] = d === 1 ? 'distance' : d === 2 ? rng.pick(['mid-length', 'mid-sum'] as const) : rng.pick(['unknown', 'unknown', 'mid-sum'] as const);
    const [a, b, c] = rng.pick(d === 1 ? TRIPLES.slice(0, 6) : TRIPLES);
    const sx = rng.sign();
    const sy = rng.sign();
    const P: Pt = [rng.int(-6, 6), rng.int(-6, 6)];
    if (mode === 'distance') {
      const Q: Pt = [P[0] + sx * a, P[1] + sy * b];
      return {
        params: { mode, P, Q, M: [0, 0], y2: 0, c, sign: 1 },
        q: {
          format: 'ne',
          stem: `In the $xy$-plane, what is the distance between the points $${ptTex(P[0], P[1])}$ and $${ptTex(Q[0], Q[1])}$?`,
          answer: frac(c),
          traps: [
            { value: frac(a + b), trap: 'algw-distance-add' },
            { value: frac(c * c), trap: 'algw-distance-no-root' },
          ],
          explanation: `The horizontal change is $|${num(Q[0])} - ${paren(P[0])}| = ${a}$ and the vertical change is $|${num(Q[1])} - ${paren(P[1])}| = ${b}$. They are the legs of a right triangle whose hypotenuse is the distance:

$$\\sqrt{${a}^2 + ${b}^2} = \\sqrt{${a * a + b * b}} = ${c}$$

Adding the legs (${a + b}) or forgetting the square root (${c * c}) are the usual slips.`,
        },
      };
    }
    if (mode === 'mid-length' || mode === 'mid-sum') {
      // P and M differ by (a, b) scaled; Q = 2M - P.
      const M: Pt = [P[0] + sx * a, P[1] + sy * b];
      const Q: Pt = [2 * M[0] - P[0], 2 * M[1] - P[1]];
      if (mode === 'mid-length') {
        return {
          params: { mode, P, Q, M, y2: 0, c, sign: 1 },
          q: {
            format: 'ne',
            stem: `In the $xy$-plane, point $M ${ptTex(M[0], M[1])}$ is the midpoint of line segment $PQ$, and point $P$ has coordinates $${ptTex(P[0], P[1])}$. What is the length of $PQ$?`,
            answer: frac(2 * c),
            traps: [
              { value: frac(c), trap: 'algw-midpoint-half' },
              { value: frac(2 * (a + b)), trap: 'algw-distance-add' },
            ],
            explanation: `From $P$ to $M$ the coordinates change by ${a} horizontally and ${b} vertically, so $PM = \\sqrt{${a}^2 + ${b}^2} = ${c}$.

$M$ is the midpoint, so $PQ = 2 \\cdot PM = ${2 * c}$. (Or find $Q = ${ptTex(Q[0], Q[1])}$ first and use the distance formula.)

${c} is only half of the segment.`,
          },
        };
      }
      const sum = Q[0] + Q[1];
      const wrong: Frac = frac(P[0] + M[0], 2).add(frac(P[1] + M[1], 2));
      const traps: { value: Frac; trap: string }[] = [];
      if (!wrong.eq(sum) && wrong.isTerminating()) traps.push({ value: wrong, trap: 'algw-midpoint-reversed' });
      return {
        params: { mode, P, Q, M, y2: 0, c, sign: 1 },
        q: {
          format: 'ne',
          stem: `In the $xy$-plane, the midpoint of line segment $PQ$ is $${ptTex(M[0], M[1])}$. If $P$ has coordinates $${ptTex(P[0], P[1])}$ and $Q$ has coordinates $(s, t)$, what is the value of $s + t$?`,
          answer: frac(sum),
          traps,
          explanation: `The midpoint averages the coordinates: $\\frac{${num(P[0])} + s}{2} = ${num(M[0])}$ and $\\frac{${num(P[1])} + t}{2} = ${num(M[1])}$.

So $s = 2(${num(M[0])}) - ${paren(P[0])} = ${num(Q[0])}$ and $t = 2(${num(M[1])}) - ${paren(P[1])} = ${num(Q[1])}$, giving $s + t = ${num(sum)}$.

Averaging $P$ with $M$ finds a point between them, not the other endpoint.`,
        },
      };
    }
    // unknown coordinate: distance from (x1, y1) to (t, y2) is c, with a sign condition on t.
    const x1 = rng.int(-(a - 1), a - 1);
    const y2 = P[1] + sy * b;
    const sign: 1 | -1 = rng.sign();
    const t = sign > 0 ? x1 + a : x1 - a;
    const traps: { value: Frac; trap: string }[] = [];
    if (sign * a > 0 && a !== t) traps.push({ value: frac(a), trap: 'algw-difference-as-coordinate' });
    else if (sign < 0 && -a !== t) traps.push({ value: frac(-a), trap: 'algw-difference-as-coordinate' });
    const other = sign > 0 ? x1 - a : x1 + a;
    return {
      params: { mode, P: [x1, P[1]], Q: [t, y2], M: [0, 0], y2, c, sign },
      q: {
        format: 'ne',
        stem: `In the $xy$-plane, the distance between the points $${ptTex(x1, P[1])}$ and $(t, ${num(y2)})$ is ${c}. If $t ${sign > 0 ? '>' : '<'} 0$, what is the value of $t$?`,
        answer: frac(t),
        traps,
        explanation: `By the distance formula, $(t - ${paren(x1)})^2 + (${num(y2)} - ${paren(P[1])})^2 = ${c}^2$, so $(t - ${paren(x1)})^2 = ${c * c} - ${b * b} = ${a * a}$.

Then $t - ${paren(x1)} = ${a}$ or $t - ${paren(x1)} = -${a}$, so $t = ${num(x1 + a)}$ or $t = ${num(x1 - a)}$. Only $${num(t)}$ is ${sign > 0 ? 'positive' : 'negative'}, so $t = ${num(t)}$ (the other value, $${num(other)}$, fails the condition).`,
      },
    };
  },
  check(q, { mode, P, Q, M, y2, c, sign }) {
    if (mode === 'distance') return expectNe(q, Math.round(Math.hypot(Q[0] - P[0], Q[1] - P[1])));
    if (mode === 'mid-length' || mode === 'mid-sum') {
      // Search the other endpoint on the integer grid.
      const hits: Pt[] = [];
      for (let x = -80; x <= 80; x++) for (let y = -80; y <= 80; y++) if (x + P[0] === 2 * M[0] && y + P[1] === 2 * M[1]) hits.push([x, y]);
      if (hits.length !== 1) return 'endpoint not unique';
      const [x, y] = hits[0];
      if (mode === 'mid-sum') return expectNe(q, x + y);
      const len = Math.hypot(x - P[0], y - P[1]);
      if (Math.abs(len - Math.round(len)) > 1e-9) return 'length not an integer';
      return expectNe(q, Math.round(len));
    }
    const sols: number[] = [];
    for (let t = -100; t <= 100; t++) if ((t - P[0]) ** 2 + (y2 - P[1]) ** 2 === c * c && Math.sign(t) === sign) sols.push(t);
    if (sols.length !== 1) return `${sols.length} values of t`;
    return expectNe(q, sols[0]);
  },
};

/* =============================================================================================
 * 4. Which points lie on the graphed line (MCM, figure)
 * =========================================================================================== */

interface OnLineParams {
  A0: Pt;
  A1: Pt;
  pts: Pt[];
}

const pointsOnLine: Template<OnLineParams> = {
  id: 'alg.coordinate.points-on-line',
  skill: 'alg.coordinate',
  format: 'mcm',
  style: 'read a graphed line, then test which points lie on it',
  generate(rng, d) {
    let run: number;
    let rise: number;
    do {
      run = d === 1 ? 1 : d === 2 ? rng.pick([2, 3]) : rng.pick([2, 3, 4]);
      rise = (d === 1 ? rng.int(1, 3) : d === 2 ? rng.int(1, 2) : rng.pick([1, 3])) * rng.sign();
    } while (gcd(run, Math.abs(rise)) !== 1);
    // Start at an x that is a multiple of the run, so the y-intercept is an integer.
    let A0: Pt;
    do A0 = [run * rng.int(Math.ceil(-4 / run), Math.floor((4 - run) / run)), rng.int(-4, 4)];
    while (Math.abs(A0[1] + rise) > 4 || (A0[0] === 0 && A0[1] === 0));
    const A1: Pt = [A0[0] + run, A0[1] + rise];
    const onLine = (p: Pt) => (p[0] - A0[0]) * rise === (p[1] - A0[1]) * run;
    const key = (p: Pt) => `${p[0]},${p[1]}`;
    const inWindow = (p: Pt) => Math.abs(p[0]) <= 5 && Math.abs(p[1]) <= 5;

    const correctCands: Pt[] = [];
    for (let k = -14; k <= 14; k++) {
      const p: Pt = [A0[0] + k * run, A0[1] + k * rise];
      if (k === 0 || k === 1 || Math.abs(p[0]) > 30 || Math.abs(p[1]) > 30) continue;
      if (inWindow(p) && rng.chance(0.7)) continue;
      correctCands.push(p);
    }
    const nCorrect = d === 1 ? rng.int(1, 2) : rng.int(2, 3);
    const correct = rng.sample(correctCands, Math.min(nCorrect, correctCands.length));
    const used = new Set([...correct, A0, A1].map(key));
    const wrong: { p: Pt; trap?: string }[] = [];
    const addWrong = (p: Pt, trap?: string) => {
      if (onLine(p) || used.has(key(p)) || Math.abs(p[0]) > 40 || Math.abs(p[1]) > 40) return;
      used.add(key(p));
      wrong.push({ p, trap });
    };
    const ks = rng.shuffle([2, 3, 4, 5, -2, -3, -4, 6]);
    for (const c of rng.shuffle(correct)) addWrong([c[1], c[0]], 'algw-swap-coordinates');
    for (const k of ks.slice(0, 2)) addWrong([A0[0] + k * Math.abs(rise), A0[1] + k * Math.sign(rise) * run], 'algw-slope-inverted');
    for (const k of ks.slice(2, 4)) addWrong([A0[0] + k * run, A0[1] - k * rise], 'algw-slope-sign');
    for (const c of correct) addWrong([c[0], c[1] + rng.sign()]);
    for (const k of ks) addWrong([A0[0] + k * run + 1, A0[1] + k * rise]);
    const total = d === 1 ? 5 : 6;
    const pickedWrong = rng.shuffle(wrong.slice(0, 6)).slice(0, total - correct.length);
    const items = [...correct.map((p) => ({ p, correct: true as const })), ...pickedWrong.map((w) => ({ p: w.p, correct: false as const, trap: w.trap }))].sort(
      (u, v) => u.p[0] - v.p[0] || u.p[1] - v.p[1],
    );
    const { choices, answer } = flaggedChoices(
      items.map((it) => ({ text: `$${ptTex(it.p[0], it.p[1])}$`, correct: it.correct, ...('trap' in it && it.trap ? { trap: it.trap } : {}) })),
    );
    const m = frac(rise, run);
    const b = frac(A0[1]).sub(m.mul(A0[0]));
    const figure: GeometryFigure = {
      kind: 'geometry',
      points: { U: A0, V: A1 },
      hideLabels: ['U', 'V'],
      circles: dots(['U', 'V'], { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }),
      axes: { xMin: -5, xMax: 5, yMin: -5, yMax: 5, grid: true, step: 1, labelTicks: true },
      lines: [{ through: [A0, A1], label: '$\\ell$' }],
    };
    const checks = items
      .map((it) => {
        const y = m.mul(it.p[0]).add(b);
        const coef = m.eq(1) ? '' : m.eq(-1) ? '-' : num(m);
        const tail = b.n === 0 ? '' : ` ${b.sign() < 0 ? '-' : '+'} ${num(b.abs())}`;
        return `- $${ptTex(it.p[0], it.p[1])}$: $${coef}(${num(it.p[0])})${tail} = ${num(y)}$, ${
          it.correct ? 'on $\\ell$' : `not $${num(it.p[1])}$, so not on $\\ell$`
        }`;
      })
      .join('\n');
    return {
      params: { A0, A1, pts: items.map((it) => it.p) },
      q: {
        format: 'mcm',
        figure,
        stem: `Line $\\ell$ is shown in the $xy$-plane above. Which of the following points lie on line $\\ell$?`,
        instruction: 'Indicate all such points.',
        choices,
        answer,
        explanation: `The marked points of $\\ell$ are $${ptTex(A0[0], A0[1])}$ and $${ptTex(A1[0], A1[1])}$, so the slope is $\\frac{\\text{rise}}{\\text{run}} = \\frac{${rise}}{${run}}${m.isInt() || rise < 0 ? ` = ${num(m)}` : ''}$ and the equation of $\\ell$ is $${lineTex(m, b)}$.

A point lies on $\\ell$ when its $y$-coordinate equals $${poly([m, b])}$:
${checks}

Swapping the coordinates of a point on $\\ell$, or using run over rise for the slope, produces points that are not on $\\ell$.`,
      },
    };
  },
  check(q, { A0, A1, pts }) {
    const cross = (p: Pt) => (A1[0] - A0[0]) * (p[1] - A0[1]) - (A1[1] - A0[1]) * (p[0] - A0[0]);
    return expectMcm(
      q,
      pts.map((p) => cross(p) === 0),
    );
  },
};

/* =============================================================================================
 * 5. Slopes and intercepts compared (QC) [BOOK GE-07; GEN intercept reasoning]
 * =========================================================================================== */

interface SlopeParams {
  mode: 'vs-number' | 'two-lines' | 'through-point' | 'intercepts';
  /** Lines given by two points (vs-number, two-lines). */
  lines: [Pt, Pt][];
  k: number;
  /** For through-point / intercepts: given point, slope sign constraint, y-intercept sign constraint, compared quantities. */
  pt: Pt;
  slopeSign: 1 | -1 | 0;
  icptSign: 1 | -1 | 0;
  qa: 'x-int' | 'y-int';
  qb: 'zero' | 'px' | 'py' | 'y-int';
}

const slopeTex = (P: Pt, Q: Pt) => `\\frac{${num(Q[1])} - ${P[1] < 0 ? `(${num(P[1])})` : num(P[1])}}{${num(Q[0])} - ${P[0] < 0 ? `(${num(P[0])})` : num(P[0])}}`;

const slopeQC: Template<SlopeParams> = {
  id: 'alg.coordinate.slope-qc',
  skill: 'alg.coordinate',
  format: 'qc',
  style: 'compare slopes and intercepts from points or sign information',
  generate(rng, d) {
    const modes: SlopeParams['mode'][] = d === 1 ? ['vs-number', 'vs-number', 'two-lines'] : d === 2 ? ['vs-number', 'two-lines', 'through-point'] : ['through-point', 'intercepts', 'two-lines'];
    const mode = rng.pick(modes);
    const base: SlopeParams = { mode, lines: [], k: 0, pt: [0, 0], slopeSign: 0, icptSign: 0, qa: 'x-int', qb: 'zero' };
    const randLine = (target?: Frac): [Pt, Pt] => {
      for (let tries = 0; ; tries++) {
        if (tries > 5000) throw new Error(`randLine: no line with slope ${target}`);
        const P: Pt = [rng.int(-6, 6), rng.int(-6, 6)];
        const dx = rng.int(1, 6) * rng.sign();
        let dy: number;
        if (target) {
          if (!Number.isInteger((dx * target.n) / target.d)) continue;
          dy = (dx * target.n) / target.d;
        } else dy = rng.int(-6, 6);
        const Q: Pt = [P[0] + dx, P[1] + dy];
        if (Math.abs(Q[1]) > 9) continue;
        if (P[0] >= 0 && P[1] >= 0 && Q[0] >= 0 && Q[1] >= 0 && rng.chance(0.6)) continue; // prefer a negative coordinate
        return dx > 0 ? [P, Q] : [Q, P];
      }
    };
    if (mode === 'vs-number') {
      const k = d === 1 ? 0 : rng.pick([1, -1]);
      // slope exactly k sometimes (C), otherwise near k
      const target = rng.chance(0.25) ? frac(k) : rng.pick([frac(k + 1), frac(k - 1), frac(2 * k + 1, 2), frac(2 * k - 1, 2), frac(k * 3 + 1, 3), frac(k * 3 - 1, 3)]);
      const line = randLine(target);
      const slope = frac(line[1][1] - line[0][1], line[1][0] - line[0][0]);
      const answer = qcCompare(slope, k);
      const swapped = slope.n === 0 ? null : slope.inv();
      const trapAns = swapped ? qcCompare(swapped, k) : null;
      const traps: QCQuestion['traps'] = trapAns && trapAns !== answer ? { [trapAns]: 'algw-slope-inverted' } : undefined;
      const [P, Q] = line;
      return {
        params: { ...base, lines: [line], k },
        q: {
          format: 'qc',
          info: `Line $k$ in the $xy$-plane passes through the points $${ptTex(P[0], P[1])}$ and $${ptTex(Q[0], Q[1])}$.`,
          quantityA: `The slope of line $k$`,
          quantityB: `$${num(k)}$`,
          answer,
          traps,
          explanation: `${
            k === 0
              ? `From $${ptTex(P[0], P[1])}$ to $${ptTex(Q[0], Q[1])}$, $x$ increases and $y$ ${slope.sign() > 0 ? 'increases too, so the line rises and its slope is positive' : slope.sign() < 0 ? 'decreases, so the line falls and its slope is negative' : 'stays the same, so the line is horizontal and its slope is 0'}. No computation is needed. `
              : ''
          }The slope is $${slopeTex(P, Q)} = ${num(slope)}$. Compare $${num(slope)}$ with $${num(k)}$: ${qcEnd(answer)}

Slope is rise over run (change in $y$ over change in $x$), not run over rise.`,
        },
      };
    }
    if (mode === 'two-lines') {
      const SET = [frac(-2), frac(-3, 2), frac(-1), frac(-2, 3), frac(-1, 2), frac(-1, 3), frac(1, 3), frac(1, 2), frac(2, 3), frac(3, 4), frac(1), frac(4, 3), frac(3, 2), frac(2), frac(3)];
      const i1 = rng.int(0, SET.length - 1);
      const t1 = SET[i1];
      const t2 = rng.chance(0.3)
        ? t1
        : rng.pick([SET[i1 - 1], SET[i1 + 1], t1.neg(), t1.inv()].filter((x): x is Frac => x !== undefined && !x.eq(t1)));
      const L1 = randLine(t1);
      const L2 = randLine(t2);
      const s1 = frac(L1[1][1] - L1[0][1], L1[1][0] - L1[0][0]);
      const s2 = frac(L2[1][1] - L2[0][1], L2[1][0] - L2[0][0]);
      const answer = qcCompare(s1, s2);
      const trapAns = s1.n !== 0 && s2.n !== 0 ? qcCompare(s1.inv(), s2.inv()) : null;
      const traps: QCQuestion['traps'] = trapAns && trapAns !== answer ? { [trapAns]: 'algw-slope-inverted' } : undefined;
      return {
        params: { ...base, lines: [L1, L2] },
        q: {
          format: 'qc',
          info: `In the $xy$-plane, line $j$ passes through $${ptTex(L1[0][0], L1[0][1])}$ and $${ptTex(L1[1][0], L1[1][1])}$, and line $k$ passes through $${ptTex(
            L2[0][0],
            L2[0][1],
          )}$ and $${ptTex(L2[1][0], L2[1][1])}$.`,
          quantityA: `The slope of line $j$`,
          quantityB: `The slope of line $k$`,
          answer,
          traps,
          explanation: `Slope of $j$: $${slopeTex(L1[0], L1[1])} = ${num(s1)}$. Slope of $k$: $${slopeTex(L2[0], L2[1])} = ${num(s2)}$.

${answer === 'C' ? 'The slopes are equal (the lines are parallel or the same line).' : `$${num(s1)}$ ${answer === 'A' ? '>' : '<'} $${num(s2)}$.`} ${qcEnd(answer)}`,
        },
      };
    }
    if (mode === 'through-point') {
      // Line through a given point with a slope of known sign: compare an intercept with a coordinate.
      const pt: Pt = [rng.int(1, 6) * rng.sign(), rng.int(1, 6) * rng.sign()];
      const slopeSign: 1 | -1 | 0 = rng.chance(0.35) ? 0 : rng.sign();
      const qa: SlopeParams['qa'] = rng.pick(['x-int', 'y-int'] as const);
      const answer = SLOPE_THROUGH(pt, slopeSign, qa);
      const phrase = slopeSign === 0 ? 'a nonzero slope' : slopeSign > 0 ? 'a positive slope' : 'a negative slope';
      const what = qa === 'x-int' ? '$x$-intercept' : '$y$-intercept';
      const coord = qa === 'x-int' ? pt[0] : pt[1];
      const traps: QCQuestion['traps'] = answer === 'D' ? { [pt[1] * (qa === 'x-int' ? 1 : 1) > 0 ? 'A' : 'B']: 'algw-single-case' } : { [answer === 'A' ? 'B' : 'A']: 'algw-slope-sign' };
      const reason =
        slopeSign === 0
          ? `The slope could be positive or negative. ${qa === 'x-int' ? 'Moving along the line toward the $x$-axis' : 'Moving along the line toward the $y$-axis'} goes in different directions in the two cases, so the ${what} can be on either side of $${num(coord)}$. ${qcEnd('D')}`
          : SLOPE_REASON(pt, slopeSign, qa, answer);
      return {
        params: { ...base, pt, slopeSign, qa, qb: qa === 'x-int' ? 'px' : 'py' },
        q: {
          format: 'qc',
          info: `In the $xy$-plane, line $k$ passes through the point $${ptTex(pt[0], pt[1])}$ and has ${phrase}.`,
          quantityA: `The ${what} of line $k$`,
          quantityB: `$${num(coord)}$`,
          answer,
          traps,
          explanation: `${reason}

A quick sketch through $${ptTex(pt[0], pt[1])}$ settles it without any equation.`,
        },
      };
    }
    // intercepts: sign information only
    const slopeSign: 1 | -1 = rng.sign();
    const icptSign: 1 | -1 = rng.sign();
    const variant = rng.pick(['x-zero', 'x-vs-y'] as const);
    const phrase = `${slopeSign > 0 ? 'a positive' : 'a negative'} slope and ${icptSign > 0 ? 'a positive' : 'a negative'} $y$-intercept`;
    // x-intercept = -b/m: sign = -(icptSign * slopeSign)
    const xSign = -icptSign * slopeSign;
    let answer: QCChoice;
    let qb: SlopeParams['qb'];
    let quantityB: string;
    let why: string;
    if (variant === 'x-zero') {
      qb = 'zero';
      quantityB = '$0$';
      answer = xSign > 0 ? 'A' : 'B';
      why = `For $y = mx + b$, the $x$-intercept is $-\\frac{b}{m}$. Here $b$ is ${icptSign > 0 ? 'positive' : 'negative'} and $m$ is ${slopeSign > 0 ? 'positive' : 'negative'}, so $-\\frac{b}{m}$ is ${xSign > 0 ? 'positive' : 'negative'}. ${qcEnd(answer)}`;
    } else {
      qb = 'y-int';
      quantityB = 'The $y$-intercept of line $k$';
      // x-int vs y-int: signs known if they differ; if both same sign -> D
      answer = xSign === icptSign ? 'D' : xSign > icptSign ? 'A' : 'B';
      why =
        answer === 'D'
          ? `The $x$-intercept $-\\frac{b}{m}$ and the $y$-intercept $b$ are both ${icptSign > 0 ? 'positive' : 'negative'}, but their sizes depend on $m$: with $b = ${icptSign > 0 ? 2 : -2}$, a slope of $${slopeSign > 0 ? 2 : -2}$ gives an $x$-intercept of $${-icptSign * slopeSign}$ (closer to 0 than $b$), while a slope of $${slopeSign > 0 ? '\\frac{1}{2}' : '-\\frac{1}{2}'}$ gives $${-4 * icptSign * slopeSign}$. ${qcEnd('D')}`
          : `The $x$-intercept is $-\\frac{b}{m}$, which is ${xSign > 0 ? 'positive' : 'negative'}, and the $y$-intercept $b$ is ${icptSign > 0 ? 'positive' : 'negative'}. ${qcEnd(answer)}`;
    }
    const traps: QCQuestion['traps'] = answer === 'D' ? { [xSign > 0 ? 'A' : 'B']: 'algw-single-case' } : { [answer === 'A' ? 'B' : 'A']: 'algw-slope-sign' };
    return {
      params: { ...base, slopeSign, icptSign, qa: 'x-int', qb },
      q: {
        format: 'qc',
        info: `In the $xy$-plane, line $k$ has ${phrase}.`,
        quantityA: `The $x$-intercept of line $k$`,
        quantityB,
        answer,
        traps,
        explanation: why,
      },
    };
  },
  check(q, prm, rng) {
    if (prm.mode === 'vs-number' || prm.mode === 'two-lines') {
      // Compare via cross-multiplication of rise and run, without forming the slope.
      const rr = ([P, Q]: [Pt, Pt]) => [Q[1] - P[1], Q[0] - P[0]] as [number, number];
      if (prm.mode === 'vs-number') {
        const [rise, run] = rr(prm.lines[0]);
        const lhs = rise * Math.sign(run);
        const rhs = prm.k * Math.abs(run);
        return expectQc(q, lhs > rhs ? 'A' : lhs < rhs ? 'B' : 'C');
      }
      const [r1, u1] = rr(prm.lines[0]);
      const [r2, u2] = rr(prm.lines[1]);
      const lhs = r1 * u2 * Math.sign(u1 * u2);
      const rhs = r2 * u1 * Math.sign(u1 * u2);
      return expectQc(q, lhs > rhs ? 'A' : lhs < rhs ? 'B' : 'C');
    }
    // Sample concrete lines satisfying the conditions.
    const samples: [number, number][] = [];
    for (let i = 0; i < 400; i++) {
      let m: number;
      let b: number;
      if (prm.mode === 'through-point') {
        const sgn = prm.slopeSign === 0 ? (rng.chance(0.5) ? 1 : -1) : prm.slopeSign;
        m = sgn * (0.05 + rng.next() * 6);
        b = prm.pt[1] - m * prm.pt[0];
      } else {
        m = prm.slopeSign * (0.05 + rng.next() * 6);
        b = prm.icptSign * (0.05 + rng.next() * 10);
      }
      const xInt = -b / m;
      const A = prm.qa === 'x-int' ? xInt : b;
      const B = prm.qb === 'zero' ? 0 : prm.qb === 'px' ? prm.pt[0] : prm.qb === 'py' ? prm.pt[1] : b;
      samples.push([A, B]);
    }
    return expectQc(q, qcFromSamples(samples));
  },
};

/** Through (px, py) with slope sign s: where is the x- (or y-) intercept relative to px (or py)? */
function SLOPE_THROUGH(pt: Pt, s: 1 | -1 | 0, qa: 'x-int' | 'y-int'): QCChoice {
  if (s === 0) return 'D';
  if (qa === 'x-int') {
    // y = py + s*(x - px)*|m|; reach y = 0 at x = px - py/m
    const shift = -pt[1] * s; // sign of (xInt - px)
    return shift > 0 ? 'A' : 'B';
  }
  // y-int = py - m*px: sign of (yInt - py) = -s * px
  return -s * pt[0] > 0 ? 'A' : 'B';
}

function SLOPE_REASON(pt: Pt, s: 1 | -1, qa: 'x-int' | 'y-int', ans: QCChoice): string {
  const [px, py] = pt;
  if (qa === 'x-int') {
    const dir = py > 0 ? 'down' : 'up';
    const goes = s > 0 ? (py > 0 ? 'to the left' : 'to the right') : py > 0 ? 'to the right' : 'to the left';
    return `To reach the $x$-axis from $${ptTex(px, py)}$ the line must go ${dir} ${Math.abs(py)} unit${Math.abs(py) === 1 ? '' : 's'}. With a ${
      s > 0 ? 'positive' : 'negative'
    } slope, going ${dir} means moving ${goes}, so the $x$-intercept is ${ans === 'A' ? 'greater' : 'less'} than $${num(px)}$. ${qcEnd(ans)}`;
  }
  const dir = px > 0 ? 'left' : 'right';
  const goes = s > 0 ? (px > 0 ? 'down' : 'up') : px > 0 ? 'up' : 'down';
  return `To reach the $y$-axis from $${ptTex(px, py)}$ the line must move ${Math.abs(px)} unit${Math.abs(px) === 1 ? '' : 's'} to the ${dir}. With a ${
    s > 0 ? 'positive' : 'negative'
  } slope, moving ${dir} means going ${goes}, so the $y$-intercept is ${ans === 'A' ? 'greater' : 'less'} than $${num(py)}$. ${qcEnd(ans)}`;
}

/* =============================================================================================
 * 6. Quadrants a line passes through, from sign information (MCM) [BOOK GE-16]
 * =========================================================================================== */

interface QuadParams {
  slope: 1 | -1 | 0;
  /** 'y' / 'x' = sign of that intercept; 'origin' = passes through O; 'point' = through a point in the given quadrant. */
  given: 'y' | 'x' | 'origin' | 'point';
  sign: 1 | -1;
  quadrant: number;
}

const QUAD_NAMES = ['I', 'II', 'III', 'IV'];
const quadOf = (x: number, y: number) => (x > 0 && y > 0 ? 1 : x < 0 && y > 0 ? 2 : x < 0 && y < 0 ? 3 : x > 0 && y < 0 ? 4 : 0);

/** Quadrants crossed by the infinite line y = m x + b: one sample point inside each piece between the axis crossings. */
function crossedQuadrants(m: number, b: number): Set<number> {
  const cuts = m === 0 ? [0] : [0, -b / m].sort((u, v) => u - v);
  const xs = [cuts[0] - 1, (cuts[0] + cuts[cuts.length - 1]) / 2, cuts[cuts.length - 1] + 1, cuts[0] - 1000, cuts[cuts.length - 1] + 1000];
  const out = new Set<number>();
  for (const x of xs) {
    const qd = quadOf(x, m * x + b);
    if (qd) out.add(qd);
  }
  return out;
}

/** Quadrants from the sign facts alone: the line passes through the two quadrants next to each intercept. */
function quadrantsBySigns(slope: 1 | -1 | 0, given: QuadParams['given'], sign: 1 | -1, quadrant: number): number[] {
  if (slope === 0) return sign > 0 ? [1, 2] : [3, 4];
  if (given === 'origin') return slope > 0 ? [1, 3] : [2, 4];
  let ySign: number;
  let xSign: number;
  if (given === 'y') [ySign, xSign] = [sign, -sign * slope];
  else if (given === 'x') [xSign, ySign] = [sign, -sign * slope];
  else [xSign, ySign] = [quadrant === 1 || quadrant === 4 ? 1 : -1, quadrant <= 2 ? 1 : -1];
  const set = new Set([...(ySign > 0 ? [1, 2] : [3, 4]), ...(xSign > 0 ? [1, 4] : [2, 3])]);
  return [...set].sort();
}

const quadrantsCrossed: Template<QuadParams> = {
  id: 'alg.coordinate.quadrants',
  skill: 'alg.coordinate',
  format: 'mcm',
  style: 'quadrants a line passes through, from signs of its slope and intercept',
  generate(rng, d) {
    let slope: QuadParams['slope'] = rng.chance(d === 1 ? 0.15 : 0.08) ? 0 : rng.sign();
    let given: QuadParams['given'] = d === 1 ? 'y' : d === 2 ? rng.pick(['x', 'x', 'y', 'origin'] as const) : rng.pick(['x', 'point', 'point'] as const);
    if (slope === 0 && given !== 'y') given = 'y';
    if (given === 'origin' && slope === 0) slope = 1;
    const sign: 1 | -1 = rng.sign();
    // A point fixes the quadrants only when the slope pushes both intercepts away from it:
    // positive slope through Quadrant II or IV, negative slope through Quadrant I or III.
    const quadrant = slope > 0 ? rng.pick([2, 4]) : rng.pick([1, 3]);
    const crossed = new Set(quadrantsBySigns(slope, given, sign, quadrant));
    const { choices, answer } = flaggedChoices(QUAD_NAMES.map((nm, i) => ({ text: `Quadrant ${nm}`, correct: crossed.has(i + 1) })));
    const slopeWord = slope > 0 ? 'a positive slope' : slope < 0 ? 'a negative slope' : 'slope 0';
    const info =
      given === 'y'
        ? `${slopeWord} and a ${sign > 0 ? 'positive' : 'negative'} $y$-intercept`
        : given === 'x'
          ? `${slopeWord} and a ${sign > 0 ? 'positive' : 'negative'} $x$-intercept`
          : given === 'origin'
            ? `${slopeWord} and passes through the origin`
            : `${slopeWord} and passes through a point $(a, b)$ with $a ${quadrant === 1 || quadrant === 4 ? '>' : '<'} 0$ and $b ${quadrant <= 2 ? '>' : '<'} 0$`;
    const list = [...crossed].sort().map((i) => QUAD_NAMES[i - 1]);
    const listText = list.length === 2 ? `${list[0]} and ${list[1]}` : `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
    const sketch =
      given === 'origin'
        ? `A line through the origin with ${slopeWord} goes ${slope > 0 ? 'from the lower left to the upper right' : 'from the upper left to the lower right'}, through Quadrants ${listText} (the origin itself is in no quadrant).`
        : slope === 0
          ? `A line with slope 0 is horizontal. It sits ${sign > 0 ? 'above' : 'below'} the $x$-axis and runs through Quadrants ${listText}.`
          : given === 'point'
            ? `Start at the point $(a, b)$ in Quadrant ${QUAD_NAMES[quadrant - 1]}. A line with ${slopeWord} ${slope > 0 ? 'rises to the right and falls to the left' : 'falls to the right and rises to the left'}; follow it both ways from that point. It passes through Quadrants ${listText}.`
            : `Sketch it: mark the ${given === 'y' ? '$y$' : '$x$'}-intercept on the ${sign > 0 ? 'positive' : 'negative'} ${given === 'y' ? '$y$' : '$x$'}-axis and draw a line that ${
                slope > 0 ? 'rises from left to right' : 'falls from left to right'
              } through it. Such a line crosses the other axis on its ${
                given === 'y' ? (-sign * slope > 0 ? 'positive' : 'negative') : -sign * slope > 0 ? 'positive' : 'negative'
              } side, so it passes through Quadrants ${listText}.`;
    return {
      params: { slope, given, sign, quadrant },
      q: {
        format: 'mcm',
        figure: {
          kind: 'geometry',
          points: {},
          axes: { xMin: -4, xMax: 4, yMin: -4, yMax: 4, step: 5 },
          labels: [
            { at: [2, 2], text: 'I' },
            { at: [-2, 2], text: 'II' },
            { at: [-2, -2], text: 'III' },
            { at: [2, -2], text: 'IV' },
            { at: [-0.35, -0.35], text: '$O$' },
          ],
        },
        stem: `In the $xy$-plane, line $m$ (not shown) has ${info}. Which of the quadrants labeled above does line $m$ pass through?`,
        instruction: 'Indicate all such quadrants.',
        choices,
        answer,
        explanation: `${sketch}

${given === 'origin' || slope === 0 ? '' : 'A nonhorizontal line that does not pass through the origin always crosses exactly three quadrants; the signs tell you which one it misses.'}`.trim(),
      },
    };
  },
  check(q, { slope, given, sign, quadrant }, rng) {
    let first: string | null = null;
    for (let i = 0; i < 60; i++) {
      const rep = repLine(slope, given, sign, quadrant, 0.2 + rng.next() * 5, rng.next());
      const set = [...crossedQuadrants(rep.m, rep.b)].sort().join(',');
      if (first === null) first = set;
      else if (first !== set) return 'quadrants depend on the line chosen';
    }
    const flags = [1, 2, 3, 4].map((i) => first!.split(',').includes(String(i)));
    return expectMcm(q, flags);
  },
};

/** A concrete line satisfying the sign conditions. `mag` scales the slope, `u` in [0,1) varies the rest. */
function repLine(slope: 1 | -1 | 0, given: QuadParams['given'], sign: 1 | -1, quadrant: number, mag: number, u = 0.37): { m: number; b: number } {
  const m = slope * mag;
  const c = 0.5 + 6 * u;
  if (given === 'y') return { m, b: sign * c };
  if (given === 'origin') return { m, b: 0 };
  if (given === 'x') return { m, b: -m * sign * c };
  const px = (quadrant === 1 || quadrant === 4 ? 1 : -1) * (0.5 + 4 * u);
  const py = (quadrant <= 2 ? 1 : -1) * (0.5 + 4 * ((u * 7) % 1));
  return { m, b: py - m * px };
}

export const coordinateTemplates: Template<any>[] = [aboveBelowQC, perpendicularLine, distanceMidpoint, pointsOnLine, slopeQC, quadrantsCrossed];

