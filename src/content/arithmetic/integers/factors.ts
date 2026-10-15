import { qcCompare, qcFromSamples } from '../../../engine/build';
import { frac } from '../../../engine/frac';
import { factorize, isPrime, primesUpTo, range } from '../../../engine/math';
import { num, plain } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template } from '../../../engine/types';
import { QC_WORDS, countDivisorsBrute, expectMcsBy, expectNe, expectQc, factorTex, listAnd, primeBySieve, spreadChoices } from './util';

/* ------------------------------------------------------------------ 1. (ax)(by) = N with integer constraints (NE) */

interface PairParams {
  a: number;
  b: number;
  N: number;
  parity: boolean;
}

const productPair: Template<PairParams> = {
  id: 'arith.factors.product-pair',
  skill: 'arith.factors',
  format: 'ne',
  style: 'product equation with integer constraints: unique factor pair',
  generate(rng, diff) {
    for (;;) {
      let M: number;
      let pair: [number, number];
      const parity = diff === 3;
      if (parity) {
        const k = rng.int(2, 4);
        const q = rng.pick([3, 5, 7, 11, 13]);
        M = 2 ** k * q;
        pair = [2 ** k, q];
      } else {
        const kind = rng.pick(diff === 1 ? (['pq', 'cube'] as const) : (['pq', 'cube', 'square'] as const));
        if (kind === 'cube') {
          const p = rng.pick(diff === 1 ? [2, 3] : [2, 3, 5]);
          M = p ** 3;
          pair = [p, p * p];
        } else if (kind === 'square') {
          const p = rng.pick([5, 7, 11, 13]);
          M = p * p;
          pair = [p, p];
        } else {
          const [p, q] = rng.sample([2, 3, 5, 7, 11, 13, 17], 2).sort((x, y) => x - y);
          M = p * q;
          pair = [p, q];
        }
      }
      const [a, b] = rng.sample(range(2, 9), 2);
      const N = a * b * M;
      if (N > 3000 || N < 60) continue;
      const answer = pair[0] + pair[1];
      const facPairs = range(1, Math.floor(Math.sqrt(M))).filter((x) => M % x === 0).map((x) => `${x} \\times ${M / x}`);
      const cond = parity ? `The integers $x$ and $y$ are greater than 1, $x$ is even, and $y$ is odd.` : `The integers $x$ and $y$ are greater than 1.`;
      const explanation = parity
        ? `$(${a}x)(${b}y) = ${a * b}xy = ${num(N)}$, so $xy = ${M} = ${factorTex(factorize(M))}$.

Since $y$ is odd, it gets none of the factors of 2, and since $y > 1$, $y = ${pair[1]}$. Then $x = ${pair[0]}$, which is even, and $x + y = ${answer}$.

The pair $1 \\times ${M}$ is ruled out because both numbers must be greater than 1.`
        : `$(${a}x)(${b}y) = ${a * b}xy = ${num(N)}$, so $xy = ${M}$.

The factor pairs of ${M} are ${listAnd(facPairs.map((t) => `$${t}$`))}. Both factors must be greater than 1, so the only possibility is $${pair[0]} \\times ${pair[1]}$, in either order, and $x + y = ${answer}$.

The pair $1 \\times ${M}$ would give ${1 + M}, but 1 is not greater than 1.`;
      return {
        params: { a, b, N, parity },
        q: {
          format: 'ne',
          stem: `${cond} If $(${a}x)(${b}y) = ${num(N)}$, what is the value of $x + y$?`,
          prefix: '$x + y =$',
          answer: frac(answer),
          traps: [{ value: frac(1 + M), trap: 'int-forgot-greater-than-one' }],
          explanation,
        },
      };
    }
  },
  check(q, { a, b, N, parity }) {
    const sums = new Set<number>();
    for (let x = 2; x <= N; x++) {
      const rest = N / (a * x * b);
      if (!Number.isInteger(rest) || rest < 2) continue;
      if (parity && !(x % 2 === 0 && rest % 2 === 1)) continue;
      sums.add(x + rest);
    }
    if (sums.size !== 1) return `${sums.size} possible values of x + y`;
    return expectNe(q, [...sums][0]);
  },
};

/* ------------------------------------------------------------------ 2. Number of divisors, with unknown primes or n (QC) */

type DivQCKind =
  | 'distinct-vs-number'
  | 'maybe-equal'
  | 'n-vs-2n'
  | 'odd-2n'
  | 'any-2n'
  | 'square-n'
  | 'rect-perimeters'
  | 'n-vs-2d'
  | 'prime-vs-2d'
  | 'square-odd';

interface DivQCParams {
  kind: DivQCKind;
  i: number;
  j: number;
  M: number;
  k: number;
}

const COMPARE_M = [12, 14, 15, 16, 18, 20, 21, 24, 26, 27, 28, 30, 32, 33, 35, 36, 40, 42, 44, 45, 48, 50, 52, 54, 56, 60, 63, 64, 66, 70, 72, 75, 80, 81, 84, 88, 90, 96, 98, 100, 108, 120];
const RECT_N = [24, 30, 36, 40, 48, 60, 64, 72, 80, 90, 96, 100, 120, 144];
const RECT_N3 = [48, 60, 72, 84, 90, 96, 108, 120, 126, 132, 144, 150, 160, 168, 180, 192, 196, 200, 210, 216, 224, 240, 252, 256, 280, 288, 300, 324, 360];
const powTex = (v: string, e: number) => (e === 1 ? v : `${v}^{${e}}`);

