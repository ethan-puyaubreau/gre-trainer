import { qcFromSamples } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import { expectQc, qcEnd } from './util';

// alg.rate-work: time together compared with a fraction of one machine's time, with an unknown second time (QC).

export const rwThresholdTraps: Record<string, Trap> = {
  'algw-machines-identical': {
    label: 'Treated the second machine as if it had the same rate as the first',
    fix: 'Two identical machines halve the time, but a slower second machine saves less than that and a faster one saves more. Compare the actual rates.',
  },
};

type Cond = 'gt' | 'lt' | 'range' | 'eq' | 'none';

interface ThresholdParams {
  a: number;
  k: number;
  cond: Cond;
  c: number;
  hi: number;
}

const JOBS = [
  { A: 'Machine P', B: 'Machine Q', both: 'the two machines', job: 'fill a production order' },
  { A: 'Pump X', B: 'Pump Y', both: 'the two pumps', job: 'fill a tank' },
  { A: 'Printer A', B: 'Printer B', both: 'the two printers', job: 'print a batch of flyers' },
  { A: 'Crew 1', B: 'Crew 2', both: 'the two crews', job: 'pave a stretch of road' },
];

/** Hours for both together when P alone needs a and Q alone needs t. */
const together = (a: number | Frac, t: number | Frac) => frac(1).div(frac(1).div(a).add(frac(1).div(t)));

/** Sign of (together - B) is the sign of (t - t0), where t0 = aB / (a - B) = k m for a = k(k-1)m. */
function analytic(cond: Cond, c: number, hi: number, t0: number): QCChoice {
  if (cond === 'none') return 'D';
  if (cond === 'eq') return c > t0 ? 'A' : c < t0 ? 'B' : 'C';
  if (cond === 'gt') return c >= t0 ? 'A' : 'D';
  if (cond === 'lt') return c <= t0 ? 'B' : 'D';
  return c >= t0 ? 'A' : hi <= t0 ? 'B' : 'D';
}

const allowed = (cond: Cond, c: number, hi: number, t: Frac) =>
  cond === 'none' ? t.sign() > 0 : cond === 'eq' ? t.eq(c) : cond === 'gt' ? t.gt(c) : cond === 'lt' ? t.sign() > 0 && t.lt(c) : t.gt(c) && t.lt(hi);

export const rwThresholdQc: Template<ThresholdParams> = {
  id: 'alg.rate-work.threshold-qc',
  skill: 'alg.rate-work',
  format: 'qc',
  style: 'time together versus a fraction of one time, second time unknown',
  generate(rng, d) {
    const J = rng.pick(JOBS);
    const want = rng.pick<QCChoice>(d === 1 ? ['A', 'A', 'B', 'B', 'D', 'D'] : ['A', 'A', 'B', 'B', 'C', 'D', 'D']);
    for (;;) {
      const k = d === 1 ? 2 : d === 2 ? rng.int(2, 4) : rng.int(3, 5);
      const m = rng.int(1, d === 1 ? 4 : 3);
      const a = k * (k - 1) * m;
      const t0 = k * m;
      const cond = rng.pick<Cond>(d === 1 ? ['gt', 'lt', 'none'] : d === 2 ? ['gt', 'lt', 'none', 'eq'] : ['gt', 'lt', 'range', 'eq', 'none']);
      const c = Math.max(1, t0 + rng.int(-Math.floor(t0 * 0.7), 7));
      const hi = c + rng.int(3, 10);
      if (analytic(cond, c, hi, t0) !== want) continue;
      if (cond === 'eq' && want !== 'C' && rng.chance(0.5)) continue;
      const B = (k - 1) * m;
      const answer = want;
      const Bt = `$${B}$`;
      const info =
        `${J.A}, working alone at its constant rate, can ${J.job} in ${a} hours. ${J.B}, working alone at its constant rate, can ${J.job} in ${cond === 'eq' ? `${c} ${c === 1 ? 'hour' : 'hours'}` : '$t$ hours'}${
          cond === 'gt' ? `, where $t > ${c}$` : cond === 'lt' ? `, where $t < ${c}$` : cond === 'range' ? `, where $${c} < t < ${hi}$` : ''
        }.`;
      // Two witnesses with different outcomes (whole hours first, then quarter hours and the threshold itself).
      const pool = [...Array.from({ length: 300 }, (_, i) => frac(i + 1)), frac(t0), ...Array.from({ length: 1200 }, (_, i) => frac(i + 1, 4))].filter((t) => allowed(cond, c, hi, t));
      const outcome = (t: Frac) => together(a, t).cmp(B);
      const w1 = pool[0];
      const w2 = pool.find((t) => outcome(t) !== outcome(w1));
      const cmp = (t: Frac) => (together(a, t).gt(B) ? 'more than' : together(a, t).lt(B) ? 'less than' : 'exactly');
      const wit = (t: Frac) => `$t = ${t}$ gives $\\frac{${a} \\cdot ${t}}{${a} + ${t}} = ${num(together(a, t))}$ hours`;
      const why =
        answer === 'D'
          ? `Allowed values give different outcomes: ${wit(w1)}, which is ${cmp(w1)} ${B}, while ${wit(w2!)}, which is ${cmp(w2!)} ${B}. ${qcEnd('D')}`
          : answer === 'C'
            ? `Here $t = ${t0}$, so the time together is exactly ${B}. ${qcEnd('C')}`
            : `Every allowed $t$ lies ${answer === 'A' ? 'above' : 'below'} ${t0}, so the time together is ${answer === 'A' ? 'more' : 'less'} than ${B}. ${qcEnd(answer)}`;
      const traps: QCQuestion['traps'] = k === 2 && answer !== 'C' ? { C: 'algw-machines-identical' } : undefined;
      const trapText = k === 2 ? `if ${J.B.split(' ')[0] === 'Machine' ? 'the second machine' : 'the second one'} matched the first, the time together would be exactly ${a / 2}, but only $t = ${a}$ gives that` : `comparing $t$ with ${a} instead of with the threshold ${t0} puts the cut in the wrong place`;
      return {
        params: { a, k, cond, c, hi },
        q: {
          format: 'qc',
          info,
          quantityA: `The number of hours it takes ${J.both}, working together at their constant rates, to ${J.job}`,
          quantityB: Bt,
          answer,
          traps,
          explanation: `Rates add: the time together is $T = \\frac{${a}t}{${a} + t}$. Compare it with ${B}: $T > ${B}$ exactly when $${a}t > ${B === 1 ? '' : B}(${a} + t)$, that is, $${a - B === 1 ? '' : a - B}t > ${a * B}$, so when $t > ${t0}$; $T < ${B}$ when $t < ${t0}$, and $T = ${B}$ at $t = ${t0}$.

${why}

Trap: ${trapText}. Rule: a threshold on one rate decides the comparison, so test both sides of it.`,
        },
      };
    }
  },
  check(q, { a, k, cond, c, hi }) {
    // Sample allowed second times (including the exact threshold) and compare the exact time together with a/k.
    const B = frac(a, k);
    const t0 = frac(a, k - 1);
    const cands: Frac[] = [t0, frac(c), frac(hi)];
    for (let i = 1; i <= 300; i++) cands.push(frac(i, 4));
    const samples: [Frac, Frac][] = cands.filter((t) => allowed(cond, c, hi, t)).map((t) => [together(a, t), B]);
    if (!samples.length) return 'no allowed value of t';
    return expectQc(q, qcFromSamples(samples));
  },
};
