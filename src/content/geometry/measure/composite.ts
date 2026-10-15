import { flaggedChoices, qcFromSamples, QC_TEXT } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { plural } from '../../../engine/text';
import { num, plain } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template } from '../../../engine/types';
import { checkChoiceValue, dist, Ex, exChoices, pathLength, shoelace, unitCircle, type ExData } from './ex';
import { arcPts, Fig, onCircle, type P2 } from './fig';
import { Redraw, retryAll } from '../redraw';
import { trapNotes } from '../notes';

type Poly = P2[];
const O: P2 = [0, 0];
const areaOf = (polys: Poly[]) => polys.reduce((s, p) => s + shoelace(p), 0);
const relText = (a: QCChoice) => (a === 'A' ? 'Quantity A is greater' : a === 'B' ? 'Quantity B is greater' : 'the two quantities are equal');
function cmpTol(a: number, b: number, tol = 1e-4): QCChoice {
  if (Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b))) return 'C';
  return a > b ? 'A' : 'B';
}

/* ------------------------------------------------------------------ region builders (figure and check share them) */

/** Square [-a, a]^2 minus its inscribed circle: the four corner pieces. */
const cornerPieces = (a: number, step: number): Poly[] =>
  [0, 1, 2, 3].map((q) => [onCircle(O, a * Math.SQRT2, 90 * q + 45), ...arcPts(O, a, 90 * q + 90, 90 * q, step)]);
/** Circle of radius R minus its inscribed square (vertices at 45° + 90°k): the four segments. */
const segmentPieces = (R: number, step: number, which = [0, 1, 2, 3]): Poly[] => which.map((q) => arcPts(O, R, 45 + 90 * q, 135 + 90 * q, step));
/** Square [0, s]^2 minus the quarter circle of radius s centered at the origin. */
const outsideQuarter = (s: number, step: number): Poly => [[s, 0], [s, s], [0, s], ...arcPts(O, s, 90, 0, step)];
const quarterDisk = (s: number, step: number): Poly => [O, ...arcPts(O, s, 0, 90, step)];
/** Square [0, s]^2 minus four quarter circles of radius s/2 at the corners: the central region. */
const centralRegion = (s: number, step: number): Poly => {
  const h = s / 2;
  return [
    ...arcPts([s, 0], h, 180, 90, step),
    ...arcPts([s, s], h, 270, 180, step),
    ...arcPts([0, s], h, 360, 270, step),
    ...arcPts([0, 0], h, 90, 0, step),
  ];
};
/** Ring between concentric circles, as one keyhole polygon (outer counterclockwise, inner clockwise). */
const ringKeyhole = (R: number, r: number, step: number): Poly => [...arcPts(O, R, 0, 360, step), ...arcPts(O, r, 360, 0, step)];

/** TeX of a value with its decimal approximation when it is irrational. */
const approx = (v: Ex) => (v.rational() ? v.tex() : `${v.tex()} \\approx ${v.value().toFixed(2)}`);

/** Choice/explanation text for a value a + b·π. */
const exT = (v: Ex) => `$${v.tex()}$`;

/* ================================================================== 1. Shaded regions (MCS) */

interface ShadedParams {
  mode: 'segment-one' | 'corners' | 'corner-one' | 'quarter-out' | 'four-quarters' | 'ring';
  s: number;
  r: number;
  values: ExData[];
}

function shadedPolys(p: { mode: ShadedParams['mode']; s: number; r: number }, step: number): Poly[] {
  switch (p.mode) {
    case 'segment-one':
      return segmentPieces(p.s / Math.SQRT2, step, [0]);
    case 'corners':
      return cornerPieces(p.s / 2, step);
    case 'corner-one':
      return cornerPieces(p.s / 2, step).slice(0, 1);
    case 'quarter-out':
      return [outsideQuarter(p.s, step)];
    case 'four-quarters':
      return [centralRegion(p.s, step)];
    case 'ring':
      return [ringKeyhole(p.r + p.s, p.r, step)];
  }
}

/** What the explanation says about the wrong choices that are present, by trap id (the choice texts are passed in). */
const SHADED_NOTES: Record<string, (vs: string) => string> = {
  'geom-shaded-one-piece': (vs) => `counting the wrong number of shaded pieces gives ${vs}`,
  'geom-shaded-radius-wrong': (vs) => `taking the wrong radius for a circle gives ${vs}`,
  'geom-shaded-circumference': (vs) => `subtracting a circumference, a length, from an area gives ${vs}`,
  'geom-shaded-wrong-region': (vs) => `finding the unshaded part, or the whole disk, gives ${vs}`,
  'geom-shaded-ring-difference': (vs) => `treating the ring as a disk of radius $R - r$ gives ${vs}, but the areas are subtracted, not the radii`,
  'geom-shaded-forgot-pi': (vs) => `leaving out the factor $\\pi$ gives ${vs}`,
  'geom-shaded-added-areas': (vs) => `adding the two areas gives ${vs}, but the ring is the larger disk with the smaller one removed`,
  'geom-shaded-fraction-wrong': (vs) => `removing the wrong fraction of the circle gives ${vs}`,
};

