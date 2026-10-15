import { flaggedChoices, qcCompare, qcFromSamples, textChoices } from '../../../engine/build';
import { frac } from '../../../engine/frac';
import { isPrime, mod, primesUpTo, range } from '../../../engine/math';
import type { Rng } from '../../../engine/rng';
import { num } from '../../../engine/tex';
import { plural } from '../../../engine/text';
import type { Choice, QCChoice, QCQuestion, Template } from '../../../engine/types';
import {
  QC_WORDS,
  compositeReason,
  evalExpr,
  expectMcm,
  expectMcsBy,
  expectNe,
  expectQc,
  listAnd,
  plainToTex,
  primeBySieve,
  substitute,
} from './util';

/** Smallest prime p such that n - p is also prime (for showing n as a sum of two primes). */
function goldbachSplit(n: number): [number, number] | null {
  for (const p of primesUpTo(n)) {
    if (p > n - p) break;
    if (isPrime(n - p)) return [p, n - p];
  }
  return null;
}

/** "Can be written as a sum of two primes" by brute force over the sieve (used by checks). */
function sumOfTwoPrimesBrute(n: number): boolean {
  for (let p = 2; p <= n - 2; p++) if (primeBySieve(p) && primeBySieve(n - p)) return true;
  return false;
}

/* ------------------------------------------------------------------ 1. Which integer CANNOT be a sum of two primes (MCS) */

interface CannotParams {
  values: number[];
}

/** Odd n that is NOT a sum of two primes: n - 2 is composite (n >= 9 keeps n - 2 above 1). */
const isBadOdd = (n: number) => n % 2 === 1 && !isPrime(n - 2);
// n - 2 is an odd composite with no factor 2, 3 or 5: 49, 77, 91 (hand-checkable primality below 100).
const LOOKALIKE_TARGETS = [51, 79, 93];

const cannotSum: Template<CannotParams> = {
  id: 'arith.primes.cannot-sum',
  skill: 'arith.primes',
  format: 'mcs',
  style: 'which integer CANNOT be written as a sum of two primes',
  generate(rng, diff) {
    const [lo, hi] = diff === 1 ? [9, 47] : diff === 2 ? [21, 99] : [41, 99];
    for (;;) {
      const bad = diff === 3 ? rng.pick(LOOKALIKE_TARGETS) : rng.pick(range(lo, hi).filter(isBadOdd));
      const goodOdd = range(lo, hi).filter((n) => n % 2 === 1 && isPrime(n - 2) && n !== bad);
      const evens = range(lo, hi).filter((n) => n % 2 === 0);
      const nOdd = diff === 1 ? rng.int(1, 2) : diff === 2 ? rng.int(2, 3) : 4;
      const wrong = [...rng.sample(goodOdd, nOdd), ...rng.sample(evens, 4 - nOdd)];
      const values = [bad, ...wrong].sort((a, b) => a - b);
      // No two choices next to each other (that would be a ladder).
      if (values.some((v, i) => i > 0 && v - values[i - 1] < 2)) continue;
      const wrongChoices: Choice[] = wrong.map((n) => ({ text: `$${n}$`, trap: n % 2 === 1 ? 'forgot-two-is-prime' : 'int-primes-sum-parity' }));
      const { choices } = textChoices(rng, `$${bad}$`, wrongChoices, 'keep');
      const ordered = [...choices].sort((a, b) => Number(a.text.slice(1, -1)) - Number(b.text.slice(1, -1)));
      const answer = ordered.findIndex((c) => c.text === `$${bad}$`);

      const oddWrong = wrong.filter((n) => n % 2 === 1);
      const evenWrong = wrong.filter((n) => n % 2 === 0);
      const oddLines = oddWrong.map((n) => `$${n} = 2 + ${n - 2}$`);
      const split = evenWrong.length ? goldbachSplit(evenWrong[0])! : null;
      const trap: string[] = [];
      if (oddWrong.length) trap.push(`forgetting that 2 is prime makes every odd number look impossible, yet ${listAnd(oddLines)} ${oddLines.length > 1 ? 'work' : 'works'}`);
      if (split)
        trap.push(`a sum of two primes need not be odd, since two odd primes add to an even number: $${evenWrong[0]} = ${split[0]} + ${split[1]}$`);
      return {
        params: { values },
        q: {
          format: 'mcs',
          stem: 'Which of the following integers CANNOT be written as the sum of two prime numbers?',
          choices: ordered,
          answer,
          explanation: `Two odd primes add up to an even number, so an odd sum needs the only even prime: $n = 2 + (n - 2)$ with $n - 2$ prime.

Test the odd choices: ${listAnd(
            values.filter((n) => n % 2 === 1).map((n) => (isPrime(n - 2) ? `$${n} - 2 = ${n - 2}$ is prime` : `$${n} - 2 = ${n - 2}$ is not prime ($${compositeReason(n - 2)}$)`)),
          )}. So ${bad} cannot be written as a sum of two primes.

Trap: ${trap.join('; ')}.

Rule: an odd number is a sum of two primes exactly when it is 2 plus a prime.`,
        },
      };
    }
  },
  check(q, { values }) {
    return expectMcsBy(q, (i) => !sumOfTwoPrimesBrute(values[i]));
  },
};

/* ------------------------------------------------------------------ 2. Two primes with an odd sum or odd difference (NE) */

type OddAsk = 'product' | 'larger' | 'diff' | 'sum' | 'sumsq';

interface OddSumParams {
  mode: 'sum' | 'diff';
  n: number;
  ask: OddAsk;
  frame: number;
}

const askValue = (ask: OddAsk, p: number, q: number) =>
  ask === 'product' ? p * q : ask === 'larger' ? Math.max(p, q) : ask === 'diff' ? Math.abs(q - p) : ask === 'sumsq' ? p * p + q * q : p + q;

const ASK_TEX: Record<OddAsk, string> = { product: '$pq$', larger: '$q$', diff: '$q - p$', sum: '$p + q$', sumsq: '$p^2 + q^2$' };
const ASK_WORDS: Record<OddAsk, string> = {
  product: 'their product',
  larger: 'the greater of the two primes',
  diff: 'the difference between the greater prime and the smaller one',
  sum: 'their sum',
  sumsq: 'the sum of their squares',
};

