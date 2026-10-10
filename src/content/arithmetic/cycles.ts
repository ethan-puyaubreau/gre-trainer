import { numericChoices, qcCompare, textChoices } from '../../engine/build';
import { frac, Frac } from '../../engine/frac';
import { decimalDigits, gcd, mod, range, sum } from '../../engine/math';
import { num, ordinal } from '../../engine/tex';
import type { Difficulty, QCChoice, QCQuestion, Template } from '../../engine/types';

/* ---------------------------------------------------------------------------------------------
 * Decimal expansion with its repeating block, computed by long division until a remainder repeats.
 * ------------------------------------------------------------------------------------------- */
export function decimalExpansion(p: number, q: number): { prefix: number[]; cycle: number[] } {
  const seen = new Map<number, number>();
  const digits: number[] = [];
  let r = p % q;
  while (r !== 0 && !seen.has(r)) {
    seen.set(r, digits.length);
    r *= 10;
    digits.push(Math.floor(r / q));
    r %= q;
  }
  if (r === 0) return { prefix: digits, cycle: [0] };
  const start = seen.get(r)!;
  return { prefix: digits.slice(0, start), cycle: digits.slice(start) };
}

function decimalTex(prefix: number[], cycle: number[]): string {
  return `0.${prefix.join('')}\\overline{${cycle.join('')}}`;
}

/* ------------------------------------------------------------------ 1. n-th digit of a repeating decimal (QC) */

interface DigitParams {
  p: number;
  q: number;
  n: number;
  k: number;
}

const DIGIT_DENOMS: Record<Difficulty, number[]> = {
  1: [11, 33, 37, 27, 99],
  2: [7, 13, 11, 37, 27],
  3: [7, 13, 14, 22, 26, 41],
};
const DIGIT_N: Record<Difficulty, [number, number]> = { 1: [10, 40], 2: [25, 80], 3: [40, 150] };

const decimalDigitQC: Template<DigitParams> = {
  id: 'arith.cycles.decimal-digit',
  skill: 'arith.cycles',
  format: 'qc',
  style: 'n-th digit of a repeating decimal',
  generate(rng, d) {
    let q = 0;
    let p = 0;
    let exp = { prefix: [] as number[], cycle: [] as number[] };
    do {
      q = rng.pick(DIGIT_DENOMS[d]);
      p = rng.int(1, q - 1);
      exp = decimalExpansion(p, q);
    } while (gcd(p, q) !== 1 || exp.cycle.length < 2 || new Set(exp.cycle).size < 2);
    const { prefix, cycle } = exp;
    const L = cycle.length;
    const n = rng.int(...DIGIT_N[d]);
    const posInCycle = mod(n - prefix.length - 1, L); // 0-based
    const digit = n <= prefix.length ? prefix[n - 1] : cycle[posInCycle];

    // The digit a student gets with the classic slip.
    let trapDigit: number;
    let trapId: string;
    if (prefix.length > 0) {
      trapDigit = cycle[mod(n - 1, L)];
      trapId = 'cycle-wrong-start';
    } else if (n % L === 0) {
      trapDigit = cycle[0];
      trapId = 'cycle-off-by-one';
    } else {
      trapDigit = cycle[n % L];
      trapId = 'cycle-off-by-one';
    }

    let k: number;
    if (trapDigit !== digit && rng.chance(0.4)) k = trapDigit;
    else {
      const options: QCChoice[] = ['C'];
      if (digit > 0) options.push('A');
      if (digit < 9) options.push('B');
      const rel = rng.pick(options);
      k = rel === 'C' ? digit : rel === 'A' ? rng.int(Math.max(0, digit - 3), digit - 1) : rng.int(digit + 1, Math.min(9, digit + 3));
    }
    const answer = qcCompare(digit, k);
    const trapAnswer = qcCompare(trapDigit, k);
    const traps: QCQuestion['traps'] = trapAnswer !== answer ? { [trapAnswer]: trapId } : undefined;

    const L1 = prefix.length;
    const where =
      L1 === 0
        ? `Since $${n} = ${L} \\cdot ${Math.floor(n / L)} + ${n % L}$, the ${ordinal(n)} digit is ${
            n % L === 0 ? `the last digit of the block` : `digit number ${n % L} of the block`
          }, which is ${digit}.`
        : `The first ${L1 === 1 ? 'digit does' : `${L1} digits do`} not repeat, so the ${ordinal(n)} digit is digit number ${n - L1} of the repeating part. Since $${n - L1} = ${L} \\cdot ${Math.floor((n - L1) / L)} + ${(n - L1) % L}$, that is ${
            (n - L1) % L === 0 ? 'the last digit of the block' : `digit number ${(n - L1) % L} of the block`
          }: ${digit}.`;

    return {
      params: { p, q, n, k },
      q: {
        format: 'qc',
        info: `$D$ is the decimal form of the fraction $${frac(p, q).toTex({ dfrac: true })}$.`,
        quantityA: `The ${ordinal(n)} digit to the right of the decimal point in $D$`,
        quantityB: `$${k}$`,
        answer,
        traps,
        explanation: `$${frac(p, q).toTex()} = ${decimalTex(prefix, cycle)}$: a repeating block of ${L} digits. ${where}

Compare ${digit} with ${k}: ${answer === 'C' ? 'they are equal' : answer === 'A' ? 'Quantity A is greater' : 'Quantity B is greater'}. (${answer})`,
      },
    };
  },
  check(q, { p, q: den, n, k }) {
    const digit = decimalDigits(p, den, n)[n - 1];
    const expected = qcCompare(digit, k);
    return q.format === 'qc' && q.answer === expected ? null : `expected ${expected}, digit ${digit}`;
  },
};

