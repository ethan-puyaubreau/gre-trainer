import type { Template, Trap } from '../../../engine/types';
import { num } from '../../../engine/tex';
import { trapNotes } from '../notes';
import { Redraw, retryAll } from '../redraw';
import { mixed } from './apex-parallel';
import { FigBuilder } from './fig';
import { checkMcs, intChoices } from './util';

/* A ladder slides down a wall: the same hypotenuse in two right triangles (MCS). */

export const ladderTraps: Record<string, Trap> = {
  'geo-lad-same-slide': {
    label: 'Assumed the top slides as far as the foot moves out',
    fix: 'The ladder keeps its length, not its height: the two legs change by different amounts. Compute the height before and after, then subtract.',
  },
  'geo-lad-new-height': {
    label: 'Gave the new height instead of the change in height',
    fix: 'The question asks how far the top slides, which is the old height minus the new height.',
  },
  'geo-lad-old-height': {
    label: 'Gave the starting height instead of the change',
    fix: 'The starting height is only the first step. Find the second height and take the difference.',
  },
  'geo-lad-new-foot': {
    label: 'Gave the final distance of the foot from the wall',
    fix: 'The question asks how far the foot moved: subtract its starting distance from its final distance.',
  },
  'geo-lad-old-foot': {
    label: 'Gave the starting distance of the foot from the wall',
    fix: 'That is where the foot started. Find where it ends and subtract.',
  },
  'geo-lad-slide-as-leg': {
    label: 'Gave the height as the length of the ladder',
    fix: 'The ladder is the hypotenuse, the longest side. It is longer than the height at which it touches the wall.',
  },
  'geo-lad-sum-legs': {
    label: 'Added the two legs to get the ladder',
    fix: 'The ladder is the hypotenuse: $L = \\sqrt{h^2 + b^2}$, not $h + b$.',
  },
};

interface P {
  kind: 'drop' | 'out' | 'length';
  L?: number;
  h1?: number;
  h2?: number;
  b1?: number;
  b2?: number;
  values: number[];
}

/** Every (height, foot) with height^2 + foot^2 = L^2, both whole and positive. */
function legs(L: number): [number, number][] {
  const out: [number, number][] = [];
  for (let h = 1; h < L; h++) {
    const b = Math.round(Math.sqrt(L * L - h * h));
    if (b >= 1 && h * h + b * b === L * L) out.push([h, b]);
  }
  return out;
}
const LENGTHS = Array.from({ length: 126 }, (_, i) => i + 5).filter((L) => legs(L).length >= 2);

const SMALL = [
  { thing: 'ladder', wall: 'vertical wall', top: 'top of the ladder' },
  { thing: 'pole', wall: 'vertical fence', top: 'top of the pole' },
];
const LARGE = [
  { thing: 'rod', wall: 'vertical wall', top: 'top end of the rod' },
  { thing: 'plank', wall: 'vertical wall', top: 'top end of the plank' },
];

