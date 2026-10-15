import { numericChoices } from '../../../engine/build';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';

// New question styles for data.counting and data.probability, with their traps.
export const pigeonTraps: Record<string, Trap> = {
  'prob-pigeon-best-case': {
    label: 'Answered with the best case instead of the worst case',
    fix: '"Guarantee" means no matter how unlucky the draws are. Count the draws in the WORST order, then add one.',
  },
  'prob-pigeon-no-plus-one': {
    label: 'Counted the worst-case draws but forgot the one more draw that finishes the job',
    fix: 'The worst case lists every draw that does NOT yet reach the goal. The very next draw must reach it, so add 1.',
  },
  'prob-pigeon-m-per-group': {
    label: 'Took $m$ items from every group',
    fix: 'The worst case takes only $m - 1$ from each group, one short of the goal. Taking $m$ from a group already reaches the goal.',
  },
  'prob-pigeon-draw-all': {
    label: 'Drew everything to be sure',
    fix: 'Drawing every item is safe but not the least number. Stop at the first draw that no longer allows a miss.',
  },
  'prob-pigeon-swap-roles': {
    label: 'Swapped the number of groups and the target count',
    fix: 'With $k$ groups and a target of $m$ in one group, the worst case is $m - 1$ from each of $k$ groups: $k(m - 1) + 1$.',
  },
  'prob-pigeon-ignore-supply': {
    label: 'Ignored that a small group runs out',
    fix: 'A group with only $s$ items can give at most $s$ draws, so in the worst case take $\\min(s, m - 1)$ from each group.',
  },
  'prob-pigeon-wrong-group': {
    label: 'Left the wrong group for last',
    fix: 'To reach the goal for EVERY group, the unluckiest case drains all the others and keeps the SMALLEST group for last.',
  },
  'prob-pigeon-forgot-target': {
    label: 'Forgot the final $m$ draws of the last group',
    fix: 'After the other groups are used up, you still need $m$ items from the last group, so the count is (total - smallest group) + $m$.',
  },
};

interface PigeonParams {
  mode: 'same' | 'each';
  sizes: number[];
  m: number;
}

const CONTEXTS = [
  { noun: 'marbles', place: 'A bag', colors: ['red', 'blue', 'green', 'yellow', 'white'] },
  { noun: 'socks', place: 'A drawer', colors: ['black', 'gray', 'navy', 'brown', 'white'] },
  { noun: 'pencils', place: 'A box', colors: ['red', 'blue', 'green', 'yellow', 'orange'] },
];