/* ------------------------------------------------------------------ 2. Sum of a range of a periodic sequence (NE) */

interface SeqParams {
  cycle: number[];
  m: number;
  n: number;
}

const SEQ: Record<Difficulty, { L: number[]; m: [number, number]; len: [number, number] }> = {
  1: { L: [3], m: [10, 60], len: [4, 6] },
  2: { L: [3, 4], m: [100, 300], len: [5, 8] },
  3: { L: [4, 5], m: [150, 600], len: [7, 12] },
};

function seqSum(cycle: number[], from: number, to: number): number {
  // Closed form: full cycles + leftover terms.
  const L = cycle.length;
  const count = to - from + 1;
  const full = Math.floor(count / L);
  const cycleSum = sum(cycle);
  let s = full * cycleSum;
  for (let pos = from + full * L; pos <= to; pos++) s += cycle[mod(pos - 1, L)];
  return s;
}

const periodicSequenceSum: Template<SeqParams> = {
  id: 'arith.cycles.sequence-sum',
  skill: 'arith.cycles',
  format: 'ne',
  style: 'sum of a stretch of a repeating sequence',
  generate(rng, d) {
    const cfg = SEQ[d];
    const L = rng.pick(cfg.L);
    let cycle: number[];
    do {
      cycle = range(1, L).map(() => rng.int(1, 9) * rng.sign());
    } while (new Set(cycle).size < L || cycle.every((x) => x > 0) || cycle.every((x) => x < 0));
    const m = rng.int(...cfg.m);
    const n = m + rng.int(...cfg.len) - 1;
    const answer = seqSum(cycle, m, n);
    const count = n - m + 1;
    const full = Math.floor(count / L);
    const left = count - full * L;
    const startIdx = mod(m - 1, L);

    const traps: { value: Frac; trap: string }[] = [];
    const shortSum = seqSum(cycle, m, n - 1);
    if (shortSum !== answer) traps.push({ value: frac(shortSum), trap: 'cycle-count-terms' });
    const wrongStart = range(0, count - 1).reduce((s, i) => s + cycle[i % L], 0);
    if (wrongStart !== answer && wrongStart !== shortSum) traps.push({ value: frac(wrongStart), trap: 'cycle-wrong-start' });

    const shown = [...cycle, ...cycle, ...cycle].map((x) => num(x)).join(', ');
    const mapping = cycle.map((v, i) => `remainder ${(i + 1) % L} $\\to ${num(v)}$`).join(', ');
    const leftoverTerms = range(m + full * L, n).map((pos) => cycle[mod(pos - 1, L)]);
    return {
      params: { cycle, m, n },
      q: {
        format: 'ne',
        stem: `$$${shown}, \\ldots$$

In the sequence above, the first ${L} terms repeat without end. What is the sum of the terms of the sequence from the ${ordinal(m)} term to the ${ordinal(n)} term?`,
        answer: frac(answer),
        traps,
        explanation: `The term in position $k$ depends only on the remainder of $k \\div ${L}$: ${mapping}. One full cycle sums to $${num(sum(cycle))}$.

From term ${m} to term ${n} there are $${n} - ${m} + 1 = ${count}$ terms${full > 0 ? `, that is ${full} full cycle${full > 1 ? 's' : ''} (sum $${num(full * sum(cycle))}$)` : ''}${
          left > 0 ? ` plus ${left} more term${left > 1 ? 's' : ''}` : ''
        }. ${
          m % L === 0
            ? `Since ${m} is a multiple of ${L}, term ${m} is the last element of the cycle.`
            : `Since $${m} = ${L} \\cdot ${Math.floor(m / L)} + ${m % L}$, term ${m} is element ${startIdx + 1} of the cycle.`
        }${left > 0 ? ` The leftover terms are $${leftoverTerms.map((x) => num(x)).join(', ')}$.` : ''}

Total: $${num(answer)}$.`,
      },
    };
  },
  check(q, { cycle, m, n }) {
    let s = 0;
    for (let pos = m; pos <= n; pos++) s += cycle[(pos - 1) % cycle.length];
    return q.format === 'ne' && q.answer.eq(s) ? null : `expected ${s}`;
  },
};

