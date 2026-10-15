import { Frac } from '../../../engine/frac';
import { decimal } from '../../../engine/tex';
import type { NEQuestion, Template, Trap } from '../../../engine/types';
import { Fig, type P2 } from '../measure/fig';
import { Redraw, retryAll } from '../redraw';

/* Trapezoid and the lines parallel to its bases: lengths and distances by similar triangles (NE). */

export const trapezoidSegmentTraps: Record<string, Trap> = {
  'geo-sim-seg-midline': {
    label: 'Averaged the two bases',
    fix: 'The average $\\frac{a + b}{2}$ is the length of the segment HALFWAY between the bases only. A segment through the diagonals\' crossing, or at another height, is not halfway.',
  },
  'geo-sim-seg-no-double': {
    label: 'Dropped the factor 2 of the segment through the crossing of the diagonals',
    fix: 'The two halves of the segment are each $\\frac{ab}{a + b}$ (similar triangles at the crossing), so the whole segment is $\\frac{2ab}{a + b}$.',
  },
  'geo-sim-seg-wrong-base': {
    label: 'Measured the distance from the wrong base',
    fix: 'Say which base the distance starts from. The length changes linearly from one base to the other, so being $t$ from the longer base is not the same as being $t$ from the shorter one.',
  },
  'geo-sim-seg-whole-height': {
    label: 'Used the height of the trapezoid as the distance to the apex',
    fix: 'The legs keep meeting beyond the shorter base. The small triangle above it is similar to the whole triangle, so the distance to the apex is larger than the height: $H \\cdot \\frac{a}{a - b}$.',
  },
  'geo-sim-seg-short-apex': {
    label: 'Gave the distance from the shorter base to the apex instead of from the longer base',
    fix: 'Read the base the question measures from. The distance from the shorter base is $H \\cdot \\frac{b}{a - b}$; add the height $H$ to get the distance from the longer base.',
  },
  'geo-sim-seg-no-half': {
    label: 'Forgot the factor $\\frac12$ in the area of the triangle',
    fix: 'The area of a triangle is $\\frac12 \\cdot \\text{base} \\cdot \\text{height}$. Write the $\\frac12$ before plugging in the numbers.',
  },
  'geo-sim-seg-area-whole': {
    label: 'Took the height of the trapezoid as the height of the triangle at the crossing',
    fix: 'The crossing point $E$ of the diagonals divides the height in the ratio of the bases. The triangle on a base has height $H \\cdot \\frac{\\text{that base}}{a + b}$, not $H$.',
  },
};

type Mode = 'diag' | 'height' | 'apex' | 'diagarea';
interface Params {
  mode: Mode;
  a: number;
  b: number;
  H: number;
  t: number;
  names: string[];
}

const SETS: string[][] = [
  ['A', 'B', 'C', 'D'],
  ['F', 'G', 'H', 'J'],
  ['W', 'X', 'Y', 'Z'],
  ['K', 'L', 'M', 'N'],
];
const terminating = (f: Frac) => {
  let dd = f.d;
  while (dd % 2 === 0) dd /= 2;
  while (dd % 5 === 0) dd /= 5;
  return dd === 1;
};
const dec = (f: Frac) => (terminating(f) ? decimal(f) : '?'); // a non-terminating answer is redrawn below

