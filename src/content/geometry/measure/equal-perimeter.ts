import { Frac } from '../../../engine/frac';
import { textChoices } from '../../../engine/build';
import type { Choice, Template, Trap } from '../../../engine/types';
import { Fig, onCircle, type P2 } from './fig';
import { trapNotes } from '../notes';
import { Redraw, retryAll } from '../redraw';

/* A circle and a regular polygon with equal perimeters: one area in terms of the other's area variable (MCS). */

export const equalPerimeterTraps: Record<string, Trap> = {
  'geom-circle-pi-inverted': {
    label: 'Put $\\pi$ in the numerator where it belongs in the denominator (or the reverse)',
    fix: 'From a circle to a polygon the area picks up a factor $\\pi$; from a polygon to a circle it is divided by $\\pi$. Redo the chain: area gives radius, radius gives perimeter, perimeter gives the other figure.',
  },
  'geom-circle-pi-dropped': {
    label: 'Lost the $\\pi$ on the way',
    fix: 'The circle\'s radius is $\\frac{P}{2\\pi}$, so $\\pi$ stays in the answer. Keep it through each step; it does not cancel by itself.',
  },
  'geom-circle-equal-area-instead': {
    label: 'Set the two areas equal instead of the two perimeters',
    fix: 'The statement is about PERIMETERS. Equal perimeters give different areas: of all shapes with a given perimeter the circle encloses the most.',
  },
  'geom-circle-circumference-formula': {
    label: 'Used $C = \\pi r$ (or $\\frac{C}{2}$ as the radius)',
    fix: '$C = 2\\pi r = \\pi d$, so $r = \\frac{C}{2\\pi}$. Missing the 2 changes the area by a factor of 4.',
  },
  'geom-circle-side-equals-circumference': {
    label: 'Equated one side of the polygon with the circumference',
    fix: 'The PERIMETER of the polygon equals the circumference: it is $n$ times a side. Write $P = ns$ before comparing.',
  },
};

type Dir = 'poly-circle' | 'circle-poly';
interface Co {
  c: Frac;
  p: number;
  r3: boolean;
}
interface Params {
  n: number;
  dir: Dir;
  m: number;
  choices: [number, number, number, boolean][];
  rightText: string;
}

const SHAPES: Record<number, { name: string; kappa: string; k3: boolean; kc: Frac; sq: (x: string) => string }> = {
  4: { name: 'square', kappa: 's^2', k3: false, kc: new Frac(1), sq: (x) => `s^2 = ${x}` },
  3: { name: 'equilateral triangle', kappa: '\\frac{\\sqrt{3}}{4}s^2', k3: true, kc: new Frac(1, 4), sq: (x) => `s^2 = \\frac{4 \\cdot ${x}}{\\sqrt{3}}` },
  6: { name: 'regular hexagon', kappa: '\\frac{3\\sqrt{3}}{2}s^2', k3: true, kc: new Frac(3, 2), sq: (x) => `s^2 = \\frac{2 \\cdot ${x}}{3\\sqrt{3}}` },
};

const coVal = (o: Co) => o.c.toNumber() * Math.PI ** o.p * (o.r3 ? Math.sqrt(3) : 1);

function tex(o: Co, v: string): string {
  const top: string[] = [];
  if (o.c.n !== 1) top.push(String(o.c.n));
  if (o.r3) top.push('\\sqrt{3}');
  if (o.p > 0) top.push('\\pi ');
  top.push(v);
  const bottom: string[] = [];
  if (o.c.d !== 1) bottom.push(String(o.c.d));
  if (o.p < 0) bottom.push('\\pi');
  const t = top.join('');
  return bottom.length ? `\\frac{${t}}{${bottom.join('')}}` : t;
}

const a = (w: string, cap = false) => `${cap ? 'A' : 'a'}${/^[aeiou]/.test(w) ? 'n' : ''} ${w}`;
const LETTERS = ['A', 'K', 'S', 'M', 'T', 'B', 'W', 'Q'];

