import { numericChoices } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import type { Template, Trap } from '../../../engine/types';
import { Fig, type P2 } from '../measure/fig';
import { trapNotes } from '../notes';
import { Redraw, retryAll } from '../redraw';

/* Perimeter of a figure with right angles only: slide the edges to the outer rectangle, except across a bite (MCS). */

export const staircaseTraps: Record<string, Trap> = {
  'geo-fig-perim-cut-off': {
    label: 'Subtracted the cut-off pieces from the perimeter',
    fix: 'Cutting a corner out of a rectangle removes area, but the stair edges are as long as the two edges they replace. The perimeter does not change.',
  },
  'geo-fig-perim-sum-labels': {
    label: 'Added every number written on the figure',
    fix: 'The labels are lengths of SOME edges. Each unlabelled edge must be found, or slid onto a labelled one. Sum all the edges, not the labels.',
  },
  'geo-fig-perim-half': {
    label: 'Gave the half-perimeter $W + H$',
    fix: 'Going around the figure covers each of the two directions twice: the perimeter is $2(W + H)$ for the outer rectangle.',
  },
  'geo-fig-perim-add-notch': {
    label: 'Added the lengths of the stair edges on top of the outer rectangle',
    fix: 'Each stair edge replaces part of an outer edge: the horizontal edges together equal the missing width, the vertical ones the missing height. Nothing is added.',
  },
  'geo-fig-perim-ignore-bite': {
    label: 'Used the perimeter of the outer rectangle although a bite goes inward',
    fix: 'A bite cut into the middle of a side adds two new vertical edges of depth $q$, while the top edge keeps its length. The perimeter is $2(W + H) + 2q$.',
  },
  'geo-fig-perim-double-p': {
    label: 'Counted the bottom of the bite as well',
    fix: 'The bottom edge of the bite $p$ replaces the piece of the top edge that was cut away, so it is already counted. Only the two sides of depth $q$ are new.',
  },
};

interface Params {
  W: number;
  H: number;
  steps: [number, number][]; // [width, height] of each stair, from the bottom up
  bite: [number, number, number] | null; // x0, p, q
}

const mk = (W: number, H: number, steps: [number, number][], bite: Params['bite']): P2[] => {
  const sh = steps.reduce((s, t) => s + t[1], 0);
  const v: P2[] = [[0, 0], [W, 0]];
  let x = W;
  let y = H - sh;
  if (steps.length) {
    v.push([x, y]);
    for (const [w, h] of steps) {
      x -= w;
      v.push([x, y]);
      y += h;
      v.push([x, y]);
    }
  } else v.push([W, H]);
  if (bite) {
    const [x0, p, q] = bite;
    v.push([x0 + p, H], [x0 + p, H - q], [x0, H - q], [x0, H]);
  }
  v.push([0, H]);
  return v;
};

