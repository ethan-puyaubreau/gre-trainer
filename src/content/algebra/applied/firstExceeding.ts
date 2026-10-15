import { numericChoices } from '../../../engine/build';
import { frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { choiceFrac, firstTrap } from './trapNote';

// New alg.sequences style (MCS): the least n for which a term, or a partial sum, exceeds a bound.
export const firstExceedingTraps: Record<string, Trap> = {
  'alg-fe-off-by-one': {
    label: 'Stopped one position early: counted a term that does not exceed the bound',
    fix: 'The least $n$ is the first position where the value is strictly greater than the bound. Check the two neighbouring positions: the one before must not exceed it, the one you give must.',
  },
  'alg-fe-ignore-first': {
    label: 'Ignored the first term when solving the inequality',
    fix: 'The $n$-th term is $a_1 + (n - 1)d$, not $nd$. Keep $a_1$ and the $n - 1$ in the inequality before solving.',
  },
  'alg-fe-sign-first': {
    label: 'Subtracted the first term instead of adding it',
    fix: 'In $a_1 + (n - 1)d > N$ the first term stays on the left; moving it across gives $(n - 1)d > N - a_1$, with a minus.',
  },
  'alg-fe-term-value': {
    label: 'Gave the value of the term (or sum) instead of its position $n$',
    fix: 'The question asks for the position $n$, a small whole number. The value found at that position is only a check.',
  },
  'alg-fe-linear': {
    label: 'Treated multiplication by a ratio as adding the same amount each time',
    fix: 'In a geometric sequence each term is the previous one times $r$. The terms grow faster and faster, so the position comes from powers, not from dividing by a fixed step.',
  },
  'alg-fe-ignore-start': {
    label: 'Compared the power of the ratio with the bound and ignored the first term',
    fix: 'The $n$-th term is $a_1 r^{n-1}$. The first term multiplies the power, so $r^{n-1}$ must exceed $\\frac{N}{a_1}$, not $N$.',
  },
  'alg-fe-term-not-sum': {
    label: 'Looked for the first term that exceeds the bound instead of the first sum',
    fix: 'A partial sum adds all the terms so far, so it passes the bound long before a single term does.',
  },
};

interface FParams {
  mode: 'term' | 'geo' | 'sum';
  a: number;
  d: number;
  N: number;
}

const termOf = (m: FParams['mode'], a: number, d: number, n: number) => (m === 'geo' ? a * d ** (n - 1) : a + (n - 1) * d);
/** Value compared with the bound at position n. */
const valueOf = (m: FParams['mode'], a: number, d: number, n: number) => (m === 'sum' ? (n * (2 * a + (n - 1) * d)) / 2 : termOf(m, a, d, n));
const leastN = (m: FParams['mode'], a: number, d: number, N: number, pick: (n: number) => number = (n) => valueOf(m, a, d, n)) => {
  for (let n = 1; n < 400; n++) if (pick(n) > N) return n;
  return -1;
};

const firstExceedingMCS: Template<FParams> = {
  id: 'alg.sequences.first-exceeding-mcs',
  skill: 'alg.sequences',
  format: 'mcs',
  style: 'least n for which a term or a partial sum exceeds a bound',
  generate(rng, d) {
    for (;;) {
      const mode: FParams['mode'] = d === 1 ? 'term' : d === 2 ? 'geo' : 'sum';
      let a: number;
      let step: number;
      let nStar: number;
      if (mode === 'term') {
        a = rng.int(1, 9);
        step = rng.int(2, 9);
        nStar = rng.int(5, 30);
      } else if (mode === 'geo') {
        a = rng.int(1, 5);
        step = rng.pick([2, 2, 3]);
        nStar = rng.int(4, step === 2 ? 11 : 7);
      } else {
        a = rng.int(1, 8);
        step = rng.int(2, 7);
        nStar = rng.int(5, 24);
      }
      const prev = valueOf(mode, a, step, nStar - 1);
      const cur = valueOf(mode, a, step, nStar);
      if (cur - prev < 2 && mode !== 'sum') continue;
      const N = rng.chance(0.35) ? prev : rng.int(prev, cur - 1);
      if (N < 1 || leastN(mode, a, step, N) !== nStar) continue;
      const exact = N === prev;
      let answer = nStar;
      let stem: string;
      let traps: { value: number; trap: string }[];
      let order: string[];
      let notes: Record<string, string>;
      let explanation: (t: string) => string;
      const lo = leastN(mode, a, step, N, (n) => step * n); // d*n > N
      if (mode === 'term') {
        stem = `In a sequence, $a_1 = ${num(a)}$ and $a_{n+1} = a_n + ${step}$ for every positive integer $n$. What is the least positive integer $n$ for which $a_n > ${num(N)}$?`;
        const signFirst = leastN(mode, a, step, N, (n) => (n - 1) * step - a);
        traps = [
          { value: nStar - 1, trap: 'alg-fe-off-by-one' },
          { value: lo, trap: 'alg-fe-ignore-first' },
          { value: signFirst, trap: 'alg-fe-sign-first' },
          { value: cur, trap: 'alg-fe-term-value' },
        ];
        order = ['alg-fe-off-by-one', 'alg-fe-term-value', 'alg-fe-ignore-first', 'alg-fe-sign-first'];
        notes = {
          'alg-fe-off-by-one': `stopping at $n = ${nStar - 1}$ fails because $a_{${nStar - 1}} = ${num(prev)}$${exact ? ' equals the bound, and equal is not greater' : ' does not exceed the bound'}`,
          'alg-fe-term-value': `$${num(cur)}$ is the value of $a_{${nStar}}$, not the position`,
          'alg-fe-ignore-first': `solving ${step}n > ${num(N)} drops the first term and gives $n = ${lo}$`,
          'alg-fe-sign-first': `subtracting $a_1$ instead of adding it gives $n = ${signFirst}$`,
        };
        explanation = (t) => `This sequence adds ${step} each time, so $a_n = ${num(a)} + ${step}(n - 1)$.

We need $${num(a)} + ${step}(n - 1) > ${num(N)}$, so $n - 1 > \\frac{${num(N)} - ${num(a)}}{${step}} = ${num(frac(N - a, step))}$. The least integer $n - 1$ above that is $${nStar - 1}$, so $n = ${nStar}$.

Check: $a_{${nStar - 1}} = ${num(prev)} \\le ${num(N)}$ but $a_{${nStar}} = ${num(cur)} > ${num(N)}$.

Trap: ${t}. Rule: the answer is the first position that passes the bound strictly; test it and the position before.`;
      } else if (mode === 'geo') {
        stem = `In a sequence, $a_1 = ${a}$ and $a_{n+1} = ${step}a_n$ for every positive integer $n$. What is the least positive integer $n$ for which $a_n > ${num(N)}$?`;
        const linearN = leastN(mode, a, step, N, (n) => a + (n - 1) * a * (step - 1));
        const ignoreA = leastN(mode, a, step, N, (n) => step ** n);
        traps = [
          { value: nStar - 1, trap: 'alg-fe-off-by-one' },
          { value: linearN, trap: 'alg-fe-linear' },
          { value: ignoreA, trap: 'alg-fe-ignore-start' },
          { value: cur, trap: 'alg-fe-term-value' },
        ];
        order = ['alg-fe-off-by-one', 'alg-fe-linear', 'alg-fe-ignore-start', 'alg-fe-term-value'];
        notes = {
          'alg-fe-off-by-one': `stopping at $n = ${nStar - 1}$ fails because $a_{${nStar - 1}} = ${num(prev)}$${exact ? ' equals the bound, and equal is not greater' : ' does not exceed the bound'}`,
          'alg-fe-linear': `adding the first step each time would put the bound at position $${linearN}$, but doubling and tripling grow much faster`,
          'alg-fe-ignore-start': `comparing powers of ${step} with $${num(N)}$ and ignoring the first term gives $n = ${ignoreA}$`,
          'alg-fe-term-value': `$${num(cur)}$ is the value of $a_{${nStar}}$, not the position`,
        };
        explanation = (t) => `Each term is ${step} times the one before, so $a_n = ${a}\\cdot ${step}^{n-1}$.

List the terms until the bound is passed: ${Array.from({ length: nStar }, (_, i) => `$a_{${i + 1}} = ${num(termOf(mode, a, step, i + 1))}$`).join(', ')}. The first one above $${num(N)}$ is $a_{${nStar}}$, while $a_{${nStar - 1}} = ${num(prev)}$ is not.

Check: $${a}\\cdot ${step}^{${nStar - 1}} = ${num(cur)} > ${num(N)}$.

Trap: ${t}. Rule: with a ratio, list or compare powers and test the position before.`;
      } else {
        stem = `The first term of an arithmetic sequence is $${a}$, and each term after the first is ${step} more than the term before it. What is the least positive integer $n$ for which the sum of the first $n$ terms is greater than $${num(N)}$?`;
        const termNot = leastN('term', a, step, N);
        const ignoreFirst = leastN(mode, a, step, N, (n) => (step * n * n) / 2);
        traps = [
          { value: nStar - 1, trap: 'alg-fe-off-by-one' },
          { value: termNot, trap: 'alg-fe-term-not-sum' },
          { value: ignoreFirst, trap: 'alg-fe-ignore-first' },
          { value: cur, trap: 'alg-fe-term-value' },
        ];
        order = ['alg-fe-off-by-one', 'alg-fe-term-not-sum', 'alg-fe-term-value', 'alg-fe-ignore-first'];
        notes = {
          'alg-fe-off-by-one': `stopping at $n = ${nStar - 1}$ fails because the sum of ${nStar - 1} terms is $${num(prev)}$${exact ? ', which equals the bound, and equal is not greater' : ', not above the bound'}`,
          'alg-fe-term-not-sum': `waiting for a single term above $${num(N)}$ gives $n = ${termNot}$, far too late for the sum`,
          'alg-fe-term-value': `$${num(cur)}$ is the sum itself, not the number of terms`,
          'alg-fe-ignore-first': `using only $\\frac{${step}n^2}{2}$ and dropping the first-term part gives $n = ${ignoreFirst}$`,
        };
        explanation = (t) => `The sum of the first $n$ terms is $S_n = \\frac{n}{2}\\,(2\\cdot ${a} + (n - 1)\\cdot ${step})$, and it grows by a larger term each time.

Test positions around the bound: $S_{${nStar - 1}} = ${num(prev)}$ and $S_{${nStar}} = ${num(cur)}$. Since $S_{${nStar - 1}} \\le ${num(N)} < S_{${nStar}}$ and the sums only increase, the least $n$ is $${nStar}$.

Check: $S_{${nStar}} - S_{${nStar - 1}} = ${num(cur - prev)}$ is the ${nStar}th term, $${num(a + (nStar - 1) * step)}$.

Trap: ${t}. Rule: use the sum formula, then test the two positions around the bound.`;
      }
      const values = traps.map((t) => t.value);
      if (values.some((v) => v < 1) || new Set(values.filter((v) => v !== answer)).size < 4) continue;
      const built = numericChoices(rng, { correct: answer, traps, format: (v) => `$${num(v)}$`, order: 'random' });
      if (built.choices.filter((c) => c.trap).length < 4) continue;
      const first = firstTrap(built.choices, order);
      return { params: { mode, a, d: step, N }, q: { format: 'mcs', stem, choices: built.choices, answer: built.answer, explanation: explanation(notes[first]) } };
    }
  },
  check(q, P) {
    if (q.format !== 'mcs') return 'wrong format';
    const key = choiceFrac(q.choices[q.answer].text).n;
    // direct accumulation, not the closed forms used by generate()
    let sum = 0;
    let term = P.a;
    let want = -1;
    for (let n = 1; n < 400; n++) {
      if (n > 1) term = P.mode === 'geo' ? term * P.d : term + P.d;
      sum += term;
      const v = P.mode === 'sum' ? sum : term;
      if (v > P.N) {
        want = n;
        break;
      }
    }
    return want === key ? null : `expected ${want}, keyed ${key}`;
  },
};

export const firstExceedingTemplates: Template<any>[] = [firstExceedingMCS];
