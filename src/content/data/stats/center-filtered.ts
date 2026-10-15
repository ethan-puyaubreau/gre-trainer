import { Frac, frac } from '../../../engine/frac';
import type { Template, Trap } from '../../../engine/types';
import { fTex } from './util';

export const centerFilteredTraps: Record<string, Trap> = {
  'stat-filter-endpoints': {
    label: 'Averaged the ends of the range instead of the first and last members',
    fix: 'The ends of the range need not belong to the list. Find the first and last integers that really qualify, then average those.',
  },
  'stat-filter-range-end': {
    label: 'Used one end of the range as the first or last member',
    fix: 'Check each end: it counts only if it has the stated property (a multiple of m, remainder r).',
  },
  'stat-filter-count-off': {
    label: 'Counted the members off by one',
    fix: 'The number of members from first to last in steps of m is (last - first) / m + 1, counting both ends.',
  },
  'stat-filter-mean-as-sum': {
    label: 'Gave the average when the sum was asked',
    fix: 'Sum = average × number of members. Count the members and multiply.',
  },
  'stat-filter-sum-as-mean': {
    label: 'Gave the sum when the average was asked',
    fix: 'The average is the sum divided by the number of members.',
  },
};

interface Params {
  lo: number;
  hi: number;
  m: number;
  r: number;
  ask: 'mean' | 'sum';
  exclusive: boolean;
}

const brute = (p: Params) => {
  let sum = 0;
  let count = 0;
  for (let x = p.lo + (p.exclusive ? 1 : 0); x <= p.hi - (p.exclusive ? 1 : 0); x++)
    if (((x % p.m) + p.m) % p.m === p.r) {
      sum += x;
      count++;
    }
  return { sum, count };
};

const filteredNE: Template<Params> = {
  id: 'data.center.evenly-spaced-subset',
  skill: 'data.center',
  format: 'ne',
  style: 'average or sum of the integers in a range with a divisibility property: first and last member',
  generate(rng, d) {
    for (;;) {
      const m = rng.int(d === 1 ? 3 : 4, d === 1 ? 9 : 14);
      const r = d === 3 ? rng.int(1, m - 1) : 0;
      const lo = d === 1 ? 1 : rng.int(5, 120);
      const hi = lo + rng.int(d === 1 ? 5 * m : 6 * m, d === 1 ? 40 * m : 25 * m) + rng.int(0, m - 1);
      const exclusive = d >= 2 && rng.chance(0.5);
      const ask: Params['ask'] = d === 3 && rng.chance(0.6) ? 'sum' : 'mean';
      const p: Params = { lo, hi, m, r, ask, exclusive };
      const a = lo + (exclusive ? 1 : 0);
      const b = hi - (exclusive ? 1 : 0);
      const first = a + ((r - (a % m) + m) % m);
      const last = b - (((b % m) - r + m) % m);
      const count = (last - first) / m + 1;
      if (count < 5) continue;
      const mean = new Frac(first + last, 2);
      const answer = ask === 'mean' ? mean : frac(count).mul(mean);
      if (answer.lte(1)) continue;
      const endsMean = new Frac(lo + hi, 2);
      if (endsMean.eq(mean) || first === lo || last === hi) continue; // the ends must be a real trap
      const traps: { value: Frac; trap: string }[] =
        ask === 'mean'
          ? [
              { value: endsMean, trap: 'stat-filter-endpoints' },
              { value: frac(count).mul(mean), trap: 'stat-filter-sum-as-mean' },
              { value: new Frac(first + hi, 2), trap: 'stat-filter-range-end' },
            ]
          : [
              { value: frac(count).mul(endsMean), trap: 'stat-filter-endpoints' },
              { value: mean, trap: 'stat-filter-mean-as-sum' },
              { value: frac(count + 1).mul(mean), trap: 'stat-filter-count-off' },
              { value: frac(count - 1).mul(mean), trap: 'stat-filter-count-off' },
            ];
      const seen = new Set<string>();
      const kept = traps.filter((t) => !t.value.eq(answer) && !seen.has(t.value.toString()) && !!seen.add(t.value.toString()));
      const prop = r === 0 ? `multiples of ${m}` : `leave a remainder of ${r} when divided by ${m}`;
      const range = exclusive ? `greater than ${lo} and less than ${hi}` : `from ${lo} to ${hi}, inclusive,`;
      const set =
        r === 0
          ? `the integers ${range} that are ${prop}`
          : `the integers ${range} that ${prop}`;
      const what = ask === 'mean' ? 'average (arithmetic mean)' : 'sum';
      const edge = exclusive ? `${lo} and ${hi} themselves are excluded` : `the ends of the range, ${lo} and ${hi}, are not members`;
      const member = (x: number) => (r === 0 ? `${x} = ${m} \\times ${x / m}` : `${x} = ${m} \\times ${(x - r) / m} + ${r}`);
      const shownTrap = kept[0];
      const trapLine =
        shownTrap.trap === 'stat-filter-endpoints'
          ? `Averaging the ends of the range gives $${fTex(shownTrap.value)}$, but ${lo} and ${hi} ${exclusive ? 'are excluded' : 'are not members'}.`
          : shownTrap.trap === 'stat-filter-range-end'
            ? `Pairing the first member with ${hi} gives $${fTex(shownTrap.value)}$, but ${hi} ${exclusive ? 'is excluded' : 'is not a member'}.`
            : shownTrap.trap === 'stat-filter-sum-as-mean'
              ? `The sum, $${fTex(shownTrap.value)}$, is not an average.`
              : shownTrap.trap === 'stat-filter-mean-as-sum'
                ? `The average alone, $${fTex(shownTrap.value)}$, is not the sum.`
                : `Counting ${shownTrap.value.eq(frac(count + 1).mul(mean)) ? 'one member too many' : 'one member too few'} gives $${fTex(shownTrap.value)}$.`;
      return {
        params: p,
        q: {
          format: 'ne',
          stem: `What is the ${what} of ${set}?`,
          answer,
          traps: kept,
          explanation: `The qualifying integers are evenly spaced, so their average is the average of the first and the last.

The first member is $${member(first)}$ and the last is $${member(last)}$ (${edge}). Their average is $(${first} + ${last}) \\div 2 = ${fTex(mean)}$.${
            ask === 'sum' ? `

There are $(${last} - ${first}) \\div ${m} + 1 = ${count}$ members, so the sum is $${count} \\times ${fTex(mean)} = ${fTex(answer)}$.` : ''
          }

Check: the members are ${first}, ${first + m}, ${first + 2 * m}, ... ${last - m}, ${last}; the first and the last pair up to ${first + last}.

Trap: ${trapLine}

Rule: for an evenly spaced list, average = (first + last) / 2; sum = average × count.`,
        },
      };
    }
  },
  check(q, p) {
    if (q.format !== 'ne') return 'wrong format';
    const { sum, count } = brute(p);
    const expected = p.ask === 'sum' ? frac(sum) : new Frac(sum, count);
    return q.answer.eq(expected) ? null : `expected ${expected}`;
  },
};

export const centerFilteredTemplates: Template<any>[] = [filteredNE];