/** Fixed statements about an unknown positive integer n. */
const N_STATEMENTS: Partial<Record<DivQCKind, { info: string; A: string; B: string; answer: QCChoice; why: string; trap?: [QCChoice, string] }>> = {
  'n-vs-2n': {
    info: '$n$ is a positive integer.',
    A: 'The number of positive divisors of $n$',
    B: 'The number of positive divisors of $2n$',
    answer: 'B',
    why: 'Every divisor of $n$ is also a divisor of $2n$, and $2n$ itself divides $2n$ but not $n$. So $2n$ always has more divisors. For example, $n = 3$: 3 has 2 divisors and 6 has 4. (B)',
  },
  'odd-2n': {
    info: '$n$ is an odd positive integer.',
    A: 'The number of positive divisors of $2n$',
    B: 'Twice the number of positive divisors of $n$',
    answer: 'C',
    why: 'Since $n$ is odd, $2n = 2 \\cdot n$ and 2 does not appear in $n$. Each divisor of $2n$ is a divisor $d$ of $n$ or $2d$, so $2n$ has exactly twice as many divisors as $n$. For example, $n = 15$: 15 has 4 divisors and 30 has 8. (C)',
  },
  'any-2n': {
    info: '$n$ is a positive integer.',
    A: 'The number of positive divisors of $2n$',
    B: 'Twice the number of positive divisors of $n$',
    answer: 'D',
    why: 'If $n$ is odd, $2n$ has exactly twice as many divisors as $n$: $n = 3$ gives 4 and $2 \\cdot 2 = 4$ (equal). If $n$ is even, the factor 2 is already in $n$: $n = 2$ gives $2n = 4$ with 3 divisors, but $2 \\cdot 2 = 4$. The relationship cannot be determined. (D)',
    trap: ['C', 'tested-one-value'],
  },
  'square-n': {
    info: '$n$ is a positive integer.',
    A: 'The number of positive divisors of $n^2$',
    B: 'The number of positive divisors of $n$',
    answer: 'D',
    why: 'For $n > 1$, $n^2$ has more divisors than $n$ (for $n = 2$: 3 versus 2). But for $n = 1$, both numbers have exactly 1 divisor. The relationship cannot be determined. (D)',
    trap: ['A', 'tested-one-value'],
  },
  'n-vs-2d': {
    info: '$n$ is an integer greater than 3, and $n$ has $d$ positive divisors.',
    A: '$n$',
    B: '$2d - 1$',
    answer: 'D',
    why: 'Try cases. If $n = 5$ (a prime), $d = 2$ and $2d - 1 = 3 < 5$. If $n = 4$, $d = 3$ (1, 2 and 4) and $2d - 1 = 5 > 4$. The relationship cannot be determined. (D)',
    trap: ['A', 'tested-one-value'],
  },
  'prime-vs-2d': {
    info: '$n$ is a prime number greater than 3, and $n$ has $d$ positive divisors.',
    A: '$n$',
    B: '$2d - 1$',
    answer: 'A',
    why: 'A prime has exactly two positive divisors, 1 and itself, so $d = 2$ and $2d - 1 = 3$. Since $n > 3$, Quantity A is greater. (A)',
  },
  'square-odd': {
    info: '$n$ is the square of an integer greater than 1, and $d$ is the number of positive divisors of $n$.',
    A: 'The remainder when $d$ is divided by 2',
    B: '$1$',
    answer: 'C',
    why: 'Divisors come in pairs $a \\times b = n$, except when $a = b = \\sqrt{n}$, which is counted once. So a perfect square has an odd number of divisors (for example, 36 has 9), and the remainder is 1. (C)',
    trap: ['B', 'int-counted-ordered-pairs'],
  },
};

