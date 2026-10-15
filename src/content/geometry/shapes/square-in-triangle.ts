import { numericChoices } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { decimal } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { Fig } from '../measure/fig';
import { trapNotes } from '../notes';
import { Redraw, retryAll } from '../redraw';

/* A square inscribed in a triangle, resting on a side: similar triangles above the square give its side (MCS). */

export const squareInTriangleTraps: Record<string, Trap> = {
  'geo-sim-sq-altitude': {
    label: 'Used the altitude formula $\\frac{ab}{c}$ instead of the square-in-the-corner formula',
    fix: 'The altitude to the hypotenuse is $\\frac{ab}{c}$. A square in the corner is found from the small triangle cut off above it: $\\frac{s}{a} + \\frac{s}{b} = 1$, so $s = \\frac{ab}{a + b}$.',
  },
  'geo-sim-sq-harmonic': {
    label: 'Doubled the side by using $\\frac{2ab}{a + b}$',
    fix: 'The harmonic mean $\\frac{2ab}{a + b}$ is the side of a square that ALSO uses the vertex at the right angle twice. Setting up $\\frac{s}{a} + \\frac{s}{b} = 1$ gives $s = \\frac{ab}{a + b}$.',
  },
  'geo-sim-sq-half-leg': {
    label: 'Took half of the shorter leg',
    fix: 'The square touches the hypotenuse, and the hypotenuse is not halfway along either leg unless the legs are equal. Use the similar triangle above the square.',
  },
  'geo-sim-sq-side-for-area': {
    label: 'Gave the side of the square when its area (or perimeter) was asked',
    fix: 'Finish the question: area is $s^2$ and perimeter is $4s$. Underline what is asked before solving.',
  },
  'geo-sim-sq-slant-for-height': {
    label: 'Used the slanted side as the height of the triangle',
    fix: 'The height is the perpendicular from the apex to the base, found with the Pythagorean theorem from half of the base and the slanted side. The slanted side is longer.',
  },
  'geo-sim-sq-arith-mean': {
    label: 'Averaged the two lengths instead of solving the proportion',
    fix: 'The square is shorter than both the base and the height. Write $\\frac{b - s}{b} = \\frac{s}{h}$, the similar triangle above the square, and solve for $s$.',
  },
  'geo-sim-sq-other-ask': {
    label: 'Answered with a different measure of the square',
    fix: 'The side, the area ($s^2$) and the perimeter ($4s$) are different numbers. Re-read the last line of the question.',
  },
};

type Ask = 'side' | 'area' | 'perim';
interface Params {
  kind: 'corner' | 'base';
  a: number; // leg AC, or base
  b: number; // leg BC, or height (corner) / 0
  L: number; // slanted sides (base kind)
  ask: Ask;
  names: string[];
}

const SETS: string[][] = [
  ['A', 'B', 'C'],
  ['P', 'Q', 'R'],
  ['X', 'Y', 'Z'],
  ['K', 'L', 'M'],
  ['E', 'F', 'G'],
];
const terminating = (f: Frac) => {
  let dd = f.d;
  while (dd % 2 === 0) dd /= 2;
  while (dd % 5 === 0) dd /= 5;
  return dd === 1;
};
const tx = (f: Frac) => `$${decimal(f)}$`;
const ISO: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [6, 8, 10],
  [8, 15, 17],
  [9, 12, 15],
  [12, 16, 20],
  [15, 20, 25],
  [9, 40, 41],
];