/* ------------------------------------------------------------------ 3. Units digit of a power (MCS) */

interface UnitsParams {
  terms: { base: number; exp: number }[];
  op: '+' | '×' | 'single';
}

function unitsCycle(base: number): number[] {
  const out: number[] = [];
  let x = base % 10;
  while (!out.includes(x)) {
    out.push(x);
    x = (x * (base % 10)) % 10;
  }
  return out;
}

function unitsDigitByCycle(base: number, exp: number): number {
  const c = unitsCycle(base);
  return c[mod(exp - 1, c.length)];
}

const unitsDigitPower: Template<UnitsParams> = {
  id: 'arith.cycles.units-digit',
  skill: 'arith.cycles',
  format: 'mcs',
  style: 'units digit of a large power',
  generate(rng, d) {
    let terms: { base: number; exp: number }[];
    let op: UnitsParams['op'] = 'single';
    if (d === 1) terms = [{ base: rng.pick([2, 3, 7, 8]), exp: rng.int(20, 60) }];
    else if (d === 2) terms = [{ base: rng.pick([12, 13, 17, 18, 22, 23, 27, 28, 33, 37, 43, 47, 53, 57]), exp: rng.int(30, 150) }];
    else {
      op = rng.pick(['+', '×'] as const);
      const [b1, b2] = rng.sample([2, 3, 4, 7, 8, 9], 2);
      terms = [
        { base: b1, exp: rng.int(20, 99) },
        { base: b2, exp: rng.int(20, 99) },
      ];
    }
    const digits = terms.map((t) => unitsDigitByCycle(t.base, t.exp));
    const combine = (a: number[]) => (op === '+' ? (a[0] + a[1]) % 10 : op === '×' ? (a[0] * a[1]) % 10 : a[0]);
    const answer = combine(digits);

    // remainder-0 / off-by-one slip on every term
    const slip = terms.map((t) => {
      const c = unitsCycle(t.base);
      return t.exp % c.length === 0 ? c[0] : c[t.exp % c.length];
    });
    const product = terms.map((t) => (t.base * t.exp) % 10);
    const traps = [
      { value: combine(slip), trap: 'cycle-off-by-one' },
      { value: combine(product), trap: 'power-as-product' },
    ];
    const fillers = rng.shuffle([...unitsCycle(terms[0].base), ...range(0, 9)]);
    const { choices, answer: idx } = numericChoices(rng, {
      correct: answer,
      traps,
      fillers,
      format: (v) => `$${v.toString()}$`,
    });
    const expr = terms.map((t) => `${t.base}^{${t.exp}}`).join(op === '+' ? ' + ' : op === '×' ? ' \\times ' : '');
    const lines = terms
      .map((t, i) => {
        const c = unitsCycle(t.base);
        const r = t.exp % c.length;
        return `The units digits of powers of ${t.base} repeat in the cycle ${c.join(', ')} (length ${c.length}). Since $${t.exp} = ${c.length} \\cdot ${Math.floor(
          t.exp / c.length,
        )} + ${r}$, the units digit of $${t.base}^{${t.exp}}$ is ${r === 0 ? 'the last element of the cycle' : `element number ${r}`}: ${digits[i]}.`;
      })
      .join('\n\n');
    const tail =
      op === 'single'
        ? ''
        : `\n\nOnly units digits matter: ${digits[0]} ${op === '+' ? '+' : '×'} ${digits[1]} ends in ${answer}.`;
    return {
      params: { terms, op },
      q: {
        format: 'mcs',
        stem: `What is the units digit of $${expr}$?`,
        choices,
        answer: idx,
        explanation: lines + tail,
      },
    };
  },
  check(q, { terms, op }) {
    const pw = (b: number, e: number) => {
      let r = 1;
      for (let i = 0; i < e; i++) r = (r * b) % 10;
      return r;
    };
    const ds = terms.map((t) => pw(t.base, t.exp));
    const expected = op === '+' ? (ds[0] + ds[1]) % 10 : op === '×' ? (ds[0] * ds[1]) % 10 : ds[0];
    if (q.format !== 'mcs') return 'wrong format';
    return q.choices[q.answer].text === `$${expected}$` ? null : `expected ${expected}`;
  },
};

