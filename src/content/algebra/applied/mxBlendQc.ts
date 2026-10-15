import { qcCompare, qcFromSamples } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import { dx, expectQc, qcEnd } from './util';

// alg.mixtures-interest: where a mixture lands depends on the amounts used (quantity comparison).
// Uses the shared traps 'algw-average-percents' and 'algw-condition-reversed'.
export const mxBlendTraps: Record<string, Trap> = {};

type Cond = 'none' | 'more-q' | 'more-p' | 'equal' | 'twice-q' | 'twice-p' | 'atleast-twice-q' | 'atmost-half-q';

interface BlendParams {
  p: number;
  q: number;
  cond: Cond;
  c: Frac;
}

/** Ratio r = (amount of the stronger solution) / (amount of the weaker one) allowed by each condition. */
const RANGE: Record<Cond, { lo: Frac; loIn: boolean; hi: Frac | null; hiIn: boolean }> = {
  none: { lo: frac(0), loIn: false, hi: null, hiIn: false },
  'more-q': { lo: frac(1), loIn: false, hi: null, hiIn: false },
  'more-p': { lo: frac(0), loIn: false, hi: frac(1), hiIn: false },
  equal: { lo: frac(1), loIn: true, hi: frac(1), hiIn: true },
  'twice-q': { lo: frac(2), loIn: true, hi: frac(2), hiIn: true },
  'twice-p': { lo: frac(1, 2), loIn: true, hi: frac(1, 2), hiIn: true },
  'atleast-twice-q': { lo: frac(2), loIn: true, hi: null, hiIn: false },
  'atmost-half-q': { lo: frac(0), loIn: false, hi: frac(1, 2), hiIn: true },
};

/** Percent of the mixture when r times as much of the q percent solution as of the p percent solution is used. */
const conc = (p: number, q: number, r: Frac) => frac(p).add(r.mul(q)).div(r.add(1));

function analytic(p: number, q: number, cond: Cond, c: Frac): QCChoice {
  const R = RANGE[cond];
  const low = conc(p, q, R.lo);
  const high = R.hi ? conc(p, q, R.hi) : frac(q);
  const lowIn = R.lo.sign() === 0 ? false : R.loIn;
  const highIn = R.hi ? R.hiIn : false;
  if (R.hi && R.lo.eq(R.hi) && low.eq(c)) return 'C';
  if (low.gt(c) || (low.eq(c) && !lowIn)) return 'A';
  if (high.lt(c) || (high.eq(c) && !highIn)) return 'B';
  return 'D';
}

const SUBST = [
  { solution: 'acid solution', s: 'acid' },
  { solution: 'salt solution', s: 'salt' },
  { solution: 'sugar solution', s: 'sugar' },
  { solution: 'alcohol solution', s: 'alcohol' },
];