const squareInTriangle: Template<Params> = {
  id: 'geo.similarity.square-in-triangle-mcs',
  skill: 'geo.similarity',
  format: 'mcs',
  style: 'a square inscribed in a triangle: its side from the similar triangle above it',
  generate(rng, d) {
    const [n1, n2, n3] = rng.pick(SETS);
    let kind: Params['kind'] = 'corner';
    let a = 0;
    let b = 0;
    let L = 0;
    let hgt = 0;
    let ask: Ask = 'side';
    if (d === 3) {
      kind = 'base';
      const [m, hh, ll] = rng.pick(ISO);
      const k = rng.pick([1, 1, 2, 3]);
      const half = m * k;
      const height = hh * k;
      L = ll * k;
      a = 2 * half;
      b = 0;
      hgt = height;
      if (!terminating(new Frac(a * hgt, a + hgt))) throw new Redraw('not terminating');
      ask = rng.pick(['side', 'side', 'area', 'perim']);
    } else {
      if (d === 1) {
        const u = rng.int(1, 4);
        const v = rng.int(1, 4);
        const g = rng.int(1, 3);
        a = g * u * (u + v);
        b = g * v * (u + v);
        if (u === v || Math.max(a, b) > 36) throw new Redraw('legs');
      } else {
        a = rng.int(3, 30);
        b = rng.int(3, 30);
        if (a === b) throw new Redraw('equal legs');
        const sv = new Frac(a * b, a + b);
        if (sv.isInt() || !terminating(sv)) throw new Redraw('side value');
      }
      ask = d === 1 ? 'side' : rng.pick(['side', 'area', 'perim']);
      hgt = b;
    }
    const sv = new Frac(a * hgt, a + hgt);
    if (d === 2 && ask !== 'side' && sv.d > 2) throw new Redraw('area or perimeter would be an awkward decimal');
    const val = (v: Frac) => (ask === 'side' ? v : ask === 'area' ? v.mul(v) : v.mul(4));
    const answer = val(sv);
    const traps: { value: Frac; trap: string }[] = [];
    if (kind === 'corner') {
      const c = Math.sqrt(a * a + b * b);
      traps.push({ value: val(new Frac(2 * a * b, a + b)), trap: 'geo-sim-sq-harmonic' }, { value: val(new Frac(Math.min(a, b), 2)), trap: 'geo-sim-sq-half-leg' }, { value: val(new Frac(a + b, 2)), trap: 'geo-sim-sq-arith-mean' });
      if (Number.isInteger(c)) traps.push({ value: val(new Frac(a * b, c)), trap: 'geo-sim-sq-altitude' });
    } else {
      traps.push({ value: val(new Frac(a * L, a + L)), trap: 'geo-sim-sq-slant-for-height' }, { value: val(new Frac(2 * a * hgt, a + hgt)), trap: 'geo-sim-sq-harmonic' }, { value: val(new Frac(a + hgt, 2)), trap: 'geo-sim-sq-arith-mean' });
    }
    if (ask !== 'side') traps.push({ value: sv, trap: 'geo-sim-sq-side-for-area' });
    if (ask === 'area') traps.push({ value: sv.mul(4), trap: 'geo-sim-sq-other-ask' });
    if (ask === 'perim') traps.push({ value: sv.mul(sv), trap: 'geo-sim-sq-other-ask' });
    const { choices, answer: ans } = numericChoices(rng, {
      correct: answer,
      traps: traps.filter((t) => terminating(t.value)),
      fillers: [answer.add(new Frac(1)), answer.sub(new Frac(1)), answer.mul(2), answer.div(2)],
      format: tx,
      order: 'random',
    });
    if (choices.filter((c) => c.trap).length < 2) throw new Redraw('too few traps shown');
    // figure, to scale
    const fig = new Fig();
    const s = sv.toNumber();
    const what = ask === 'side' ? 'the side length of the square' : ask === 'area' ? 'the area of the square' : 'the perimeter of the square';
    let stem: string;
    let steps: string;
    if (kind === 'corner') {
      fig.pt(n3, [0, 0], [-1, -0.6]).pt(n1, [a, 0], [1, -0.6]).pt(n2, [0, b], [-1, 0.6]);
      fig.poly([n1, n2, n3]);
      fig.polyXY([[0, 0], [s, 0], [s, s], [0, s]], true);
      fig.seg(n3, n1, `$${a}$`).seg(n3, n2, `$${b}$`);
      stem = `In the figure, triangle $${n1}${n2}${n3}$ has a right angle at $${n3}$, with $${n3}${n1} = ${a}$ and $${n3}${n2} = ${b}$. A square has one vertex at $${n3}$, two sides along the legs, and the opposite vertex on the hypotenuse. What is ${what}?`;
      steps = `Let the side be $s$. The small triangle above the square has legs $${b} - s$ and $s$ and is similar to the whole triangle (same angles), so $\\frac{${b} - s}{${b}} = \\frac{s}{${a}}$. Then $${a}(${b} - s) = ${b}s$, so $s = \\frac{${a} \\cdot ${b}}{${a} + ${b}} = ${decimal(sv)}$.`;
    } else {
      const half = a / 2;
      fig.pt(n1, [0, 0], [-1, -0.6]).pt(n2, [a, 0], [1, -0.6]).pt(n3, [half, hgt], [0, 1]);
      fig.poly([n1, n2, n3]);
      const x0 = half - s / 2;
      fig.polyXY([[x0, 0], [x0 + s, 0], [x0 + s, s], [x0, s]], true);
      fig.seg(n1, n2, `$${a}$`).seg(n1, n3, `$${L}$`).seg(n2, n3, `$${L}$`);
      stem = `In the figure, triangle $${n1}${n2}${n3}$ is isosceles with $${n1}${n3} = ${n2}${n3} = ${L}$ and $${n1}${n2} = ${a}$. A square rests on $${n1}${n2}$ with its two upper vertices on the other two sides. What is ${what}?`;
      steps = `First find the height from $${n3}$: $\\sqrt{${L}^2 - ${a / 2}^2} = ${hgt}$. Above the square sits a smaller triangle similar to the whole, with base equal to the square's side $s$ and height $${hgt} - s$: $\\frac{s}{${a}} = \\frac{${hgt} - s}{${hgt}}$. Then $s = \\frac{${a} \\cdot ${hgt}}{${a} + ${hgt}} = ${decimal(sv)}$.`;
    }
    const final = ask === 'side' ? '' : ask === 'area' ? ` The area is $${decimal(sv)}^2 = ${decimal(answer)}$.` : ` The perimeter is $4 \\cdot ${decimal(sv)} = ${decimal(answer)}$.`;
    const notes = trapNotes(
      choices,
      {
        'geo-sim-sq-altitude': (vs) => `${vs} is the altitude to the hypotenuse, a different segment`,
        'geo-sim-sq-harmonic': (vs) => `${vs} comes from doubling the side, as if the square used the vertex twice`,
        'geo-sim-sq-half-leg': (vs) => `${vs} halves the shorter leg, but the hypotenuse does not cross either leg at its midpoint`,
        'geo-sim-sq-side-for-area': (vs) => `${vs} is only the side of the square`,
        'geo-sim-sq-slant-for-height': (vs) => `${vs} uses the slanted side where the height belongs`,
        'geo-sim-sq-arith-mean': (vs) => `${vs} averages two lengths, but the square is shorter than both`,
        'geo-sim-sq-other-ask': (vs) => `${vs} answers a different measure of the square`,
      },
      2,
    );
    return {
      params: { kind, a, b: kind === 'corner' ? b : 0, L, ask, names: [n1, n2, n3] },
      q: {
        format: 'mcs',
        stem,
        figure: fig.build(false),
        choices,
        answer: ans,
        explanation: `Recognize: a square pressed into a triangle leaves a smaller triangle above it, similar to the big one, because the top of the square is parallel to the base.

${steps}${final}

Check: $s$ is shorter than both lengths, as it must be.

${notes}

Rule: write "the small triangle is similar to the whole" as a proportion of a base over its height, and solve for the side.`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'format';
    // bisection on the side of the largest square that fits
    let base: number;
    let height: number;
    let top: (s: number) => number; // width of the triangle at height s
    if (p.kind === 'corner') {
      base = p.a;
      height = p.b;
      top = (s) => p.a * (1 - s / p.b);
    } else {
      base = p.a;
      height = Math.sqrt(p.L * p.L - (p.a / 2) * (p.a / 2));
      top = (s) => p.a * (1 - s / height);
    }
    let lo = 0;
    let hi = Math.min(base, height);
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (top(mid) >= mid) lo = mid;
      else hi = mid;
    }
    const exp = p.ask === 'side' ? lo : p.ask === 'area' ? lo * lo : 4 * lo;
    const got = Number(q.choices[q.answer].text.replace(/[$,{}]/g, ''));
    return Math.abs(got - exp) < 1e-6 ? null : `expected ${exp}`;
  },
};

export const squareInTriangleTemplates = retryAll([squareInTriangle]);