const oddSum: Template<OddSumParams> = {
  id: 'arith.primes.odd-sum',
  skill: 'arith.primes',
  format: 'ne',
  style: 'two primes with an odd sum (or odd difference): one of them is 2',
  generate(rng, diff) {
    // d1 and d2 use the sum of the two primes, d3 their difference. Each level has its own wording and its own set of questions.
    const mode: OddSumParams['mode'] = diff === 3 ? 'diff' : 'sum';
    let n: number;
    do {
      n = mode === 'sum' ? rng.int(9, 99) : rng.int(5, 95);
    } while (n % 2 === 0 || !isPrime(mode === 'sum' ? n - 2 : n + 2));
    const p = 2;
    const q = mode === 'sum' ? n - 2 : n + 2;
    const ask: OddAsk =
      diff === 1
        ? rng.pick(['larger', 'product', 'diff'] as const)
        : diff === 2
          ? rng.pick(['product', 'diff', 'sumsq'] as const)
          : rng.pick(['sum', 'product', 'larger', 'sumsq'] as const);
    const frame = rng.int(0, 1);
    const value = askValue(ask, p, q);
    let stem: string;
    if (diff === 1)
      stem = [`The sum of two prime numbers is ${n}. What is ${ASK_WORDS[ask]}?`, `Two prime numbers add up to ${n}. What is ${ASK_WORDS[ask]}?`][frame];
    else if (diff === 2)
      stem = [
        `If $p$ and $q$ are prime numbers with $p < q$ and $p + q = ${n}$, what is the value of ${ASK_TEX[ask]}?`,
        `Let $p$ and $q$ be prime numbers such that $p < q$ and $p + q = ${n}$. What is the value of ${ASK_TEX[ask]}?`,
      ][frame];
    else
      stem = [
        `If $p$ and $q$ are prime numbers and $q - p = ${n}$, what is the value of ${ASK_TEX[ask]}?`,
        `$p$ and $q$ are prime numbers, and $q$ is ${n} more than $p$. What is the value of ${ASK_TEX[ask]}?`,
      ][frame];
    const why =
      mode === 'sum'
        ? `If both primes were odd, their sum would be even. Since ${n} is odd, one of the primes is the only even prime, 2, and the other is $${n} - 2 = ${q}$, which is prime.`
        : `If both primes were odd, their difference would be even. Since ${n} is odd, one of them is 2, and it must be the smaller one (otherwise $p$ would be negative). So $p = 2$ and $q = ${n} + 2 = ${q}$, which is prime.`;
    const calc =
      ask === 'product'
        ? `Then $pq = 2 \\cdot ${q} = ${value}$.`
        : ask === 'larger'
          ? `The greater prime is ${q}.`
          : ask === 'diff'
            ? `Then $q - p = ${q} - 2 = ${value}$.`
            : ask === 'sumsq'
              ? `Then $p^2 + q^2 = 2^2 + ${q}^2 = 4 + ${num(q * q)} = ${num(value)}$.`
              : `Then $p + q = 2 + ${q} = ${value}$.`;
    const check = mode === 'sum' ? `Check: $2 + ${q} = ${n}$, and ${q} is prime.` : `Check: $${q} - 2 = ${n}$, and ${q} is prime.`;
    return {
      params: { mode, n, ask, frame },
      q: {
        format: 'ne',
        stem,
        answer: frac(value),
        explanation: `All primes except 2 are odd, so the parity of the ${mode === 'sum' ? 'sum' : 'difference'} tells you where 2 is.

${why} ${calc}

${check}

Trap: looking for two odd primes cannot work, since two odd numbers always have an even ${mode === 'sum' ? 'sum' : 'difference'}.

Rule: an odd ${mode === 'sum' ? 'sum' : 'difference'} of two primes forces one of them to be 2.`,
      },
    };
  },
  check(q, { mode, n, ask }) {
    const vals = new Set<number>();
    for (let p = 2; p <= 1000; p++) {
      if (!primeBySieve(p)) continue;
      const other = mode === 'sum' ? n - p : p + n; // other = q
      if (other < 2 || other > 4000 || !primeBySieve(other)) continue;
      if (mode === 'sum' && !(p < other)) continue;
      vals.add(askValue(ask, p, other));
    }
    if (vals.size !== 1) return `${vals.size} possible values: ${[...vals]}`;
    return expectNe(q, [...vals][0]);
  },
};

/* ------------------------------------------------------------------ 3. p + q = n with p, q prime (QC) */

interface TwoPrimesQCParams {
  n: number;
  ask: 'product' | 'larger' | 'diff';
  k: number;
}

const primePairs = (n: number): [number, number][] =>
  primesUpTo(n)
    .filter((p) => p < n - p && isPrime(n - p))
    .map((p) => [p, n - p]);

