import { numericChoices } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import type { Template, Trap } from '../../../engine/types';
import { Fig, onCircle, type P2 } from './fig';
import { trapNotes } from '../notes';
import { Redraw, retryAll } from '../redraw';

/* Counting diagonals: all pairs of vertices minus the sides, in polygon, seating and "not through the center" wording (MCS). */

export const diagonalTraps: Record<string, Trap> = {
  'geom-poly-diag-no-half': {
    label: 'Counted each diagonal twice: $n(n - 3)$ without dividing by 2',
    fix: 'Each vertex has $n - 3$ diagonals, but a diagonal has two ends, so $n(n - 3)$ counts every diagonal twice. Divide by 2.',
  },
  'geom-poly-diag-sides-too': {
    label: 'Counted the sides as well: $\\frac{n(n - 1)}{2}$',
    fix: 'The number of pairs of vertices is $\\frac{n(n - 1)}{2}$, but $n$ of those pairs are sides. A diagonal joins two vertices that are NOT neighbours.',
  },
  'geom-poly-diag-one-vertex': {
    label: 'Gave the diagonals from one vertex, $n - 3$',
    fix: 'One vertex has $n - 3$ diagonals, but there are $n$ vertices. Multiply, then halve because each diagonal is counted from both ends.',
  },
  'geom-poly-diag-center-forgotten': {
    label: 'Counted all the diagonals when some are excluded',
    fix: 'Re-read the question: it asks only for the diagonals that satisfy an extra condition. Count the total, then subtract the ones that are excluded.',
  },
  'geom-poly-diag-center-only': {
    label: 'Gave the diagonals that pass through the center instead of those that do not',
    fix: 'In a regular polygon with $2m$ vertices exactly $m$ diagonals pass through the center. The question asks for the others: the total minus $m$.',
  },
  'geom-poly-diag-center-double': {
    label: 'Removed two diagonals per pair of opposite vertices',
    fix: 'The segment from vertex $i$ to its opposite vertex is the same segment as from the opposite vertex back to $i$. There are $m$ such diagonals, not $2m$.',
  },
  'geom-poly-diag-merge-missed': {
    label: 'Counted the diagonals of the smaller polygon only',
    fix: 'After removing a vertex, the two sides that met there are replaced by the segment joining its two neighbours. That segment is a side of the smaller polygon but a diagonal of the original.',
  },
  'geom-poly-diag-vertex-removed': {
    label: 'Subtracted $n$ instead of the diagonals at the vertex',
    fix: 'A vertex has $n - 3$ diagonals; the other two segments at it are sides. Subtract only the diagonals.',
  },
};

type Mode = 'count' | 'center' | 'vertex';
type Ctx = 'polygon' | 'table' | 'cables';
interface Params {
  mode: Mode;
  n: number;
  ctx: Ctx;
}

const D = (n: number) => (n * (n - 3)) / 2;

