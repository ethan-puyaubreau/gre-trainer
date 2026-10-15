import { Frac } from '../../../engine/frac';
import { gcd } from '../../../engine/math';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { cap, expectMCS, F, numChoices } from './util';

export const ratioPercentTraps: Record<string, Trap> = {
  'rat-pct-change-only': {
    label: 'Used the percent change as the whole ratio',
    fix: '"$25\\%$ greater than" means $100\\% + 25\\% = 125\\%$ of the other quantity, so the ratio is $125 : 100 = 5 : 4$, not $25 : 100$.',
  },
  'rat-pct-wrong-base': {
    label: 'Took the percent of the wrong quantity',
    fix: 'The percent is always of the quantity named after "than". If $x$ is $25\\%$ greater than $y$, then $x = 1.25y$, but $y$ is $20\\%$ (not $25\\%$) less than $x$.',
  },
  'rat-pct-add': {
    label: 'Added percents taken of different quantities',
    fix: 'Successive percent changes multiply: $1.2 \times 0.75 = 0.9$, not $1 + 0.2 - 0.25 = 0.95$. Turn each into a multiplier and multiply.',
  },
};

interface RPParams {
  d: 1 | 2 | 3;
  m1: number;
  m2: number;
  /** numerator and denominator entities of the asked ratio: 0 = X, 1 = Y, 2 = Z */
  ask: [number, number];
  values: Frac[];
}

const CTX = [
  (e: string) => `the population of town ${e}`,
  (e: string) => `the price of item ${e}`,
  (e: string) => `the annual revenue of store ${e}`,
  (e: string) => `the mass of sample ${e}`,
  (e: string) => `the number of members of club ${e}`,
];

const PS = [10, 20, 25, 30, 40, 50, 60, 75, 80];

