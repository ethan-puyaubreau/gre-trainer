import { qcFromSamples } from '../../../engine/build';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import { unitCircle } from './ex';
import { Fig } from './fig';
import { qcTraps } from '../shapes/util';
import { retryAll } from '../redraw';

/* One rectangular sheet rolled two ways into a cylinder: compare volume, radius, total or curved area, or their ratios (QC). */

export const rolledTraps: Record<string, Trap> = {
  'geom-roll-same-sheet': {
    label: 'Said the two cylinders are equal because they come from the same sheet',
    fix: 'The same sheet gives the same CURVED area, $xy$. But rolling it the other way swaps the radius and the height, and volume, radius and base areas change with it.',
  },
  'geom-roll-taller': {
    label: 'Thought the taller cylinder has the larger volume',
    fix: 'The volume $\\pi r^2 h$ squares the radius but not the height. Rolling along the longer side gives a wider, shorter cylinder with the larger volume: $V = \\frac{C^2 h}{4\\pi}$ for circumference $C$.',
  },
  'geom-roll-needs-values': {
    label: 'Said "cannot be determined" although the given order of x and y (or the numbers) decides it',
    fix: 'Write both quantities in terms of $x$ and $y$ and simplify. If the comparison reduces to $x$ against $y$, and that order is given, the answer is A or B.',
  },
  'geom-roll-one-test': {
    label: 'Decided from one pair of values of x and y',
    fix: 'When the order of $x$ and $y$ is not given, either may be larger. Test a pair, then the pair with the values swapped: two different relations mean D.',
  },
  'geom-roll-wider-more': {
    label: 'Thought the wider cylinder has the larger curved area',
    fix: 'The curved surface of either cylinder IS the sheet of paper, with area $xy$. Both are equal whatever way it is rolled.',
  },
  'geom-roll-ratio-squared': {
    label: 'Took the ratio of the volumes to be the square of x/y',
    fix: 'Each volume has one squared side and one plain side: $V_P = \\frac{x^2 y}{4\\pi}$ and $V_Q = \\frac{y^2 x}{4\\pi}$. Their ratio simplifies to $\\frac{x}{y}$.',
  },
  'geom-roll-ratio-proportional': {
    label: 'Assumed the ratio of the total areas equals x/y',
    fix: 'Only the curved parts are equal. The two circular bases add $\\frac{x^2}{2\\pi}$ and $\\frac{y^2}{2\\pi}$, which scale with the SQUARES, so the ratio of the total areas is not $\\frac{x}{y}$.',
  },
};

type Kind = 'volume' | 'radius' | 'total' | 'lateral' | 'ratio-volume' | 'ratio-total';
type Mode = 'numbers' | 'ordered' | 'free';
interface Params {
  kind: Kind;
  mode: Mode;
  x: number;
  y: number;
  ord: 1 | -1 | 0;
  swap: boolean;
}

const TWO_PI = 2 * Math.PI;

/** Cylinder rolled with circumference c and height h: measures, by polygon approximation of the base. */
function cyl(c: number, h: number) {
  const r = c / TWO_PI;
  const u = unitCircle();
  return { volume: r * r * u.area * h, radius: r, lateral: r * u.perim * h, total: r * u.perim * h + 2 * r * r * u.area };
}

const flip = (l: QCChoice, swap: boolean): QCChoice => (!swap ? l : l === 'A' ? 'B' : l === 'B' ? 'A' : l);
const FIRST = (k: Kind, ord: number): QCChoice => {
  if (k === 'lateral' || k === 'ratio-volume') return 'C';
  if (ord === 0) return 'D';
  if (k === 'ratio-total') return ord > 0 ? 'B' : 'A';
  return ord > 0 ? 'A' : 'B';
};