const equalPerimeter: Template<Params> = {
  id: 'geo.circles.equal-perimeter',
  skill: 'geo.circles',
  format: 'mcs',
  style: 'circle and regular polygon with equal perimeters: one area in terms of the other',
  generate(rng, d) {
    const n = d === 3 ? rng.pick([3, 6]) : 4;
    const m = d === 1 ? rng.int(1, 3) : d === 2 ? rng.int(4, 7) : rng.int(1, 5);
    const dir: Dir = rng.pick(['poly-circle', 'circle-poly']);
    const v = rng.pick(LETTERS);
    const sh = SHAPES[n];
    const m2 = m * m;
    // correct coefficient of the unknown area, in front of the given area variable
    const kappa = sh.kc;
    const kr3 = sh.k3;
    // poly->circle: n^2 X / (4 kappa pi);  circle->poly: 4 pi kappa X / n^2
    const rawP2C = new Frac(n * n).div(kappa.mul(4)); // coefficient of X/pi when kappa is rational (kappa = kc * sqrt3^k3)
    // exact forms: kappa = kc * (k3 ? sqrt3 : 1).  1/sqrt3 = sqrt3/3.
    const p2c: Co = { c: rawP2C.mul(m2).mul(kr3 ? new Frac(1, 3) : 1), p: -1, r3: kr3 };
    const c2p: Co = { c: new Frac(4).mul(kappa).div(n * n).mul(m2), p: 1, r3: kr3 };
    const right = dir === 'poly-circle' ? p2c : c2p;
    const base = right.c;
    const pool: { co: Co; trap: string }[] = [
      { co: { ...right, p: -right.p }, trap: 'geom-circle-pi-inverted' },
      { co: { ...right, p: 0 }, trap: 'geom-circle-pi-dropped' },
      { co: { c: new Frac(m2), p: 0, r3: false }, trap: 'geom-circle-equal-area-instead' },
      { co: { ...right, c: dir === 'poly-circle' ? base.mul(4) : base.div(4) }, trap: 'geom-circle-circumference-formula' },
      { co: { ...right, c: dir === 'poly-circle' ? base.div(n * n) : base.mul(n * n) }, trap: 'geom-circle-side-equals-circumference' },
    ];
    const wrong = rng.sample(pool, 4);
    const vals = [right, ...wrong.map((w) => w.co)].map(coVal);
    for (let i = 0; i < vals.length; i++) for (let j = i + 1; j < vals.length; j++) if (Math.abs(vals[i] - vals[j]) < 1e-9) throw new Redraw('duplicate values');
    const items: Choice[] = wrong.map((w) => ({ text: `$${tex(w.co, v)}$`, trap: w.trap }));
    const { choices, answer } = textChoices(rng, `$${tex(right, v)}$`, items);
    const X = m === 1 ? v : `${m2}${v}`;
    const noun = rng.pick(['wire', 'string', 'rope', 'cord']);
    const stem =
      dir === 'poly-circle'
        ? rng.pick([
            `A ${noun} bent into ${a(sh.name)} encloses an area of $${X}$. If the same ${noun} is bent into a circle instead, what area does it enclose?`,
            `${a(sh.name, true)} and a circle have the same perimeter. The area of the ${sh.name} is $${X}$. What is the area of the circle?`,
          ])
        : rng.pick([
            `A ${noun} bent into a circle encloses an area of $${X}$. If the same ${noun} is bent into ${a(sh.name)} instead, what area does it enclose?`,
            `A circle and ${a(sh.name)} have the same perimeter. The area of the circle is $${X}$. What is the area of the ${sh.name}?`,
          ]);
    // figure: both shapes have perimeter 8
    const fig = new Fig();
    const s = 8 / n;
    const R = s / (2 * Math.sin(Math.PI / n));
    const rot = n === 4 ? 45 : 90;
    const poly: P2[] = Array.from({ length: n }, (_, i) => onCircle([-2.2, 0], R, rot + (360 * i) / n));
    fig.polyXY(poly);
    fig.circle(fig.h([2.2, 0]), 8 / (2 * Math.PI));
    fig.label([-2.2, -R - 0.6], dir === 'poly-circle' ? `$${X}$` : '$?$');
    fig.label([2.2, -R - 0.6], dir === 'poly-circle' ? '$?$' : `$${X}$`);
    const pn = n;
    const first =
      dir === 'poly-circle'
        ? `Equal perimeters means the common perimeter $P$ links the figures. For the ${sh.name}, $P = ${pn}s$ and the area is $${sh.kappa}$. Setting that equal to $${X}$ gives $${sh.sq(X)}$, so $P^2 = ${pn * pn}s^2$. The circle has $P = 2\\pi r$, so its area is $\\pi r^2 = \\frac{P^2}{4\\pi}$.`
        : `Equal perimeters means the common perimeter $P$ links the figures. The circle has $\\pi r^2 = ${X}$ and circumference $P = 2\\pi r$, so $P^2 = 4\\pi \\cdot ${X}$. The ${sh.name} has $P = ${pn}s$, so $s^2 = \\frac{P^2}{${pn * pn}}$, and its area is $${sh.kappa}$.`;
    const notes = trapNotes(
      choices,
      {
        'geom-circle-pi-inverted': (vs) => `${vs} puts $\\pi$ on the wrong side, since going from the circle to the polygon multiplies by $\\pi$ and going back divides by it`,
        'geom-circle-pi-dropped': (vs) => `${vs} loses the $\\pi$ that comes from $r = \\frac{P}{2\\pi}$`,
        'geom-circle-equal-area-instead': (vs) => `${vs} equates the areas, but the statement is about perimeters`,
        'geom-circle-circumference-formula': (vs) => `${vs} comes from $C = \\pi r$ instead of $2\\pi r$, which is off by a factor of 4`,
        'geom-circle-side-equals-circumference': (vs) => `${vs} sets one side, not the whole perimeter, equal to the circumference`,
      },
      2,
    );
    return {
      params: { n, dir, m, choices: [right, ...wrong.map((w) => w.co)].map((o) => [o.c.n, o.c.d, o.p, o.r3] as [number, number, number, boolean]), rightText: `$${tex(right, v)}$` },
      q: {
        format: 'mcs',
        stem,
        figure: fig.build(false),
        choices,
        answer,
        explanation: `${first}

Carrying the numbers through gives $${tex(right, v)}$.

Check with $${v} = 1$: the ${dir === 'poly-circle' ? 'circle' : sh.name} then has an area of about ${coVal(right).toFixed(3)}, ${dir === 'poly-circle' ? 'more' : 'less'} than the given ${m2}. That is the right direction, because for a given perimeter the circle encloses the most area.

${notes}

Rule: equal perimeters link two figures through P, never through their areas.`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'format';
    const V = 2.5;
    const X = p.m * p.m * V;
    const cot = 1 / Math.tan(Math.PI / p.n);
    let area: number;
    if (p.dir === 'poly-circle') {
      const s = Math.sqrt((4 * X) / (p.n * cot));
      const r = (p.n * s) / (2 * Math.PI);
      area = Math.PI * r * r;
    } else {
      const r = Math.sqrt(X / Math.PI);
      const s = (2 * Math.PI * r) / p.n;
      area = (p.n / 4) * s * s * cot;
    }
    const hits = p.choices.flatMap(([cn, cd, pw, r3], i) => (Math.abs((cn / cd) * Math.PI ** pw * (r3 ? Math.sqrt(3) : 1) * V - area) < 1e-9 * area ? [i] : []));
    if (hits.length !== 1 || hits[0] !== 0) return `matches ${hits}`;
    return q.choices[q.answer].text === p.rightText ? null : 'answer index does not point at the right choice';
  },
};

export const equalPerimeterTemplates = retryAll([equalPerimeter]);
