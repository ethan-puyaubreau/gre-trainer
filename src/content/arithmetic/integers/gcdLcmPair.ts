import type { Rng } from '../../../engine/rng';
import { divisors, factorize, gcd } from '../../../engine/math';
import type { Choice, Template, Trap } from '../../../engine/types';
import { expectMcsBy } from './util';

export const gcdLcmPairTraps: Record<string, Trap> = {
  'int-lcm-over-number': {
    label: 'Divided the LCM by the known number',
    fix: 'For two numbers, $\\gcd \\cdot \\text{lcm} = x \\cdot y$. The other number is $\\gcd \\cdot \\text{lcm} / x$, so the GCD must be part of the product.',
  },
  'int-lcm-over-gcd': {
    label: 'Divided the LCM by the GCD',
    fix: 'lcm / gcd is the product of the two coprime cofactors $m \\cdot n$, not a number of the pair. The numbers themselves are $g m$ and $g n$.',
  },
  'int-gcd-plus-lcm': {
    label: 'Assumed the two numbers add up to GCD + LCM',
    fix: 'The numbers $g m$ and $g n$ have GCD $g$ and LCM $g m n$. Their sum is $g(m + n)$, which equals $g + g m n$ only when one of them is the GCD itself.',
  },
  'int-other-is-lcm': {
    label: 'Took the LCM as the other number',
    fix: 'The LCM is a multiple of BOTH numbers. If one number is 36 and the LCM is 180, the other number is a divisor of 180, not 180 itself unless 36 divides it with GCD 36.',
  },
  'int-lcm-minus-number': {
    label: 'Subtracted the known number from the LCM',
    fix: 'GCD and LCM relate to the numbers by a product, not by a sum or a difference: $\\gcd \\cdot \\text{lcm} = x \\cdot y$.',
  },
  'int-lcm-minus-gcd': {
    label: 'Subtracted the GCD from the LCM',
    fix: 'GCD and LCM relate to the numbers by a product, not by a difference: $\\gcd \\cdot \\text{lcm} = x \\cdot y$.',
  },
  'int-gcd-is-other': {
    label: 'Took the GCD as the other number',
    fix: 'The GCD divides both numbers, but it is the other number only when that number divides the first. Use $y = \\gcd \\cdot \\text{lcm} / x$.',
  },
  'int-repeated-given': {
    label: 'Repeated the number that was given',
    fix: 'The question asks for the OTHER integer. Two different numbers can share a GCD and an LCM, but the pair is fixed by the product rule: $y = \\gcd \\cdot \\text{lcm} / x$.',
  },
  'int-answered-part': {
    label: 'Answered with one of the numbers instead of the sum',
    fix: 'Once the pair is found, reread what is asked: the sum, not the greater number, the lesser number or the difference.',
  },
  'int-wrong-factor-pair': {
    label: 'Used a pair with the right product but the wrong difference',
    fix: 'Several coprime pairs can have the same product. Use the difference given in the question to choose between them.',
  },
  'int-split-not-coprime': {
    label: 'Split the cofactor product into parts that share a factor',
    fix: 'If the cofactors $m$ and $n$ shared a factor, the GCD of the numbers would be larger than $g$. Both cofactors must be coprime.',
  },
  'int-not-greatest': {
    label: 'Picked a valid pair that does not give the greatest sum',
    fix: 'Compare every way to split lcm / gcd into two coprime factors (both greater than 1), and keep the largest sum. The sum is greatest when the parts are most unequal.',
  },
  'int-not-least': {
    label: 'Picked a valid pair that does not give the least sum',
    fix: 'Compare every way to split lcm / gcd into two coprime factors (both greater than 1), and keep the smallest sum. The sum is least when the parts are closest together.',
  },
  'int-forgot-gcd-factor': {
    label: 'Added the cofactors without multiplying by the GCD',
    fix: 'The numbers are $g m$ and $g n$, so their sum is $g(m + n)$. Do not stop at $m + n$.',
  },
  'int-lcm-itself': {
    label: 'Took the LCM as the sum of the numbers',
    fix: 'The LCM is one number that both divide. The sum of the pair is $g(m + n)$, which is a different quantity.',
  },
};

interface PairParams {
  kind: 'other' | 'sum-diff' | 'sum-max' | 'sum-min';
  g: number;
  L: number;
  x: number;
  D: number;
}

/** GCD by scanning down, LCM by scanning multiples (checks avoid the formulas used by generate). */
const gcdScan = (a: number, b: number) => {
  for (let d = Math.min(a, b); d >= 1; d--) if (a % d === 0 && b % d === 0) return d;
  return 1;
};
const lcmScan = (a: number, b: number) => {
  for (let m = Math.max(a, b); ; m += Math.max(a, b)) if (m % a === 0 && m % b === 0) return m;
};

