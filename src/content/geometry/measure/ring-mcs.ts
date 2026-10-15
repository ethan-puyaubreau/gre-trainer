import { numericChoices } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { Choice, Template, Trap } from '../../../engine/types';
import { checkChoiceValue, Ex, exChoices, type ExData, unitCircle } from './ex';
import { Fig } from './fig';
import { trapNotes } from '../notes';
import { Redraw, retryAll } from '../redraw';

/* Two concentric circles and a chord of the larger one tangent to the smaller: ring area, inner radius or chord (MCS). */

export const ringTraps: Record<string, Trap> = {
  'geom-ring-outer-disc': {
    label: 'Gave the area of the whole outer disc',
    fix: 'The region between the circles is the outer disc minus the inner disc. Subtract the inner circle before you answer.',
  },
  'geom-ring-width-squared': {
    label: 'Squared the width of the ring (R - r) and multiplied by pi',
    fix: 'The area of a ring is $\\pi R^2 - \\pi r^2 = \\pi(R^2 - r^2)$, not $\\pi(R - r)^2$. Squaring a difference is not the difference of squares.',
  },
  'geom-ring-chord-radius': {
    label: 'Used the whole chord as a radius',
    fix: 'The tangent chord is cut in two equal halves by the radius to the point of tangency. Half of it is a leg of a right triangle with hypotenuse $R$ and other leg $r$.',
  },
  'geom-ring-added': {
    label: 'Added the two disc areas instead of subtracting them',
    fix: 'The ring is what is left of the big disc when the small one is removed, so subtract: $\\pi R^2 - \\pi r^2$.',
  },
  'geom-ring-inner-disc': {
    label: 'Gave the area of the inner disc',
    fix: 'The inner disc is the hole. The ring is the part of the outer disc that is not in the hole.',
  },
  'geom-ring-not-squared': {
    label: 'Forgot to square the half-chord',
    fix: 'An area has squared lengths: $\\pi(R^2 - r^2) = \\pi h^2$, with $h$ the half-chord.',
  },
  'geom-ring-subtract-half': {
    label: 'Subtracted half of the chord from the outer radius',
    fix: 'Radii and half-chords do not subtract along a line: they are the sides of a right triangle with hypotenuse $R$. Use $r = \\sqrt{R^2 - h^2}$ for the half-chord $h$.',
  },
  'geom-ring-half-chord': {
    label: 'Gave half of the chord as if it were the radius',
    fix: 'Half of the chord is the leg $h$ of the right triangle. The inner radius is the other leg and the outer radius is the hypotenuse.',
  },
  'geom-ring-no-root': {
    label: 'Stopped before taking the square root',
    fix: 'The Pythagorean relation gives a square: $R^2 - h^2 = r^2$. The length is its square root.',
  },
  'geom-ring-width': {
    label: 'Gave the width of the ring, R - r, instead of the asked length',
    fix: 'Read what is asked: the inner radius and the width of the ring are different lengths. Find $r$ from the right triangle first.',
  },
  'geom-ring-outer-radius': {
    label: 'Gave the outer radius instead of the inner radius',
    fix: 'The outer radius is the hypotenuse of the right triangle. The inner radius is one of its legs, so it is shorter.',
  },
  'geom-ring-inner-diameter': {
    label: 'Gave the diameter of the small circle as the chord',
    fix: 'The chord touches the small circle at one point and runs on both sides of the point of tangency; its length comes from the right triangle, not from the small circle itself.',
  },
  'geom-ring-diameter-chord': {
    label: 'Gave the diameter of the outer circle as the tangent chord',
    fix: 'The diameter is the longest chord and passes through the center. A chord tangent to the inner circle stays at distance $r$ from the center, so it is shorter than $2R$.',
  },
  'geom-ring-width-chord': {
    label: 'Doubled the width of the ring to get the chord',
    fix: 'The chord is not twice the ring width. Its half is the leg $\\sqrt{R^2 - r^2}$ of the right triangle.',
  },
};

type Ask = 'area' | 'inner' | 'chord';
interface Params {
  ask: Ask;
  r: number;
  h: number;
  R: number;
  vals: number[];
  exVals: ExData[];
}

const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
const PRIMITIVE: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [12, 35, 37], [9, 40, 41]];
/** Right triangles with whole sides (and their multiples) whose hypotenuse is at most maxR. */
const triples = (maxR: number) => PRIMITIVE.flatMap(([a, b, c]) => Array.from({ length: Math.floor(maxR / c) }, (_, i) => [a * (i + 1), b * (i + 1), c * (i + 1)] as [number, number, number]));

