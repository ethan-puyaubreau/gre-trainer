import { numericChoices } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import type { Template, Trap } from '../../../engine/types';
import { Fig, type P2 } from '../measure/fig';
import { fromSides } from './fig';
import { trapNotes } from '../notes';
import { Redraw, retryAll } from '../redraw';

/* A figure not drawn to scale with side lengths given: which length could the unmarked segment have? (MCS) */

export const triangleBoundsTraps: Record<string, Trap> = {
  'geo-fig-tri-degenerate': {
    label: 'Allowed a length equal to the sum (or difference) of the other two sides',
    fix: 'In a triangle each side is strictly less than the sum of the other two and strictly greater than their difference. At equality the three points lie on one line and there is no triangle.',
  },
  'geo-fig-tri-one-bound': {
    label: 'Checked the sum of two sides but not their difference (or the reverse)',
    fix: 'A triangle needs both limits: the third side is less than the sum AND greater than the difference of the other two. A value can pass one and fail the other.',
  },
  'geo-fig-tri-one-triangle': {
    label: 'Checked the inequality for only one of the two triangles',
    fix: 'The diagonal is a side of BOTH triangles, so it must satisfy both pairs of inequalities. The allowed values are those between the larger difference and the smaller sum.',
  },
};

interface Params {
  quad: boolean;
  a: number;
  b: number;
  c: number;
  d: number;
  vals: number[]; // the five choices, ascending
  names: string[];
}

const SETS: string[][] = [
  ['A', 'B', 'C', 'D'],
  ['P', 'Q', 'R', 'S'],
  ['W', 'X', 'Y', 'Z'],
  ['K', 'L', 'M', 'N'],
];
const tx = (f: Frac) => `$${f.toTex()}$`;