const divisorCountQC: Template<DivQCParams> = {
  id: 'arith.factors.divisor-count-qc',
  skill: 'arith.factors',
  format: 'qc',
  style: 'number of divisors or factor pairs with an unknown (primes, n, rectangle sides)',
  generate(rng, diff) {
    const kinds: DivQCKind[] =
      diff === 1
        ? ['distinct-vs-number', 'n-vs-2n', 'rect-perimeters', 'prime-vs-2d']
        : diff === 2
          ? ['distinct-vs-number', 'maybe-equal', 'odd-2n', 'rect-perimeters', 'n-vs-2d']
          : ['maybe-equal', 'maybe-equal', 'rect-perimeters', 'rect-perimeters', 'any-2n', 'square-n', 'n-vs-2d', 'square-odd'];
    const kind = rng.pick(kinds);
    for (;;) {
      let i = 0;
      let j = 0;
      let M = 0;
      let k = 0;
      let info: string;
      let quantityA: string;
      let quantityB: string;
      let answer: QCChoice;
      let traps: QCQuestion['traps'];
      let explanation: string;
      if (kind === 'distinct-vs-number' || kind === 'maybe-equal') {
        i = diff === 3 ? rng.int(2, 4) : rng.int(1, diff === 1 ? 2 : 3);
        j = diff === 3 ? rng.int(1, 4) : rng.int(1, 3);
        const distinctCount = (i + 1) * (j + 1);
        const equalCount = i + j + 1;
        const A =
          diff === 3
            ? `The number of positive integers that divide $${powTex('p', i)}${powTex('q', j)}$`
            : `The number of positive divisors of $${powTex('p', i)}${powTex('q', j)}$`;
        if (kind === 'distinct-vs-number') {
          M = rng.pick(COMPARE_M);
          const fm = factorize(M);
          const dM = fm.reduce((s, [, e]) => s * (e + 1), 1);
          answer = qcCompare(distinctCount, dM);
          const wrongA = i * j;
          const wrongB = fm.reduce((s, [, e]) => s * e, 1);
          const trapAns = qcCompare(wrongA, wrongB);
          traps = trapAns !== answer ? { [trapAns]: 'int-divisors-exponents' } : undefined;
          info = '$p$ and $q$ are different prime numbers.';
          quantityA = A;
          quantityB = `The number of positive divisors of ${M}`;
          explanation = `Each divisor of $${powTex('p', i)}${powTex('q', j)}$ is $p^a q^b$ with $0 \\le a \\le ${i}$ and $0 \\le b \\le ${j}$, so there are $(${i} + 1)(${j} + 1) = ${distinctCount}$ divisors.

$${M} = ${factorTex(fm)}$, so it has $${fm.map(([, e]) => `(${e} + 1)`).join('')} = ${dM}$ divisors.

Compare ${distinctCount} with ${dM}: ${QC_WORDS[answer]}. (${answer})`;
        } else {
          const roll = rng.next();
          k = roll < 0.45 ? distinctCount : roll < 0.65 ? rng.int(1, equalCount - 1) : roll < 0.8 ? distinctCount + rng.int(1, 3) : equalCount;
          if (k < 1) continue;
          const rels = new Set([qcCompare(distinctCount, k), qcCompare(equalCount, k)]);
          answer = rels.size === 1 ? [...rels][0] : 'D';
          traps = answer === 'D' ? { [qcCompare(distinctCount, k)]: 'int-assumed-distinct' } : undefined;
          info = '$p$ and $q$ are prime numbers.';
          quantityA = A;
          quantityB = `$${k}$`;
          explanation = `$p$ and $q$ are not said to be different, so there are two cases.

- If $p \\ne q$, the number of divisors is $(${i} + 1)(${j} + 1) = ${distinctCount}$.
- If $p = q$, the number is $p^{${i + j}}$, with $${i + j} + 1 = ${equalCount}$ divisors.

${
            answer === 'D'
              ? `Compared with ${k}, the two cases give different results, so the relationship cannot be determined. (D)`
              : `In both cases Quantity A is ${answer === 'A' ? 'greater than' : 'less than'} ${k}, so ${QC_WORDS[answer]}. (${answer})`
          }`;
        }
      } else if (kind === 'rect-perimeters') {
        M = rng.pick(diff === 3 ? RECT_N3 : RECT_N);
        const pairs = range(1, Math.floor(Math.sqrt(M))).filter((a) => M % a === 0);
        const count = pairs.length;
        const dM = countDivisorsBrute(M);
        const roll = rng.next();
        k = roll < 0.35 ? count : roll < 0.65 ? dM : roll < 0.8 ? count + 1 : count - 1;
        if (k === count && dM === count) continue;
        answer = qcCompare(count, k);
        const trapAns = qcCompare(dM, k);
        traps = trapAns !== answer ? { [trapAns]: 'int-counted-ordered-pairs' } : undefined;
        info = diff === 3 ? `Rectangle $R$ has sides of integer length and an area of ${M} square units.` : `Each side of rectangle $R$ has an integer length, and the area of $R$ is ${M}.`;
        quantityA = 'The number of different possible perimeters of $R$';
        quantityB = `$${k}$`;
        explanation = `The side lengths form a factor pair of ${M}: ${listAnd(pairs.map((a) => `$${a} \\times ${M / a}$`))}. That is ${count} rectangles${
          Number.isInteger(Math.sqrt(M)) ? ` (including the square $${Math.sqrt(M)} \\times ${Math.sqrt(M)}$)` : ''
        }, and their perimeters are all different: ${listAnd(pairs.map((a) => `${2 * (a + M / a)}`))}.

So Quantity A is ${count}. Compare with ${k}: ${QC_WORDS[answer]}. (${answer})

${M} has ${dM} divisors, but a $${pairs[1] ?? 1} \\times ${M / (pairs[1] ?? 1)}$ rectangle and a $${M / (pairs[1] ?? 1)} \\times ${pairs[1] ?? 1}$ rectangle are the same, so do not count the divisors.`;
      } else {
        const row = N_STATEMENTS[kind]!;
        info = row.info;
        quantityA = row.A;
        quantityB = row.B;
        answer = row.answer;
        traps = row.trap ? { [row.trap[0]]: row.trap[1] } : undefined;
        explanation = row.why;
      }
      return {
        params: { kind, i, j, M, k },
        q: { format: 'qc', info, quantityA, quantityB, answer, traps, explanation },
      };
    }
  },
  check(q, { kind, i, j, M, k }) {
    const P = [2, 3, 5, 7, 11];
    const samples: [number, number][] = [];
    if (kind === 'distinct-vs-number' || kind === 'maybe-equal') {
      for (const p of P)
        for (const qq of P) {
          if (kind === 'distinct-vs-number' && p === qq) continue;
          const v = p ** i * qq ** j;
          samples.push([countDivisorsBrute(v), kind === 'distinct-vs-number' ? countDivisorsBrute(M) : k]);
        }
    } else if (kind === 'rect-perimeters') {
      const per = new Set<number>();
      for (let a = 1; a <= M; a++) if (M % a === 0) per.add(2 * (a + M / a));
      samples.push([per.size, k]);
    } else {
      for (let n = 1; n <= 120; n++) {
        const dn = countDivisorsBrute(n);
        const d2n = countDivisorsBrute(2 * n);
        if (kind === 'n-vs-2n') samples.push([dn, d2n]);
        else if (kind === 'odd-2n') {
          if (n % 2 === 1) samples.push([d2n, 2 * dn]);
        } else if (kind === 'any-2n') samples.push([d2n, 2 * dn]);
        else if (kind === 'square-n') samples.push([countDivisorsBrute(n * n), dn]);
        else if (kind === 'n-vs-2d') {
          if (n > 3) samples.push([n, 2 * dn - 1]);
        } else if (kind === 'prime-vs-2d') {
          if (n > 3 && primeBySieve(n)) samples.push([n, 2 * dn - 1]);
        } else if (kind === 'square-odd') {
          if (n > 1) samples.push([countDivisorsBrute(n * n) % 2, 1]);
        }
      }
    }
    return expectQc(q, qcFromSamples(samples));
  },
};