const twoPrimesQC: Template<TwoPrimesQCParams> = {
  id: 'arith.primes.two-primes-qc',
  skill: 'arith.primes',
  format: 'qc',
  style: 'compare a quantity built from two primes with a given sum',
  generate(rng, diff) {
    const odd = rng.chance(0.6);
    const ask = rng.pick(diff === 1 ? (['larger', 'product'] as const) : (['product', 'larger', 'diff'] as const));
    for (;;) {
      const n = odd ? rng.int(diff === 1 ? 9 : 21, diff === 3 ? 125 : 75) : 2 * rng.int(8, diff === 3 ? 30 : 22);
      if (odd && (n % 2 === 0 || !isPrime(n - 2))) continue;
      if (!odd && n % 2 === 1) continue;
      const pairs = primePairs(n);
      if (!odd && pairs.length < 2) continue;
      const vals = pairs.map(([p, q]) => (ask === 'product' ? p * q : ask === 'larger' ? q : q - p));
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      let k: number;
      const roll = rng.next();
      if (odd) {
        const v = vals[0];
        const spread = ask === 'product' ? rng.int(1, 6) : rng.int(1, 3);
        k = roll < 0.4 ? v : roll < 0.7 ? v - spread : v + spread;
      } else {
        if (roll < 0.55) {
          // strictly inside the range of possible values -> D
          const inner = range(lo, hi).filter((x) => x > lo && x < hi);
          if (!inner.length) continue;
          k = rng.pick(inner);
        } else k = roll < 0.78 ? lo - rng.int(1, 4) : hi + rng.int(1, 4);
      }
      if (k <= 0) continue;
      const rels = new Set(vals.map((v) => qcCompare(v, k)));
      const answer: QCChoice = rels.size === 1 ? [...rels][0] : 'D';
      let traps: QCQuestion['traps'];
      if (odd && answer !== 'D') traps = { D: 'forgot-two-is-prime' };
      else if (!odd && answer === 'D') traps = { [qcCompare(vals[0], k)]: 'tested-one-value' };
      const askTex = ask === 'product' ? '$pq$' : ask === 'larger' ? '$q$' : '$q - p$';
      const valOf = ([p, q]: [number, number]) => (ask === 'product' ? `${p} \\cdot ${q} = ${p * q}` : ask === 'larger' ? `${q}` : `${q} - ${p} = ${q - p}`);
      let explanation: string;
      if (odd) {
        const [p, q] = pairs[0];
        explanation = `The sum of two odd primes is even, and ${n} is odd, so one of the primes is 2. With $p < q$, $p = 2$ and $q = ${n} - 2 = ${q}$ (prime). These are the only possible values.

Quantity A is $${valOf([p, q])}$. Compare with ${k}: ${QC_WORDS[answer]}. (${answer})

Answering D because "many pairs of primes might work" misses that an odd sum forces one prime to be 2.`;
      } else {
        const list = pairs.map(([p, q]) => `$${p} + ${q}$`);
        const valsTex = pairs.map((pq) => `$${valOf(pq)}$`);
        explanation = `${n} can be written as a sum of two primes in ${pairs.length} ways: ${listAnd(list)}. So Quantity A can be ${listAnd(valsTex)}.

${
          answer === 'D'
            ? `Some of these values are greater than ${k} and some are not, so the relationship cannot be determined. (D)

Checking only the first pair you find is not enough when more than one pair works.`
            : `Every one of these values is ${answer === 'A' ? 'greater' : 'less'} than ${k}, so ${QC_WORDS[answer]}. (${answer})`
        }`;
      }
      return {
        params: { n, ask, k },
        q: {
          format: 'qc',
          info: `$p$ and $q$ are prime numbers, $p < q$, and $p + q = ${n}$.`,
          quantityA: askTex,
          quantityB: `$${k}$`,
          answer,
          traps,
          explanation,
        },
      };
    }
  },
  check(q, { n, ask, k }) {
    const samples: [number, number][] = [];
    for (let p = 2; p < n; p++) {
      const other = n - p;
      if (p < other && primeBySieve(p) && primeBySieve(other)) samples.push([ask === 'product' ? p * other : ask === 'larger' ? other : other - p, k]);
    }
    if (!samples.length) return 'no prime pair';
    return expectQc(q, qcFromSamples(samples));
  },
};

/* ------------------------------------------------------------------ 4. Primes near a bound / counting primes (QC) */

type BoundsMode = 'least-greatest' | 'count-k' | 'count-less' | 'count-count' | 'x-range';

interface BoundsParams {
  mode: BoundsMode;
  a: number;
  b: number;
  a2: number;
  b2: number;
  k: number;
}

/** The careless model: every odd number not ending in 5 "is prime" (plus 2, 3, 5). */
const looksPrime = (n: number) => n === 2 || n === 3 || n === 5 || (n > 1 && n % 2 === 1 && n % 5 !== 0);

const nextPrime = (a: number, test: (n: number) => boolean = isPrime) => {
  let n = a + 1;
  while (!test(n)) n++;
  return n;
};
const prevPrime = (b: number, test: (n: number) => boolean = isPrime) => {
  let n = b - 1;
  while (!test(n)) n--;
  return n;
};
const countBetween = (a: number, b: number, test: (n: number) => boolean = isPrime) => range(a + 1, b - 1).filter(test).length;

function oddComposites(from: number, to: number): string[] {
  return range(from, to)
    .filter((m) => m > 1 && m % 2 === 1 && !isPrime(m))
    .map((m) => `$${compositeReason(m)}$`);
}

function primeList(a: number, b: number): string {
  const ps = range(a + 1, b - 1).filter((m) => isPrime(m));
  return ps.length ? ps.join(', ') : 'none';
}