const ring: Template<Params> = {
  id: 'geo.composite.ring',
  skill: 'geo.composite',
  format: 'mcs',
  style: 'concentric circles with a tangent chord: ring area, inner radius or chord length',
  generate(rng, dif) {
    const ask: Ask = dif === 1 ? 'area' : dif === 2 ? 'inner' : 'chord';
    const [p, q2, hyp] = rng.pick(triples(65));
    const swapLegs = rng.chance(0.5);
    const r = swapLegs ? p : q2;
    const h = swapLegs ? q2 : p;
    const R = hyp;
    const c = 2 * h;
    const story = rng.pick(['circles', 'washer', 'pipe'] as const);
    const outer = story === 'circles' ? 'the larger circle' : story === 'washer' ? 'the outer circle of the washer' : 'the outer circle of the pipe';
    const inner = story === 'circles' ? 'the smaller circle' : story === 'washer' ? 'the hole of the washer' : 'the circular bore';
    const pair = story === 'circles' ? 'Two circles have the same center.' : story === 'pipe' ? 'The cross section of a hollow pipe is bounded by an outer circle and the circle of the bore, with the same center.' : 'A flat metal washer is bounded by an outer circle and the circle of a round hole, with the same center.';
    const tangent = `A chord of ${outer} is tangent to ${inner}`;
    const fig = new Fig();
    fig.pt('O', [0, 0], [0, -0.8]).pt('A', [-h, r], [-0.8, 0.5]).pt('B', [h, r], [0.8, 0.5]).pt('M', [0, r], [0, 0.8]);
    fig.circle('O', R).circle('O', r);
    fig.seg('A', 'B', ask === 'chord' ? undefined : `$${c}$`);
    fig.seg('O', 'M', ask === 'inner' ? undefined : `$${r}$`);
    fig.seg('O', 'B', ask === 'area' ? undefined : `$${R}$`, true);
    fig.right('O', 'M', 'B');
    let stem: string;
    let choices: Choice[];
    let answer: number;
    let values: ExData[] = [];
    let vals: number[] = [];
    let explanation: string;
    if (ask === 'area') {
      const f = (k: number) => Ex.pi(k);
      stem = `${pair} ${cap(inner)} has radius ${r}. ${tangent} and has length ${c}. What is the area of ${story === 'circles' ? 'the region between the two circles' : story === 'pipe' ? 'the cross section of the pipe wall' : 'the metal face of the washer'}?`;
      const built = exChoices(
        rng,
        f(h * h),
        [
          { v: f(R * R), trap: 'geom-ring-outer-disc' },
          { v: f((R - r) ** 2), trap: 'geom-ring-width-squared' },
          { v: f(c * c), trap: 'geom-ring-chord-radius' },
          { v: f(R * R + r * r), trap: 'geom-ring-added' },
          { v: f(r * r), trap: 'geom-ring-inner-disc' },
          { v: f(h), trap: 'geom-ring-not-squared' },
        ],
        [],
        { scales: false },
      );
      choices = built.choices;
      answer = built.answer;
      values = built.values;
      vals = values.map((v) => Ex.from(v).value());
      const notes = trapNotes(
        choices,
        {
          'geom-ring-outer-disc': (v) => `${v} is the whole outer disc, with the hole not removed`,
          'geom-ring-width-squared': (v) => `${v} squares the width $R - r$, which is not the difference of the two disc areas`,
          'geom-ring-chord-radius': (v) => `${v} treats the whole chord as a radius`,
          'geom-ring-added': (v) => `${v} adds the discs`,
          'geom-ring-inner-disc': (v) => `${v} is only the hole`,
          'geom-ring-not-squared': (v) => `${v} forgets to square the half-chord`,
        },
        3,
      );
      explanation = `The chord is tangent to the small circle, so the radius to the point of tangency is perpendicular to it and cuts it in half. That gives a right triangle: legs $r = ${r}$ and half the chord $\\frac{${c}}{2} = ${h}$, hypotenuse $R$ (a radius of the large circle).

The ring has area $\\pi R^2 - \\pi r^2 = \\pi(R^2 - r^2)$, and $R^2 - r^2$ is exactly the square of the other leg: $${h}^2 = ${num(h * h)}$. So the area is $${num(h * h)}\\pi$, without ever finding $R$.

Check: $R = ${R}$, and $${R}^2 - ${r}^2 = ${num(R * R - r * r)}$.

${notes}

Rule: for a tangent chord of length $c$, the ring has area $\\pi \\left(\\frac{c}{2}\\right)^2$.`;
    } else if (ask === 'inner') {
      stem = `${pair} ${cap(outer)} has radius ${R}. ${tangent} and has length ${c}. What is the radius of ${inner}?`;
      const built = numericChoices(rng, {
        correct: r,
        traps: [
          { value: R - h, trap: 'geom-ring-subtract-half' },
          { value: h, trap: 'geom-ring-half-chord' },
          { value: r * r, trap: 'geom-ring-no-root' },
          { value: R - r, trap: 'geom-ring-width' },
          { value: R, trap: 'geom-ring-outer-radius' },
          { value: c, trap: 'geom-ring-chord-radius' },
        ],
        fillers: [h + r, R + h],
        format: (v: Frac) => `$${num(v)}$`,
      });
      if (built.choices.filter((x) => x.trap).length < 3) throw new Redraw('fewer than three named traps');
      choices = built.choices;
      answer = built.answer;
      vals = choices.map((x) => Number(x.text.replace(/[^0-9.]/g, '')));
      const notes = trapNotes(
        choices,
        {
          'geom-ring-subtract-half': (v) => `${v} subtracts half the chord from the radius`,
          'geom-ring-half-chord': (v) => `${v} is only half of the chord`,
          'geom-ring-no-root': (v) => `${v} is $r^2$, before the square root`,
          'geom-ring-width': (v) => `${v} is the width of the ring`,
          'geom-ring-outer-radius': (v) => `${v} is the outer radius, the hypotenuse`,
          'geom-ring-chord-radius': (v) => `${v} is the whole chord`,
        },
        2,
      );
      explanation = `The radius to the point of tangency is perpendicular to the chord and bisects it, so half the chord is $\\frac{${c}}{2} = ${h}$. The right triangle has hypotenuse $R = ${R}$ (from the center to an end of the chord), one leg $${h}$, and the other leg $r$.

$r^2 = ${R}^2 - ${h}^2 = ${num(R * R - h * h)}$, so $r = ${r}$.

Check: $${r}^2 + ${h}^2 = ${num(r * r + h * h)} = ${R}^2$.

${notes}

Rule: radius, half-chord and distance to the center form a right triangle with the radius as hypotenuse.`;
    } else {
      stem = `${pair} The circumference of ${outer} is $${2 * R}\\pi$, and ${inner} has radius ${r}. ${tangent}. What is the length of the chord?`;
      const built = numericChoices(rng, {
        correct: c,
        traps: [
          { value: 2 * R, trap: 'geom-ring-diameter-chord' },
          { value: h, trap: 'geom-ring-half-chord' },
          { value: 2 * (R - r), trap: 'geom-ring-width-chord' },
          { value: h * h, trap: 'geom-ring-no-root' },
          { value: 2 * r, trap: 'geom-ring-inner-diameter' },
        ],
        fillers: [R + r, r + h],
        format: (v: Frac) => `$${num(v)}$`,
      });
      if (built.choices.filter((x) => x.trap).length < 3) throw new Redraw('fewer than three named traps');
      choices = built.choices;
      answer = built.answer;
      vals = choices.map((x) => Number(x.text.replace(/[^0-9.]/g, '')));
      const notes = trapNotes(
        choices,
        {
          'geom-ring-diameter-chord': (v) => `${v} is the diameter of the outer circle, the longest chord`,
          'geom-ring-half-chord': (v) => `${v} is only half of the chord`,
          'geom-ring-width-chord': (v) => `${v} doubles the width of the ring`,
          'geom-ring-no-root': (v) => `${v} stops before the square root`,
          'geom-ring-inner-diameter': (v) => `${v} is the diameter of the small circle`,
        },
        2,
      );
      explanation = `A circumference $2\\pi R = ${2 * R}\\pi$ gives $R = ${R}$. The radius to the point of tangency is perpendicular to the chord and bisects it, so half the chord $h$ is a leg of a right triangle with hypotenuse $${R}$ and other leg $${r}$.

$h^2 = ${R}^2 - ${r}^2 = ${num(R * R - r * r)}$, so $h = ${h}$ and the chord is $2h = ${c}$.

Check: $${r}^2 + ${h}^2 = ${num(r * r + h * h)} = ${R}^2$.

${notes}

Rule: chord $= 2\\sqrt{R^2 - r^2}$ when it is tangent to the circle of radius $r$.`;
    }
    return { params: { ask, r, h, R, vals, exVals: values }, q: { format: 'mcs', stem, figure: fig.build(false), choices, answer, explanation } };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'format';
    let target: number;
    if (p.ask === 'area') {
      // chord at distance r from the center of a circle of radius R: build the circle from the chord end (h, r)
      const R = Math.hypot(p.h, p.r);
      target = unitCircle().area * (R * R - p.r * p.r);
      return checkChoiceValue(p.exVals, q.answer, target);
    }
    if (p.ask === 'inner') {
      // find the distance t from the center at which a chord of the circle of radius R has length 2h
      let lo = 0;
      let hi = p.R;
      for (let i = 0; i < 200; i++) {
        const t = (lo + hi) / 2;
        if (2 * Math.sqrt(p.R * p.R - t * t) > 2 * p.h) lo = t;
        else hi = t;
      }
      target = lo;
    } else {
      const R = (2 * Math.PI * p.R) / (2 * Math.PI); // circumference divided by 2 pi
      target = 2 * Math.sqrt(R * R - p.r * p.r);
    }
    const hits = p.vals.flatMap((v, i) => (Math.abs(v - target) < 1e-6 ? [i] : []));
    return hits.length === 1 && hits[0] === q.answer ? null : `expected ${target}, matches ${hits}`;
  },
};

export const ringTemplates = retryAll([ring]);
