import { Frac } from '../../../engine/frac';
import { num, usd } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { trapChoices } from './util';

export const systemTicketsTraps: Record<string, Trap> = {
  'alg-sys-equal-split': {
    label: 'Assumed the two kinds were sold in equal numbers',
    fix: 'Equal numbers would give a definite total, $T \\cdot \\frac{a + b}{2}$. Check that against the real total; if it differs, the counts differ.',
  },
  'alg-sys-revenue-as-count': {
    label: 'Gave a dollar amount when the question asks for a count (or only part of a difference)',
    fix: 'Say what each unknown counts before you solve, and answer in that unit.',
  },
  'alg-sys-swapped-prices': {
    label: 'Paired each price with the wrong count',
    fix: 'Each price multiplies ITS OWN count: sales of the first kind are (first price) $\\times$ (first count), and the same for the second kind.',
  },
  'alg-sys-wrong-item': {
    label: 'Answered about the other kind of item',
    fix: 'After solving, re-read which kind the question asks about; the other count is $T$ minus yours.',
  },
};

interface Params {
  /** [a, b, T, R, asked]: a, b prices of the first and second kind, T items, R receipts. asked: 0 first kind, 1 second kind, 2 how many more first than second, 3 dollars more from first than second. */
  k: number[];
  values: number[];
}

const CTX = [
  { nA: 'adult tickets', nB: 'child tickets', story: (T: number, a: number, b: number, R: number) => `A theater sold ${T} tickets for one show. Adult tickets cost ${usd(a)} each and child tickets cost ${usd(b)} each. The total sales were ${usd(R)}.` },
  { nA: 'hardcover books', nB: 'paperback books', story: (T: number, a: number, b: number, R: number) => `A bookstore sold ${T} books in one day. Each hardcover cost ${usd(a)} and each paperback cost ${usd(b)}. The total sales were ${usd(R)}.` },
  { nA: 'large bags', nB: 'small bags', story: (T: number, a: number, b: number, R: number) => `A cafe sold ${T} bags of coffee. A large bag cost ${usd(a)} and a small bag cost ${usd(b)}. The total sales were ${usd(R)}.` },
];

