import { flaggedChoices, qcCompare, qcFromSamples } from '../../../engine/build';
import { frac } from '../../../engine/frac';
import { lcm, range } from '../../../engine/math';
import type { Rng } from '../../../engine/rng';
import { num, ordinal, plain } from '../../../engine/tex';
import type { Choice, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { QC_WORDS, expectMcm, expectMcsBy, expectNe, expectQc, spreadChoices } from './util';

/** Sum of the integers from a to b by looping (checks only). */
function loopSum(a: number, b: number, step = 1): number {
  let s = 0;
  for (let x = a; x <= b; x += step) s += x;
  return s;
}
const T = (n: number) => (n * (n + 1)) / 2;

/* ------------------------------------------------------------------ 1. S(n) = 1 + 2 + ... + n, defined-function notation (MCS) */

interface SumFnParams {
  mode: 'double' | 'difference';
  m: number;
  n: number;
  values: number[];
}

const sumFunction: Template<SumFnParams> = {
  id: 'arith.consecutive.sum-function',
  skill: 'arith.consecutive',
  format: 'mcs',
  style: 'S(n) = 1 + 2 + ... + n: use a given value or a difference of sums',
  generate(rng, diff) {
    const mode: SumFnParams['mode'] = diff === 1 ? 'double' : diff === 2 ? rng.pick(['double', 'difference'] as const) : 'difference';
    let m: number;
    let n: number;
    let answer: number;
    let cands: { v: number; trap?: string }[];
    let stem: string;
    let explanation: string;
    const def = 'For each integer $n > 1$, let $S(n)$ denote the sum of the integers from 1 to $n$, inclusive.';
    if (mode === 'double') {
      m = rng.pick(diff === 1 ? [20, 30, 40, 50] : [30, 40, 60, 80, 150, 200]);
      n = 2 * m;
      answer = T(n);
      cands = [
        { v: 2 * T(m), trap: 'int-doubled-sum' },
        { v: T(m) + m * m, trap: 'int-sum-split' },
        { v: 4 * T(m) },
        { v: 3 * T(m) },
        { v: answer - m },
        { v: answer + 2 * m },
        { v: answer + 3 * m },
        { v: 2 * answer },
        { v: answer + m * m },
      ];
      stem = `${def} For example, $S(${m}) = ${num(T(m))}$. What is the value of $S(${n})$?`;
      explanation = `Use the formula: $S(${n}) = \\frac{${n} \\cdot ${n + 1}}{2} = ${num(answer)}$.

Or use the given value: each of the integers $${m + 1}, ${m + 2}, \\ldots, ${n}$ is ${m} more than one of $1, 2, \\ldots, ${m}$, so their sum is $S(${m}) + ${m} \\cdot ${m}$. Then $S(${n}) = 2S(${m}) + ${m}^2 = ${num(2 * T(m))} + ${num(m * m)} = ${num(answer)}$.

Doubling $S(${m})$ gives only ${num(2 * T(m))}: it misses the extra ${m} added to each of the ${m} upper terms.`;
    } else {
      for (;;) {
        n = rng.int(diff === 2 ? 4 : 8, diff === 2 ? 12 : 20) * 10;
        m = rng.int(2, n / 10 - 1) * 10;
        if (n - m >= 20) break;
      }
      answer = T(n) - T(m);
      cands = [
        { v: T(n - m), trap: 'int-sum-difference-shift' },
        { v: answer + m, trap: 'cycle-count-terms' },
        { v: answer - n, trap: 'cycle-count-terms' },
        { v: answer + n },
        { v: answer - m },
        { v: answer + 2 * m },
      ];
      stem = `${def} What is the value of $S(${n}) - S(${m})$?`;
      const count = n - m;
      explanation = `$S(${n}) - S(${m})$ is the sum $${m + 1} + ${m + 2} + \\cdots + ${n}$: ${count} integers whose average is $\\frac{${m + 1} + ${n}}{2} = ${frac(m + 1 + n, 2).toDecimalString()}$. So the sum is $${count} \\times ${frac(m + 1 + n, 2).toDecimalString()} = ${num(answer)}$.

Check with the formula: $\\frac{${n} \\cdot ${n + 1}}{2} - \\frac{${m} \\cdot ${m + 1}}{2} = ${num(T(n))} - ${num(T(m))} = ${num(answer)}$.

It is not $S(${count}) = ${num(T(count))}$: the terms run from ${m + 1} to ${n}, not from 1 to ${count}.`;
    }
    const { choices, answer: idx } = spreadChoices(rng, answer, cands, (v) => `$${num(v)}$`);
    return {
      params: { mode, m, n, values: choices.map((c) => Number(c.text.replace(/[${},]/g, ''))) },
      q: { format: 'mcs', stem, choices, answer: idx, explanation },
    };
  },
  check(q, { mode, m, n, values }) {
    const expected = mode === 'double' ? loopSum(1, n) : loopSum(1, n) - loopSum(1, m);
    return expectMcsBy(q, (i) => values[i] === expected);
  },
};

/* ------------------------------------------------------------------ 2. Counting multiples in a range (NE) */

type CountKind = 'inclusive' | 'three-digit' | 'between' | 'but-not' | 'or';

interface CountParams {
  kind: CountKind;
  a: number;
  b: number;
  k: number;
  k2: number;
}

const PAIRS: [number, number][] = [
  [4, 6],
  [6, 8],
  [6, 9],
  [6, 10],
  [4, 10],
  [8, 12],
  [9, 12],
  [10, 15],
];

const countMultiples: Template<CountParams> = {
  id: 'arith.consecutive.count-multiples',
  skill: 'arith.consecutive',
  format: 'ne',
  style: 'count the multiples of k in a range (inclusive, exclusive, "but not")',
  generate(rng, diff) {
    const kinds: CountKind[] = diff === 1 ? ['inclusive', 'between'] : diff === 2 ? ['three-digit', 'between', 'inclusive'] : ['but-not', 'or', 'three-digit'];
    const kind = rng.pick(kinds);
    let a = 0;
    let b = 0;
    let k = 0;
    let k2 = 0;
    let answer: number;
    let stem: string;
    let explanation: string;
    const traps: { value: number; trap: string }[] = [];
    if (kind === 'inclusive') {
      k = rng.int(3, diff === 1 ? 9 : 13);
      a = rng.int(10, 80);
      b = a + rng.int(60, 240);
      const first = Math.ceil(a / k) * k;
      const last = Math.floor(b / k) * k;
      answer = (last - first) / k + 1;
      traps.push({ value: answer - 1, trap: 'int-multiples-count' });
      stem = `How many multiples of ${k} are there from ${a} to ${b}, inclusive?`;
      explanation = `The first multiple of ${k} in the range is ${first} and the last is ${last}. The count is $\\frac{${last} - ${first}}{${k}} + 1 = ${(last - first) / k} + 1 = ${answer}$.

Or: there are $\\lfloor ${b} / ${k} \\rfloor = ${Math.floor(b / k)}$ multiples of ${k} up to ${b} and $\\lfloor ${a - 1} / ${k} \\rfloor = ${Math.floor((a - 1) / k)}$ below ${a}, and $${Math.floor(b / k)} - ${Math.floor((a - 1) / k)} = ${answer}$. Do not forget the "+ 1".`;
    } else if (kind === 'between') {
      k = rng.int(3, 12);
      const m1 = rng.int(2, 15);
      const m2 = m1 + rng.int(8, 30);
      a = k * m1;
      b = k * m2;
      answer = m2 - m1 - 1;
      traps.push({ value: answer + 2, trap: 'counted-endpoint' }, { value: answer + 1, trap: 'counted-endpoint' });
      stem = `How many integers between ${a} and ${b} are multiples of ${k}?`;
      explanation = `$${a} = ${k} \\cdot ${m1}$ and $${b} = ${k} \\cdot ${m2}$, but "between" excludes ${a} and ${b}. The multiples of ${k} strictly between them are $${k} \\cdot ${m1 + 1}, \\ldots, ${k} \\cdot ${m2 - 1}$: that is $${m2 - 1} - ${m1 + 1} + 1 = ${answer}$ multiples.

Counting from ${a} to ${b} inclusive would give ${answer + 2}.`;
    } else if (kind === 'three-digit') {
      k = rng.int(6, 19);
      const first = Math.ceil(100 / k) * k;
      const last = Math.floor(999 / k) * k;
      answer = (last - first) / k + 1;
      a = 100;
      b = 999;
      traps.push({ value: answer - 1, trap: 'int-multiples-count' });
      stem = `How many positive three-digit integers are multiples of ${k}?`;
      explanation = `Three-digit integers run from 100 to 999. The least multiple of ${k} among them is ${first} and the greatest is ${last}, so the count is $\\frac{${last} - ${first}}{${k}} + 1 = ${answer}$.

Equivalently, $\\lfloor 999 / ${k} \\rfloor - \\lfloor 99 / ${k} \\rfloor = ${Math.floor(999 / k)} - ${Math.floor(99 / k)} = ${answer}$.`;
    } else {
      [k, k2] = rng.shuffle(rng.pick(PAIRS));
      const L = lcm(k, k2);
      b = rng.int(10, 40) * 10;
      a = 1;
      const nk = Math.floor(b / k);
      const nk2 = Math.floor(b / k2);
      const nL = Math.floor(b / L);
      const nProd = Math.floor(b / (k * k2));
      if (kind === 'but-not') {
        answer = nk - nL;
        stem = `How many integers from 1 to ${b}, inclusive, are multiples of ${k} but not multiples of ${k2}?`;
        traps.push({ value: nk - nProd, trap: 'int-lcm-is-product' }, { value: nk - nk2, trap: 'int-double-counted' });
        explanation = `There are $\\lfloor ${b} / ${k} \\rfloor = ${nk}$ multiples of ${k}. Remove those that are also multiples of ${k2}, which are the multiples of lcm$(${k}, ${k2}) = ${L}$: there are $\\lfloor ${b} / ${L} \\rfloor = ${nL}$ of them. So $${nk} - ${nL} = ${answer}$.

Numbers divisible by both ${k} and ${k2} are the multiples of ${L}, not of $${k} \\cdot ${k2} = ${k * k2}$.`;
      } else {
        answer = nk + nk2 - nL;
        stem = `How many integers from 1 to ${b}, inclusive, are multiples of ${k} or ${k2} (or both)?`;
        traps.push({ value: nk + nk2, trap: 'int-double-counted' }, { value: nk + nk2 - nProd, trap: 'int-lcm-is-product' });
        explanation = `Multiples of ${k}: $\\lfloor ${b} / ${k} \\rfloor = ${nk}$. Multiples of ${k2}: $\\lfloor ${b} / ${k2} \\rfloor = ${nk2}$. The multiples of lcm$(${k}, ${k2}) = ${L}$ are in both lists ($\\lfloor ${b} / ${L} \\rfloor = ${nL}$ of them), so subtract them once: $${nk} + ${nk2} - ${nL} = ${answer}$.

Adding ${nk} and ${nk2} without subtracting counts each multiple of ${L} twice.`;
      }
    }
    return {
      params: { kind, a, b, k, k2 },
      q: {
        format: 'ne',
        stem,
        answer: frac(answer),
        traps: traps.filter((t, i, arr) => t.value !== answer && t.value > 0 && arr.findIndex((u) => u.value === t.value) === i).map((t) => ({ value: frac(t.value), trap: t.trap })),
        explanation,
      },
    };
  },
  check(q, { kind, a, b, k, k2 }) {
    let c = 0;
    for (let x = a; x <= b; x++) {
      if (kind === 'between' && (x === a || x === b)) continue;
      const mk = x % k === 0;
      const mk2 = k2 ? x % k2 === 0 : false;
      if (kind === 'but-not' ? mk && !mk2 : kind === 'or' ? mk || mk2 : mk) c++;
    }
    return expectNe(q, c);
  },
};

/* ------------------------------------------------------------------ 3. Which expression counts the even integers between j and k (MCS) */

interface ExprParams {
  step: number;
  parity: 'even' | 'odd' | 'mult3' | 'any';
  lo: 'gt' | 'ge';
  hi: 'lt' | 'le';
  /** each choice: value = (D + top) / den + add, with D = k - j */
  forms: { top: number; den: number; add: number }[];
}

const formTex = ({ top, den, add }: { top: number; den: number; add: number }) => {
  const numer = top === 0 ? 'k - j' : `k - j ${top > 0 ? '+' : '-'} ${Math.abs(top)}`;
  const main = den === 1 ? numer : `\\dfrac{${numer}}{${den}}`;
  return add === 0 ? main : `${main} ${add > 0 ? '+' : '-'} ${Math.abs(add)}`;
};

const countExpression: Template<ExprParams> = {
  id: 'arith.consecutive.count-expression',
  skill: 'arith.consecutive',
  format: 'mcs',
  style: 'expression for the number of even (odd, ...) integers between j and k',
  generate(rng, diff) {
    const parity: ExprParams['parity'] = diff === 1 ? rng.pick(['any', 'even'] as const) : diff === 2 ? rng.pick(['even', 'odd'] as const) : rng.pick(['even', 'odd', 'mult3'] as const);
    const step = parity === 'any' ? 1 : parity === 'mult3' ? 3 : 2;
    let lo: ExprParams['lo'] = rng.chance(0.6) ? 'gt' : 'ge';
    let hi: ExprParams['hi'] = lo === 'gt' ? (rng.chance(0.7) ? 'lt' : 'le') : rng.chance(0.6) ? 'le' : 'lt';
    // (even integers strictly between j and k is the book's own question: always change one end)
    if (parity === 'even' && lo === 'gt' && hi === 'lt') [lo, hi] = rng.chance(0.5) ? ['ge', 'lt'] : ['gt', 'le'];
    const inclusive = (lo === 'ge' ? 1 : 0) + (hi === 'le' ? 1 : 0);
    const correctAdd = inclusive - 1;
    type Form = { top: number; den: number; add: number; trap?: string; ok?: boolean };
    const correct: Form = { top: 0, den: step, add: correctAdd, ok: true };
    const cand: Form[] = [-1, 0, 1].filter((x) => x !== correctAdd).map((add) => ({ top: 0, den: step, add, trap: add > correctAdd ? 'counted-endpoint' : 'cycle-count-terms' }));
    const alt = step === 1 ? 2 : 1;
    cand.push({ top: 0, den: alt, add: correctAdd, ...(step > 1 ? { trap: 'int-step-size' } : {}) }, { top: 0, den: alt, add: correctAdd + 1 }, { top: -1, den: Math.max(step, 2), add: 0 }, { top: 0, den: alt, add: correctAdd - 1 });
    const evalAt = (f: Form, D: number) => (D + f.top) / f.den + f.add;
    const sample = [step * 4, step * 7, step * 10, step * 13];
    const same = (f: Form, g: Form) => sample.every((D) => evalAt(f, D) === evalAt(g, D));
    const clean: Form[] = [correct];
    for (const f of cand) if (clean.length < 5 && !clean.some((g) => same(f, g) || formTex(f) === formTex(g))) clean.push(f);
    if (clean.length !== 5) throw new Error('count-expression: choice set');
    // expression choices: random order (they have no natural numeric order)
    const shuffled = rng.shuffle(clean);
    clean.splice(0, clean.length, ...shuffled);
    const choices: Choice[] = clean.map((f) => ({ text: `$${formTex(f)}$`, ...(f.trap ? { trap: f.trap } : {}) }));
    const answer = clean.findIndex((f) => f.ok);
    const kind = parity === 'any' ? 'integers' : parity === 'mult3' ? 'multiples of 3' : `${parity} integers`;
    const given = parity === 'any' ? 'integers' : parity === 'mult3' ? 'multiples of 3' : `${parity} integers`;
    const loText = lo === 'gt' ? 'greater than $j$' : 'greater than or equal to $j$';
    const hiText = hi === 'lt' ? 'less than $k$' : 'less than or equal to $k$';
    const ex = { j: step * 3 + (parity === 'odd' ? 1 : 0), k: step * 8 + (parity === 'odd' ? 1 : 0) };
    const listed = range(ex.j, ex.k).filter((x) => (x - ex.j) % step === 0 && (lo === 'ge' || x > ex.j) && (hi === 'le' || x < ex.k));
    return {
      params: { step, parity, lo, hi, forms: clean.map(({ top, den, add }) => ({ top, den, add })) },
      q: {
        format: 'mcs',
        stem: `If $j$ and $k$ are ${given} and $j < k$, which of the following represents the number of ${kind} that are ${loText} and ${hiText}?`,
        choices,
        answer,
        explanation: `From $j$ to $k$ the ${kind} go up in steps of ${step}, so counting both $j$ and $k$ there are $\\frac{k - j}{${step}} + 1$ of them${step === 1 ? '' : ''}. ${
          inclusive === 2 ? 'Both ends are included here' : inclusive === 1 ? 'Exactly one end is included here, so subtract 1' : 'Both ends are excluded here, so subtract 2'
        }: the count is $${formTex(clean[answer])}$.

Check with numbers: $j = ${ex.j}$ and $k = ${ex.k}$ give ${listed.join(', ')}, which is ${listed.length} ${kind}, and $${formTex(clean[answer]).replace(/k - j/g, `${ex.k} - ${ex.j}`)} = ${listed.length}$.`.replace(
          '\\frac{k - j}{1} + 1',
          'k - j + 1',
        ),
      },
    };
  },
  check(q, { parity, lo, hi, forms }) {
    // brute force over many (j, k) pairs of the right kind
    const pairs: [number, number][] = [];
    for (let j = -12; j <= 12; j++)
      for (let k = j + 1; k <= j + 40; k++) {
        const ok = (x: number) => (parity === 'any' ? true : parity === 'mult3' ? x % 3 === 0 : parity === 'even' ? x % 2 === 0 : Math.abs(x % 2) === 1);
        if (ok(j) && ok(k)) pairs.push([j, k]);
      }
    const okVal = (x: number) => (parity === 'any' ? true : parity === 'mult3' ? x % 3 === 0 : parity === 'even' ? x % 2 === 0 : Math.abs(x % 2) === 1);
    return expectMcsBy(q, (i) =>
      pairs.every(([j, k]) => {
        let c = 0;
        for (let x = j; x <= k; x++) if (okVal(x) && (lo === 'ge' || x > j) && (hi === 'le' || x < k)) c++;
        const f = forms[i];
        return (k - j + f.top) / f.den + f.add === c;
      }),
    );
  },
};

/* ------------------------------------------------------------------ 4. Consecutive integers with a given sum: find a term (MCS) */

interface TermParams {
  k: number;
  step: 1 | 2;
  S: number;
  ask: 'greatest' | 'least';
  parity: 'any' | 'even' | 'odd';
}

const findTerm: Template<TermParams> = {
  id: 'arith.consecutive.find-term',
  skill: 'arith.consecutive',
  format: 'mcs',
  style: 'consecutive integers with a given sum: find the least or greatest',
  generate(rng, diff) {
    const parity: TermParams['parity'] = diff === 3 ? rng.pick(['even', 'odd'] as const) : 'any';
    const step: 1 | 2 = parity === 'any' ? 1 : 2;
    const k = diff === 1 ? rng.pick([5, 7, 9]) : diff === 2 ? rng.pick([4, 6, 8, 5, 7]) : rng.pick([4, 5, 6, 7]);
    let x = rng.int(diff === 1 ? 5 : 10, diff === 1 ? 40 : 90);
    if (parity === 'even' && x % 2) x++;
    if (parity === 'odd' && x % 2 === 0) x++;
    const S = k * x + (step * k * (k - 1)) / 2;
    const ask: TermParams['ask'] = rng.chance(0.6) ? 'greatest' : 'least';
    const last = x + step * (k - 1);
    const answer = ask === 'greatest' ? last : x;
    const avg = frac(S, k);
    const cands: { v: number; trap?: string }[] = [];
    if (avg.isInt()) cands.push({ v: avg.n, trap: 'int-gave-middle-term' });
    if (step === 2) {
      const half = (k - 1) / 2;
      const wrongStep = ask === 'greatest' ? avg.toNumber() + half : avg.toNumber() - half;
      if (Number.isInteger(wrongStep)) cands.push({ v: wrongStep, trap: 'int-step-size' });
    }
    cands.push(
      { v: ask === 'greatest' ? x : last },
      ...[1, 2, 3, 4].flatMap((t) => [{ v: answer + t * step }, { v: answer - t * step }]),
      { v: answer + 1 },
      { v: answer - 1 },
    );
    const { choices, answer: idx } = spreadChoices(rng, answer, cands);
    const kindText = parity === 'any' ? 'consecutive integers' : `consecutive ${parity} integers`;
    const terms = range(0, k - 1).map((i) => x + step * i);
    const middle =
      k % 2 === 1
        ? `The average, $\\frac{${num(S)}}{${k}} = ${avg.toTex()}$, is the middle term, so the integers are ${terms.join(', ')}.`
        : `The average, $\\frac{${num(S)}}{${k}} = ${avg.isInt() ? avg.toTex() : avg.toDecimalString()}$, lies halfway between the two middle terms, ${terms[k / 2 - 1]} and ${terms[k / 2]}. So the integers are ${terms.join(', ')}.`;
    return {
      params: { k, step, S, ask, parity },
      q: {
        format: 'mcs',
        stem: `The sum of ${k} ${kindText} is ${plain(S)}. What is the ${ask} of these integers?`,
        choices,
        answer: idx,
        explanation: `${middle} The ${ask} is ${answer}.

Check: ${terms.join(' + ')} $= ${num(S)}$.${avg.isInt() ? ` The average ${avg.n} is the middle term, not the ${ask} one.` : ''}${
          step === 2 ? ` Remember that consecutive ${parity} integers differ by 2.` : ''
        }`,
      },
    };
  },
  check(q, { k, step, S, ask, parity }) {
    for (let x = -2000; x <= 2000; x++) {
      if (parity === 'even' && x % 2 !== 0) continue;
      if (parity === 'odd' && Math.abs(x % 2) !== 1) continue;
      if (loopSum(x, x + step * (k - 1), step) === S) {
        const v = ask === 'greatest' ? x + step * (k - 1) : x;
        return expectMcsBy(q, (i) => q.format === 'mcs' && q.choices[i].text === `$${v}$`);
      }
    }
    return 'no run of integers found';
  },
};

/* ------------------------------------------------------------------ 5. Which numbers could be the sum of k consecutive integers (MCM) */

interface PossParams {
  k: number;
  step: 1 | 2;
  parity: 'any' | 'even' | 'odd';
  values: number[];
}

const canBeSum = (v: number, k: number, step: number, parity: PossParams['parity']) => {
  // closed form: sum = k*x + step*k(k-1)/2 with x of the right parity
  const rest = v - (step * k * (k - 1)) / 2;
  if (rest % k !== 0) return false;
  const x = rest / k;
  return parity === 'any' || (parity === 'even' ? x % 2 === 0 : Math.abs(x % 2) === 1);
};

function possibleSumsChoices(rng: Rng, k: number, step: 1 | 2, parity: PossParams['parity'], nChoices: number) {
  const pool = range(20, 160);
  const good = pool.filter((v) => canBeSum(v, k, step, parity));
  const nearMiss = pool.filter((v) => !canBeSum(v, k, step, parity) && v % k === 0);
  const other = pool.filter((v) => !canBeSum(v, k, step, parity) && v % k !== 0);
  return { good, nearMiss, other, nChoices };
}

const possibleSums: Template<PossParams> = {
  id: 'arith.consecutive.possible-sums',
  skill: 'arith.consecutive',
  format: 'mcm',
  style: 'which numbers could be the sum of k consecutive integers',
  generate(rng, diff) {
    const parity: PossParams['parity'] = diff === 3 ? rng.pick(['even', 'odd'] as const) : 'any';
    const step: 1 | 2 = parity === 'any' ? 1 : 2;
    const k = diff === 1 ? rng.pick([3, 5]) : diff === 2 ? rng.pick([4, 6]) : parity === 'even' ? rng.pick([3, 4]) : rng.pick([3, 4]);
    const nChoices = diff === 1 ? 5 : 6;
    for (;;) {
      const { good, nearMiss, other } = possibleSumsChoices(rng, k, step, parity, nChoices);
      const nGood = rng.int(1, 3);
      const nNear = nearMiss.length ? Math.min(nearMiss.length, rng.int(1, 2)) : 0;
      const g = rng.sample(good, nGood);
      const nm = rng.sample(nearMiss, nNear);
      const o = rng.sample(other, nChoices - nGood - nNear);
      const values = [...g, ...nm, ...o].sort((a, b) => a - b);
      if (new Set(values).size !== nChoices) continue;
      const items = values.map((v) => ({
        text: `$${v}$`,
        correct: g.includes(v),
        ...(nm.includes(v) ? { trap: 'int-sum-multiple-of-count' } : {}),
      }));
      const { choices, answer } = flaggedChoices(items as (Choice & { correct: boolean })[]);
      const kindText = parity === 'any' ? 'consecutive integers' : `consecutive ${parity} integers`;
      const offset = (step * k * (k - 1)) / 2;
      const terms = range(0, k - 1)
        .map((i) => (i === 0 ? 'n' : `(n + ${step * i})`))
        .join(' + ');
      let rule: string;
      if (parity === 'any' && k % 2 === 1) rule = `The sum of ${k} consecutive integers is $${terms} = ${k}n + ${offset} = ${k}(n + ${offset / k})$: ${k} times the middle term. So the possible sums are exactly the multiples of ${k}.`;
      else if (parity === 'any')
        rule = `The sum of ${k} consecutive integers is $${terms} = ${k}n + ${offset}$. So a possible sum leaves remainder ${offset % k} when divided by ${k}; a multiple of ${k} is NOT possible.`;
      else
        rule = `The sum is $${terms} = ${k}n + ${offset}$, where $n$ is ${parity}. So the sum must be $${offset}$ more than ${k} times an ${parity} number: ${range(0, 3)
          .map((t) => {
            const x = (parity === 'even' ? 2 : 1) + 2 * t;
            return `${k * x + offset}`;
          })
          .join(', ')}, and so on, going up by ${2 * k}.`;
      const lines = values.map((v) => {
        if (!canBeSum(v, k, step, parity)) return `- ${v} ✗`;
        const x = (v - offset) / k;
        return `- $${v} = ${range(0, k - 1)
          .map((i) => x + step * i)
          .join(' + ')}$ ✓`;
      });
      return {
        params: { k, step, parity, values },
        q: {
          format: 'mcm',
          stem: `Which of the following could be the sum of ${k} ${kindText}?`,
          instruction: 'Indicate all such numbers.',
          choices,
          answer,
          explanation: `${rule}

${lines.join('\n')}${nm.length ? `\n\nA multiple of ${k} is not automatically a possible sum${k % 2 === 0 ? `: that works only when the number of terms is odd` : ''}.` : ''}`,
        },
      };
    }
  },
  check(q, { k, step, parity, values }) {
    const ok = (v: number) => {
      for (let x = -200; x <= 200; x++) {
        if (parity === 'even' && x % 2 !== 0) continue;
        if (parity === 'odd' && Math.abs(x % 2) !== 1) continue;
        if (loopSum(x, x + step * (k - 1), step) === v) return true;
      }
      return false;
    };
    return expectMcm(
      q,
      values.flatMap((v, i) => (ok(v) ? [i] : [])),
    );
  },
};

/* ------------------------------------------------------------------ 6. Comparisons with sums of consecutive integers (QC) */

type SumQCItem = 'odd-squares' | 'upper-half' | 'neg-cancel' | 'xz-y2' | 'x-plus-z' | 'four-vs-5n' | 'odd-ends' | 'odd-products' | 'count-multiples';

interface SumQCParams {
  item: SumQCItem;
  m: number;
  n: number;
  k: number;
  /** value of Quantity B (or its coefficient / constant) */
  bv: number;
  bw: number;
}

const sumQC: Template<SumQCParams> = {
  id: 'arith.consecutive.sum-qc',
  skill: 'arith.consecutive',
  format: 'qc',
  style: 'compare sums or products of consecutive integers',
  generate(rng, diff) {
    const items: SumQCItem[] =
      diff === 1
        ? ['odd-squares', 'x-plus-z', 'count-multiples', 'xz-y2']
        : diff === 2
          ? ['upper-half', 'neg-cancel', 'xz-y2', 'four-vs-5n', 'count-multiples', 'odd-squares']
          : ['upper-half', 'neg-cancel', 'four-vs-5n', 'odd-ends', 'odd-products', 'count-multiples'];
    const item = rng.pick(items);
    let m = 0;
    let n = 0;
    let k = 0;
    let bv = 0;
    let bw = 0;
    let info: string | undefined;
    let A: string;
    let B: string;
    let answer: QCChoice;
    let traps: QCQuestion['traps'];
    let explanation: string;
    switch (item) {
      case 'odd-squares': {
        n = rng.int(12, 40);
        const sum = n * n;
        const roll = rng.next();
        k = roll < 0.3 ? sum : roll < 0.6 ? sum + rng.pick([n, 2 * n, 1]) : sum - rng.pick([n, 2 * n, 1]);
        bv = k;
        A = `The sum of the odd integers from 1 to ${2 * n - 1}, inclusive`;
        B = `$${num(k)}$`;
        answer = qcCompare(sum, k);
        explanation = `The odd integers from 1 to ${2 * n - 1} are ${n} numbers (since $${2 * n - 1} = 2 \\cdot ${n} - 1$) with average $\\frac{1 + ${2 * n - 1}}{2} = ${n}$. Their sum is $${n} \\times ${n} = ${num(sum)}$. (The sum of the first $n$ odd integers is always $n^2$.)

Compare ${num(sum)} with ${num(k)}: ${QC_WORDS[answer]}. (${answer})`;
        break;
      }
      case 'upper-half': {
        m = rng.int(3, 12) * 10;
        const upper = m * m + T(m);
        const opts = [
          { B: `$${m}^2 + S$`, v: m * m + T(m) },
          { B: '$2S$', v: 2 * T(m) },
          { B: '$3S$', v: 3 * T(m) },
        ];
        const pick = rng.pick(opts);
        info = `$S$ is the sum of the integers from 1 to ${m}, inclusive.`;
        A = `The sum of the integers from ${m + 1} to ${2 * m}, inclusive`;
        B = pick.B;
        k = opts.indexOf(pick);
        answer = qcCompare(upper, pick.v);
        traps = k === 1 ? { C: 'int-doubled-sum' } : undefined;
        explanation = `Each of the ${m} integers $${m + 1}, \\ldots, ${2 * m}$ is ${m} more than one of $1, \\ldots, ${m}$, so Quantity A is $S + ${m} \\cdot ${m} = ${m}^2 + S$.

With $S = \\frac{${m} \\cdot ${m + 1}}{2} = ${num(T(m))}$: Quantity A $= ${num(m * m)} + ${num(T(m))} = ${num(upper)}$ and Quantity B $= ${num(pick.v)}$. ${QC_WORDS[answer][0].toUpperCase()}${QC_WORDS[answer].slice(1)}. (${answer})`;
        break;
      }
      case 'neg-cancel': {
        m = rng.int(5, 30);
        n = m + rng.int(5, 40);
        const sumA = loopSumFormula(-m, n);
        const useEq = rng.chance(0.5);
        const lowB = useEq ? m + 1 : m;
        const sumB = loopSumFormula(lowB, n);
        bv = lowB;
        A = `The sum of the integers from $-${m}$ to ${n}, inclusive`;
        B = `The sum of the integers from ${lowB} to ${n}, inclusive`;
        answer = qcCompare(sumA, sumB);
        traps = !useEq ? { C: 'cycle-count-terms' } : undefined;
        explanation = `In Quantity A, the integers from $-${m}$ to ${m} cancel in pairs ($-${m} + ${m} = 0$, ...), so Quantity A is the sum of the integers from ${m + 1} to ${n}.

${useEq ? `That is exactly Quantity B. (C)` : `Quantity B also includes ${m}, so it is ${m} more than Quantity A. (B)`}`;
        break;
      }
      case 'xz-y2': {
        info = '$x$, $y$, and $z$ are consecutive integers, and $x < y < z$.';
        A = '$xz$';
        B = '$y^2$';
        answer = 'B';
        traps = { C: 'int-gave-middle-term' };
        explanation = `Write $x = y - 1$ and $z = y + 1$. Then $xz = (y - 1)(y + 1) = y^2 - 1$, which is always 1 less than $y^2$. For example, $4 \\cdot 6 = 24 < 25 = 5^2$, and $(-1)(1) = -1 < 0 = 0^2$. (B)`;
        break;
      }
      case 'x-plus-z': {
        info = '$x$, $y$, and $z$ are consecutive integers, and $x < y < z$.';
        const opts = [
          { A: '$x + z$', B: '$2y$', ans: 'C' as QCChoice, why: '$x + z = (y - 1) + (y + 1) = 2y$, whatever $y$ is. (C)' },
          { A: '$x + y + z$', B: '$3y$', ans: 'C' as QCChoice, why: '$x + y + z = (y - 1) + y + (y + 1) = 3y$: the middle term times the number of terms. (C)' },
          { A: '$x + y + z$', B: '$3x + 2$', ans: 'A' as QCChoice, why: '$x + y + z = x + (x + 1) + (x + 2) = 3x + 3$, which is always 1 more than $3x + 2$. (A)' },
          { A: '$z - x$', B: '$1$', ans: 'A' as QCChoice, why: '$z - x = (x + 2) - x = 2$, which is greater than 1. (A)' },
          {
            A: '$xyz$',
            B: '$0$',
            ans: 'D' as QCChoice,
            why: 'The integers can be negative or include 0. For $x = 1$: $1 \\cdot 2 \\cdot 3 = 6 > 0$. For $x = -1$: $(-1)(0)(1) = 0$. For $x = -4$: $(-4)(-3)(-2) = -24 < 0$. (D)',
            trap: ['A', 'tested-one-value'] as [QCChoice, string],
          },
          {
            A: '$x + y + z$',
            B: '$3x$',
            ans: 'A' as QCChoice,
            why: '$x + y + z = 3x + 3$, which is always 3 more than $3x$, even when $x$ is negative. (A)',
            trap: ['D', 'tested-one-value'] as [QCChoice, string],
          },
        ];
        const o = rng.pick(opts);
        k = opts.indexOf(o);
        A = o.A;
        B = o.B;
        answer = o.ans;
        traps = 'trap' in o && o.trap ? { [o.trap[0]]: o.trap[1] } : undefined;
        explanation = o.why;
        break;
      }
      case 'four-vs-5n': {
        info = '$n$ is a positive integer.';
        k = rng.pick([4, 5]);
        const off = (k * (k - 1)) / 2; // sum = k n + off
        const roll = rng.next();
        // compare with (k + 1)n -> D, or with k n + off - c -> A
        if (roll < 0.55) {
          A = `The sum of the ${k} consecutive integers beginning with $n$`;
          B = `$${k + 1}n$`;
          bv = k + 1;
          bw = 0;
          answer = 'D';
          traps = { A: 'tested-one-value' };
          explanation = `The sum is $n + (n + 1) + \\cdots + (n + ${k - 1}) = ${k}n + ${off}$. Compare with $${k + 1}n$: the difference is $${off} - n$, which is positive for $n < ${off}$, zero for $n = ${off}$, and negative for $n > ${off}$. For example, $n = 1$ gives ${k + off} versus ${k + 1}, but $n = ${off + 1}$ gives ${k * (off + 1) + off} versus ${(k + 1) * (off + 1)}. (D)`;
        } else {
          const c = rng.int(1, 3);
          const sign = rng.chance(0.5) ? 1 : -1;
          A = `The sum of the ${k} consecutive integers beginning with $n$`;
          B = `$${k}n + ${off + sign * c}$`;
          bv = k;
          bw = off + sign * c;
          answer = sign > 0 ? 'B' : 'A';
          traps = { D: 'tested-one-value' };
          explanation = `The sum is $n + (n + 1) + \\cdots + (n + ${k - 1}) = ${k}n + ${off}$ for every $n$. Compared with $${k}n + ${off + sign * c}$, Quantity ${sign > 0 ? 'B' : 'A'} is always greater by ${c}. (${answer})`;
        }
        break;
      }
      case 'odd-ends': {
        info = '$a$, $b$, $c$, and $d$ are consecutive odd integers, and $a < b < c < d$.';
        const opts = [
          { A: '$a + d$', B: '$b + c$', ans: 'C' as QCChoice, why: 'Write them as $a, a + 2, a + 4, a + 6$. Then $a + d = 2a + 6$ and $b + c = 2a + 6$. (C)' },
          { A: '$d - a$', B: '$6$', ans: 'C' as QCChoice, why: 'Consecutive odd integers differ by 2, so $d = a + 6$ and $d - a = 6$. (C)' },
          { A: '$d - a$', B: '$3$', ans: 'A' as QCChoice, why: 'Consecutive odd integers differ by 2 (not 1), so $d = a + 6$ and $d - a = 6 > 3$. (A)', trap: ['C', 'int-step-size'] as [QCChoice, string] },
          {
            A: '$ad$',
            B: '$bc$',
            ans: 'B' as QCChoice,
            why: 'Write them as $a, a + 2, a + 4, a + 6$. Then $ad = a^2 + 6a$ and $bc = a^2 + 6a + 8$: $bc$ is always 8 more, even for negative integers. For example, $(-3)(3) = -9 < -1 = (-1)(1)$. (B)',
          },
          {
            A: '$ad$',
            B: '$0$',
            ans: 'D' as QCChoice,
            why: 'The integers may be negative. $1, 3, 5, 7$ gives $ad = 7 > 0$, but $-3, -1, 1, 3$ gives $ad = -9 < 0$. (D)',
            trap: ['A', 'tested-one-value'] as [QCChoice, string],
          },
        ];
        const o = rng.pick(opts);
        k = opts.indexOf(o);
        A = o.A;
        B = o.B;
        answer = o.ans;
        traps = 'trap' in o && o.trap ? { [o.trap[0]]: o.trap[1] } : undefined;
        explanation = o.why;
        break;
      }
      case 'odd-products': {
        info = '$a$, $b$, $c$, and $d$ are consecutive odd integers, and $0 < a < b < c < d$.';
        A = '$ad$';
        B = '$bc$';
        answer = 'B';
        traps = { C: 'int-gave-middle-term' };
        explanation = `Write them as $a, a + 2, a + 4, a + 6$. Then $ad = a^2 + 6a$ and $bc = (a + 2)(a + 4) = a^2 + 6a + 8$, so $bc$ is always 8 more. For example, $1 \\cdot 7 = 7 < 15 = 3 \\cdot 5$. (B)`;
        break;
      }
      case 'count-multiples': {
        k = rng.pick([3, 4, 5, 6, 7]);
        m = k * rng.int(2, 10);
        n = m + k * rng.int(10, 25);
        const count = (n - m) / k + 1;
        const roll = rng.next();
        const Bv = roll < 0.3 ? count : roll < 0.65 ? count - 1 : count + 1;
        A = `The number of multiples of ${k} from ${m} to ${n}, inclusive`;
        B = `$${Bv}$`;
        answer = qcCompare(count, Bv);
        traps = Bv === count - 1 ? { C: 'int-multiples-count' } : undefined;
        explanation = `The multiples are $${k} \\cdot ${m / k}, ${k} \\cdot ${m / k + 1}, \\ldots, ${k} \\cdot ${n / k}$: that is $${n / k} - ${m / k} + 1 = ${count}$ numbers, or $\\frac{${n} - ${m}}{${k}} + 1 = ${count}$.

Compare ${count} with ${Bv}: ${QC_WORDS[answer]}. (${answer})`;
        bv = Bv;
        break;
      }
    }
    return {
      params: { item, m, n, k, bv, bw },
      q: { format: 'qc', ...(info ? { info } : {}), quantityA: A, quantityB: B, answer, traps, explanation },
    };
  },
  check(q, { item, m, n, k, bv, bw }) {
    const samples: [number, number][] = [];
    switch (item) {
      case 'odd-squares':
        samples.push([loopSum(1, 2 * n - 1, 2), bv]);
        break;
      case 'upper-half': {
        const S = loopSum(1, m);
        samples.push([loopSum(m + 1, 2 * m), [m * m + S, 2 * S, 3 * S][k]]);
        break;
      }
      case 'neg-cancel':
        samples.push([loopSum(-m, n), loopSum(bv, n)]);
        break;
      case 'xz-y2':
        for (let x = -30; x <= 30; x++) samples.push([x * (x + 2), (x + 1) ** 2]);
        break;
      case 'x-plus-z':
        for (let x = -30; x <= 30; x++) {
          const [y, z] = [x + 1, x + 2];
          samples.push([
            [x + z, x + y + z, x + y + z, z - x, x * y * z, x + y + z][k],
            [2 * y, 3 * y, 3 * x + 2, 1, 0, 3 * x][k],
          ]);
        }
        break;
      case 'four-vs-5n':
        for (let nn = 1; nn <= 40; nn++) samples.push([loopSum(nn, nn + k - 1), bv * nn + bw]);
        break;
      case 'odd-ends':
        for (let a = -21; a <= 21; a += 2) samples.push([[a + (a + 6), a + 6 - a, a + 6 - a, a * (a + 6), a * (a + 6)][k], [a + 2 + (a + 4), 6, 3, (a + 2) * (a + 4), 0][k]]);
        break;
      case 'odd-products':
        for (let a = 1; a <= 41; a += 2) samples.push([a * (a + 6), (a + 2) * (a + 4)]);
        break;
      case 'count-multiples': {
        let c = 0;
        for (let x = m; x <= n; x++) if (x % k === 0) c++;
        samples.push([c, bv]);
        break;
      }
    }
    return expectQc(q, qcFromSamples(samples));
  },
};

/** Sum of integers from a to b by the pairing formula (generate only). */
function loopSumFormula(a: number, b: number): number {
  return ((b - a + 1) * (a + b)) / 2;
}

/* ------------------------------------------------------------------ 7. Positions in a line, fence posts (NE) */

type LineKind = 'front-back' | 'between' | 'leave' | 'posts';

interface LineParams {
  kind: LineKind;
  a: number;
  b: number;
  c: number;
}

const NAMES = ['Ana', 'Ben', 'Carla', 'Dev', 'Elena', 'Femi', 'Grace', 'Hiro'];

const linePosition: Template<LineParams> = {
  id: 'arith.consecutive.line-position',
  skill: 'arith.consecutive',
  format: 'ne',
  style: 'counting positions in a line or fence posts (off-by-one)',
  generate(rng, diff) {
    const kind: LineKind = diff === 1 ? rng.pick(['front-back', 'posts'] as const) : diff === 2 ? rng.pick(['between', 'posts', 'front-back'] as const) : rng.pick(['leave', 'between'] as const);
    const [p1, p2] = rng.sample(NAMES, 2);
    let a: number;
    let b: number;
    let c = 0;
    let answer: number;
    let stem: string;
    let suffix: string;
    let explanation: string;
    const traps: { value: number; trap: string }[] = [];
    if (kind === 'front-back') {
      a = rng.int(5, 30);
      b = rng.int(5, 30);
      answer = a + b - 1;
      traps.push({ value: a + b, trap: 'int-line-self' });
      stem = `In a line of people waiting to buy tickets, ${p1} is the ${ordinal(a)} person from the front and the ${ordinal(b)} person from the back. How many people are in the line?`;
      suffix = 'people';
      explanation = `Counting from the front, there are ${a - 1} people ahead of ${p1}; counting from the back, there are ${b - 1} people behind ${p1}. The line has $${a - 1} + 1 + ${b - 1} = ${answer}$ people.

Adding $${a} + ${b} = ${a + b}$ counts ${p1} twice.`;
    } else if (kind === 'between') {
      a = rng.int(3, 20);
      b = a + rng.int(5, 25);
      answer = b - a - 1;
      traps.push({ value: b - a, trap: 'counted-endpoint' }, { value: b - a + 1, trap: 'counted-endpoint' });
      stem = `In a line of people, ${p1} is the ${ordinal(a)} person from the front and ${p2} is the ${ordinal(b)} person from the front. How many people are standing between ${p1} and ${p2}?`;
      suffix = 'people';
      explanation = `The people between them are in positions ${a + 1} through ${b - 1}, which is $${b - 1} - ${a + 1} + 1 = ${answer}$ people.

$${b} - ${a} = ${b - a}$ counts one of the two named people as well.`;
    } else if (kind === 'leave') {
      a = rng.int(4, 20); // ahead after leaving
      b = rng.int(4, 25); // behind
      c = rng.int(2, 9); // left
      answer = a + c + 1 + b;
      traps.push({ value: a + c + b, trap: 'int-line-self' }, { value: a + 1 + b, trap: 'int-line-self' });
      stem = `There are ${b} people behind ${p1} in a line. After ${c} of the people in front of ${p1} leave the line, there are ${a} people in front of ${p1}. Before anyone left, how many people were in the line?`;
      suffix = 'people';
      explanation = `Before anyone left there were $${a} + ${c} = ${a + c}$ people in front of ${p1}. The line was (people in front) + ${p1} + (people behind) $= ${a + c} + 1 + ${b} = ${answer}$.

Do not forget to count ${p1}, and add back the ${c} people who left.`;
    } else {
      const gap = rng.pick([2, 3, 4, 5, 6, 8, 10, 12]);
      const segs = rng.int(6, 20);
      a = gap * segs; // length
      b = gap;
      answer = segs + 1;
      traps.push({ value: segs, trap: 'cycle-count-terms' });
      stem = `Fence posts are placed in a straight line every ${b} meters along a fence that is ${a} meters long, with a post at each end of the fence. How many posts are there?`;
      suffix = 'posts';
      explanation = `The posts stand at 0, ${b}, ${2 * b}, ..., ${a} meters: that is $\\frac{${a}}{${b}} + 1 = ${segs} + 1 = ${answer}$ posts.

$\\frac{${a}}{${b}} = ${segs}$ counts the gaps between posts, not the posts.`;
    }
    return {
      params: { kind, a, b, c },
      q: {
        format: 'ne',
        stem,
        answer: frac(answer),
        suffix,
        traps: traps.filter((t) => t.value !== answer).map((t) => ({ value: frac(t.value), trap: t.trap })),
        explanation,
      },
    };
  },
  check(q, { kind, a, b, c }) {
    if (kind === 'front-back') {
      for (let N = 1; N <= 200; N++) if (N - a + 1 === b) return expectNe(q, N);
      return 'no N';
    }
    if (kind === 'between') {
      let cnt = 0;
      for (let pos = 1; pos <= 100; pos++) if (pos > a && pos < b) cnt++;
      return expectNe(q, cnt);
    }
    if (kind === 'leave') {
      // simulate: build the line as an array, then remove c people in front
      const line = [...Array(a + c).fill('front'), 'P', ...Array(b).fill('back')];
      const after = line.slice(c);
      if (after.indexOf('P') !== a) return 'simulation mismatch';
      return expectNe(q, line.length);
    }
    let posts = 0;
    for (let x = 0; x <= a; x += b) posts++;
    return expectNe(q, posts);
  },
};

export const consecutiveTemplates: Template<any>[] = [sumFunction, countMultiples, countExpression, findTerm, possibleSums, sumQC, linePosition];