/* ------------------------------------------------------------------ 3. How many positive divisors (MCS) */

interface CountDivParams {
  N: number;
  kind: 'all' | 'even' | 'odd';
}

const countDivisorsMC: Template<CountDivParams> = {
  id: 'arith.factors.count-divisors',
  skill: 'arith.factors',
  format: 'mcs',
  style: 'how many positive (even/odd) divisors',
  generate(rng, diff) {
    let N: number;
    let kind: CountDivParams['kind'] = 'all';
    for (;;) {
      if (diff === 1) {
        N = rng.int(24, 120);
        // two different primes, so there is more to count than a single exponent
        if (factorize(N).length < 2) continue;
      } else {
        const a = rng.int(diff === 3 ? 1 : 0, diff === 3 ? 5 : 4);
        const b = rng.int(0, 3);
        const c = rng.int(0, 2);
        const e7 = diff === 3 && rng.chance(0.3) ? 1 : 0;
        N = 2 ** a * 3 ** b * 5 ** c * 7 ** e7;
        const fac = factorize(N);
        if (fac.length < 2 || N < (diff === 2 ? 100 : 200) || N > (diff === 2 ? 1000 : 50000)) continue;
        if (fac.every(([, e]) => e === 1)) continue;
      }
      if (diff === 3) kind = rng.pick(['even', 'odd'] as const);
      break;
    }
    const fac = factorize(N);
    const total = fac.reduce((s, [, e]) => s * (e + 1), 1);
    const odd = fac.filter(([p]) => p !== 2).reduce((s, [, e]) => s * (e + 1), 1);
    const answer = kind === 'all' ? total : kind === 'odd' ? odd : total - odd;
    const sumPlus = fac.reduce((acc, [, e]) => acc + e + 1, 0);
    const traps: { value: number; trap: string }[] = [];
    if (kind === 'all') {
      traps.push({ value: fac.reduce((s, [, e]) => s * e, 1), trap: 'int-divisors-exponents' });
      traps.push({ value: total - 2, trap: 'int-divisors-missed-ends' });
      traps.push({ value: fac.reduce((s, [, e]) => s + e, 0), trap: 'int-divisors-exponents' });
      traps.push({ value: Math.ceil(total / 2), trap: 'int-counted-ordered-pairs' });
      traps.push({ value: sumPlus, trap: 'int-divisors-add' });
    } else {
      const e2 = fac.find(([pp]) => pp === 2)![1];
      const oddFac = fac.filter(([pp]) => pp !== 2);
      const oddExpProduct = oddFac.reduce((acc, [, e]) => acc * e, 1);
      traps.push({ value: total, trap: 'int-divisors-parity' });
      traps.push({ value: kind === 'odd' ? total - odd : odd, trap: 'int-divisors-parity' });
      if (kind === 'even') {
        traps.push({ value: (e2 - 1) * odd, trap: 'int-divisors-parity' });
        traps.push({ value: e2 * oddExpProduct, trap: 'int-divisors-exponents' });
        traps.push({ value: e2 * oddFac.reduce((acc, [, e]) => acc + e + 1, 0), trap: 'int-divisors-add' });
      } else {
        traps.push({ value: oddExpProduct, trap: 'int-divisors-exponents' });
        traps.push({ value: oddFac.reduce((acc, [, e]) => acc + e + 1, 0), trap: 'int-divisors-add' });
        traps.push({ value: odd - 1, trap: 'int-divisors-missed-ends' });
      }
    }
    const { choices, answer: idx } = spreadChoices(
      rng,
      answer,
      [
        ...rng.shuffle(traps.filter((t) => t.value > 0 && t.value !== answer)).map((t) => ({ v: t.value, trap: t.trap })),
        ...range(Math.max(1, answer - 6), 2 * answer + 4).map((v) => ({ v })),
      ],
      undefined,
      5,
      'shuffled',
    );
    const valueOf = (id: string) => choices.find((c) => c.trap === id)?.text;
    const shownMath = diff === 3 ? factorTex(fac) : num(N);
    const stem =
      kind === 'all'
        ? [
            `How many positive divisors does $${shownMath}$ have?`,
            `The positive integer $${shownMath}$ is divisible by how many different positive integers?`,
            `How many positive integers divide $${shownMath}$ with no remainder?`,
          ][rng.int(0, 2)]
        : `How many positive divisors of $${shownMath}$ are ${kind}?`;
    const formula = fac.map(([, e]) => `(${e} + 1)`).join('');
    const oddFormula = fac
      .filter(([p]) => p !== 2)
      .map(([, e]) => `(${e} + 1)`)
      .join('');
    const bits: string[] = [];
    if (valueOf('int-divisors-exponents')) bits.push(`${valueOf('int-divisors-exponents')} comes from using the exponents themselves, but each exponent allows one more choice, 0`);
    if (valueOf('int-divisors-add')) bits.push(`${valueOf('int-divisors-add')} adds the counts instead of multiplying them`);
    if (valueOf('int-divisors-missed-ends')) bits.push(`${valueOf('int-divisors-missed-ends')} leaves out 1 or the number itself`);
    if (valueOf('int-counted-ordered-pairs')) bits.push(`${valueOf('int-counted-ordered-pairs')} counts divisor pairs, not divisors`);
    if (valueOf('int-divisors-parity')) bits.push(`${valueOf('int-divisors-parity')} counts the wrong set of divisors (all of them, or the other parity)`);
    const steps =
      kind === 'all'
        ? ''
        : kind === 'odd'
          ? ` An odd divisor has exponent 0 for the prime 2, so only the other primes count: $${oddFormula} = ${odd}$.`
          : ` The odd divisors have exponent 0 for the prime 2: $${oddFormula} = ${odd}$ of them, so $${total} - ${odd} = ${answer}$ are even. (The exponent of 2 may also be only 1 to ${fac[0][1]}: $${fac[0][1]}${oddFormula} = ${answer}$.)`;
    const explanation = `Counting divisors: each prime's exponent can be anything from 0 up to its power, and the choices are independent.

${diff === 3 ? '' : `$${num(N)} = ${factorTex(fac)}$. `}A divisor is $${fac.map(([p], t) => `${p}^{${'abcd'[t]}}`).join(' \\cdot ')}$, so there are $${formula} = ${total}$ positive divisors.${steps}

Check on a small case: $12 = 2^2 \\cdot 3$ has $(2 + 1)(1 + 1) = 6$ divisors: 1, 2, 3, 4, 6, 12.${bits.length ? `\n\nTrap: ${bits.slice(0, 2).join('; ')}.` : ''}`;
    return {
      params: { N, kind },
      q: { format: 'mcs', stem, choices, answer: idx, explanation },
    };
  },
  check(q, { N, kind }) {
    let c = 0;
    for (let d = 1; d <= N; d++) if (N % d === 0 && (kind === 'all' || (kind === 'even') === (d % 2 === 0))) c++;
    return expectMcsBy(q, (i) => q.format === 'mcs' && q.choices[i].text === `$${c}$`);
  },
};