const percentLink: Template<RPParams> = {
  id: 'arith.ratios.percent-link-mcs',
  skill: 'arith.ratios',
  format: 'mcs',
  style: 'turn "p% more or less than" statements into a ratio',
  generate(rng, d) {
    const np = rng.pick(CTX);
    const [X, Y, Z] = rng.sample(['K', 'L', 'M', 'N', 'P', 'R', 'S', 'T'], 3);
    for (;;) {
      const p = rng.pick(PS);
      const q = rng.pick(PS);
      const up1 = rng.chance(0.6);
      const up2 = rng.chance(0.4);
      const m1 = 100 + (up1 ? p : -p);
      const m2 = 100 + (up2 ? q : -q);
      if (d === 1 && p > 60) continue;
      if (100 + (up1 ? p : -p) + (up2 ? q : -q) <= 0) continue;
      // asked ratio, first entity to second
      const rev = rng.chance(0.5);
      const ask: [number, number] = d === 1 ? (rev ? [1, 0] : [0, 1]) : d === 2 ? (rev ? [2, 0] : [0, 2]) : rev ? [2, 1] : [1, 2];
      // X = m1 Y; (d2) Y = m2 Z; (d3) Z = m2 X
      const amt: Frac[] = d === 1 ? [F(m1, 100), F(1), F(0)] : d === 2 ? [F(m1 * m2, 10000), F(m2, 100), F(1)] : [F(m1, 100), F(1), F(m1 * m2, 10000)];
      const ans = amt[ask[0]].div(amt[ask[1]]);
      if (ans.eq(1) || ans.n > 400 || ans.d > 400) continue;
      const shape = (a: number, b: number) => F(a, b);
      const traps: { value: Frac; trap: string }[] = [{ value: ans.inv(), trap: 'num-ratio-order' }];
      // the percent change alone, as a ratio to 100
      if (d === 1) {
        traps.push({ value: shape(p, 100), trap: 'rat-pct-change-only' });
        traps.push({
          value: shape(100, 100 + (up1 ? -p : p)),
          trap: 'rat-pct-wrong-base',
        });
      } else if (d === 2) {
        traps.push({
          value: shape(100 + (up1 ? p : -p) + (up2 ? q : -q), 100),
          trap: 'rat-pct-add',
        });
        traps.push({ value: shape(m1, m2), trap: 'rat-pct-wrong-base' });
      } else {
        traps.push({
          value: shape(100, 100 + (up1 ? p : -p) + (up2 ? q : -q)),
          trap: 'rat-pct-add',
        });
        traps.push({
          value: shape(10000, m2 * (100 + (up1 ? -p : p))),
          trap: 'rat-pct-wrong-base',
        });
      }
      const wantRev = ask[0] > ask[1];
      // canonical traps above are for the direction X to Y, X to Z, Y to Z
      // a trap on the wrong side of the order is the same mistake read the other way round
      const fixed = traps.map((t) => (t.trap === 'num-ratio-order' ? t : { ...t, value: wantRev ? t.value.inv() : t.value }));
      if (fixed.some((t) => t.value.eq(ans) || t.value.n > 1000 || t.value.d > 1000)) continue;
      const fmt = (v: Frac) => `$${v.n} \\text{ to } ${v.d}$`;
      const fillers = [
        [ans.n + 1, ans.d],
        [ans.n, ans.d + 1],
        [ans.n + 2, ans.d],
        [ans.n, ans.d + 2],
      ]
        .map(([a, b]) => F(a, b))
        .filter((f) => !f.eq(1));
      const { choices, answer, values } = numChoices(rng, {
        correct: ans,
        traps: fixed,
        fillers,
        format: fmt,
        order: 'shuffled',
      });
      const shown = (v: Frac) => !v.eq(ans) && values.some((w) => w.eq(v));
      const name = [X, Y, Z];
      const rel = (a: string, b: string, mm: number, pp: number) => `${cap(np(a))} is ${pp}% ${mm > 100 ? 'greater' : 'less'} than ${np(b)}.`;
      const sentences = d === 1 ? rel(X, Y, m1, p) : d === 2 ? `${rel(X, Y, m1, p)} ${rel(Y, Z, m2, q)}` : `${rel(X, Y, m1, p)} ${rel(Z, X, m2, q)}`;
      const stem = `${sentences} What is the ratio of ${np(name[ask[0]])} to ${np(name[ask[1]])}?`;
      const how =
        d === 1
          ? `Take ${np(Y)} as 100. Then ${np(X)} is $${m1}\\%$ of it, that is $${m1}$.`
          : d === 2
            ? `Take ${np(Z)} as 10,000. Then ${np(Y)} is $${m2}\\%$ of it, that is $${num(m2 * 100)}$, and ${np(X)} is $${m1}\\%$ of ${np(Y)}, that is $${num(m1 * m2)}$.`
            : `Take ${np(Y)} as 10,000. Then ${np(X)} is $${m1}\\%$ of it, that is $${num(m1 * 100)}$, and ${np(Z)} is $${m2}\\%$ of ${np(X)}, that is $${num(m1 * m2)}$.`;
      const A = d === 1 ? [m1, 100, 0] : d === 2 ? [m1 * m2, m2 * 100, 10000] : [m1 * 100, 10000, m1 * m2];
      const ratioNums = `$${num(A[ask[0]])} : ${num(A[ask[1]])}$`;
      const slips = [
        shown(fixed[1].value) && d === 1
          ? `$${p} : 100$ uses only the change and forgets the $100\\%$ that is already there`
          : shown(fixed[1].value)
            ? `adding the percents ignores that the second percent is taken of a different quantity`
            : '',
        shown(fixed[2].value) ? `reading the percent from the other quantity's point of view changes the base` : '',
        shown(fixed[0].value) ? `the order of the ratio is reversed` : '',
      ].filter(Boolean);
      return {
        params: { d, m1, m2, ask, values },
        q: {
          format: 'mcs',
          stem,
          choices,
          answer,
          explanation: `Recognize: "p% greater or less than" compares with the quantity named after "than", so give that quantity a convenient size and compute the other.

${how} The asked ratio is ${ratioNums}${gcd(A[ask[0]], A[ask[1]]) > 1 ? ` $= ${ans.n} : ${ans.d}$` : ''}.

Check: $${ans.n}$ and $${ans.d}$ have no common factor left, so the ratio is in lowest terms.

Trap: ${slips.length ? slips.slice(0, 2).join('; ') : 'the percent is of the quantity after "than"'}. Percent statements chain by multiplying.`,
        },
      };
    }
  },
  check(q, { d, m1, m2, ask, values }) {
    // Integer amounts: start from 10,000 of the base entity and apply each percent in whole numbers.
    const amt = d === 1 ? [m1 * 100, 10000, 0] : d === 2 ? [(m1 * m2) / 1, m2 * 100, 10000] : [m1 * 100, 10000, (m1 * m2) / 1];
    const N = amt[ask[0]];
    const M = amt[ask[1]];
    const hits = values.flatMap((v, i) => (v.n * M === v.d * N ? [i] : []));
    return expectMCS(q, hits.length === 1 ? hits[0] : -1);
  },
};

export const ratioPercentTemplates: Template<any>[] = [percentLink];