const ladder: Template<P> = {
  id: 'geo.right-triangles.ladder-mcs',
  skill: 'geo.right-triangles',
  format: 'mcs',
  style: 'a ladder against a wall: same length, two right triangles (slide down, foot out, or length)',
  generate(rng, d) {
    const L = rng.pick(LENGTHS);
    const pairs = legs(L);
    const [first, second] = rng.shuffle(pairs).slice(0, 2);
    const [[h1, b1], [h2, b2]] = first[0] > second[0] ? [first, second] : [second, first];
    if (h1 === h2 || [h1, h2, b1, b2, h1 - h2, b2 - b1].includes(1)) throw new Redraw('a length of 1');
    const s = h1 - h2;
    const e = b2 - b1;
    const w = rng.pick(L <= 40 ? SMALL : LARGE);
    const u = L <= 40 ? 'feet' : 'centimeters';
    const W: [number, number] = [0, 0];
    const k = 5 / L;
    const fb = new FigBuilder().pt('W', W).pt('P', [0, h1 * k]).pt('Q', [b1 * k, 0]).pt('R', [0, h2 * k]).pt('S', [b2 * k, 0]);
    fb.seg('W', 'P').seg('W', 'S').seg('P', 'Q').seg('R', 'S', undefined, true).right('P', 'W', 'S');
    const figure = fb.build();
    const intro = `A ${w.thing} leans against a ${w.wall} on level ground. In the figure above, $\\overline{PQ}$ is its first position and $\\overline{RS}$ its second.`;
    const unit = (v: { n: number }) => `$${num(v.n)}$`;
    if (d === 1) {
      const { choices, answer, values } = mixed(rng, intChoices(
        rng,
        s,
        [
          { value: e, trap: 'geo-lad-same-slide' },
          { value: h2, trap: 'geo-lad-new-height' },
          { value: h1, trap: 'geo-lad-old-height' },
        ],
        [Math.round(s * 1.5), Math.max(1, Math.round(s / 2)), s * 2, s + 7],
        unit,
        1,
      ));
      const explanation = `Recognize: wall, ground and ${w.thing} make a right triangle with the ${w.thing} as hypotenuse, and its length ${L} does not change.

First position: height $\\sqrt{${L}^2 - ${b1}^2} = ${h1}$. Second position: height $\\sqrt{${L}^2 - ${b2}^2} = ${h2}$. The top slides $${h1} - ${h2} = ${s}$ ${u}.

Check: $${h2}^2 + ${b2}^2 = ${h2 * h2 + b2 * b2} = ${L}^2$.

${trapNotes(choices, { 'geo-lad-same-slide': (v) => `${v} is how far the foot moves, but the legs change by different amounts`, 'geo-lad-new-height': (v) => `${v} is the final height, not the change`, 'geo-lad-old-height': (v) => `${v} is the starting height` }, 2)}

Rule: keep the hypotenuse, find each leg, then subtract.`;
      return {
        params: { kind: 'drop', L, h1, h2, b1, b2, values },
        q: {
          format: 'mcs',
          stem: `${intro} The ${w.thing} is $${L}$ ${u} long. Its foot starts $${b1}$ ${u} from the wall and is pulled out to $${b2}$ ${u} from the wall. How many ${u} does the ${w.top} slide down the wall?`,
          figure,
          choices,
          answer,
          explanation,
        },
      };
    }
    if (d === 2) {
      const { choices, answer, values } = mixed(rng, intChoices(
        rng,
        e,
        [
          { value: s, trap: 'geo-lad-same-slide' },
          { value: b2, trap: 'geo-lad-new-foot' },
          { value: b1, trap: 'geo-lad-old-foot' },
        ],
        [Math.round(e * 1.5), Math.max(1, Math.round(e / 2)), e * 2, e + 7],
        unit,
        1,
      ));
      const explanation = `Recognize: the ${w.thing} is the hypotenuse of a right triangle in both positions, and its length $${L}$ stays the same.

The foot starts at $\\sqrt{${L}^2 - ${h1}^2} = ${b1}$ ${u} from the wall. At the second position the top is $${h2}$ ${u} up, so the foot is $\\sqrt{${L}^2 - ${h2}^2} = ${b2}$ ${u} out. It moved $${b2} - ${b1} = ${e}$ ${u}.

Check: $${b1}^2 + ${h1}^2 = ${b1 * b1 + h1 * h1} = ${L}^2$.

${trapNotes(choices, { 'geo-lad-same-slide': (v) => `${v} is how far the top slid, which is not the foot's move`, 'geo-lad-new-foot': (v) => `${v} is where the foot ends, not how far it moved`, 'geo-lad-old-foot': (v) => `${v} is where the foot started` }, 2)}

Rule: find both positions of the foot, then subtract.`;
      return {
        params: { kind: 'out', L, h1, h2, b1, b2, values },
        q: {
          format: 'mcs',
          stem: `${intro} The ${w.thing} is $${L}$ ${u} long. Its top starts $${h1}$ ${u} up the wall and slides down to $${h2}$ ${u} up the wall. How many ${u} does the foot of the ${w.thing} move away from the wall?`,
          figure,
          choices,
          answer,
          explanation,
        },
      };
    }
    // d3: the length is unknown
    const { choices, answer, values } = mixed(rng, intChoices(
      rng,
      L,
      [
        { value: h1, trap: 'geo-lad-slide-as-leg' },
        { value: h1 + b1, trap: 'geo-lad-sum-legs' },
        { value: b2, trap: 'geo-lad-new-foot' },
        { value: h2, trap: 'geo-lad-new-height' },
      ],
      [Math.round(L * 1.25), Math.round(L * 0.75), L * 2],
      unit,
      1,
    ));
    const explanation = `Recognize: the ${w.thing} has the same length in both positions, so the two right triangles share the hypotenuse.

Let the starting height be $h$. Then $h^2 + ${b1}^2 = (h - ${s})^2 + ${b2}^2$. Expanding, $${b1 * b1} = ${s * s} - ${2 * s}h + ${b2 * b2}$, so $${2 * s}h = ${b2 * b2 + s * s - b1 * b1}$ and $h = ${h1}$. The length is $\\sqrt{${h1}^2 + ${b1}^2} = ${L}$ ${u}.

Check: $(${h1} - ${s})^2 + ${b2}^2 = ${h2 * h2 + b2 * b2} = ${L}^2$.

${trapNotes(choices, { 'geo-lad-slide-as-leg': (v) => `${v} is the starting height, a leg`, 'geo-lad-sum-legs': (v) => `${v} adds the legs instead of using the Pythagorean theorem` }, 2)}

Rule: equal hypotenuses give an equation in the unknown leg.`;
    return {
      params: { kind: 'length', b1, b2, h1, h2, values },
      q: {
        format: 'mcs',
        stem: `${intro} The foot starts $${b1}$ ${u} from the wall, and when it is pulled out by $${e}$ ${u} more, the ${w.top} slides down $${s}$ ${u}. How many ${u} long is the ${w.thing}?`,
        figure,
        choices,
        answer,
        explanation,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'format';
    let target: number;
    if (p.kind === 'drop' || p.kind === 'out') {
      // search the whole-number leg that fits each position of the ladder
      const find = (given: number) => {
        const hits: number[] = [];
        for (let v = 1; v < p.L!; v++) if (v * v + given * given === p.L! * p.L!) hits.push(v);
        return hits.length === 1 ? hits[0] : NaN;
      };
      if (p.kind === 'drop') target = find(p.b1!) - find(p.b2!);
      else target = find(p.h2!) - find(p.h1!);
    } else {
      const s = p.h1! - p.h2!;
      const hits: number[] = [];
      for (let h = s + 1; h < 600; h++) {
        if ((h - s) ** 2 + p.b2! ** 2 !== h * h + p.b1! ** 2) continue;
        const L2 = h * h + p.b1! ** 2;
        const L = Math.round(Math.sqrt(L2));
        if (L * L === L2) hits.push(L);
      }
      if (hits.length !== 1) return `${hits.length} lengths fit`;
      target = hits[0];
    }
    return checkMcs(q.answer, p.values, target);
  },
};

export const ladderTemplates = retryAll([ladder]);
