import { Frac } from '../../../engine/frac';
import type { Template, Trap } from '../../../engine/types';
import { textChoices } from '../../../engine/build';
import type { Rng } from '../../../engine/rng';
import { Ex, checkChoiceValue, type ExData } from './ex';
import { Fig, type P2 } from './fig';
import { trapNotes } from '../notes';
import { Redraw, retryAll } from '../redraw';

/* A circle through the origin with a diameter OP along an axis: the coordinate of a point Q or of the other endpoint P (MCS). */

export const originDiameterTraps: Record<string, Trap> = {
  'geom-origin-hyp-as-oq': {
    label: 'Put Q at the distance of the whole diameter from the origin',
    fix: 'The diameter $OP$ is the HYPOTENUSE of right triangle $OQP$. The segment $OQ$ is a leg: $OQ = OP\\cos\\theta$, shorter than $OP$.',
  },
  'geom-origin-oq-radius': {
    label: 'Took the radius as the distance from the origin to Q',
    fix: 'Q is on the circle, but the radius is measured from the CENTER. The distance from the origin to Q is $OQ = OP\\cos\\theta$, found in the right triangle $OQP$.',
  },
  'geom-origin-xy-swapped': {
    label: 'Swapped the two coordinates of Q',
    fix: 'Read the angle from the side of the diameter: the coordinate along the diameter is $OQ\\cos\\theta$, the coordinate across it is $OQ\\sin\\theta$. A quick sketch shows which is larger.',
  },
  'geom-origin-center-as-p': {
    label: 'Gave the center (or the point Q) instead of the endpoint P',
    fix: 'The endpoint $P$ is TWICE as far from the origin as the center, along the same axis, because $OP$ is a diameter.',
  },
};

interface Params {
  mode: 'find-q' | 'find-p';
  orient: 'x' | 'y';
  theta: number;
  r: number;
  k: number;
  ask: 'x' | 'y';
  values: ExData[];
}

const TRIG: Record<number, { cos: Ex; sin: Ex; u: Ex; v: Ex }> = {
  // u = cos^2, v = sin*cos (as multiples of the diameter)
  30: { cos: Ex.sqrt(3, new Frac(1, 2)), sin: Ex.of(new Frac(1, 2)), u: Ex.of(new Frac(3, 4)), v: Ex.sqrt(3, new Frac(1, 4)) },
  45: { cos: Ex.sqrt(2, new Frac(1, 2)), sin: Ex.sqrt(2, new Frac(1, 2)), u: Ex.of(new Frac(1, 2)), v: Ex.of(new Frac(1, 2)) },
  60: { cos: Ex.of(new Frac(1, 2)), sin: Ex.sqrt(3, new Frac(1, 2)), u: Ex.of(new Frac(1, 4)), v: Ex.sqrt(3, new Frac(1, 4)) },
};


/** Five choices in random order: the right value, every trap (a trap equal to it redraws), then fillers up to four wrong ones. */
function build(rng: Rng, correct: Ex, traps: { v: Ex; trap: string }[], fillers: Ex[]) {
  const near = (x: number, y: number) => Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));
  const c = correct.value();
  const wrong: { v: Ex; trap?: string }[] = [];
  const free = (x: number) => x > 0 && !near(x, c) && !wrong.some((w) => near(w.v.value(), x));
  for (const t of traps) {
    if (near(t.v.value(), c)) throw new Redraw('a trap equals the answer');
    if (free(t.v.value())) wrong.push(t);
  }
  for (const f of rng.shuffle(fillers)) if (wrong.length < 4 && free(f.value())) wrong.push({ v: f });
  if (wrong.length < 4) throw new Redraw('not enough choices');
  const kept = wrong.slice(0, 4);
  const data = new Map<string, ExData>([[`$${correct.tex()}$`, correct.data()], ...kept.map((w) => [`$${w.v.tex()}$`, w.v.data()] as [string, ExData])]);
  const { choices, answer } = textChoices(rng, `$${correct.tex()}$`, kept.map((w) => ({ text: `$${w.v.tex()}$`, ...(w.trap ? { trap: w.trap } : {}) })));
  return { choices, answer, values: choices.map((ch) => data.get(ch.text)!) };
}