const PHRASE: Record<'volume' | 'radius' | 'total' | 'lateral', (w: string) => string> = {
  volume: (w) => `The volume of cylinder ${w}`,
  radius: (w) => `The radius of the base of cylinder ${w}`,
  total: (w) => `The total surface area of cylinder ${w}, including both circular bases`,
  lateral: (w) => `The area of the curved surface of cylinder ${w}`,
};

const rolled: Template<Params> = {
  id: 'geo.solids.rolled',
  skill: 'geo.solids',
  format: 'qc',
  style: 'a sheet rolled two ways into a cylinder: compare volume, radius, total area, curved area or their ratios',
  generate(rng, dif) {
    const mode: Mode = dif === 1 ? 'numbers' : rng.pick(dif === 2 ? (['ordered', 'free', 'free', 'ordered'] as const) : (['ordered', 'free', 'free'] as const));
    const kind: Kind =
      dif === 1
        ? rng.pick(['volume', 'radius', 'total', 'lateral'] as const)
        : dif === 2
          ? rng.pick(['volume', 'radius', 'total', 'lateral', 'volume', 'total', 'ratio-volume'] as const)
          : 'ratio-total';
    let x = 0;
    let y = 0;
    let ord: 1 | -1 | 0 = 0;
    if (mode === 'numbers') {
      x = rng.int(3, 20);
      y = rng.int(3, 20);
      if (x === y) y = x + rng.int(1, 4);
      ord = x > y ? 1 : -1;
    } else if (mode === 'ordered') ord = rng.sign();
    const swap = !kind.startsWith('ratio') && rng.chance(0.5);
    const answer0 = FIRST(kind, ord);
    const answer = kind.startsWith('ratio') ? answer0 : flip(answer0, swap);
    // text
    const material = rng.pick(['paper', 'sheet metal', 'cardboard', 'plastic film']);
    const unit = rng.pick(['centimeters', 'inches', 'meters', 'feet']);
    const joined = rng.pick(['In both cases the edges meet exactly, with no overlap.', 'In both cases the two edges are joined exactly, leaving no gap and no overlap.']);
    const orderText = ord > 0 ? rng.pick(['$x > y$', '$y < x$']) : rng.pick(['$x < y$', '$y > x$']);
    const free = rng.pick(['$x > 0$ and $y > 0$', 'both $x$ and $y$ positive']);
    const info =
      mode === 'numbers'
        ? `A rectangular sheet of ${material} measures ${x} ${unit} by ${y} ${unit}. Cylinder $P$ is made by rolling the sheet so that the side of length ${x} becomes the circumference of the base, and cylinder $Q$ by rolling it so that the side of length ${y} becomes the circumference. ${joined}`
        : `A rectangular sheet of ${material} has sides $x$ and $y$ ${unit}, with ${mode === 'ordered' ? orderText : free}. Cylinder $P$ is made by rolling the sheet so that the side of length $x$ becomes the circumference of the base, and cylinder $Q$ by rolling it so that the side of length $y$ becomes the circumference. ${joined}`;
    let qa: string;
    let qb: string;
    if (kind === 'ratio-volume') {
      qa = 'The volume of $P$ divided by the volume of $Q$';
      qb = '$\\frac{x}{y}$';
    } else if (kind === 'ratio-total') {
      qa = 'The total surface area of $P$ (with both bases) divided by that of $Q$';
      qb = '$\\frac{x}{y}$';
    } else {
      const f = PHRASE[kind];
      qa = swap ? f('$Q$') : f('$P$');
      qb = swap ? f('$P$') : f('$Q$');
    }
    // traps, in the letters of "P first" and then flipped
    const tr: Partial<Record<QCChoice, string>> = {};
    const first = answer0;
    if (first === 'D') tr[FIRST(kind, 1)] = 'geom-roll-one-test';
    else tr.D = 'geom-roll-needs-values';
    if (kind === 'volume' && (first === 'A' || first === 'B')) tr[first === 'A' ? 'B' : 'A'] = 'geom-roll-taller';
    if ((kind === 'volume' || kind === 'radius' || kind === 'total') && first !== 'C') tr.C = 'geom-roll-same-sheet';
    if (kind === 'lateral' && ord !== 0) tr[ord > 0 ? 'A' : 'B'] = 'geom-roll-wider-more';
    if (kind === 'ratio-volume' && ord !== 0) tr[ord > 0 ? 'A' : 'B'] = 'geom-roll-ratio-squared';
    if (kind === 'ratio-total') tr.C = 'geom-roll-ratio-proportional';
    const flipped: Partial<Record<QCChoice, string>> = {};
    for (const [l, t] of Object.entries(tr)) flipped[kind.startsWith('ratio') ? (l as QCChoice) : flip(l as QCChoice, swap)] = t;
    // figure: the sheet
    const fig = new Fig();
    const sx = mode === 'numbers' ? x : 6;
    const sy = mode === 'numbers' ? y : 4;
    fig.polyXY([[0, 0], [sx, 0], [sx, sy], [0, sy]]);
    fig.segXY([0, 0], [sx, 0], `$${mode === 'numbers' ? x : 'x'}$`);
    fig.segXY([sx, 0], [sx, sy], `$${mode === 'numbers' ? y : 'y'}$`);
    // explanation
    const sample = (a: number, b: number) => {
      const P = cyl(a, b);
      const Q = cyl(b, a);
      const val = (k: Kind) => (k === 'volume' ? [P.volume, Q.volume] : k === 'radius' ? [P.radius, Q.radius] : k === 'total' ? [P.total, Q.total] : [P.lateral, Q.lateral]);
      return val;
    };
    const f1 = (v: number) => v.toFixed(1);
    let core: string;
    if (kind === 'volume' || kind === 'radius' || kind === 'total' || kind === 'lateral') {
      const formulas =
        kind === 'volume'
          ? '$V_P = \\pi \\left(\\frac{x}{2\\pi}\\right)^2 y = \\frac{x^2 y}{4\\pi}$ and $V_Q = \\frac{y^2 x}{4\\pi}$, so $\\frac{V_P}{V_Q} = \\frac{x}{y}$: the cylinder whose circumference is the longer side wins'
          : kind === 'radius'
            ? '$r_P = \\frac{x}{2\\pi}$ and $r_Q = \\frac{y}{2\\pi}$, so the longer side gives the larger radius'
            : kind === 'total'
              ? 'each total is the curved area $xy$ plus two bases: $S_P = xy + \\frac{x^2}{2\\pi}$ and $S_Q = xy + \\frac{y^2}{2\\pi}$, so the longer side gives the larger total'
              : 'the curved surface of each cylinder is the sheet itself, so both areas equal $xy$';
      const num2 = mode === 'numbers' ? sample(x, y)(kind) : null;
      const detail =
        mode === 'numbers' && num2
          ? ` With $x = ${x}$ and $y = ${y}$: $P$ gives about $${f1(num2[0])}$ and $Q$ about $${f1(num2[1])}$.`
          : first === 'D'
            ? ` Take $x = 6$, $y = 4$: $P$ gives about $${f1(sample(6, 4)(kind)[0])}$ and $Q$ about $${f1(sample(6, 4)(kind)[1])}$. Swap them, $x = 4$, $y = 6$: $P$ gives about $${f1(sample(4, 6)(kind)[0])}$ and $Q$ about $${f1(sample(4, 6)(kind)[1])}$. Opposite orders.`
            : '';
      core = `${mode === 'numbers' ? `Call the sides $x = ${x}$ and $y = ${y}$. ` : ''}Rolling turns the side joined end to end into the circumference and leaves the other side as the height. For $P$ the circumference is $x$ and the height $y$; for $Q$ it is the reverse. Then ${formulas}.${detail}`;
    } else if (kind === 'ratio-volume') {
      core = `For $P$, circumference $x$ and height $y$ give $V_P = \\frac{x^2 y}{4\\pi}$; for $Q$ the roles swap, $V_Q = \\frac{y^2 x}{4\\pi}$. The ratio is $\\frac{V_P}{V_Q} = \\frac{x^2 y}{y^2 x} = \\frac{x}{y}$ for every $x$ and $y$. The squares do not survive: one factor of $x$ and one of $y$ cancel.`;
    } else {
      const a = sample(6, 4)('total');
      core = `The total areas are $S_P = xy + \\frac{x^2}{2\\pi} = \\frac{x(2\\pi y + x)}{2\\pi}$ and $S_Q = \\frac{y(2\\pi x + y)}{2\\pi}$, so $\\frac{S_P}{S_Q} = \\frac{x}{y} \\cdot \\frac{2\\pi y + x}{2\\pi x + y}$. The second factor is above 1 exactly when $y > x$. ${ord === 0 ? `Both orders are possible: with $x = 6$, $y = 4$ the ratio is about $${(a[0] / a[1]).toFixed(2)}$, below $\\frac{6}{4} = 1.5$, but with $x = 4$, $y = 6$ it is above $\\frac{4}{6}$.` : `Here the factor is ${ord > 0 ? 'below' : 'above'} 1, so Quantity ${ord > 0 ? 'B' : 'A'} is greater.`}`;
    }
    const trapLine =
      kind === 'volume'
        ? 'Trap: the cylinder that is taller is not the one with the larger volume, because the radius is squared.'
        : kind === 'lateral'
          ? 'Trap: a wider cylinder looks bigger, but both curved surfaces are the same sheet.'
          : kind === 'ratio-volume'
            ? 'Trap: squaring the ratio, $\\left(\\frac{x}{y}\\right)^2$, forgets that each volume has only one squared side.'
            : kind === 'ratio-total'
              ? 'Trap: the curved areas are equal, so the ratio is not the ratio of the sides.'
              : 'Trap: the same sheet does not make everything equal; only the curved area is the same.';
    const q: QCQuestion = {
      format: 'qc',
      figure: fig.build(true),
      info,
      quantityA: qa,
      quantityB: qb,
      answer,
      traps: qcTraps(answer, flipped),
      explanation: `${core}

So the answer is ${answer}.

${trapLine}

Rule: rolling swaps radius and height; the curved area stays $xy$ and the volume is $\\frac{C^2 h}{4\\pi}$ for circumference $C$.`,
    };
    return { params: { kind, mode, x, y, ord, swap }, q };
  },
  check(q, p, rng) {
    if (q.format !== 'qc') return 'format';
    const pairs: [number, number][] = [];
    if (p.mode === 'numbers') pairs.push([p.x, p.y]);
    else {
      for (let i = 0; i < 25; i++) {
        let a = 1 + 19 * rng.next();
        let b = 1 + 19 * rng.next();
        if (Math.abs(a - b) < 0.05 * Math.max(a, b)) b = a * 1.2;
        if (p.mode === 'ordered' && (a > b ? 1 : -1) !== p.ord) [a, b] = [b, a];
        pairs.push([a, b]);
      }
    }
    const samples: [number, number][] = pairs.map(([a, b]) => {
      const P = cyl(a, b);
      const Q = cyl(b, a);
      switch (p.kind) {
        case 'volume':
          return p.swap ? [Q.volume, P.volume] : [P.volume, Q.volume];
        case 'radius':
          return p.swap ? [Q.radius, P.radius] : [P.radius, Q.radius];
        case 'total':
          return p.swap ? [Q.total, P.total] : [P.total, Q.total];
        case 'lateral':
          return p.swap ? [Q.lateral, P.lateral] : [P.lateral, Q.lateral];
        case 'ratio-volume':
          return [P.volume / Q.volume, a / b];
        default:
          return [P.total / Q.total, a / b];
      }
    });
    const exp = qcFromSamples(samples);
    return exp === q.answer ? null : `expected ${exp}`;
  },
};

export const rolledTemplates = retryAll([rolled]);