/** Coprime ordered splits (A, B), A <= B, of k, as lists of prime-power components. */
function coprimeSplits(k: number): [number, number][] {
  const comps = factorize(k).map(([p, e]) => p ** e);
  const out: [number, number][] = [];
  for (let mask = 0; mask < 1 << comps.length; mask++) {
    const a = comps.reduce((acc, c, i) => (mask & (1 << i) ? acc * c : acc), 1);
    const b = k / a;
    if (a <= b) out.push([a, b]);
  }
  return out;
}

const gcdLcmPair: Template<PairParams> = {
  id: 'arith.lcm-gcd.pair-from-gcd-lcm',
  skill: 'arith.lcm-gcd',
  format: 'mcs',
  style: 'find a pair of integers from their GCD and LCM',
  generate(rng, diff) {
    for (;;) {
      const g = rng.int(2, diff === 3 ? 6 : 9);
      const v = rng.int(0, 2);
      const least = diff === 3 && rng.chance(0.5);
      let m: number;
      let n: number;
      if (diff === 1) {
        m = rng.int(2, 9);
        n = rng.int(2, 9);
        if (m === n || gcd(m, n) !== 1) continue;
      } else {
        const k = rng.int(diff === 2 ? 12 : 30, diff === 2 ? 100 : 140);
        const comps = factorize(k).length;
        if (diff === 2 ? comps < 2 : comps < 3) continue;
        const splits = coprimeSplits(k).filter(([a]) => a > 1);
        [n, m] = rng.pick(splits);
        if (diff === 3) {
          // the answer is the split with the largest (or least) sum, both parts > 1
          [n, m] = splits.reduce((best, s) => ((s[0] + s[1] > best[0] + best[1]) !== least ? s : best));
        }
      }
      const k = m * n;
      const L = g * k;
      if (L > 700) continue;
      const lo = Math.min(m, n);
      const hi = Math.max(m, n);
      if (diff === 1) {
        const x = g * (rng.chance(0.5) ? m : n);
        const y = (g * L) / x;
        const traps = [
          { value: L / x, trap: 'int-lcm-over-number' },
          { value: k, trap: 'int-lcm-over-gcd' },
          { value: g + L - x, trap: 'int-gcd-plus-lcm' },
          { value: L - x, trap: 'int-lcm-minus-number' },
          { value: L, trap: 'int-other-is-lcm' },
          { value: L - g, trap: 'int-lcm-minus-gcd' },
          { value: x, trap: 'int-repeated-given' },
          { value: g, trap: 'int-gcd-is-other' },
        ].filter((t) => Number.isInteger(t.value) && t.value > 0);
        const built = pairChoices(rng, y, traps);
        if (!built) continue;
        const { choices, answer } = built;
        return {
          params: { kind: 'other', g, L, x, D: 0 },
          q: {
            format: 'mcs',
            stem: [
              `The greatest common divisor of two positive integers is ${g} and their least common multiple is ${L}. If one of the integers is ${x}, what is the other integer?`,
              `Two positive integers have a greatest common divisor of ${g} and a least common multiple of ${L}. One of them is ${x}. What is the other?`,
              `For positive integers $a$ and $b$, the greatest common divisor is ${g} and the least common multiple is ${L}. If $a = ${x}$, what is $b$?`,
            ][v],
            choices,
            answer,
            explanation: explainOther(g, L, x, y, choices, answer),
          },
        };
      }
      const pairs = coprimeSplits(k).filter(([a]) => a > 1 || diff === 2);
      if (diff === 2) {
        // the difference must single out the pair among all coprime pairs, (1, k) included
        const D = g * (hi - lo);
        if (coprimeSplits(k).filter(([a, b]) => g * (b - a) === D).length !== 1) continue;
        const nonCop: number[] = [];
        for (let a = 2; a * a <= k; a++) if (k % a === 0 && gcd(a, k / a) !== 1) nonCop.push(g * (a + k / a));
        const traps = [
          { value: g + L, trap: 'int-gcd-plus-lcm' },
          ...coprimeSplits(k)
            .filter(([a, b]) => a > 1 && g * (b - a) !== D)
            .map(([a, b]) => ({ value: g * (a + b), trap: 'int-wrong-factor-pair' })),
          ...nonCop.map((v) => ({ value: v, trap: 'int-split-not-coprime' })),
          ...rng.shuffle([
            { value: g * hi, trap: 'int-answered-part' },
            { value: g * lo, trap: 'int-answered-part' },
            { value: D, trap: 'int-answered-part' },
          ]),
        ];
        const distinct = new Set(traps.map((t) => t.value).filter((v) => v !== g * (lo + hi)));
        if (distinct.size < 4) continue;
        const sum = g * (lo + hi);
        const built = pairChoices(rng, sum, traps);
        if (!built) continue;
        const { choices, answer } = built;
        return {
          params: { kind: 'sum-diff', g, L, x: 0, D },
          q: {
            format: 'mcs',
            stem: [
              `Two different positive integers have greatest common divisor ${g} and least common multiple ${L}. The greater integer exceeds the lesser by ${D}. What is the sum of the two integers?`,
              `The positive integers $a$ and $b$ have greatest common divisor ${g} and least common multiple ${L}. If $a - b = ${D}$ and $a > b$, what is $a + b$?`,
              `Two positive integers share the greatest common divisor ${g} and the least common multiple ${L}. The greater one is ${D} more than the lesser one. What is their sum?`,
            ][v],
            choices,
            answer,
            explanation: explainDiff(g, L, k, lo, hi, D, sum, choices, answer),
          },
        };
      }
      // diff 3: both integers differ from the GCD, i.e. neither divides the other
      const sums = pairs.map(([a, b]) => g * (a + b));
      const best = g * (lo + hi);
      const others = pairs.map(([a, b]) => ({ value: g * (a + b), trap: least ? 'int-not-least' : 'int-not-greatest' })).filter((t) => t.value !== best);
      const traps = [{ value: g + L, trap: 'int-gcd-plus-lcm' }, ...others, { value: L, trap: 'int-lcm-itself' }, { value: lo + hi, trap: 'int-forgot-gcd-factor' }, { value: g * hi, trap: 'int-answered-part' }];
      if (new Set(traps.map((t) => t.value)).size < 4 || sums.length < 2) continue;
      const built = pairChoices(rng, best, traps);
        if (!built) continue;
        const { choices, answer } = built;
      return {
        params: { kind: least ? 'sum-min' : 'sum-max', g, L, x: 0, D: 0 },
        q: {
          format: 'mcs',
          stem: [
            `Two positive integers have greatest common divisor ${g} and least common multiple ${L}, and neither integer is a multiple of the other. What is the ${least ? 'least' : 'greatest'} possible value of the sum of the two integers?`,
            `Positive integers $a$ and $b$ have greatest common divisor ${g} and least common multiple ${L}. If neither of $a$ and $b$ divides the other, what is the ${least ? 'least' : 'greatest'} possible value of $a + b$?`,
            `The greatest common divisor of $a$ and $b$ is ${g}, and their least common multiple is ${L}. Neither number is a divisor of the other. What is the ${least ? 'smallest' : 'largest'} value that $a + b$ can take?`,
          ][v],
          choices,
          answer,
          explanation: explainMax(g, L, k, pairs, best, least, choices, answer),
        },
      };
    }
  },
  check(q, { kind, g, L, x, D }) {
    const divs = divisors(L);
    const ok = (a: number, b: number) => gcdScan(a, b) === g && lcmScan(a, b) === L;
    let expected = 0;
    if (kind === 'other') expected = divs.find((y) => ok(x, y)) ?? -1;
    else if (kind === 'sum-min') {
      expected = Infinity;
      for (const a of divs) for (const b of divs) if (a % b !== 0 && b % a !== 0 && ok(a, b)) expected = Math.min(expected, a + b);
    } else if (kind === 'sum-diff') {
      for (const a of divs) for (const b of divs) if (a > b && a - b === D && ok(a, b)) expected = a + b;
    } else {
      for (const a of divs) for (const b of divs) if (a % b !== 0 && b % a !== 0 && ok(a, b)) expected = Math.max(expected, a + b);
    }
    return expectMcsBy(q, (i) => q.format === 'mcs' && Number(q.choices[i].text.replace(/[^0-9]/g, '')) === expected);
  },
};

