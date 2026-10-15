import { lcm, lcmAll } from '../../../engine/math';
import { num, plain } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { expectMcsBy, listAnd, spreadChoices } from './util';

export const remainderLcmTraps: Record<string, Trap> = {
  'int-lcm-remainder-omitted': {
    label: 'Gave a common multiple and forgot the remainder',
    fix: 'A common multiple of the divisors leaves remainder 0, not the remainder asked for. Same remainder $r$: add $r$ to the multiple. Remainder "one short" each time: subtract the shortfall.',
  },
  'int-lcm-remainder-sign': {
    label: 'Added or subtracted the remainder in the wrong direction',
    fix: 'Remainder $r$ means $n$ is $r$ ABOVE a multiple: $n = \\text{multiple} + r$. If each remainder is $t$ less than its divisor, $n$ is $t$ BELOW a multiple: $n = \\text{multiple} - t$.',
  },
  'int-lcm-product-used': {
    label: 'Used the product of the divisors instead of the LCM',
    fix: 'The product of the divisors is a common multiple, but not the least one when they share factors. Use the least common multiple: for 6 and 9 it is 18, not 54.',
  },
  'int-lcm-bound-ignored': {
    label: 'Gave the smallest solution without checking the bound',
    fix: 'The pattern repeats every LCM. After finding the first number that fits, keep adding the LCM until you pass the bound in the question.',
  },
  'int-lcm-next-cycle': {
    label: 'Went one full cycle past the first number above the bound',
    fix: 'Stop at the first number of the pattern that is greater than the bound. Adding one more LCM gives a valid number, but not the least one.',
  },
  'int-lcm-dropped-modulus': {
    label: 'Ignored one of the divisors',
    fix: 'The number must work for every divisor listed. Take the LCM of ALL of them, not only the first two.',
  },
};

interface P {
  mods: number[];
  rems: number[];
  L: number;
}

/** Smallest n > L with n congruent to c modulo step (n may not be below c's first positive value). */
const firstAbove = (c: number, step: number, L: number) => {
  const k = Math.max(0, Math.ceil((L + 1 - c) / step));
  return c + k * step;
};

const SAY: Record<string, (v: number) => string> = {
  'int-lcm-remainder-omitted': (v) => `The bare common multiple gives $${num(v)}$, which ignores the remainder condition.`,
  'int-lcm-remainder-sign': (v) => `Moving the remainder the wrong way gives $${num(v)}$.`,
  'int-lcm-product-used': (v) => `Using the product of the divisors gives $${num(v)}$, which is valid but not the least.`,
  'int-lcm-bound-ignored': (v) => `The first number that fits is $${num(v)}$, but it is not greater than the bound.`,
  'int-lcm-next-cycle': (v) => `Going one cycle further gives $${num(v)}$, which works but is not the least.`,
  'int-lcm-dropped-modulus': (v) => `Using only two of the divisors gives $${num(v)}$, which fails for the third.`,
};

const remainderLcm: Template<P> = {
  id: 'arith.lcm-gcd.remainder-lcm',
  skill: 'arith.lcm-gcd',
  format: 'mcs',
  style: 'least number above a bound with given remainders on division by several numbers',
  generate(rng, diff) {
    for (;;) {
      const count = diff === 1 ? 2 : 3;
      const pool = diff === 1 ? [4, 6, 8, 9, 10, 12] : [4, 6, 8, 9, 10, 12, 14, 15, 16, 18];
      const mods = rng.sample(pool, count).sort((a, b) => a - b);
      const Lcm = lcmAll(mods);
      const prod = mods.reduce((s, m) => s * m, 1);
      if (Lcm === prod || Lcm > (diff === 1 ? 60 : 180)) continue;
      if (mods.some((a, i) => mods.some((b, j) => i < j && b % a === 0))) continue;
      const short = diff === 3;
      const t = short ? rng.int(1, 3) : 0;
      const r = short ? 0 : rng.int(1, mods[0] - 1);
      const rems = short ? mods.map((m) => m - t) : mods.map(() => r);
      const c = short ? Lcm - t : r; // smallest positive solution
      const L = diff === 1 ? rng.int(mods[1], 2 * Lcm) : rng.int(20, diff === 2 ? 3 * Lcm : 4 * Lcm);
      const correct = firstAbove(c, Lcm, L);
      const cands: { v: number; trap: string }[] = [];
      if (short) {
        cands.push({ v: correct + t, trap: 'int-lcm-remainder-omitted' }, { v: correct + 2 * t, trap: 'int-lcm-remainder-sign' });
      } else {
        cands.push({ v: correct - r, trap: 'int-lcm-remainder-omitted' }, { v: correct - 2 * r, trap: 'int-lcm-remainder-sign' });
      }
      cands.push({ v: firstAbove(c, prod, L), trap: 'int-lcm-product-used' }, { v: correct + Lcm, trap: 'int-lcm-next-cycle' });
      if (short && c <= L) cands.push({ v: c, trap: 'int-lcm-bound-ignored' });
      if (count === 3) {
        const l2 = lcm(mods[0], mods[1]);
        const c2 = short ? l2 - t : r;
        if (l2 !== Lcm) cands.push({ v: firstAbove(c2, l2, L), trap: 'int-lcm-dropped-modulus' });
      }
      const good = cands.filter((x) => x.v > 0 && x.v !== correct);
      let res;
      try {
        res = spreadChoices(rng, correct, rng.shuffle(good), (v) => `$${num(v)}$`, 5, 'shuffled');
      } catch {
        continue;
      }
      const cite = res.choices.find((_, i) => i !== res.answer)!;
      const cv = Number(cite.text.replace(/[$,{}]/g, ''));
      const modsTxt = short
        ? ((xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")}, and ${xs[xs.length - 1]}`))(mods.map((m, i) => `${plain(rems[i])} when divided by ${m}`))
        : `${r} when divided by each of ${listAnd(mods.map(String))}`;
      const stem = `What is the least integer greater than ${plain(L)} that leaves a remainder of ${modsTxt}?`;
      const k = (correct - c) / Lcm;
      const explanation = short
        ? `Each remainder is ${t} less than its divisor, so $n + ${t}$ is divisible by ${listAnd(mods.map(String))}: it is a common multiple.

The LCM is ${Lcm}, so $n = ${Lcm}j - ${t}$. The least $j$ with $${Lcm}j - ${t} > ${L}$ is $j = ${k + 1}$, giving $n = ${num(correct)}$.

Check: $${num(correct)} + ${t} = ${num(correct + t)} = ${Lcm} \\cdot ${k + 1}$.

Trap: ${SAY[cite.trap!](cv)}`
        : `The same remainder ${r} on every division means $n - ${r}$ is divisible by ${listAnd(mods.map(String))}: it is a common multiple.

The LCM is ${Lcm}, so $n = ${Lcm}j + ${r}$. The least $j$ with $${Lcm}j + ${r} > ${L}$ is $j = ${k}$, giving $n = ${num(correct)}$.

Check: $${num(correct)} - ${r} = ${num(correct - r)} = ${Lcm} \\cdot ${k}$.

Trap: ${SAY[cite.trap!](cv)}`;
      return { params: { mods, rems, L }, q: { format: 'mcs', stem, choices: res.choices, answer: res.answer, explanation } };
    }
  },
  check(q, { mods, rems, L }) {
    let n = L + 1;
    while (!mods.every((m, i) => n % m === rems[i])) n++;
    return expectMcsBy(q, (i) => q.format === 'mcs' && q.choices[i].text === `$${num(n)}$`);
  },
};

export const remainderLcmTemplates: Template<any>[] = [remainderLcm];
