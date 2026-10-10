import { flaggedChoices, qcCompare, qcFromSamples, textChoices } from '../../../engine/build';
import { frac } from '../../../engine/frac';
import { isPrime, mod, primesUpTo, range } from '../../../engine/math';
import type { Rng } from '../../../engine/rng';
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

// n - 2 is an odd composite that looks prime: 49, 77, 91, 119, 121, 133, 143, 161.
const LOOKALIKE_TARGETS = [51, 79, 93, 121, 123, 135, 145, 163];

const cannotSum: Template<CannotParams> = {
  id: 'arith.primes.cannot-sum',
  skill: 'arith.primes',
  format: 'mcs',
  style: 'which integer CANNOT be written as a sum of two primes',
  generate(rng, diff) {
    let values: number[];
    for (;;) {
      if (diff === 3) {
        const bad = rng.pick(LOOKALIKE_TARGETS);
        const goodPool = range(41, 165).filter((n) => n % 2 === 1 && isPrime(n - 2) && n !== bad);
        values = [bad, ...rng.sample(goodPool, 4)].sort((a, b) => a - b);
        if (values[4] - values[0] > 70) continue;
        break;
      }
      const start = diff === 1 ? rng.int(7, 36) : rng.int(20, 66);
      values = range(start, start + 4);
      const bad = values.filter((n) => n % 2 === 1 && !isPrime(n - 2));
      const goodOdd = values.filter((n) => n % 2 === 1 && isPrime(n - 2));
      if (bad.length === 1 && goodOdd.length >= 1) break;
    }
    const answerValue = values.find((n) => n % 2 === 1 && !isPrime(n - 2))!;
    const wrong: Choice[] = values
      .filter((n) => n !== answerValue)
      .map((n) => ({ text: `$${n}$`, ...(n % 2 === 1 ? { trap: 'forgot-two-is-prime' } : {}) }));
    const { choices } = textChoices(rng, `$${answerValue}$`, wrong, 'keep');
    // Keep ascending order.
    const ordered = [...choices].sort((a, b) => Number(a.text.slice(1, -1)) - Number(b.text.slice(1, -1)));
    const answer = ordered.findIndex((c) => c.text === `$${answerValue}$`);
    const lines = values.map((n) => {
      if (n % 2 === 0) {
        const [p, q] = goldbachSplit(n)!;
        return `- ${n} is even: $${n} = ${p} + ${q}$ ✓`;
      }
      if (isPrime(n - 2)) return `- ${n} is odd and $${n} - 2 = ${n - 2}$ is prime: $${n} = 2 + ${n - 2}$ ✓`;
      return `- ${n} is odd and $${n} - 2 = ${n - 2}$ is not prime ($${compositeReason(n - 2)}$) ✗`;
    });
    return {
      params: { values },
      q: {
        format: 'mcs',
        stem: 'Which of the following integers CANNOT be written as the sum of two prime numbers?',
        choices: ordered,
        answer,
        explanation: `Two odd primes always add up to an even number. So an odd number can be the sum of two primes only if one of them is 2, the only even prime; that is, only if $n - 2$ is prime.

${lines.join('\n')}

So ${answerValue} is the only one that cannot be written as a sum of two primes. If you forget that 2 is prime, every odd choice looks impossible; check $n - 2$ instead.`,
      },
    };
  },
  check(q, { values }) {
    return expectMcsBy(q, (i) => !sumOfTwoPrimesBrute(values[i]));
  },
};

/* ------------------------------------------------------------------ 2. Two primes with an odd sum or odd difference (NE) */

interface OddSumParams {
  mode: 'sum' | 'diff';
  n: number;
  ask: 'product' | 'larger' | 'diff' | 'sum';
}

const askValue = (ask: OddSumParams['ask'], p: number, q: number) =>
  ask === 'product' ? p * q : ask === 'larger' ? Math.max(p, q) : ask === 'diff' ? Math.abs(q - p) : p + q;

