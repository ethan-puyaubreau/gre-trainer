import { qcCompareNum, qcFromSamples } from '../../../engine/build';
import type { QCChoice, Template, Trap } from '../../../engine/types';
import { Redraw, retryAll } from '../redraw';
import { FigBuilder } from './fig';
import { QC_SAY, qcTraps } from './util';

/* A right triangle with a fixed hypotenuse: how large can the legs' sum or the area get? (QC) */

export const hypBoundTraps: Record<string, Trap> = {
  'geo-rt-isosceles-only': {
    label: 'Tested only the isosceles case $x = y$',
    fix: 'With a fixed hypotenuse the legs can trade length: $x = y$ gives one value, but a long thin triangle gives a very different one. Try both extremes before deciding.',
  },
  'geo-rt-sum-as-hyp': {
    label: 'Treated the sum of the legs as if it were the hypotenuse',
    fix: 'The hypotenuse satisfies $x^2 + y^2 = h^2$, not $x + y = h$. The sum of the legs is always larger than $h$ (triangle inequality).',
  },
  'geo-rt-one-pair': {
    label: 'Used only one pair of integer legs',
    fix: 'Some hypotenuses belong to two different right triangles with whole-number legs. List every pair before comparing.',
  },
};

type Kind = 'sum' | 'area' | 'integer';
interface P {
  kind: Kind;
  h: number;
  N: number;
}

/** Integer leg pairs (a < b) with a^2 + b^2 = h^2. */
function intPairs(h: number): [number, number][] {
  const out: [number, number][] = [];
  for (let a = 1; a < h; a++) {
    const b2 = h * h - a * a;
    const b = Math.round(Math.sqrt(b2));
    if (b * b === b2 && a < b) out.push([a, b]);
  }
  return out;
}
const WITH_PAIRS = Array.from({ length: 96 }, (_, i) => i + 5).filter((h) => intPairs(h).length > 0);
const H_ONE = WITH_PAIRS.filter((h) => intPairs(h).length === 1);
const H_TWO = WITH_PAIRS.filter((h) => intPairs(h).length >= 2);

const cmp = (a: number, b: number): QCChoice => qcCompareNum(a, b);
const fmt = (v: number) => `${Math.round(v * 10) / 10}`;

