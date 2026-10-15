import { Frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { NEQuestion, Template, Trap } from '../../../engine/types';
import { noClash, retryAll } from '../redraw';

/* A cube with a block cut out of a corner, an edge or a face, or a square tunnel drilled through it: surface area (NE). */

export const carvedTraps: Record<string, Trap> = {
  'geom-carve-forgot-new': {
    label: 'Subtracted the faces that were cut away but forgot the new faces inside the cut',
    fix: 'Cutting uncovers new walls. The surface area of the remaining solid includes them: count the exposed faces of the removed block and subtract only the ones that lay on the surface.',
  },
  'geom-carve-no-subtract': {
    label: 'Added the new walls without taking away the part of the surface that was cut out',
    fix: 'Where the block touched the outside, that piece of the surface is gone. Subtract it, then add the new walls.',
  },
  'geom-carve-unchanged': {
    label: 'Thought the surface area stays the same, as for a corner cut',
    fix: 'Only a corner cut trades three removed faces for three new ones. An edge notch, a pit or a tunnel exposes more walls than the surface it removes.',
  },
  'geom-carve-one-cut': {
    label: 'Counted only one of the two cuts',
    fix: 'Each cut changes the surface area by its own amount, and the cuts do not touch each other. Add both changes to the original $6e^2$.',
  },
};

type Op = 'corner' | 'edge' | 'face' | 'tunnel';
type Box = [number, number, number, number, number, number]; // x0, x1, y0, y1, z0, z1 (voxels, end excluded)
interface Params {
  e: number;
  ops: { op: Op; k: number }[];
  ask: 'total' | 'increase';
}

/** Change of the surface area for one cut (k = edge of the block or side of the tunnel). */
const net = (op: Op, k: number, e: number) => (op === 'corner' ? 0 : op === 'edge' ? 2 * k * k : op === 'face' ? 4 * k * k : 4 * k * e - 2 * k * k);
/** Wrong changes a student could compute for the same cut: [value, trap]. */
const wrongNet = (op: Op, k: number, e: number): [number, string][] =>
  op === 'corner'
    ? [[-3 * k * k, 'geom-carve-forgot-new'], [3 * k * k, 'geom-carve-no-subtract']]
    : op === 'edge'
      ? [[-2 * k * k, 'geom-carve-forgot-new'], [4 * k * k, 'geom-carve-no-subtract'], [0, 'geom-carve-unchanged']]
      : op === 'face'
        ? [[-k * k, 'geom-carve-forgot-new'], [5 * k * k, 'geom-carve-no-subtract'], [0, 'geom-carve-unchanged']]
        : [[-2 * k * k, 'geom-carve-forgot-new'], [4 * k * e, 'geom-carve-no-subtract'], [0, 'geom-carve-unchanged']];

/** Where each cut sits in the e x e x e grid (the cuts are far apart, so their effects add). */
function box(op: Op, k: number, e: number): Box {
  const mid = Math.floor((e - k) / 2);
  if (op === 'corner') return [0, k, 0, k, 0, k];
  if (op === 'edge') return [mid, mid + k, e - k, e, 0, k];
  if (op === 'face') return [e - k, e, mid, mid + k, mid, mid + k];
  return [mid, mid + k, mid, mid + k, 0, e];
}

const cm = (k: number) => `${k} ${k === 1 ? 'centimeter' : 'centimeters'}`;
const WHAT: Record<Op, (k: number) => string> = {
  corner: (k) => `a smaller cube with edge ${cm(k)} is cut away from one corner`,
  edge: (k) => `a small cube with edge ${cm(k)} is cut away from the middle of one edge, so that the notch reaches neither end of that edge`,
  face: (k) => `a small cube with edge ${cm(k)} is cut away from the middle of one face, leaving a cube-shaped pit that reaches none of the edges of that face`,
  tunnel: (k) => `a square tunnel with side ${cm(k)} is drilled straight through, from the center of one face to the center of the opposite face`,
};
const WHY: Record<Op, (k: number, e: number) => string> = {
  corner: (k) => `a corner cut removes 3 squares of area $${k}^2$ from the surface and uncovers 3 new squares of the same size, a change of $0$`,
  edge: (k) => `an edge notch removes 2 squares of area $${k}^2$ from the surface and uncovers 4 new ones, a change of $+2 \\cdot ${k}^2 = ${2 * k * k}$`,
  face: (k) => `a pit removes 1 square of area $${k}^2$ from the surface and uncovers 5 new ones, a change of $+4 \\cdot ${k}^2 = ${4 * k * k}$`,
  tunnel: (k, e) => `a tunnel removes 2 squares of area $${k}^2$ (its two openings) and adds 4 long walls of $${k} \\cdot ${e}$, a change of $4 \\cdot ${k * e} - 2 \\cdot ${k * k} = ${4 * k * e - 2 * k * k}$`,
};

const carved: Template<Params> = {
  id: 'geo.solids.carved',
  skill: 'geo.solids',
  format: 'ne',
  style: 'surface area of a cube with a block cut from a corner, edge or face, or a tunnel drilled through',
  generate(rng, dif) {
    let e: number;
    let ops: { op: Op; k: number }[];
    let ask: 'total' | 'increase' = 'total';
    if (dif === 1) {
      e = rng.int(4, 20);
      const op = rng.pick(['corner', 'edge', 'face'] as const);
      ops = [{ op, k: rng.int(1, Math.min(6, Math.floor(e / 3))) }];
    } else if (dif === 2) {
      e = rng.int(5, 24);
      const op = rng.pick(['tunnel', 'tunnel', 'edge', 'face'] as const);
      ops = [{ op, k: rng.int(1, op === 'tunnel' ? Math.min(7, e - 3) : Math.min(6, Math.floor(e / 3))) }];
      ask = op === 'tunnel' && rng.chance(0.4) ? 'total' : 'increase';
    } else {
      e = rng.int(14, 26);
      const pair = rng.sample(['corner', 'edge', 'face', 'tunnel'] as const, 2);
      ops = pair.map((op) => ({ op, k: rng.int(1, 3) }));
    }
    const base = 6 * e * e;
    const nets = ops.map((o) => net(o.op, o.k, e));
    const delta = nets.reduce((a, b) => a + b, 0);
    const answer = ask === 'total' ? base + delta : delta;
    const traps: { value: number; trap: string }[] = [];
    if (ops.length === 1) {
      const { op, k } = ops[0];
      for (const [w, id] of wrongNet(op, k, e)) traps.push({ value: ask === 'total' ? base + w : w, trap: id });
    } else {
      traps.push({ value: base + nets[0], trap: 'geom-carve-one-cut' }, { value: base + nets[1], trap: 'geom-carve-one-cut' });
      const w0 = wrongNet(ops[0].op, ops[0].k, e)[0];
      const w1 = wrongNet(ops[1].op, ops[1].k, e)[0];
      traps.push({ value: base + w0[0] + nets[1], trap: w0[1] }, { value: base + nets[0] + w1[0], trap: w1[1] });
    }
    const good = traps.filter((t) => t.value > 0 && t.value !== answer);
    const listed = good.filter((t, i) => good.findIndex((u) => u.value === t.value) === i);
    const uni = 'square centimeters';
    const intro = `A solid cube has edge ${e} centimeters`;
    const cuts = ops.map((o) => WHAT[o.op](o.k));
    const stemCuts = ops.length === 1 ? `${intro}, and ${cuts[0]}.` : `${intro}. First, ${cuts[0]}. Then ${cuts[1]}. The two cuts do not touch each other.`;
    const stemAsk =
      ask === 'total'
        ? `What is the total surface area, in ${uni}, of the remaining solid, including the walls of the cut${ops.length > 1 ? 's' : ''}?`
        : `By how many ${uni} does the surface area of the solid increase?`;
    const parts = ops.map((o) => WHY[o.op](o.k, e));
    const sum = ops.length === 1 ? '' : ` Together: $${nets.map(num).join(' + ')} = ${num(delta)}$.`;
    const first = listed[0];
    const trapLine = first ? `Trap: $${num(first.value)}$ ${first.trap === 'geom-carve-forgot-new' ? 'forgets the new walls' : first.trap === 'geom-carve-no-subtract' ? 'adds the new walls without removing the lost surface' : first.trap === 'geom-carve-unchanged' ? 'assumes the area does not change' : 'counts only one cut'}.

` : '';
    const explanation = `Compare the surface of the solid before and after each cut: the cut removes some surface and exposes new walls.

The cube starts with $6 \\cdot ${e}^2 = ${num(base)}$. ${parts.map((p, i) => `For the ${ops.length > 1 ? (i ? 'second cut' : 'first cut') : 'cut'}, ${p}.`).join(' ')}${sum}

${ask === 'total' ? `So the surface area is $${num(base)} + ${num(delta)} = ${num(answer)}$.` : `So the surface area increases by $${num(answer)}$.`}

Check: ${delta > 0 ? 'the area went up, as it should when more squares are uncovered than lost' : 'the area is unchanged, as it should be when 3 squares are lost and 3 are gained'}.

${trapLine}
Rule: surface area changes by (new walls) minus (surface removed); removing material can add area.`;
    const q: NEQuestion = {
      format: 'ne',
      stem: `${stemCuts} ${stemAsk}`,
      answer: Frac.of(answer),
      traps: noClash(listed.map((t) => ({ value: Frac.of(t.value), trap: t.trap })), Frac.of(answer)),
      suffix: uni,
      explanation,
    };
    return { params: { e, ops, ask }, q };
  },
  check(q, p) {
    if (q.format !== 'ne') return 'format';
    // voxel model: every unit cube of the e x e x e grid, minus the cut blocks; count the faces that touch air
    const e = p.e;
    const solid = new Uint8Array(e * e * e).fill(1);
    const at = (x: number, y: number, z: number) => x >= 0 && y >= 0 && z >= 0 && x < e && y < e && z < e && solid[(x * e + y) * e + z] === 1;
    for (const o of p.ops) {
      const [x0, x1, y0, y1, z0, z1] = box(o.op, o.k, e);
      for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) solid[(x * e + y) * e + z] = 0;
    }
    let faces = 0;
    for (let x = 0; x < e; x++)
      for (let y = 0; y < e; y++)
        for (let z = 0; z < e; z++)
          if (at(x, y, z)) for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) if (!at(x + dx, y + dy, z + dz)) faces++;
    const want = p.ask === 'total' ? faces : faces - 6 * e * e;
    return q.answer.eq(Frac.of(want)) ? null : `the voxel model has ${want}`;
  },
};

export const carvedTemplates = retryAll([carved]);