const oddSum: Template<OddSumParams> = {
  id: 'arith.primes.odd-sum',
  skill: 'arith.primes',
  format: 'ne',
  style: 'two primes with an odd sum (or odd difference): one of them is 2',
  generate(rng, diff) {
    const mode: OddSumParams['mode'] = diff === 3 && rng.chance(0.6) ? 'diff' : 'sum';
    let n: number;
    do {
      n = mode === 'sum' ? rng.int(diff === 1 ? 9 : 25, diff === 1 ? 45 : diff === 2 ? 99 : 150) : rng.int(9, 79);
    } while (n % 2 === 0 || !isPrime(mode === 'sum' ? n - 2 : n + 2));
    const p = 2;
    const q = mode === 'sum' ? n - 2 : n + 2;
    const ask: OddSumParams['ask'] =
      mode === 'diff' ? rng.pick(['sum', 'product'] as const) : diff === 1 ? rng.pick(['larger', 'product'] as const) : rng.pick(['product', 'diff'] as const);
    const value = askValue(ask, p, q);
    const askTex = { product: '$pq$', larger: 'the greater of the two primes', diff: '$q - p$', sum: '$p + q$' }[ask];
    let stem: string;
    if (mode === 'sum') {
      stem =
        ask === 'larger'
          ? `The sum of two prime numbers is ${n}. What is the greater of the two primes?`
          : ask === 'diff'
            ? `If $p$ and $q$ are prime numbers such that $p < q$ and $p + q = ${n}$, what is the value of $q - p$?`
            : `If $p$ and $q$ are prime numbers and $p + q = ${n}$, what is the value of $pq$?`;
    } else {
      stem = `If $p$ and $q$ are prime numbers and $q - p = ${n}$, what is the value of ${askTex}?`;
    }
    const why =
      mode === 'sum'
        ? `If both primes were odd, their sum would be even. Since ${n} is odd, one of the primes must be the only even prime, 2, and the other is $${n} - 2 = ${q}$, which is prime.`
        : `If both primes were odd, their difference would be even. Since ${n} is odd, one of them is 2. It must be the smaller one, $p = 2$ (otherwise $p$ would be negative), so $q = ${n} + 2 = ${q}$, which is prime.`;
    const calc =
      ask === 'product'
        ? `$pq = 2 \\cdot ${q} = ${value}$.`
        : ask === 'larger'
          ? `The greater prime is ${q}.`
          : ask === 'diff'
            ? `$q - p = ${q} - 2 = ${value}$.`
            : `$p + q = 2 + ${q} = ${value}$.`;
    return {
      params: { mode, n, ask },
      q: {
        format: 'ne',
        stem,
        ...(ask === 'diff' && mode === 'sum' ? { prefix: '$q - p =$' } : {}),
        answer: frac(value),
        explanation: `${why} So ${calc}

Looking for two odd primes is hopeless: two odd numbers always have an even ${mode === 'sum' ? 'sum' : 'difference'}. The key is remembering that 2 is prime.`,
      },
    };
  },
  check(q, { mode, n, ask }) {
    const vals = new Set<number>();
    for (let p = 2; p <= 1000; p++) {
      if (!primeBySieve(p)) continue;
      const other = mode === 'sum' ? n - p : p + n; // other = q
      if (other < 2 || other > 4000 || !primeBySieve(other)) continue;
      if (mode === 'sum' && ask === 'diff' && !(p < other)) continue;
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

type BoundsMode = 'least-greatest' | 'count-k' | 'count-less' | 'count-count';

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
    const modes: BoundsMode[] = diff === 1 ? ['least-greatest', 'count-less'] : diff === 2 ? ['least-greatest', 'count-k'] : ['count-count', 'count-k', 'least-greatest'];
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
        const rel = rng.pick(['A', 'B', 'C'] as const);
        b = rel === 'A' ? rng.int(a + 1, p1) : rel === 'C' ? rng.int(p1 + 1, p1n) : rng.int(p1n + 1, p1n + 6);
        if (b - a < 3) continue;
        valA = p1;
        valB = prevPrime(b);
        trapA = nextPrime(a, looksPrime);
        trapB = prevPrime(b, looksPrime);
      } else if (mode === 'count-less') {
        b = rng.int(12, 40);
        valA = range(1, b - 1).filter((m) => isPrime(m)).length;
        k = valA + rng.pick([-1, 0, 0, 1]);
        valB = k;
        trapA = valA + 1;
        trapB = k;
        trapId = 'one-is-prime';
      } else if (mode === 'count-k') {
        a = rng.int(10, top - 20);
        b = a + rng.int(12, 22);
        valA = countBetween(a, b);
        k = valA + rng.pick([-1, 0, 0, 1]);
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
      const answer = qcCompare(valA, valB);
      const trapAnswer = qcCompare(trapA, trapB);
      const traps: QCQuestion['traps'] = trapAnswer !== answer ? { [trapAnswer]: trapId } : undefined;
      // Mostly prefer questions where the careless reading changes the answer.
      if (!traps && rng.chance(0.5)) continue;

      let quantityA: string;
      let quantityB: string;
      let explanation: string;
      if (mode === 'least-greatest') {
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
        quantityA = `The number of prime numbers between ${a} and ${b}`;
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
        explanation = `Between ${a} and ${b} the primes are ${primeList(a, b)} (${valA} primes). Between ${a2} and ${b2} they are ${primeList(a2, b2)} (${valB} primes).

Compare ${valA} with ${valB}: ${QC_WORDS[answer]}. (${answer})

${c1.length + c2.length ? `Odd does not mean prime: ${listAnd([...c1, ...c2].slice(0, 4))}.` : ''}`;
      }
      return {
        params: { mode, a, b, a2, b2, k },
        q: { format: 'qc', quantityA, quantityB, answer, traps, explanation },
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
        if (!varies[i]) return `- $${tex}$ is always ${pats[i][0] ? 'odd' : 'even'} ${correct[i] ? '✓' : '✗'}`;
        const when = (par: number) => reps.flatMap((v, j) => (pats[i][j] === par ? [caseText(v)] : [])).join(' or ');
        return `- $${tex}$ is even if ${when(0)}, but odd if ${when(1)}: it can be either ✗`;
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
    const samples = range(1, 300).map(() => sampleScenario(rng, scenario));
    if (scenario === 'primes-any') samples.push({ p: 2, q: 3 }, { p: 3, q: 2 }, { p: 3, q: 5 });
    if (scenario === 'xyz') samples.push({ x: 2, y: 1, z: 0 }, { x: 2, y: 1, z: 1 });
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

export const primesTemplates: Template<any>[] = [cannotSum, oddSum, twoPrimesQC, primeBoundsQC, parityMust];