/** 5 ascending numeric choices: the key and 4 distinct traps, split around the key so its position is uniform among the feasible ones. */
function pairChoices(rng: Rng, correct: number, traps: { value: number; trap: string }[]): { choices: Choice[]; answer: number } | null {
  const seen = new Set<number>([correct]);
  const uniq = traps.filter((t) => Number.isInteger(t.value) && t.value > 0 && !seen.has(t.value) && !!seen.add(t.value));
  const below = rng.shuffle(uniq.filter((t) => t.value < correct));
  const above = rng.shuffle(uniq.filter((t) => t.value > correct));
  const feasible = [0, 1, 2, 3, 4].filter((t) => t <= below.length && 4 - t <= above.length);
  if (!feasible.length) return null;
  const t = rng.pick(feasible);
  const items = [...below.slice(0, t).map((x) => ({ v: x.value, trap: x.trap })), { v: correct, trap: undefined as string | undefined }, ...above.slice(0, 4 - t).map((x) => ({ v: x.value, trap: x.trap }))].sort((a, b) => a.v - b.v);
  return { choices: items.map((x) => ({ text: `$${x.v}$`, ...(x.trap ? { trap: x.trap } : {}) })), answer: items.findIndex((x) => x.trap === undefined) };
}

const val = (c: { text: string }) => c.text.replace(/[^0-9]/g, '');