const trapezoidSegments: Template<Params> = {
  id: 'geo.similarity.trapezoid-segments-ne',
  skill: 'geo.similarity',
  format: 'ne',
  style: 'trapezoid: segment through the diagonals, at a given height, or the apex where the legs meet',
  generate(rng, d) {
    const [nA, nB, nC, nD] = rng.pick(SETS);
    const modes: Mode[] = d === 1 ? ['height', 'diag'] : d === 2 ? ['diag', 'height', 'height', 'apex'] : ['apex', 'diagarea', 'diagarea', 'apex', 'height'];
    const mode = rng.pick(modes);
    let a = rng.int(6, 30);
    let b = rng.int(3, a - 2);
    const H = rng.pick([6, 8, 9, 10, 12, 15, 16, 18, 20, 24]);
    let t = 0;
    if (mode === 'height') {
      const ts = (d === 1 ? [H / 3, (2 * H) / 3] : Array.from({ length: H - 1 }, (_, i) => i + 1).filter((v) => 2 * v !== H)).filter(Number.isInteger);
      if (!ts.length) throw new Redraw('t');
      t = rng.pick(ts);
      if (rng.chance(0.5)) [a, b] = [b, a];
    }
    if (a === b) throw new Redraw('bases');
    const A = new Frac(a);
    const B = new Frac(b);
    const HH = new Frac(H);
    let answer: Frac;
    let stem: string;
    let steps: string;
    const traps: { value: Frac; trap: string }[] = [];
    const base = `In trapezoid $${nA}${nB}${nC}${nD}$, side $${nA}${nB}$ is parallel to side $${nD}${nC}$, with $${nA}${nB} = ${a}$ and $${nD}${nC} = ${b}$.`;
    if (mode === 'diag') {
      answer = new Frac(2 * a * b, a + b);
      stem = `${base} The diagonals meet at $E$, and a segment through $E$ parallel to $${nA}${nB}$ meets $${nA}${nD}$ at $P$ and $${nB}${nC}$ at $Q$. What is the length of $PQ$?`;
      traps.push({ value: new Frac(a + b, 2), trap: 'geo-sim-seg-midline' }, { value: new Frac(a * b, a + b), trap: 'geo-sim-seg-no-double' });
      steps = `Triangles $${nA}${nB}E$ and $${nC}${nD}E$ are similar with ratio $${a} : ${b}$, so $E$ cuts diagonal $${nA}${nC}$ into $${nA}E : E${nC} = ${a} : ${b}$. In triangle $${nA}${nD}${nC}$, segment $PE$ is parallel to $${nD}${nC}$, so $PE = ${b} \\cdot \\frac{${a}}{${a} + ${b}} = \\frac{${a} \\cdot ${b}}{${a} + ${b}}$. The same argument in triangle $${nB}${nC}${nD}$ gives $EQ = PE$. So $PQ = \\frac{2 \\cdot ${a} \\cdot ${b}}{${a} + ${b}} = ${dec(answer)}$.`;
    } else if (mode === 'height') {
      const T = new Frac(t);
      answer = A.add(B.sub(A).mul(T).div(HH));
      stem = `${base} The distance between the parallel sides is ${H}. A segment $PQ$ parallel to them has $P$ on $${nA}${nD}$ and $Q$ on $${nB}${nC}$, at distance ${t} from $${nA}${nB}$. What is the length of $PQ$?`;
      traps.push({ value: new Frac(a + b, 2), trap: 'geo-sim-seg-midline' }, { value: B.add(A.sub(B).mul(T).div(HH)), trap: 'geo-sim-seg-wrong-base' });
      steps = `Draw a line through the end of the shorter base parallel to a leg. The length changes steadily by $${a} - ${b}$ over the height ${H}, so at distance ${t} from $${nA}${nB}$ it has changed by $\\frac{${t}}{${H}}$ of that: $PQ = ${a} ${a > b ? '-' : '+'} ${Math.abs(a - b)} \\cdot \\frac{${t}}{${H}} = ${dec(answer)}$.`;
    } else if (mode === 'apex') {
      const [lo, hi] = [Math.min(a, b), Math.max(a, b)];
      a = hi;
      b = lo;
      answer = HH.mul(new Frac(a, a - b));
      stem = `The nonparallel sides $${nA}${nD}$ and $${nB}${nC}$ of trapezoid $${nA}${nB}${nC}${nD}$ are extended beyond $${nD}${nC}$ and meet at point $V$. Here $${nA}${nB} = ${a}$ and $${nD}${nC} = ${b}$ are parallel, and the distance between them is ${H}. What is the distance from $V$ to line $${nA}${nB}$?`;
      traps.push({ value: HH, trap: 'geo-sim-seg-whole-height' }, { value: HH.mul(new Frac(b, a - b)), trap: 'geo-sim-seg-short-apex' });
      steps = `Triangle $V${nD}${nC}$ is similar to triangle $V${nA}${nB}$ because $${nD}${nC}$ is parallel to $${nA}${nB}$. Their heights from $V$ are in the ratio $${b} : ${a}$. If $x$ is the distance from $V$ to $${nA}${nB}$, then $x - ${H}$ is the distance to $${nD}${nC}$, so $\\frac{x - ${H}}{x} = \\frac{${b}}{${a}}$. Solving, $x = \\frac{${H} \\cdot ${a}}{${a} - ${b}} = ${dec(answer)}$.`;
    } else {
      answer = new Frac(a * a * H, 2 * (a + b));
      stem = `${base} The distance between the parallel sides is ${H}, and the diagonals meet at $E$. What is the area of triangle $${nA}${nB}E$?`;
      traps.push({ value: new Frac(a * H, 2), trap: 'geo-sim-seg-area-whole' }, { value: new Frac(a * a * H, a + b), trap: 'geo-sim-seg-no-half' });
      steps = `Triangles $${nA}${nB}E$ and $${nC}${nD}E$ are similar with ratio $${a} : ${b}$, so the heights from $E$ share the distance ${H} in that ratio: the height of triangle $${nA}${nB}E$ is $${H} \\cdot \\frac{${a}}{${a + b}}$. Its area is $\\frac12 \\cdot ${a} \\cdot ${H} \\cdot \\frac{${a}}{${a + b}} = ${dec(answer)}$.`;
    }
    if (!terminating(answer)) throw new Redraw('not terminating');
    const ok = traps.filter((tr) => terminating(tr.value) && !tr.value.eq(answer));
    const fig = new Fig();
    const wmax = Math.max(a, b);
    const sc = 6 / wmax;
    const hh = Math.min(3.4, Math.max(2, H * sc * 0.45));
    const off = (a - b) * sc * 0.5 + (rng.chance(0.5) ? 0.3 : -0.3) * (a - b) * sc * 0.4;
    const Ap: P2 = [0, 0];
    const Bp: P2 = [a * sc, 0];
    const Dp: P2 = [off, hh];
    const Cp: P2 = [off + b * sc, hh];
    fig.pt(nA, Ap, [-1, -0.6]).pt(nB, Bp, [1, -0.6]).pt(nC, Cp, [1, 0.6]).pt(nD, Dp, [-1, 0.6]);
    fig.poly([nA, nB, nC, nD]).seg(nA, nB, `$${a}$`).seg(nD, nC, `$${b}$`);
    if (mode === 'diag' || mode === 'diagarea') {
      fig.seg(nA, nC).seg(nB, nD);
      fig.pt('E', [(Ap[0] * b + Cp[0] * a) / (a + b), (hh * a) / (a + b)], [0.2, -0.9]);
      if (mode === 'diag') {
        const y = (hh * a) / (a + b);
        const xL = Ap[0] + ((Dp[0] - Ap[0]) * y) / hh;
        const xR = Bp[0] + ((Cp[0] - Bp[0]) * y) / hh;
        fig.pt('P', [xL, y], [-1, 0]).pt('Q', [xR, y], [1, 0]).seg('P', 'Q');
      }
    } else if (mode === 'height') {
      const y = (hh * t) / H;
      const xL = Ap[0] + ((Dp[0] - Ap[0]) * y) / hh;
      const xR = Bp[0] + ((Cp[0] - Bp[0]) * y) / hh;
      fig.pt('P', [xL, y], [-1, 0]).pt('Q', [xR, y], [1, 0]).seg('P', 'Q');
    } else {
      const Vy = (hh * a) / (a - b);
      const Vx = Dp[0] + ((Dp[0] - Ap[0]) * (Vy - hh)) / hh;
      fig.pt('V', [Vx, Vy], [0, 1]).seg(nD, 'V', undefined, true).seg(nC, 'V', undefined, true);
    }
    const q: NEQuestion = {
      format: 'ne',
      stem,
      answer,
      prefix: mode === 'diag' || mode === 'height' ? '$PQ =$' : mode === 'apex' ? 'Distance =' : 'Area =',
      traps: ok,
      figure: fig.build(true),
      explanation: `Recognize: lines parallel to the bases of a trapezoid create triangles with equal angles, so their sides are proportional.

${steps}

Check: ${mode === 'diagarea' ? `the height of triangle $${nA}${nB}E$ is less than ${H}, so its area must be less than $\\frac12 \\cdot ${a} \\cdot ${H} = ${dec(new Frac(a * H, 2))}$.` : 'the result must lie between the numbers it is built from, or beyond them in the apex case, because the legs spread out as you move toward the longer base.'}

Trap: ${ok.length ? ({ 'geo-sim-seg-midline': 'the average of the bases is the length halfway up, nowhere else', 'geo-sim-seg-no-double': 'leaving out the factor 2 gives only one of the two equal parts of the segment', 'geo-sim-seg-no-half': 'the area of a triangle is half of base times height, so the product alone is twice too big', 'geo-sim-seg-wrong-base': 'a distance of ' + t + ' from the other base would give a different length', 'geo-sim-seg-whole-height': 'the height of the trapezoid is shorter than the distance to the apex', 'geo-sim-seg-short-apex': 'the distance from the shorter base leaves out the height', 'geo-sim-seg-area-whole': 'the height of the whole trapezoid is not the height of the small triangle' } as Record<string, string>)[ok[0].trap] : 'compare with the numbers given'}.

Rule: when two lines are parallel, find the pair of similar triangles first and write a ratio of corresponding sides.`,
    };
    return { params: { mode, a, b, H, t, names: [nA, nB, nC, nD] }, q };
  },
  check(q, p, rng) {
    if (q.format !== 'ne') return 'format';
    const results: number[] = [];
    for (let i = 0; i < 4; i++) {
      const off = (rng.next() - 0.5) * 2 * p.a;
      const A: P2 = [0, 0];
      const B: P2 = [p.a, 0];
      const D: P2 = [off, p.H];
      const C: P2 = [off + p.b, p.H];
      const line = (P: P2, Q: P2, y: number): number => P[0] + ((Q[0] - P[0]) * (y - P[1])) / (Q[1] - P[1]);
      // intersection of the diagonals AC and BD
      const sx = (C[0] - A[0]) * (D[1] - B[1]) - (C[1] - A[1]) * (D[0] - B[0]);
      const u = ((B[0] - A[0]) * (D[1] - B[1]) - (B[1] - A[1]) * (D[0] - B[0])) / sx;
      const E: P2 = [A[0] + u * (C[0] - A[0]), A[1] + u * (C[1] - A[1])];
      if (p.mode === 'diag') results.push(line(B, C, E[1]) - line(A, D, E[1]));
      else if (p.mode === 'height') results.push(line(B, C, p.t) - line(A, D, p.t));
      else if (p.mode === 'apex') {
        // legs AD and BC meet where their x positions coincide
        const slopeL = (D[0] - A[0]) / p.H;
        const slopeR = (C[0] - B[0]) / p.H;
        results.push((B[0] - A[0]) / (slopeL - slopeR));
      } else results.push(Math.abs((B[0] - A[0]) * E[1]) / 2);
    }
    const exp = results[0];
    if (results.some((r) => Math.abs(r - exp) > 1e-7)) return 'depends on the shape';
    return Math.abs(q.answer.toNumber() - exp) < 1e-7 ? null : `expected ${exp}`;
  },
};

export const trapezoidSegmentTemplates = retryAll([trapezoidSegments]);
