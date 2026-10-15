import { numericChoices } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { usd } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { fTex } from './util';

export const weightedTransferTraps: Record<string, Trap> = {
  'stat-move-old-count': {
    label: 'Divided by the old number of members',
    fix: 'After a member joins, the group has one more member; after one leaves, one fewer. Divide the new total by the new count.',
  },
  'stat-move-avg-of-two': {
    label: 'Averaged the old average with the moved value',
    fix: 'The moved value is one member among many, so it has weight 1 against the whole group. Use totals.',
  },
  'stat-move-other-group': {
    label: 'Found the average of the group that was not asked about',
    fix: 'Check which group the question names: the one that gains the member or the one that loses it.',
  },
  'stat-move-unchanged': {
    label: 'Said the average stays the same',
    fix: 'The average stays the same only when the moved value equals the average.',
  },
  'stat-move-direction': {
    label: 'Added the moved value to the group that lost it',
    fix: 'A member who leaves takes the value out of the total; a member who joins puts it in.',
  },
  'stat-move-not-scaled': {
    label: 'Took the rise in the average as the change in the value',
    fix: 'A rise of r in the average of n members means the total rose by n × r.',
  },
  'stat-move-new-avg-as-value': {
    label: 'Gave the new average where the moved value was asked',
    fix: 'The moved value is further from the old average than the new average is, because it is spread over the whole group.',
  },
  'stat-move-stopped-early': {
    label: 'Stopped after finding the moved value',
    fix: 'Finding the moved value is only the first step; then add it to the other group and divide by the new count.',
  },
  'stat-move-count-forgotten': {
    label: 'Forgot that the group changed size when finding the moved value',
    fix: 'The old total is average × old count, the new total is average × new count; their difference is the moved value.',
  },
};

type Mode = 'q-after' | 'p-after' | 'find-score' | 'chain';

interface Params {
  mode: Mode;
  n: number;
  m: number;
  a: number;
  b: number;
  s: number;
  /** p-after average (chain) or the rise of Q's average (find-score) */
  x: Frac;
  money: boolean;
}

const CTX = [
  {
    P: 'Class P',
    Q: 'Class Q',
    members: 'students',
    one: 'student',
    what: 'average (arithmetic mean) score',
    moved: (s: string) => `One student with a score of ${s} transfers from Class P to Class Q.`,
    money: false,
    lo: 45,
    hi: 98,
  },
  {
    P: 'Department P',
    Q: 'Department Q',
    members: 'employees',
    one: 'employee',
    what: 'average (arithmetic mean) hourly wage',
    moved: (s: string) => `One employee who earns ${s} per hour moves from Department P to Department Q.`,
    money: true,
    lo: 14,
    hi: 60,
  },
  {
    P: 'Shipment P',
    Q: 'Shipment Q',
    members: 'crates',
    one: 'crate',
    what: 'average (arithmetic mean) weight, in kilograms,',
    moved: (s: string) => `One crate weighing ${s} kilograms is moved from Shipment P to Shipment Q.`,
    money: false,
    lo: 12,
    hi: 90,
  },
];