/* ------------------------------------------------------------------ 4. Greatest prime factor / number of prime factors of an expression (MCS) */

interface GpfParams {
  mode: 'number' | 'power' | 'squares' | 'count';
  b: number;
  m: number;
  n: number;
  sign: 1 | -1;
}

// [base, k, sign]: b^k + sign has a prime factor larger than the base's primes.
const POWER_TABLE: [number, number, 1 | -1][] = [
  [2, 4, -1],
  [2, 4, 1],
  [2, 5, -1],
  [2, 6, -1],
  [2, 6, 1],
  [2, 5, 1],
  [2, 8, -1],
  [3, 2, 1],
  [3, 3, -1],
  [3, 3, 1],
  [3, 4, -1],
  [5, 2, 1],
  [5, 3, -1],
  [5, 3, 1],
  [10, 2, -1],
  [10, 3, -1],
];

function valueOf({ mode, b, m, n, sign }: GpfParams): bigint {
  if (mode === 'number') return BigInt(b);
  if (mode === 'squares') return BigInt(m) * BigInt(m) - BigInt(n) * BigInt(n);
  return BigInt(b) ** BigInt(m) + BigInt(sign) * BigInt(b) ** BigInt(n);
}

/** Prime factors of a BigInt by trial division (the cofactors here are small). */
function primeFactorsBig(x: bigint): number[] {
  const out: number[] = [];
  let v = x;
  for (let p = 2n; p * p <= v; p++) {
    if (v % p === 0n) {
      out.push(Number(p));
      while (v % p === 0n) v /= p;
    }
  }
  if (v > 1n) out.push(Number(v));
  return out;
}

const basePrimes = (b: number) => factorize(b).map(([p]) => p);

