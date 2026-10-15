import type { Template, Trap } from '../../../engine/types';
import { num } from '../../../engine/tex';
import { trapNotes } from '../notes';
import { Redraw, retryAll } from '../redraw';
import { FigBuilder, add, angleAt, dir, mul, unit, type Pt } from './fig';
import { angleLabel, checkMcs, intChoices } from './util';

/* An angle bisector on a straight line: A, O, D are collinear, OB is a ray, OC bisects angle AOB (MCS). */

export const bisectorTraps: Record<string, Trap> = {
  'geo-bis-half-only': {
    label: 'Answered with the half-angle (the bisected piece) instead of the angle asked',
    fix: 'A bisector gives two equal pieces, but the question may ask for a different angle. Name the angle asked, then see which known angles and which straight line it shares.',
  },
  'geo-bis-unhalved': {
    label: 'Used the whole angle where only half of it belongs',
    fix: 'The angle asked contains only HALF of the bisected angle. Halve first, then add or subtract from $180^\\circ$.',
  },
  'geo-bis-whole': {
    label: 'Gave the bisected angle itself',
    fix: 'A bisector splits that angle into two equal parts; the angle asked is built from one part, not from the whole angle.',
  },
  'geo-bis-other-side': {
    label: 'Gave the angle on the other side of the bisector',
    fix: 'Read the question for the exact angle: the angle on the other side of the bisector is a different angle, and adding the two halves back gives the whole angle.',
  },
  'geo-bis-forgot-double': {
    label: 'Forgot that the bisected angle is twice the labeled piece',
    fix: 'The label on one half stands for half of the bisected angle. Write the straight angle as (twice the labeled piece) + (the other angle) $= 180^\\circ$.',
  },
  'geo-bis-x-asked': {
    label: 'Gave $x$ when the angle was asked',
    fix: 'Solve for $x$, then substitute it into the expression for the angle named in the question.',
  },
};

interface Names {
  A: string;
  O: string;
  D: string;
  B: string;
  C: string;
}
const NAMES: Names[] = [
  { A: 'A', O: 'O', D: 'D', B: 'B', C: 'C' },
  { A: 'P', O: 'Q', D: 'S', B: 'R', C: 'T' },
  { A: 'K', O: 'L', D: 'N', B: 'M', C: 'J' },
  { A: 'X', O: 'Y', D: 'W', B: 'Z', C: 'V' },
];

interface P {
  kind: 'whole' | 'far' | 'algebra';
  t: number; // theta (whole), beta (far) or x (algebra)
  p?: number;
  c?: number;
  values: number[];
}

const deg = (v: { n: number }) => `$${num(v.n)}^\\circ$`;

/** Rays from O drawn at the true directions: A at 180, OB at `bDeg`, OC at the bisector of AOB. */
function build(n: Names, bDeg: number, label: { arc?: [string, string, string, string]; wedge?: { a: string; b: string; tex: string }[] }) {
  const O: Pt = [0, 0];
  const A: Pt = [-4, 0];
  const D: Pt = [4, 0];
  const B: Pt = mul(dir(bDeg), 3.6);
  const C: Pt = mul(unit(add(unit(A), unit(B))), 3.6);
  const fb = new FigBuilder().pt(n.A, A).pt(n.O, O).pt(n.D, D).pt(n.B, B).pt(n.C, C);
  fb.seg(n.A, n.D).seg(n.O, n.B).seg(n.O, n.C);
  if (label.arc) fb.arc(label.arc[0], label.arc[1], label.arc[2], label.arc[3]);
  for (const w of label.wedge ?? []) fb.angle(n.O, w.a, w.b, w.tex);
  return fb.build();
}

