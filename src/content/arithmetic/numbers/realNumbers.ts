import { flaggedChoices, qcFromSamples } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import type { Choice, Difficulty, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { expectMCM, expectMCS, expectNE, expectQC, F, pickWeighted, qcEnd, qcFromFloatSamples, swapQC } from './util';

/* ------------------------------------------------------------------ intervals */

/** Interval with optional infinite ends (null). */
interface Iv {
  lo: Frac | null;
  hi: Frac | null;
  loC: boolean;
  hiC: boolean;
}

const iv = (lo: number | null, hi: number | null, loC: boolean, hiC: boolean): Iv => ({
  lo: lo === null ? null : F(lo),
  hi: hi === null ? null : F(hi),
  loC,
  hiC,
});

function inIv(x: Frac, I: Iv): boolean {
  if (I.lo && (I.loC ? x.lt(I.lo) : !x.gt(I.lo))) return false;
  if (I.hi && (I.hiC ? x.gt(I.hi) : !x.lt(I.hi))) return false;
  return true;
}
const inSet = (x: Frac, S: Iv[]) => S.some((I) => inIv(x, I));

/** I is inside J. */
function ivInside(I: Iv, J: Iv): boolean {
  const loOk = !J.lo || (I.lo !== null && (J.lo.lt(I.lo) || (J.lo.eq(I.lo) && (J.loC || !I.loC))));
  const hiOk = !J.hi || (I.hi !== null && (J.hi.gt(I.hi) || (J.hi.eq(I.hi) && (J.hiC || !I.hiC))));
  return loOk && hiOk;
}
/** Every interval of A sits inside one interval of B (B is written with maximal, non-touching intervals). */
const setInside = (A: Iv[], B: Iv[]) => A.every((I) => B.some((J) => ivInside(I, J)));
const contains0 = (S: Iv[]) => inSet(F(0), S);

function ivTex(I: Iv, v: string): string {
  const lo = I.lo ? I.lo.toTex() : null;
  const hi = I.hi ? I.hi.toTex() : null;
  if (lo === null && hi === null) return `${v} \\text{ is any number}`;
  if (lo === null) return `${v} ${I.hiC ? '\\le' : '<'} ${hi}`;
  if (hi === null) return `${v} ${I.loC ? '\\ge' : '>'} ${lo}`;
  return `${lo} ${I.loC ? '\\le' : '<'} ${v} ${I.hiC ? '\\le' : '<'} ${hi}`;
}

function setTex(S: Iv[], v: string): string {
  // x != 0 special case
  if (S.length === 2 && !S[0].lo && !S[1].hi && S[0].hi?.eq(0) && S[1].lo?.eq(0) && !S[0].hiC && !S[1].loC) return `${v} \\ne 0`;
  return S.map((I) => ivTex(I, v)).join(' \\text{ or } ');
}

/** Dense exact samples of a set: grid with denominator `den` plus the included endpoints. */
function sampleSet(S: Iv[], den: number, far = 6): Frac[] {
  const out: Frac[] = [];
  for (const I of S) {
    const lo = I.lo ?? F(-far);
    const hi = I.hi ?? F(far);
    for (let k = Math.ceil(lo.toNumber() * den); k <= Math.floor(hi.toNumber() * den); k++) {
      const x = F(k, den);
      if (inIv(x, I)) out.push(x);
    }
    for (const e of [I.lo, I.hi]) if (e && inIv(e, I)) out.push(e);
    // points hugging open ends
    for (const e of [I.lo, I.hi]) if (e) for (const eps of [F(1, 1000), F(-1, 1000), F(1, 997), F(-1, 997)]) if (inIv(e.add(eps), I)) out.push(e.add(eps));
    if (!I.hi) out.push(F(50), F(1000));
    if (!I.lo) out.push(F(-50), F(-1000));
  }
  return out;
}

/* ================================================================== 1. Bound on z: which statements must be true (MCM) */

interface Cond {
  tex: string;
  set: Iv[];
  d: Difficulty;
}

const CONDS: Cond[] = [
  { tex: '|z| \\le 1', set: [iv(-1, 1, true, true)], d: 1 },
  { tex: '0 < z < 1', set: [iv(0, 1, false, false)], d: 1 },
  { tex: '-1 < z < 0', set: [iv(-1, 0, false, false)], d: 1 },
  { tex: 'z > 1', set: [iv(1, null, false, false)], d: 1 },
  { tex: 'z < -1', set: [iv(null, -1, false, false)], d: 1 },
  { tex: '|z| < 1', set: [iv(-1, 1, false, false)], d: 2 },
  { tex: '-1 \\le z \\le 0', set: [iv(-1, 0, true, true)], d: 2 },
  { tex: '0 \\le z \\le 1', set: [iv(0, 1, true, true)], d: 2 },
  { tex: '|z| \\ge 1', set: [iv(null, -1, false, true), iv(1, null, true, false)], d: 2 },
  { tex: '0 < |z| < 1', set: [iv(-1, 0, false, false), iv(0, 1, false, false)], d: 2 },
  { tex: '|z - 1| < 1', set: [iv(0, 2, false, false)], d: 3 },
  { tex: '|z + 1| \\le 1', set: [iv(-2, 0, true, true)], d: 3 },
  { tex: '|2z - 1| < 1', set: [iv(0, 1, false, false)], d: 3 },
  { tex: '|z| > 1', set: [iv(null, -1, false, false), iv(1, null, false, false)], d: 3 },
];

interface Stmt {
  tex: string;
  set: Iv[];
  /** Exact evaluation (z != 0 when nz). */
  f: (z: Frac) => boolean;
  nz?: boolean;
  recip?: boolean;
}

const sq = (z: Frac) => z.mul(z);
const cube = (z: Frac) => z.mul(z).mul(z);

const STMTS: Stmt[] = [
  { tex: 'z^2 \\le 1', set: [iv(-1, 1, true, true)], f: (z) => !sq(z).gt(1) },
  { tex: 'z^2 < 1', set: [iv(-1, 1, false, false)], f: (z) => sq(z).lt(1) },
  { tex: 'z^2 \\le z', set: [iv(0, 1, true, true)], f: (z) => !sq(z).gt(z) },
  { tex: 'z^2 < z', set: [iv(0, 1, false, false)], f: (z) => sq(z).lt(z) },
  { tex: 'z^3 \\le z', set: [iv(null, -1, false, true), iv(0, 1, true, true)], f: (z) => !cube(z).gt(z) },
  { tex: 'z^3 < z', set: [iv(null, -1, false, false), iv(0, 1, false, false)], f: (z) => cube(z).lt(z) },
  { tex: 'z^3 \\le z^2', set: [iv(null, 1, false, true)], f: (z) => !cube(z).gt(sq(z)) },
  { tex: 'z^3 < z^2', set: [iv(null, 0, false, false), iv(0, 1, false, false)], f: (z) => cube(z).lt(sq(z)) },
  { tex: '\\frac{1}{z} < z', set: [iv(-1, 0, false, false), iv(1, null, false, false)], f: (z) => z.inv().lt(z), nz: true, recip: true },
  { tex: '\\frac{1}{z} > z', set: [iv(null, -1, false, false), iv(0, 1, false, false)], f: (z) => z.inv().gt(z), nz: true, recip: true },
  { tex: '|z^3| \\le |z|', set: [iv(-1, 1, true, true)], f: (z) => !cube(z).abs().gt(z.abs()) },
  { tex: 'z^4 \\le z^2', set: [iv(-1, 1, true, true)], f: (z) => !sq(sq(z)).gt(sq(z)) },
  { tex: 'z^2 \\ge z', set: [iv(null, 0, false, true), iv(1, null, true, false)], f: (z) => !sq(z).lt(z) },
  { tex: 'z^3 \\ge z', set: [iv(-1, 0, true, true), iv(1, null, true, false)], f: (z) => !cube(z).lt(z) },
  { tex: '-z \\le 1', set: [iv(-1, null, true, false)], f: (z) => !z.neg().gt(1) },
  { tex: 'z^2 > 0', set: [iv(null, 0, false, false), iv(0, null, false, false)], f: (z) => sq(z).gt(0) },
  { tex: '\\frac{1}{z^2} \\ge 1', set: [iv(-1, 0, true, false), iv(0, 1, false, true)], f: (z) => !sq(z).inv().lt(1), nz: true, recip: true },
  { tex: 'z^2 \\le |z|', set: [iv(-1, 1, true, true)], f: (z) => !sq(z).gt(z.abs()) },
  { tex: 'z < z^2', set: [iv(null, 0, false, false), iv(1, null, false, false)], f: (z) => z.lt(sq(z)) },
  { tex: 'z^3 > 0', set: [iv(0, null, false, false)], f: (z) => cube(z).gt(0) },
];

const NICE: Frac[] = [F(-1, 2), F(1), F(-1), F(0), F(1, 2), F(2), F(-2), F(3, 2), F(-3, 2), F(1, 3), F(-1, 3), F(1, 4), F(-1, 4), F(3), F(-3), F(5, 4), F(-5, 4)];

function fracTex(x: Frac): string {
  return x.toTex();
}

interface MustParams {
  cond: number;
  stmts: number[];
}

const BOOK_COMBO = new Set(['z^2 \\le 1', 'z^2 \\le z', 'z^3 \\le z']);

const mustBeTrue: Template<MustParams> = {
  id: 'arith.real-numbers.must-be-true',
  skill: 'arith.real-numbers',
  format: 'mcm',
  style: 'bound on z: which power inequalities must be true',
  generate(rng, d) {
    const condPool = CONDS.map((c, i) => ({ c, i })).filter(({ c }) => c.d <= d && (d === 1 || c.d >= d - 1));
    for (;;) {
      const { c: cond, i: condIdx } = d === 1 && rng.chance(0.4) ? { c: CONDS[0], i: 0 } : rng.pick(condPool);
      const allowed = STMTS.map((s, i) => ({ s, i })).filter(({ s }) => !(s.nz && contains0(cond.set)));
      const n = d === 1 ? 3 : d === 2 ? rng.pick([3, 4]) : rng.pick([4, 5]);
      const picked = rng.sample(allowed, n);
      const truth = picked.map(({ s }) => setInside(cond.set, s.set));
      const nTrue = truth.filter(Boolean).length;
      if (nTrue === 0 || nTrue === n) continue;
      if (condIdx === 0 && picked.every(({ s }) => BOOK_COMBO.has(s.tex))) continue;
      // Avoid two statements with the same truth set and the same "shape" (e.g. z^2 <= 1 and z^4 <= z^2 together is fine, identical sets are not).
      const keys = picked.map(({ s }) => JSON.stringify(s.set.map((I) => [I.lo?.toString(), I.hi?.toString(), I.loC, I.hiC])));
      if (new Set(keys).size < n) continue;
      const lines: string[] = [];
      const choices: (Choice & { correct: boolean })[] = [];
      for (const [k, { s }] of picked.entries()) {
        if (truth[k]) {
          lines.push(`- $${s.tex}$ holds exactly when $${setTex(s.set, 'z')}$, and every allowed $z$ is in that range ✓`);
          choices.push({ text: `$${s.tex}$`, correct: true });
          continue;
        }
        const cx = NICE.find((x) => inSet(x, cond.set) && !(s.nz && x.n === 0) && !s.f(x));
        if (!cx) throw new Error(`no counterexample for ${s.tex} under ${cond.tex}`);
        const endpoint = cond.set.some((I) => (I.lo && I.loC && I.lo.eq(cx)) || (I.hi && I.hiC && I.hi.eq(cx)));
        const trap = s.recip ? 'reciprocal-direction' : cx.sign() < 0 ? 'negative-fraction-sign' : endpoint ? 'num-boundary-value' : 'tested-one-value';
        lines.push(`- $${s.tex}$ fails for $z = ${fracTex(cx)}$${endpoint ? ' (an allowed endpoint)' : ''}: ${evalText(s.tex, cx)} ✗`);
        choices.push({ text: `$${s.tex}$`, correct: false, trap });
      }
      const { choices: ch, answer } = flaggedChoices(choices);
      const tests = condTests(cond);
      return {
        params: { cond: condIdx, stmts: picked.map(({ i }) => i) },
        q: {
          format: 'mcm',
          stem: `If $${cond.tex}$, which of the following statements must be true?`,
          instruction: 'Indicate all such statements.',
          choices: ch,
          answer,
          explanation: `The allowed values are $${setTex(cond.set, 'z')}$. A statement must be true only if it holds for EVERY allowed $z$, so test ${tests}, and remember that one counterexample is enough to rule a statement out.
${lines.join('\n')}`,
        },
      };
    }
  },
  check(q, { cond, stmts }) {
    // Dense exact sampling of the allowed values (grid, endpoints, points next to the ends).
    const xs = sampleSet(CONDS[cond].set, 48);
    const expected = stmts.flatMap((si, i) => {
      const s = STMTS[si];
      return xs.every((x) => (s.nz && x.n === 0 ? false : s.f(x))) ? [i] : [];
    });
    return expectMCM(q, expected);
  },
};

function condTests(c: Cond): string {
  const pts: string[] = [];
  for (const I of c.set) {
    if (I.lo && I.loC) pts.push(I.lo.toTex());
    if (I.hi && I.hiC) pts.push(I.hi.toTex());
  }
  const hasNeg = c.set.some((I) => !I.lo || I.lo.lt(0));
  const hasPos = c.set.some((I) => !I.hi || I.hi.gt(0));
  const parts: string[] = [];
  if (pts.length) parts.push(`the endpoints ($${[...new Set(pts)].join('$, $')}$)`);
  if (hasNeg && hasPos) parts.push('a negative value and a positive value');
  else parts.push(hasNeg ? 'negative values close to 0 and far from 0' : 'values close to 0 and far from 0');
  return parts.join(' and ');
}

/** "z^2 = 1/4 > z = -1/2" style text for a counterexample. */
function evalText(tex: string, z: Frac): string {
  const t = z.toTex();
  const p = (x: Frac) => x.toTex();
  const z2 = z.mul(z);
  const z3 = z2.mul(z);
  const parts: Record<string, () => string> = {
    'z^2 \\le 1': () => `$z^2 = ${p(z2)} > 1$`,
    'z^2 < 1': () => `$z^2 = ${p(z2)}$, which is not less than 1`,
    'z^2 \\le z': () => `$z^2 = ${p(z2)} > ${t}$`,
    'z^2 < z': () => `$z^2 = ${p(z2)}$, which is not less than $${t}$`,
    'z^3 \\le z': () => `$z^3 = ${p(z3)} > ${t}$`,
    'z^3 < z': () => `$z^3 = ${p(z3)}$, which is not less than $${t}$`,
    'z^3 \\le z^2': () => `$z^3 = ${p(z3)} > z^2 = ${p(z2)}$`,
    'z^3 < z^2': () => `$z^3 = ${p(z3)}$ and $z^2 = ${p(z2)}$`,
    '\\frac{1}{z} < z': () => `$\\frac{1}{z} = ${p(z.inv())}$, which is not less than $${t}$`,
    '\\frac{1}{z} > z': () => `$\\frac{1}{z} = ${p(z.inv())}$, which is not greater than $${t}$`,
    '|z^3| \\le |z|': () => `$|z^3| = ${p(z3.abs())} > ${p(z.abs())}$`,
    'z^4 \\le z^2': () => `$z^4 = ${p(z2.mul(z2))} > z^2 = ${p(z2)}$`,
    'z^2 \\ge z': () => `$z^2 = ${p(z2)} < ${t}$`,
    'z^3 \\ge z': () => `$z^3 = ${p(z3)} < ${t}$`,
    '-z \\le 1': () => `$-z = ${p(z.neg())} > 1$`,
    'z^2 > 0': () => `$z^2 = ${p(z2)}$`,
    '\\frac{1}{z^2} \\ge 1': () => `$\\frac{1}{z^2} = ${p(z2.inv())} < 1$`,
    'z^2 \\le |z|': () => `$z^2 = ${p(z2)} > |z| = ${p(z.abs())}$`,
    'z < z^2': () => `$z^2 = ${p(z2)}$, which is not greater than $${t}$`,
    'z^3 > 0': () => `$z^3 = ${p(z3)}$`,
  };
  return parts[tex]();
}

/* ------------------------------------------------------------------ expressions in x */

interface Ex {
  tex: string;
  f: (x: Frac) => Frac | null; // null when undefined or irrational (sqrt)
  num: (x: number) => number;
  nz?: boolean;
  nonneg?: boolean;
}

function sqrtFrac(x: Frac): Frac | null {
  const a = Math.round(Math.sqrt(x.n));
  const b = Math.round(Math.sqrt(x.d));
  return a * a === x.n && b * b === x.d ? F(a, b) : null;
}

const EXPRS: Ex[] = [
  { tex: 'x', f: (x) => x, num: (x) => x },
  { tex: '-x', f: (x) => x.neg(), num: (x) => -x },
  { tex: 'x^2', f: (x) => x.pow(2), num: (x) => x ** 2 },
  { tex: 'x^3', f: (x) => x.pow(3), num: (x) => x ** 3 },
  { tex: 'x^4', f: (x) => x.pow(4), num: (x) => x ** 4 },
  { tex: 'x^5', f: (x) => x.pow(5), num: (x) => x ** 5 },
  { tex: '\\frac{1}{x}', f: (x) => (x.n === 0 ? null : x.inv()), num: (x) => 1 / x, nz: true },
  { tex: '\\frac{1}{x^2}', f: (x) => (x.n === 0 ? null : x.pow(-2)), num: (x) => 1 / x ** 2, nz: true },
  { tex: '|x|', f: (x) => x.abs(), num: (x) => Math.abs(x) },
  { tex: '\\sqrt{x}', f: (x) => (x.sign() < 0 ? null : sqrtFrac(x)), num: (x) => Math.sqrt(x), nonneg: true },
  { tex: '-x^3', f: (x) => x.pow(3).neg(), num: (x) => -(x ** 3) },
];
const CONSTS: Ex[] = [
  { tex: '0', f: () => F(0), num: () => 0 },
  { tex: '1', f: () => F(1), num: () => 1 },
];

interface QCond {
  tex: string;
  set: Iv[];
  d: Difficulty;
}

const QCONDS: QCond[] = [
  { tex: '0 < x < 1', set: [iv(0, 1, false, false)], d: 1 },
  { tex: '-1 < x < 0', set: [iv(-1, 0, false, false)], d: 1 },
  { tex: 'x > 1', set: [iv(1, null, false, false)], d: 1 },
  { tex: 'x < -1', set: [iv(null, -1, false, false)], d: 1 },
  { tex: 'x < 0', set: [iv(null, 0, false, false)], d: 1 },
  { tex: '-1 \\le x \\le 0', set: [iv(-1, 0, true, true)], d: 2 },
  { tex: '0 \\le x \\le 1', set: [iv(0, 1, true, true)], d: 2 },
  { tex: '0 < x \\le 1', set: [iv(0, 1, false, true)], d: 2 },
  { tex: '-1 < x < 1', set: [iv(-1, 1, false, false)], d: 2 },
  { tex: 'x > 0', set: [iv(0, null, false, false)], d: 2 },
  { tex: '0 < |x| < 1', set: [iv(-1, 0, false, false), iv(0, 1, false, false)], d: 3 },
  { tex: '|x| \\ge 1', set: [iv(null, -1, false, true), iv(1, null, true, false)], d: 3 },
  { tex: '|x| > 1', set: [iv(null, -1, false, false), iv(1, null, false, false)], d: 3 },
  { tex: 'x \\le -1', set: [iv(null, -1, false, true)], d: 3 },
];

/** Representative test points: one inside each region cut by -1, 0, 1, plus the included endpoints. */
function repPoints(S: Iv[]): { x: Frac; endpoint: boolean; boundary: boolean }[] {
  const reps = [F(-2), F(-1, 2), F(1, 4), F(4)];
  const out = reps.filter((x) => inSet(x, S)).map((x) => ({ x, endpoint: false, boundary: false }));
  const isEnd = (e: Frac) => S.some((I) => (I.lo?.eq(e) && I.loC) || (I.hi?.eq(e) && I.hiC));
  for (const e of [F(-1), F(0), F(1)]) if (inSet(e, S)) out.push({ x: e, endpoint: isEnd(e), boundary: true });
  return out;
}

const usable = (e: Ex, S: Iv[]) => !(e.nz && contains0(S)) && !(e.nonneg && S.some((I) => !I.lo || I.lo.lt(0)));

/* ================================================================== 2. Compare two expressions of x on an interval (QC) */

interface OrderParams {
  cond: number;
  a: string;
  b: string;
}

function exprByTex(t: string): Ex {
  return [...EXPRS, ...CONSTS].find((e) => e.tex === t)!;
}

const orderQC: Template<OrderParams> = {
  id: 'arith.real-numbers.order-qc',
  skill: 'arith.real-numbers',
  format: 'qc',
  style: 'compare powers and reciprocals of x on an interval',
  generate(rng, d) {
    const pool = QCONDS.map((c, i) => ({ c, i })).filter(({ c }) => (d === 1 ? c.d === 1 : d === 2 ? c.d <= 2 : c.d >= 2));
    for (;;) {
      const { c: cond, i: ci } = rng.pick(pool);
      const exprs = [...EXPRS, ...CONSTS].filter((e) => usable(e, cond.set));
      const pts = repPoints(cond.set);
      const options: { a: Ex; b: Ex; rel: QCChoice }[] = [];
      for (const a of exprs)
        for (const b of exprs) {
          if (a === b || (CONSTS.includes(a) && CONSTS.includes(b)) || CONSTS.includes(a)) continue;
          const rels = new Set(pts.map(({ x }) => qcFromSamples([[a.f(x)!, b.f(x)!]])));
          const rel: QCChoice = rels.size === 1 ? [...rels][0] : 'D';
          options.push({ a, b, rel });
        }
      const byRel = (r: QCChoice) => options.filter((o) => o.rel === r);
      const target = pickWeighted<QCChoice>(
        rng,
        (
          [
            ['A', 3.3],
            ['B', 2.3],
            ['C', 1.5],
            ['D', 2.6],
          ] as [QCChoice, number][]
        ).filter(([r]) => byRel(r).length > 0),
      );
      const opt = rng.pick(byRel(target));
      const swap = rng.chance(0.5);
      const [A, B] = swap ? [opt.b, opt.a] : [opt.a, opt.b];
      const answer = swap ? swapQC(opt.rel) : opt.rel;
      // Values at the test points.
      const rows = pts.map(({ x, endpoint, boundary }) => {
        const va = A.f(x)!;
        const vb = B.f(x)!;
        return { x, endpoint, boundary, va, vb, rel: qcFromSamples([[va, vb]]) };
      });
      let traps: QCQuestion['traps'];
      if (answer === 'D') {
        const interior = rows.filter((r) => !r.boundary);
        const iRels = new Set(interior.map((r) => r.rel));
        if (iRels.size === 1 && [...iRels][0] !== 'D') traps = { [[...iRels][0]]: 'num-boundary-value' };
        else if (interior.length) traps = { [interior[0].rel]: 'tested-one-value' };
      } else {
        const at2 = qcFromSamples([[A.f(F(2)) ?? F(0), B.f(F(2)) ?? F(0)]]);
        if (at2 !== answer && !(A.nonneg || B.nonneg) && answer !== 'C') {
          const positive = cond.set.every((I) => I.lo && !I.lo.lt(0));
          traps = { [at2]: positive ? 'fraction-power-grows' : 'negative-fraction-sign' };
        }
      }
      if (traps && Object.keys(traps).includes(answer)) traps = undefined;
      const sym = (r: QCChoice) => (r === 'A' ? '>' : r === 'B' ? '<' : '=');
      const lines = rows
        .map(
          (r) =>
            `- $x = ${r.x.toTex()}$${r.endpoint ? ' (endpoint)' : ''}: Quantity A is $${r.va.toTex()}$ and Quantity B is $${r.vb.toTex()}$, so A $${sym(r.rel)}$ B`,
        )
        .join('\n');
      const reason =
        answer === 'D'
          ? 'The comparison changes with $x$.'
          : answer === 'C'
            ? 'The two quantities are equal for every allowed $x$.'
            : `Powers, reciprocals and absolute values of $x$ can only trade places at $x = -1$, $0$ or $1$, so one test value per region settles the comparison${
                rows.some((r) => r.endpoint) ? ', and the included endpoints agree' : ''
              }.`;
      return {
        params: { cond: ci, a: A.tex, b: B.tex },
        q: {
          format: 'qc',
          info: `$${cond.tex}$`,
          quantityA: `$${A.tex}$`,
          quantityB: `$${B.tex}$`,
          answer,
          traps,
          explanation: `Test a value from each part of the allowed range${
            rows.some((r) => r.endpoint) ? ' and the endpoints that are allowed' : rows.some((r) => r.boundary) ? ', including the special values $-1$, $0$ and $1$ when they are allowed' : ''
          }:
${lines}

${reason} ${qcEnd(answer)}`,
        },
      };
    }
  },
  check(q, { cond, a, b }, rng) {
    // Dense floating-point sampling of the allowed values, including the endpoints.
    const A = exprByTex(a);
    const B = exprByTex(b);
    const xs = sampleSet(QCONDS[cond].set, 40, 8).map((x) => x.toNumber());
    for (let i = 0; i < 300; i++) {
      const x = -8 + 16 * rng.next();
      if (inSet(F(Math.round(x * 1e6), 1e6), QCONDS[cond].set)) xs.push(Math.round(x * 1e6) / 1e6);
    }
    return expectQC(q, qcFromFloatSamples(xs.map((x) => [A.num(x), B.num(x)] as [number, number])));
  },
};

/* ================================================================== 3. Greatest / least of several expressions (MCS) */

interface ExtremeParams {
  region: number;
  kind: 'greatest' | 'least';
  exprs: string[];
}

const REGIONS: { tex: string; set: Iv[]; lo: number; hi: number }[] = [
  { tex: '0 < x < 1', set: [iv(0, 1, false, false)], lo: 0, hi: 1 },
  { tex: '-1 < x < 0', set: [iv(-1, 0, false, false)], lo: -1, hi: 0 },
  { tex: 'x > 1', set: [iv(1, null, false, false)], lo: 1, hi: 30 },
  { tex: 'x < -1', set: [iv(null, -1, false, false)], lo: -30, hi: -1 },
];

const extremeMCS: Template<ExtremeParams> = {
  id: 'arith.real-numbers.extreme-mcs',
  skill: 'arith.real-numbers',
  format: 'mcs',
  style: 'greatest or least of x, x², x³, 1/x on an interval',
  generate(rng, d) {
    for (;;) {
      const region = d === 1 ? 0 : d === 2 ? rng.pick([0, 1, 2, 3]) : rng.pick([1, 1, 3, 0]);
      const R = REGIONS[region];
      const kind = rng.pick(['greatest', 'least'] as const);
      const positive = region === 0 || region === 2;
      const pool = EXPRS.filter(
        (e) =>
          usable(e, R.set) &&
          !(positive && (e.tex === '-x' || e.tex === '-x^3' || e.tex === '|x|')) &&
          (d > 1 || ['x', 'x^2', 'x^3', '\\frac{1}{x}', '\\sqrt{x}', 'x^4'].includes(e.tex)),
      );
      const picked = rng.sample(pool, 5);
      const rep = repPoints(R.set)[0].x;
      const vals = picked.map((e) => e.f(rep));
      if (vals.some((v) => v === null)) continue;
      // No two choices that are equal everywhere on the region (e.g. -x and |x| for x < 0).
      const vs = vals as Frac[];
      if (new Set(vs.map((v) => v.toString())).size < 5) continue;
      const order = picked.map((e) => EXPRS.indexOf(e));
      const sorted = picked.map((e, i) => ({ e, v: vs[i], k: order[i] })).sort((a, b) => a.k - b.k);
      const best = sorted.reduce((bi, it, i) => ((kind === 'greatest' ? it.v.gt(sorted[bi].v) : it.v.lt(sorted[bi].v)) ? i : bi), 0);
      // Trap: the answer you get by pretending x is a large positive number (or ignoring the sign).
      const fake = region === 1 || region === 3 ? rep.abs() : F(2);
      const fv = sorted.map((it) => it.e.f(fake));
      let trapIdx = -1;
      if (fv.every((v) => v !== null)) {
        trapIdx = (fv as Frac[]).reduce((bi, v, i, arr) => ((kind === 'greatest' ? v.gt(arr[bi]) : v.lt(arr[bi])) ? i : bi), 0);
        if (trapIdx === best) trapIdx = -1;
      }
      if (d > 1 && trapIdx < 0) continue;
      const trapId = region === 1 || region === 3 ? 'negative-fraction-sign' : region === 0 ? 'fraction-power-grows' : 'reciprocal-direction';
      const choices = sorted.map((it, i) => ({ text: `$${it.e.tex}$`, ...(i === trapIdx ? { trap: trapId } : {}) }));
      const values = sorted.map((it) => `$${it.e.tex} = ${it.v.toTex()}$`).join(', ');
      return {
        params: { region, kind, exprs: sorted.map((it) => it.e.tex) },
        q: {
          format: 'mcs',
          stem: `If $${R.tex}$, which of the following is ${kind}?`,
          choices,
          answer: best,
          explanation: `Pick a convenient value in the range, $x = ${rep.toTex()}$: ${values}. The ${kind} is $${sorted[best].e.tex}$.

On this interval the order of these expressions never changes (they can only trade places at $-1$, $0$ and $1$), so one test value is enough.${
            trapIdx >= 0
              ? ` Choosing $${sorted[trapIdx].e.tex}$ means reasoning as if $x$ were ${region === 1 || region === 3 ? 'positive' : 'greater than 1'}.`
              : ''
          }`,
        },
      };
    }
  },
  check(q, { region, kind, exprs }, rng) {
    const R = REGIONS[region];
    const es = exprs.map(exprByTex);
    let winner = -1;
    for (let t = 0; t < 400; t++) {
      const x = R.lo + (R.hi - R.lo) * (0.001 + 0.998 * rng.next());
      const v = es.map((e) => e.num(x));
      const best = kind === 'greatest' ? Math.max(...v) : Math.min(...v);
      const idx = v.indexOf(best);
      if (winner === -1) winner = idx;
      else if (winner !== idx) return expectMCS(q, -1);
    }
    return expectMCS(q, winner);
  },
};

/* ================================================================== 4. Which two numbers have a product in an interval (MCM, exact count) */

interface PairParams {
  lo: number;
  hi: number;
  nums: Frac[];
}

interface NumItem {
  tex: string;
  v: Frac;
}

function numPool(d: Difficulty): NumItem[] {
  const out: NumItem[] = [];
  for (let k = 2; k <= 20; k++) out.push({ tex: `-${k}`, v: F(-k) });
  for (let k = 2; k <= 12; k++) out.push({ tex: `${k}`, v: F(k) });
  const powers: [number, number][] = [
    [2, 2],
    [2, 3],
    [2, 4],
    [2, 5],
    [3, 1],
    [3, 2],
    [3, 3],
    [4, 2],
    [5, 1],
    [5, 2],
    [10, 1],
    [10, 2],
  ];
  for (const [b, e] of powers) {
    const v = F(1, b ** e);
    out.push({ tex: d === 1 ? v.toTex() : `${b}^{-${e}}`, v });
  }
  if (d === 3) for (const [p, q] of [[1, 2], [3, 4], [2, 3], [3, 2], [5, 2]]) out.push({ tex: `-\\frac{${p}}{${q}}`, v: F(-p, q) });
  return out;
}

const productPair: Template<PairParams> = {
  id: 'arith.real-numbers.product-pair',
  skill: 'arith.real-numbers',
  format: 'mcm',
  style: 'pick the two numbers whose product lies in an interval',
  generate(rng, d) {
    const [lo, hi] = d === 1 ? [-1, 0] : d === 2 ? rng.pick([[-1, 0], [0, 1]] as [number, number][]) : rng.pick([[-1, 0], [0, 1], [-2, -1]] as [number, number][]);
    const pool = numPool(d);
    const n = d === 1 ? 4 : d === 2 ? 5 : 6;
    const inside = (p: Frac) => p.gt(lo) && p.lt(hi);
    for (;;) {
      const items = rng.sample(pool, n);
      if (new Set(items.map((x) => x.v.toString())).size < n) continue;
      if (!items.some((x) => x.v.sign() < 0) || !items.some((x) => x.v.sign() > 0)) continue;
      const pairs: [number, number][] = [];
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (inside(items[i].v.mul(items[j].v))) pairs.push([i, j]);
      if (pairs.length !== 1) continue;
      const [ci, cj] = pairs[0];
      // near miss: paired with one of the answers, the product has the right sign but falls outside
      const wantSign = hi <= 0 ? -1 : 1;
      const near: number[] = [];
      for (let k = 0; k < n; k++) {
        if (k === ci || k === cj) continue;
        if ([ci, cj].some((m) => items[k].v.mul(items[m].v).sign() === wantSign)) near.push(k);
      }
      if (d > 1 && !near.length) continue;
      const order = items.map((it, i) => ({ it, i })).sort((a, b) => a.it.v.cmp(b.it.v));
      const choices: (Choice & { correct: boolean })[] = order.map(({ it, i }) => {
        const correct = i === ci || i === cj;
        const trap = correct ? undefined : near.includes(i) ? 'num-product-range' : 'num-sign-rules';
        return { text: `$${it.tex}$`, correct, ...(trap ? { trap } : {}) };
      });
      const { choices: ch, answer } = flaggedChoices(choices);
      const P = items[ci].v.mul(items[cj].v);
      const nearK = near[0];
      const nearLine =
        nearK !== undefined
          ? (() => {
              const m = [ci, cj].find((x) => items[nearK].v.mul(items[x].v).sign() === wantSign)!;
              const p = items[nearK].v.mul(items[m].v);
              return ` A product such as $(${items[nearK].tex})(${items[m].tex}) = ${p.toTex()}$ has the right sign but is not between $${lo}$ and $${hi}$.`;
            })()
          : '';
      const lohi = `$${lo}$ and $${hi}$`;
      const signText =
        lo < 0
          ? `A negative product needs one negative and one positive factor.`
          : `A positive product needs two factors with the same sign, and to be less than 1 it needs a small factor.`;
      return {
        params: { lo, hi, nums: order.map(({ it }) => it.v) },
        q: {
          format: 'mcm',
          stem: `Which two of the following numbers have a product that is between ${lohi}?`,
          instruction: 'Indicate both of the numbers.',
          choices: ch,
          answer,
          explanation: `${signText} ${d > 1 ? 'Rewrite the negative exponents as fractions first ($a^{-n} = \\frac{1}{a^n}$). ' : ''}The only pair that works is $${items[ci].tex}$ and $${items[cj].tex}$: their product is $${P.toTex()}$.${nearLine}`,
        },
      };
    }
  },
  check(q, { lo, hi, nums }) {
    // Brute force over every pair.
    const hits: number[][] = [];
    for (let i = 0; i < nums.length; i++)
      for (let j = i + 1; j < nums.length; j++) {
        const p = nums[i].toNumber() * nums[j].toNumber();
        if (p > lo && p < hi) hits.push([i, j]);
      }
    if (hits.length !== 1) return `${hits.length} valid pairs`;
    return expectMCM(q, hits[0]);
  },
};

/* ================================================================== 5. Absolute value equations and inequalities (NE) */

interface AbsParams {
  mode: 'count' | 'sum' | 'max-dist';
  k: number;
  a: number;
  b: number;
  strict: boolean;
  c: number;
  e: number;
}

const absValueNE: Template<AbsParams> = {
  id: 'arith.real-numbers.abs-value',
  skill: 'arith.real-numbers',
  format: 'ne',
  style: 'solutions of absolute value equations and inequalities',
  generate(rng, d) {
    const mode: AbsParams['mode'] = d === 1 ? rng.pick(['count', 'sum'] as const) : d === 2 ? rng.pick(['count', 'sum', 'max-dist'] as const) : rng.pick(['count', 'max-dist'] as const);
    if (mode === 'count') {
      const k = d === 3 ? rng.pick([2, 3]) : 1;
      const a = rng.int(-9, 9) || 4;
      const b = rng.int(d === 3 ? 4 : 2, d === 3 ? 13 : 9);
      const strict = rng.chance(0.5);
      // integers x with |kx - a| < b (or <=)
      const lo = F(a - b, k);
      const hi = F(a + b, k);
      const first = Math.ceil(lo.toNumber() - 1e-9) + (strict && lo.isInt() ? 1 : 0);
      const last = Math.floor(hi.toNumber() + 1e-9) - (strict && hi.isInt() ? 1 : 0);
      const count = last - first + 1;
      const inner = k === 1 ? `x ${a > 0 ? '-' : '+'} ${Math.abs(a)}` : `${k}x ${a > 0 ? '-' : '+'} ${Math.abs(a)}`;
      const rel = strict ? '<' : '\\le';
      const traps: { value: Frac; trap: string }[] = [];
      if (k === 1) {
        traps.push({ value: F(strict ? 2 * b + 1 : 2 * b - 1), trap: strict ? 'counted-endpoint' : 'num-boundary-value' });
        traps.push({ value: F(strict ? b - 1 : b + 1), trap: 'num-abs-one-solution' });
      }
      const filtered = traps.filter((t) => !t.value.eq(count));
      return {
        params: { mode, k, a, b, strict, c: 0, e: 0 },
        q: {
          format: 'ne',
          stem: `How many integers $x$ satisfy $|${inner}| ${rel} ${b}$?`,
          answer: F(count),
          suffix: 'integers',
          traps: filtered,
          explanation: `$|${inner}| ${rel} ${b}$ means $-${b} ${rel} ${inner} ${rel} ${b}$${
            k === 1 ? '' : `, so $${a - b} ${rel} ${k}x ${rel} ${a + b}$`
          }, that is, $${lo.toTex()} ${rel} x ${rel} ${hi.toTex()}$.

The integers in this range are $${first}$ through $${last}$: $${last} - ${first < 0 ? `(${first})` : first} + 1 = ${count}$ integers.${
            k === 1 ? ` ${strict ? `The endpoints $${lo.toTex()}$ and $${hi.toTex()}$ are not allowed because the inequality is strict.` : `Both endpoints count because the inequality allows equality.`}` : ''
          }`,
        },
      };
    }
    if (mode === 'sum') {
      const k = d === 1 ? 1 : rng.pick([1, 2]);
      let a: number;
      let b: number;
      do {
        a = rng.int(-12, 12);
        b = rng.int(2, 15);
      } while (a === 0 || (k === 2 && (a + b) % 2 !== 0));
      // |kx - a| = b: x = (a + b)/k or (a - b)/k; sum = 2a/k
      const sols = [F(a + b, k), F(a - b, k)];
      const sum = sols[0].add(sols[1]);
      const inner = k === 1 ? `x ${a > 0 ? '-' : '+'} ${Math.abs(a)}` : `${k}x ${a > 0 ? '-' : '+'} ${Math.abs(a)}`;
      return {
        params: { mode, k, a, b, strict: false, c: 0, e: 0 },
        q: {
          format: 'ne',
          stem: `What is the sum of all the values of $x$ that satisfy $|${inner}| = ${b}$?`,
          answer: sum,
          traps: [{ value: sols[0], trap: 'num-abs-one-solution' }].filter((t) => !t.value.eq(sum)),
          explanation: `$|${inner}| = ${b}$ means $${inner} = ${b}$ or $${inner} = -${b}$, so $x = ${sols[0].toTex()}$ or $x = ${sols[1].toTex()}$.

The sum is $${sols[0].toTex()} + ${sols[1].toTex().startsWith('-') ? `(${sols[1].toTex()})` : sols[1].toTex()} = ${sum.toTex()}$. (The two solutions are symmetric about $${F(a, k).toTex()}$, so the sum is twice that.) Forgetting the negative case gives only $${sols[0].toTex()}$.`,
        },
      };
    }
    // max-dist: |x - a| = b and |y - c| = e; greatest possible |x - y|
    const a = rng.int(-8, 8);
    const c = rng.int(-8, 8);
    const b = rng.int(1, 9);
    const e = rng.int(1, 9);
    const ask = d === 3 && rng.chance(0.5) ? 'least' : 'greatest';
    const xs = [a - b, a + b];
    const ys = [c - e, c + e];
    const ds = xs.flatMap((x) => ys.map((y) => Math.abs(x - y)));
    const ans = ask === 'greatest' ? Math.max(...ds) : Math.min(...ds);
    const naive = Math.abs(a + b - (c + e));
    const fmt = (v: number, s: string) => `${s} ${v >= 0 ? '-' : '+'} ${Math.abs(v)}`;
    return {
      params: { mode, k: ask === 'least' ? -1 : 1, a, b, strict: false, c, e },
      q: {
        format: 'ne',
        stem: `If $|${fmt(a, 'x')}| = ${b}$ and $|${fmt(c, 'y')}| = ${e}$, what is the ${ask} possible value of $|x - y|$?`,
        answer: F(ans),
        traps: naive !== ans ? [{ value: F(naive), trap: 'num-abs-one-solution' }] : [],
        explanation: `$x = ${xs[0]}$ or $x = ${xs[1]}$, and $y = ${ys[0]}$ or $y = ${ys[1]}$. The four distances $|x - y|$ are ${ds.join(', ')}.

The ${ask} is ${ans}. Using only $x = ${xs[1]}$ and $y = ${ys[1]}$ gives ${naive}${naive === ans ? ', which happens to be right here, but the other cases must be checked' : ''}.`,
      },
    };
  },
  check(q, { mode, k, a, b, strict, c, e }) {
    if (mode === 'count') {
      let n = 0;
      for (let x = -200; x <= 200; x++) {
        const v = Math.abs(k * x - a);
        if (strict ? v < b : v <= b) n++;
      }
      return expectNE(q, n);
    }
    if (mode === 'sum') {
      // Search a fine grid for solutions.
      let s = 0;
      for (let t = -2000; t <= 2000; t++) {
        const x = t / 2;
        if (Math.abs(k * x - a) === b) s += x;
      }
      return expectNE(q, s);
    }
    // Brute force over integer points on the line.
    let best = k === 1 ? -Infinity : Infinity;
    for (let x = -40; x <= 40; x++)
      for (let y = -40; y <= 40; y++)
        if (Math.abs(x - a) === b && Math.abs(y - c) === e) best = k === 1 ? Math.max(best, Math.abs(x - y)) : Math.min(best, Math.abs(x - y));
    return expectNE(q, best);
  },
};

export const realNumberTemplates = [mustBeTrue, orderQC, extremeMCS, productPair, absValueNE];