const listAnd = (xs: string[]) => (xs.length === 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`);

const pigeonholeMCS: Template<PigeonParams> = {
  id: 'data.counting.pigeonhole-mcs',
  skill: 'data.counting',
  format: 'mcs',
  style: 'worst case: how many draws guarantee a match (pigeonhole)',
  generate(rng, d) {
    for (;;) {
      const ctx = rng.pick(CONTEXTS);
      const k = rng.pick([3, 4]);
      const mode: 'same' | 'each' = d === 3 ? 'each' : 'same';
      const m = d === 1 ? rng.int(3, 5) : d === 2 ? rng.int(4, 6) : rng.int(3, 5);
      const sizes: number[] = [];
      for (let i = 0; i < k; i++) sizes.push(rng.int(m + 2, 14));
      if (d === 2) {
        // one or two small groups: they run out before m - 1 draws
        const small = rng.int(1, 2);
        for (let i = 0; i < small; i++) sizes[i] = rng.int(2, m - 2);
      }
      if (d === 3 && new Set(sizes).size < sizes.length) continue; // a unique smallest and largest group
      const colors = rng.sample(ctx.colors, k);
      const total = sizes.reduce((s, x) => s + x, 0);
      const smallest = Math.min(...sizes);
      const largest = Math.max(...sizes);
      let key: number;
      let traps: { value: number; trap: string }[];
      let steps: string;
      if (mode === 'same') {
        const taken = sizes.map((s) => Math.min(s, m - 1));
        const worst = taken.reduce((s, x) => s + x, 0);
        key = worst + 1;
        traps = [
          { value: m, trap: 'prob-pigeon-best-case' },
          { value: worst, trap: 'prob-pigeon-no-plus-one' },
          { value: k * m, trap: 'prob-pigeon-m-per-group' },
          { value: total, trap: 'prob-pigeon-draw-all' },
          { value: m * (k - 1) + 1, trap: 'prob-pigeon-swap-roles' },
        ];
        if (d === 2) traps.push({ value: k * (m - 1) + 1, trap: 'prob-pigeon-ignore-supply' });
        const small = sizes.some((s) => s < m - 1);
        steps = `The worst case takes as many ${ctx.noun} as possible without having ${m} of one color. That is at most ${m - 1} of each color${small ? `, and fewer when a color runs out: ${taken.map((x, i) => `${colors[i]} gives ${x}`).join(', ')}` : ''}. Together that is $${taken.join(' + ')} = ${worst}$ draws with no match. The next draw must give ${m} of some color, so $${worst} + 1 = ${key}$.`;
      } else {
        key = total - smallest + m;
        const noOne = key - 1;
        traps = [
          { value: k * m, trap: 'prob-pigeon-best-case' },
          { value: noOne, trap: 'prob-pigeon-no-plus-one' },
          { value: total, trap: 'prob-pigeon-draw-all' },
          { value: total - largest + m, trap: 'prob-pigeon-wrong-group' },
          { value: total - smallest, trap: 'prob-pigeon-forgot-target' },
        ];
        const ci = sizes.indexOf(smallest);
        steps = `The unluckiest order draws every ${ctx.noun.replace(/s$/, '')} of the other colors first, $${total} - ${smallest} = ${total - smallest}$ of them, and only ${m - 1} of ${colors[ci]}, the color with the fewest. That is $${total - smallest} + ${m - 1} = ${noOne}$ draws, and ${colors[ci]} still has fewer than ${m}. One more draw is ${colors[ci]}, so the least number that guarantees it is $${noOne} + 1 = ${key}$.`;
      }
      if (key >= total) continue;
      // every mistake of the "each" variant lies below the key, so its choices are shown in random order
      const built = numericChoices(rng, {
        correct: key,
        traps: mode === 'each' ? rng.shuffle(traps) : traps,
        format: (v) => `$${num(v)}$`,
        order: mode === 'each' ? 'random' : 'asc',
      });
      const first = built.choices.find((c) => c.trap)!;
      const firstValue = Number(first.text.replace(/[^\d]/g, ''));
      const trapLine: Record<string, string> = {
        'prob-pigeon-best-case': `$${firstValue}$ is the best case, a lucky streak of matches, not a guarantee.`,
        'prob-pigeon-no-plus-one': `$${firstValue}$ is a wrong stopping point: after those draws no goal is reached yet, so one more draw is needed.`,
        'prob-pigeon-m-per-group': `$${firstValue}$ is a slip: taking ${m} from a color already reaches the goal, so the worst case takes only ${m - 1}.`,
        'prob-pigeon-draw-all': `$${firstValue}$ draws everything. It is safe but not the least number.`,
        'prob-pigeon-swap-roles': `$${firstValue}$ is a mistake: it swaps the ${k} colors and the target ${m}.`,
        'prob-pigeon-ignore-supply': `$${firstValue}$ is a slip: it ignores that a small color runs out.`,
        'prob-pigeon-wrong-group': `$${firstValue}$ is a wrong choice of the last color: the unluckiest case leaves the smallest color for last.`,
        'prob-pigeon-forgot-target': `$${firstValue}$ is a mistake: it stops before the ${m} needed from the last color.`,
      };
      const goal = mode === 'same' ? `at least ${m} of them are the same color` : `at least ${m} of each color have been drawn`;
      return {
        params: { mode, sizes, m },
        q: {
          format: 'mcs',
          stem: `${ctx.place} contains ${listAnd(sizes.map((s, i) => `${s} ${colors[i]}`))} ${ctx.noun}. ${ctx.noun[0].toUpperCase() + ctx.noun.slice(1)} are drawn one at a time without looking and without replacement. What is the least number of ${ctx.noun} that must be drawn to guarantee that ${goal}?`,
          choices: built.choices,
          answer: built.answer,
          explanation: `"Guarantee" asks for the worst case: assume every draw is as unlucky as possible, then add the draw that ends the bad luck.\n\n${steps}\n\nTrap: ${trapLine[first.trap!]}\n\nRule: guaranteed count = (largest number of draws that still misses the goal) + 1.`,
        },
      };
    }
  },
  check(q, { mode, sizes, m }) {
    if (q.format !== 'mcs') return 'wrong format';
    // Brute force: the longest draw (as counts per color) that has not reached the goal yet.
    let best = -1;
    const c = sizes.map(() => 0);
    const rec = (i: number) => {
      if (i === sizes.length) {
        const reached = mode === 'same' ? c.some((x) => x >= m) : c.every((x) => x >= m);
        if (!reached) best = Math.max(best, c.reduce((s, x) => s + x, 0));
        return;
      }
      for (let x = 0; x <= sizes[i]; x++) {
        c[i] = x;
        rec(i + 1);
      }
      c[i] = 0;
    };
    rec(0);
    const want = best + 1;
    return q.choices[q.answer].text === `$${num(want)}$` ? null : `expected ${want}, keyed ${q.choices[q.answer].text}`;
  },
};

export const pigeonTemplates: Template<any>[] = [pigeonholeMCS];
