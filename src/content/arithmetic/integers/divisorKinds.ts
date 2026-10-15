import { qcCompare, qcFromSamples } from '../../../engine/build';
import type { QCChoice, Template, Trap } from '../../../engine/types';
import { QC_WORDS, expectQc } from './util';

export const divisorKindsTraps: Record<string, Trap> = {
  'int-count-even-half': {
    label: 'Assumed half of the divisors are even',
    fix: 'An even divisor uses the factor 2 at least once. With $2^k$ there are $k$ ways to choose it (powers 1 to $k$) but only 1 way to avoid it (power 0), so evens outnumber odds by a factor of $k$.',
  },
  'int-count-divide-counts': {
    label: 'Divided the divisor counts instead of counting the quotients',
    fix: 'The divisors of $n$ that are multiples of $M$ are $M$ times the divisors of $n/M$. Count those: subtract exponents first, then add 1 to each.',
  },
  'int-count-fixed-sum': {
    label: 'Assumed the count is the same for every split of the exponents',
    fix: 'If only the sum of the exponents is fixed, $(a + 1)(b + 1)$ changes with the split: 3 + 3 gives 16 divisors, 1 + 5 gives only 12. Compare the smallest and largest counts with the number.',
  },
  'int-count-square-halving': {
    label: 'Rounded the half-exponent up when counting square divisors',
    fix: 'A square divisor uses even exponents only: for $p^a$ they are $0, 2, \\ldots$, up to the largest even number not above $a$. That is $\\lfloor a/2 \\rfloor + 1$ choices, so $p^5$ gives 3, not 4.',
  },
};

type Kind = 'even-odd' | 'multiples' | 'fixed-sum' | 'squares';
interface P {
  kind: Kind;
  e: number[]; // exponents used by the kind
  ps: number[];
  lo: number;
  hi: number;
  M: number[];
  k: number;
}

/** All positive divisors of n by trial division up to the square root. */
function divisorsOf(n: number): number[] {
  const out: number[] = [];
  for (let i = 1; i * i <= n; i++) if (n % i === 0) out.push(i, ...(i * i === n ? [] : [n / i]));
  return out;
}
const pw = (p: number, e: number) => (e === 0 ? '' : e === 1 ? `${p}` : `${p}^{${e}}`);
const dot = (xs: string[]) => xs.filter(Boolean).join(' \\cdot ');
const isSquare = (n: number) => Math.round(Math.sqrt(n)) ** 2 === n;

const KINDS: Record<number, Kind[]> = {
  1: ['even-odd', 'multiples', 'even-odd'],
  2: ['even-odd', 'fixed-sum', 'squares', 'multiples'],
  3: ['fixed-sum', 'fixed-sum', 'squares', 'even-odd'],
};