const gpfMC: Template<GpfParams> = {
  id: 'arith.factors.greatest-prime-factor',
  skill: 'arith.factors',
  format: 'mcs',
  style: 'greatest prime factor of a number or an expression (factor it first)',
  generate(rng, diff) {
    const mode: GpfParams['mode'] = diff === 1 ? rng.pick(['number', 'power'] as const) : diff === 2 ? rng.pick(['power', 'squares'] as const) : rng.pick(['count', 'squares', 'power'] as const);
    let p: GpfParams;
    for (;;) {
      if (mode === 'number') {
        const ps = rng.sample([2, 3, 5, 7, 11, 13, 17, 19], rng.int(3, 4)).sort((x, y) => x - y);
        const v = ps.reduce((s, x) => s * x, 1) * (rng.chance(0.5) ? ps[0] : 1);
        if (v > 3000 || v < 100) continue;
        p = { mode, b: v, m: 0, n: 0, sign: 1 };
      } else if (mode === 'squares') {
        const big = rng.int(20, 99);
        const small = rng.int(1, 5);
        p = { mode, b: 0, m: big, n: small, sign: -1 };
        const fs = primeFactorsBig(valueOf(p));
        if (Math.max(...fs) < 11) continue;
        // at least one of the two factors must be composite, so that stopping early is a real slip
        if (isPrime(big - small) && isPrime(big + small)) continue;
      } else {
        const [b, k, sign] = rng.pick(diff === 1 ? POWER_TABLE.filter(([bb, kk]) => bb === 2 && kk <= 6) : POWER_TABLE);
        const n = rng.int(b === 10 ? 3 : 5, b === 10 ? 9 : 20);
        p = { mode, b, m: n + k, n, sign };
      }
      break;
    }
    const v = valueOf(p);
    const fs = primeFactorsBig(v);
    const answer = mode === 'count' ? fs.length : Math.max(...fs);
    const traps: { value: number; trap: string }[] = [];
    const fillers: number[] = [];
    let stemExpr: string;
    let explanation: string;
    if (mode === 'number') {
      const N = p.b;
      stemExpr = num(N);
      const f = factorize(N);
      explanation = `Divide out the smallest primes first: $${num(N)} = ${factorTex(f)}$. The greatest prime factor is ${answer}.`;
      traps.push(...fs.filter((x) => x !== answer).slice(-2).map((value) => ({ value, trap: 'int-smaller-prime-factor' })));
      traps.push(
        ...rng
          .shuffle(fs.map((x) => N / x).filter((c) => c !== answer && !isPrime(c)))
          .slice(0, 2)
          .map((value) => ({ value, trap: 'int-stopped-factoring' })),
      );
      fillers.push(...primesUpTo(answer + 12).filter((x) => x > answer).slice(0, 2));
    } else if (mode === 'squares') {
      const { m, n } = p;
      stemExpr = n === 1 ? `${m}^2 - 1` : `${m}^2 - ${n * n}`;
      const lo = m - n;
      const hi = m + n;
      explanation = `Use the difference of squares: $${stemExpr} = ${m}^2 - ${n}^2 = (${m} - ${n})(${m} + ${n}) = ${lo} \\cdot ${hi}$.

$${lo} = ${factorTex(factorize(lo))}$ and $${hi} = ${factorTex(factorize(hi))}$, so the greatest prime factor is ${answer}.

Multiplying out $${m}^2$ first works too, but factoring is much faster.`;
      traps.push(...[lo, hi].filter((x) => x > 1 && !isPrime(x) && x !== answer).map((value) => ({ value, trap: 'int-stopped-factoring' })));
      traps.push(...fs.filter((x) => x !== answer).slice(-2).map((value) => ({ value, trap: 'int-smaller-prime-factor' })));
      fillers.push(...primesUpTo(answer + 20).filter((x) => x > answer).slice(0, 2));
    } else {
      const { b, m, n, sign } = p;
      const op = sign > 0 ? '+' : '-';
      stemExpr = `${b}^{${m}} ${op} ${b}^{${n}}`;
      const inner = b ** (m - n) + sign;
      const innerF = factorize(inner);
      const bp = basePrimes(b);
      const allF = factorTex(
        [...factorize(b).map(([q, e]) => [q, e * n] as [number, number]), ...innerF]
          .sort((x, y) => x[0] - y[0])
          .reduce<[number, number][]>((acc, [q, e]) => {
            const last = acc[acc.length - 1];
            if (last && last[0] === q) last[1] += e;
            else acc.push([q, e]);
            return acc;
          }, []),
      );
      explanation = `Factor out the common power: $${stemExpr} = ${b}^{${n}}(${b}^{${m - n}} ${op} 1) = ${b}^{${n}} \\cdot ${inner}$, and $${inner} = ${factorTex(innerF)}$.

So the number is $${allF}$. ${
        mode === 'count'
          ? `Its different prime factors are ${listAnd(fs.map(String))}: there are ${answer}.`
          : `Its greatest prime factor is ${answer}.`
      }

$${b}^{${m}} ${op} ${b}^{${n}}$ is not $${b}^{${m - n}}$, and the prime factors of $${b}^{${m - n}} ${op} 1$ count too.`;
      if (mode === 'count') {
        const mult = [...factorize(b).map(([, e]) => e * n), ...innerF.map(([, e]) => e)].reduce((acc, e) => acc + e, 0);
        traps.push({ value: bp.length, trap: 'int-factor-common-power' });
        traps.push({ value: innerF.length, trap: 'int-factor-common-power' });
        traps.push({ value: mult, trap: 'int-count-with-multiplicity' });
        traps.push({ value: bp.length + innerF.length, trap: 'int-count-with-multiplicity' });
        fillers.push(answer + 1, answer + 2, answer - 1);
      } else {
        traps.push({ value: Math.max(...bp), trap: 'int-factor-common-power' });
        if (inner > answer && !isPrime(inner)) traps.push({ value: inner, trap: 'int-stopped-factoring' });
        // the sign inside the parentheses flipped
        const flipped = b ** (m - n) - sign;
        if (flipped > 1) {
          const ff = primeFactorsBig(BigInt(flipped));
          traps.push({ value: Math.max(...ff), trap: 'int-sign-slip' });
        }
        // an exponent mistaken for a prime factor
        traps.push(...[m, n].filter((e) => isPrime(e) && e !== answer).map((value) => ({ value, trap: 'int-exponent-as-prime' })));
        traps.push(...fs.filter((x) => x !== answer).slice(-2).map((value) => ({ value, trap: 'int-smaller-prime-factor' })));
        fillers.push(...primesUpTo(answer + 20).filter((x) => x > answer).slice(0, 2), ...primesUpTo(answer).filter((x) => x < answer).slice(-2));
      }
    }
    const extra = mode === 'count' ? range(1, 7) : primesUpTo(answer + 40);
    const { choices, answer: idx } = spreadChoices(rng, answer, [
      ...rng.shuffle(traps.filter((t) => t.value !== answer && t.value > 0)).map((t) => ({ v: t.value, trap: t.trap })),
      ...rng.shuffle(fillers.filter((x) => x > 0)).slice(0, 2).map((v) => ({ v })),
      ...extra.map((v) => ({ v })),
    ], undefined, 5, 'shuffled');
    const stem = mode === 'count' ? `How many different prime numbers are factors of $${stemExpr}$?` : `What is the greatest prime factor of $${stemExpr}$?`;
    return { params: p, q: { format: 'mcs', stem, choices, answer: idx, explanation } };
  },
  check(q, p) {
    // Brute force on the actual number: strip every prime by trial division over a sieve.
    let v = valueOf(p);
    const found: number[] = [];
    for (let d = 2; d < 5000 && v > 1n; d++) {
      if (!primeBySieve(d)) continue;
      const D = BigInt(d);
      if (v % D === 0n) {
        found.push(d);
        while (v % D === 0n) v /= D;
      }
    }
    if (v > 1n) return 'cofactor too large to verify';
    const expected = p.mode === 'count' ? found.length : Math.max(...found);
    return expectMcsBy(q, (i) => q.format === 'mcs' && q.choices[i].text === `$${expected}$`);
  },
};