const diagonals: Template<Params> = {
  id: 'geo.polygons.diagonals-mcs',
  skill: 'geo.polygons',
  format: 'mcs',
  style: 'number of diagonals of a polygon, also in seating and cable wording, or excluding some of them',
  generate(rng, d) {
    const mode: Mode = d === 1 ? 'count' : d === 2 ? rng.pick(['count', 'count', 'center']) : rng.pick(['center', 'vertex', 'vertex']);
    const ctx: Ctx = mode === 'count' && d >= 2 ? rng.pick(['polygon', 'table', 'cables']) : 'polygon';
    let n: number;
    if (mode === 'count') n = d === 1 ? rng.int(5, 14) : rng.int(8, 30);
    else if (mode === 'center') n = 2 * (d === 2 ? rng.int(3, 8) : rng.int(5, 15));
    else n = rng.int(7, 25);
    const total = D(n);
    let answer: number;
    const traps: { value: Frac; trap: string }[] = [];
    let steps: string;
    let stem: string;
    const poly = `a convex polygon with ${n} sides`;
    if (mode === 'count') {
      answer = total;
      traps.push({ value: new Frac(n * (n - 3)), trap: 'geom-poly-diag-no-half' }, { value: new Frac((n * (n - 1)) / 2), trap: 'geom-poly-diag-sides-too' }, { value: new Frac(n - 3), trap: 'geom-poly-diag-one-vertex' });
      stem =
        ctx === 'polygon'
          ? `How many diagonals does ${poly} have?`
          : ctx === 'table'
            ? `${n} people sit around a circular table. Each person talks once with every other person except the two sitting directly next to him or her. How many conversations take place in all?`
            : `${n} towers stand at the corners of a field, ${n} fence segments join neighbouring towers, and a cable is laid between every pair of towers that are not neighbours along the fence. How many cables are there?`;
      steps = `From one ${ctx === 'polygon' ? 'vertex' : ctx === 'table' ? 'person' : 'tower'} there are $${n} - 3 = ${n - 3}$ choices: all the others except itself and its two neighbours. For all ${n} that gives $${n} \\cdot ${n - 3} = ${n * (n - 3)}$, but each ${ctx === 'polygon' ? 'diagonal' : ctx === 'table' ? 'conversation' : 'cable'} has two ends and was counted twice. So $\\frac{${n} \\cdot ${n - 3}}{2} = ${answer}$.`;
    } else if (mode === 'center') {
      const m = n / 2;
      answer = total - m;
      traps.push({ value: new Frac(total), trap: 'geom-poly-diag-center-forgotten' }, { value: new Frac(m), trap: 'geom-poly-diag-center-only' }, { value: new Frac(total - 2 * m), trap: 'geom-poly-diag-center-double' }, { value: new Frac(n * (n - 3)), trap: 'geom-poly-diag-no-half' });
      stem = `A regular polygon has ${n} sides. How many of its diagonals do NOT pass through the center of the polygon?`;
      steps = `The polygon has $\\frac{${n} \\cdot ${n - 3}}{2} = ${total}$ diagonals. A diagonal passes through the center only when it joins two opposite vertices. There are ${n} vertices, so ${m} such pairs. Therefore $${total} - ${m} = ${answer}$ diagonals do not pass through the center.`;
    } else {
      answer = total - (n - 3);
      traps.push({ value: new Frac(total), trap: 'geom-poly-diag-center-forgotten' }, { value: new Frac(((n - 1) * (n - 4)) / 2), trap: 'geom-poly-diag-merge-missed' }, { value: new Frac(total - n), trap: 'geom-poly-diag-vertex-removed' });
      stem = `${poly[0].toUpperCase()}${poly.slice(1)} has one marked vertex $V$. How many of its diagonals do NOT have $V$ as an endpoint?`;
      steps = `The polygon has $\\frac{${n} \\cdot ${n - 3}}{2} = ${total}$ diagonals. From $V$ there are $${n} - 3 = ${n - 3}$ of them (every vertex except $V$ and its two neighbours). The rest number $${total} - ${n - 3} = ${answer}$.`;
    }
    const { choices, answer: ans } = numericChoices(rng, {
      correct: new Frac(answer),
      traps,
      fillers: [answer + 3, answer - 3, answer + 7, answer - 5].map((v) => new Frac(v)),
      format: (f) => `$${f.toTex()}$`,
      order: 'random',
    });
    if (choices.filter((c) => c.trap).length < 2) throw new Redraw('too few traps shown');
    const fig = new Fig();
    const rot = rng.int(0, 359);
    const pts: P2[] = Array.from({ length: n }, (_, i) => onCircle([0, 0], 2, rot + (360 * i) / n));
    fig.polyXY(pts);
    if (mode === 'vertex') {
      fig.pt('V', pts[0], [pts[0][0], pts[0][1]]);
    }
    if (mode === 'center') fig.pt('O', [0, 0], [0, 0.5]);
    const notes = trapNotes(
      choices,
      {
        'geom-poly-diag-no-half': (vs) => `${vs} counts every diagonal twice`,
        'geom-poly-diag-sides-too': (vs) => `${vs} counts the ${n} sides as if they were diagonals`,
        'geom-poly-diag-one-vertex': (vs) => `${vs} is the number at a single vertex only`,
        'geom-poly-diag-center-forgotten': (vs) => `${vs} is the total, with nothing excluded`,
        'geom-poly-diag-center-only': (vs) => `${vs} counts the diagonals through the center, the opposite of what is asked`,
        'geom-poly-diag-center-double': (vs) => `${vs} removes two diagonals for each opposite pair, but each pair is one diagonal`,
        'geom-poly-diag-merge-missed': (vs) => `${vs} counts the diagonals of the polygon left after removing $V$ and misses the segment joining the two neighbours of $V$, which was a diagonal before`,
        'geom-poly-diag-vertex-removed': (vs) => `${vs} subtracts all ${n} segments at a vertex, but two of them are sides`,
      },
      2,
    );
    return {
      params: { mode, n, ctx },
      q: {
        format: 'mcs',
        stem,
        figure: fig.build(true),
        choices,
        answer: ans,
        explanation: `Recognize: a diagonal joins two vertices that are not neighbours, so count pairs and remove the neighbours.

${steps}

Check: with ${n === 5 ? 'a pentagon' : 'a small case such as a pentagon'} the formula gives $\\frac{5 \\cdot 2}{2} = 5$, the five diagonals of the pentagram.

${notes}

Rule: diagonals of an $n$-gon: $\\frac{n(n - 3)}{2}$, because each vertex has $n - 3$ and each diagonal is counted from both ends.`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'format';
    // enumerate pairs of vertices of a regular polygon
    const adjacent = (i: number, j: number) => (i - j + p.n) % p.n === 1 || (j - i + p.n) % p.n === 1;
    let count = 0;
    for (let i = 0; i < p.n; i++)
      for (let j = i + 1; j < p.n; j++) {
        if (adjacent(i, j)) continue;
        if (p.mode === 'center' && j - i === p.n / 2) continue;
        if (p.mode === 'vertex' && i === 0) continue;
        count++;
      }
    return Number(q.choices[q.answer].text.replace(/[$,{}]/g, '')) === count ? null : `expected ${count}`;
  },
};

export const diagonalTemplates = retryAll([diagonals]);