const bounds: Template<Params> = {
  id: 'geo.figure-reasoning.triangle-bounds-mcs',
  skill: 'geo.figure-reasoning',
  format: 'mcs',
  style: 'two triangles on a shared diagonal, not to scale: which length is possible?',
  generate(rng, d) {
    const [nA, nB, nC, nD] = rng.pick(SETS);
    const quad = d >= 2;
    const a = rng.int(2, 18);
    const b = rng.int(2, 18);
    const c = quad ? rng.int(2, 18) : 0;
    const e = quad ? rng.int(2, 18) : 0; // DA
    const lo = quad ? Math.max(Math.abs(a - b), Math.abs(c - e)) : Math.abs(a - b);
    const hi = quad ? Math.min(a + b, c + e) : a + b;
    const inside = hi - lo - 1;
    if (inside < (d === 3 ? 1 : 2) || inside > (d === 3 ? 2 : 9)) throw new Redraw('interval');
    if (d === 2 && a + b === c + e) throw new Redraw('same sums');
    const answer = lo + 1 + rng.int(0, inside - 1);
    const traps: { value: Frac; trap: string }[] = [{ value: new Frac(hi), trap: 'geo-fig-tri-degenerate' }];
    if (lo >= 1) traps.push({ value: new Frac(lo), trap: 'geo-fig-tri-degenerate' });
    if (quad) {
      const maxSum = Math.max(a + b, c + e);
      const minDiffOnly = Math.min(Math.abs(a - b), Math.abs(c - e));
      if (hi + 1 < maxSum) traps.push({ value: new Frac(hi + 1), trap: 'geo-fig-tri-one-triangle' });
      if (lo - 1 > minDiffOnly) traps.push({ value: new Frac(lo - 1), trap: 'geo-fig-tri-one-triangle' });
      if (hi + 2 < maxSum) traps.push({ value: new Frac(hi + 2), trap: 'geo-fig-tri-one-triangle' });
    } else {
      if (lo - 1 >= 1) traps.push({ value: new Frac(lo - 1), trap: 'geo-fig-tri-one-bound' });
      traps.push({ value: new Frac(hi + 1), trap: 'geo-fig-tri-one-bound' });
    }
    const outside = (v: number) => v > 0 && (v <= lo || v >= hi);
    const fillers = [hi + 3, hi + 5, lo - 2, lo - 3, hi + 7, hi + 9].filter(outside).map((v) => new Frac(v));
    const { choices, answer: ans } = numericChoices(rng, {
      correct: new Frac(answer),
      traps: traps.filter((t) => outside(t.value.n)),
      fillers,
      format: tx,
      order: 'asc',
    });
    const vals = choices.map((ch) => Number(ch.text.replace(/\$/g, '')));
    if (vals.filter((v) => !outside(v)).length !== 1) throw new Redraw('more than one possible choice');
    if (choices.filter((ch) => ch.trap).length < 2) throw new Redraw('too few traps shown');
    const fig = new Fig();
    const ang = rng.int(-20, 20);
    const Cp: P2 = [6 + 0.1 * ang, 0.5];
    fig.pt(nA, [0, 0], [-1, 0]).pt(nB, [2.4 + 0.05 * ang, 2.8], [0, 1]).pt(nC, Cp, [1, 0]);
    fig.seg(nA, nB, `$${a}$`).seg(nB, nC, `$${b}$`).seg(nA, nC, undefined, quad);
    if (quad) {
      fig.pt(nD, [3.4 - 0.05 * ang, -2.4], [0, -1]).seg(nC, nD, `$${c}$`).seg(nD, nA, `$${e}$`);
    }
    const sides = quad
      ? `$${nA}${nB} = ${a}$, $${nB}${nC} = ${b}$, $${nC}${nD} = ${c}$, and $${nD}${nA} = ${e}$`
      : `$${nA}${nB} = ${a}$ and $${nB}${nC} = ${b}$`;
    const notes = trapNotes(
      choices,
      {
        'geo-fig-tri-degenerate': (vs) => `${vs} is exactly a sum or a difference of two sides: the three points would be collinear, so it is not a triangle`,
        'geo-fig-tri-one-bound': (vs) => `${vs} breaks one of the two limits, the sum or the difference`,
        'geo-fig-tri-one-triangle': (vs) => `${vs} fits one triangle but breaks the inequality in the other`,
      },
      2,
    );
    const stem = quad
      ? `In the figure, which is not drawn to scale, quadrilateral $${nA}${nB}${nC}${nD}$ has ${sides}. Which of the following could be the length of diagonal $${nA}${nC}$?`
      : `In the figure, which is not drawn to scale, triangle $${nA}${nB}${nC}$ has ${sides}. Which of the following could be the length of $${nA}${nC}$?`;
    const tri1 = `$${Math.abs(a - b)} < ${nA}${nC} < ${a + b}$`;
    const body = quad
      ? `Triangle $${nA}${nB}${nC}$ gives ${tri1}. Triangle $${nA}${nC}${nD}$ gives $${Math.abs(c - e)} < ${nA}${nC} < ${c + e}$. The diagonal belongs to both, so $${lo} < ${nA}${nC} < ${hi}$.`
      : `The third side of a triangle is greater than the difference and less than the sum of the other two: ${tri1}.`;
    return {
      params: { quad, a, b, c, d: e, vals, names: [nA, nB, nC, nD] },
      q: {
        format: 'mcs',
        stem,
        figure: fig.build(true),
        choices,
        answer: ans,
        explanation: `Recognize: a segment shared by triangles whose other sides are known is limited by the triangle inequality, whatever the drawing looks like.

${body} Only $${answer}$ lies strictly between $${lo}$ and $${hi}$ among the choices.

Check: with $${nA}${nC} = ${answer}$ ${quad ? 'both triangles' : 'the triangle'} can be built, since each side is less than the sum of the other two.

${notes}

Rule: every side of a triangle lies strictly between the difference and the sum of the other two; a shared side must satisfy both triangles.`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'format';
    // build the triangle(s) with fromSides: A=(0,0), C=(x,0); B above, D below
    const possible = (x: number): boolean => {
      const A: P2 = [0, 0];
      const C: P2 = [x, 0];
      const B = fromSides(A, C, p.a, p.b); // |AB| = a, |CB| = b
      if (!B) return false;
      if (!p.quad) return true;
      const D = fromSides(C, A, p.c, p.d); // |CD| = c, |AD| = d
      return !!D;
    };
    const exp = p.vals.map(possible);
    if (exp.filter(Boolean).length !== 1) return `${exp.filter(Boolean).length} possible choices`;
    return exp[q.answer] ? null : `choice ${q.answer} is not possible`;
  },
};

export const triangleBoundsTemplates = retryAll([bounds]);