const ticketsMCS: Template<Params> = {
  id: 'alg.systems.tickets-mcs',
  skill: 'alg.systems',
  format: 'mcs',
  style: 'two kinds of items, a total count and a total price',
  generate(rng, d) {
    for (;;) {
      const ctx = rng.int(0, CTX.length - 1);
      const b = rng.int(2, 9);
      const a = b + rng.int(2, 8);
      const x = rng.int(6, 36);
      const y = rng.int(6, 36);
      if (x === y || (x + y) % 2 === 1) continue;
      const T = x + y;
      const R = a * x + b * y;
      const asked = d === 1 ? rng.pick([0, 1]) : d === 2 ? rng.pick([1, 2, 0]) : rng.pick([3, 3, 2]);
      if ((asked === 2 || asked === 3) && x <= y) continue;
      if (asked === 3 && a * x - b * y <= 0) continue;
      const { nA, nB, story } = CTX[ctx];
      const key = asked === 0 ? x : asked === 1 ? y : asked === 2 ? x - y : a * x - b * y;
      const question =
        asked === 0 ? `How many ${nA} were sold?` : asked === 1 ? `How many ${nB} were sold?` : asked === 2 ? `How many more ${nA} than ${nB} were sold?` : `By how many dollars did the sales of ${nA} exceed the sales of ${nB}?`;
      const stem = `${story(T, a, b, R)} ${question}`;
      const Dp = a - b;
      const cand: { value: number; trap: string; why: string }[] =
        asked === 0
          ? [
              { value: y, trap: 'alg-sys-wrong-item', why: `$${y}$ is the number of ${nB}, the other kind.` },
              { value: T / 2, trap: 'alg-sys-equal-split', why: `Splitting ${T} items evenly gives ${T / 2} of each, but then the sales would be ${usd(((a + b) * T) / 2)}, not ${usd(R)}.` },
              { value: R - b * T, trap: 'alg-forgot-divide', why: `Stopping at $${Dp}x = ${num(R - b * T)}$ forgets to divide by the price difference ${Dp}.` },
              { value: a * x, trap: 'alg-sys-revenue-as-count', why: `$${num(a * x)}$ is the dollar sales of the ${nA}, not their number.` },
            ]
          : asked === 1
            ? [
                { value: x, trap: 'alg-sys-wrong-item', why: `$${x}$ is the number of ${nA}, the other kind.` },
                { value: T / 2, trap: 'alg-sys-equal-split', why: `Splitting ${T} items evenly gives ${T / 2} of each, but then the sales would be ${usd(((a + b) * T) / 2)}, not ${usd(R)}.` },
                { value: a * T - R, trap: 'alg-forgot-divide', why: `Stopping at $${Dp}y = ${num(a * T - R)}$ forgets to divide by the price difference ${Dp}.` },
                { value: b * y, trap: 'alg-sys-revenue-as-count', why: `$${num(b * y)}$ is the dollar sales of the ${nB}, not their number.` },
              ]
            : asked === 2
              ? [
                  { value: x, trap: 'alg-sys-wrong-item', why: `$${x}$ is only the number of ${nA}; the question asks how many more.` },
                  { value: y, trap: 'alg-sys-wrong-item', why: `$${y}$ is the number of ${nB}, not the difference.` },
                  { value: T, trap: 'alg-sys-wrong-item', why: `$${T}$ is the total number of items.` },
                  { value: Dp * (x - y), trap: 'alg-forgot-divide', why: `$${Dp}(x - y)$ is what the equations give directly; divide by ${Dp} to get $x - y$.` },
                ]
              : [
                  { value: b * y, trap: 'alg-sys-revenue-as-count', why: `${usd(b * y)} is the sales of the ${nB} alone, not the difference.` },
                  { value: a * x, trap: 'alg-sys-revenue-as-count', why: `${usd(a * x)} is the sales of the ${nA} alone, not the difference.` },
                  { value: R, trap: 'alg-sys-revenue-as-count', why: `${usd(R)} is the total sales, not a difference.` },
                  { value: a * y - b * x, trap: 'alg-sys-swapped-prices', why: `Using the prices the wrong way round, ${usd(a * y)} minus ${usd(b * x)}, gives ${usd(a * y - b * x)}.` },
                  { value: Dp * (x - y), trap: 'alg-sys-swapped-prices', why: `Applying the price difference to the count difference, ${Dp} times ${x - y}, gives ${usd(Dp * (x - y))}, which is not a difference of sales.` },
                ];
      const uniq = cand.filter((c) => Number.isInteger(c.value) && c.value > 0);
      const res = trapChoices(rng, key, uniq.map((c) => ({ ...c, value: new Frac(c.value) })), (v) => (asked === 3 ? usd(v.n) : `$${v.toTex()}$`));
      if (!res) continue;
      const kept = res.kept[0];
      const order = rng.shuffle(res.choices.map((_, i) => i));
      const explanation = `Two kinds of items with a known total count and total price: write two equations.

Let $x$ be the number of ${nA} and $y$ the number of ${nB}. Then $x + y = ${T}$ and $${a}x + ${b}y = ${num(R)}$. Replace $y$ by $${T} - x$: $${a}x + ${b}(${T} - x) = ${num(R)}$, so $${Dp}x = ${num(R - b * T)}$. Then $x = ${x}$ and $y = ${y}$.

${asked === 2 ? `The difference is $${x} - ${y} = ${x - y}$. ` : asked === 3 ? `Sales of ${nA} were $${a} \\cdot ${x} = ${num(a * x)}$ dollars and sales of ${nB} were $${b} \\cdot ${y} = ${num(b * y)}$ dollars, a difference of ${usd(key)}. ` : ''}Check: $${a} \\cdot ${x} + ${b} \\cdot ${y} = ${num(R)}$.

Trap: ${kept.why}

Rule: name what each unknown counts, write one equation for the count and one for the money, and answer in the unit asked.`;
      return {
        params: { k: [a, b, T, R, asked], values: order.map((i) => res.values[i].n) },
        q: { format: 'mcs', stem, choices: order.map((i) => res.choices[i]), answer: order.indexOf(res.answer), explanation },
      };
    }
  },
  check(q, { k, values }) {
    if (q.format !== 'mcs') return 'wrong format';
    const [a, b, T, R, asked] = k;
    const fmt = (v: number) => (asked === 3 ? usd(v) : `$${num(v)}$`);
    if (values.some((v, i) => q.choices[i].text !== fmt(v))) return 'choice text mismatch';
    let found: number | null = null;
    let count = 0;
    for (let x = 0; x <= T; x++) {
      const y = T - x;
      if (a * x + b * y !== R) continue;
      count++;
      found = asked === 0 ? x : asked === 1 ? y : asked === 2 ? x - y : a * x - b * y;
    }
    if (count !== 1 || found === null) return `${count} solutions`;
    const hits = values.flatMap((v, i) => (v === found ? [i] : []));
    return hits.length === 1 && hits[0] === q.answer ? null : `expected ${found}`;
  },
};

export const systemTicketsTemplates = [ticketsMCS];