/* ------------------------------------------------------------------ 4. Day of the week (MCS) */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface DayParams {
  start: number;
  /** Number of days to move forward. */
  shift: number;
  mode: 'after' | 'day-of-year';
  n: number;
}

const dayOfWeek: Template<DayParams> = {
  id: 'arith.cycles.day-of-week',
  skill: 'arith.cycles',
  format: 'mcs',
  style: 'day of the week far in the future',
  generate(rng, d) {
    const start = rng.int(0, 6);
    const mode: DayParams['mode'] = d === 3 ? 'day-of-year' : 'after';
    const n = d === 1 ? rng.int(15, 60) : d === 2 ? rng.int(80, 400) : rng.int(100, 365);
    const shift = mode === 'after' ? n : n - 1;
    const answer = (start + shift) % 7;
    const slip = mode === 'after' ? (start + shift + 1) % 7 : (start + n) % 7;
    const others = rng.sample(
      range(0, 6).filter((x) => x !== answer && x !== slip),
      3,
    );
    const picked = [answer, slip, ...others].sort((a, b) => a - b);
    const wrong = picked.filter((x) => x !== answer).map((x) => ({ text: DAYS[x], ...(x === slip ? { trap: 'cycle-off-by-one' } : {}) }));
    const { choices, answer: idx } = textChoices(rng, DAYS[answer], wrong, 'random');
    // Keep the choices in week order (the way the GRE lists them).
    const order = choices.map((c, i) => ({ c, i, k: DAYS.indexOf(c.text) })).sort((a, b) => a.k - b.k);
    const stem =
      mode === 'after'
        ? `If today is a ${DAYS[start]}, what day of the week will it be ${n} days from today?`
        : `In a certain year, January 1 is a ${DAYS[start]}. On what day of the week is the ${ordinal(n)} day of that year?`;
    const explanation =
      mode === 'after'
        ? `The days of the week repeat every 7 days. Since $${n} = 7 \\cdot ${Math.floor(n / 7)} + ${n % 7}$, moving ${n} days ahead lands on the same day as moving ${n % 7} day${n % 7 === 1 ? '' : 's'} ahead: ${DAYS[answer]}.`
        : `Day 1 is a ${DAYS[start]}, so day ${n} is $${n} - 1 = ${shift}$ days later (not ${n}). Since $${shift} = 7 \\cdot ${Math.floor(shift / 7)} + ${shift % 7}$, it is ${shift % 7} day${shift % 7 === 1 ? '' : 's'} after ${DAYS[start]}: ${DAYS[answer]}.`;
    return {
      params: { start, shift, mode, n },
      q: {
        format: 'mcs',
        stem,
        choices: order.map((o) => o.c),
        answer: order.findIndex((o) => o.i === idx),
        explanation,
      },
    };
  },
  check(q, { start, mode, n }) {
    let day = start;
    const steps = mode === 'after' ? n : n - 1;
    for (let i = 0; i < steps; i++) day = (day + 1) % 7;
    if (q.format !== 'mcs') return 'wrong format';
    return q.choices[q.answer].text === DAYS[day] ? null : `expected ${DAYS[day]}`;
  },
};

export const cycleTemplates = [decimalDigitQC, periodicSequenceSum, unitsDigitPower, dayOfWeek];
