import { qcCompare, qcFromSamples } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import { qcEnd } from './util';

// New alg.sequences style (QC): sum of the first M terms of an alternating-sign sequence,
// by pairing consecutive terms; the slope t is sometimes only known to lie in a range.
export const alternatingSumTraps: Record<string, Trap> = {
  'alg-sq-sign': {
    label: 'Gave each pair of terms the wrong sign',
    fix: 'With $a_n = (-1)^{n+1}(tn + c)$ the odd-numbered term is added and the even-numbered term is subtracted, and the even term is larger, so each pair is negative: $-t$. Write the first two terms to see it.',
  },
  'alg-sq-pair-count': {
    label: 'Counted one pair per term instead of one pair per two terms',
    fix: 'Pairs use two terms each. The first $M$ terms (with $M$ even) make $\\frac{M}{2}$ pairs, not $M$.',
  },
  'alg-sq-drop-last': {
    label: 'Forgot the unpaired last term when the number of terms is odd',
    fix: 'An odd number of terms leaves one term without a partner. Add it after summing the pairs.',
  },
  'alg-sq-one-case': {
    label: 'Tested one allowed value of $t$ and concluded for all of them',
    fix: 'When $t$ can take several values, the sum changes with $t$. Compare the sum with the other quantity at both ends of the allowed range.',
  },
};

interface AParams {
  lo: number;
  hi: number;
  c: number;
  M: number;
  N: number;
}

const termSum = (t: number, c: number, M: number) => {
  let s = frac(0);
  for (let n = 1; n <= M; n++) s = s.add((n % 2 === 1 ? 1 : -1) * (t * n + c));
  return s;
};
/** Closed form from pairing: -kt for M = 2k, (k + 1)t + c for M = 2k + 1. */
const paired = (t: number, c: number, M: number) => (M % 2 === 0 ? frac((-M * t) / 2) : frac(((M + 1) / 2) * t + c));