const shaded: Template<ShadedParams> = {
  id: 'geo.composite.shaded',
  skill: 'geo.composite',
  format: 'mcs',
  style: 'area of a shaded region between a circle and a square',
  generate(rng, d) {
    const mode = rng.pick(
      d === 1
        ? (['corners', 'corner-one', 'quarter-out', 'ring'] as const)
        : d === 2
          ? (['segment-one', 'corners', 'quarter-out', 'four-quarters', 'ring'] as const)
          : (['segment-one', 'four-quarters', 'ring', 'corner-one', 'ring'] as const),
    );
    const fig = new Fig();
    let s = 0;
    let r = 0;
    let correct: Ex;
    const traps: { v: Ex; trap: string }[] = [];
    let fillers: Ex[] = [];
    let stem: string;
    let explanation: string;
    if (mode === 'segment-one') {
      s = 2 * rng.int(1, 6);
      const S = s * s;
      const R = s / Math.SQRT2;
      // circle area pi R^2 = pi S / 2; segment = (pi S/2 - S) / 4
      const circle = Ex.pi(new Frac(S, 2));
      correct = circle.sub(S).scale(new Frac(1, 4));
      traps.push(
        { v: circle.sub(S), trap: 'geom-shaded-one-piece' },
        { v: Ex.pi(S).sub(S).scale(new Frac(1, 4)), trap: 'geom-shaded-radius-wrong' },
        { v: circle.sub(S).scale(new Frac(1, 2)), trap: 'geom-shaded-one-piece' },
        { v: Ex.pi(new Frac(S, 8)), trap: 'geom-shaded-wrong-region' },
        { v: circle.sub(S).scale(new Frac(1, 8)), trap: 'geom-shaded-one-piece' },
      );
      fillers = [];
      const names = ['A', 'B', 'C', 'D'];
      const verts = [45, 135, 225, 315].map((t) => onCircle(O, R, t));
      for (const poly of shadedPolys({ mode, s, r }, 5)) fig.polyXY(poly, true);
      names.forEach((n, i) => fig.pt(n, verts[i]));
      fig.pt('Z', O).hide('Z');
      fig.poly(names).circle('Z', R);
      stem = `In the figure above, square $ABCD$ is inscribed in the circle. If the area of the square is ${S}, what is the area of the shaded region?`;
      explanation = `The square's side is $\\sqrt{${S}} = ${s}$ and its diagonal is $${s}\\sqrt{2}$. The diagonal of an inscribed square is a diameter, so the radius is $\\frac{${s}\\sqrt{2}}{2}$ and $r^2 = \\frac{${S}}{2} = ${num(S / 2)}$: the circle has area ${exT(circle)}.

The circle minus the square leaves four equal pieces, and the shaded region is one of them:

$$\\frac{${circle.tex()} - ${S}}{4} = ${correct.tex()}$$`;
    } else if (mode === 'corners' || mode === 'corner-one') {
      r = rng.int(2, d === 1 ? 6 : 9);
      s = 2 * r;
      const one = mode === 'corner-one';
      const total = Ex.of(s * s).sub(Ex.pi(r * r));
      correct = one ? total.scale(new Frac(1, 4)) : total;
      traps.push({ v: Ex.of(s * s).sub(Ex.pi(2 * r)), trap: 'geom-shaded-circumference' }, { v: Ex.pi(r * r), trap: 'geom-shaded-wrong-region' });
      // a wrong number of corners: one, two or three of them instead of four (or two to four instead of one)
      for (const f of one ? [4, 2, 3, new Frac(1, 2)] : [new Frac(1, 4), new Frac(1, 2), new Frac(3, 4)]) traps.push({ v: correct.scale(f), trap: 'geom-shaded-one-piece' });
      traps.push({ v: Ex.of(s * s).sub(Ex.pi(new Frac(r * r, 4))).scale(one ? new Frac(1, 4) : 1), trap: 'geom-shaded-radius-wrong' });
      fillers = [];
      const polys = shadedPolys({ mode, s, r }, 5);
      for (const poly of polys) fig.polyXY(poly, true);
      fig.pt('O', O).pt('A', [-r, -r]).pt('B', [r, -r]).pt('C', [r, r]).pt('D', [-r, r]);
      fig.poly(['A', 'B', 'C', 'D']).circle('O', r);
      fig.pt('T', [r, 0]).hide('T').seg('O', 'T', `$${r}$`);
      stem = `In the figure above, the circle with center $O$ is inscribed in square $ABCD$, and the radius of the circle is ${r}. What is the area of the shaded region?`;
      explanation = `The circle touches all four sides, so its diameter equals the side of the square: $2 \\cdot ${r} = ${s}$. The square has area $${s * s}$ and the circle has area $\\pi(${r})^2 = ${Ex.pi(r * r).tex()}$.

${
  one
    ? `The square minus the circle leaves four equal corner pieces, and only one is shaded: $\\frac{${total.tex()}}{4} = ${correct.tex()}$.`
    : `The shaded corners are the square minus the circle: $${correct.tex()}$.`
}`;
    } else if (mode === 'quarter-out') {
      s = rng.int(2, d === 1 ? 8 : 12);
      if (s % 2) s++;
      correct = Ex.of(s * s).sub(Ex.pi(new Frac(s * s, 4)));
      traps.push(
        { v: Ex.pi(new Frac(s * s, 4)), trap: 'geom-shaded-wrong-region' },
        { v: Ex.of(s * s).sub(Ex.pi(new Frac(s * s, 16))), trap: 'geom-shaded-radius-wrong' },
        { v: Ex.of(s * s).sub(Ex.pi(new Frac(s, 2))), trap: 'geom-shaded-circumference' },
        { v: Ex.of(s * s).sub(Ex.pi(new Frac(s * s, 8))), trap: 'geom-shaded-fraction-wrong' },
        { v: Ex.of(s * s).sub(Ex.pi(new Frac(s * s, 2))), trap: 'geom-shaded-fraction-wrong' },
      );
      fillers = [];
      fig.polyXY(outsideQuarter(s, 5), true);
      fig.pt('A', [0, 0]).pt('B', [s, 0]).pt('C', [s, s]).pt('D', [0, s]);
      fig.poly(['A', 'B', 'C', 'D']).seg('A', 'B', `$${s}$`);
      fig.path(arcPts(O, s, 0, 90, 5));
      stem = `In the figure above, $ABCD$ is a square, and the curved boundary of the shaded region is an arc of the circle with center $A$ and radius $AB$. What is the area of the shaded region?`;
      explanation = `The unshaded region is a quarter of a circle of radius ${s}: its area is $\\frac{1}{4}\\pi(${s})^2 = ${Ex.pi(new Frac(s * s, 4)).tex()}$.

Shaded = square − quarter circle $= ${correct.tex()}$.

The radius of the arc is the whole side ${s}, not half of it.`;
    } else if (mode === 'four-quarters') {
      s = 2 * rng.int(2, d === 2 ? 5 : 8);
      const h = s / 2;
      correct = Ex.of(s * s).sub(Ex.pi(h * h));
      traps.push(
        { v: Ex.pi(h * h), trap: 'geom-shaded-wrong-region' },
        { v: Ex.of(s * s).sub(Ex.pi(new Frac(h * h, 4))), trap: 'geom-shaded-one-piece' },
        { v: Ex.of(s * s).sub(Ex.pi(2 * h)), trap: 'geom-shaded-circumference' },
        { v: Ex.of(s * s).sub(Ex.pi(new Frac(h * h, 2))), trap: 'geom-shaded-fraction-wrong' },
        { v: Ex.of(s * s).sub(Ex.pi(new Frac(3 * h * h, 4))), trap: 'geom-shaded-one-piece' },
      );
      fillers = [];
      fig.polyXY(centralRegion(s, 5), true);
      fig.pt('A', [0, 0]).pt('B', [s, 0]).pt('C', [s, s]).pt('D', [0, s]);
      fig.poly(['A', 'B', 'C', 'D']).seg('A', 'B', `$${s}$`);
      stem = `In the figure above, $ABCD$ is a square, and each of the four unshaded regions is a quarter of a circle centered at a vertex of the square. The four arcs meet at the midpoints of the sides. What is the area of the shaded region?`;
      explanation = `Each arc has radius $\\frac{${s}}{2} = ${h}$. Four quarter circles of radius ${h} make one full circle, of area $\\pi(${h})^2 = ${Ex.pi(h * h).tex()}$.

Shaded = square − one full circle $= ${correct.tex()}$.

All four quarter circles must be subtracted.`;
    } else {
      r = rng.int(2, 6);
      const w = rng.int(1, 4);
      s = w;
      const R = r + w;
      correct = Ex.pi(R * R - r * r);
      traps.push(
        { v: Ex.pi(w * w), trap: 'geom-shaded-ring-difference' },
        { v: Ex.pi(R * R), trap: 'geom-shaded-wrong-region' },
        { v: Ex.pi(2 * w), trap: 'geom-shaded-circumference' },
        { v: Ex.of(R * R - r * r), trap: 'geom-shaded-forgot-pi' },
        { v: Ex.pi(R * R + r * r), trap: 'geom-shaded-added-areas' },
        { v: Ex.pi(w), trap: 'geom-shaded-ring-difference' },
      );
      fillers = [];
      fig.polyXY(ringKeyhole(R, r, 5), true);
      fig.pt('O', O).circle('O', R).circle('O', r);
      fig.pt('P', onCircle(O, r, 140)).hide('P').seg('O', 'P', `$${r}$`);
      fig.pt('Q', onCircle(O, R, 0)).hide('Q').seg('O', 'Q');
      stem = `In the figure above, the two circles have the same center $O$. The radius of the smaller circle is ${r}, and the radius of the larger circle is ${w} more than the radius of the smaller circle. What is the area of the shaded region?`;
      explanation = `The larger radius is $${r} + ${w} = ${R}$. The shaded ring is the larger disk minus the smaller one:

$$\\pi(${R})^2 - \\pi(${r})^2 = ${num(R * R)}\\pi - ${num(r * r)}\\pi = ${correct.tex()}$$

Subtract the areas of the two disks, not their radii.`;
    }
    // scaled copies of the answer, then steps along the pi coefficient (or the constant), only if the traps do not suffice
    const step = mode === 'segment-one' ? Ex.of(1) : mode === 'corner-one' ? Ex.pi(new Frac(1, 4)) : Ex.pi(1);
    const { choices, answer, values } = exChoices(rng, correct, traps, fillers, { minGap: 0.03, step });
    // name the mistakes that are actually among the choices (never one that is absent)
    const traps2 = trapNotes(choices, SHADED_NOTES);
    if (traps2) explanation += `\n\n${traps2}`;
    return {
      params: { mode, s, r, values },
      q: { format: 'mcs', stem, figure: fig.build(false), choices, answer, explanation },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'wrong format';
    // Area of the shaded region as drawn, rebuilt with fine arcs.
    return checkChoiceValue(p.values, q.answer, areaOf(shadedPolys(p, 1)), 1e-3);
  },
};

/* ================================================================== 2. Comparisons (QC) */

interface RegionQCParams {
  mode: 'segment90' | 'segment60' | 'vs-unshaded' | 'perimeter' | 'rect-circle';
  config: string;
  r: number;
  L: number;
  k: number;
  shadeInner: boolean;
}

/** Shaded and unshaded polygons of the "shaded vs unshaded" configurations. */
function splitRegions(config: string, r: number, shadeInner: boolean, step: number): { shaded: Poly[]; unshaded: Poly[] } {
  let inner: Poly[];
  let outer: Poly[];
  switch (config) {
    case 'circle-in-square':
      inner = [arcPts(O, r, 0, 360, step)];
      outer = cornerPieces(r, step);
      break;
    case 'square-in-circle':
      inner = [[45, 135, 225, 315].map((t) => onCircle(O, r, t))];
      outer = segmentPieces(r, step);
      break;
    case 'quarter':
      inner = [quarterDisk(r, step)];
      outer = [outsideQuarter(r, step)];
      break;
    case 'semicircle':
      inner = [arcPts(O, r, 0, 180, step)];
      outer = [
        [[r, 0], [r, r], [0, r], ...arcPts(O, r, 90, 0, step)],
        [[-r, r], [-r, 0], ...arcPts(O, r, 180, 90, step)],
      ];
      break;
    default: {
      // ring with R = r * sqrt(2)
      inner = [arcPts(O, r, 0, 360, step)];
      outer = [ringKeyhole(r * Math.SQRT2, r, step)];
    }
  }
  return shadeInner ? { shaded: inner, unshaded: outer } : { shaded: outer, unshaded: inner };
}

const CONFIG_TEXT: Record<string, { info: (r: number) => string; region: string; inner: string; outerName: string; innerArea: (r: number) => Ex; outerArea: (r: number) => Ex }> = {
  'circle-in-square': {
    info: (r) => `A circle of radius ${r} is inscribed in a square.`,
    region: 'square',
    inner: 'circle',
    outerName: 'the four corner regions have',
    innerArea: (r) => Ex.pi(r * r),
    outerArea: (r) => Ex.of(4 * r * r).sub(Ex.pi(r * r)),
  },
  'square-in-circle': {
    info: (r) => `A square is inscribed in a circle of radius ${r}.`,
    region: 'circle',
    inner: 'square',
    outerName: 'the four regions between the square and the circle have',
    innerArea: (r) => Ex.of(2 * r * r),
    outerArea: (r) => Ex.pi(r * r).sub(2 * r * r),
  },
  quarter: {
    info: (r) => `The figure shows a square with sides of length ${r} and a quarter circle of radius ${r} centered at a vertex of the square.`,
    region: 'square',
    inner: 'quarter circle',
    outerName: 'the region outside the quarter circle has',
    innerArea: (r) => Ex.pi(new Frac(r * r, 4)),
    outerArea: (r) => Ex.of(r * r).sub(Ex.pi(new Frac(r * r, 4))),
  },
  semicircle: {
    info: (r) => `The figure shows a rectangle of length ${2 * r} and width ${r} and a semicircle whose diameter is a longer side of the rectangle.`,
    region: 'rectangle',
    inner: 'semicircle',
    outerName: 'the two corner regions have',
    innerArea: (r) => Ex.pi(new Frac(r * r, 2)),
    outerArea: (r) => Ex.of(2 * r * r).sub(Ex.pi(new Frac(r * r, 2))),
  },
  ring: {
    info: (r) => `The two circles have the same center. The smaller circle has radius ${r}, and the larger circle has radius $${r}\\sqrt{2}$.`,
    region: 'larger circle',
    inner: 'smaller circle',
    outerName: 'the ring between the circles has',
    innerArea: (r) => Ex.pi(r * r),
    outerArea: (r) => Ex.pi(r * r),
  },
};

const QC_SAY_REL: Record<QCChoice, string> = { A: 'Quantity A is greater', B: 'Quantity B is greater', C: 'the quantities are equal', D: 'that the relationship cannot be determined' };

/** Drop the trap on the correct QC letter. */
function qcTraps2(answer: QCChoice, t: Partial<Record<QCChoice, string>>): QCQuestion['traps'] {
  const out: Partial<Record<QCChoice, string>> = {};
  for (const [k, v] of Object.entries(t)) if (k !== answer && v) out[k as QCChoice] = v;
  return Object.keys(out).length ? out : undefined;
}

const regionQC: Template<RegionQCParams> = {
  id: 'geo.composite.compare-qc',
  skill: 'geo.composite',
  format: 'qc',
  style: 'shaded area or composite perimeter against a number or another region',
  generate(rng, d) {
    const base: RegionQCParams = { mode: 'segment90', config: '', r: 0, L: 0, k: 0, shadeInner: false };
    const x = rng.next();
    const mode: RegionQCParams['mode'] =
      x < 0.27 ? (d === 3 && rng.chance(0.5) ? 'segment60' : 'segment90') : x < 0.55 ? 'vs-unshaded' : x < 0.75 ? 'perimeter' : 'rect-circle';
    const fig = new Fig();
    if (mode === 'rect-circle') {
      // a circle tangent to the top, bottom and left sides of a rectangle that is longer than it is tall: the length is free
      const r = d === 1 ? rng.int(2, 4) : d === 2 ? rng.int(5, 7) : rng.int(8, 10);
      const least = (4 - Math.PI) * r * r; // the shaded area approaches this as the rectangle shrinks to a square
      const wantD = rng.chance(0.55);
      const k = wantD ? Math.ceil(least) + rng.int(1, 14) : Math.max(1, Math.floor(least) - rng.int(0, 3));
      if (!wantD && k > least - 0.05) throw new Redraw('the number is too close to the least area');
      const answer: QCChoice = wantD ? 'D' : 'A';
      const Ld = 3.4 * r;
      fig.pt('A', [0, 0]).pt('B', [Ld, 0]).pt('C', [Ld, 2 * r]).pt('D', [0, 2 * r]).poly(['A', 'B', 'C', 'D']);
      const C0: P2 = [r, r];
      const at = (a0: number, a1: number) => arcPts(C0, r, a0, a1, 5);
      fig.polyXY([[0, r], [0, 2 * r], [r, 2 * r], ...at(90, 180).slice(1, -1)], true);
      fig.polyXY([[0, r], [0, 0], [r, 0], ...at(270, 180).slice(1, -1)], true);
      fig.polyXY([[r, 0], [Ld, 0], [Ld, 2 * r], [r, 2 * r], ...at(450, 270).slice(1, -1)], true);
      fig.pt('P', C0).hide('P').circle('P', r).seg('P', 'P2', `$${r}$`);
      fig.pt('P2', [r + r * Math.cos(-0.5), r + r * Math.sin(-0.5)]).hide('P2');
      return {
        params: { ...base, mode, r, k },
        q: {
          format: 'qc',
          figure: fig.build(true),
          info: `In rectangle $ABCD$ above, a circle with radius ${r} is tangent to sides $AB$, $CD$ and $AD$. The circle does not touch side $BC$.`,
          quantityA: 'The area of the shaded region',
          quantityB: `$${k}$`,
          answer,
          traps: qcTraps2(answer, wantD ? { A: 'geom-shaded-assumed-length', B: 'geom-shaded-assumed-length' } : { D: 'geom-shaded-assumed-length' }),
          explanation: `The circle touches the top and the bottom, so the rectangle is $${2 * r}$ tall. Its length $L$ is more than $${2 * r}$ (the circle does not reach $BC$), and nothing else fixes it. The shaded area is $${2 * r}L - \\pi(${r})^2 = ${2 * r}L - ${Ex.pi(r * r).tex()}$.

${
            wantD
              ? `Just above $L = ${2 * r}$ the area is about $${(4 * r * r - Math.PI * r * r).toFixed(2)}$, which is less than $${k}$. For a long rectangle, say $L = ${Math.ceil((k + Math.PI * r * r) / (2 * r)) + 2}$, it is greater than $${k}$. Both happen, so the comparison cannot be determined. (D)`
              : `Since $L > ${2 * r}$, the area is greater than $${4 * r * r} - ${Ex.pi(r * r).tex()} \\approx ${least.toFixed(2)}$, and $${k}$ is below that. Quantity A is greater. (A)`
          }

Rule: when a length is not given, test its smallest allowed value and a large one before choosing.`,
        },
      };
    }
    if (mode === 'segment90' || mode === 'segment60') {
      const theta = mode === 'segment90' ? 90 : 60;
      const r = mode === 'segment90' ? (d === 1 ? 2 * rng.int(2, 3) : d === 2 ? 2 * rng.int(4, 5) : 2 * rng.int(3, 6)) : rng.pick([6, 12]);
      const val = mode === 'segment90' ? Ex.pi(new Frac(r * r, 4)).sub(new Frac(r * r, 2)) : Ex.pi(new Frac(r * r, 6)).sub(Ex.sqrt(3, new Frac(r * r, 4)));
      const crude = mode === 'segment90' ? (r * r) / 4 : (r * r) / 2 - (1.7 * r * r) / 4; // pi = 3 (and sqrt 3 = 1.7)
      const v = val.value();
      const lo = Math.floor(v);
      const kOpts: number[] = [];
      if (crude <= lo && lo > 0 && v - lo > 0.05) kOpts.push(lo, lo);
      kOpts.push(lo + 1, lo + 2);
      if (lo - 1 > 0) kOpts.push(lo - 1);
      const k = rng.pick(kOpts.filter((c) => Math.abs(c - v) > 0.05));
      const answer: QCChoice = v > k ? 'A' : 'B';
      const crudeAns: QCChoice = Math.abs(crude - k) < 1e-9 ? 'C' : crude > k ? 'A' : 'B';
      const a0 = rng.pick([0, 90, 180, 270]) + 45 - theta / 2;
      const A = onCircle(O, r, a0);
      const B = onCircle(O, r, a0 + theta);
      fig.polyXY(arcPts(O, r, a0, a0 + theta, 5), true);
      fig.pt('O', O).pt('A', A).pt('B', B).circle('O', r);
      fig.seg('O', 'A', `$${r}$`).seg('O', 'B').seg('A', 'B');
      if (theta === 90) fig.right('A', 'O', 'B');
      else fig.angleLabel('A', 'O', 'B', '$60^\\circ$');
      const tri = mode === 'segment90' ? `\\frac{1}{2}(${r})(${r}) = ${(r * r) / 2}` : `\\frac{\\sqrt{3}}{4}(${r})^2 = ${Ex.sqrt(3, new Frac(r * r, 4)).tex()}`;
      return {
        params: { ...base, mode, r, k },
        q: {
          format: 'qc',
          figure: fig.build(false),
          info: `$O$ is the center of the circle${theta === 60 ? ', and the measure of angle $AOB$ is $60^\\circ$' : ''}.`,
          quantityA: `The area of the shaded region`,
          quantityB: `$${k}$`,
          answer,
          traps: crudeAns !== answer ? { [crudeAns]: 'geom-shaded-pi-as-3' } : undefined,
          explanation: `The shaded region is sector $AOB$ minus triangle $AOB$. The sector is $\\frac{${theta}}{360}$ of the circle: $\\frac{${theta}}{360}\\pi(${r})^2 = ${Ex.pi(new Frac(r * r * theta, 360)).tex()}$. ${theta === 90 ? 'The triangle is a right triangle with legs' : 'The triangle is equilateral with side'} ${r}: $${tri}$.

So the shaded area is $${val.tex()} \\approx ${v.toFixed(2)}$ (using $\\pi \\approx 3.14$${theta === 60 ? ' and $\\sqrt{3} \\approx 1.73$' : ''}), ${answer === 'A' ? 'greater' : 'less'} than ${k}. (${answer})

${
            crudeAns !== answer
              ? `Trap: rounding $\\pi$ to 3${theta === 60 ? ' (and $\\sqrt{3}$ to 1.7)' : ''} gives about ${crude.toFixed(1).replace(/\.0$/, '')}, which suggests ${QC_SAY_REL[crudeAns]}: the wrong comparison. Keep $\\pi \\approx 3.14$ when the area is within a unit of the number.`
              : Math.abs(v - k) < 1
                ? `Check: the area $${v.toFixed(2)}$ is within 1 of ${k}, so keep two decimals for $\\pi$.`
                : `Check: the gap between $${v.toFixed(2)}$ and ${k} is wide enough that a rough $\\pi$ would not change the answer.`
          }`,
        },
      };
    }
    if (mode === 'vs-unshaded') {
      const configs =
        d === 1
          ? ['circle-in-square', 'square-in-circle', 'quarter', 'triangle']
          : d === 2
            ? ['semicircle', 'ring', 'quarter', 'circle-in-square', 'triangle']
            : ['semicircle', 'ring', 'square-in-circle', 'quarter', 'triangle'];
      const config = rng.pick(configs);
      if (config === 'triangle') {
        const L = d === 1 ? rng.int(6, 9) : d === 2 ? rng.int(10, 12) : rng.int(12, 16);
        const H = d === 1 ? rng.int(3, 5) : d === 2 ? rng.int(5, 7) : rng.int(6, 9);
        const px = rng.int(1, L - 1);
        fig.polyXY([[0, 0], [L, 0], [px, H]], true);
        fig.pt('A', [0, 0]).pt('B', [L, 0]).pt('C', [L, H]).pt('D', [0, H]).pt('P', [px, H], [0, 1]);
        fig.poly(['A', 'B', 'C', 'D']).seg('A', 'P').seg('B', 'P');
        return {
          params: { ...base, mode, config, r: H, L, k: px },
          q: {
            format: 'qc',
            figure: fig.build(false),
            info: `$ABCD$ is a rectangle, and $P$ is a point on side $CD$.`,
            quantityA: `The area of the shaded region`,
            quantityB: `The total area of the unshaded regions`,
            answer: 'C',
            traps: { D: 'geom-shaded-apex-position' },
            explanation: `Triangle $ABP$ has base $AB$ and its height is the distance from $P$ to $AB$, which is the width $AD$ of the rectangle wherever $P$ is on $CD$. So its area is $\\frac{1}{2} \\cdot AB \\cdot AD$: half the rectangle.

The unshaded regions make up the other half, so the quantities are equal. (C)

The position of $P$ does not matter, so the answer is not D.`,
          },
        };
      }
      const r =
        config === 'semicircle' || config === 'quarter' ? (d === 1 ? 2 * rng.int(2, 3) : d === 2 ? 2 * rng.int(4, 5) : 2 * rng.int(3, 6)) : d === 1 ? rng.int(2, 4) : d === 2 ? rng.int(5, 7) : rng.int(6, 9);
      const shadeInner = rng.chance(0.5);
      const t = CONFIG_TEXT[config];
      const { shaded: sh } = splitRegions(config, r, shadeInner, 5);
      for (const poly of sh) fig.polyXY(poly, true);
      fig.pt('O', O).hide('O');
      if (config === 'circle-in-square') fig.polyXY([[-r, -r], [r, -r], [r, r], [-r, r]]).circle('O', r);
      else if (config === 'square-in-circle') fig.polyXY([45, 135, 225, 315].map((a) => onCircle(O, r, a))).circle('O', r);
      else if (config === 'quarter') fig.polyXY([[0, 0], [r, 0], [r, r], [0, r]]).path(arcPts(O, r, 0, 90, 5));
      else if (config === 'semicircle') fig.polyXY([[-r, 0], [r, 0], [r, r], [-r, r]]).path(arcPts(O, r, 0, 180, 5));
      else fig.circle('O', r).circle('O', r * Math.SQRT2).segXY(O, [r * Math.SQRT2, 0]);
      const innerA = t.innerArea(r);
      const outerA = t.outerArea(r);
      const [qa, qb] = shadeInner ? [innerA, outerA] : [outerA, innerA];
      const answer = cmpTol(qa.value(), qb.value(), 1e-9);
      const traps: QCQuestion['traps'] = config === 'ring' ? { B: 'geom-shaded-ring-difference' } : undefined;
      return {
        params: { ...base, mode, config, r, shadeInner },
        q: {
          format: 'qc',
          figure: fig.build(false),
          info: t.info(r),
          quantityA: `The area of the shaded region`,
          quantityB: `The area of the unshaded region inside the ${t.region}`,
          answer,
          traps,
          explanation:
            config === 'ring'
              ? `The smaller circle has area $\\pi(${r})^2 = ${Ex.pi(r * r).tex()}$. The larger has area $\\pi(${r}\\sqrt{2})^2 = ${Ex.pi(2 * r * r).tex()}$, so the ring between them has area $${Ex.pi(2 * r * r).tex()} - ${Ex.pi(r * r).tex()} = ${Ex.pi(r * r).tex()}$.

The two regions have the same area. (C)

The ring looks thin because $${r}\\sqrt{2} - ${r}$ is small, but areas grow with the square of the radius: $\\pi(${r}\\sqrt{2} - ${r})^2$ is not the ring's area.`
              : `The ${t.inner} has area $${innerA.tex()}$; ${t.outerName} area $${outerA.tex()}$ in all.

Shaded: $${approx(qa)}$. Unshaded: $${approx(qb)}$. ${relText(answer)[0].toUpperCase() + relText(answer).slice(1)}. (${answer})`,
        },
      };
    }
    // perimeter of a rectangle with a semicircle on one end
    const w = d === 1 ? 2 * rng.int(2, 3) : d === 2 ? 2 * rng.int(4, 5) : 2 * rng.int(3, 6);
    const L = rng.int(w, d === 1 ? 12 : 18);
    const P = Ex.of(2 * L + w).add(Ex.pi(w / 2));
    const withDiam = P.add(w);
    const pv = P.value();
    const crude = 2 * L + w + 1.5 * w; // pi = 3
    const opts: [number, string | undefined][] = [
      [Math.ceil(pv + 0.2), undefined],
      [Math.floor(withDiam.value() - 0.2), 'geom-shaded-inner-edge'],
      [Math.floor(pv - 0.2), undefined],
      [Math.floor(pv - 0.2), undefined],
    ];
    if (Number.isInteger(crude) && crude < pv - 0.05) opts.push([crude, 'geom-shaded-pi-as-3']);
    const [k, trapId] = rng.pick(opts.filter(([v]) => Math.abs(v - pv) > 0.1));
    const answer: QCChoice = pv > k ? 'A' : 'B';
    let traps: QCQuestion['traps'];
    if (trapId === 'geom-shaded-inner-edge') traps = { A: trapId };
    else if (trapId === 'geom-shaded-pi-as-3') traps = { C: trapId };
    const h = w / 2;
    fig.pt('A', [0, 0]).pt('B', [L, 0]).pt('C', [L, w]).pt('D', [0, w]);
    fig.polyMixed(['A', 'B', ...arcPts([L, h], h, 270, 450, 5).slice(1, -1), 'C', 'D']);
    fig.seg('A', 'B', `$${L}$`).seg('B', 'C', undefined, true).seg('D', 'A', `$${w}$`);
    return {
      params: { ...base, mode: 'perimeter', r: w, L, k },
      q: {
        format: 'qc',
        figure: fig.build(false),
        info: `The figure is made of rectangle $ABCD$ and a semicircle with diameter $BC$.`,
        quantityA: `The perimeter of the figure`,
        quantityB: `$${k}$`,
        answer,
        traps,
        explanation: `The perimeter is the outer boundary: $AB$, $AD$, $DC$ and the semicircular arc. The dashed side $BC$ is inside the figure and does not count.

The arc is half the circumference of a circle of diameter ${w}: $\\frac{1}{2}\\pi(${w}) = ${Ex.pi(h).tex()}$. Perimeter $= ${L} + ${w} + ${L} + ${Ex.pi(h).tex()} = ${P.tex()} \\approx ${pv.toFixed(2)}$.

${relText(answer)[0].toUpperCase() + relText(answer).slice(1)}. (${answer}) Adding $BC$ would give $${withDiam.tex()}$.`,
      },
    };
  },
  check(q, p, rng) {
    if (q.format !== 'qc') return 'wrong format';
    let expected: QCChoice;
    if (p.mode === 'rect-circle') {
      // rectangle of length L > 2r minus the circle, measured with a fine polygon, for short and long rectangles
      const disk = shoelace(arcPts(O, p.r, 0, 360, 0.5));
      const samples: [number, number][] = [0.001, 0.5, 1, 3, 20, 400].map((e) => [2 * p.r * (2 * p.r + e) - disk, p.k]);
      expected = qcFromSamples(samples);
    } else if (p.mode === 'segment90' || p.mode === 'segment60') {
      const theta = p.mode === 'segment90' ? 90 : 60;
      expected = cmpTol(shoelace(arcPts(O, p.r, 10, 10 + theta, 0.5)), p.k);
    } else if (p.mode === 'vs-unshaded') {
      if (p.config === 'triangle') {
        const samples: [number, number][] = [];
        for (let i = 0; i < 25; i++) {
          const px = i === 0 ? p.k : rng.next() * p.L;
          const tri = shoelace([[0, 0], [p.L, 0], [px, p.r]]);
          samples.push([tri, p.L * p.r - tri]);
        }
        expected = qcFromSamples(samples.map(([a, b]) => [Math.round(a * 1e9), Math.round(b * 1e9)]));
      } else {
        const { shaded, unshaded } = splitRegions(p.config, p.r, p.shadeInner, 0.5);
        expected = cmpTol(areaOf(shaded), areaOf(unshaded));
      }
    } else {
      const h = p.r / 2;
      // outer boundary: A -> B, arc, C -> D, D -> A
      const boundary: P2[] = [[0, p.r], [0, 0], [p.L, 0], ...arcPts([p.L, h], h, 270, 450, 0.5), [0, p.r]];
      expected = cmpTol(pathLength(boundary), p.k);
    }
    return q.answer === expected ? null : `expected ${expected} (${QC_TEXT[expected]})`;
  },
};

/* ================================================================== 3. Inscribed and circumscribed figures (MCM) */

type Quantity = 'side' | 'diagonal' | 'squareArea' | 'perimeter' | 'circleArea' | 'circumference' | 'radius' | 'rectArea' | 'outside';
interface Statement {
  q: Quantity;
  claim: ExData;
}
interface InscribedParams {
  config: 'square-in-circle' | 'circle-in-square' | 'rect-in-circle' | 'hexagon-in-circle';
  a: number;
  b: number;
  statements: Statement[];
}

/** Coordinates of the polygon and the circle of each configuration. */
function inscribedShape(config: InscribedParams['config'], a: number, b: number): { poly: Poly; R: number } {
  switch (config) {
    case 'square-in-circle':
      return { poly: [45, 135, 225, 315].map((t) => onCircle(O, a, t)), R: a };
    case 'circle-in-square':
      return { poly: [[-a / 2, -a / 2], [a / 2, -a / 2], [a / 2, a / 2], [-a / 2, a / 2]], R: a / 2 };
    case 'rect-in-circle':
      return { poly: [[-a / 2, -b / 2], [a / 2, -b / 2], [a / 2, b / 2], [-a / 2, b / 2]], R: Math.hypot(a, b) / 2 };
    default:
      return { poly: [0, 60, 120, 180, 240, 300].map((t) => onCircle(O, a, t)), R: a };
  }
}

function measureQuantity(q: Quantity, poly: Poly, R: number): number {
  const u = unitCircle();
  switch (q) {
    case 'side':
      return dist(poly[0], poly[1]);
    case 'diagonal':
      return dist(poly[0], poly[2]);
    case 'squareArea':
    case 'rectArea':
      return shoelace(poly);
    case 'perimeter':
      return pathLength(poly, true);
    case 'circleArea':
      return R * R * u.area;
    case 'circumference':
      return R * u.perim;
    case 'radius':
      return R;
    case 'outside':
      // the region between the two figures: |circle - polygon|
      return Math.abs(R * R * u.area - shoelace(poly));
  }
}

const inscribed: Template<InscribedParams> = {
  id: 'geo.composite.inscribed',
  skill: 'geo.composite',
  format: 'mcm',
  style: 'which statements hold for a figure inscribed in a circle',
  generate(rng, d) {
    const config = rng.pick(
      d === 1
        ? (['square-in-circle', 'circle-in-square'] as const)
        : d === 2
          ? (['square-in-circle', 'circle-in-square', 'rect-in-circle'] as const)
          : (['square-in-circle', 'rect-in-circle', 'hexagon-in-circle'] as const),
    );
    let a = 0;
    let b = 0;
    let given: string;
    let explanationIntro: string;
    const pool: { q: Quantity; ok: Ex; bad: { v: Ex; trap?: string }[]; text: string }[] = [];
    const fig = new Fig();
    if (config === 'square-in-circle') {
      a = rng.int(2, 9); // radius
      const r = a;
      given = `Square $ABCD$ is inscribed in a circle with center $O$ and radius ${r}.`;
      explanationIntro = `The diagonal of the inscribed square is a diameter: $${2 * r}$. So the side is $\\frac{${2 * r}}{\\sqrt{2}} = ${Ex.sqrt(2, r).tex()}$ and the area is $(${Ex.sqrt(2, r).tex()})^2 = ${2 * r * r}$.`;
      pool.push(
        { q: 'side', ok: Ex.sqrt(2, r), bad: [{ v: Ex.of(2 * r), trap: 'geom-shaded-side-diameter' }, { v: Ex.of(r), trap: 'geom-shaded-radius-as-side' }], text: 'The length of a side of the square is' },
        { q: 'squareArea', ok: Ex.of(2 * r * r), bad: [{ v: Ex.of(4 * r * r), trap: 'geom-shaded-side-diameter' }, { v: Ex.of(r * r), trap: 'geom-shaded-radius-as-side' }], text: 'The area of the square is' },
        { q: 'diagonal', ok: Ex.of(2 * r), bad: [{ v: Ex.sqrt(2, 2 * r), trap: 'geom-shaded-side-diameter' }], text: 'The length of diagonal $AC$ is' },
        { q: 'perimeter', ok: Ex.sqrt(2, 4 * r), bad: [{ v: Ex.of(8 * r), trap: 'geom-shaded-side-diameter' }], text: 'The perimeter of the square is' },
        { q: 'circleArea', ok: Ex.pi(r * r), bad: [{ v: Ex.pi(2 * r), trap: 'geom-circle-arc-sector-mixed' }, { v: Ex.pi(4 * r * r), trap: 'geom-circle-radius-diameter' }], text: 'The area of the circle is' },
        { q: 'outside', ok: Ex.pi(r * r).sub(2 * r * r), bad: [{ v: Ex.pi(r * r).sub(r * r), trap: 'geom-shaded-radius-as-side' }], text: 'The area of the region inside the circle and outside the square is' },
      );
      const verts = [225, 315, 45, 135].map((t) => onCircle(O, r, t));
      ['A', 'B', 'C', 'D'].forEach((n, i) => fig.pt(n, verts[i]));
      fig.pt('O', O).poly(['A', 'B', 'C', 'D']).circle('O', r).seg('O', 'B', `$${r}$`);
    } else if (config === 'circle-in-square') {
      a = 2 * rng.int(2, 7); // side
      const s = a;
      const r = s / 2;
      given = `A circle with center $O$ is inscribed in square $ABCD$, and each side of the square has length ${s}.`;
      explanationIntro = `The circle touches all four sides, so its diameter equals the side: the radius is $\\frac{${s}}{2} = ${r}$.`;
      pool.push(
        { q: 'radius', ok: Ex.of(r), bad: [{ v: Ex.sqrt(2, r), trap: 'geom-shaded-diagonal-diameter' }, { v: Ex.of(s), trap: 'geom-circle-radius-diameter' }], text: 'The radius of the circle is' },
        { q: 'circleArea', ok: Ex.pi(r * r), bad: [{ v: Ex.pi(s * s), trap: 'geom-circle-radius-diameter' }, { v: Ex.pi(2 * r * r), trap: 'geom-shaded-diagonal-diameter' }], text: 'The area of the circle is' },
        { q: 'circumference', ok: Ex.pi(s), bad: [{ v: Ex.pi(2 * s), trap: 'geom-circle-radius-diameter' }, { v: Ex.pi(r * r), trap: 'geom-solid-base-area' }], text: 'The circumference of the circle is' },
        { q: 'outside', ok: Ex.of(s * s).sub(Ex.pi(r * r)), bad: [{ v: Ex.of(s * s).sub(Ex.pi(s)), trap: 'geom-shaded-circumference' }], text: 'The area of the region inside the square and outside the circle is' },
        { q: 'diagonal', ok: Ex.sqrt(2, s), bad: [{ v: Ex.of(s), trap: 'geom-shaded-diagonal-diameter' }], text: 'The length of diagonal $AC$ is' },
      );
      ['A', 'B', 'C', 'D'].forEach((n, i) => fig.pt(n, [[-r, -r], [r, -r], [r, r], [-r, r]][i] as P2));
      fig.pt('O', O).poly(['A', 'B', 'C', 'D']).circle('O', r).seg('A', 'B', `$${s}$`);
    } else if (config === 'rect-in-circle') {
      [a, b] = rng.pick([
        [6, 8],
        [8, 6],
        [5, 12],
        [12, 5],
        [8, 15],
        [12, 16],
        [9, 12],
        [10, 24],
      ] as [number, number][]);
      const dgl = Math.hypot(a, b);
      const R = new Frac(dgl, 2);
      given = `Rectangle $ABCD$, with $AB = ${a}$ and $BC = ${b}$, is inscribed in a circle with center $O$.`;
      explanationIntro = `The diagonal of an inscribed rectangle is a diameter: $AC = \\sqrt{${a}^2 + ${b}^2} = ${dgl}$, so the radius is $${R.toTex()}$.`;
      const R2 = R.mul(R);
      pool.push(
        { q: 'radius', ok: Ex.of(R), bad: [{ v: Ex.of(dgl), trap: 'geom-circle-radius-diameter' }, { v: Ex.of(new Frac(a + b, 2)), trap: 'geom-shaded-radius-wrong' }], text: 'The radius of the circle is' },
        { q: 'circleArea', ok: Ex.pi(R2), bad: [{ v: Ex.pi(dgl * dgl), trap: 'geom-circle-radius-diameter' }, { v: Ex.pi(dgl), trap: 'geom-circle-arc-sector-mixed' }], text: 'The area of the circle is' },
        { q: 'circumference', ok: Ex.pi(dgl), bad: [{ v: Ex.pi(2 * dgl), trap: 'geom-circle-radius-diameter' }], text: 'The circumference of the circle is' },
        { q: 'outside', ok: Ex.pi(R2).sub(a * b), bad: [{ v: Ex.pi(R2).sub(2 * (a + b)), trap: 'geom-shaded-circumference' }], text: 'The area of the region inside the circle and outside the rectangle is' },
        { q: 'rectArea', ok: Ex.of(a * b), bad: [{ v: Ex.of(2 * (a + b)), trap: 'geom-rect-area-for-perimeter' }], text: 'The area of the rectangle is' },
      );
      const half: P2 = [a / 2, b / 2];
      ['A', 'B', 'C', 'D'].forEach((n, i) => fig.pt(n, [[-half[0], -half[1]], [half[0], -half[1]], half, [-half[0], half[1]]][i] as P2));
      fig.pt('O', O, [-b, a]).poly(['A', 'B', 'C', 'D']).circle('O', dgl / 2).seg('A', 'B', `$${a}$`).seg('B', 'C', `$${b}$`).seg('A', 'C', undefined, true);
    } else {
      a = rng.int(2, 9);
      const r = a;
      given = `Regular hexagon $ABCDEF$ is inscribed in a circle with center $O$ and radius ${r}.`;
      explanationIntro = `The radii to the six vertices cut the hexagon into six equilateral triangles with side ${r}, so each side of the hexagon is ${r}.`;
      pool.push(
        { q: 'side', ok: Ex.of(r), bad: [{ v: Ex.of(2 * r), trap: 'geom-circle-radius-diameter' }, { v: Ex.sqrt(3, r), trap: 'geom-shaded-apothem-as-side' }], text: 'The length of a side of the hexagon is' },
        { q: 'perimeter', ok: Ex.of(6 * r), bad: [{ v: Ex.of(12 * r), trap: 'geom-circle-radius-diameter' }, { v: Ex.pi(2 * r), trap: 'geom-shaded-circumference' }], text: 'The perimeter of the hexagon is' },
        { q: 'squareArea', ok: Ex.sqrt(3, new Frac(3 * r * r, 2)), bad: [{ v: Ex.sqrt(3, new Frac(3 * r * r, 4)), trap: 'geom-shaded-one-piece' }, { v: Ex.of(6 * r * r), trap: 'geom-shaded-one-piece' }], text: 'The area of the hexagon is' },
        { q: 'diagonal', ok: Ex.sqrt(3, r), bad: [{ v: Ex.of(2 * r), trap: 'geom-shaded-wrong-diagonal' }], text: 'The length of diagonal $AC$ is' },
        { q: 'circumference', ok: Ex.pi(2 * r), bad: [{ v: Ex.pi(r), trap: 'geom-circle-radius-diameter' }], text: 'The circumference of the circle is' },
      );
      const verts = [240, 300, 0, 60, 120, 180].map((t) => onCircle(O, r, t));
      const names = ['A', 'B', 'C', 'D', 'E', 'F'];
      names.forEach((n, i) => fig.pt(n, verts[i]));
      fig.pt('O', O).poly(names).circle('O', r).seg('O', 'C', `$${r}$`);
      explanationIntro += ` (Diagonal $AC$ spans two sides with a $120^\\circ$ angle between them: it is $${r}\\sqrt{3}$.)`;
    }
    // choose 5 or 6 statements, between 1 and 4 true, one per quantity
    const n = d === 1 ? 5 : 6;
    const picked = rng.sample(pool, Math.min(n, pool.length));
    let nTrue = rng.int(1, Math.min(4, picked.length - 1));
    const items: { text: string; correct: boolean; trap?: string; q: Quantity; v: Ex; ok: Ex; label: string }[] = [];
    picked.forEach((it, i) => {
      const truth = i < nTrue;
      const bads = it.bad.filter((b) => Math.abs(b.v.value() - it.ok.value()) > 1e-6);
      if (truth || !bads.length) items.push({ text: `${it.text} $${it.ok.tex()}$.`, correct: true, q: it.q, v: it.ok, ok: it.ok, label: it.text });
      else {
        const bad = rng.pick(bads);
        items.push({ text: `${it.text} $${bad.v.tex()}$.`, correct: false, q: it.q, v: bad.v, ok: it.ok, label: it.text, ...(bad.trap ? { trap: bad.trap } : {}) });
      }
    });
    const shuffled = rng.shuffle(items);
    nTrue = shuffled.filter((x) => x.correct).length;
    const { choices, answer } = flaggedChoices(shuffled.map(({ text, correct, trap }) => ({ text, correct, ...(trap ? { trap } : {}) })));
    const lines = shuffled.map((x) => `- ${x.correct ? `True: ${x.text}` : `False: ${x.label.replace(/^The/, 'the')} $${x.ok.tex()}$, not $${x.v.tex()}$.`}`).join('\n');
    return {
      params: { config, a, b, statements: shuffled.map((x) => ({ q: x.q, claim: x.v.data() })) },
      q: {
        format: 'mcm',
        stem: `${given} Which of the following statements must be true?`,
        instruction: 'Indicate all such statements.',
        figure: fig.build(false),
        choices,
        answer,
        explanation: `${explanationIntro}

${lines}`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcm') return 'wrong format';
    const { poly, R } = inscribedShape(p.config, p.a, p.b);
    const expected = p.statements.flatMap((st, i) => {
      const actual = measureQuantity(st.q, poly, R);
      const claim = Ex.from(st.claim).value();
      return Math.abs(actual - claim) < 1e-5 * Math.max(1, actual) ? [i] : [];
    });
    return JSON.stringify(expected) === JSON.stringify(q.answer) ? null : `expected ${expected}`;
  },
};

/* ================================================================== 4. Combined regions (NE) */

interface CombinedParams {
  mode: 'L' | 'U' | 'frame' | 'window' | 'track';
  ask: 'area' | 'perimeter';
  W: number;
  H: number;
  w: number;
  h: number;
}

/** Outline of the region (counterclockwise), arcs approximated with the given step. */
function combinedOutline(p: CombinedParams, step: number): { outline: Poly; hole?: Poly } {
  const { W, H, w, h } = p;
  switch (p.mode) {
    case 'L':
      return { outline: [[0, 0], [W, 0], [W, H - h], [W - w, H - h], [W - w, H], [0, H]] };
    case 'U': {
      const x0 = (W - w) / 2;
      return { outline: [[0, 0], [W, 0], [W, H], [x0 + w, H], [x0 + w, H - h], [x0, H - h], [x0, H], [0, H]] };
    }
    case 'frame':
      return {
        outline: [[-w, -w], [W + w, -w], [W + w, H + w], [-w, H + w]],
        hole: [[0, 0], [W, 0], [W, H], [0, H]],
      };
    case 'window':
      return { outline: [[0, 0], [W, 0], ...arcPts([W / 2, H], W / 2, 0, 180, step)] };
    default:
      return { outline: [...arcPts([0, H / 2], H / 2, 90, 270, step), ...arcPts([W, H / 2], H / 2, 270, 450, step)] };
  }
}

const combined: Template<CombinedParams> = {
  id: 'geo.composite.combined',
  skill: 'geo.composite',
  format: 'ne',
  style: 'area or perimeter of a figure made of simple pieces',
  generate(rng, d) {
    const mode = rng.pick(d === 1 ? (['L', 'L', 'frame'] as const) : d === 2 ? (['U', 'frame', 'L'] as const) : (['window', 'track', 'U'] as const));
    const fig = new Fig();
    let W = 0;
    let H = 0;
    let w = 0;
    let h = 0;
    let ask: 'area' | 'perimeter' = rng.chance(0.5) ? 'area' : 'perimeter';
    let answer: Frac;
    const traps: { value: Frac; trap: string }[] = [];
    let stem: string;
    let explanation: string;
    let suffix: string | undefined;
    if (mode === 'L') {
      W = rng.int(8, 16);
      H = rng.int(6, 14);
      w = rng.int(2, W - 3);
      h = rng.int(2, H - 3);
      const pts: P2[] = [[0, 0], [W, 0], [W, H - h], [W - w, H - h], [W - w, H], [0, H]];
      const nm = ['A', 'B', 'C', 'D', 'E', 'F'];
      nm.forEach((n, i) => fig.pt(n, pts[i]));
      fig.poly(nm).hide(...nm);
      fig.seg('A', 'B', `$${W}$`).seg('B', 'C', `$${H - h}$`).seg('E', 'F', `$${W - w}$`).seg('F', 'A', `$${H}$`);
      if (ask === 'perimeter') {
        answer = new Frac(2 * (W + H));
        traps.push({ value: new Frac(W + H + (W - w) + (H - h)), trap: 'geom-shaded-missing-sides' });
        stem = `In the figure above, all the angles are right angles. What is the perimeter of the figure?`;
        explanation = `The two unlabeled sides are $${W} - ${W - w} = ${w}$ (horizontal) and $${H} - ${H - h} = ${h}$ (vertical).

Perimeter $= ${W} + ${H - h} + ${w} + ${h} + ${W - w} + ${H} = ${2 * (W + H)}$.

Shortcut: the horizontal pieces at the top add up to the bottom (${W}) and the vertical pieces on the right add up to the left side (${H}), so the perimeter is $2(${W} + ${H})$. Adding only the four labeled sides misses two sides.`;
      } else {
        answer = new Frac(W * H - w * h);
        traps.push({ value: new Frac(W * H), trap: 'geom-shaded-forgot-cutout' }, { value: new Frac((W - w) * (H - h)), trap: 'geom-shaded-missing-sides' });
        stem = `In the figure above, all the angles are right angles. What is the area of the figure?`;
        explanation = `Complete the ${W}-by-${H} rectangle: its area is $${W * H}$. The missing corner is $${W} - ${W - w} = ${w}$ wide and $${H} - ${H - h} = ${h}$ tall, area $${w * h}$.

Area $= ${W * H} - ${w * h} = ${W * H - w * h}$.

(Or split it into two rectangles: $${W - w} \\cdot ${H} + ${w} \\cdot ${H - h} = ${W * H - w * h}$.)`;
      }
    } else if (mode === 'U') {
      W = 2 * rng.int(5, 9);
      H = rng.int(6, 12);
      w = 2 * rng.int(1, Math.floor(W / 2) - 2);
      h = rng.int(2, H - 2);
      const x0 = (W - w) / 2;
      const pts: P2[] = [[0, 0], [W, 0], [W, H], [x0 + w, H], [x0 + w, H - h], [x0, H - h], [x0, H], [0, H]];
      const nm = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'K'];
      nm.forEach((n, i) => fig.pt(n, pts[i]));
      fig.poly(nm).hide(...nm);
      fig.seg('A', 'B', `$${W}$`).seg('K', 'A', `$${H}$`).seg('E', 'F', `$${w}$`).seg('D', 'E', `$${h}$`);
      if (ask === 'perimeter') {
        answer = new Frac(2 * (W + H) + 2 * h);
        traps.push({ value: new Frac(2 * (W + H)), trap: 'geom-shaded-perimeter-bounding' });
        stem = `In the figure above, a rectangular notch has been cut from the middle of the top of a rectangle, and all the angles are right angles. What is the perimeter of the figure?`;
        explanation = `The top pieces (two shoulders and the bottom of the notch) still add up to the full width ${W}, so the horizontal sides total $2 \\cdot ${W}$. The vertical sides are the two outer sides ($2 \\cdot ${H}$) plus the two sides of the notch ($2 \\cdot ${h}$).

Perimeter $= 2(${W}) + 2(${H}) + 2(${h}) = ${2 * (W + H) + 2 * h}$.

Unlike a corner cut, a notch in the middle of a side adds its two walls to the perimeter.`;
      } else {
        answer = new Frac(W * H - w * h);
        traps.push({ value: new Frac(W * H), trap: 'geom-shaded-forgot-cutout' });
        stem = `In the figure above, a rectangular notch has been cut from the middle of the top of a rectangle, and all the angles are right angles. What is the area of the figure?`;
        explanation = `Area of the full rectangle: $${W} \\cdot ${H} = ${W * H}$. The notch is ${w} wide and ${h} deep: area $${w * h}$.

Area $= ${W * H} - ${w * h} = ${W * H - w * h}$.`;
      }
    } else if (mode === 'frame') {
      W = rng.int(5, 12);
      H = rng.int(3, W - 1);
      w = rng.pick([1, 2, 3]);
      ask = 'area';
      const area = (W + 2 * w) * (H + 2 * w) - W * H;
      answer = new Frac(area);
      traps.push(
        { value: new Frac((W + w) * (H + w) - W * H), trap: 'geom-shaded-border-once' },
        { value: new Frac((W + 2 * w) * (H + 2 * w)), trap: 'geom-shaded-forgot-cutout' },
      );
      const o = w;
      // mitred frame: four trapezoids
      const outer: P2[] = [[-o, -o], [W + o, -o], [W + o, H + o], [-o, H + o]];
      const inner: P2[] = [[0, 0], [W, 0], [W, H], [0, H]];
      for (let i = 0; i < 4; i++) fig.polyXY([outer[i], outer[(i + 1) % 4], inner[(i + 1) % 4], inner[i]], true);
      fig.pt('A', inner[0]).pt('B', inner[1]).pt('C', inner[2]).pt('D', inner[3]).hide('A', 'B', 'C', 'D');
      fig.seg('A', 'B', `$${W}$`).seg('B', 'C', `$${H}$`);
      const unit = rng.pick(['inches', 'centimeters']);
      stem = `A rectangular picture ${W} ${unit} long and ${H} ${unit} wide is surrounded by a frame of uniform width ${(unit === 'inches' ? plural(w, 'inch', 'inches') : plural(w, 'centimeter'))}, shown shaded in the figure above. What is the area of the frame, in square ${unit}?`;
      suffix = `square ${unit}`;
      explanation = `With the frame, each dimension grows by ${w} on BOTH sides: the outer rectangle is $(${W} + ${2 * w})$ by $(${H} + ${2 * w})$, that is, ${W + 2 * w} by ${H + 2 * w}, with area $${(W + 2 * w) * (H + 2 * w)}$.

Frame = outer − picture $= ${(W + 2 * w) * (H + 2 * w)} - ${W * H} = ${area}$.

Adding the width only once per dimension (${W + w} by ${H + w}) is the classic slip.`;
    } else {
      // window (rectangle + semicircle on top) or running track (rectangle + two semicircles): round
      const track = mode === 'track';
      let val: number;
      let withEdge: number;
      for (;;) {
        W = track ? 10 * rng.int(4, 10) : 2 * rng.int(2, 6);
        H = track ? 2 * rng.int(Math.ceil(W / 6), Math.floor(W / 3)) : rng.int(3, 10);
        const rr = track ? H / 2 : W / 2;
        if (ask === 'perimeter') {
          val = track ? 2 * W + Math.PI * H : W + 2 * H + Math.PI * rr;
          withEdge = val + (track ? 2 * H : W);
        } else {
          val = track ? W * H + Math.PI * rr * rr : W * H + (Math.PI * rr * rr) / 2;
          withEdge = track ? W * H + 2 * Math.PI * rr * rr : W * H + Math.PI * rr * rr;
        }
        const f = val - Math.floor(val);
        if (Math.abs(f - 0.5) > 0.1) break;
      }
      const rr = track ? H / 2 : W / 2;
      answer = new Frac(Math.round(val));
      const rw = Math.round(withEdge);
      if (rw !== answer.n) traps.push({ value: new Frac(rw), trap: ask === 'perimeter' ? 'geom-shaded-inner-edge' : 'geom-shaded-semicircle-full' });
      const noPi = track ? (ask === 'perimeter' ? 2 * W + 3 * H : W * H + 3 * rr * rr) : ask === 'perimeter' ? W + 2 * H + 3 * rr : W * H + 1.5 * rr * rr;
      if (Number.isInteger(noPi) && noPi !== answer.n && noPi !== rw) traps.push({ value: new Frac(noPi), trap: 'geom-shaded-pi-as-3' });
      if (track) {
        fig.polyXY(combinedOutline({ mode, ask, W, H, w, h }, 5).outline);
        fig.pt('A', [0, 0]).pt('B', [W, 0]).pt('C', [W, H]).pt('D', [0, H]).hide('A', 'B', 'C', 'D');
        fig.seg('A', 'B', `$${W}$`).seg('B', 'C', `$${H}$`, true).seg('D', 'C').seg('A', 'D', undefined, true);
        stem = `The figure above shows the shape of a running track: a rectangle ${W} meters long and ${H} meters wide with a semicircle on each of its two shorter sides. To the nearest meter, what is the ${ask === 'perimeter' ? 'perimeter of the track (the distance around its outer edge)' : 'area enclosed by the track, in square meters'}?`;
        suffix = ask === 'perimeter' ? 'meters' : 'square meters';
        explanation =
          ask === 'perimeter'
            ? `The two semicircles together form one circle of diameter ${H}: their length is $${H}\\pi$. The straight parts are the two long sides, $2 \\cdot ${W} = ${2 * W}$. The short (dashed) sides are inside the track and do not count.

Perimeter $= ${2 * W} + ${H}\\pi \\approx ${val.toFixed(2)}$, which rounds to ${answer.n}.`
            : `The two semicircles form one circle of radius ${rr}: area $${num(rr * rr)}\\pi$. The rectangle has area $${W} \\cdot ${H} = ${num(W * H)}$.

Area $= ${num(W * H)} + ${num(rr * rr)}\\pi \\approx ${val.toFixed(2)}$, which rounds to ${plain(answer.n)}.`;
      } else {
        fig.polyXY(combinedOutline({ mode, ask, W, H, w, h }, 5).outline);
        fig.pt('A', [0, 0]).pt('B', [W, 0]).pt('C', [W, H]).pt('D', [0, H]).hide('A', 'B', 'C', 'D');
        fig.seg('A', 'B', `$${W}$`).seg('B', 'C', `$${H}$`).seg('D', 'C', undefined, true);
        stem = `The figure above shows the shape of a window: a rectangle ${W} feet wide and ${H} feet tall with a semicircle on top whose diameter is the top side of the rectangle. To the nearest whole number, what is the ${ask === 'perimeter' ? 'perimeter of the window, in feet' : 'area of the window, in square feet'}?`;
        suffix = ask === 'perimeter' ? 'feet' : 'square feet';
        explanation =
          ask === 'perimeter'
            ? `The boundary is the bottom (${W}), the two sides ($2 \\cdot ${H}$) and the semicircular arc, which is half of a circumference of diameter ${W}: $\\frac{1}{2}\\pi(${W}) = ${Ex.pi(rr).tex()}$. The dashed top of the rectangle is inside the window.

Perimeter $= ${W} + ${2 * H} + ${Ex.pi(rr).tex()} \\approx ${val.toFixed(2)}$, which rounds to ${answer.n}.`
            : `Rectangle: $${W} \\cdot ${H} = ${W * H}$. Semicircle of radius ${rr}: $\\frac{1}{2}\\pi(${rr})^2 = ${Ex.pi(new Frac(rr * rr, 2)).tex()}$.

Area $= ${W * H} + ${Ex.pi(new Frac(rr * rr, 2)).tex()} \\approx ${val.toFixed(2)}$, which rounds to ${answer.n}. Only HALF a circle sits on top.`;
      }
    }
    return {
      params: { mode, ask, W, H, w, h },
      q: {
        format: 'ne',
        stem,
        figure: fig.build(false),
        answer,
        ...(suffix ? { suffix } : {}),
        traps: ((): typeof traps => {
          if (traps.some((t) => t.value.eq(answer))) throw new Redraw('a trap equals the answer');
          return traps;
        })(),
        explanation,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'ne') return 'wrong format';
    const { outline, hole } = combinedOutline(p, 0.5);
    let v: number;
    if (p.ask === 'area') v = shoelace(outline) - (hole ? shoelace(hole) : 0);
    else v = pathLength(outline, true);
    if (p.mode === 'window' || p.mode === 'track') v = Math.round(v);
    return Math.abs(q.answer.toNumber() - v) < 1e-6 * Math.max(1, v) ? null : `expected ${v}`;
  },
};

export const compositeTemplates = retryAll([shaded, regionQC, inscribed, combined]);