const divisorKindsQC: Template<P> = {
  id: 'arith.factors.divisor-kinds-qc',
  skill: 'arith.factors',
  format: 'qc',
  style: 'compare counts of even/odd, square or multiple-of-M divisors (exponent k unknown)',
  generate(rng, diff) {
    for (;;) {
      const kind = rng.pick(KINDS[diff]);
      const ps = rng.sample([3, 5, 7], 2);
      let info = '';
      let quantityA = '';
      let quantityB = '';
      let answer: QCChoice;
      let trapAns: QCChoice | null = null;
      let trapId = '';
      let explanation = '';
      const p: P = { kind, e: [], ps, lo: 0, hi: 0, M: [], k: 0 };
      if (kind === 'even-odd') {
        const b = rng.int(1, 3);
        const c = rng.int(1, 2);
        const lo = rng.pick([0, 1, 1, 2, 3]);
        const hi = rng.pick([lo, lo + 1, lo + 2, 9, 9]);
        p.e = [b, c];
        p.lo = lo;
        p.hi = hi;
        const ks = Array.from({ length: Math.min(hi, lo + 6) - lo + 1 }, (_, i) => lo + i);
        answer = qcFromSamples(ks.map((k): [number, number] => [k, 1]));
        const cond = lo === hi ? `$k = ${lo}$` : hi === 9 ? (lo === 0 ? '$k$ is a nonnegative integer' : lo === 1 ? '$k$ is a positive integer' : `$k$ is an integer and $k \\ge ${lo}$`) : `$k$ is an integer with $${lo} \\le k \\le ${hi}$`;
        info = `$n = ${dot(['2^{k}', pw(ps[0], b), pw(ps[1], c)])}$, where ${cond}.`;
        quantityA = 'The number of even positive divisors of $n$';
        quantityB = 'The number of odd positive divisors of $n$';
        const X = (b + 1) * (c + 1);
        trapAns = 'C';
        trapId = 'int-count-even-half';
        explanation = `Write $n = 2^k \\cdot m$ with $m = ${dot([pw(ps[0], b), pw(ps[1], c)])}$ odd. An odd divisor uses no factor 2, so it divides $m$: there are $(${b} + 1)(${c} + 1) = ${X}$ of them. An even divisor uses one of $2, 2^2, \\ldots, 2^k$, which is $k$ choices, times the ${X} divisors of $m$: $${X}k$ of them.

So the question compares $${X}k$ with ${X}, that is $k$ with 1. ${
          answer === 'D' ? `Here $k$ can be ${ks.slice(0, 3).join(', ')}, so $k$ is not always on the same side of 1: the relationship cannot be determined. (D)` : `Every allowed $k$ gives the same result, so ${QC_WORDS[answer]}. (${answer})`
        }

Trap: assuming even and odd divisors are equally many makes the quantities equal, but $2^k$ gives $k$ times as many evens as odds.`;
      } else if (kind === 'fixed-sum') {
        const s = rng.int(4, diff === 3 ? 9 : 7);
        const q2 = rng.pick([2, 3, 5]);
        const q3 = rng.pick([7, 11, 13]);
        p.e = [s];
        p.ps = [q2, q3];
        const lo = 2 * s;
        const hi = s + 1 + Math.floor((s * s) / 4);
        const roll = rng.next();
        const k = roll < 0.4 ? rng.int(lo, hi) : roll < 0.7 ? lo - rng.int(1, 4) : hi + rng.int(1, 4);
        if (k < 1) continue;
        p.k = k;
        answer = k < lo ? 'A' : k > hi ? 'B' : lo === hi ? qcCompare(lo, k) : 'D';
        const mid = (Math.floor(s / 2) + 1) * (Math.ceil(s / 2) + 1);
        trapAns = answer === 'D' ? qcCompare(mid, k) : null;
        trapId = 'int-count-fixed-sum';
        info = `$n = ${q2}^{a} \\cdot ${q3}^{b}$, where $a$ and $b$ are positive integers and $a + b = ${s}$.`;
        quantityA = 'The number of positive divisors of $n$';
        quantityB = `$${k}$`;
        explanation = `The number of divisors is $(a + 1)(b + 1) = ab + a + b + 1 = ab + ${s + 1}$, and $ab$ depends on how ${s} is split.

The extreme splits are $a = 1$, $b = ${s - 1}$ (smallest, $ab = ${s - 1}$, so ${lo} divisors) and the most even split ($ab = ${Math.floor((s * s) / 4)}$, so ${hi} divisors). Quantity A ranges from ${lo} up to ${hi}.

${answer === 'D' ? `${k} is not below or above that whole range, so different splits compare differently with ${k}. (D)` : `${k} is ${k < lo ? 'below' : 'above'} the whole range, so ${QC_WORDS[answer]}. (${answer})`}

Trap: using one convenient split, such as $a = ${Math.floor(s / 2)}$, gives ${mid} divisors, but another split changes the count.`;
      } else if (kind === 'squares') {
        const e = [rng.int(2, 6), rng.int(1, 5), rng.int(1, 4)];
        p.e = e;
        const sq = e.reduce((t, x) => t * (Math.floor(x / 2) + 1), 1);
        const wrong = e.reduce((t, x) => t * (Math.ceil(x / 2) + 1), 1);
        const k = rng.chance(0.4) ? sq : rng.chance(0.5) ? wrong : sq + rng.pick([-2, -1, 1, 2]);
        if (k < 1 || wrong === sq) continue;
        p.k = k;
        answer = qcCompare(sq, k);
        trapAns = qcCompare(wrong, k);
        trapId = 'int-count-square-halving';
        info = `$n = ${dot(['2^{' + e[0] + '}', pw(ps[0], e[1]), pw(ps[1], e[2])])}$.`;
        quantityA = 'The number of positive divisors of $n$ that are perfect squares';
        quantityB = `$${k}$`;
        explanation = `A divisor of $n$ is a perfect square exactly when every prime in it has an even exponent. For an exponent $e$ in $n$, the allowed even exponents are $0, 2, \\ldots$ up to $e$: $\\lfloor e/2 \\rfloor + 1$ choices.

The exponents ${e.join(', ')} give $${e.map((x) => Math.floor(x / 2) + 1).join(' \\cdot ')} = ${sq}$ square divisors.

Compare ${sq} with ${k}: ${QC_WORDS[answer]}. (${answer})

Trap: rounding half-exponents up counts $${e.map((x) => Math.ceil(x / 2) + 1).join(' \\cdot ')} = ${wrong}$, but an odd exponent cannot be used whole in a square.`;
      } else {
        const a = rng.int(2, 5);
        const b = rng.int(1, 4);
        const c = rng.int(1, 3);
        const x = rng.int(1, a);
        const y = rng.int(0, b);
        p.e = [a, b, c];
        p.M = [x, y];
        const r = rng.pick([5, 7, 11]);
        p.ps = [r];
        const count = (a - x + 1) * (b - y + 1) * (c + 1);
        const wrong = Math.floor(((a + 1) * (b + 1) * (c + 1)) / ((x + 1) * (y + 1)));
        const k = rng.chance(0.35) ? count : rng.chance(0.5) ? wrong : count + rng.pick([-3, -2, -1, 1, 2, 3]);
        if (k < 1 || wrong === count) continue;
        p.k = k;
        answer = qcCompare(count, k);
        trapAns = qcCompare(wrong, k);
        trapId = 'int-count-divide-counts';
        const M = 2 ** x * 3 ** y;
        info = `$n = ${dot([pw(2, a), pw(3, b), pw(r, c)])}$.`;
        quantityA = `The number of positive divisors of $n$ that are multiples of ${M}`;
        quantityB = `$${k}$`;
        explanation = `${M} $= ${dot([pw(2, x), pw(3, y)])}$, so a divisor of $n$ is a multiple of ${M} when it keeps at least $${pw(2, x)}$${y ? ` and $${pw(3, y)}$` : ''}. Its exponents can then be ${x === a ? `exactly ${a}` : `${x} to ${a}`} for 2${y ? `, ${y} to ${b} for 3` : `, 0 to ${b} for 3`} and 0 to ${c} for ${r}.

That gives $(${a} - ${x} + 1)(${b} - ${y} + 1)(${c} + 1) = ${count}$ divisors.

Compare ${count} with ${k}: ${QC_WORDS[answer]}. (${answer})

Trap: dividing the divisor counts of $n$ and of ${M} gives ${wrong}, which is not the count of multiples.`;
      }
      return {
        params: p,
        q: { format: 'qc', info, quantityA, quantityB, answer, ...(trapAns && trapAns !== answer ? { traps: { [trapAns]: trapId } } : {}), explanation },
      };
    }
  },
  check(q, p) {
    const [p1, p2] = p.ps;
    const samples: [number, number][] = [];
    if (p.kind === 'even-odd') {
      for (let k = p.lo; k <= Math.min(p.hi, p.lo + 6); k++) {
        const ds = divisorsOf(2 ** k * p1 ** p.e[0] * p2 ** p.e[1]);
        samples.push([ds.filter((d) => d % 2 === 0).length, ds.filter((d) => d % 2 === 1).length]);
      }
    } else if (p.kind === 'fixed-sum') {
      for (let a = 1; a < p.e[0]; a++) samples.push([divisorsOf(p1 ** a * p2 ** (p.e[0] - a)).length, p.k]);
    } else if (p.kind === 'squares') {
      samples.push([divisorsOf(2 ** p.e[0] * p1 ** p.e[1] * p2 ** p.e[2]).filter(isSquare).length, p.k]);
    } else {
      const M = 2 ** p.M[0] * 3 ** p.M[1];
      samples.push([divisorsOf(2 ** p.e[0] * 3 ** p.e[1] * p1 ** p.e[2]).filter((d) => d % M === 0).length, p.k]);
    }
    return expectQc(q, qcFromSamples(samples));
  },
};

export const divisorKindsTemplates: Template<any>[] = [divisorKindsQC];