/* ------------------------------------------------------------------ 5. Least k making Nk a perfect square / cube (NE) */

interface MultParams {
  N: number;
  power: 2 | 3;
}

const squareMultiplier: Template<MultParams> = {
  id: 'arith.factors.square-multiplier',
  skill: 'arith.factors',
  format: 'ne',
  style: 'least multiplier that makes a perfect square or cube',
  generate(rng, diff) {
    const power: 2 | 3 = diff === 3 && rng.chance(0.6) ? 3 : 2;
    let N: number;
    let k: number;
    let fac: [number, number][];
    for (;;) {
      if (diff === 1) N = rng.int(12, 150);
      else {
        const ps = rng.sample([2, 3, 5, 7], rng.int(2, 3));
        N = ps.reduce((s, x) => s * x ** rng.int(1, power === 3 ? 4 : 3), 1);
      }
      fac = factorize(N);
      k = fac.reduce((s, [p, e]) => s * p ** ((power - (e % power)) % power), 1);
      const rad = fac.reduce((s, [p]) => s * p, 1);
      if (k === 1 || N > (diff === 1 ? 150 : 3000) || N < 12 || (diff === 1 && k > 40)) continue;
      if (diff >= 2 && (k === rad || k === N)) continue; // make the shortcut answers wrong
      if (k > 500) continue;
      break;
    }
    const rad = fac.reduce((s, [p]) => s * p, 1);
    const isPow = (v: number) => {
      const r = Math.round(v ** (1 / power));
      return [r - 1, r, r + 1].some((x) => x > 0 && x ** power === v);
    };
    const radWorks = isPow(N * rad);
    const word = power === 2 ? 'square' : 'cube';
    const need = fac
      .filter(([, e]) => e % power !== 0)
      .map(([p, e]) => {
        const add = (power - (e % power)) % power;
        return `$${e === 1 ? p : `${p}^{${e}}`}$ needs ${add === 1 ? `one more ${p}` : `${add} more factors of ${p}`}`;
      });
    const okList = fac.filter(([, e]) => e % power === 0).map(([p, e]) => `$${p}^{${e}}$`);
    const root = Math.round((N * k) ** (1 / power));
    const bigK = power === 2 ? N : N * N; // always works, never least here
    const traps = [
      ...(bigK <= 1e7 ? [{ value: frac(bigK), trap: 'int-least-multiplier' }] : []),
      ...(rad !== k ? [{ value: frac(rad), trap: 'int-least-multiplier' }] : []),
    ].filter((t) => !t.value.eq(k));
    const bigText = power === 2 ? `Multiplying by ${plain(N)} itself` : `Multiplying by $${num(N)}^2$`;
    const radText = radWorks
      ? ` Multiplying by every prime factor once (${plain(rad)}) also works but is not the least.`
      : ` Multiplying by every prime factor once ($k = ${num(rad)}$) does not even work: $${num(N)} \\cdot ${num(rad)} = ${num(N * rad)}$ is not a perfect ${power === 2 ? 'square' : 'cube'}.`;
    return {
      params: { N, power },
      q: {
        format: 'ne',
        stem:
          diff === 1
            ? [
                `What is the least positive integer $k$ such that $${num(N)}k$ is the ${word} of an integer?`,
                `What is the smallest positive integer $k$ for which $${num(N)}k$ is a perfect ${word}?`,
              ][rng.int(0, 1)]
            : diff === 2
              ? [
                  `If $k$ is a positive integer and $${num(N)}k$ is the ${word} of an integer, what is the least possible value of $k$?`,
                  `The product of $${num(N)}$ and a positive integer $k$ is a perfect ${word}. What is the least possible value of $k$?`,
                ][rng.int(0, 1)]
              : [
                  `$k$ is a positive integer, and $${num(N)}k$ equals the ${word} of some integer. What is the least value $k$ can have?`,
                  `For what least positive integer $k$ is $${num(N)}k$ a perfect ${word}?`,
                ][rng.int(0, 1)],
        prefix: '$k =$',
        answer: frac(k),
        traps,
        explanation: `$${num(N)} = ${factorTex(fac)}$. A perfect ${word} has every prime raised to a power that is a multiple of ${power}. ${okList.length ? `${listAnd(okList)} ${okList.length > 1 ? 'are' : 'is'} already fine; ` : ''}${listAnd(
          need,
        )}. So $k = ${num(k)}$, and $${num(N)} \\cdot ${num(k)} = ${num(N * k)} = ${root}^${power}$.

${bigText} always gives a perfect ${word}, but not the least one.${rad !== k ? radText : ''}`,
      },
    };
  },
  check(q, { N, power }) {
    for (let k = 1; k <= N * N; k++) {
      const v = N * k;
      const r = Math.round(v ** (1 / power));
      if ([r - 1, r, r + 1].some((x) => x > 0 && x ** power === v)) return expectNe(q, k);
    }
    return 'no k found';
  },
};


