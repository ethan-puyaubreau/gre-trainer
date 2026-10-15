import { qcFromSamples } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import { Fig, type P2 } from '../measure/fig';
import { Redraw, retryAll } from '../redraw';
import { qcTraps, QC_SAY } from './util';

/* Trapezoid with crossing diagonals: the two triangles on the parallel sides are similar (QC). */

export const trapezoidDiagonalTraps: Record<string, Trap> = {
  'geo-sim-diag-midpoint': {
    label: 'Assumed the diagonals bisect each other',
    fix: 'Diagonals bisect each other only in a parallelogram. In a trapezoid with $AB \\neq CD$ they cut each other in the ratio of the parallel sides, $AE : EC = AB : CD$.',
  },
  'geo-sim-diag-needs-legs': {
    label: 'Said "cannot be determined" because the slanted sides are not given',
    fix: 'The triangles on the two slanted sides always have equal areas: each is the triangle on one side minus the same overlapping triangle. No leg length is needed.',
  },
  'geo-sim-diag-sides-differ': {
    label: 'Assumed the two triangles on the slanted sides differ because the trapezoid looks lopsided',
    fix: 'Triangles $ADE$ and $BCE$ equal triangles $ADC$ and $BCD$ minus $CDE$, and $ADC$, $BCD$ share the base $CD$ and the height between the parallels, so their areas match.',
  },
  'geo-sim-diag-one-height': {
    label: 'Tested one value of the unknown height and called the comparison settled',
    fix: 'When the height is only known to lie in a range, the distance from $E$ moves across that range. If the number you compare with lies inside it, the comparison flips: test two heights.',
  },
  'geo-sim-diag-swapped-ratio': {
    label: 'Put the longer base on the wrong triangle when splitting the height',
    fix: 'Triangles $ABE$ and $CDE$ are similar with ratio $AB : CD$, so the heights from $E$ are in that ratio: the distance from $E$ to $AB$ is $h \\cdot \\frac{AB}{AB + CD}$, the longer base gets the LONGER distance.',
  },
  'geo-sim-diag-area-linear': {
    label: 'Used the ratio of the sides as the ratio of the areas',
    fix: 'Similar triangles with side ratio $k$ have area ratio $k^2$. Triangle $ABE$ has $(AB/CD)^2$ times the area of triangle $CDE$.',
  },
};

type Mode = 'dist' | 'distnum' | 'range' | 'seg' | 'lateral' | 'area' | 'total';
interface Params {
  mode: Mode;
  a: number;
  b: number;
  h: number;
  lo: number;
  hi: number;
  N: number;
  S: number;
  swap: boolean;
  names: string[];
}

const SETS: string[][] = [
  ['A', 'B', 'C', 'D'],
  ['P', 'Q', 'R', 'S'],
  ['W', 'X', 'Y', 'Z'],
  ['K', 'L', 'M', 'N'],
  ['F', 'G', 'H', 'J'],
];
const cmp = (x: number, y: number): QCChoice => (Math.abs(x - y) < 1e-9 * Math.max(1, x, y) ? 'C' : x > y ? 'A' : 'B');
/** Exact value as a number, a fraction, or a fraction with its two-decimal value. */
const dc = (x: number) => (Number.isInteger(x) ? String(x) : Number(x.toFixed(2)).toString());
const fx = (n: number, d: number) => {
  const f = new Frac(n, d);
  return f.isInt() ? f.toTex() : `${f.toTex()} \approx ${dc(n / d)}`;
};

/** Geometry for check(): AB on top (length a), CD at the bottom (length b), offset x0, height h. */
function build(a: number, b: number, h: number, x0: number) {
  const A: P2 = [0, h];
  const B: P2 = [a, h];
  const D: P2 = [x0, 0];
  const C: P2 = [x0 + b, 0];
  // E = A + t (C - A) = B + s (D - B)
  const dx1 = C[0] - A[0];
  const dy1 = C[1] - A[1];
  const dx2 = D[0] - B[0];
  const dy2 = D[1] - B[1];
  const det = dx1 * -dy2 - -dx2 * dy1;
  const t = ((B[0] - A[0]) * -dy2 - -dx2 * (B[1] - A[1])) / det;
  const E: P2 = [A[0] + t * dx1, A[1] + t * dy1];
  const area = (...p: P2[]) => Math.abs(p.reduce((s, q, i) => s + q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1], 0)) / 2;
  const d = (p: P2, q: P2) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  return { A, B, C, D, E, area, d };
}