const transferMcs: Template<Params> = {
  id: 'data.weighted.member-transfer',
  skill: 'data.weighted',
  format: 'mcs',
  style: 'one member moves from one group to another: update both totals and counts',
  generate(rng, d) {
    const ctx = rng.pick(CTX);
    const mode: Mode = d === 1 ? 'q-after' : d === 2 ? rng.pick(['p-after', 'q-after', 'find-score']) : rng.pick(['chain', 'chain', 'find-score']);
    const val = (x: number) => (ctx.money ? usd(x) : String(x));
    const fmt = (v: Frac) => (ctx.money ? usd(v.toNumber(), v.isInt() ? undefined : 2) : `$${fTex(v)}$`);
    for (;;) {
      const n = rng.int(d === 1 ? 6 : 8, d === 3 ? 30 : 20);
      const m = rng.int(d === 1 ? 6 : 8, d === 3 ? 30 : 20);
      const a = rng.int(ctx.lo, ctx.hi);
      const b = rng.int(ctx.lo, ctx.hi);
      const s = rng.int(ctx.lo, ctx.hi);
      if (a === b || s === a || s === b || n === m) continue;
      let right: Frac;
      let x = frac(0);
      let cand: { value: Frac; trap: string }[];
      let ask: string;
      let info: string;
      let steps: string;
      const sTotal = n * a;
      const tTotal = m * b;
      if (mode === 'q-after') {
        right = new Frac(tTotal + s, m + 1);
        cand = [
          { value: new Frac(tTotal + s, m), trap: 'stat-move-old-count' },
          { value: new Frac(b + s, 2), trap: 'stat-move-avg-of-two' },
          { value: new Frac(sTotal - s, n - 1), trap: 'stat-move-other-group' },
          { value: frac(b), trap: 'stat-move-unchanged' },
          { value: new Frac(tTotal - s, m - 1), trap: 'stat-move-direction' },
        ];
        ask = `What is the ${ctx.what} of ${ctx.Q} after the move?`;
        info = `${ctx.P} has ${n} ${ctx.members} with an ${ctx.what.replace('average (arithmetic mean) ', 'average (arithmetic mean) ')} of ${val(a)}, and ${ctx.Q} has ${m} ${ctx.members} with an average of ${val(b)}. ${ctx.moved(val(s))}`;
        steps = `${ctx.Q} now has $${m} + 1 = ${m + 1}$ ${ctx.members}. Its total was $${m} \\times ${b} = ${tTotal}$ and becomes $${tTotal} + ${s} = ${tTotal + s}$. The new average is $${tTotal + s} \\div ${m + 1} = ${fTex(right)}$.`;
      } else if (mode === 'p-after') {
        right = new Frac(sTotal - s, n - 1);
        cand = [
          { value: new Frac(sTotal - s, n), trap: 'stat-move-old-count' },
          { value: new Frac(sTotal + s, n + 1), trap: 'stat-move-direction' },
          { value: new Frac(tTotal + s, m + 1), trap: 'stat-move-other-group' },
          { value: frac(a), trap: 'stat-move-unchanged' },
        ];
        ask = `What is the ${ctx.what} of ${ctx.P} after the move?`;
        info = `${ctx.P} has ${n} ${ctx.members} with an ${ctx.what} of ${val(a)}, and ${ctx.Q} has ${m} ${ctx.members} with an average of ${val(b)}. ${ctx.moved(val(s))}`;
        steps = `${ctx.P} now has $${n} - 1 = ${n - 1}$ ${ctx.members}. Its total was $${n} \\times ${a} = ${sTotal}$ and becomes $${sTotal} - ${s} = ${sTotal - s}$. The new average is $${sTotal - s} \\div ${n - 1} = ${fTex(right)}$.`;
      } else if (mode === 'find-score') {
        const r = rng.pick([1, 2, 3, 4, 5]) * rng.sign();
        const sc = b + r * (m + 1);
        if (sc < ctx.lo - 10 || sc > ctx.hi + 30 || sc <= 0) continue;
        x = frac(r);
        right = frac(sc);
        cand = [
          { value: frac(b + r * m), trap: 'stat-move-old-count' },
          { value: frac(r > 0 ? b + r : b + r), trap: 'stat-move-new-avg-as-value' },
          { value: frac(b + r * (m + 2)), trap: 'stat-move-count-forgotten' },
          { value: frac(r * (m + 1)), trap: 'stat-move-not-scaled' },
          { value: frac(b - r * (m + 1)), trap: 'stat-move-direction' },
        ];
        ask = `What was the ${ctx.one === 'crate' ? 'weight' : ctx.money ? 'hourly wage' : 'score'} of the ${ctx.one} ${ctx.one === 'crate' ? 'that' : 'who'} moved?`;
        info = `${ctx.P} has ${n} ${ctx.members}, and ${ctx.Q} has ${m} ${ctx.members} with an ${ctx.what} of ${val(b)}. One ${ctx.one} moves from ${ctx.P} to ${ctx.Q}, and the ${ctx.what} of ${ctx.Q} then ${r > 0 ? 'rises' : 'falls'} by ${val(Math.abs(r))}.`;
        steps = `${ctx.Q} now has $${m + 1}$ ${ctx.members} and its average moved by $${r}$, so its total moved by $${m + 1} \\times ${r} = ${(m + 1) * r}$ from $${tTotal}$. The new total is $${(m + 1) * (b + r)}$, and the moved value is the difference: $${(m + 1) * (b + r)} - ${tTotal} = ${sc}$.`;
      } else {
        // chain: the average of P changes; find the moved value, then the new average of Q
        const a2 = rng.int(ctx.lo, ctx.hi);
        const moved = sTotal - (n - 1) * a2;
        if (a2 === a || moved < ctx.lo - 10 || moved > ctx.hi + 30 || moved <= 0 || moved === b) continue;
        x = frac(a2);
        right = new Frac(tTotal + moved, m + 1);
        const forgotten = n * (a - a2);
        cand = [
          { value: frac(moved), trap: 'stat-move-stopped-early' },
          { value: new Frac(tTotal + moved, m), trap: 'stat-move-old-count' },
          { value: new Frac(b + moved, 2), trap: 'stat-move-avg-of-two' },
          { value: new Frac(tTotal + forgotten, m + 1), trap: 'stat-move-count-forgotten' },
          { value: frac(b), trap: 'stat-move-unchanged' },
        ];
        ask = `What is the ${ctx.what} of ${ctx.Q} after the move?`;
        info = `${ctx.P} has ${n} ${ctx.members} with an ${ctx.what} of ${val(a)}, and ${ctx.Q} has ${m} ${ctx.members} with an average of ${val(b)}. One ${ctx.one} moves from ${ctx.P} to ${ctx.Q}. Afterwards the ${ctx.what} of ${ctx.P} is ${val(a2)}.`;
        steps = `${ctx.P} had a total of $${n} \\times ${a} = ${sTotal}$ and now has $${n - 1} \\times ${a2} = ${(n - 1) * a2}$, so the ${ctx.one} ${ctx.one === 'crate' ? 'that' : 'who'} moved ${ctx.one === 'crate' ? 'weighs' : 'has'} $${sTotal} - ${(n - 1) * a2} = ${moved}$. Then ${ctx.Q} goes from $${m} \\times ${b} = ${tTotal}$ to $${tTotal} + ${moved} = ${tTotal + moved}$ over $${m + 1}$ ${ctx.members}: $${tTotal + moved} \\div ${m + 1} = ${fTex(right)}$.`;
      }
      if (!right.mul(100).isInt() || right.lte(0)) continue;
      cand = cand.filter((c) => c.value.mul(100).isInt() && c.value.gt(0));
      const ch = numericChoices(rng, {
        correct: right,
        traps: cand,
        format: fmt,
        step: mode === 'find-score' ? Math.max(3, Math.round(right.toNumber() / 8)) : Math.max(2, Math.round(right.toNumber() / 12)),
      });
      if (ch.choices.filter((c) => c.trap).length < 3) continue;
      const used = rng.pick(ch.choices.filter((c) => c.trap));
      const usedV = cand.find((c) => c.trap === used.trap)!.value;
      const trapText: Record<string, string> = {
        'stat-move-old-count': `Dividing by the old count gives $${fTex(usedV)}$, but the group size changed.`,
        'stat-move-avg-of-two': `Averaging the old average with the moved value gives $${fTex(usedV)}$, which gives one member as much weight as the whole group.`,
        'stat-move-other-group': `Updating the other group gives $${fTex(usedV)}$, which is not the group asked about.`,
        'stat-move-unchanged': `Keeping the old average gives $${fTex(usedV)}$, but the moved value is not equal to the average.`,
        'stat-move-direction': `Putting the value on the wrong side of the total gives $${fTex(usedV)}$.`,
        'stat-move-not-scaled': `Using the change in the average as the value gives $${fTex(usedV)}$, but the total moved by the change times the count.`,
        'stat-move-new-avg-as-value': `Using the new average gives $${fTex(usedV)}$, but one member must move the whole total.`,
        'stat-move-stopped-early': `The moved value, $${fTex(usedV)}$, is only the first step.`,
        'stat-move-count-forgotten': `Ignoring the change in group size gives $${fTex(usedV)}$.`,
      };
      return {
        params: { mode, n, m, a, b, s, x, money: ctx.money },
        q: {
          format: 'mcs',
          stem: `${info}

${ask}`,
          choices: ch.choices,
          answer: ch.answer,
          explanation: `A member who moves changes two totals and two counts, so work with totals (average times count).

${steps}

Check: the combined total of the two groups is unchanged by the move.

Trap: ${trapText[used.trap!]}

Rule: new average = new total ÷ new count; a move changes both totals and both counts.`,
        },
      };
    }
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'wrong format';
    // explicit lists: the moved member plus the other members (all equal to the leftover share)
    const group = (count: number, avg: number, mover: Frac) => {
      const rest = new Frac(count * avg).sub(mover).div(count - 1);
      return [mover, ...Array.from({ length: count - 1 }, () => rest)];
    };
    const mean = (xs: Frac[]) => xs.reduce((t, v) => t.add(v), frac(0)).div(xs.length);
    let expected: Frac;
    if (p.mode === 'find-score') {
      // try the keyed value: moving it must change Q's mean by x
      const keyed = q.choices[q.answer].text.replace(/\\\$|\$|\{,\}/g, '');
      const sc = new Frac(Math.round(parseFloat(keyed) * 100), 100);
      const Q = [...Array.from({ length: p.m }, () => frac(p.b)), sc];
      return mean(Q).sub(p.b).eq(p.x) ? null : `moving ${keyed} changes the mean by ${mean(Q).sub(p.b)}, not ${p.x}`;
    }
    if (p.mode === 'chain') {
      const moved = new Frac(p.n * p.a).sub(new Frac(p.n - 1).mul(p.x));
      const P = group(p.n, p.a, moved);
      if (!mean(P.slice(1)).eq(p.x)) return 'P after the move does not match';
      expected = mean([...Array.from({ length: p.m }, () => frac(p.b)), moved]);
    } else if (p.mode === 'q-after') {
      expected = mean([...Array.from({ length: p.m }, () => frac(p.b)), frac(p.s)]);
    } else {
      expected = mean(group(p.n, p.a, frac(p.s)).slice(1));
    }
    const keyed = q.choices[q.answer].text;
    const shown = p.money ? usd(expected.toNumber(), expected.isInt() ? undefined : 2) : `$${fTex(expected)}$`;
    return keyed === shown ? null : `expected ${shown}, keyed ${keyed}`;
  },
};

export const weightedTransferTemplates: Template<any>[] = [transferMcs];
