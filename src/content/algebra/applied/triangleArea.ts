import { Frac, frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import { num, paren } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';

// New alg.coordinate style: area of a triangle from its vertices, and the unknown coordinate
// of a vertex when the area is given.
export const triangleAreaTraps: Record<string, Trap> = {
  'alg-ca-no-half': {
    label: 'Forgot the factor $\\frac{1}{2}$: gave base times height',
    fix: 'The area of a triangle is $\\frac{1}{2} \\cdot \\text{base} \\cdot \\text{height}$. Base times height is the area of the rectangle around it.',
  },
  'alg-ca-add': {
    label: 'Added the base and the height',
    fix: 'Area multiplies: $\\frac{1}{2} \\cdot b \\cdot h$. Adding the two lengths measures nothing about area.',
  },
  'alg-ca-height-from-axis': {
    label: 'Measured the height from the $x$-axis instead of from the base',
    fix: 'The height is the perpendicular distance from the third vertex to the line holding the base. If the base is the line $y = c$, the height is $|y - c|$, not $|y|$.',
  },
  'alg-ca-no-double': {
    label: 'Divided the area by the base without doubling it first',
    fix: 'From $S = \\frac{1}{2} b h$ we get $h = \\frac{2S}{b}$. The factor 2 is needed to undo the one half.',
  },
  'alg-ca-height-not-coord': {
    label: 'Gave the height instead of the coordinate of the vertex',
    fix: 'The height is only the distance from the base line. The coordinate is that distance added to the $y$-value of the base line.',
  },
  'alg-ca-wrong-side': {
    label: 'Placed the vertex on the wrong side of the base',
    fix: 'Read the condition on the unknown coordinate. If the vertex lies above the base, add the height to the $y$-value of the base; do not subtract it.',
  },
};

interface TParams {
  mode: 'axis' | 'line' | 'unknown';
  xa: number;
  xb: number;
  y0: number;
  xc: number;
  yc: number;
  S: number;
}

const nz = (rng: Rng, lo: number, hi: number) => rng.int(lo, hi) * rng.sign();
const pt = (x: number, y: number | string) => `(${num(x)}, ${typeof y === 'string' ? y : num(y)})`;

const triangleAreaNE: Template<TParams> = {
  id: 'alg.coordinate.triangle-area-ne',
  skill: 'alg.coordinate',
  format: 'ne',
  style: 'area of a triangle with a horizontal side; unknown vertex coordinate from the area',
  generate(rng, d) {
    for (;;) {
      if (d === 1) {
        const xa = rng.int(-6, 2);
        const w = rng.int(3, 9);
        const xb = xa + w;
        const h = nz(rng, 2, 9);
        const xc = rng.int(-6, 8);
        const area = frac(w * Math.abs(h), 2);
        const traps = [
          { value: frac(w * Math.abs(h)), trap: 'alg-ca-no-half' },
          { value: frac(w + Math.abs(h)), trap: 'alg-ca-add' },
        ].filter((t) => !t.value.eq(area));
        const first = traps[0];
        return {
          params: { mode: 'axis', xa, xb, y0: 0, xc, yc: h, S: 0 },
          q: {
            format: 'ne',
            stem: `In the $xy$-plane, a triangle has vertices at $${pt(xa, 0)}$, $${pt(xb, 0)}$ and $${pt(xc, h)}$. What is the area of the triangle?`,
            answer: area,
            traps,
            explanation: `Two vertices lie on the $x$-axis, so the segment between them is a horizontal base.

The base is $|${num(xb)} - ${paren(xa)}| = ${w}$. The third vertex is $${Math.abs(h)}$ units from the $x$-axis, so the height is $${Math.abs(h)}$ whatever its $x$-coordinate is. Then $\\text{area} = \\frac{1}{2}\\cdot ${w}\\cdot ${Math.abs(h)} = ${num(area)}$.

Check: the rectangle around the triangle has area $${w * Math.abs(h)}$, and the triangle is half of it.

Trap: ${first.trap === 'alg-ca-no-half' ? `the product $${num(first.value)}$ is the rectangle, twice the triangle` : `the sum $${num(first.value)}$ adds lengths`}. Rule: area = half of base times perpendicular height.`,
          },
        };
      }
      if (d === 2) {
        const xa = rng.int(-7, 2);
        const w = rng.int(3, 9);
        const xb = xa + w;
        const y0 = nz(rng, 2, 7);
        const gap = nz(rng, 2, 8);
        const yc = y0 + gap;
        if (yc === 0) continue;
        const xc = rng.int(-7, 9);
        const area = frac(w * Math.abs(gap), 2);
        const fromAxis = frac(w * Math.abs(yc), 2);
        if (fromAxis.eq(area)) continue;
        const traps = [
          { value: fromAxis, trap: 'alg-ca-height-from-axis' },
          { value: frac(w * Math.abs(gap)), trap: 'alg-ca-no-half' },
        ];
        return {
          params: { mode: 'line', xa, xb, y0, xc, yc, S: 0 },
          q: {
            format: 'ne',
            stem: `In the $xy$-plane, a triangle has vertices at $${pt(xa, y0)}$, $${pt(xb, y0)}$ and $${pt(xc, yc)}$. What is the area of the triangle?`,
            answer: area,
            traps,
            explanation: `The first two vertices have the same $y$-coordinate, so the segment between them is horizontal and can serve as the base.

The base is $${w}$. The height is the vertical distance from the third vertex to the line $y = ${num(y0)}$, that is $|${num(yc)} - ${paren(y0)}| = ${Math.abs(gap)}$. Then the area is $\\frac{1}{2}\\cdot ${w}\\cdot ${Math.abs(gap)} = ${num(area)}$.

Check: the $x$-coordinate of the third vertex does not change the height, so any $x$ gives the same area.

Trap: measuring the height from the $x$-axis uses $|${num(yc)}| = ${Math.abs(yc)}$ and leads to $${num(fromAxis)}$, but the base does not lie on the axis. Rule: height is measured to the line of the base.`,
          },
        };
      }
      const xa = rng.int(-6, 2);
      const w = rng.int(3, 9);
      const xb = xa + w;
      const y0 = nz(rng, 1, 6);
      const h = rng.int(2, 9);
      if ((w * h) % 2 !== 0) continue;
      const S = (w * h) / 2;
      const xc = rng.int(-6, 8);
      const k = y0 + h;
      const traps = [
        { value: frac(S, w).add(y0), trap: 'alg-ca-no-double' },
        { value: frac(h), trap: 'alg-ca-height-not-coord' },
        { value: frac(y0 - h), trap: 'alg-ca-wrong-side' },
      ].filter((t) => !t.value.eq(k));
      const note: Record<string, string> = {
        'alg-ca-no-double': `dividing $${S}$ by the base without doubling gives $${num(traps.find((t) => t.trap === 'alg-ca-no-double')?.value ?? 0)}$ and a triangle of area $${num(frac(S, 2))}$`,
        'alg-ca-height-not-coord': `$${h}$ is the height, not the coordinate`,
        'alg-ca-wrong-side': `subtracting the height gives $${num(y0 - h)}$, which puts the vertex below the base`,
      };
      const first = traps[0];
      return {
        params: { mode: 'unknown', xa, xb, y0, xc, yc: k, S },
        q: {
          format: 'ne',
          stem: `In the $xy$-plane, a triangle has vertices at $${pt(xa, y0)}$, $${pt(xb, y0)}$ and $${pt(xc, 'k')}$, where $k > ${num(y0)}$. If the area of the triangle is $${S}$, what is the value of $k$?`,
          answer: frac(k),
          prefix: '$k =$',
          traps,
          explanation: `The first two vertices share the $y$-coordinate $${num(y0)}$, so the base is horizontal with length $${w}$.

The area gives the height: $${S} = \\frac{1}{2}\\cdot ${w}\\cdot h$, so $h = \\frac{2 \\cdot ${S}}{${w}} = ${h}$. The third vertex lies above the base line $y = ${num(y0)}$, so $k = ${num(y0)} + ${h} = ${k}$.

Check: the height $|${k} - ${paren(y0)}| = ${h}$ gives $\\frac{1}{2}\\cdot ${w}\\cdot ${h} = ${S}$.

Trap: ${note[first.trap]}. Rule: find the height from the area, then place the vertex using the stated side.`,
        },
      };
    }
  },
  check(q, P) {
    if (q.format !== 'ne') return 'wrong format';
    const shoelace = (pts: [Frac, Frac][]) => {
      let s = frac(0);
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[(i + 1) % pts.length];
        s = s.add(x1.mul(y2).sub(x2.mul(y1)));
      }
      return s.abs().div(2);
    };
    if (P.mode === 'unknown') {
      const area = shoelace([[frac(P.xa), frac(P.y0)], [frac(P.xb), frac(P.y0)], [frac(P.xc), q.answer]]);
      if (!area.eq(P.S)) return `area with k=${q.answer} is ${area}, expected ${P.S}`;
      return q.answer.gt(P.y0) ? null : 'k must be above the base';
    }
    const area = shoelace([[frac(P.xa), frac(P.y0)], [frac(P.xb), frac(P.y0)], [frac(P.xc), frac(P.yc)]]);
    return area.eq(q.answer) ? null : `shoelace area ${area}, keyed ${q.answer}`;
  },
};

export const triangleAreaTemplates: Template<any>[] = [triangleAreaNE];
