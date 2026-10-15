import { Frac, frac } from '../../../engine/frac';
import { lcm } from '../../../engine/math';
import type { Rng } from '../../../engine/rng';
import { lin, num, paren, poly } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';

// New alg.graphs style (NE): area of the triangle formed by two lines and a coordinate axis.
export const lineTriangleTraps: Record<string, Trap> = {
  'alg-gt-no-half': {
    label: 'Forgot the factor $\\frac{1}{2}$: gave base times height',
    fix: 'The area of a triangle is half of base times height. Base times height is the area of the rectangle around it.',
  },
  'alg-gt-sum-intercepts': {
    label: 'Added the intercepts to get the base instead of subtracting',
    fix: 'The base is the distance between the two points where the lines meet the axis: the difference of the two values (as positive lengths along the axis), not their sum.',
  },
  'alg-gt-wrong-coordinate': {
    label: 'Used the wrong coordinate of the intersection point as the height',
    fix: 'When the base lies on the $y$-axis the height is the horizontal distance to the third vertex, its $x$-coordinate. When the base lies on the $x$-axis the height is its $y$-coordinate.',
  },
};

interface LParams {
  axis: 'x' | 'y';
  l1: [number, number, number]; // A x + B y = C
  l2: [number, number, number];
}

const nz = (rng: Rng, lo: number, hi: number) => rng.int(lo, hi) * rng.sign();
type Line = [number, number, number];
const slopeForm = (m: number, b: number): Line => [-m, 1, b];
const show = (m: number, b: number) => `y = ${poly([m, b])}`;