/* ------------------------------------------------------------------ 6. Which divisor keeps a quotient an integer (MCS) */

interface QuotParams {
  factors: number[];
  c: number;
  values: number[];
}

const exponentOf = (n: number, p: number) => {
  let e = 0;
  while (n % p === 0) {
    n /= p;
    e++;
  }
  return e;
};

const quotientInteger: Template<QuotParams> = {
  id: 'arith.factors.quotient-integer',
  skill: 'arith.factors',
  format: 'mcs',
  style: 'which value of y keeps a quotient of products an integer',
  generate(rng, diff) {
    for (;;) {
      const factors = rng.sample(range(2, diff === 1 ? 10 : 12), diff === 1 ? 4 : diff === 2 ? 5 : 6).sort((a, b) => a - b);
      const N = factors.reduce((s, x) => s * x, 1);
      const c = rng.pick([4, 6, 8, 9, 10, 12, 14, 15, 18, 20, 21].filter((x) => N % x === 0 && !factors.includes(x)));
      if (!c) continue;
      const R = N / c;
      const fR = factorize(R);
      const divs = range(2, 120).filter((y) => R % y === 0);
      const composite = divs.filter((y) => !isPrime(y));
      if (!composite.length) continue;
      const big = composite.filter((y) => y >= 10);
      const correct = rng.pick(big.length && rng.chance(0.7) ? big : composite);
      const cands: { v: number; trap?: string }[] = [];
      // divides N but not N / c: forgot to cancel c
      for (const y of range(2, 120)) if (N % y === 0 && R % y !== 0) cands.push({ v: y, trap: 'int-cancel-first' });
      // a prime that is not available
      const missing = [11, 13, 17, 19, 23].filter((p) => N % p !== 0);
      for (const p of missing) for (const m of [1, 2, 3, 5]) if (p * m < 120) cands.push({ v: p * m, trap: 'int-missing-prime' });
      // one power too many
      for (const [p, e] of fR) if (p ** (e + 1) < 150) cands.push({ v: p ** (e + 1), trap: 'int-power-too-many' });
      const bad = cands.filter((x) => R % x.v !== 0);
      let built: ReturnType<typeof spreadChoices>;
      try {
        built = spreadChoices(rng, correct, rng.shuffle(bad));
      } catch {
        continue;
      }
      const values = built.choices.map((ch) => Number(ch.text.slice(1, -1)));
      const numTex = factors.join(' \\cdot ');
      const why = values.map((y) => {
        const label = isPrime(y) ? `${y}` : `$${y} = ${factorTex(factorize(y))}$`;
        if (R % y === 0) return `- ${label} divides $${num(R)}$ ✓`;
        const need = factorize(y).find(([p, e]) => exponentOf(R, p) < e)!;
        const have = exponentOf(R, need[0]);
        return `- ${label} ✗: ${have === 0 ? `no factor ${need[0]} is left` : `only $${need[0]}${have > 1 ? `^{${have}}` : ''}$ is left`}${N % y === 0 ? ` (it divides the numerator, but ${c} uses up part of it)` : ''}`;
      });
      return {
        params: { factors, c, values },
        q: {
          format: 'mcs',
          stem: `If $x = \\dfrac{${numTex}}{${c}y}$, where $x$ and $y$ are positive integers, which of the following could be the value of $y$?`,
          choices: built.choices,
          answer: built.answer,
          explanation: `Factor the numerator: $${numTex} = ${factorTex(factorize(N))}$. Cancel $${c} = ${factorTex(factorize(c))}$ first: $x = \\dfrac{${factorTex(fR)}}{y}$, that is, $\\frac{${num(R)}}{y}$. So $y$ must be a divisor of $${factorTex(fR)}$.

${why.join('\n')}`,
        },
      };
    }
  },
  check(q, { factors, c, values }) {
    const N = factors.reduce((s, x) => s * x, 1);
    return expectMcsBy(q, (i) => N % (c * values[i]) === 0);
  },
};

export const factorsTemplates: Template<any>[] = [productPair, divisorCountQC, countDivisorsMC, gpfMC, squareMultiplier, quotientInteger];