function trapNote(choices: { text: string; trap?: string }[], answer: number, notes: Record<string, string>): string {
  const w = choices.find((c, i) => i !== answer && c.trap && notes[c.trap]);
  return w ? `Trap: ${val(w)} ${notes[w.trap!]}.` : '';
}

function explainOther(g: number, L: number, x: number, y: number, choices: { text: string; trap?: string }[], answer: number): string {
  return `Recognize: the GCD and LCM of two numbers multiply to the product of the numbers.

Write the numbers as $g m$ and $g n$ with $m$, $n$ coprime. Then the LCM is $g m n$, so $\\gcd \\cdot \\text{lcm} = g \\cdot g m n = x y$. The other number is $${g} \\cdot ${L} / ${x} = ${y}$.

Check: ${x} and ${y} are both multiples of ${g}, and ${x / g} and ${y / g} share no factor, so the GCD is ${g} and the LCM is ${L}.

${trapNote(choices, answer, {
    'int-lcm-over-number': `comes from dividing the LCM by ${x} and forgetting the GCD`,
    'int-lcm-over-gcd': `is the LCM divided by the GCD, which is the product of the cofactors and not a number of the pair`,
    'int-gcd-plus-lcm': `assumes the numbers sum to GCD + LCM, which is false`,
    'int-lcm-minus-number': `comes from subtracting ${x} from ${L}, but GCD and LCM relate to the numbers by a product`,
    'int-lcm-minus-gcd': `comes from subtracting the GCD ${g} from the LCM, but the relation is a product`,
    'int-gcd-is-other': `is the GCD itself, which divides the numbers but is not the other one`,
    'int-repeated-given': `repeats the given number, but the question asks for the other one`,
    'int-other-is-lcm': `takes the LCM itself as the other number, but ${x} does not give GCD ${g} with ${L}`,
  })} Use gcd times lcm equals the product.`;
}

function explainDiff(g: number, L: number, k: number, lo: number, hi: number, D: number, sum: number, choices: { text: string; trap?: string }[], answer: number): string {
  const pairs = coprimeSplits(k).map(([a, b]) => `${a} and ${b}`).join('; ');
  return `Recognize: write the numbers as $g m$ and $g n$ with coprime $m$ and $n$.

Then the LCM is $g m n$, so $m n = ${L} / ${g} = ${k}$. The coprime pairs with product ${k} are ${pairs}. The difference is $${g}(m - n) = ${D}$, which only the pair ${lo} and ${hi} gives. The numbers are ${g * lo} and ${g * hi}, with sum ${sum}.

Check: the GCD of ${g * lo} and ${g * hi} is ${g}, and their LCM is ${L}.

${trapNote(choices, answer, {
    'int-gcd-plus-lcm': `is GCD + LCM, which would need one number to equal the GCD`,
    'int-answered-part': `is a number from the pair or their difference, but the sum was asked`,
    'int-wrong-factor-pair': `comes from a pair with product ${k} but another difference`,
    'int-split-not-coprime': `uses cofactors that share a factor, so the GCD would exceed ${g}`,
  })} Use the difference to pick the pair.`;
}

function explainMax(g: number, L: number, k: number, pairs: [number, number][], best: number, least: boolean, choices: { text: string; trap?: string }[], answer: number): string {
  const list = pairs.map(([a, b]) => `${a} and ${b} give ${g * (a + b)}`).join('; ');
  return `Recognize: write the numbers as $g m$ and $g n$ with coprime $m$ and $n$, so $m n = ${L} / ${g} = ${k}$.

Neither number divides the other, so neither cofactor is 1. The coprime splits of ${k} are: ${list}. The ${least ? 'least' : 'greatest'} sum is ${best}.

Check: the two numbers have GCD ${g} and LCM ${L}.

${trapNote(choices, answer, {
    'int-gcd-plus-lcm': `is ${g} + ${L}, the sum of a pair where one number divides the other`,
    'int-not-greatest': `comes from a valid pair that is not the most unequal one`,
    'int-not-least': `comes from a valid pair that is not the most balanced one`,
    'int-answered-part': `is one number of the best pair, but the sum was asked`,
    'int-forgot-gcd-factor': `adds the cofactors but forgets to multiply by the GCD ${g}`,
    'int-lcm-itself': `is just the LCM, which is not a sum of the pair`,
  })} ${least ? 'Balanced' : 'Most unequal'} coprime parts give the ${least ? 'least' : 'greatest'} sum.`;
}

export const gcdLcmPairTemplates: Template<any>[] = [gcdLcmPair];