const primeBoundsQC: Template<BoundsParams> = {
  id: 'arith.primes.prime-bounds-qc',
  skill: 'arith.primes',
  format: 'qc',
  style: 'least prime above / greatest prime below, counting primes in a range',
  generate(rng, diff) {
    const modes: BoundsMode[] =
      diff === 1
        ? ['least-greatest', 'count-less']
        : diff === 2
          ? ['least-greatest', 'count-k', 'x-range']
          : ['count-count', 'count-k', 'least-greatest', 'x-range', 'x-range'];
    const mode = rng.pick(modes);
    const top = diff === 1 ? 50 : diff === 2 ? 100 : 130;
    for (;;) {
      let a = 0;
      let b = 0;
      let a2 = 0;
      let b2 = 0;
      let k = 0;
      let valA: number;
      let valB: number;
      let trapA: number;
      let trapB: number;
      let trapId = 'int-odd-composite-as-prime';
      if (mode === 'least-greatest') {
        a = rng.int(8, top - 12);
        const p1 = nextPrime(a);
        const p1n = nextPrime(p1);
        const roll = rng.next();
        const rel = roll < 0.45 ? 'A' : roll < 0.72 ? 'B' : 'C';
        b = rel === 'A' ? rng.int(a + 1, p1) : rel === 'C' ? rng.int(p1 + 1, p1n) : rng.int(p1n + 1, p1n + 6);
        if (b - a < 3) continue;
        valA = p1;
        valB = prevPrime(b);
        trapA = nextPrime(a, looksPrime);
        trapB = prevPrime(b, looksPrime);
      } else if (mode === 'x-range') {
        // x runs over a short range: the least prime above x changes with x, so the comparison can flip.
        a = rng.int(10, top - 12);
        b = a + rng.int(4, 9);
        const vs = range(a, b).map((x) => nextPrime(x));
        const roll = rng.next();
        k = roll < 0.6 ? rng.pick(vs) : roll < 0.8 ? Math.min(...vs) - rng.int(1, 3) : Math.max(...vs) + rng.int(1, 3);
        valA = vs[0];
        valB = k;
        trapA = vs[0];
        trapB = k;
        trapId = 'tested-one-value';
      } else if (mode === 'count-less') {
        b = rng.int(12, 40);
        valA = range(1, b - 1).filter((m) => isPrime(m)).length;
        k = valA + rng.pick([-2, -1, -1, 0, 1, 1]);
        valB = k;
        trapA = valA + 1;
        trapB = k;
        trapId = 'one-is-prime';
      } else if (mode === 'count-k') {
        a = rng.int(10, top - 20);
        b = a + rng.int(12, 22);
        valA = countBetween(a, b);
        k = valA + rng.pick([-2, -1, -1, 0, 1, 1]);
        valB = k;
        trapA = countBetween(a, b, looksPrime);
        trapB = k;
        if (isPrime(a) || isPrime(b)) {
          if (rng.chance(0.5)) {
            trapA = range(a, b).filter((m) => isPrime(m)).length;
            trapId = 'counted-endpoint';
          }
        }
      } else {
        const len = rng.pick([10, 20]);
        a = rng.int(2, 9) * 10;
        b = a + len;
        a2 = b + rng.pick([0, 10]);
        b2 = a2 + len;
        if (b2 > 140) continue;
        valA = countBetween(a, b);
        valB = countBetween(a2, b2);
        trapA = countBetween(a, b, looksPrime);
        trapB = countBetween(a2, b2, looksPrime);
      }
      if (k < 0) continue;
      const xs = mode === 'x-range' ? range(a, b).map((x) => nextPrime(x)) : [];
      const answer: QCChoice =
        mode === 'x-range' ? (new Set(xs.map((v) => qcCompare(v, k))).size === 1 ? qcCompare(xs[0], k) : 'D') : qcCompare(valA, valB);
      const trapAnswer = qcCompare(trapA, trapB);
      const traps: QCQuestion['traps'] = trapAnswer !== answer ? { [trapAnswer]: trapId } : undefined;
      // Mostly prefer questions where the careless reading changes the answer.
      if (!traps && rng.chance(0.5)) continue;

      let quantityA: string;
      let quantityB: string;
      let explanation: string;
      let info: string | undefined;
      if (mode === 'x-range') {
        info = `$x$ is an integer, and $${a} \\le x \\le ${b}$.`;
        quantityA = 'The least prime number greater than $x$';
        quantityB = `$${k}$`;
        const word = (v: number) => (v > k ? `greater than ${k}` : v < k ? `less than ${k}` : `equal to ${k}`);
        const x1 = a;
        const x2 = range(a, b).find((x) => qcCompare(nextPrime(x), k) !== qcCompare(nextPrime(x1), k));
        explanation = `The least prime above $x$ changes as $x$ moves, so test the ends of the range.

For $x = ${x1}$ it is ${nextPrime(x1)}, which is ${word(nextPrime(x1))}.${
          answer === 'D'
            ? ` For $x = ${x2}$ it is ${nextPrime(x2!)}, which is ${word(nextPrime(x2!))}. Two allowed values of $x$ disagree, so the relationship cannot be determined. (D)`
            : ` The least prime above $x$ is ${[...new Set(xs)].join(', ')} as $x$ runs from ${a} to ${b}: all ${answer === 'A' ? 'greater than' : answer === 'B' ? 'less than' : 'equal to'} ${k}, so ${QC_WORDS[answer]}. (${answer})`
        }

${answer === 'D' ? `Trap: testing only $x = ${x1}$ suggests ${QC_WORDS[qcCompare(nextPrime(x1), k)]}; ` : ''}an unknown $x$ calls for at least two tests, at different gaps between primes.`;
      } else if (mode === 'least-greatest') {
        const compA = oddComposites(a + 1, valA - 1);
        const compB = oddComposites(valB + 1, b - 1);
        quantityA = `The least prime number greater than ${a}`;
        quantityB = `The greatest prime number less than ${b}`;
        explanation = `Going up from ${a}: ${compA.length ? `${listAnd(compA)} ${compA.length > 1 ? 'are' : 'is'} not prime (and even numbers are not prime), so ` : ''}the least prime greater than ${a} is ${valA}.

Going down from ${b}: ${compB.length ? `${listAnd(compB)} ${compB.length > 1 ? 'are' : 'is'} not prime, so ` : ''}the greatest prime less than ${b} is ${valB}.

Compare ${valA} with ${valB}: ${QC_WORDS[answer]}. (${answer})`;
      } else if (mode === 'count-less') {
        const ps = range(2, b - 1).filter((m) => isPrime(m));
        quantityA = `The number of prime numbers less than ${b}`;
        quantityB = `$${k}$`;
        explanation = `The primes less than ${b} are ${ps.join(', ')}: there are ${valA} of them. Remember that 1 is not prime (a prime has exactly two positive divisors) and that 2 is prime.

Compare ${valA} with ${k}: ${QC_WORDS[answer]}. (${answer})`;
      } else if (mode === 'count-k') {
        const comps = oddComposites(a + 1, b - 1);
        quantityA = `The number of prime numbers between ${a} and ${b}, exclusive`;
        quantityB = `$${k}$`;
        explanation = `The primes strictly between ${a} and ${b} are ${primeList(a, b)}: there are ${valA}.${
          comps.length ? ` Watch the odd numbers that are not prime: ${listAnd(comps)}.` : ''
        }${isPrime(a) || isPrime(b) ? ` "Between" excludes ${a} and ${b} themselves.` : ''}

Compare ${valA} with ${k}: ${QC_WORDS[answer]}. (${answer})`;
      } else {
        const c1 = oddComposites(a + 1, b - 1);
        const c2 = oddComposites(a2 + 1, b2 - 1);
        quantityA = `The number of prime numbers between ${a} and ${b}`;
        quantityB = `The number of prime numbers between ${a2} and ${b2}`;
        explanation = `Between ${a} and ${b} the primes are ${primeList(a, b)} (${plural(valA, 'prime')}). Between ${a2} and ${b2} they are ${primeList(a2, b2)} (${plural(valB, 'prime')}).

Compare ${valA} with ${valB}: ${QC_WORDS[answer]}. (${answer})

${c1.length + c2.length ? `Odd does not mean prime: ${listAnd([...c1, ...c2].slice(0, 4))}.` : ''}`;
      }
      return {
        params: { mode, a, b, a2, b2, k },
        q: { format: 'qc', ...(info ? { info } : {}), quantityA, quantityB, answer, traps, explanation },
      };
    }
  },
  check(q, { mode, a, b, a2, b2, k }) {
    let A: number;
    let B: number;
    const primesIn = (lo: number, hi: number) => range(lo, hi).filter((m) => primeBySieve(m));
    if (mode === 'least-greatest') {
      A = primesIn(a + 1, a + 200)[0];
      const below = primesIn(0, b - 1);
      B = below[below.length - 1];
    } else if (mode === 'count-less') {
      A = primesIn(0, b - 1).length;
      B = k;
    } else if (mode === 'count-k') {
      A = primesIn(a + 1, b - 1).length;
      B = k;
    } else if (mode === 'x-range') {
      return expectQc(
        q,
        qcFromSamples(range(a, b).map((x): [number, number] => [primesIn(x + 1, x + 200)[0], k])),
      );
    } else {
      A = primesIn(a + 1, b - 1).length;
      B = primesIn(a2 + 1, b2 - 1).length;
    }
    return expectQc(q, qcCompare(A, B));
  },
};

