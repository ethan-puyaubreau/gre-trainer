import type { Template, Trap } from '../../../engine/types';
import { num } from '../../../engine/tex';
import { trapNotes } from '../notes';
import { Redraw, retryAll } from '../redraw';
import { FigBuilder, TRI_NAMES, angleAt, triFromAngles, type Pt } from './fig';
import { angleLabel, checkMcs, intChoices } from './util';

/* A line through one vertex of a triangle, parallel to the opposite side: angles at the vertex (MCS). */

export const apexParallelTraps: Record<string, Trap> = {
  'geo-tp-outer-sum': {
    label: 'Added the two outer angles to get the angle at the vertex',
    fix: 'The two angles on the parallel line and the angle of the triangle at the vertex fill a straight line, so the vertex angle is $180^\\circ$ minus the two outer angles, not their sum.',
  },
  'geo-tp-one-angle': {
    label: 'Subtracted only one outer angle from $180^\\circ$',
    fix: 'Three angles share the straight line through the vertex: the two outer angles and the triangle angle. Subtract both outer angles from $180^\\circ$.',
  },
  'geo-tp-other-base': {
    label: 'Gave the other base angle',
    fix: 'The outer angle on the left matches the base angle on the left (alternate interior angles), and the one on the right matches the right base angle. Match each label to its own side.',
  },
  'geo-tp-x-asked': {
    label: 'Gave $x$ instead of the angle',
    fix: 'Solve for $x$, then substitute it into the expression for the angle named in the question.',
  },
  'geo-tp-forgot-third': {
    label: 'Gave the sum of the two base angles',
    fix: 'The base angles add up to $180^\\circ$ minus the angle at the vertex, but the question asks for just one of them.',
  },
  'geo-tp-assumed-iso': {
    label: 'Split the two base angles equally when nothing says they are equal',
    fix: 'The base angles differ here (one is $t$ degrees larger). Write both with $x$, add them, and solve.',
  },
  'geo-tp-vertex-angle': {
    label: 'Gave the angle at the vertex',
    fix: 'Read the question for the angle asked: the base angle is the one on the parallel line side matching it, not the angle between the equal sides.',
  },
  'geo-tp-supplement': {
    label: 'Gave the supplement of the base angle',
    fix: 'Alternate interior angles are equal; the outer angle is not the supplement of the base angle.',
  },
};

interface P {
  kind: 'numbers' | 'unequal' | 'isosceles';
  p?: number; // d1: outer left
  q?: number; // d1: outer right
  w?: number; // d2: vertex angle
  x?: number;
  t?: number;
  m?: number; // d3
  k?: number;
  side: 'left' | 'right';
  values: number[];
}

/** Same choices in a random order (the answer position follows). */
export function mixed<T extends { choices: unknown[]; answer: number; values: number[] }>(rng: { shuffle<U>(a: readonly U[]): U[] }, r: T): T {
  const order = rng.shuffle(r.choices.map((_, i) => i));
  return { ...r, choices: order.map((i) => r.choices[i]), values: order.map((i) => r.values[i]), answer: order.indexOf(r.answer) };
}

const deg = (v: { n: number }) => `$${num(v.n)}^\\circ$`;

function triFigure(names: [string, string, string], bAng: number, cAng: number, lab: { L?: string; R?: string; A?: string }) {
  const [top, lft, rgt] = names;
  const [B, C, A] = triFromAngles(bAng, cAng, 5);
  const L: Pt = [A[0] - 3, A[1]];
  const R: Pt = [A[0] + 3, A[1]];
  const fb = new FigBuilder().pt(top, A).pt(lft, B).pt(rgt, C).pt('_l', L).pt('_r', R).hide('_l', '_r');
  fb.poly(top, lft, rgt).seg('_l', '_r');
  fb.text([R[0] + 0.5, R[1]], '$\\ell$');
  if (lab.L) fb.angle(top, '_l', lft, lab.L);
  if (lab.R) fb.angle(top, '_r', rgt, lab.R);
  if (lab.A) fb.angle(top, lft, rgt, lab.A);
  return fb.build();
}