export const mxBlendQc: Template<BlendParams> = {
  id: 'alg.mixtures-interest.blend-compare-qc',
  skill: 'alg.mixtures-interest',
  format: 'qc',
  style: 'compare a mixture with a number when only the amounts are restricted',
  generate(rng, d) {
    const S = rng.pick(SUBST);
    const want = rng.pick<QCChoice>(['A', 'A', 'B', 'B', 'C', 'D', 'D']);
    const conds: Cond[] = d === 1 ? ['equal', 'more-q', 'more-p', 'none'] : d === 2 ? ['more-q', 'more-p', 'twice-q', 'twice-p', 'none'] : ['atleast-twice-q', 'atmost-half-q', 'twice-q', 'twice-p', 'more-q', 'more-p'];
    for (;;) {
      const p = rng.int(1, 8) * 5;
      const q = p + rng.int(2, 9) * 5;
      if (q > 90) continue;
      const cond = rng.pick(conds);
      const R = RANGE[cond];
      // c sits near a threshold of the allowed range, in steps of half a percent.
      const anchor = R.lo.sign() === 0 && R.hi ? conc(p, q, R.hi) : R.lo.sign() === 0 ? frac(p + q, 2) : conc(p, q, R.lo);
      const c = anchor.add(frac(rng.int(-6, 6), 2));
      if (c.sign() <= 0 || !c.mul(2).isInt()) continue;
      if (d === 1 && want === 'C' && cond !== 'equal') continue;
      const answer = analytic(p, q, cond, c);
      if (answer !== want) continue;
      const mid = frac(p + q, 2);
      const traps: QCQuestion['traps'] = {};
      const avgAns = qcCompare(mid, c);
      if (avgAns !== answer) traps[avgAns] = 'algw-average-percents';
      const reversed: QCChoice = answer === 'A' ? 'B' : answer === 'B' ? 'A' : answer;
      if (cond !== 'none' && cond !== 'equal' && cond !== 'twice-q' && cond !== 'twice-p' && reversed !== answer && !(reversed in traps)) traps[reversed] = 'algw-condition-reversed';
      const condText: Record<Cond, string> = {
        none: '',
        'more-q': ` More of the ${q} percent solution than of the ${p} percent solution is used.`,
        'more-p': ` More of the ${p} percent solution than of the ${q} percent solution is used.`,
        equal: ' Equal amounts of the two solutions are used.',
        'twice-q': ` Twice as much of the ${q} percent solution as of the ${p} percent solution is used.`,
        'twice-p': ` Twice as much of the ${p} percent solution as of the ${q} percent solution is used.`,
        'atleast-twice-q': ` At least twice as much of the ${q} percent solution as of the ${p} percent solution is used.`,
        'atmost-half-q': ` At most half as much of the ${q} percent solution as of the ${p} percent solution is used.`,
      };
      // Two allowed amount ratios with different outcomes, for the D explanation.
      const pool: Frac[] = [];
      for (let k = 1; k <= 400; k++) for (const x of [frac(k), frac(1, k), frac(k, 3), frac(3, k)]) pool.push(x);
      const ok = pool.filter((r) => {
        const aboveLow = r.gt(R.lo) || (R.loIn && r.eq(R.lo));
        const belowHigh = !R.hi || r.lt(R.hi) || (R.hiIn && r.eq(R.hi));
        return aboveLow && belowHigh && conc(p, q, r).mul(10).isInt();
      });
      const rel = (r: Frac) => conc(p, q, r).cmp(c);
      const w1 = ok[0];
      const w2 = ok.find((r) => rel(r) !== rel(w1));
      if (answer === 'D' && (!w1 || !w2)) continue;
      const word = (r: Frac) => {
        // r times as much of the strong solution as of the weak one, in tens of liters to avoid a single liter
        const m = conc(p, q, r);
        return `${r.n * 10} liters of the ${q} percent solution with ${r.d * 10} liters of the ${p} percent solution give ${dx(m)} percent, which is ${m.gt(c) ? 'above' : m.lt(c) ? 'below' : 'equal to'} ${dx(c)}`;
      };
      const lowText = `${dx(conc(p, q, R.lo))}`;
      const why =
        answer === 'D'
          ? `Both outcomes are possible: ${word(w1)}; ${word(w2!)}. ${qcEnd('D')}`
          : answer === 'C'
            ? `The mixture is exactly ${dx(c)} percent. ${qcEnd('C')}`
            : R.hi && R.lo.eq(R.hi)
              ? `The mixture is ${dx(conc(p, q, R.lo))} percent, which is ${answer === 'A' ? 'greater' : 'less'} than ${dx(c)} percent. ${qcEnd(answer)}`
              : `Every allowed mixture is ${answer === 'A' ? 'above' : 'below'} ${dx(c)} percent. ${qcEnd(answer)}`;
      const detail =
        cond === 'none'
          ? `With no restriction the mixture can be anywhere strictly between ${p} and ${q} percent.`
          : R.hi && R.lo.eq(R.hi)
            ? `With ${cond.startsWith('twice') ? 'those amounts' : 'equal amounts'} the mixture is exactly ${lowText} percent.`
            : cond === 'more-q' || cond === 'more-p'
              ? `Using more of one solution pulls the mixture past the plain average of ${dx(mid)} percent toward that solution, but never as far as ${cond === 'more-q' ? q : p} percent.`
              : `At the limit amounts the mixture is ${R.lo.sign() === 0 ? dx(conc(p, q, R.hi!)) : lowText} percent, and ${cond === 'atleast-twice-q' ? 'more of the stronger solution only raises it, toward' : 'less of the stronger solution only lowers it, toward'} ${cond === 'atleast-twice-q' ? q : p} percent.`;
      return {
        params: { p, q, cond, c },
        q: {
          format: 'qc',
          info: `A ${p} percent ${S.solution} is mixed with a ${q} percent ${S.solution}.${condText[cond]}`,
          quantityA: `The percent of ${S.s} in the mixture`,
          quantityB: `$${dx(c)}$`,
          answer,
          traps: Object.keys(traps).length ? traps : undefined,
          explanation: `A mixture is a weighted average of ${p} and ${q}, nearer to the solution used in larger amount. ${detail}

${why}

Trap: averaging the percents, $\\frac{${p} + ${q}}{2} = ${dx(mid)}$, is right only for equal amounts. Rule: the amounts, not the percents alone, place the mixture between the two strengths.`,
        },
      };
    }
  },
  check(q, { p, q: qq, cond, c }) {
    // Sample amount ratios on a fine grid, keep those the condition allows, and compare each exact mixture with c.
    const R = RANGE[cond];
    const samples: [Frac, Frac][] = [];
    const grid: Frac[] = [R.lo, ...(R.hi ? [R.hi] : [])];
    for (let k = 1; k <= 400; k++) grid.push(frac(k, 20), frac(k, 4), frac(1, k), frac(k * 10), frac(1, k * 10));
    for (const r of grid) {
      if (r.sign() <= 0) continue;
      const above = r.gt(R.lo) || (R.loIn && r.eq(R.lo));
      const below = !R.hi || r.lt(R.hi) || (R.hiIn && r.eq(R.hi));
      if (above && below) samples.push([conc(p, qq, r), c]);
    }
    if (!samples.length) return 'no allowed ratio';
    return expectQc(q, qcFromSamples(samples));
  },
};