/* ------------------------------------------------------------------ 5. Parity with integers and primes: what must be even/odd (MCM) */

type Scenario = 'xy' | 'xyz' | 'primes-any' | 'primes-odd';

interface ParityExpr {
  plain: string;
  /** Integer-coefficient polynomial, evaluated by generate on parity representatives. */
  f: (v: Record<string, number>) => number;
}

const XY_EXPRS: ParityExpr[] = [
  { plain: 'x+y', f: ({ x, y }) => x + y },
  { plain: 'x*y', f: ({ x, y }) => x * y },
  { plain: 'x^2+y', f: ({ x, y }) => x * x + y },
  { plain: 'y^2+1', f: ({ y }) => y * y + 1 },
  { plain: '3*x+2*y', f: ({ x, y }) => 3 * x + 2 * y },
  { plain: 'x+y^2', f: ({ x, y }) => x + y * y },
  { plain: 'x*y+y', f: ({ x, y }) => x * y + y },
  { plain: '(x+1)*(y+1)', f: ({ x, y }) => (x + 1) * (y + 1) },
  { plain: 'y^3-x', f: ({ x, y }) => y ** 3 - x },
  { plain: 'x^2+y^2', f: ({ x, y }) => x * x + y * y },
  { plain: '2*y+x', f: ({ x, y }) => 2 * y + x },
  { plain: 'x*(y+1)', f: ({ x, y }) => x * (y + 1) },
  { plain: '(x+y)^2', f: ({ x, y }) => (x + y) ** 2 },
  { plain: '3*y-x', f: ({ x, y }) => 3 * y - x },
];
const XYZ_EXPRS: ParityExpr[] = [
  { plain: 'x*z', f: ({ x, z }) => x * z },
  { plain: 'y*z', f: ({ y, z }) => y * z },
  { plain: 'x*z+y', f: ({ x, y, z }) => x * z + y },
  { plain: 'z^2+z', f: ({ z }) => z * z + z },
  { plain: 'y+z', f: ({ y, z }) => y + z },
  { plain: 'z*(z+1)+y', f: ({ y, z }) => z * (z + 1) + y },
  { plain: 'y^2-z^2', f: ({ y, z }) => y * y - z * z },
  { plain: 'x*y*z', f: ({ x, y, z }) => x * y * z },
  { plain: 'x+y*z', f: ({ x, y, z }) => x + y * z },
  { plain: 'y*z+z', f: ({ y, z }) => y * z + z },
  { plain: 'x+y+z', f: ({ x, y, z }) => x + y + z },
];
const PQ_EXPRS: ParityExpr[] = [
  { plain: 'p+q', f: ({ p, q }) => p + q },
  { plain: 'p*q', f: ({ p, q }) => p * q },
  { plain: 'p*q+1', f: ({ p, q }) => p * q + 1 },
  { plain: '(p+1)*(q+1)', f: ({ p, q }) => (p + 1) * (q + 1) },
  { plain: 'p*q*(p+q)', f: ({ p, q }) => p * q * (p + q) },
  { plain: 'p+q+p*q', f: ({ p, q }) => p + q + p * q },
  { plain: 'p^2+q', f: ({ p, q }) => p * p + q },
  { plain: 'p*q+2', f: ({ p, q }) => p * q + 2 },
  { plain: 'p+q+1', f: ({ p, q }) => p + q + 1 },
  { plain: 'p-q', f: ({ p, q }) => p - q },
  { plain: 'p^2+q^2', f: ({ p, q }) => p * p + q * q },
];

/** Parity representatives (mod 2) of every case the scenario allows. */
const REPS: Record<Scenario, Record<string, number>[]> = {
  xy: [{ x: 0, y: 1 }],
  xyz: [
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 1, z: 1 },
  ],
  // different primes: one may be 2 (even), never both
  'primes-any': [
    { p: 0, q: 1 },
    { p: 1, q: 0 },
    { p: 1, q: 1 },
  ],
  'primes-odd': [{ p: 1, q: 1 }],
};

const SCENARIO_TEXT: Record<Scenario, string> = {
  xy: 'If $x$ is an even integer and $y$ is an odd integer',
  xyz: 'If $x$ is an even integer, $y$ is an odd integer, and $z$ is an integer',
  'primes-any': 'If $p$ and $q$ are different prime numbers',
  'primes-odd': 'If $p$ and $q$ are prime numbers greater than 2',
};

interface ParityParams {
  scenario: Scenario;
  target: 0 | 1;
  plains: string[];
}

function parityPattern(e: ParityExpr, scenario: Scenario): number[] {
  return REPS[scenario].map((v) => mod(e.f(v), 2));
}

function sampleScenario(rng: Rng, scenario: Scenario): Record<string, number> {
  const odd = () => 2 * rng.int(-30, 30) + 1;
  const even = () => 2 * rng.int(-30, 30);
  const PR = primesUpTo(97);
  switch (scenario) {
    case 'xy':
      return { x: even(), y: odd() };
    case 'xyz':
      return { x: even(), y: odd(), z: rng.int(-40, 40) };
    case 'primes-any': {
      const p = rng.chance(0.3) ? 2 : rng.pick(PR);
      let q: number;
      do q = rng.chance(0.3) ? 2 : rng.pick(PR);
      while (q === p);
      return rng.chance(0.5) ? { p, q } : { p: q, q: p };
    }
    case 'primes-odd':
      return { p: rng.pick(PR.slice(1)), q: rng.pick(PR.slice(1)) };
  }
}

