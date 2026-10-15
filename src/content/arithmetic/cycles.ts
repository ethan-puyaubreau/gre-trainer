import { qcCompare, qcFromSamples, valuedChoices } from '../../engine/build';
import { frac, Frac } from '../../engine/frac';
import { decimalDigits, gcd, mod, range, sum } from '../../engine/math';
import { num, ordinal } from '../../engine/tex';
import { plural } from '../../engine/text';
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
  /** the digit position is only known to lie in n .. n + span - 1 (answer D when the digits disagree with k) */
  span?: number;
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
    // Sometimes the position is only known to lie in a short range: the digits there differ, so the comparison can flip (answer D).
    const span = rng.int(2, 3);
    const digitAt = (pos: number) => (pos <= prefix.length ? prefix[pos - 1] : cycle[mod(pos - prefix.length - 1, L)]);
    const around = range(n, n + span - 1).map(digitAt);
    if (d >= 2 && rng.chance(0.3) && new Set(around).size > 1) {
      const kRange = around[0];
      const first: QCChoice = 'C'; // at m = n the digit equals k
      const L2 = prefix.length;
      return {
        params: { p, q, n, k: kRange, span },
        q: {
          format: 'qc',
          info: `$D$ is the decimal form of the fraction $${frac(p, q).toTex({ dfrac: true })}$, and $m$ is an integer with $${n} \\le m \\le ${n + span - 1}$.`,
          quantityA: 'The $m$th digit to the right of the decimal point in $D$',
          quantityB: `$${kRange}$`,
          answer: 'D',
          traps: { [first]: 'tested-one-value' },
          explanation: `$${frac(p, q).toTex()} = ${decimalTex(prefix, cycle)}$, so the repeating block has ${L} digits${L2 ? ` after ${L2 === 1 ? 'one non-repeating digit' : `${L2} non-repeating digits`}` : ''}. List the digits in the allowed positions: ${range(n, n + span - 1)
            .map((pos) => `digit ${pos} is ${digitAt(pos)}`)
            .join(', ')}.

Compare each with ${kRange}: digit ${n} is equal to it, but digit ${n + around.findIndex((x) => x !== kRange)} is ${around.find((x) => x !== kRange)! > kRange ? 'greater' : 'less'}. Two allowed values of $m$ disagree, so the relationship cannot be determined. (D)

Trap: testing only $m = ${n}$ suggests that the quantities are equal; $m$ takes ${span} values.`,
        },
      };
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
        explanation: `A repeating decimal: the ${ordinal(n)} digit depends only on its place inside the repeating block.

$${frac(p, q).toTex()} = ${decimalTex(prefix, cycle)}$, so the block has ${L} digits. ${where}

Compare ${digit} with ${k}: ${answer === 'C' ? 'they are equal' : answer === 'A' ? 'Quantity A is greater' : 'Quantity B is greater'}. (${answer})

Check: the expansion begins $0.${prefix.join('')}${cycle.join('')}${cycle.slice(0, 3).join('')}\\ldots$, and each pass through the block adds ${L} digits.${
          traps
            ? ` Trap: ${
                trapId === 'cycle-wrong-start'
                  ? `counting the block from the first digit after the point ignores the ${plural(L1, 'digit')} before it and reads ${trapDigit}`
                  : n % L === 0
                    ? `a remainder of 0 means the last digit of the block, not the first (${trapDigit})`
                    : `the remainder ${n % L} is the place in the block, so the digit is number ${n % L}, not number ${(n % L) + 1} (${trapDigit})`
              }.`
            : ''
        }`,
      },
    };
  },
  check(q, { p, q: den, n, k, span }) {
    if (span) {
      const all = decimalDigits(p, den, n + span - 1);
      const expected = qcFromSamples(range(n, n + span - 1).map((pos): [number, number] => [all[pos - 1], k]));
      return q.format === 'qc' && q.answer === expected ? null : `expected ${expected}`;
    }
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

The sequence above repeats its first ${L} terms indefinitely. What is the sum of the ${ordinal(m)} through the ${ordinal(n)} terms of the sequence, inclusive?`,
        answer: frac(answer),
        traps,
        explanation: `The term in position $k$ depends only on the remainder of $k \\div ${L}$: ${mapping}. One full cycle sums to $${num(sum(cycle))}$.

From term ${m} to term ${n} there are $${n} - ${m} + 1 = ${count}$ terms${full > 0 ? `, that is ${full} full cycle${full > 1 ? 's' : ''} (sum $${num(full * sum(cycle))}$)` : ''}${
          left > 0 ? ` plus ${left} more term${left > 1 ? 's' : ''}` : ''
        }. ${
          m % L === 0
            ? `Since ${m} is a multiple of ${L}, term ${m} is the last element of the cycle.`
            : `Since $${m} = ${L} \\cdot ${Math.floor(m / L)} + ${m % L}$, term ${m} is element ${startIdx + 1} of the cycle.`
        }${left > 0 ? ` The leftover term${left > 1 ? 's are' : ' is'} $${leftoverTerms.map((x) => num(x)).join(', ')}$.` : ''}

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

const UNITS_BASES: Record<Difficulty, number[]> = {
  1: [2, 3, 7, 8],
  2: [12, 13, 17, 18, 22, 23, 27, 28, 32, 33, 37, 38, 42, 43, 47, 48, 53, 57, 62, 63, 67, 68],
  3: [2, 3, 4, 7, 8, 9],
};
const UNITS_EXP: Record<Difficulty, [number, number]> = { 1: [12, 99], 2: [30, 199], 3: [20, 99] };

const unitsDigitPower: Template<UnitsParams> = {
  id: 'arith.cycles.units-digit',
  skill: 'arith.cycles',
  format: 'mcs',
  style: 'units digit of a large power',
  generate(rng, d) {
    for (;;) {
      let terms: { base: number; exp: number }[];
      let op: UnitsParams['op'] = 'single';
      if (d === 3) {
        op = rng.pick(['+', '×'] as const);
        const [b1, b2] = rng.sample(UNITS_BASES[3], 2);
        terms = [
          { base: b1, exp: rng.int(...UNITS_EXP[3]) },
          { base: b2, exp: rng.int(...UNITS_EXP[3]) },
        ];
      } else terms = [{ base: rng.pick(UNITS_BASES[d]), exp: rng.int(...UNITS_EXP[d]) }];
      const combine = (a: number[]) => (op === '+' ? (a[0] + a[1]) % 10 : op === '×' ? (a[0] * a[1]) % 10 : a[0]);
      const digits = terms.map((t) => unitsDigitByCycle(t.base, t.exp));
      const answer = combine(digits);
      if (answer <= 1) continue; // 0 and 1 would make the key too easy to guess

      // One wrong digit per real slip, each applied to every term.
      const cycles = terms.map((t) => unitsCycle(t.base));
      const at = (i: number, pos: number) => cycles[i][mod(pos, cycles[i].length)]; // pos 0 = first element of the cycle
      const slips = [
        // one place too far in the cycle
        { value: combine(terms.map((t, i) => at(i, t.exp))), trap: 'cycle-off-by-one' },
        // one place short
        { value: combine(terms.map((t, i) => at(i, t.exp - 2))), trap: 'cycle-off-by-one' },
        // base times exponent
        { value: combine(terms.map((t) => (t.base * t.exp) % 10)), trap: 'power-as-product' },
        // the exponent ignored
        { value: combine(terms.map((t) => t.base % 10)), trap: 'units-base-digit' },
        // only the last digit of the exponent used
        { value: combine(terms.map((t) => unitsDigitByCycle(t.base, t.exp % 10 === 0 ? 10 : t.exp % 10))), trap: 'units-exponent-last-digit' },
        // the number of whole cycles used as the position
        { value: combine(terms.map((t, i) => at(i, Math.floor(t.exp / cycles[i].length) - 1))), trap: 'cycle-quotient-for-remainder' },
        // the opposite element of a cycle of 4 (neither neighbour of the key)
        { value: combine(terms.map((t, i) => at(i, t.exp + 1))), trap: 'cycle-wrong-position' },
        ...(op === 'single' ? [] : [{ value: op === '+' ? (digits[0] * digits[1]) % 10 : (digits[0] + digits[1]) % 10, trap: 'units-wrong-operation' }]),
      ];
      const wrong = slips.filter((s, i) => s.value !== answer && slips.findIndex((u) => u.value === s.value) === i);
      if (wrong.length < 4) continue;

      const picked = valuedChoices(
        rng,
        { text: `$${answer}$`, value: answer },
        rng.shuffle(wrong).map((s) => ({ text: `$${s.value}$`, value: s.value, trap: s.trap })),
      );
      // The key is a high digit most of the time, so an ascending list would put it last: shuffle instead.
      const choices = rng.shuffle(picked.choices);
      const idx = choices.findIndex((c) => c.text === `$${answer}$`);
      const shown = new Map(choices.filter((c) => c.trap).map((c) => [c.trap!, c.text] as const));

      const expr = terms.map((t) => `${t.base}^{${t.exp}}`).join(op === '+' ? ' + ' : op === '×' ? ' \\times ' : '');
      const lines = terms
        .map((t, i) => {
          const c = cycles[i];
          const r = t.exp % c.length;
          return `Powers of ${t.base % 10} end in ${c.join(', ')}, a cycle of ${c.length}. As $${t.exp} = ${c.length} \\cdot ${Math.floor(t.exp / c.length)} + ${r}$, $${t.base}^{${t.exp}}$ ends in ${
            r === 0 ? 'the last element' : `element number ${r}`
          }: ${digits[i]}.`;
        })
        .join('\n\n');
      const tail = op === 'single' ? '' : ` So the units digit of the ${op === '+' ? 'sum' : 'product'} is that of $${digits[0]} ${op === '+' ? '+' : '\\times'} ${digits[1]}$, which is ${answer}.`;
      const t0 = terms[0];
      const L0 = cycles[0].length;
      const e0 = t0.exp % L0 === 0 ? L0 : (t0.exp % L0) + L0;
      const check = `Check: $${t0.base % 10}^{${e0}} = ${num((t0.base % 10) ** e0)}$ ends in ${unitsDigitByCycle(t0.base, e0)}, and ${e0} has the same remainder on division by ${L0} as ${t0.exp}.`;
      const say: string[] = [];
      const digit = (id: string) => shown.get(id);
      if (digit('power-as-product'))
        say.push(`${digit('power-as-product')} comes from ${op === 'single' ? 'base times exponent' : 'base times exponent in each term'}, but $3^4 = 81$, not $3 \\times 4 = 12$`);
      if (digit('cycle-off-by-one')) say.push(`${digit('cycle-off-by-one')} is one place off in the cycle`);
      else if (digit('units-base-digit')) say.push(`${digit('units-base-digit')} keeps the units digit of the base, as if the exponent did nothing`);
      else if (digit('units-exponent-last-digit')) say.push(`${digit('units-exponent-last-digit')} uses only the last digit of the exponent`);
      else if (digit('units-wrong-operation')) say.push(`${digit('units-wrong-operation')} ${op === '+' ? 'multiplies' : 'adds'} the two digits instead of ${op === '+' ? 'adding' : 'multiplying'} them`);
      const trap = say.length ? `\n\nTrap: ${say.join('. ')}.` : '';
      return {
        params: { terms, op },
        q: {
          format: 'mcs',
          stem: [
            `What is the units digit of $${expr}$?`,
            `When $${expr}$ is written out in full, what is its units digit?`,
            `If $N = ${expr}$, what is the units digit of $N$?`,
          ][rng.int(0, 2)],
          choices,
          answer: idx,
          explanation: `Units digits of big powers repeat in a cycle, so only the position in the cycle matters.\n\n${lines}${tail}\n\n${check}${trap}\n\nRule: divide the exponent by the cycle length and use the remainder as the position (0 means the last element).`,
        },
      };
    }
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
  /** Number of days to move: forward for 'after', backward for 'ago'. */
  shift: number;
  mode: 'after' | 'ago' | 'day-of-year';
  n: number;
}

const dayOfWeek: Template<DayParams> = {
  id: 'arith.cycles.day-of-week',
  skill: 'arith.cycles',
  format: 'mcs',
  style: 'day of the week far in the future',
  generate(rng, d) {
    for (;;) {
      const start = rng.int(0, 6);
      const mode: DayParams['mode'] = d === 3 ? 'day-of-year' : d === 2 && rng.chance(0.4) ? 'ago' : 'after';
      const n = d === 1 ? rng.int(15, 60) : d === 2 ? rng.int(80, 400) : rng.int(100, 365);
      if (n % 7 === 0) continue; // a multiple of 7 would make the answer "the same day"
      const shift = mode === 'ago' ? -n : mode === 'after' ? n : n - 1;
      const answer = mod(start + shift, 7);
      const cands: { day: number; trap: string }[] = [
        // one day too many / too few in the count
        { day: mod(answer + 1, 7), trap: mode === 'day-of-year' ? 'cycle-count-terms' : 'cycle-off-by-one' },
        { day: mod(answer - 1, 7), trap: 'cycle-off-by-one' },
        // the number of whole weeks used in place of the leftover days
        { day: mod(start + Math.floor(n / 7) * (mode === 'ago' ? -1 : 1), 7), trap: 'cycle-quotient-for-remainder' },
        // moved the wrong way along the week
        { day: mod(start - shift, 7), trap: 'cycle-direction' },
      ].filter((c, i, arr) => c.day !== answer && arr.findIndex((u) => u.day === c.day) === i);
      const wrong = [...cands];
      for (const x of rng.shuffle(range(0, 6))) if (wrong.length < 4 && x !== answer && !wrong.some((w) => w.day === x)) wrong.push({ day: x, trap: '' });
      const picked = rng.shuffle(wrong).slice(0, 4);
      if (picked.filter((c) => c.trap).length < 3) continue;
      const choices = [...picked, { day: answer, trap: '' }]
        .sort((a, b) => a.day - b.day)
        .map((c) => ({ text: DAYS[c.day], ...(c.trap && c.day !== answer ? { trap: c.trap } : {}) }));
      const idx = choices.findIndex((c) => c.text === DAYS[answer]);
      const shown = new Set(choices.map((c) => c.trap));

      const q7 = Math.floor(n / 7);
      const r7 = n % 7;
      const stem =
        mode === 'after'
          ? `If today is a ${DAYS[start]}, what day of the week will it be ${plural(n, 'day')} from today?`
          : mode === 'ago'
            ? `If today is a ${DAYS[start]}, what day of the week was it ${plural(n, 'day')} ago?`
            : `In a certain year, January 1 is a ${DAYS[start]}. On what day of the week is the ${ordinal(n)} day of that year?`;
      const steps =
        mode === 'after'
          ? `Since $${n} = 7 \\cdot ${q7} + ${r7}$, moving ${n} days ahead lands where ${plural(r7, 'day')} ahead does, because the ${q7} whole weeks bring back the same day: ${DAYS[answer]}.`
          : mode === 'ago'
            ? `Since $${n} = 7 \\cdot ${q7} + ${r7}$, going back ${n} days ends where going back ${plural(r7, 'day')} does, because the ${q7} whole weeks bring back the same day: ${DAYS[answer]}.`
            : `Day 1 is a ${DAYS[start]}, so day ${n} comes $${n} - 1 = ${shift}$ days later (not ${n}). Since $${shift} = 7 \\cdot ${Math.floor(shift / 7)} + ${shift % 7}$, it is ${plural(shift % 7, 'day')} after ${DAYS[start]}: ${DAYS[answer]}.`;
      const check =
        mode === 'day-of-year'
          ? `Check: day 8 is ${DAYS[start]} again (7 days after day 1), so days 1, 8, 15, ... all share that weekday.`
          : `Check: ${plural(7 * q7, 'day')} is exactly ${plural(q7, 'week')}, which keeps the weekday, so ${r7} more ${mode === 'after' ? 'forward' : 'back'} is all that is left.`;
      const say: string[] = [];
      if (shown.has('cycle-off-by-one') || shown.has('cycle-count-terms'))
        say.push(mode === 'day-of-year' ? `counting ${n} days instead of ${n - 1} lands one day late` : 'being one day off in the count');
      if (shown.has('cycle-quotient-for-remainder')) say.push(`using the ${q7} weeks instead of the ${r7} leftover days`);
      if (shown.has('cycle-direction')) say.push(`moving ${mode === 'ago' ? 'forward' : 'backward'} instead of ${mode === 'ago' ? 'backward' : 'forward'}`);
      const trap = say.length ? `\n\nTrap: wrong days come from ${say.join('; ')}.` : '';
      return {
        params: { start, shift, mode, n },
        q: {
          format: 'mcs',
          stem,
          choices,
          answer: idx,
          explanation: `Days of the week repeat every 7 days, so only the remainder of ${n} divided by 7 matters.\n\n${steps}\n\n${check}${trap}\n\nRule: divide by the length of the cycle and keep the remainder.`,
        },
      };
    }
  },
  check(q, { start, mode, n }) {
    let day = start;
    const steps = mode === 'day-of-year' ? n - 1 : n;
    for (let i = 0; i < steps; i++) day = mode === 'ago' ? (day + 6) % 7 : (day + 1) % 7;
    if (q.format !== 'mcs') return 'wrong format';
    return q.choices[q.answer].text === DAYS[day] ? null : `expected ${DAYS[day]}`;
  },
};

export const cycleTemplates = [decimalDigitQC, periodicSequenceSum, unitsDigitPower, dayOfWeek];
