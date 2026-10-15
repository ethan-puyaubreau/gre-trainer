import { Frac, frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';

// alg.word-problems: how an average changes when a value leaves or joins (numeric entry).

export const wpAverageChangeTraps: Record<string, Trap> = {
  'algw-avg-gap-unscaled': {
    label: 'Used the change in the average as the change in the total',
    fix: 'A change of $c$ in the average of $m$ values is a change of $m \\cdot c$ in their total. Work with totals: average × count.',
  },
  'algw-avg-wrong-count': {
    label: 'Divided by or multiplied with the old count after the group changed',
    fix: 'After a value leaves or joins, the group has a different size. Use the new count with the new average.',
  },
  'algw-avg-target-as-value': {
    label: 'Gave the target average as the value that is added',
    fix: 'A new value equal to the target average would change nothing for the new total of the others; it must also make up the shortfall (or surplus) of the old values.',
  },
  'algw-avg-two-as-one': {
    label: 'Gave the total of the two new values instead of each',
    fix: 'Two equal newcomers share the total they add: divide it by 2 at the end.',
  },
  'algw-avg-ignored-leaver': {
    label: 'Forgot that a value also left the group',
    fix: 'Start from the old total, subtract the value that left, add the newcomers, and compare with the new total.',
  },
};

interface AvgParams {
  kind: 'remove' | 'add' | 'swap';
  n: number;
  a: number;
  b: number;
  u: number;
}

interface Ctx {
  grp: string;
  each: string;
  m: string;
  unit: string;
  cap?: number;
}

const CTX: Ctx[] = [
  { grp: 'students', each: 'student', m: 'quiz score', unit: 'points', cap: 100 },
  { grp: 'cyclists', each: 'cyclist', m: 'ride length', unit: 'kilometers' },
  { grp: 'trucks', each: 'truck', m: 'load', unit: 'tons' },
  { grp: 'employees', each: 'employee', m: 'age', unit: 'years' },
  { grp: 'bakers', each: 'baker', m: 'daily output', unit: 'loaves' },
];

export const wpAverageChange: Template<AvgParams> = {
  id: 'alg.word-problems.average-change',
  skill: 'alg.word-problems',
  format: 'ne',
  style: 'how an average changes when a value leaves or joins',
  generate(rng, d) {
    const kind: AvgParams['kind'] = d === 1 ? 'remove' : d === 2 ? 'add' : 'swap';
    const c = rng.pick(CTX);
    for (;;) {
      const n = d === 1 ? rng.int(4, 12) : rng.int(5, d === 2 ? 14 : 15);
      const a = d === 3 ? rng.int(25, 90) : rng.int(30, 90);
      let b = a;
      let u = 0;
      let ans: number;
      if (kind === 'remove') {
        b = a + rng.sign() * rng.int(1, 5);
        ans = n * a - (n - 1) * b;
      } else if (kind === 'add') {
        b = a + rng.sign() * rng.int(1, 6);
        ans = (n + 1) * b - n * a;
      } else {
        u = rng.int(10, 95);
        const v = rng.int(10, 95);
        const tot = n * a - u + 2 * v;
        if (tot % (n + 1) !== 0) continue;
        b = tot / (n + 1);
        ans = v;
      }
      if (b === a || ans < 5 || ans > 150 || (c.cap && ans > c.cap) || (kind === 'swap' && ans === u)) continue;
      const A = frac(ans);
      const cand: { value: Frac; trap: string; why: string }[] =
        kind === 'remove'
          ? [
              { value: frac(2 * a - b), trap: 'algw-avg-gap-unscaled', why: `treats the change of ${Math.abs(a - b)} in the average as the gap between the leaver and the mean, but that gap is shared by ${n - 1} ${c.grp}` },
              { value: frac(n * a - n * b), trap: 'algw-avg-wrong-count', why: `multiplies the new average by ${n} instead of the ${n - 1} ${c.grp} who remain` },
            ]
          : kind === 'add'
            ? [
                { value: frac(2 * b - a), trap: 'algw-avg-gap-unscaled', why: `adds the rise of ${Math.abs(b - a)} to the target only once, but it must cover all ${n} earlier values` },
                { value: frac(n * b - n * a), trap: 'algw-avg-wrong-count', why: `counts only the ${n} earlier values in the new total` },
                { value: frac(b), trap: 'algw-avg-target-as-value', why: 'gives the target average itself' },
              ]
            : [
                { value: frac(2 * ans), trap: 'algw-avg-two-as-one', why: 'is the total added by both newcomers' },
                { value: frac((n + 1) * b - n * a, 2), trap: 'algw-avg-ignored-leaver', why: `forgets that the value ${u} left` },
              ];
      const traps = cand.filter((t, i) => t.value.sign() > 0 && !t.value.eq(A) && t.value.isTerminating() && cand.findIndex((x) => x.value.eq(t.value)) === i);
      const tr = traps[0];
      const X = n * a;
      const grp = c.grp;
      const stem =
        kind === 'remove'
          ? `The average (arithmetic mean) ${c.m} of ${n} ${grp} is ${a} ${c.unit}. One ${c.each} leaves the group, and the average ${c.m} of the ${n - 1} ${grp} who remain is ${b} ${c.unit}. What was the ${c.m} of the departing ${c.each}?`
          : kind === 'add'
            ? `The average (arithmetic mean) ${c.m} of ${n} ${grp} is ${a} ${c.unit}. One more ${c.each} joins the group, and the average ${c.m} of all ${n + 1} ${grp} is then ${b} ${c.unit}. What is the ${c.m} of the new ${c.each}?`
            : `The average (arithmetic mean) ${c.m} of ${n} ${grp} is ${a} ${c.unit}. One ${c.each} with a ${c.m} of ${u} ${c.unit} leaves the group, and two new ${grp} with the same ${c.m} join it. The average ${c.m} of the ${n + 1} ${grp} now in the group is ${b} ${c.unit}. What is the ${c.m} of each new ${c.each}?`;
      const trapText = tr ? `\n\nTrap: ${num(tr.value)} ${tr.why}.` : '';
      const explanation =
        kind === 'remove'
          ? `A change in an average is a change in a total, so rebuild both totals. Before: $${n} \\times ${a} = ${num(X)}$. After: $${n - 1} \\times ${b} = ${num((n - 1) * b)}$. The difference is the value that left, which is the answer: $${num(X)} - ${num((n - 1) * b)} = ${ans}$.\n\nCheck: the others total $${num((n - 1) * b)}$, and ${n - 1} ${grp} with that total average ${b}.${trapText}\n\nRule: average × count gives the total, and the count must match the group you are describing, here ${n - 1} after the change.`
          : kind === 'add'
            ? `Targets for an average are targets for a total. The ${n} ${grp} total $${n} \\times ${a} = ${num(X)}$. To average ${b} with ${n + 1} ${grp}, the total must be $${n + 1} \\times ${b} = ${num((n + 1) * b)}$. The newcomer supplies the difference: $${num((n + 1) * b)} - ${num(X)} = ${ans}$.\n\nCheck: $(${num(X)} + ${ans}) \\div ${n + 1} = ${b}$.${trapText}\n\nRule: new total minus old total is the value that was added, and the new count is one larger than the old.`
            : `Track the total through both changes. Start: $${n} \\times ${a} = ${num(X)}$. The group ends with ${n + 1} ${grp}, so the total is $${n + 1} \\times ${b} = ${num((n + 1) * b)}$. Removing ${u} and adding two equal values $v$ gives $${num(X)} - ${u} + 2v = ${num((n + 1) * b)}$, so $2v = ${num((n + 1) * b - X + u)}$ and $v = ${ans}$.\n\nCheck: $${num(X - u)} + 2 \\times ${ans} = ${num((n + 1) * b)}$.${trapText}\n\nRule: write one total equation with every change in it, then solve for the unknown.`;
      return {
        params: { kind, n, a, b, u },
        q: { format: 'ne', stem, answer: A, suffix: c.unit, traps: traps.map((t) => ({ value: t.value, trap: t.trap })), explanation },
      };
    }
  },
  check(q, { kind, n, a, b, u }) {
    if (q.format !== 'ne') return 'wrong format';
    // Replay the change on an explicit group that has the stated average.
    const v = q.answer;
    let after: Frac[];
    if (kind === 'remove') after = Array.from({ length: n - 1 }, () => frac(n * a).sub(v).div(n - 1));
    else if (kind === 'add') after = [...Array.from({ length: n }, () => frac(a)), v];
    else after = [...Array.from({ length: n - 1 }, () => frac(n * a - u, n - 1)), v, v];
    const avg = after.reduce((s, x) => s.add(x), frac(0)).div(after.length);
    return avg.eq(b) ? null : `average after the change is ${avg}, not ${b}`;
  },
};
