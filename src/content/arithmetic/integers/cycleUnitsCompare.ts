import { qcCompare, qcFromSamples } from '../../../engine/build';
import { lin } from '../../../engine/tex';
import type { QCChoice, Template, Trap } from '../../../engine/types';
import { QC_WORDS, expectQc } from './util';

export const cycleUnitsCompareTraps: Record<string, Trap> = {
  'cycle-units-one-n': {
    label: 'Tested one value of n and generalized',
    fix: 'When the exponent changes with $n$, the units digit may change too. Find the cycle of units digits, then see which positions of the cycle $n$ can reach. One value of $n$ proves nothing for "cannot be determined".',
  },
};

type NType = 'positive' | 'multiple' | 'odd' | 'above';
interface P {
  b: number;
  c: number;
  r: number;
  type: NType;
  m: number;
  k: number;
}

const cycleOf = (b: number) => {
  const out: number[] = [];
  for (let x = b % 10; !out.includes(x); x = (x * b) % 10) out.push(x);
  return out;
};
const allowed = (type: NType, m: number, count: number) => Array.from({ length: count }, (_, i) => (type === 'positive' ? i + 1 : type === 'multiple' ? m * (i + 1) : type === 'odd' ? 2 * i + 1 : m + 1 + i));

const BASES: Record<number, number[]> = { 1: [2, 3, 7, 8], 2: [2, 3, 4, 7, 8, 9, 12, 13, 17, 18], 3: [2, 3, 4, 7, 8, 9, 13, 14, 17, 19] };

const unitsCompare: Template<P> = {
  id: 'arith.cycles.units-digit-compare-qc',
  skill: 'arith.cycles',
  format: 'qc',
  style: 'units digit of b^(cn + r) with n unknown, compared with a digit',
  generate(rng, diff) {
    for (;;) {
      const b = rng.pick(BASES[diff]);
      const cyc = cycleOf(b);
      const L = cyc.length;
      const c = rng.pick(diff === 1 ? [1, 2, 4] : [1, 2, 3, 4, 5, 8]);
      const r = rng.int(diff === 1 ? 1 : 0, 3);
      const type: NType = diff === 1 ? 'positive' : rng.pick<NType>(['positive', 'multiple', 'odd', 'above']);
      const m = type === 'multiple' ? rng.pick([2, 3, 4]) : type === 'above' ? rng.int(2, 6) : 0;
      const ns = allowed(type, m, 48);
      const digit = (n: number) => cyc[(c * n + r - 1) % L];
      if (c * ns[0] + r < 1) continue;
      const seen = [...new Set(ns.map(digit))].sort((x, y) => x - y);
      const lo = seen[0];
      const hi = seen[seen.length - 1];
      let k: number;
      if (seen.length === 1) k = rng.chance(0.35) ? lo : rng.int(0, 9);
      else {
        const roll = rng.next();
        k = roll < 0.55 ? rng.int(lo, hi) : roll < 0.78 ? Math.min(9, hi + rng.int(1, 3)) : Math.max(0, lo - rng.int(1, 3));
      }
      const answer: QCChoice = qcFromSamples(ns.map((n): [number, number] => [digit(n), k]));
      if (seen.length > 1 && answer !== 'D' && rng.chance(0.4)) continue;
      const one = qcCompare(digit(ns[0]), k);
      const base = qcCompare(b % 10, k);
      const traps: Partial<Record<QCChoice, string>> = {};
      if (one !== answer) traps[one] = 'cycle-units-one-n';
      else if (base !== answer) traps[base] = 'units-base-digit';
      const cond = type === 'positive' ? '$n$ is a positive integer.' : type === 'multiple' ? `$n$ is a positive multiple of ${m}.` : type === 'odd' ? '$n$ is a positive odd integer.' : `$n$ is an integer greater than ${m}.`;
      const expo = lin([[c, 'n'], [r, '']]);
      const pos = [...new Set(ns.map((n) => ((c * n + r - 1) % L) + 1))].sort((x, y) => x - y);
      const two = ns.find((n) => qcCompare(digit(n), k) !== qcCompare(digit(ns[0]), k));
      const explanation = `Units digits of powers repeat in a cycle: the powers of ${b} end in ${cyc.join(', ')}, a cycle of length ${L}.

${
  seen.length === 1
    ? `For every allowed $n$ the exponent $${expo}$ falls on the same place of the cycle, so Quantity A is always ${lo}.`
    : `As $n$ varies, the exponent $${expo}$ visits positions ${pos.join(', ')} of the cycle, so Quantity A takes the values ${seen.join(', ')}.`
}

Compare with ${k}: ${
        answer === 'D'
          ? `$n = ${ns[0]}$ gives ${digit(ns[0])} and $n = ${two}$ gives ${digit(two!)}, and they compare differently with ${k}, so the relationship cannot be determined. (D)`
          : `${QC_WORDS[answer]}. (${answer})`
      }

Trap: ${
        answer === 'D'
          ? `trying only $n = ${ns[0]}$ shows ${digit(ns[0])} and suggests a firm answer, but another $n$ changes the digit.`
          : `keeping the units digit ${b % 10} of the base ignores the exponent: $${b}^{2}$ ends in ${(b * b) % 10}, not ${b % 10}.`
      }`;
      return {
        params: { b, c, r, type, m, k },
        q: { format: 'qc', info: cond, quantityA: `The units digit of $${b}^{${expo}}$`, quantityB: `$${k}$`, answer, ...(Object.keys(traps).length ? { traps } : {}), explanation },
      };
    }
  },
  check(q, { b, c, r, type, m, k }) {
    const ns = allowed(type, m, 48);
    const samples = ns.map((n): [number, number] => {
      let u = 1;
      for (let i = 0; i < c * n + r; i++) u = (u * b) % 10;
      return [u, k];
    });
    return expectQc(q, qcFromSamples(samples));
  },
};

export const cycleUnitsCompareTemplates: Template<any>[] = [unitsCompare];