const staircase: Template<Params> = {
  id: 'geo.figure-reasoning.staircase-perimeter-mcs',
  skill: 'geo.figure-reasoning',
  format: 'mcs',
  style: 'perimeter of a figure with only right angles: slide the edges, watch for a bite',
  generate(rng, d) {
    const W = rng.int(10, 32);
    const H = rng.int(8, 26);
    const nSteps = d === 1 ? 1 : d === 2 ? rng.int(2, 3) : rng.pick([0, 1, 1, 2]);
    const steps: [number, number][] = [];
    let sw = 0;
    let sh = 0;
    for (let i = 0; i < nSteps; i++) {
      const w = rng.int(2, Math.max(2, Math.floor(W / (nSteps + 2))));
      const h = rng.int(2, Math.max(2, Math.floor(H / (nSteps + 2))));
      steps.push([w, h]);
      sw += w;
      sh += h;
    }
    if (sw >= W - 4 || sh >= H - 3) throw new Redraw('steps too big');
    // widths and heights written on the figure must not repeat, or the picture reads as a shortcut
    const nums = steps.flat();
    if (new Set([...nums, W, H]).size < nums.length + 2) throw new Redraw('repeated labels');
    let bite: Params['bite'] = null;
    if (d === 3) {
      const p = rng.int(3, 8);
      const q = rng.int(2, Math.min(7, H - sh - 3));
      if (q < 2) throw new Redraw('bite');
      const room = W - sw - p - 2;
      if (room < 2) throw new Redraw('no room for the bite');
      bite = [rng.int(2, room), p, q];
      if (new Set([...nums, W, H, p, q]).size < nums.length + 4) throw new Redraw('repeated labels');
    }
    const base = 2 * (W + H);
    const answer = bite ? base + 2 * bite[2] : base;
    const traps: { value: Frac; trap: string }[] = [];
    const sum = W + H + nums.reduce((a, b) => a + b, 0) + (bite ? bite[1] + bite[2] : 0);
    if (bite) {
      traps.push({ value: new Frac(base), trap: 'geo-fig-perim-ignore-bite' }, { value: new Frac(base + 2 * bite[2] + 2 * bite[1]), trap: 'geo-fig-perim-double-p' }, { value: new Frac(base - 2 * bite[2]), trap: 'geo-fig-perim-cut-off' }, { value: new Frac(sum), trap: 'geo-fig-perim-sum-labels' });
    } else {
      traps.push({ value: new Frac(base - 2 * (sw + sh)), trap: 'geo-fig-perim-cut-off' }, { value: new Frac(base + 2 * (sw + sh)), trap: 'geo-fig-perim-add-notch' }, { value: new Frac(sum), trap: 'geo-fig-perim-sum-labels' }, { value: new Frac(W + H), trap: 'geo-fig-perim-half' });
    }
    const { choices, answer: ans } = numericChoices(rng, {
      correct: new Frac(answer),
      traps,
      fillers: [answer + 4, answer - 4, answer + 8].map((v) => new Frac(v)),
      format: (f) => `$${f.toTex()}$`,
      order: 'random',
    });
    if (choices.filter((c) => c.trap).length < 2) throw new Redraw('too few traps shown');
    // figure
    const k = 6 / Math.max(W, H);
    const v = mk(W, H, steps, bite).map(([x, y]) => [x * k, y * k] as P2);
    const fig = new Fig();
    fig.polyXY(v);
    const edge = (i: number, label: string) => fig.segXY(v[i], v[(i + 1) % v.length], label);
    edge(0, `$${W}$`);
    edge(v.length - 1, `$${H}$`);
    // stair edges: vertices 3.. in pairs (left, up)
    if (steps.length) steps.forEach(([w, h], i) => (edge(3 + 2 * i - 1, `$${w}$`), edge(3 + 2 * i, `$${h}$`)));
    if (bite) {
      const bi = v.findIndex((_, i) => i >= 2 && Math.abs(v[i][1] - H * k) < 1e-9 && i + 1 < v.length && v[i + 1][1] < H * k - 1e-9);
      edge(bi, `$${bite[2]}$`);
      edge(bi + 1, `$${bite[1]}$`);
    }
    const notes = trapNotes(
      choices,
      {
        'geo-fig-perim-cut-off': (vs) => `${vs} subtracts the cut-off pieces, but the stair edges are as long as the outer edges they replace`,
        'geo-fig-perim-add-notch': (vs) => `${vs} adds the stair edges on top of the outer rectangle, though they replace part of it`,
        'geo-fig-perim-sum-labels': (vs) => `${vs} adds the labels instead of all the edges`,
        'geo-fig-perim-half': (vs) => `${vs} is only half way around`,
        'geo-fig-perim-ignore-bite': (vs) => `${vs} is the outer rectangle, but the bite adds two edges of depth $${bite ? bite[2] : 0}$`,
        'geo-fig-perim-double-p': (vs) => `${vs} also counts the bottom of the bite, which only replaces the part of the top edge that was cut away`,
      },
      2,
    );
    const slide = steps.length
      ? `Slide every horizontal stair edge up to the top edge and every vertical stair edge over to the right edge: together they rebuild a full width $${W}$ and a full height $${H}$. `
      : '';
    const explanation = bite
      ? `Recognize: all angles are right angles, so horizontal edges can be slid onto one line and vertical edges onto another.

${slide}The horizontal edges sum to $2 \\cdot ${W}$ (the bite's bottom $${bite[1]}$ replaces the same length of top edge), and the vertical edges sum to $2 \\cdot ${H}$ plus the two sides of the bite, $2 \\cdot ${bite[2]}$. So the perimeter is $2(${W} + ${H}) + 2 \\cdot ${bite[2]} = ${answer}$.

Check: walking around once, the vertical moves are up $${H}$ and down $${H}$, plus down and up $${bite[2]}$ in the bite.

${notes}

Rule: slide edges onto the outer rectangle, then add only what goes inward.`
      : `Recognize: all angles are right angles, so the stair edges can be slid onto the outer rectangle.

${slide}The perimeter equals that of the $${W}$ by $${H}$ rectangle: $2(${W} + ${H}) = ${answer}$. Neither the number of stairs nor their sizes matter.

Check: going around once, the horizontal moves add to $2 \\cdot ${W}$ and the vertical moves to $2 \\cdot ${H}$.

${notes}

Rule: a corner or staircase cut-out does not change the perimeter; a bite into the middle of a side does.`;
    return {
      params: { W, H, steps, bite },
      q: {
        format: 'mcs',
        stem: `In the figure, all angles are right angles. What is the perimeter of the figure?`,
        figure: fig.build(true),
        choices,
        answer: ans,
        explanation,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'format';
    const v = mk(p.W, p.H, p.steps, p.bite);
    let per = 0;
    for (let i = 0; i < v.length; i++) {
      const a = v[i];
      const b = v[(i + 1) % v.length];
      if (a[0] !== b[0] && a[1] !== b[1]) return 'edge is not axis-parallel';
      per += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
    }
    const got = Number(q.choices[q.answer].text.replace(/[$,{}]/g, ''));
    return got === per ? null : `expected ${per}`;
  },
};

export const staircaseTemplates = retryAll([staircase]);