const trapezoid: Template<Params> = {
  id: 'geo.similarity.trapezoid-diagonals-qc',
  skill: 'geo.similarity',
  format: 'qc',
  style: 'trapezoid with crossing diagonals: compare distances, segments and areas through similar triangles',
  generate(rng, d) {
    const [nA, nB, nC, nD] = rng.pick(SETS);
    const a = rng.int(2, 18);
    const b = rng.int(2, 18);
    const modes: Mode[] = d === 1 ? ['dist', 'dist', 'lateral', 'seg', 'range'] : d === 2 ? ['dist', 'distnum', 'seg', 'lateral', 'area', 'range', 'range'] : ['total', 'range', 'range', 'distnum', 'area', 'total'];
    const mode = rng.pick(modes);
    if (mode !== 'lateral' && a === b && rng.chance(0.7)) throw new Redraw('equal bases too often');
    if (mode === 'lateral' && a === b) throw new Redraw('lateral needs a != b');
    const h = rng.pick([6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 24, 30]);
    const swap = rng.chance(0.5);
    let lo = 0;
    let hi = 0;
    let N = 0;
    let S = 0;
    let answer: QCChoice;
    let info: string;
    let qa: string;
    let qb: string;
    let why: string;
    const wrong: Partial<Record<QCChoice, string>> = {};
    const f = a / (a + b); // distance from E to AB as a fraction of the height
    const base = `In quadrilateral $${nA}${nB}${nC}${nD}$, sides $${nA}${nB}$ and $${nC}${nD}$ are parallel, $${nA}${nB} = ${a}$ and $${nC}${nD} = ${b}$. The diagonals $${nA}${nC}$ and $${nB}${nD}$ meet at $E$.`;
    const sim = `Triangles $${nA}${nB}E$ and $${nC}${nD}E$ have equal angles (alternate angles between the parallel lines), so they are similar with ratio $${nA}${nB} : ${nC}${nD} = ${a} : ${b}$.`;
    const eqNote = a === b ? ' Here the ratio is 1 : 1, so $E$ is the midpoint of each diagonal.' : '';
    if (mode === 'dist') {
      info = `${base} The distance between lines $${nA}${nB}$ and $${nC}${nD}$ is $${h}$.`;
      qa = `The distance from $E$ to $${nA}${nB}$`;
      qb = `The distance from $E$ to $${nC}${nD}$`;
      answer = cmp(a, b);
      if (answer !== 'C') wrong.C = 'geo-sim-diag-midpoint';
      wrong[answer === 'A' ? 'B' : 'A'] = 'geo-sim-diag-swapped-ratio';
      why = `${sim}${eqNote} The heights of these triangles from $E$ are in the same ratio, and they add up to ${h}: $${fx(h * a, a + b)}$ for $${nA}${nB}$ and $${fx(h * b, a + b)}$ for $${nC}${nD}$. The longer parallel side is the one farther from $E$.`;
    } else if (mode === 'distnum') {
      info = `${base} The distance between lines $${nA}${nB}$ and $${nC}${nD}$ is $${h}$.`;
      const exact = h * f;
      const pickN = rng.pick([0, 1, 2, 3]);
      N = pickN === 0 ? Math.round(exact * 2) / 2 : Math.round(exact + (pickN === 1 ? 1 : -1) * rng.int(1, 3));
      if (N <= 0) throw new Redraw('N');
      qa = `The distance from $E$ to $${nA}${nB}$`;
      qb = `$${dc(N)}$`;
      answer = cmp(exact, N);
      const swapped = cmp(h * (1 - f), N);
      if (swapped !== answer) wrong[swapped] = 'geo-sim-diag-swapped-ratio';
      if (answer !== 'C' && cmp(h / 2, N) !== answer) wrong[cmp(h / 2, N)] = 'geo-sim-diag-midpoint';
      why = `${sim}${eqNote} The height ${h} splits in the ratio $${a} : ${b}$, so the distance from $E$ to $${nA}${nB}$ is $${h} \\cdot \\frac{${a}}{${a + b}} = ${fx(h * a, a + b)}$ (the distance to $${nC}${nD}$ is $${fx(h * b, a + b)}$).`;
    } else if (mode === 'range') {
      lo = rng.pick([4, 6, 8, 10, 12]);
      hi = lo + rng.pick([4, 6, 8, 10]);
      const dLo = lo * f;
      const dHi = hi * f;
      const pick = rng.int(0, 4);
      N = pick === 0 ? Math.round(((dLo + dHi) / 2) * 2) / 2 : pick === 1 ? Math.ceil(dHi) + rng.int(0, 2) : pick === 2 ? Math.floor(dLo) - rng.int(0, 2) : Math.round((dLo + dHi) / 2);
      if (N <= 0) throw new Redraw('N');
      info = `${base} The distance between lines $${nA}${nB}$ and $${nC}${nD}$ is greater than $${lo}$ and less than $${hi}$.`;
      qa = `The distance from $E$ to $${nA}${nB}$`;
      qb = `$${dc(N)}$`;
      answer = N >= dHi ? 'B' : N <= dLo ? 'A' : 'D';
      if (answer === 'D') wrong[rng.pick(['A', 'B'] as const)] = 'geo-sim-diag-one-height';
      else wrong.D = 'geo-sim-diag-one-height';
      why = `${sim} The distance from $E$ to $${nA}${nB}$ is $\\frac{${a}}{${a + b}}$ of the height $H$ between the parallels. As $${lo} < H < ${hi}$, it lies strictly between $${fx(lo * a, a + b)}$ and $${fx(hi * a, a + b)}$. ${
        answer === 'D' ? `The number ${dc(N)} is inside that interval, so the distance can be below it or above it.` : answer === 'A' ? `The whole interval is above ${dc(N)}.` : `The whole interval is below ${dc(N)}.`
      }`;
    } else if (mode === 'seg') {
      info = base;
      qa = `$${nA}E$`;
      qb = `$E${nC}$`;
      answer = cmp(a, b);
      if (answer !== 'C') wrong.C = 'geo-sim-diag-midpoint';
      why = `${sim}${eqNote} Corresponding sides of similar triangles are in the same ratio: $${nA}E : E${nC} = ${nA}${nB} : ${nC}${nD} = ${a} : ${b}$. So $${nA}E$ is ${a > b ? 'longer' : a < b ? 'shorter' : 'equal'} than $E${nC}$ exactly when $${nA}${nB}$ is ${a > b ? 'longer' : a < b ? 'shorter' : 'equal'} than $${nC}${nD}$.`;
    } else if (mode === 'lateral') {
      info = base;
      qa = `The area of triangle $${nA}${nD}E$`;
      qb = `The area of triangle $${nB}${nC}E$`;
      answer = 'C';
      wrong.D = 'geo-sim-diag-needs-legs';
      wrong[a > b ? 'A' : 'B'] = 'geo-sim-diag-sides-differ';
      why = `Triangles $${nA}${nD}${nC}$ and $${nB}${nC}${nD}$ share the base $${nC}${nD}$ and lie between the same parallel lines, so their areas are equal. Both contain triangle $${nC}${nD}E$; removing it leaves triangles $${nA}${nD}E$ and $${nB}${nC}E$ with equal areas. Neither the leg lengths nor the height are needed. The bases ${a} and ${b} do not change this.`;
    } else if (mode === 'area') {
      info = base;
      qa = `The area of triangle $${nA}${nB}E$`;
      qb = `The area of triangle $${nC}${nD}E$`;
      answer = cmp(a, b);
      if (answer !== 'C') wrong.C = 'geo-sim-diag-midpoint';
      why = `${sim}${eqNote} Areas of similar triangles are in the ratio of the SQUARES of the sides: $${a * a} : ${b * b}$. The triangle on the longer base has the larger area, whatever the height.`;
    } else {
      // total: area of CDE is S; compare the trapezoid with a number
      S = rng.pick([2, 3, 4, 5, 6, 8, 9, 10, 12]);
      if (a === b) throw new Redraw('trapezoid area needs a != b');
      const total = (S * (a + b) * (a + b)) / (b * b);
      const pickN = rng.int(0, 3);
      N = pickN === 0 ? Math.round(total) : Math.round(total + rng.int(1, 4) * (pickN === 1 ? 1 : -1));
      if (N <= 0) throw new Redraw('N');
      info = `${base} Triangle $${nC}${nD}E$ has area $${S}$.`;
      qa = `The area of quadrilateral $${nA}${nB}${nC}${nD}$`;
      qb = `$${dc(N)}$`;
      answer = cmp(total, N);
      const wrongTotal = S + S * (a / b) + S * (a / b) + S * (a / b); // ABE by the linear ratio
      const wl = cmp(wrongTotal, N);
      if (wl !== answer) wrong[wl] = 'geo-sim-diag-area-linear';
      const half = cmp(2 * S + 2 * S, N);
      if (half !== answer && !(half in wrong)) wrong[half] = 'geo-sim-diag-midpoint';
      why = `${sim}${eqNote} Area scales with the square of the ratio: triangle $${nA}${nB}E$ has area $${S} \\cdot (\\frac{${a}}{${b}})^2 = ${dc((S * a * a) / (b * b))}$. Each side triangle has area $${S} \\cdot \\frac{${a}}{${b}} = ${dc((S * a) / b)}$ (the same for both, the geometric mean of the two similar areas). Total: $${fx(S * (a + b) * (a + b), b * b)}$.`;
    }
    const kept = qcTraps(answer, wrong);
    const SAY: Record<string, string> = {
      'geo-sim-diag-midpoint': 'the diagonals of a trapezoid do not bisect each other unless the parallel sides are equal, so E is not halfway',
      'geo-sim-diag-needs-legs': 'the missing leg lengths are not needed, because the two side triangles are always equal in area',
      'geo-sim-diag-sides-differ': 'the trapezoid looks lopsided, but the two side triangles still have equal areas',
      'geo-sim-diag-one-height': 'one test height settles nothing when the height is only bounded: try both ends of the range',
      'geo-sim-diag-swapped-ratio': `the longer parallel side gets the longer share of the height, so ${a} : ${b} is not to be reversed`,
      'geo-sim-diag-area-linear': 'areas follow the square of the ratio, not the ratio itself',
    };
    const trapLine = SAY[Object.values(kept ?? {})[0] ?? 'geo-sim-diag-midpoint'];
    const q: QCQuestion = {
      format: 'qc',
      info,
      quantityA: qa,
      quantityB: qb,
      answer,
      traps: kept,
      explanation: `Recognize: a quadrilateral with two parallel sides and two crossing diagonals hides a pair of similar triangles at its parallel sides.

${why} So ${QC_SAY[answer]}. (${answer})

Check: test one concrete shape, for example ${a === b ? 'a rectangle' : 'a right trapezoid with a vertical side'}; the relationship does not depend on the slant of the legs.

Trap: ${trapLine}.

Rule: parallel sides give similar triangles at the crossing point, with ratio equal to the ratio of those sides.`,
    };
    const fig = new Fig();
    const x0 = swap ? -1 - 0.4 * rng.next() : 0.4 + rng.next();
    const hh = mode === 'range' ? (lo + hi) / 2 : h;
    const scale = 4 / Math.max(a, b);
    const g = build(a * scale, b * scale, Math.min(hh * scale * 0.28, 3.2), x0 * scale);
    fig.pt(nA, g.A, [-1, 0.6]).pt(nB, g.B, [1, 0.6]).pt(nC, g.C, [1, -0.6]).pt(nD, g.D, [-1, -0.6]).pt('E', g.E, [0.3, 1]);
    fig.seg(nA, nB, `$${a}$`).seg(nC, nD, `$${b}$`).seg(nA, nD).seg(nB, nC).seg(nA, nC).seg(nB, nD);
    q.figure = fig.build(mode === 'range' || mode === 'dist' || mode === 'distnum' ? true : false);
    return { params: { mode, a, b, h, lo, hi, N, S, swap, names: [nA, nB, nC, nD] }, q };
  },
  check(q, p, rng) {
    if (q.format !== 'qc') return 'format';
    const samples: [number, number][] = [];
    for (let i = 0; i < 120; i++) {
      const x0 = -2 * Math.max(p.a, p.b) + 4 * Math.max(p.a, p.b) * rng.next();
      let h = p.h;
      if (p.mode === 'range') h = i % 3 === 0 ? p.lo + 1e-7 : i % 3 === 1 ? p.hi - 1e-7 : p.lo + (p.hi - p.lo) * rng.next();
      const g = build(p.a, p.b, h, x0);
      const toAB = h - g.E[1];
      const toCD = g.E[1];
      switch (p.mode) {
        case 'dist':
          samples.push([toAB, toCD]);
          break;
        case 'distnum':
        case 'range':
          samples.push([toAB, p.N]);
          break;
        case 'seg':
          samples.push([g.d(g.A, g.E), g.d(g.E, g.C)]);
          break;
        case 'lateral':
          samples.push([g.area(g.A, g.D, g.E), g.area(g.B, g.C, g.E)]);
          break;
        case 'area':
          samples.push([g.area(g.A, g.B, g.E), g.area(g.C, g.D, g.E)]);
          break;
        default: {
          // scale the figure so that triangle CDE has area S
          const k = Math.sqrt(p.S / g.area(g.C, g.D, g.E));
          samples.push([k * k * (g.area(g.A, g.B, g.C, g.D)), p.N]);
        }
      }
    }
    // at the open ends of a range the extremes are limits: only strict inequalities count
    const exp = qcFromSamples(samples);
    return exp === q.answer ? null : `expected ${exp}`;
  },
};

export const trapezoidDiagonalTemplates = retryAll([trapezoid]);
