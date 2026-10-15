import { Frac } from '../../../engine/frac';
import type { Template, Trap } from '../../../engine/types';
import { Redraw, retryAll } from '../redraw';
import { FigBuilder, type Pt } from './fig';

/* Distance in the coordinate plane: the differences of coordinates are the legs of a right triangle (NE). */

export const coordDistanceTraps: Record<string, Trap> = {
  'geo-cd-sum-diffs': {
    label: 'Added the horizontal and vertical differences',
    fix: 'The two differences are the legs of a right triangle; the distance is the hypotenuse $\\sqrt{(\\Delta x)^2 + (\\Delta y)^2}$, which is shorter than $\\Delta x + \\Delta y$.',
  },
  'geo-cd-no-root': {
    label: 'Forgot the square root',
    fix: '$(\\Delta x)^2 + (\\Delta y)^2$ is the SQUARE of the distance. Take its square root.',
  },
  'geo-cd-one-leg': {
    label: 'Used only the larger difference as the distance',
    fix: 'The distance is the hypotenuse, which is longer than either leg. Use both differences.',
  },
  'geo-cd-forgot-hyp': {
    label: 'Left the hypotenuse out of the perimeter',
    fix: 'The perimeter is the sum of all three sides. The third side is the hypotenuse $\\sqrt{(\\Delta x)^2 + (\\Delta y)^2}$.',
  },
  'geo-cd-hyp-only': {
    label: 'Gave the hypotenuse instead of the perimeter',
    fix: 'The hypotenuse is one side. The perimeter adds the two legs to it.',
  },
  'geo-cd-forgot-offset': {
    label: 'Gave the difference of the coordinates instead of the coordinate',
    fix: 'Solving gives $k - x_A = \\pm\\Delta x$. Add $x_A$ back: $k = x_A \\pm \\Delta x$.',
  },
  'geo-cd-other-root': {
    label: 'Took the root that the condition on $k$ rules out',
    fix: 'The equation has two solutions, one on each side of $x_A$. Use the stated condition ($k$ greater or less than $x_A$) to choose.',
  },
  'geo-cd-swapped-legs': {
    label: 'Used the vertical difference where the horizontal one belongs',
    fix: 'Subtract the known vertical difference squared from the distance squared: what is left is the horizontal difference squared.',
  },
};

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [6, 8, 10],
  [9, 12, 15],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
];

interface P {
  kind: 'distance' | 'perimeter' | 'missing';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  D?: number;
  right?: boolean; // k greater than x1
}

const pr = (v: number) => (v < 0 ? `(${v})` : `${v}`);
const pt = (x: number, y: number) => `$(${x}, ${y})$`;
const SETS: [string, string, string][] = [
  ['P', 'Q', 'R'],
  ['A', 'B', 'C'],
  ['X', 'Y', 'Z'],
  ['J', 'K', 'L'],
];

function plane(fb: FigBuilder, pts: Pt[]) {
  const fig = fb.build();
  const R = Math.max(5, ...pts.flatMap((p) => [Math.abs(p[0]), Math.abs(p[1])])) + 1;
  fig.axes = { xMin: -R, xMax: R, yMin: -R, yMax: R, grid: true, step: R > 8 ? 2 : 1, labelTicks: true };
  return fig;
}