const bisector: Template<P> = {
  id: 'geo.lines-angles.bisector-mcs',
  skill: 'geo.lines-angles',
  format: 'mcs',
  style: 'a bisector of an angle on a straight line: find the angle on the far side',
  generate(rng, d) {
    const n = rng.pick(NAMES);
    const line = `${n.A}${n.O}${n.D}`;
    if (d === 1) {
      const th = 2 * rng.int(20, 70); // 40..140
      if (th === 90) throw new Redraw('right angle');
      const a = 180 - th / 2;
      const { choices, answer, values } = intChoices(
        rng,
        a,
        [
          { value: th / 2, trap: 'geo-bis-half-only' },
          { value: 180 - th, trap: 'geo-bis-unhalved' },
          { value: th, trap: 'geo-bis-whole' },
        ],
        [a - 10, a + 10, a - 20],
        deg,
        1,
      );
      const figure = build(n, 180 - th, { arc: [n.A, n.O, n.B, `$${th}^\\circ$`] });
      const explanation = `Recognize: a bisector cuts an angle into two equal parts, and $${line}$ is a straight line, so angles along it add up to $180^\\circ$.

Ray $${n.O}${n.C}$ bisects the $${th}^\\circ$ angle, so $\\angle ${n.A}${n.O}${n.C} = ${th} \\div 2 = ${th / 2}^\\circ$. Angle $${n.C}${n.O}${n.D}$ is what is left of the straight angle: $180 - ${th / 2} = ${a}$.

Check: $${th / 2} + ${a} = 180$.

${trapNotes(choices, { 'geo-bis-half-only': (v) => `${v} is the half-angle $\\angle ${n.A}${n.O}${n.C}$, not the angle asked`, 'geo-bis-unhalved': (v) => `${v} subtracts the whole $${th}^\\circ$ instead of its half` }, 2)}

Rule: halve the bisected angle first, then use the straight line.`;
      return {
        params: { kind: 'whole', t: th, values },
        q: {
          format: 'mcs',
          stem: `In the figure above, $${line}$ is a straight line and ray $${n.O}${n.C}$ bisects $\\angle ${n.A}${n.O}${n.B}$. What is the measure, in degrees, of $\\angle ${n.C}${n.O}${n.D}$?`,
          figure,
          choices,
          answer,
          explanation,
        },
      };
    }
    if (d === 2) {
      const be = 2 * rng.int(15, 75); // 30..150
      if (be === 90) throw new Redraw('right angle');
      const a = (180 - be) / 2;
      const { choices, answer, values } = intChoices(
        rng,
        a,
        [
          { value: be / 2, trap: 'geo-bis-half-only' },
          { value: 180 - be, trap: 'geo-bis-unhalved' },
          { value: 90 + be / 2, trap: 'geo-bis-other-side' },
          { value: be, trap: 'geo-bis-whole' },
        ],
        [a + 10, a - 10, a + 20],
        deg,
        1,
      );
      const figure = build(n, be, { arc: [n.B, n.O, n.D, `$${be}^\\circ$`] });
      const explanation = `Recognize: the given angle $\\angle ${n.B}${n.O}${n.D}$ and the bisected angle $\\angle ${n.A}${n.O}${n.B}$ share ray $${n.O}${n.B}$ and together fill the straight line $${line}$.

So $\\angle ${n.A}${n.O}${n.B} = 180 - ${be} = ${180 - be}^\\circ$. The bisector gives two equal parts, so $\\angle ${n.A}${n.O}${n.C} = ${180 - be} \\div 2 = ${a}^\\circ$.

Check: $2 \\times ${a} + ${be} = 180$.

${trapNotes(choices, { 'geo-bis-half-only': (v) => `${v} halves the given $${be}^\\circ$ instead of its supplement`, 'geo-bis-unhalved': (v) => `${v} is the whole angle $\\angle ${n.A}${n.O}${n.B}$, not its half`, 'geo-bis-other-side': (v) => `${v} is $\\angle ${n.C}${n.O}${n.D}$, on the other side of the bisector` }, 2)}

Rule: supplement first, then halve.`;
      return {
        params: { kind: 'far', t: be, values },
        q: {
          format: 'mcs',
          stem: `In the figure above, $${line}$ is a straight line, $\\angle ${n.B}${n.O}${n.D}$ measures $${be}^\\circ$, and ray $${n.O}${n.C}$ bisects $\\angle ${n.A}${n.O}${n.B}$. What is the measure, in degrees, of $\\angle ${n.A}${n.O}${n.C}$?`,
          figure,
          choices,
          answer,
          explanation,
        },
      };
    }
    // d3: the labeled pieces are expressions in x
    const c = rng.int(2, 5);
    const x = rng.int(8, 30);
    if (((2 + c) * x) % 2) throw new Redraw('odd');
    const p = 90 - ((2 + c) * x) / 2;
    if (p < 5 || p > 40) throw new Redraw('p out of range');
    const half = x + p; // angle AOC
    const a = 180 - half; // angle COD
    const wrongX = (180 - p) / (1 + c);
    const { choices, answer, values } = intChoices(
      rng,
      a,
      [
        { value: x, trap: 'geo-bis-x-asked' },
        { value: 2 * half, trap: 'geo-bis-whole' },
        { value: Number.isInteger(wrongX) ? 180 - (wrongX + p) : 0, trap: 'geo-bis-forgot-double' },
        { value: half, trap: 'geo-bis-half-only' },
      ],
      [a + 10, a - 10, a + 20],
      deg,
      1,
    );
    const figure = build(n, 180 - 2 * half, {
      wedge: [
        { a: n.A, b: n.C, tex: angleLabel(1, p) },
        { a: n.B, b: n.D, tex: angleLabel(c, 0) },
      ],
    });
    const explanation = `Recognize: ray $${n.O}${n.C}$ bisects $\\angle ${n.A}${n.O}${n.B}$, so that angle is twice the labeled piece, and the straight line gives one equation.

$\\angle ${n.A}${n.O}${n.B} = 2(x + ${p})$, so $2(x + ${p}) + ${c}x = 180$. Then $${2 + c}x = ${180 - 2 * p}$ and $x = ${x}$. The angle asked is $\\angle ${n.C}${n.O}${n.D} = 180 - (x + ${p}) = 180 - ${half} = ${a}^\\circ$.

Check: $2(${half}) + ${c * x} = 180$.

${trapNotes(choices, { 'geo-bis-x-asked': (v) => `${v} is $x$ itself, not the angle`, 'geo-bis-whole': (v) => `${v} is the whole bisected angle`, 'geo-bis-forgot-double': (v) => `${v} treats $x + ${p}$ as if it were all of $\\angle ${n.A}${n.O}${n.B}$` }, 2)}

Rule: the labeled half counts twice on the line.`;
    return {
      params: { kind: 'algebra', t: x, p, c, values },
      q: {
        format: 'mcs',
        stem: `In the figure above, $${line}$ is a straight line and ray $${n.O}${n.C}$ bisects $\\angle ${n.A}${n.O}${n.B}$. What is the measure, in degrees, of $\\angle ${n.C}${n.O}${n.D}$?`,
        figure,
        choices,
        answer,
        explanation,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'format';
    const O: Pt = [0, 0];
    const A: Pt = [-1, 0];
    const D: Pt = [1, 0];
    const bis = (B: Pt): Pt => unit(add(A, unit(B)));
    let target: number;
    if (p.kind === 'whole') target = angleAt(O, bis(dir(180 - p.t)), D);
    else if (p.kind === 'far') target = angleAt(O, A, bis(dir(p.t)));
    else {
      // search x: the angle AOC is x + p, so B sits 2(x + p) from A; BOD must measure c x
      const hits: number[] = [];
      for (let x = 1; x < 90; x++) {
        const B = dir(180 - 2 * (x + p.p!));
        if (Math.abs(angleAt(O, B, D) - p.c! * x) < 1e-9 && Math.abs(angleAt(O, A, bis(B)) - (x + p.p!)) < 1e-9) hits.push(x);
      }
      if (hits.length !== 1) return `${hits.length} solutions`;
      target = angleAt(O, bis(dir(180 - 2 * (hits[0] + p.p!))), D);
    }
    return checkMcs(q.answer, p.values, target);
  },
};

export const bisectorTemplates = retryAll([bisector]);