const parityMust: Template<ParityParams> = {
  id: 'arith.primes.parity-must',
  skill: 'arith.primes',
  format: 'mcm',
  style: 'odd/even rules with integers and primes: which must be even (odd)',
  generate(rng, diff) {
    const scenario: Scenario =
      diff === 1 ? rng.pick(['xy', 'primes-odd'] as const) : diff === 2 ? rng.pick(['xyz', 'primes-any', 'primes-odd'] as const) : rng.pick(['primes-any', 'xyz'] as const);
    const bank = scenario === 'xy' ? XY_EXPRS : scenario === 'xyz' ? [...XYZ_EXPRS, ...rng.sample(XY_EXPRS, 3)] : PQ_EXPRS;
    const target: 0 | 1 = rng.chance(0.5) ? 0 : 1;
    const word = target === 0 ? 'even' : 'odd';
    const nChoices = diff === 1 ? 4 : 5;
    for (;;) {
      const picks = rng.sample(bank, nChoices);
      const pats = picks.map((e) => parityPattern(e, scenario));
      const correct = pats.map((pt) => pt.every((x) => x === target));
      const nCorrect = correct.filter(Boolean).length;
      if (nCorrect < 1 || nCorrect > 3) continue;
      const varies = pats.map((pt) => new Set(pt).size > 1);
      // for the "trick" scenarios, insist on at least one expression whose parity varies
      if ((scenario === 'xyz' || scenario === 'primes-any') && !varies.some(Boolean)) continue;
      const items = picks.map((e, i) => {
        let trap: string | undefined;
        if (!correct[i]) trap = varies[i] ? (scenario === 'primes-any' ? 'forgot-two-is-prime' : 'tested-one-value') : 'int-parity-rules';
        return { text: `$${plainToTex(e.plain)}$`, correct: correct[i], ...(trap ? { trap } : {}) };
      });
      const { choices, answer } = flaggedChoices(items as (Choice & { correct: boolean })[]);
      const reps = REPS[scenario];
      const caseText = (v: Record<string, number>) =>
        scenario === 'xyz' ? `$z$ is ${v.z ? 'odd' : 'even'}` : v.p === 0 ? '$p = 2$' : v.q === 0 ? '$q = 2$' : 'both are odd';
      const lines = picks.map((e, i) => {
        const tex = plainToTex(e.plain);
        if (!varies[i]) return `- $${tex}$: always ${pats[i][0] ? 'odd' : 'even'} ${correct[i] ? '✓' : '✗'}`;
        const when = (par: number) => reps.flatMap((v, j) => (pats[i][j] === par ? [caseText(v)] : [])).join(' or ');
        return `- $${tex}$: even if ${when(0)}, odd if ${when(1)} ✗`;
      });
      const intro: Record<Scenario, string> = {
        xy: 'Work with parities only: $x$ is even and $y$ is odd.',
        xyz: 'Work with parities only: $x$ is even, $y$ is odd, and $z$ can be either, so check both cases for $z$.',
        'primes-any': 'Every prime except 2 is odd. Since $p$ and $q$ are different, either both are odd or exactly one of them is 2, so check three cases.',
        'primes-odd': 'Primes greater than 2 are odd, so $p$ and $q$ are both odd.',
      };
      const tail: Record<Scenario, string> = {
        xy: 'Use the rules: odd + odd = even, odd + even = odd, and a product is even as soon as one factor is even.',
        xyz:
          `An expression whose parity depends on $z$ does not have to be ${word}.` +
          (picks.some((e) => e.plain.includes('z^2+z') || e.plain.includes('z*(z+1)')) ? ' Note that $z^2 + z = z(z + 1)$ is a product of consecutive integers, so it is always even.' : ''),
        'primes-any': 'The case $p = 2$ is the one that is easy to forget: 2 is the only even prime.',
        'primes-odd': 'Use the rules: odd + odd = even, odd $\\times$ odd = odd.',
      };
      return {
        params: { scenario, target, plains: picks.map((e) => e.plain) },
        q: {
          format: 'mcm',
          stem: `${SCENARIO_TEXT[scenario]}, which of the following must be ${word}?`,
          instruction: 'Indicate all such expressions.',
          choices,
          answer,
          explanation: `${intro[scenario]}

${lines.join('\n')}

${tail[scenario]}`,
        },
      };
    }
  },
  check(q, { scenario, target, plains }, rng) {
    // Sample actual numbers and evaluate the expressions from their plain text.
    const samples = range(1, 40).map(() => sampleScenario(rng, scenario));
    if (scenario === 'primes-any') samples.push({ p: 2, q: 3 }, { p: 3, q: 2 }, { p: 3, q: 5 });
    if (scenario === 'xyz') samples.push({ x: 2, y: 1, z: 0 }, { x: 2, y: 1, z: 1 }, { x: 0, y: -3, z: -5 });
    if (scenario === 'xy') samples.push({ x: 0, y: 1 }, { x: -4, y: -7 });
    const expected = plains.flatMap((pl, i) =>
      samples.every((v) => {
        const val = evalExpr(substitute(pl, v));
        return mod(val.n, 2) === target;
      })
        ? [i]
        : [],
    );
    return expectMcm(q, expected);
  },
};


/* ------------------------------------------------------------------ 6. Parity decides the sign of (-1)^p (QC) */

/** What is known about the integers r and t, with one worked example per parity case. */
interface PScenario {
  text: string;
  /** Worked examples (r, t), one for each parity case the statement allows. */
  eg: [number, number][];
  /** True if t is used. */
  t: boolean;
  /** Does (r, t) satisfy the statement? (used by check on many actual integers) */
  ok: (r: number, t: number) => boolean;
}

const P_SCENARIOS: Record<string, PScenario> = {
  consec: { text: '$r$ and $t$ are consecutive integers', eg: [[2, 3], [3, 2]], t: true, ok: (r, t) => Math.abs(r - t) === 1 },
  oddR: { text: '$r$ is an odd integer', eg: [[3, 0]], t: false, ok: (r) => Math.abs(r % 2) === 1 },
  evenR: { text: '$r$ is an even integer', eg: [[4, 0]], t: false, ok: (r) => r % 2 === 0 },
  anyR: { text: '$r$ is an integer', eg: [[2, 0], [3, 0]], t: false, ok: () => true },
  anyRT: { text: '$r$ and $t$ are integers', eg: [[2, 4], [2, 3], [3, 2], [3, 5]], t: true, ok: () => true },
  oddEven: { text: '$r$ is odd and $t$ is even', eg: [[3, 2]], t: true, ok: (r, t) => Math.abs(r % 2) === 1 && t % 2 === 0 },
};

