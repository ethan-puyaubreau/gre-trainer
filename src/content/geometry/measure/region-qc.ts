import { qcFromSamples } from '../../../engine/build';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import { circlePolygon, shoelace, unitCircle } from './ex';
import { Fig, onCircle } from './fig';
import { Redraw, retryAll } from '../redraw';
import { qcTraps } from '../shapes/util';

/* A leftover region (c * s^2) against a length (k * s): the order depends on s (QC with a value or a range for s). */

export const regionQcTraps: Record<string, Trap> = {
  'geom-reg-coeff-only': {
    label: 'Compared the two coefficients and ignored that area grows with s squared',
    fix: 'An area is a number times $s^2$ and a length is a number times $s$, so they do not scale together. Divide both quantities by $s$ (positive) and compare $c \\cdot s$ with $k$.',
  },
  'geom-reg-needs-value': {
    label: 'Said "cannot be determined" although s, or its range, fixes the order',
    fix: 'Find the value of $s$ where the quantities are equal, then see on which side the given values lie. If all of them are on one side, the answer is A or B.',
  },
  'geom-reg-one-test': {
    label: 'Decided from a single allowed value of s',
    fix: 'The order flips at the value of $s$ where the quantities are equal. If the allowed values lie on both sides of it, test one value from each side: two different orders mean D.',
  },
};

interface Shape {
  info: (s: string) => string;
  a: string;
  /** area = c s^2 */
  c: number;
  cTex: string;
  steps: string;
  /** numeric region area for side/radius s, by polygons (check) */
  area: (s: number) => number;
  draw: (fig: Fig) => void;
}

const SHAPES: Shape[] = [
  {
    info: (s) => `A circle is inscribed in a square with side length $${s}$ meters.`,
    a: 'The area, in square meters, of the part of the square that lies outside the circle',
    c: 1 - Math.PI / 4,
    cTex: '1 - \\frac{\\pi}{4}',
    steps: 'The square has area $s^2$. The circle has diameter $s$, so radius $\\frac{s}{2}$ and area $\\frac{\\pi s^2}{4}$.',
    area: (s) => s * s - unitCircle().area * (s / 2) ** 2,
    draw: (f) => {
      f.polyXY([[-2, -2], [2, -2], [2, 2], [-2, 2]]);
      f.circle(f.h([0, 0]), 2);
    },
  },
  {
    info: (s) => `A square is inscribed in a circle of radius $${s}$ meters.`,
    a: 'The area, in square meters, of the part of the circle that lies outside the square',
    c: Math.PI - 2,
    cTex: '\\pi - 2',
    steps: 'The circle has area $\\pi s^2$. The diagonal of the square is a diameter, $2s$, so the square has area $\\frac{(2s)^2}{2} = 2s^2$.',
    area: (s) => unitCircle().area * s * s - shoelace(circlePolygon([0, 0], s, 4)),
    draw: (f) => {
      f.circle(f.h([0, 0]), 2);
      f.polyXY([onCircle([0, 0], 2, 45), onCircle([0, 0], 2, 135), onCircle([0, 0], 2, 225), onCircle([0, 0], 2, 315)]);
    },
  },
  {
    info: (s) => `A circle is inscribed in an equilateral triangle with side length $${s}$ meters.`,
    a: 'The area, in square meters, of the part of the triangle that lies outside the circle',
    c: Math.sqrt(3) / 4 - Math.PI / 12,
    cTex: '\\frac{\\sqrt{3}}{4} - \\frac{\\pi}{12}',
    steps: 'The triangle has area $\\frac{\\sqrt{3}}{4}s^2$. Its inscribed circle has radius $\\frac{s}{2\\sqrt{3}}$ (one third of the height), so area $\\frac{\\pi s^2}{12}$.',
    area: (s) => {
      const tri = shoelace([[0, 0], [s, 0], [s / 2, (s * Math.sqrt(3)) / 2]]);
      const r = tri / ((3 * s) / 2); // area = r * semiperimeter
      return tri - unitCircle().area * r * r;
    },
    draw: (f) => {
      const h = Math.sqrt(3) * 2;
      f.polyXY([[-2, -h / 3], [2, -h / 3], [0, (2 * h) / 3]]);
      f.circle(f.h([0, 0]), 4 / (2 * Math.sqrt(3)));
    },
  },
  {
    info: (s) => `An equilateral triangle is inscribed in a circle of radius $${s}$ meters.`,
    a: 'The area, in square meters, of the part of the circle that lies outside the triangle',
    c: Math.PI - (3 * Math.sqrt(3)) / 4,
    cTex: '\\pi - \\frac{3\\sqrt{3}}{4}',
    steps: 'The circle has area $\\pi s^2$. The triangle has side $s\\sqrt{3}$, so area $\\frac{\\sqrt{3}}{4}(s\\sqrt{3})^2 = \\frac{3\\sqrt{3}}{4}s^2$.',
    area: (s) => unitCircle().area * s * s - shoelace([onCircle([0, 0], s, 90), onCircle([0, 0], s, 210), onCircle([0, 0], s, 330)]),
    draw: (f) => {
      f.circle(f.h([0, 0]), 2);
      f.polyXY([onCircle([0, 0], 2, 90), onCircle([0, 0], 2, 210), onCircle([0, 0], 2, 330)]);
    },
  },
];