const hypBound: Template<P> = {
  id: 'geo.right-triangles.hypotenuse-bound-qc',
  skill: 'geo.right-triangles',
  format: 'qc',
  style: 'right triangle with a fixed hypotenuse: sum of the legs, area, or whole-number legs',
  generate(rng, d) {
    const kind: Kind =
      d === 1 ? 'integer' : d === 2 ? 'sum' : rng.pick(['area', 'area', 'sum', 'integer'] as const);
    let h: number;
    let N: number;
    let answer: QCChoice;
    let wrong: { letter: QCChoice; trap: string } | null = null;
    let body: string;
    if (kind === 'integer') {
      const multi = d === 3 || rng.chance(0.3);
      h = rng.pick(multi ? H_TWO : H_ONE);
      const pairs = intPairs(h);
      const sums = pairs.map(([a, b]) => a + b);
      const lo = Math.min(...sums);
      const hi = Math.max(...sums);
      N = multi ? rng.pick([lo, hi, Math.round((lo + hi) / 2), lo - 3, hi + 3, hi - 1]) : lo + rng.pick([-6, -3, -1, 0, 0, 1, 4, 7]);
      answer = sums.every((s) => s > N) ? 'A' : sums.every((s) => s < N) ? 'B' : sums.every((s) => s === N) ? 'C' : 'D';
      if (answer === 'D') wrong = { letter: cmp(sums[0], N), trap: 'geo-rt-one-pair' };
      const list = pairs.map(([a, b]) => `$${a}$ and $${b}$ (sum $${a + b}$)`).join(', ');
      body = `Recognize: the legs are whole numbers with $x^2 + y^2 = ${h * h}$, so list every pair that works.

The pairs are ${list}. ${answer === 'D' ? `The sums ${sums.join(', ')} are not all on the same side of $${N}$, so $x + y$ is not fixed.` : `Every sum ${answer === 'A' ? 'exceeds' : answer === 'B' ? 'is below' : 'equals'} $${N}$.`}

Check: ${pairs.map(([a, b]) => `$${a}^2 + ${b}^2 = ${a * a + b * b}$`).join(', ')}.

${wrong && wrong.letter !== answer ? `Trap: using only the pair $${pairs[0][0]}$ and $${pairs[0][1]}$ would suggest that ${QC_SAY[wrong.letter]}.\n\n` : ''}Rule: with whole-number legs, enumerate every pair; do not assume there is only one.`;
    } else if (kind === 'sum') {
      h = d === 2 ? rng.int(6, 30) : rng.int(31, 60);
      const rt = h * Math.SQRT2;
      N = rng.pick([h - 2, h, h + 1, Math.floor(rt), Math.floor(rt) - 1, Math.ceil(rt), Math.ceil(rt) + 2, Math.floor((h + rt) / 2), h + 3]);
      answer = N <= h ? 'A' : N * N > 2 * h * h ? 'B' : 'D';
      if (answer === 'D') wrong = { letter: cmp(rt, N), trap: 'geo-rt-isosceles-only' };
      else if (answer === 'A' && N === h) wrong = { letter: 'C', trap: 'geo-rt-sum-as-hyp' };
      body = `Recognize: the hypotenuse is fixed at $${h}$, so $x^2 + y^2 = ${h * h}$ while $x$ and $y$ trade length.

The sum $x + y$ is always more than $${h}$ (two legs beat the hypotenuse). It is largest when $x = y$: then $x + y = ${h}\\sqrt{2} \\approx ${fmt(rt)}$. So $${h} < x + y \\le ${fmt(rt)}$. ${answer === 'A' ? `Since $${N} \\le ${h}$, $x + y$ is greater.` : answer === 'B' ? `Since $${N} > ${fmt(rt)}$, $${N}$ is greater.` : `$${N}$ sits inside that range: the isosceles triangle gives $${fmt(rt)}$ (more than $${N}$), while a long thin triangle gives a sum just over $${h}$ (less than $${N}$).`}

${wrong && wrong.letter !== answer ? `Trap: ${wrong.trap === 'geo-rt-sum-as-hyp' ? 'reading $x + y$ as the hypotenuse' : 'testing only $x = y$'} would suggest that ${QC_SAY[wrong.letter]}.\n\n` : ''}Rule: with a fixed hypotenuse, the sum of the legs peaks at the isosceles triangle.`;
    } else {
      h = 2 * rng.int(3, 20);
      const peak = (h * h) / 4;
      N = rng.pick([peak, peak + 2, peak + 5, peak - 3, peak - 1, peak + 1, Math.round(peak / 2)]);
      if (N <= 0) throw new Redraw('N');
      answer = N > peak ? 'B' : 'D';
      if (answer === 'D') wrong = { letter: cmp(peak, N), trap: 'geo-rt-isosceles-only' };
      body = `Recognize: with hypotenuse $${h}$, the area is $\\tfrac12 xy$, and $x^2 + y^2 = ${h * h}$.

Since $(x - y)^2 \\ge 0$, $xy \\le \\tfrac12(x^2 + y^2) = ${(h * h) / 2}$, so the area is at most $${peak}$, reached only when $x = y$. ${answer === 'B' ? `Since $${N} > ${peak}$, Quantity B is greater.` : `The area can equal $${peak}$ (isosceles) or be as small as you like (a long thin triangle), so against $${N}$ both outcomes happen.`}

${wrong && wrong.letter !== answer ? `Trap: using only the isosceles triangle would suggest that ${QC_SAY[wrong.letter]}.\n\n` : ''}Rule: for a fixed hypotenuse, the largest area is the isosceles one.`;
    }
    const info =
      kind === 'integer'
        ? `A right triangle has hypotenuse $${h}$ and legs of whole-number lengths $x$ and $y$.`
        : `A right triangle has hypotenuse $${h}$ and legs of lengths $x$ and $y$.`;
    const quantityA = kind === 'area' ? 'The area of the triangle' : '$x + y$';
    const quantityB = `$${N}$`;
    const fb = new FigBuilder().pt('C', [0, 0]).pt('A', [0, 3]).pt('B', [4, 0]).hide('A', 'B', 'C').poly('A', 'B', 'C').right('A', 'C', 'B');
    fb.side('C', 'A', 'B', '$x$').side('C', 'B', 'A', '$y$').side('A', 'B', 'C', `$${h}$`);
    const figure = { ...fb.build(), notToScale: true };
    return {
      params: { kind, h, N },
      q: { format: 'qc', info, figure, quantityA, quantityB, answer, traps: qcTraps(answer, wrong ? { [wrong.letter]: wrong.trap } : {}), explanation: body },
    };
  },
  check(q, p) {
    if (q.format !== 'qc') return 'format';
    const samples: [number, number][] = [];
    if (p.kind === 'integer') {
      for (let x = 1; x < p.h; x++)
        for (let y = 1; y < p.h; y++) if (x * x + y * y === p.h * p.h) samples.push([x + y, p.N]);
    } else {
      for (let t = 1; t < 360; t++) {
        const th = (t * 0.25 * Math.PI) / 180;
        const x = p.h * Math.cos(th);
        const y = p.h * Math.sin(th);
        samples.push([p.kind === 'sum' ? x + y : (x * y) / 2, p.N]);
      }
      // the isosceles triangle belongs to the allowed values and must be sampled exactly
      const e = p.h / Math.SQRT2;
      samples.push([p.kind === 'sum' ? 2 * e : (e * e) / 2, p.N]);
    }
    const exp = qcFromSamples(samples);
    return q.answer === exp ? null : `expected ${exp}`;
  },
};

export const hypBoundTemplates = retryAll([hypBound]);