interface PExpr {
  tex: string;
  f: (r: number, t: number) => number;
  t: boolean;
}

// The three levels use different expressions, so their questions never coincide.
const P_EXPRS: Record<1 | 2 | 3, PExpr[]> = {
  1: [
    { tex: 'r + t', f: (r, t) => r + t, t: true },
    { tex: 'rt', f: (r, t) => r * t, t: true },
    { tex: 'r + t + 1', f: (r, t) => r + t + 1, t: true },
    { tex: 'rt + 1', f: (r, t) => r * t + 1, t: true },
    { tex: '2r + t', f: (r, t) => 2 * r + t, t: true },
    { tex: 'r + 2t', f: (r, t) => r + 2 * t, t: true },
    { tex: '2r + 1', f: (r) => 2 * r + 1, t: false },
    { tex: 'r + 3', f: (r) => r + 3, t: false },
    { tex: '3r', f: (r) => 3 * r, t: false },
    { tex: '5r + 2', f: (r) => 5 * r + 2, t: false },
  ],
  2: [
    { tex: 'r^2 + t', f: (r, t) => r * r + t, t: true },
    { tex: 'r^2 + r', f: (r) => r * r + r, t: false },
    { tex: 'rt + r', f: (r, t) => r * t + r, t: true },
    { tex: 'r(r + t)', f: (r, t) => r * (r + t), t: true },
    { tex: 'r^2 + 1', f: (r) => r * r + 1, t: false },
    { tex: 'r^2 + 2r', f: (r) => r * r + 2 * r, t: false },
    { tex: '3r + t', f: (r, t) => 3 * r + t, t: true },
    { tex: 'r(t + 1)', f: (r, t) => r * (t + 1), t: true },
    { tex: 'r^2 + t^2', f: (r, t) => r * r + t * t, t: true },
    { tex: 'r^3 + 1', f: (r) => r ** 3 + 1, t: false },
  ],
  3: [
    { tex: 'r^3 + r', f: (r) => r ** 3 + r, t: false },
    { tex: 'r^2 t + t', f: (r, t) => r * r * t + t, t: true },
    { tex: 'r^2 + rt + t^2', f: (r, t) => r * r + r * t + t * t, t: true },
    { tex: 'r^3 + t^3', f: (r, t) => r ** 3 + t ** 3, t: true },
    { tex: 'rt(r + t)', f: (r, t) => r * t * (r + t), t: true },
    { tex: '(r + 1)(t + 1)', f: (r, t) => (r + 1) * (t + 1), t: true },
    { tex: 'r^2 + r + 1', f: (r) => r * r + r + 1, t: false },
    { tex: 'r^2 - t', f: (r, t) => r * r - t, t: true },
    { tex: '(r + t)^2 + r', f: (r, t) => (r + t) ** 2 + r, t: true },
    { tex: 'r^4 + 3r', f: (r) => r ** 4 + 3 * r, t: false },
  ],
};

const SCENARIOS_BY_LEVEL: Record<1 | 2 | 3, string[]> = {
  1: ['consec', 'oddR', 'evenR', 'oddEven'],
  2: ['consec', 'oddR', 'anyR', 'oddEven', 'anyRT'],
  3: ['consec', 'anyR', 'anyRT', 'oddEven', 'evenR'],
};

interface PPowParams {
  scenario: string;
  expr: string;
  shift: 0 | 1;
  bv: number;
}

const pStem = (sc: PScenario, expr: PExpr) => `${sc.text}, and $p = ${expr.tex}$.`;

const parityPowerQC: Template<PPowParams> = {
  id: 'arith.primes.parity-power-qc',
  skill: 'arith.primes',
  format: 'qc',
  style: 'parity of an expression decides the sign of (-1)^p',
  generate(rng, diff) {
    for (;;) {
      const scenario = rng.pick(SCENARIOS_BY_LEVEL[diff]);
      const sc = P_SCENARIOS[scenario];
      const expr = rng.pick(P_EXPRS[diff]);
      if (expr.t && !sc.t) continue;
      // Parity of p in every worked case.
      const pars = sc.eg.map(([r, t]) => Math.abs(expr.f(r, t) % 2));
      const kind = new Set(pars).size > 1 ? 'either' : pars[0] === 0 ? 'even' : 'odd';
      // Aim at about 30% of D, the rest split between even and odd.
      if (kind === 'either' ? rng.chance(0.4) : false) continue;
      const shift = rng.pick([0, 1]) as 0 | 1;
      const bv = rng.pick([-1, 1, 0]);
      const A = (par: number) => ((par + shift) % 2 === 0 ? 1 : -1);
      const vals = [...new Set(pars.map(A))];
      const answer: QCChoice = new Set(vals.map((v) => qcCompare(v, bv))).size === 1 ? qcCompare(vals[0], bv) : 'D';
      const traps: QCQuestion['traps'] =
        answer === 'D' ? { [qcCompare(A(pars[0]), bv)]: 'tested-one-value' } : { D: 'int-parity-rules' };
      const exponent = shift ? 'p + 1' : 'p';
      const caseText = sc.eg
        .map(([r, t], i) => {
          const val = expr.f(r, t);
          const who = sc.t ? `$r = ${r}$, $t = ${t}$` : `$r = ${r}$`;
          return `${who}: $p = ${val}$, ${pars[i] ? 'odd' : 'even'}`;
        })
        .join('; ');
      const aTex = `$(-1)^{${exponent}}$`;
      const valueLine =
        vals.length === 2
          ? `So ${aTex} is 1 in some cases and $-1$ in others.`
          : `So ${aTex} is always $${vals[0]}$: $p$ is ${pars[0] ? 'odd' : 'even'}${shift ? `, so $p + 1$ is ${pars[0] ? 'even' : 'odd'}` : ''}.`;
      return {
        params: { scenario, expr: expr.tex, shift, bv },
        q: {
          format: 'qc',
          info: pStem(sc, expr),
          quantityA: aTex,
          quantityB: `$${bv}$`,
          answer,
          traps,
          explanation: `A power of $-1$ is 1 when the exponent is even and $-1$ when it is odd, so only the parity of ${shift ? '$p + 1$' : '$p$'} matters.

Test every case the statement allows: ${caseText}. Rules: odd + odd and even + even are even, odd + even is odd, a product is even if a factor is even${expr.tex.includes('^') ? ', a power keeps the parity of its base' : ''}.

${valueLine} Compare with $${bv}$: ${QC_WORDS[answer]}. (${answer})

${answer === 'D' ? `Trap: the first case alone suggests ${QC_WORDS[qcCompare(A(pars[0]), bv)]}; one test is not enough.` : `Trap: the unknown ${sc.t ? '$r$ and $t$' : '$r$'} tempts D, but the parity of $p$ is the same in every case.`}`,
        },
      };
    }
  },
  check(q, { scenario, expr, shift, bv }, rng) {
    const sc = P_SCENARIOS[scenario];
    const level = ([1, 2, 3] as const).find((l) => P_EXPRS[l].some((e) => e.tex === expr))!;
    const e = P_EXPRS[level].find((x) => x.tex === expr)!;
    const samples: [number, number][] = [];
    for (let r = -12; r <= 12; r++)
      for (let t = -12; t <= 12; t++) if (sc.ok(r, t)) samples.push([(((e.f(r, t) + shift) % 2) + 2) % 2 === 0 ? 1 : -1, bv]);
    void rng;
    return expectQc(q, qcFromSamples(samples));
  },
};

