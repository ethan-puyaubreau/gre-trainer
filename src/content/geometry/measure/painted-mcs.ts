import { numericChoices } from '../../../engine/build';
import type { Frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { Choice, Template, Trap } from '../../../engine/types';
import { drawBox, Fig } from './fig';
import { trapNotes } from '../notes';
import { Redraw, retryAll } from '../redraw';

/* A painted solid cut into unit cubes: how many cubes have 0, 1, 2 or at least 1 painted face (MCS). */

export const paintedTraps: Record<string, Trap> = {
  'geom-paint-trim-one': {
    label: 'Removed one layer per dimension instead of two',
    fix: 'Every dimension loses a layer at BOTH ends, so an edge of $n$ small cubes has only $n - 2$ cubes that are not corners. Use $n - 2$, not $n - 1$.',
  },
  'geom-paint-half-count': {
    label: 'Counted only half of the faces or edges (or one layer of the hidden block)',
    fix: 'A cube has 6 faces and 12 edges, so double the 3 faces or 6 edges you can see. For the hidden block, use all three dimensions.',
  },
  'geom-paint-whole-solid': {
    label: 'Counted all the small cubes',
    fix: 'The cubes with no paint are the ones hidden inside, away from every face. Remove the outer layer on all six sides first.',
  },
  'geom-paint-surface-squares': {
    label: 'Counted painted squares (surface area) instead of cubes with exactly one painted face',
    fix: 'The cubes on an edge or at a corner show several painted squares, but they are not cubes with exactly one painted face. Use only the central block of each face, $(d - 2)(d\' - 2)$.',
  },
  'geom-paint-edge-full': {
    label: 'Used the whole length of each edge, corners included',
    fix: 'The two cubes at the ends of an edge are corners, with three painted faces. Only the $n - 2$ cubes between them have exactly two.',
  },
  'geom-paint-corners-added': {
    label: 'Added the 8 corner cubes to the cubes with exactly two painted faces',
    fix: 'A corner cube has three painted faces, so it is not counted when the question asks for exactly two.',
  },
  'geom-paint-corners-missed': {
    label: 'Left out the 8 corner cubes from "at least one painted face"',
    fix: 'Corner cubes have three painted faces, which is at least one. Add the 8 corners to the cubes with one or two painted faces, or subtract the hidden cubes from the total.',
  },
  'geom-paint-wrong-class': {
    label: 'Answered for a different kind of cube (a different number of painted faces)',
    fix: 'Reread the question: no paint, exactly one, exactly two, or at least one face are four different counts.',
  },
  'geom-paint-forgot-layer': {
    label: 'Took the hidden block for the whole cube',
    fix: 'The cubes with no paint form a smaller cube. The whole cube is two units longer on each edge than that block, because of the two outer layers.',
  },
};

type Ask = 'zero' | 'one' | 'two' | 'any';
type Dims = [number, number, number];
interface Params {
  dims: Dims;
  ask: Ask;
  vals: number[];
  hidden: number;
}

/** Formulas with a layer trimmed by t on each dimension: t = 2 is the right count. */
const zero = ([a, b, c]: Dims, t: number) => (a - t) * (b - t) * (c - t);
const one = ([a, b, c]: Dims, t: number) => 2 * ((a - t) * (b - t) + (a - t) * (c - t) + (b - t) * (c - t));
const two = ([a, b, c]: Dims, t: number) => 4 * (a - t + (b - t) + (c - t));
const any = (d: Dims) => d[0] * d[1] * d[2] - zero(d, 2);
const count = (ask: Ask, d: Dims, t = 2) => (ask === 'zero' ? zero(d, t) : ask === 'one' ? one(d, t) : ask === 'two' ? two(d, t) : d[0] * d[1] * d[2] - zero(d, t));

const ASK_TEXT: Record<Ask, string> = {
  zero: 'have no painted face',
  one: 'have exactly one painted face',
  two: 'have exactly two painted faces',
  any: 'have at least one painted face',
};
const units = (u: string) => (u === 'inch' ? 'inches' : `${u}s`);
const STORY = [
  { solid: 'wooden', paint: 'painted red on all of its faces', unit: 'centimeter' },
  { solid: 'cheese', paint: 'coated with wax on its whole surface', unit: 'centimeter' },
  { solid: 'foam', paint: 'dipped in blue dye so that every outer face is colored', unit: 'inch' },
  { solid: 'clay', paint: 'painted green on every face', unit: 'inch' },
] as const;

const painted: Template<Params> = {
  id: 'geo.solids.painted-cubes',
  skill: 'geo.solids',
  format: 'mcs',
  style: 'painted solid cut into unit cubes: cubes with no, one, two or at least one painted face',
  generate(rng, dif) {
    const story = rng.pick(STORY);
    const ask: Ask = rng.pick(dif === 1 ? (['zero', 'one', 'two'] as const) : dif === 2 ? (['zero', 'one', 'two', 'any'] as const) : (['one', 'two', 'any'] as const));
    let dims: Dims;
    let stem: string;
    const fig = new Fig();
    const first = `A solid ${story.solid} ${dif === 3 ? 'cube' : 'block'} is ${story.paint}, and then it is cut into cubes with edge 1 ${story.unit}.`;
    let forgot: number | null = null;
    if (dif === 1) {
      const n = rng.int(3, 12);
      dims = [n, n, n];
      stem = `A solid ${story.solid} cube with edge ${n} ${units(story.unit)} is ${story.paint}, and then it is cut into cubes with edge 1 ${story.unit}. How many of the small cubes ${ASK_TEXT[ask]}?`;
      drawBox(fig, n, n, n, { L: `$${n}$`, W: `$${n}$`, H: `$${n}$` });
    } else if (dif === 2) {
      const a = rng.int(3, 9);
      const b = rng.int(3, 9);
      const c = rng.int(3, 9);
      if (a === b && b === c) throw new Redraw('cube');
      dims = [a, b, c];
      stem = `A solid ${story.solid} block measuring ${a} by ${b} by ${c} ${units(story.unit)} is ${story.paint}, and then it is cut into cubes with edge 1 ${story.unit}. How many of the small cubes ${ASK_TEXT[ask]}?`;
      drawBox(fig, a, b, c, { L: `$${a}$`, W: `$${b}$`, H: `$${c}$` });
    } else {
      const k = rng.int(2, 12);
      const n = k + 2;
      dims = [n, n, n];
      forgot = k;
      stem = `${first} Exactly ${num(k ** 3)} of the small cubes have no painted face. How many of the small cubes ${ASK_TEXT[ask]}?`;
    }
    const realAsk: Ask = ask;
    const correct = count(realAsk, dims);
    const [a, b, c] = dims;
    const traps: { value: number; trap: string }[] = [{ value: count(realAsk, dims, 1), trap: 'geom-paint-trim-one' }];
    if (realAsk === 'zero') traps.push({ value: a * b * c, trap: 'geom-paint-whole-solid' }, { value: one(dims, 2), trap: 'geom-paint-wrong-class' }, { value: two(dims, 2), trap: 'geom-paint-wrong-class' });
    if (realAsk === 'one') traps.push({ value: one(dims, 0), trap: 'geom-paint-surface-squares' }, { value: any(dims), trap: 'geom-paint-wrong-class' }, { value: two(dims, 2), trap: 'geom-paint-wrong-class' });
    if (realAsk === 'two') traps.push({ value: two(dims, 0), trap: 'geom-paint-edge-full' }, { value: two(dims, 2) + 8, trap: 'geom-paint-corners-added' }, { value: one(dims, 2), trap: 'geom-paint-wrong-class' });
    if (realAsk === 'any') traps.push({ value: one(dims, 2) + two(dims, 2), trap: 'geom-paint-corners-missed' }, { value: one(dims, 0), trap: 'geom-paint-surface-squares' }, { value: zero(dims, 2), trap: 'geom-paint-wrong-class' });
    const halfCount = realAsk === 'zero' ? (a - 2) * (b - 2) : realAsk === 'one' ? one(dims, 2) / 2 : realAsk === 'two' ? two(dims, 2) / 2 : 0;
    traps.push({ value: halfCount, trap: 'geom-paint-half-count' });
    if (forgot !== null) traps.push({ value: count(realAsk, [forgot, forgot, forgot]), trap: 'geom-paint-forgot-layer' });
    const built = numericChoices(rng, {
      correct,
      traps: traps.filter((t) => t.value > 0 && t.value !== correct),
      fillers: [],
      format: (v: Frac) => `$${num(v)}$`,
      step: Math.max(1, Math.round(correct / 20)),
    });
    if (built.choices.filter((x) => x.trap).length < 3) throw new Redraw('fewer than three named traps');
    const choices: Choice[] = built.choices;
    const vals = choices.map((x) => Number(x.text.replace(/[^0-9]/g, '')));
    const t2 = (d: number) => d - 2;
    const calc =
      realAsk === 'zero'
        ? `${t2(a)} \\cdot ${t2(b)} \\cdot ${t2(c)} = ${num(correct)}`
        : realAsk === 'one'
          ? `2(${t2(a)} \\cdot ${t2(b)} + ${t2(a)} \\cdot ${t2(c)} + ${t2(b)} \\cdot ${t2(c)}) = ${num(correct)}`
          : realAsk === 'two'
            ? `4(${t2(a)} + ${t2(b)} + ${t2(c)}) = ${num(correct)}`
            : `${num(a * b * c)} - ${num(zero(dims, 2))} = ${num(correct)}`;
    const how =
      realAsk === 'zero'
        ? 'The cubes with no paint are the ones hidden inside: remove the outer layer on both ends of each dimension, so each length drops by 2.'
        : realAsk === 'one'
          ? 'A cube with exactly one painted face lies in the middle of a face, away from its edges. Each face has a central block of $(d - 2)(d\' - 2)$ cubes, and there are 3 pairs of opposite faces.'
          : realAsk === 'two'
            ? 'A cube with exactly two painted faces lies on an edge but is not a corner. Each of the 12 edges has its length minus the 2 corner cubes, and the 12 edges come in 4 of each dimension.'
            : 'Every cube is either hidden inside or touches at least one painted face, so subtract the hidden block from all the cubes.';
    const front =
      dif === 3
        ? `The hidden cubes form a cube of edge $\\sqrt[3]{${num(forgot! ** 3)}} = ${forgot}$. The whole cube is 2 longer on each edge (one outer layer at each end): $${forgot} + 2 = ${a}$.\n\n`
        : '';
    const notes = trapNotes(
      choices,
      {
        'geom-paint-half-count': (v) => `${v} counts only half of the faces or edges, or a single layer of the hidden block`,
        'geom-paint-trim-one': (v) => `${v} removes only one layer per dimension`,
        'geom-paint-whole-solid': (v) => `${v} counts every small cube`,
        'geom-paint-surface-squares': (v) => `${v} counts painted squares, and edge and corner cubes show more than one`,
        'geom-paint-edge-full': (v) => `${v} uses whole edges, corners included`,
        'geom-paint-corners-added': (v) => `${v} adds the 8 corners, which have three painted faces`,
        'geom-paint-corners-missed': (v) => `${v} forgets the 8 corners`,
        'geom-paint-wrong-class': (v) => `${v} comes from counting another kind of cube`,
        'geom-paint-forgot-layer': (v) => `${v} treats the hidden cube as the whole cube`,
      },
      2,
    );
    const total = a * b * c;
    const checkLine = `Check: $${num(zero(dims, 2))} + ${num(one(dims, 2))} + ${num(two(dims, 2))} + 8 = ${num(total)}$, the total number of cubes (no, one, two and three painted faces).`;
    const explanation = `${front}${how}

For ${a === b && b === c ? `an edge of ${a}` : `${a} by ${b} by ${c}`}: $${calc}$.

${checkLine}

${notes}

Rule: a cube with $k$ painted faces sits at a corner (3), on an edge (2), in the middle of a face (1) or inside (0), and each edge length is trimmed by 2.`;
    return { params: { dims, ask: realAsk, vals, hidden: forgot === null ? -1 : forgot ** 3 }, q: { format: 'mcs', stem, ...(dif === 3 ? {} : { figure: fig.build() }), choices, answer: built.answer, explanation } };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'format';
    // brute force over every small cube
    const [a, b, c] = p.dims;
    let n = 0;
    for (let i = 0; i < a; i++)
      for (let j = 0; j < b; j++)
        for (let k = 0; k < c; k++) {
          const faces = +(i === 0) + +(i === a - 1) + +(j === 0) + +(j === b - 1) + +(k === 0) + +(k === c - 1);
          if (p.ask === 'zero' ? faces === 0 : p.ask === 'one' ? faces === 1 : p.ask === 'two' ? faces === 2 : faces >= 1) n++;
        }
    if (p.hidden >= 0) {
      let hid = 0;
      for (let i = 1; i < a - 1; i++) for (let j = 1; j < b - 1; j++) for (let k = 1; k < c - 1; k++) hid++;
      if (hid !== p.hidden) return `the hidden block has ${hid} cubes, the stem says ${p.hidden}`;
    }
    const hits = p.vals.flatMap((v, i) => (v === n ? [i] : []));
    return hits.length === 1 && hits[0] === q.answer ? null : `expected ${n}, matches ${hits}`;
  },
};

export const paintedTemplates = retryAll([painted]);
