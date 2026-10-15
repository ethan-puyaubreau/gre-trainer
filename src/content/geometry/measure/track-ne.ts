import { Frac } from '../../../engine/frac';
import type { NEQuestion, Template, Trap } from '../../../engine/types';
import { pathLength, shoelace } from './ex';
import { arcPts, Fig, type P2 } from './fig';
import { noClash, retryAll } from '../redraw';

/* Track or window made of a rectangle and semicircles: the perimeter or area is given as a + b*pi, find a dimension (NE). */

export const trackTraps: Record<string, Trap> = {
  'geom-track-no-halve': {
    label: 'Used the whole straight part of the boundary as one side',
    fix: 'The straight part of the boundary has two sides of length $L$, so the rational part of the perimeter equals $2L$, not $L$. Divide by 2.',
  },
  'geom-track-ends-counted': {
    label: 'Counted the two ends of the rectangle as part of the boundary',
    fix: 'Where a semicircle is attached, the end of the rectangle is inside the shape. The boundary uses the arc instead, so only the two long sides and the arcs count.',
  },
  'geom-track-no-bottom': {
    label: 'Forgot the bottom side of the window in the boundary',
    fix: 'The boundary of the whole window is the bottom side $w$, the two sides $L$, and the arc over the top. Only the top side is replaced by the arc.',
  },
  'geom-track-b-is-width': {
    label: 'Read the coefficient of pi as the width of the figure',
    fix: 'In a perimeter, the term $w\\pi$ or $\\frac{w\\pi}{2}$ shows the width, but in an area the coefficient of $\\pi$ is $\\frac{w^2}{4}$ or $\\frac{w^2}{8}$. Work out which one the semicircles produce.',
  },
  'geom-track-diameter-radius': {
    label: 'Mixed up radius and diameter when reading the area of the semicircles',
    fix: 'Two semicircles of diameter $w$ make one circle of radius $\\frac{w}{2}$, with area $\\frac{\\pi w^2}{4}$. The coefficient of $\\pi$ is the square of the radius, not of the diameter.',
  },
};

type Shape = 'stadium' | 'window';
type Given = 'perimeter' | 'area';
interface Params {
  shape: Shape;
  given: Given;
  ask: 'L' | 'rect';
  w: number;
  L: number;
  a: number;
  b: number;
  answer: string;
}

const piTex = (b: number) => (b === 1 ? '\\pi' : `${b}\\pi`);

/** Boundary of the shape as a polygon (fine arcs). */
function outline(shape: Shape, w: number, L: number): P2[] {
  if (shape === 'stadium') return [...arcPts([L, w / 2], w / 2, -90, 90, 0.25), ...arcPts([0, w / 2], w / 2, 90, 270, 0.25)];
  return [[0, 0], [w, 0], [w, L], ...arcPts([w / 2, L], w / 2, 0, 180, 0.25), [0, L]];
}