/* ------------------------------------------------------------------ 7. Sums of two different odd (even) integers: which totals are possible (MCM) */

interface OddSumsParams {
  parity: 'odd' | 'even';
  mult: 2 | 3;
  bound: number;
  values: number[];
}

const oddSumsSelect: Template<OddSumsParams> = {
  id: 'arith.primes.odd-sums-select',
  skill: 'arith.primes',
  format: 'mcm',
  style: 'list the possible totals built from two different odd (even) integers',
  generate(rng, diff) {
    for (;;) {
      const parity: OddSumsParams['parity'] = diff === 3 && rng.chance(0.5) ? 'even' : 'odd';
      const mult: 2 | 3 = diff === 1 ? 2 : rng.pick([2, 3] as const);
      const bound = rng.int(diff === 1 ? 10 : 12, diff === 1 ? 14 : 20);
      const minZ = parity === 'odd' ? 4 : 6; // 1 + 3 or 2 + 4
      const zs = range(minZ, bound - 1).filter((z) => z % 2 === 0);
      const good = zs.map((z) => mult * z);
      const cands: { v: number; trap?: string }[] = [
        ...range(minZ - 1, bound + 1)
          .filter((z) => z % 2 === 1)
          .map((z) => ({ v: mult * z, trap: 'int-parity-rules' })),
        { v: mult * (minZ - 2), trap: 'int-ignored-different' },
        ...range(bound, bound + 4)
          .filter((z) => z % 2 === 0)
          .map((z) => ({ v: mult * z, trap: 'int-one-condition-only' })),
      ];
      const nGood = rng.int(2, Math.min(4, good.length));
      const picksG = rng.sample(good, nGood);
      const bad = rng.shuffle(cands.filter((c) => !good.includes(c.v) && c.v > 0));
      const picksB: { v: number; trap?: string }[] = [];
      for (const b of bad) if (picksB.length < 8 - nGood && !picksB.some((x) => x.v === b.v)) picksB.push(b);
      if (picksB.length !== 8 - nGood) continue;
      const items = [...picksG.map((v) => ({ v, correct: true as boolean, trap: undefined as string | undefined })), ...picksB.map((b) => ({ ...b, correct: false }))].sort((a, b) => a.v - b.v);
      const { choices, answer } = flaggedChoices(items.map((it) => ({ text: `$${it.v}$`, correct: it.correct, ...(it.trap ? { trap: it.trap } : {}) })));
      const expr = mult === 2 ? 'x + y + z' : 'x + y + 2z';
      const word = parity === 'odd' ? 'odd' : 'even';
      return {
        params: { parity, mult, bound, values: items.map((it) => it.v) },
        q: {
          format: 'mcm',
          stem: `The numbers $x$ and $y$ are two different positive ${word} integers, and $z = x + y$. If $z < ${bound}$, which of the following could be the value of $${expr}$?`,
          instruction: 'Indicate all such values.',
          choices,
          answer,
          explanation: `Since $z = x + y$, $${expr} = ${mult}z$. So first find the possible values of $z$.

The sum of two ${word} integers is even, and with $x \\ne y$ the smallest sum is $${parity === 'odd' ? '1 + 3 = 4' : '2 + 4 = 6'}$. Every even number from ${minZ} up works (for example $${minZ + 2} = ${parity === 'odd' ? `1 + ${minZ + 1}` : `2 + ${minZ}`}$), and $z < ${bound}$, so $z$ can be ${listAnd(zs.map(String))}.

So $${expr}$ can be ${listAnd(good.map(String))}. Among the choices: ${listAnd(picksG.sort((a, b) => a - b).map(String))}.

${[
            picksB.some((b) => b.trap === 'int-ignored-different') ? `${mult * (minZ - 2)} would need $x = y$.` : '',
            picksB.some((b) => b.trap === 'int-parity-rules') ? `Values such as ${picksB.find((b) => b.trap === 'int-parity-rules')!.v} would need an odd $z$, but the sum of two ${word} integers is even.` : '',
            picksB.some((b) => b.trap === 'int-one-condition-only') ? `Values such as ${picksB.find((b) => b.trap === 'int-one-condition-only')!.v} would need $z \\ge ${bound}$.` : '',
          ]
            .filter(Boolean)
            .join(' ')}`,
        },
      };
    }
  },
  check(q, { parity, mult, bound, values }) {
    const possible = new Set<number>();
    for (let x = 1; x < bound; x++)
      for (let y = 1; y < bound; y++) {
        if (x === y || (parity === 'odd') !== (x % 2 === 1) || (parity === 'odd') !== (y % 2 === 1)) continue;
        const z = x + y;
        if (z < bound) possible.add(x + y + (mult - 1) * z);
      }
    return expectMcm(
      q,
      values.flatMap((v, i) => (possible.has(v) ? [i] : [])),
    );
  },
};

export const primesTemplates: Template<any>[] = [cannotSum, oddSum, twoPrimesQC, primeBoundsQC, parityMust, parityPowerQC, oddSumsSelect];