const coordDistance: Template<P> = {
  id: 'geo.right-triangles.coordinate-distance-ne',
  skill: 'geo.right-triangles',
  format: 'ne',
  style: 'distance between points in the coordinate plane, perimeter, or a missing coordinate',
  generate(rng, d) {
    const [a0, b0, c] = rng.pick(d === 3 ? TRIPLES.slice(3) : TRIPLES.slice(0, 4));
    const [a, b] = rng.chance(0.5) ? [a0, b0] : [b0, a0];
    const sx = rng.pick([-1, 1]);
    const sy = rng.pick([-1, 1]);
    const traps: { value: Frac; trap: string }[] = [];
    const push = (v: number, trap: string, ans: number) => {
      if (v !== ans && v > -1000 && !traps.some((t) => t.value.eq(new Frac(v)))) traps.push({ value: new Frac(v), trap });
    };
    if (d === 3) {
      const x1 = rng.int(-9, 9);
      const y1 = rng.int(-9, 9);
      const y2 = y1 + sy * b; // known vertical difference b
      const right = rng.chance(0.5);
      const k = right ? x1 + a : x1 - a;
      if (x1 === 0 || k === 0 || a === b) throw new Redraw('degenerate');
      push(a, 'geo-cd-forgot-offset', k);
      push(right ? x1 - a : x1 + a, 'geo-cd-other-root', k);
      push(right ? x1 + b : x1 - b, 'geo-cd-swapped-legs', k);
      if (traps.length < 2) throw new Redraw('traps');
      const cond = right ? `k > ${x1}` : `k < ${x1}`;
      const kx = x1 < 0 ? `k + ${-x1}` : `k - ${x1}`;
      const stem = `In the $xy$-plane, point $A$ has coordinates ${pt(x1, y1)} and point $B$ has coordinates $(k, ${y2})$, where $${cond}$. If the distance from $A$ to $B$ is $${c}$, what is the value of $k$?`;
      const explanation = `Recognize: the distance formula is the Pythagorean theorem with the coordinate differences as legs.

The vertical difference is $|${y2} - ${pr(y1)}| = ${b}$, so $(${kx})^2 + ${b}^2 = ${c}^2$ and $(${kx})^2 = ${c * c} - ${b * b} = ${a * a}$. Then $${kx} = \\pm ${a}$. The condition $${cond}$ keeps ${right ? 'the plus sign' : 'the minus sign'}: $k = ${x1} ${right ? '+' : '-'} ${a} = ${k}$.

Check: from ${pt(x1, y1)} to $(${k}, ${y2})$ the differences are $${a}$ and $${b}$, and $\\sqrt{${a * a} + ${b * b}} = ${c}$.

Trap: $${a}$ alone forgets to add back $${x1}$; the other root is $${right ? x1 - a : x1 + a}$.

Rule: distance squared minus the known difference squared gives the unknown difference squared.`;
      return {
        params: { kind: 'missing', x1, y1, x2: k, y2, D: c, right },
        q: { format: 'ne', stem, answer: new Frac(k), traps, explanation },
      };
    }
    const x1 = rng.int(-6, 4);
    const y1 = rng.int(-6, 4);
    const x2 = x1 + sx * a;
    const y2 = y1 + sy * b;
    if ([x1, x2, y1, y2].some((v) => Math.abs(v) > 11)) throw new Redraw('outside the grid');
    const [n1, n2, n3] = rng.pick(SETS);
    if (d === 1) {
      push(a + b, 'geo-cd-sum-diffs', c);
      push(c * c, 'geo-cd-no-root', c);
      push(Math.max(a, b), 'geo-cd-one-leg', c);
      const fb = new FigBuilder().pt(n1, [x1, y1], [-0.6, 0.6]).pt(n2, [x2, y2], [0.6, 0.6]).seg(n1, n2);
      const stem = `In the $xy$-plane above, point $${n1}$ has coordinates ${pt(x1, y1)} and point $${n2}$ has coordinates ${pt(x2, y2)}. What is the length of segment $\\overline{${n1}${n2}}$?`;
      const explanation = `Recognize: the horizontal and vertical differences between two points are the legs of a right triangle, and the segment is its hypotenuse.

$\\Delta x = |${x2} - ${pr(x1)}| = ${a}$ and $\\Delta y = |${y2} - ${pr(y1)}| = ${b}$. So $${n1}${n2} = \\sqrt{${a}^2 + ${b}^2} = \\sqrt{${a * a + b * b}} = ${c}$.

Check: $${a}$, $${b}$, $${c}$ is a Pythagorean triple (or a multiple of one).

Trap: $${a + b}$ adds the two differences, but a hypotenuse is shorter than the sum of the legs.

Rule: distance $= \\sqrt{(\\Delta x)^2 + (\\Delta y)^2}$.`;
      return {
        params: { kind: 'distance', x1, y1, x2, y2 },
        q: { format: 'ne', stem, figure: plane(fb, [[x1, y1], [x2, y2]]), answer: new Frac(c), traps, explanation },
      };
    }
    // d2: perimeter of a right triangle with legs parallel to the axes
    push(a + b, 'geo-cd-forgot-hyp', a + b + c);
    push(c, 'geo-cd-hyp-only', a + b + c);
    push(2 * (a + b), 'geo-cd-sum-diffs', a + b + c);
    const fb = new FigBuilder().pt(n1, [x1, y1], [-0.6, -0.6]).pt(n2, [x2, y1], [0.6, -0.6]).pt(n3, [x1, y2], [-0.6, 0.6]);
    fb.poly(n1, n2, n3).right(n2, n1, n3);
    const stem = `In the $xy$-plane above, the vertices of triangle $${n1}${n2}${n3}$ are $${n1} = (${x1}, ${y1})$, $${n2} = (${x2}, ${y1})$ and $${n3} = (${x1}, ${y2})$. What is the perimeter of the triangle?`;
    const explanation = `Recognize: $${n1}${n2}$ is horizontal and $${n1}${n3}$ is vertical, so the angle at $${n1}$ is right and the two differences are legs.

$${n1}${n2} = |${x2} - ${pr(x1)}| = ${a}$ and $${n1}${n3} = |${y2} - ${pr(y1)}| = ${b}$. The side $${n2}${n3}$ is the hypotenuse: $\\sqrt{${a}^2 + ${b}^2} = ${c}$. The perimeter is $${a} + ${b} + ${c} = ${a + b + c}$.

Check: the hypotenuse is longer than each leg and shorter than $${a} + ${b}$.

Trap: $${a + b}$ stops at the two legs, and $${c}$ is just the hypotenuse.

Rule: perimeter needs all three sides.`;
    return {
      params: { kind: 'perimeter', x1, y1, x2, y2 },
      q: { format: 'ne', stem, figure: plane(fb, [[x1, y1], [x2, y1], [x1, y2]]), answer: new Frac(a + b + c), traps, explanation },
    };
  },
  check(q, p) {
    if (q.format !== 'ne') return 'format';
    if (p.kind === 'distance') return Math.abs(Math.hypot(p.x2 - p.x1, p.y2 - p.y1) - q.answer.toNumber()) < 1e-9 ? null : 'wrong distance';
    if (p.kind === 'perimeter') {
      const per = Math.hypot(p.x2 - p.x1, 0) + Math.hypot(0, p.y2 - p.y1) + Math.hypot(p.x2 - p.x1, p.y2 - p.y1);
      return Math.abs(per - q.answer.toNumber()) < 1e-9 ? null : 'wrong perimeter';
    }
    // missing coordinate: search the whole numbers k on the stated side with the stated distance
    const hits: number[] = [];
    for (let k = -80; k <= 80; k++) {
      if (p.right ? k <= p.x1 : k >= p.x1) continue;
      if (Math.abs(Math.hypot(k - p.x1, p.y2 - p.y1) - p.D!) < 1e-9) hits.push(k);
    }
    if (hits.length !== 1) return `${hits.length} values of k fit`;
    return q.answer.eq(new Frac(hits[0])) ? null : `expected ${hits[0]}`;
  },
};

export const coordDistanceTemplates = retryAll([coordDistance]);