const track: Template<Params> = {
  id: 'geo.composite.track',
  skill: 'geo.composite',
  format: 'ne',
  style: 'track or window with semicircles: perimeter or area given as a + b pi, find the straight length or the rectangle area',
  generate(rng, dif) {
    const shape: Shape = rng.pick(['stadium', 'window']);
    const given: Given = dif === 2 ? 'area' : 'perimeter';
    const ask = dif === 3 ? 'rect' : 'L';
    // w: stadium any width, window an even width (perimeter) or a multiple of 4 (area)
    const w = shape === 'stadium' ? (given === 'area' ? 2 * rng.int(1, 8) : rng.int(2, 16)) : given === 'area' ? 4 * rng.int(1, 4) : 2 * rng.int(2, 8);
    const L = rng.int(shape === 'stadium' ? 3 : 2, 40);
    let a: number;
    let b: number;
    if (given === 'perimeter') {
      a = shape === 'stadium' ? 2 * L : w + 2 * L;
      b = shape === 'stadium' ? w : w / 2;
    } else {
      a = L * w;
      b = shape === 'stadium' ? (w * w) / 4 : (w * w) / 8;
    }
    const answer = ask === 'L' ? L : L * w;
    const traps: { value: Frac; trap: string }[] = [];
    const add = (v: number, trap: string) => {
      if (v > 0 && Math.abs(v * 2 - Math.round(v * 2)) < 1e-9 && !traps.some((t) => t.value.eq(new Frac(Math.round(v * 2), 2)))) traps.push({ value: new Frac(Math.round(v * 2), 2), trap });
    };
    if (ask === 'L' && given === 'perimeter') {
      if (shape === 'stadium') {
        add(a, 'geom-track-no-halve');
        add(a / 2 - w, 'geom-track-ends-counted');
      } else {
        add(a / 2, 'geom-track-no-bottom');
        add(a - w, 'geom-track-no-halve');
      }
    } else if (ask === 'L') {
      add(a / b, 'geom-track-b-is-width');
      if (shape === 'stadium') add(a / Math.sqrt(b), 'geom-track-diameter-radius');
    } else if (shape === 'stadium') {
      add(a * b, 'geom-track-no-halve');
    } else {
      add(a * b, 'geom-track-no-bottom');
      add((b * (a - b)) / 2, 'geom-track-b-is-width');
    }
    const fig = new Fig();
    const draw = shape === 'stadium' ? outline('stadium', 2, 5) : outline('window', 3, 3.5);
    fig.polyXY(draw);
    const wLabel = dif === 1 ? `$${w}$` : '$w$';
    if (shape === 'stadium') {
      fig.segXY([0, 0], [0, 2], wLabel);
      fig.segXY([0, 0], [5, 0], '$L$');
    } else {
      fig.segXY([0, 0], [3, 0], wLabel);
      fig.segXY([3, 0], [3, 3.5], '$L$');
    }
    const expr = `${a} + ${piTex(b)}`;
    const wTxt = dif === 1 ? `${w} meters` : '$w$ meters';
    const body =
      shape === 'stadium'
        ? `A track is made of a rectangle of width ${wTxt} and length $L$ meters, with a semicircle attached outward on each of the two sides of width ${dif === 1 ? `${w}` : '$w$'}, so each semicircle has that side as its diameter.`
        : `A window is made of a rectangle of width ${wTxt} and height $L$ meters, with a semicircle on top whose diameter is the top side of the rectangle.`;
    const whole = shape === 'stadium' ? 'track' : 'window';
    const given1 =
      given === 'perimeter'
        ? `The distance around the whole ${whole} is $${expr}$ meters.`
        : `The area of the whole ${whole}, ${shape === 'stadium' ? 'rectangle and semicircles together' : 'rectangle and semicircle together'}, is $${expr}$ square meters.`;
    const ints = dif === 1 ? '' : ' Both $w$ and $L$ are positive integers.';
    const question = ask === 'L' ? `What is $L$, in meters?` : `What is the area, in square meters, of the rectangular part?`;
    // explanation
    const bound = shape === 'stadium' ? '2L + \\pi w' : 'w + 2L + \\frac{\\pi w}{2}';
    const coefp = shape === 'stadium' ? 'w' : '\\frac{w}{2}';
    const coefa = shape === 'stadium' ? '\\frac{w^2}{4}' : '\\frac{w^2}{8}';
    const semis = shape === 'stadium' ? 'The two semicircles together make one circle of diameter $w$.' : 'The semicircle has diameter $w$, so its arc is half of a circle of that diameter.';
    let explanation: string;
    if (given === 'perimeter') {
      const pieces = shape === 'stadium' ? 'two straight sides $L$ and the circle $\\pi w$' : 'the bottom $w$, two sides $L$, and the arc $\\frac{\\pi w}{2}$';
      const plain = shape === 'stadium' ? `$2L = ${a}$, so $L = ${L}$` : `$w + 2L = ${a}$, so $2L = ${a - w}$ and $L = ${L}$`;
      explanation = `${semis} The distance around is made of ${pieces}: $${bound}$. ${dif === 1 ? `With $w = ${w}$ given, the plain part of the distance must equal the plain part of $${expr}$: ${plain}.` : `Because $\\pi$ is irrational and $w$, $L$ are integers, the $\\pi$ terms and the plain terms of $${expr}$ must match separately. The $\\pi$ part gives $${coefp} = ${b}$, so $w = ${w}$. The plain part gives ${plain}.`}

${ask === 'L' ? `The answer is $L = ${L}$.` : `The rectangle measures $${w}$ by $${L}$, so its area is $${w} \\cdot ${L} = ${answer}$.`}

Check: $${shape === 'stadium' ? `2 \\cdot ${L} + ${piTex(w)}` : `${w} + 2 \\cdot ${L} + ${piTex(w / 2)}`}$ is the given distance.

Trap: ${shape === 'stadium' ? `taking the plain part, ${a}, as $L$; it is $2L$` : 'leaving out the bottom side, which is part of the boundary'}.

Rule: match the $\\pi$ part and the plain part separately.`;
    } else {
      explanation = `${semis} The area is the rectangle $Lw$ plus ${shape === 'stadium' ? '$\\frac{\\pi w^2}{4}$' : '$\\frac{\\pi w^2}{8}$'}. Because $\\pi$ is irrational and $w$, $L$ are integers, match the $\\pi$ part of $${expr}$ first: $${coefa} = ${b}$, so $w^2 = ${shape === 'stadium' ? 4 * b : 8 * b}$ and $w = ${w}$. The plain part gives $Lw = ${a}$, so $L = \\frac{${a}}{${w}} = ${L}$.

Check: $${L} \\cdot ${w} + ${piTex(b)}$ is the given area.

Trap: reading ${b} as the width. It is $${coefa}$, a square of a length, so the width needs a square root.

Rule: the $\\pi$ part of an area gives the radius squared.`;
    }
    const q: NEQuestion = {
      format: 'ne',
      stem: `${body} ${given1}${ints} ${question}`,
      figure: fig.build(true),
      answer: Frac.of(answer),
      traps: noClash(traps, Frac.of(answer)),
      suffix: ask === 'L' ? 'meters' : 'square meters',
      prefix: ask === 'L' ? '$L =$' : 'Area $=$',
      explanation,
    };
    return { params: { shape, given, ask, w, L, a, b, answer: String(answer) }, q };
  },
  check(q, p) {
    if (q.format !== 'ne') return 'format';
    const pts = outline(p.shape, p.w, p.L);
    const measured = (p.given === 'perimeter' ? pathLength(pts, true) : shoelace(pts));
    const stated = p.a + p.b * Math.PI;
    if (Math.abs(measured - stated) > 1e-3 * stated) return `the shape measures ${measured}, the stem says ${stated}`;
    const asked = p.ask === 'L' ? p.L : shoelace([[0, 0], [p.shape === 'stadium' ? p.L : p.w, 0], [p.shape === 'stadium' ? p.L : p.w, p.shape === 'stadium' ? p.w : p.L], [0, p.shape === 'stadium' ? p.w : p.L]]);
    return Math.abs(asked - q.answer.toNumber()) < 1e-9 ? null : `expected ${asked}`;
  },
};

export const trackTemplates = retryAll([track]);