const other = (o: 'x' | 'y') => (o === 'x' ? 'y' : 'x');

const originDiameter: Template<Params> = {
  id: 'geo.circles.origin-diameter',
  skill: 'geo.circles',
  format: 'mcs',
  style: 'circle through the origin with a diameter on an axis: a coordinate from a special right triangle',
  generate(rng, d) {
    const mode: Params['mode'] = d === 3 ? 'find-p' : 'find-q';
    const orient = rng.pick(['x', 'y'] as const);
    const theta = d === 1 ? 45 : rng.pick([30, 60] as const);
    const th: number = mode === 'find-p' ? rng.pick([30, 45, 60]) : theta;
    const tr = TRIG[th];
    const fig = new Fig();
    const A = orient;
    const across = other(orient);
    if (mode === 'find-q') {
      const r = rng.int(2, 12);
      const D = 2 * r;
      const desc = rng.pick(d === 1 ? ([0, 1] as const) : ([0, 1, 2] as const));
      const givenDiameter = desc !== 0 || rng.chance(0.5);
      const ask = rng.pick(['x', 'y'] as const);
      // coordinate along the diameter u = D cos^2, across v = D sin cos
      const u = tr.u.scale(D);
      const v = tr.v.scale(D);
      const coord = ask === orient ? u : v;
      const wrongSwap = ask === orient ? v : u;
      const scaleTrap = givenDiameter ? coord.scale(2) : coord.scale(new Frac(1, 2));
      const trigAlong = ask === orient ? tr.cos : tr.sin;
      const hyp = trigAlong.scale(D);
      const radIn = trigAlong.scale(r);
      const traps = [
        { v: hyp, trap: 'geom-origin-hyp-as-oq' },
        { v: radIn, trap: 'geom-origin-oq-radius' },
        ...(th === 45 ? [] : [{ v: wrongSwap, trap: 'geom-origin-xy-swapped' }]),
        { v: scaleTrap, trap: 'geom-circle-radius-diameter' },
      ];
      const fillers = [Ex.of(r), Ex.of(D), Ex.sqrt(3, r), Ex.sqrt(3, new Frac(r, 2)), Ex.sqrt(2, r), Ex.of(new Frac(3 * r, 2)), Ex.sqrt(3, D)];
      const { choices, answer, values } = build(rng, coord, traps, [...fillers, coord.scale(2), coord.scale(new Frac(3, 2)), coord.scale(new Frac(1, 2))]);
      // figure (to scale)
      const C: P2 = orient === 'x' ? [r, 0] : [0, r];
      const Pp: P2 = orient === 'x' ? [D, 0] : [0, D];
      const Q: P2 = orient === 'x' ? [u.value(), v.value()] : [v.value(), u.value()];
      fig.pt('O', [0, 0], [-0.6, -0.6]).pt('P', Pp).pt('Q', Q).circle(fig.h(C), r);
      fig.seg('O', 'P').seg('O', 'Q').seg('Q', 'P').right('O', 'Q', 'P').angleLabel('P', 'O', 'Q', `$${th}^\\circ$`);
      const f = fig.build(false);
      f.axes = { xMin: -1.5, xMax: D + 2, yMin: -D / 2 - 1.5, yMax: D / 2 + 1.5, step: 1 };
      if (orient === 'y') f.axes = { xMin: -D / 2 - 1.5, xMax: D / 2 + 1.5, yMin: -1.5, yMax: D + 2, step: 1 };
      const circleText =
        desc === 0
          ? `A circle in the $xy$-plane passes through the origin $O$ and has ${givenDiameter ? `a diameter $OP$ of length ${D}` : `radius ${r}`}. ${givenDiameter ? 'This diameter' : 'Its diameter $OP$'} lies on the positive $${A}$-axis.`
          : desc === 1
            ? `Segment $OP$ is a diameter of a circle, where $O$ is the origin and $P = ${orient === 'x' ? `(${D}, 0)` : `(0, ${D})`}$.`
            : `The circle $x^2 + y^2 = ${D}${A}$ passes through the origin $O$, and $OP$ is its diameter along the positive $${A}$-axis.`;
      const stem = `${circleText} Point $Q$ is on the circle in the first quadrant, and $\\angle POQ = ${th}^\\circ$. What is the $${ask}$-coordinate of $Q$?`;
      const lenOQ = tr.cos.scale(D);
      const notes = trapNotes(
        choices,
        {
          'geom-origin-hyp-as-oq': (vs) => `${vs} comes from placing $Q$ at the full diameter ${D} from the origin, but ${D} is the hypotenuse, not $OQ$`,
          'geom-origin-oq-radius': (vs) => `${vs} comes from using the radius ${r} as $OQ$, although the radius is measured from the center`,
          'geom-origin-xy-swapped': (vs) => `${vs} is the other coordinate of $Q$, which comes from mixing up the leg along the axis with the leg across it`,
          'geom-circle-radius-diameter': (vs) => `${vs} comes from mixing up the radius ${r} and the diameter ${D}`,
        },
        2,
      );
      return {
        params: { mode, orient, theta: th, r, k: 0, ask, values },
        q: {
          format: 'mcs',
          stem,
          figure: f,
          choices,
          answer,
          explanation: `$OP$ is a diameter and $Q$ is on the circle, so angle $OQP$ is inscribed in a semicircle: it is $90^\\circ$. Triangle $OQP$ is a right triangle with hypotenuse $OP = ${D}$ and an angle of $${th}^\\circ$ at $O$.

Then $OQ = ${D}\\cos ${th}^\\circ = ${lenOQ.tex()}$. The coordinate of $Q$ along the $${A}$-axis is $OQ\\cos ${th}^\\circ = ${u.tex()}$ and the coordinate across it, along the $${across}$-axis, is $OQ\\sin ${th}^\\circ = ${v.tex()}$. So the $${ask}$-coordinate is $${coord.tex()}$.

Check: the distance from the center to $Q$ must be the radius ${r}, and $\\left(${u.tex()} - ${r}\\right)^2 + \\left(${v.tex()}\\right)^2 = ${r * r}$.

${notes}

Rule: a diameter seen from any point of the circle makes a right angle, so find the leg along the axis first.`,
        },
      };
    }
    // find-p: Q is given, no angle; the right angle at Q and the slope of OQ reveal a special triangle
    const kk = rng.int(1, 9);
    const D = 4 * kk;
    const u = tr.u.scale(D);
    const v = tr.v.scale(D);
    const Qa = u; // along the axis
    const Qb = v;
    const qx = orient === 'x' ? Qa : Qb;
    const qy = orient === 'x' ? Qb : Qa;
    const oq = tr.cos.scale(D);
    const traps = [
      { v: oq, trap: 'geom-origin-hyp-as-oq' },
      { v: Qa.scale(2), trap: 'geom-origin-center-as-p' },
      { v: Ex.of(D / 2), trap: 'geom-circle-radius-diameter' },
      { v: Qa.add(Qb), trap: 'geom-origin-xy-swapped' },
    ];
    const { choices, answer, values } = build(rng, Ex.of(D), traps, [Ex.of(2 * D), Ex.of(3 * D / 2), Ex.of(D / 4), Ex.sqrt(3, D / 2), Ex.sqrt(2, D)]);
    const Qpt: P2 = [qx.value(), qy.value()];
    const Pp: P2 = orient === 'x' ? [D, 0] : [0, D];
    fig.pt('O', [0, 0], [-0.6, -0.6]).pt('P', Pp).pt('Q', Qpt, [0.5, 0.6]).circle(fig.h(orient === 'x' ? [D / 2, 0] : [0, D / 2]), D / 2);
    fig.seg('O', 'P').seg('O', 'Q').seg('Q', 'P', undefined, true);
    const f = fig.build(false);
    f.axes = orient === 'x' ? { xMin: -1.5, xMax: D + 2, yMin: -D / 2 - 1.5, yMax: D / 2 + 1.5, step: 1 } : { xMin: -D / 2 - 1.5, xMax: D / 2 + 1.5, yMin: -1.5, yMax: D + 2, step: 1 };
    const qTex = `(${qx.tex()}, ${qy.tex()})`;
    const desc = rng.pick([0, 1, 2] as const);
    const stem =
      desc === 0
        ? `Circle $C$ passes through the origin $O$ and through $Q = ${qTex}$. $OP$ is a diameter of $C$, and $P$ lies on the positive $${A}$-axis. What is the $${A}$-coordinate of $P$?`
        : desc === 1
          ? `In the $xy$-plane, $OP$ is a diameter of a circle, where $O$ is the origin and $P$ is on the positive $${A}$-axis. The point $Q = ${qTex}$ is on the circle. What is the $${A}$-coordinate of $P$?`
          : `A circle with its center on the $${A}$-axis passes through the origin and through the point $Q = ${qTex}$. At what $${A}$-coordinate does the circle cross the $${A}$-axis again?`;
    const notes = trapNotes(
      choices,
      {
        'geom-origin-hyp-as-oq': (vs) => `${vs} comes from taking the distance $OQ$, a leg of the right triangle and not the diameter`,
        'geom-origin-center-as-p': (vs) => `${vs} comes from doubling the coordinate of $Q$ along the axis, which is not how $P$ is related to $Q$`,
        'geom-circle-radius-diameter': (vs) => `${vs} comes from giving the radius, but $P$ is the far end of the DIAMETER`,
        'geom-origin-xy-swapped': (vs) => `${vs} comes from adding the coordinates of $Q$, which has no meaning here`,
      },
      2,
    );
    return {
      params: { mode, orient, theta: th, r: 0, k: kk, ask: orient, values },
      q: {
        format: 'mcs',
        stem,
        figure: f,
        choices,
        answer,
        explanation: `$OP$ is a diameter, so angle $OQP$ is a right angle. The slope of $OQ$ shows a special triangle: from $O$ to $Q$ the legs along and across the $${A}$-axis are $${Qa.tex()}$ and $${Qb.tex()}$, so $OQ = ${oq.tex()}$ and angle $POQ$ is $${th}^\\circ$.

In right triangle $OQP$, $OQ = OP\\cos ${th}^\\circ$, so $OP = \\frac{${oq.tex()}}{\\cos ${th}^\\circ} = ${D}$. The point $P$ is on the $${A}$-axis, so its $${A}$-coordinate is ${D}.

Check: $OQ^2 + QP^2 = OP^2$ with $QP = ${D}\\sin ${th}^\\circ$ gives $${D * D}$ on both sides.

${notes}

Rule: spot the right angle on the diameter, then read the angle of $OQ$ off its coordinates.`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'format';
    const bis = (f: (t: number) => number, lo: number, hi: number) => {
      for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        if (f(mid) < 0) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    };
    if (p.mode === 'find-q') {
      const D = 2 * p.r;
      const th = (p.theta * Math.PI) / 180;
      // axis direction a; the ray from O at angle theta to the axis; first point where it leaves the circle
      const dir: P2 = p.orient === 'x' ? [Math.cos(th), Math.sin(th)] : [Math.sin(th), Math.cos(th)];
      const C: P2 = p.orient === 'x' ? [p.r, 0] : [0, p.r];
      const t = bis((s) => Math.hypot(s * dir[0] - C[0], s * dir[1] - C[1]) - p.r, 1e-9, D + 1);
      const target = p.ask === 'x' ? t * dir[0] : t * dir[1];
      return checkChoiceValue(p.values, q.answer, target);
    }
    // find-p: Q on the circle with its center on the axis, through O
    const D = 4 * p.k;
    const th = (p.theta * Math.PI) / 180;
    const along = D * Math.cos(th) ** 2;
    const across = D * Math.sin(th) * Math.cos(th);
    const [a, b] = p.orient === 'x' ? [along, across] : [across, along];
    // center (c on the axis) is equidistant from O and Q: the distance to Q minus c is positive for a small c
    const hh = bis((c) => -(Math.hypot(a - (p.orient === 'x' ? c : 0), b - (p.orient === 'y' ? c : 0)) - c), 1e-9, 10 * D);
    return checkChoiceValue(p.values, q.answer, 2 * hh);
  },
};

export const originDiameterTemplates = retryAll([originDiameter]);