const apexParallel: Template<P> = {
  id: 'geo.lines-angles.apex-parallel-mcs',
  skill: 'geo.lines-angles',
  format: 'mcs',
  style: 'a line through the vertex of a triangle parallel to its base',
  generate(rng, d) {
    const names = rng.pick(TRI_NAMES);
    const [top, lft, rgt] = names;
    const side = rng.pick(['left', 'right'] as const);
    const baseName = side === 'left' ? lft : rgt;
    const line = `line $\\ell$ through $${top}$ is parallel to $\\overline{${lft}${rgt}}$`;
    if (d === 1) {
      const p = rng.int(35, 75);
      const q = rng.int(35, 75);
      const a = 180 - p - q;
      if (a < 30 || a > 110 || p === q) throw new Redraw('shape');
      const { choices, answer, values } = mixed(
        rng,
        intChoices(
        rng,
        a,
        [
          { value: p + q, trap: 'geo-tp-outer-sum' },
          { value: 180 - p, trap: 'geo-tp-one-angle' },
          { value: 180 - q, trap: 'geo-tp-one-angle' },
        ],
        [a + 10, a - 10, a + 20],
        deg,
        1,
        ),
      );
      const figure = triFigure(names, p, q, { L: `$${p}^\\circ$`, R: `$${q}^\\circ$` });
      const explanation = `Recognize: a line through $${top}$ parallel to the opposite side, so the angles on $\\ell$ at $${top}$ and the angle of the triangle at $${top}$ together make a straight angle.

The two marked angles are $${p}^\\circ$ and $${q}^\\circ$, and the triangle's angle $\\angle ${lft}${top}${rgt}$ completes the line: $180 - ${p} - ${q} = ${a}$.

Check: alternate interior angles give $\\angle ${lft} = ${p}^\\circ$ and $\\angle ${rgt} = ${q}^\\circ$, and $${p} + ${q} + ${a} = 180$.

${trapNotes(choices, { 'geo-tp-outer-sum': (v) => `${v} adds the two outer angles instead of taking them away from $180^\\circ$`, 'geo-tp-one-angle': (v) => `${v} subtracts only one outer angle` }, 2)}

Rule: the angles along one straight line add up to $180^\\circ$.`;
      return {
        params: { kind: 'numbers', p, q, side, values },
        q: { format: 'mcs', stem: `In the figure above, ${line}. What is the measure, in degrees, of $\\angle ${lft}${top}${rgt}$?`, figure, choices, answer, explanation },
      };
    }
    if (d === 2) {
      const x = rng.int(20, 55);
      const t = rng.pick([10, 15, 20, 25]);
      const w = 180 - 2 * x - t;
      if (w < 30 || w > 110) throw new Redraw('shape');
      const a = x + t;
      const iso = (180 - w) / 2;
      const { choices, answer, values } = mixed(
        rng,
        intChoices(
        rng,
        a,
        [
          { value: x, trap: 'geo-tp-other-base' },
          { value: 180 - w, trap: 'geo-tp-forgot-third' },
          { value: w, trap: 'geo-tp-vertex-angle' },
          { value: Number.isInteger(iso) && iso !== a ? iso : 0, trap: 'geo-tp-assumed-iso' },
        ],
        [a + 10, a - 10, a + 20, a - 15],
        deg,
        1,
        ),
      );
      const bigL = side === 'left';
      const [bAng, cAng] = bigL ? [a, x] : [x, a];
      const lbl = (c: number, k: number) => angleLabel(c, k);
      const figure = triFigure(names, bAng, cAng, { L: bigL ? lbl(1, t) : lbl(1, 0), R: bigL ? lbl(1, 0) : lbl(1, t), A: `$${w}^\\circ$` });
      const explanation = `Recognize: $\\ell$ is parallel to the base, so each marked angle on $\\ell$ equals the base angle on the same side (alternate interior angles).

The base angles are therefore $x$ and $x + ${t}$, and with the vertex angle they sum to $180$: $x + (x + ${t}) + ${w} = 180$, so $2x = ${180 - w - t}$ and $x = ${x}$. The angle at $${baseName}$ has label $x + ${t}$, so it is $${x} + ${t} = ${a}^\\circ$.

Check: $${x} + ${a} + ${w} = 180$.

${trapNotes(choices, { 'geo-tp-other-base': (v) => `${v} is the other base angle`, 'geo-tp-forgot-third': (v) => `${v} is the sum of both base angles`, 'geo-tp-vertex-angle': (v) => `${v} is the vertex angle`, 'geo-tp-assumed-iso': (v) => `${v} splits the base angles equally` }, 2)}

Rule: match each outer angle to the base angle on its own side.`;
      return {
        params: { kind: 'unequal', w, x, t, side, values },
        q: { format: 'mcs', stem: `In the figure above, ${line}. What is the measure, in degrees, of $\\angle ${top}${baseName}${side === 'left' ? rgt : lft}$?`, figure, choices, answer, explanation },
      };
    }
    // d3: isosceles, ℓ parallel to the base, labels in terms of y
    const m = rng.int(2, 4);
    const y = rng.int(8, 30);
    if (((m + 2) * y) % 2) throw new Redraw('odd');
    const k = (180 - (m + 2) * y) / 2;
    if (k < 5 || k > 40) throw new Redraw('k range');
    const a = y + k;
    const apex = m * y;
    const { choices, answer, values } = intChoices(
      rng,
      a,
      [
        { value: y, trap: 'geo-tp-x-asked' },
        { value: apex, trap: 'geo-tp-vertex-angle' },
        { value: 180 - a, trap: 'geo-tp-supplement' },
        { value: 180 - apex, trap: 'geo-tp-forgot-third' },
      ],
      [a + 10, a - 10, a + 20],
      deg,
      1,
    );
    const figure = triFigure(names, a, a, { L: angleLabel(1, k).replace('x', 'y'), A: angleLabel(m, 0).replace('x', 'y') });
    const explanation = `Recognize: $${top}${lft} = ${top}${rgt}$ makes the base angles equal, and $\\ell \\parallel ${lft}${rgt}$ makes the angle on $\\ell$ equal to the base angle beside it.

So each base angle is $y + ${k}$ and the vertex angle is $${m}y$. The triangle gives $2(y + ${k}) + ${m}y = 180$, so $${m + 2}y = ${180 - 2 * k}$ and $y = ${y}$. The base angle is $${y} + ${k} = ${a}^\\circ$.

Check: $2(${a}) + ${apex} = 180$.

${trapNotes(choices, { 'geo-tp-x-asked': (v) => `${v} is $y$, not an angle`, 'geo-tp-vertex-angle': (v) => `${v} is the vertex angle $${m}y$`, 'geo-tp-supplement': (v) => `${v} is the supplement of the base angle` }, 2)}

Rule: parallel lines move a base angle up to the vertex; equal sides make two of them equal.`;
    return {
      params: { kind: 'isosceles', m, k, x: y, side, values },
      q: {
        format: 'mcs',
        stem: `In the figure above, $${top}${lft} = ${top}${rgt}$ and ${line}. What is the measure, in degrees, of $\\angle ${top}${rgt}${lft}$?`,
        figure,
        choices,
        answer,
        explanation,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'format';
    // Triangle with base angles b (left) and c (right); A is the top vertex, ℓ the horizontal through it.
    const geo = (b: number, c: number) => {
      const [B, C, A] = triFromAngles(b, c, 5);
      return { A, B, C, L: [A[0] - 3, A[1]] as Pt, R: [A[0] + 3, A[1]] as Pt };
    };
    let target = NaN;
    const hits: number[] = [];
    if (p.kind === 'numbers') {
      for (let b = 20; b < 100; b++)
        for (let c = 20; c < 100; c++) {
          const g = geo(b, c);
          if (Math.abs(angleAt(g.A, g.L, g.B) - p.p!) < 1e-6 && Math.abs(angleAt(g.A, g.R, g.C) - p.q!) < 1e-6) {
            hits.push(b);
            target = angleAt(g.A, g.B, g.C);
          }
        }
    } else if (p.kind === 'unequal') {
      for (let x = 1; x < 90; x++) {
        const [b, c] = p.side === 'left' ? [x + p.t!, x] : [x, x + p.t!];
        const g = geo(b, c);
        if (Math.abs(angleAt(g.A, g.B, g.C) - p.w!) < 1e-6) {
          hits.push(x);
          target = p.side === 'left' ? angleAt(g.B, g.A, g.C) : angleAt(g.C, g.A, g.B);
        }
      }
    } else {
      for (let y = 1; y < 90; y++) {
        const g = geo(y + p.k!, y + p.k!);
        if (Math.abs(angleAt(g.A, g.B, g.C) - p.m! * y) < 1e-6 && Math.abs(angleAt(g.A, g.L, g.B) - (y + p.k!)) < 1e-6) {
          hits.push(y);
          target = angleAt(g.C, g.A, g.B);
        }
      }
    }
    if (hits.length !== 1) return `${hits.length} solutions`;
    return checkMcs(q.answer, p.values, target);
  },
};

export const apexParallelTemplates = retryAll([apexParallel]);