type Mode = 'exact' | 'range' | 'gt' | 'lt' | 'pos';
interface Params {
  shape: number;
  kn: number;
  kd: number;
  mode: Mode;
  lo: number;
  hi: number;
}

const fmt = (x: number) => x.toFixed(1);

const regionQc: Template<Params> = {
  id: 'geo.composite.region-qc',
  skill: 'geo.composite',
  format: 'qc',
  style: 'leftover region (area) against a multiple of the length s: the order depends on s',
  generate(rng, dif) {
    const shape = rng.int(0, SHAPES.length - 1);
    const S = SHAPES[shape];
    const kn = rng.pick([1, 1, 2, 3]);
    const kd = kn === 1 && rng.chance(0.3) ? 2 : 1;
    const k = kn / kd;
    const T = k / S.c; // A > B exactly when s > T
    const at = (s: number): QCChoice => (s > T ? 'A' : 'B');
    let mode: Mode;
    let lo = 0;
    let hi = 0;
    let answer: QCChoice;
    let cond: string;
    let verdict: string;
    const kTex = kd === 2 ? '\\frac{s}{2}' : kn === 1 ? 's' : `${kn}s`;
    const cs = (s: number) => S.c * s * s;
    const vals = (s: number) => `$s = ${s}$ gives $A \\approx ${fmt(cs(s))}$ and $B = ${fmt(k * s)}$`;
    const want: QCChoice = dif === 1 ? rng.pick(['A', 'B']) : rng.pick(['A', 'B', 'D']);
    if (want === 'B' && T < (dif === 1 ? 2.5 : dif === 2 ? 3 : 1)) throw new Redraw('no room below the threshold');
    if (dif === 1) {
      mode = 'exact';
      lo = want === 'B' ? rng.int(1, Math.floor(T * 0.8)) : rng.int(Math.floor(T * 1.2) + 1, Math.floor(T * 1.2) + 14);
      hi = lo;
      answer = at(lo);
      cond = `Here $s = ${lo}$.`;
      verdict = `At $s = ${lo}$, $A \\approx ${fmt(cs(lo))}$ and $B = ${fmt(k * lo)}$, so Quantity ${answer} is greater.`;
    } else if (dif === 2) {
      mode = 'range';
      if (want === 'A') {
        lo = Math.ceil(T) + rng.int(0, 4);
        hi = lo + rng.int(2, 6);
      } else if (want === 'B') {
        hi = rng.int(3, Math.floor(T));
        lo = rng.int(1, hi - 2);
      } else {
        if (Math.floor(T) < 1) throw new Redraw('no room below the threshold');
        lo = rng.int(1, Math.floor(T));
        hi = Math.ceil(T) + rng.int(1, 6);
      }
      answer = at(lo) === at(hi) ? at(lo) : 'D';
      if (answer !== want) throw new Redraw('range does not give the planned relation');
      cond = `Here $s$ is an integer with $${lo} \\le s \\le ${hi}$.`;
      verdict =
        answer === 'D'
          ? `The allowed integers lie on both sides of $${fmt(T)}$: ${vals(lo)}, but ${vals(hi)}. Two allowed values give opposite orders.`
          : `Every allowed integer, from $${lo}$ to $${hi}$, is ${answer === 'A' ? 'above' : 'below'} $${fmt(T)}$, so Quantity ${answer} is always greater. For example ${vals(hi)}.`;
    } else {
      const forms: Mode[] = want === 'A' ? ['gt', 'gt', 'pos'] : want === 'B' ? ['lt'] : T >= 1 ? ['gt', 'lt', 'pos'] : ['gt', 'lt'];
      const form = rng.pick(forms);
      mode = form;
      if (form === 'gt') {
        lo = want === 'A' ? Math.ceil(T) + rng.int(0, 3) : rng.int(1, Math.max(1, Math.ceil(T) - 1));
        answer = lo >= T ? 'A' : 'D';
        cond = `Here $s$ is a number with $s > ${lo}$.`;
        const sLow = Math.round(((lo + T) / 2) * 100) / 100;
        verdict =
          answer === 'A'
            ? `Every allowed $s$ exceeds $${lo}$, which is above $${fmt(T)}$, so Quantity A is always greater.`
            : `Values just above $${lo}$ give B, since $${lo}$ is below $${fmt(T)}$: ${vals(sLow)}. Large values give A: ${vals(Math.ceil(T) + 1)}.`;
        if (answer === 'D' && !(sLow > lo && sLow < T)) throw new Redraw('sample');
      } else if (form === 'lt') {
        hi = want === 'B' ? Math.floor(T) : Math.ceil(T) + rng.int(1, 4);
        answer = hi <= T ? 'B' : 'D';
        cond = `Here $s$ is a number with $0 < s < ${hi}$.`;
        const sHigh = Math.round(((hi + T) / 2) * 100) / 100;
        verdict =
          answer === 'B'
            ? `Every allowed $s$ is below $${hi}$, which is below $${fmt(T)}$, so Quantity B is always greater.`
            : `Values just under $${hi}$ give A, since $${hi}$ is above $${fmt(T)}$: ${vals(sHigh)}. Small values give B: ${vals(Math.round((T / 2) * 100) / 100)}.`;
        if (answer === 'D' && !(sHigh < hi && sHigh > T)) throw new Redraw('sample');
      } else {
        answer = T < 1 ? 'A' : 'D';
        cond = 'Here $s$ is a positive integer.';
        verdict =
          answer === 'A'
            ? `The smallest allowed value is $s = 1$, already above $${fmt(T)}$, so Quantity A is always greater.`
            : `$s = 1$ is below $${fmt(T)}$: ${vals(1)}. A large integer is above it: ${vals(Math.ceil(T) + 1)}.`;
      }
      if (answer !== want) throw new Redraw('planned relation not reached');
    }
    const wrongCoef: QCChoice = S.c < k ? 'B' : 'A';
    const tr: Partial<Record<QCChoice, string>> = {};
    if (wrongCoef !== answer) tr[wrongCoef] = 'geom-reg-coeff-only';
    if (answer === 'D') {
      const one = at(mode === 'gt' ? lo + 0.001 : mode === 'lt' ? 0.001 : lo);
      if (!tr[one]) tr[one] = 'geom-reg-one-test';
    } else tr.D = 'geom-reg-needs-value';
    const fig = new Fig();
    S.draw(fig);
    const kc = kd === 2 ? '0.5' : kn === 1 ? '' : String(kn);
    const kv = kd === 2 ? '0.5' : String(kn);
    const area = `\\left(${S.cTex}\\right)s^2`;
    const q: QCQuestion = {
      format: 'qc',
      figure: fig.build(true),
      info: `${S.info('s')} ${cond}`,
      quantityA: S.a,
      quantityB: `$${kTex}$`,
      answer,
      traps: qcTraps(answer, tr),
      explanation: `The first quantity is an area, a number times $s^2$; the second is a length, a number times $s$. They do not grow together, so write both in terms of $s$.

${S.steps} The leftover region has area $${area} \\approx ${S.c.toFixed(3)}s^2$.

Quantity A is greater exactly when $${S.c.toFixed(3)}s^2 > ${kc}s$, that is (dividing by $s > 0$) when $s > \\frac{${kv}}{${S.c.toFixed(3)}} \\approx ${fmt(T)}$. ${verdict}

Trap: comparing only the coefficients, $${S.c.toFixed(2)}$ and $${kv}$, as if $s$ did not matter.

Rule: an area against a length is decided by where $s$ sits relative to the break-even value.`,
    };
    return { params: { shape, kn, kd, mode, lo, hi }, q };
  },
  check(q, p) {
    if (q.format !== 'qc') return 'format';
    const S = SHAPES[p.shape];
    const k = p.kn / p.kd;
    const pair = (s: number): [number, number] => [S.area(s), k * s];
    const samples: [number, number][] = [];
    const T = k / S.c;
    if (p.mode === 'exact') samples.push(pair(p.lo));
    else if (p.mode === 'range') for (let s = p.lo; s <= p.hi; s++) samples.push(pair(s));
    else if (p.mode === 'pos') for (let s = 1; s <= 200; s++) samples.push(pair(s));
    else if (p.mode === 'gt') for (let i = 1; i <= 800; i++) samples.push(pair(p.lo + (i * (2 * T + p.lo + 10)) / 800));
    else for (let i = 1; i < 800; i++) samples.push(pair((i * p.hi) / 800));
    if (p.mode === 'gt' && T > p.lo) samples.push(pair((p.lo + T) / 2));
    if (p.mode === 'lt' && T < p.hi) samples.push(pair((p.hi + T) / 2));
    const exp = qcFromSamples(samples);
    return exp === q.answer ? null : `expected ${exp}`;
  },
};

export const regionQcTemplates = retryAll([regionQc]);