const lineTriangleNE: Template<LParams> = {
  id: 'alg.graphs.line-triangle-ne',
  skill: 'alg.graphs',
  format: 'ne',
  style: 'area of the triangle formed by two lines and a coordinate axis',
  generate(rng, d) {
    for (;;) {
      let h: number;
      let k: number;
      let l1: Line;
      let l2: Line;
      let t1: string;
      let t2: string;
      let axis: 'x' | 'y' = 'y';
      if (d === 3) {
        axis = 'x';
        const m1 = nz(rng, 1, 3);
        const m2 = nz(rng, 1, 3);
        if (m1 === m2) continue;
        k = nz(rng, 1, 2) * lcm(Math.abs(m1), Math.abs(m2));
        h = nz(rng, 1, 5);
        // line i passes through (h, k) with slope m_i
        l1 = slopeForm(m1, k - m1 * h);
        l2 = slopeForm(m2, k - m2 * h);
        t1 = show(m1, k - m1 * h);
        t2 = show(m2, k - m2 * h);
      } else {
        const m1 = nz(rng, 1, 5);
        h = nz(rng, 1, 6);
        k = nz(rng, 1, 9);
        l1 = slopeForm(m1, k - m1 * h);
        t1 = show(m1, k - m1 * h);
        if (d === 1) {
          const m2 = nz(rng, 1, 5);
          if (m2 === m1) continue;
          l2 = slopeForm(m2, k - m2 * h);
          t2 = show(m2, k - m2 * h);
        } else {
          const a = nz(rng, 1, 6);
          const b2 = rng.pick([2, 4, 5]) * rng.sign();
          if (frac(-a, b2).eq(m1)) continue;
          l2 = [a, b2, a * h + b2 * k];
          t2 = `${lin([[a, 'x'], [b2, 'y']])} = ${num(a * h + b2 * k)}`;
        }
      }
      if (Math.abs(l1[2]) > 40 || Math.abs(l2[2]) > 60) continue;
      // closed form used for the key: axis crossings from C / B (y-axis) or C / A (x-axis)
      let base: Frac;
      let height: Frac;
      let wrongBase: Frac;
      let wrongHeight: Frac;
      let c1: Frac;
      let c2: Frac;
      if (axis === 'y') {
        c1 = frac(l1[2], l1[1]);
        c2 = frac(l2[2], l2[1]);
        base = c1.sub(c2).abs();
        height = frac(Math.abs(h));
        wrongBase = c1.add(c2).abs();
        wrongHeight = frac(Math.abs(k));
      } else {
        c1 = frac(l1[2], l1[0]);
        c2 = frac(l2[2], l2[0]);
        base = c1.sub(c2).abs();
        height = frac(Math.abs(k));
        wrongBase = c1.add(c2).abs();
        wrongHeight = frac(Math.abs(h));
      }
      const answer = base.mul(height).div(2);
      const traps = [
        { value: base.mul(height), trap: 'alg-gt-no-half' },
        { value: wrongBase.mul(height).div(2), trap: 'alg-gt-sum-intercepts' },
        { value: base.mul(wrongHeight).div(2), trap: 'alg-gt-wrong-coordinate' },
      ].filter((t) => !t.value.eq(answer) && t.value.gt(0));
      if (traps.length < 2 || !answer.isTerminating() || answer.eq(0) || answer.gt(500)) continue;
      const first = traps[0];
      const noteBy: Record<string, string> = {
        'alg-gt-no-half': `the product $${num(first.value)}$ is the area of the rectangle, twice the triangle`,
        'alg-gt-sum-intercepts': `adding the intercepts, $${num(c1)}$ and $${num(c2)}$, gives a base of $${num(wrongBase)}$ and an area of $${num(first.value)}$ instead of using their difference`,
        'alg-gt-wrong-coordinate': `using the ${axis === 'y' ? 'y' : 'x'}-coordinate $${num(wrongHeight)}$ as the height leads to $${num(first.value)}$, but the height is the distance from the base axis to the intersection point`,
      };
      const axisName = axis === 'y' ? 'y' : 'x';
      const crossing = (c: Frac) => (axis === 'y' ? `$x = 0$ gives $y = ${num(c)}$` : `$y = 0$ gives $x = ${num(c)}$`);
      const explanation = `Three vertices: the two points where the lines meet the ${axisName}-axis, and the point where the lines meet each other.

${crossing(c1)} for the first line and ${crossing(c2)} for the second, so the base on the ${axisName}-axis is $|${num(c1)} - ${paren(c2)}| = ${num(base)}$. Subtracting the equations (or substituting) shows the lines meet at $(${num(h)}, ${num(k)})$, so the height is $${num(height)}$. Area: $\\frac{1}{2}\\cdot ${num(base)}\\cdot ${num(height)} = ${num(answer)}$.

Trap: ${noteBy[first.trap]}. Rule: base along the axis, height measured from that axis.`;
      return {
        params: { axis, l1, l2 },
        q: {
          format: 'ne',
          stem: `In the $xy$-plane, the lines $${t1}$ and $${t2}$ intersect at a point. The two lines and the $${axisName}$-axis form a triangle. What is the area of the triangle?`,
          answer,
          traps,
          explanation,
        },
      };
    }
  },
  check(q, P) {
    if (q.format !== 'ne') return 'wrong format';
    const [A1, B1, C1] = P.l1;
    const [A2, B2, C2] = P.l2;
    const det = frac(A1 * B2 - A2 * B1);
    if (det.eq(0)) return 'parallel lines';
    const X = frac(C1 * B2 - C2 * B1).div(det);
    const Y = frac(A1 * C2 - A2 * C1).div(det);
    const cut = (A: number, B: number, C: number): [Frac, Frac] => (P.axis === 'y' ? [frac(0), frac(C, B)] : [frac(C, A), frac(0)]);
    const pts = [cut(A1, B1, C1), cut(A2, B2, C2), [X, Y] as [Frac, Frac]];
    let s = frac(0);
    for (let i = 0; i < 3; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % 3];
      s = s.add(x1.mul(y2).sub(x2.mul(y1)));
    }
    const area = s.abs().div(2);
    return area.eq(q.answer) ? null : `shoelace area ${area}, keyed ${q.answer}`;
  },
};

export const lineTriangleTemplates: Template<any>[] = [lineTriangleNE];