const alternatingSumQC: Template<AParams> = {
  id: 'alg.sequences.alternating-sum-qc',
  skill: 'alg.sequences',
  format: 'qc',
  style: 'sum of an alternating-sign sequence by pairing terms',
  generate(rng, d) {
    for (;;) {
      const numeric = d === 1 || (d === 2 && rng.chance(0.5));
      const odd = d === 1 ? false : d === 2 ? rng.chance(0.6) : rng.chance(0.5);
      const k = d === 1 ? rng.int(5, 40) : rng.int(4, 30);
      const M = odd ? 2 * k + 1 : 2 * k;
      const c = rng.int(1, 9);
      const lo = numeric ? rng.int(2, 9) : rng.int(1, 4);
      const hi = numeric ? lo : lo + rng.int(1, 4);
      const ends = [paired(lo, c, M), paired(hi, c, M)];
      const sMin = ends[0].lt(ends[1]) ? ends[0] : ends[1];
      const sMax = ends[0].lt(ends[1]) ? ends[1] : ends[0];
      let N: number;
      let answer: QCChoice;
      const reach = rng.int(1, 6);
      if (numeric) {
        N = sMin.n + rng.pick([0, reach, -reach]);
        answer = qcCompare(sMin, N);
      } else {
        const goal = rng.pick<'A' | 'B' | 'D'>(['A', 'B', 'D']);
        if (goal === 'A') N = sMin.n - reach;
        else if (goal === 'B') N = sMax.n + reach;
        else N = rng.int(sMin.n, sMax.n);
        answer = qcFromSamples(Array.from({ length: hi - lo + 1 }, (_, j) => [paired(lo + j, c, M), N] as [Frac, number]));
        if (answer !== goal) continue;
      }
      if (Math.abs(N) > 400) continue;
      const t0 = lo;
      const sumText = `$a_1 + a_2 + \\cdots + a_{${M}}$`;
      const tText = numeric ? `${lo}` : 't';
      const info = numeric
        ? `The sequence $a_1, a_2, a_3, \\ldots$ is defined by $a_n = (-1)^{n+1}(${lo}n + ${c})$ for each positive integer $n$.`
        : `The sequence $a_1, a_2, a_3, \\ldots$ is defined by $a_n = (-1)^{n+1}(tn + ${c})$ for each positive integer $n$, where $t$ is an integer with $${lo} \\le t \\le ${hi}$.`;
      const traps: QCQuestion['traps'] = {};
      const flag = (value: Frac, id: string) => {
        const a = qcCompare(value, N);
        if (a !== answer && !traps[a]) traps[a] = id;
      };
      if (numeric) {
        if (odd) {
          flag(frac((-(M - 1) * lo) / 2), 'alg-sq-drop-last');
          flag(frac(((3 * (M - 1)) / 2 + 1) * lo + c), 'alg-sq-sign');
        } else {
          flag(frac((M * lo) / 2), 'alg-sq-sign');
          flag(frac(-M * lo), 'alg-sq-pair-count');
        }
      } else if (answer === 'D') {
        traps[qcCompare(paired(lo, c, M), N)] = 'alg-sq-one-case';
      } else {
        flag(odd ? frac(((M - 1) / 2) * -lo) : frac((M * lo) / 2), odd ? 'alg-sq-drop-last' : 'alg-sq-sign');
      }
      const pair = `a_{2j-1} + a_{2j} = (${tText}(2j-1) + ${c}) - (${tText}\\cdot 2j + ${c}) = -${tText}`;
      const k2 = (M - (odd ? 1 : 0)) / 2;
      const rule = `Rule: pair neighbouring terms when the signs alternate.`;
      let body: string;
      if (numeric) {
        const total = paired(lo, c, M);
        body = `The signs alternate, so pair the terms: $${pair}$ for every $j$. The first ${2 * k2} terms make $${k2}$ pairs, with sum $${k2}\\cdot(-${lo}) = ${num(-k2 * lo)}$.${odd ? ` The last term is unpaired: $a_{${M}} = ${num(M * lo + c)}$, so the total is $${num(-k2 * lo)} + ${num(M * lo + c)} = ${num(total)}$.` : ''}

Compare $${num(total)}$ with $${num(N)}$. ${qcEnd(answer)}`;
      } else {
        const sLo = paired(lo, c, M);
        const sHi = paired(hi, c, M);
        body = `The signs alternate, so pair the terms: $${pair}$ for every $j$. The first ${2 * k2} terms make $${k2}$ pairs with sum $-${k2}t$${odd ? `, and the unpaired last term is $a_{${M}} = ${M}t + ${c}$, so the total is $${k2 + 1}t + ${c}$` : ''}.

With $t = ${lo}$ the sum is $${num(sLo)}$ and with $t = ${hi}$ it is $${num(sHi)}$; since $t$ is an integer from $${lo}$ to $${hi}$, the sum takes only the values in between. So the sum lies between $${num(sMin)}$ and $${num(sMax)}$, ends included, while the other quantity is $${num(N)}$. ${qcEnd(answer)}`;
      }
      const why = Object.entries(traps).length
        ? (() => {
            const [letter, id] = Object.entries(traps)[0];
            const lab: Record<string, string> = {
              'alg-sq-sign': `giving each pair the wrong sign would point to ${letter}`,
              'alg-sq-pair-count': `counting a pair for every term would point to ${letter}`,
              'alg-sq-drop-last': `leaving out the unpaired last term would point to ${letter}`,
              'alg-sq-one-case': `testing only $t = ${t0}$ would point to ${letter}`,
            };
            return lab[id];
          })()
        : 'a sign slip in one pair spreads over all the pairs';
      return {
        params: { lo, hi, c, M, N },
        q: {
          format: 'qc',
          info,
          quantityA: sumText,
          quantityB: `$${num(N)}$`,
          answer,
          traps: Object.keys(traps).length ? traps : undefined,
          explanation: `${body}

Trap: ${why}. ${rule}`,
        },
      };
    }
  },
  check(q, P) {
    if (q.format !== 'qc') return 'wrong format';
    const samples: [Frac, number][] = [];
    for (let t = P.lo; t <= P.hi; t++) samples.push([termSum(t, P.c, P.M), P.N]);
    const got = qcFromSamples(samples);
    return got === q.answer ? null : `expected ${got}, keyed ${q.answer}`;
  },
};

export const alternatingSumTemplates: Template<any>[] = [alternatingSumQC];
