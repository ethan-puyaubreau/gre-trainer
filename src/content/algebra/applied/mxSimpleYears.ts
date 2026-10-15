import { Frac, frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { choiceValuesMatch, dx, expectMcs, money, NAMES, trapChoices, uniqueIndex } from './util';

// alg.mixtures-interest: how many years of simple interest until a balance reaches a target or another balance (select one).

export const mxSimpleYearsTraps: Record<string, Trap> = {
  'algw-balance-not-interest': {
    label: 'Used the target balance as if it were the interest',
    fix: 'The balance includes the principal. The interest needed is target balance $-$ principal.',
  },
  'algw-one-principal-only': {
    label: 'Found the years to earn the principal once instead of the multiple asked',
    fix: 'To reach $k$ times the deposit, the interest must be $k - 1$ times the deposit, so the years are $\\frac{(k - 1) \\cdot 100}{r}$.',
  },
  'algw-principal-ignored': {
    label: 'Divided by the rate alone and ignored the principal',
    fix: 'The yearly interest is the rate times the principal, not the rate alone. Divide the interest needed by that amount.',
  },
  'algw-percent-instead-of-years': {
    label: 'Gave the total percent growth instead of the number of years',
    fix: 'Total growth in percent is rate times years. Divide it by the yearly rate to get the years.',
  },
  'algw-gave-rate': {
    label: 'Gave the rate, a number already in the problem',
    fix: 'Reread what is asked: the number of years, which is the interest needed divided by the interest earned each year.',
  },
  'algw-catchup-same-principal': {
    label: 'Gave both accounts the smaller principal when closing the gap',
    fix: 'Each account grows by its own principal times its rate. Write both balances: $P_1(1 + r_1 n)$ and $P_2(1 + r_2 n)$.',
  },
  'algw-catchup-rate-diff': {
    label: 'Applied the difference of the rates to one principal',
    fix: 'The accounts have different principals, so the gap closes by $P_2 r_2 - P_1 r_1$ per year, not by $(r_2 - r_1)$ times one principal.',
  },
  'algw-catchup-small-principal': {
    label: 'Closed the gap with the rate difference on the smaller principal',
    fix: 'The larger account also earns interest while the smaller one catches up. Use each account\'s own interest per year.',
  },
};

interface YearsParams {
  kind: 'multiple' | 'target' | 'catchup';
  P: number;
  r: number;
  k: number;
  B: number;
  P2: number;
  r2: number;
  n: number;
  values: Frac[];
}

const MULT = ['', '', 'doubles', 'triples', 'quadruples'];
const fmt = (v: Frac) => `$${dx(v)}$`;

export const mxSimpleYears: Template<YearsParams> = {
  id: 'alg.mixtures-interest.simple-years',
  skill: 'alg.mixtures-interest',
  format: 'mcs',
  style: 'years of simple interest to reach a target or to catch up',
  generate(rng, d) {
    const kind: YearsParams['kind'] = d === 1 ? 'multiple' : d === 2 ? 'target' : 'catchup';
    const nm = rng.pick(NAMES);
    for (;;) {
      let correct: number;
      let cands: { value: number | Frac; trap: string; why: string }[];
      let stem: string;
      let body: string;
      let checkText: string;
      let p: Omit<YearsParams, 'values'>;
      const base = { P: 0, r: 0, k: 0, B: 0, P2: 0, r2: 0, n: 0 };
      if (kind === 'multiple') {
        const r = rng.pick([2, 4, 5, 8, 10, 20, 25]);
        const k = rng.int(2, 4);
        const P = rng.int(2, 20) * 500;
        const off = rng.sign();
        if (((k - 1) * 100) % r !== 0) continue;
        correct = ((k - 1) * 100) / r;
        if (correct < 2 || correct > 60) continue;
        cands = [
          { value: (k * 100) / r, trap: 'algw-balance-not-interest', why: `uses ${k} times the principal as the interest` },
          { value: (k - 1) * r, trap: 'algw-percent-not-decimal', why: 'multiplies by the rate instead of dividing' },
          { value: correct + off, trap: 'algw-years-off-by-one', why: off < 0 ? 'stops one year too early' : 'goes one year too far' },
          { value: 100 / r, trap: 'algw-one-principal-only', why: `earns the principal only once, not ${k - 1} times` },
        ];
        p = { ...base, kind, P, r, k };
        checkText = `${correct} years � ${money(frac(P * r, 100))} a year = ${money(correct * P * r / 100)}, which is ${k - 1 === 1 ? 'the deposit' : `${k - 1} times the deposit`}.`;
        stem = `${nm} deposits ${money(P)} in an account that pays ${r} percent simple annual interest. If no deposits or withdrawals are made, in how many years will the balance of the account be ${k === 2 ? 'double' : k === 3 ? 'triple' : 'four times'} the original deposit?`;
        body = `Simple interest adds the same amount every year: ${r} percent of ${money(P)} is ${money(frac(P * r, 100))}. To ${MULT[k].slice(0, -1)} the deposit, the balance must grow by ${k === 2 ? 'the whole deposit' : `${k - 1} times the deposit`}, so the interest needed is ${money((k - 1) * P)}. Each year brings ${r} percent of the deposit, so $n = \\frac{${(k - 1) * 100}}{${r}} = ${correct}$ years.`;
      } else if (kind === 'target') {
        const r = rng.int(2, 10);
        const n = rng.int(3, 25);
        const off = rng.sign();
        const P = rng.int(2, 10) * 100;
        const B = (P * (100 + n * r)) / 100;
        if (!Number.isInteger(B)) continue;
        correct = n;
        cands = [
          { value: (B * 100) / (P * r), trap: 'algw-balance-not-interest', why: 'treats the whole target balance as interest' },
          { value: n + off, trap: 'algw-years-off-by-one', why: off < 0 ? 'stops one year too early' : 'goes one year too far' },
          { value: (B - P) / r, trap: 'algw-principal-ignored', why: 'divides the interest needed by the rate alone' },
          { value: n * r, trap: 'algw-percent-instead-of-years', why: 'is the total percent growth of the balance, not a number of years' },
          { value: r, trap: 'algw-gave-rate', why: 'is the rate, a number already in the problem' },
        ];
        p = { ...base, kind, P, r, B, n };
        checkText = `${n} years � ${money(frac(P * r, 100))} a year = ${money(B - P)}, and ${money(P)} + ${money(B - P)} = ${money(B)}.`;
        stem = `${nm} opens an account with ${money(P)} at ${r} percent simple annual interest and makes no deposits or withdrawals. After how many years will the balance reach ${money(B)}?`;
        body = `The account must earn ${money(B)} − ${money(P)} = ${money(B - P)} in interest. Each year it earns ${r} percent of ${money(P)}, which is ${money(frac(P * r, 100))}. The number of years is $${num(B - P)} \\div ${num(frac(P * r, 100))} = ${n}$.`;
      } else {
        const off = rng.sign();
        let found = false;
        let P1 = 0;
        let P2 = 0;
        let r1 = 0;
        let r2 = 0;
        let n = 0;
        for (let t = 0; t < 200 && !found; t++) {
          P1 = rng.int(6, 20) * 500;
          P2 = P1 - rng.int(1, 8) * 500;
          r1 = rng.int(2, 6);
          r2 = r1 + rng.int(1, 6);
          const den = P2 * r2 - P1 * r1;
          if (P2 < 1000 || den <= 0 || (100 * (P1 - P2)) % den !== 0) continue;
          n = (100 * (P1 - P2)) / den;
          if (n >= 2 && n <= 40) found = true;
        }
        if (!found) continue;
        correct = n;
        cands = [
          { value: frac(100 * (P1 - P2), P2 * r2), trap: 'algw-catchup-same-principal', why: `lets the ${money(P2)} account alone close the gap, ignoring the other account's interest` },
          { value: frac(100 * (P1 - P2), P1 * (r2 - r1)), trap: 'algw-catchup-rate-diff', why: `applies the ${r2 - r1} point difference in rates to ${money(P1)}` },
          { value: frac(100 * (P1 - P2), P2 * (r2 - r1)), trap: 'algw-catchup-small-principal', why: `applies the ${r2 - r1} point difference in rates to ${money(P2)}` },
          { value: n + off, trap: 'algw-years-off-by-one', why: off < 0 ? 'stops one year too early' : 'goes one year too far' },
        ];
        p = { ...base, kind, P: P1, r: r1, P2, r2, n };
        checkText = `after ${n} years the first balance is ${money(P1 + (P1 * r1 * n) / 100)} and the second is ${money(P2 + (P2 * r2 * n) / 100)}.`;
        stem = `${nm} has two accounts that pay simple annual interest and receive no deposits or withdrawals. One starts with ${money(P1)} and pays ${r1} percent; the other starts with ${money(P2)} and pays ${r2} percent. After how many years will the two balances be equal?`;
        body = `Each year an account gains its rate times its principal. First balance: $${num(P1)} + ${num(frac(P1 * r1, 100))}n$. Second balance: $${num(P2)} + ${num(frac(P2 * r2, 100))}n$. Setting them equal, $${num(P1 - P2)} = ${num(frac(P2 * r2 - P1 * r1, 100))}n$, so $n = ${num(frac(100 * (P1 - P2), P2 * r2 - P1 * r1))}$ years.`;
      }
      const res = trapChoices(
        rng,
        correct!,
        cands!
          .map((x) => ({ ...x, value: x.value instanceof Frac ? x.value : Number.isInteger(x.value) ? frac(x.value) : frac(-1) }))
          .filter((x) => x.value.gt(1) && x.value.lte(400) && x.value.mul(10).isInt()),
        fmt,
      );
      if (!res) continue;
      const order = rng.shuffle(res.choices.map((_, i) => i));
      const choices = order.map((i) => res.choices[i]);
      const answer = order.indexOf(res.answer);
      const values = order.map((i) => res.values[i]);
      const kept = res.kept[0] as unknown as { why: string; value: Frac };
      return {
        params: { ...p!, values },
        q: {
          format: 'mcs',
          stem: stem!,
          choices,
          answer,
          explanation: `${body!}

Check: ${checkText!}

Trap: ${dx(kept.value)} years ${kept.why}. Rule: with simple interest the yearly gain never changes, so divide the growth you need by the growth per year, and write both balances when two accounts are compared.`,
        },
      };
    }
  },
  check(q, { kind, P, r, k, B, P2, r2, values }) {
    const err = choiceValuesMatch(q, values, fmt);
    if (err) return err;
    // Year-by-year simulation of the balances.
    let want = 0;
    if (kind === 'catchup') {
      let a = frac(P);
      let b = frac(P2);
      while (a.gt(b) && want < 500) {
        a = a.add(frac(P * r, 100));
        b = b.add(frac(P2 * r2, 100));
        want++;
      }
      if (!a.eq(b)) return 'the balances never meet exactly';
    } else {
      let bal = frac(P);
      const goal = kind === 'multiple' ? frac(P * k) : frac(B);
      while (bal.lt(goal) && want < 500) {
        bal = bal.add(frac(P * r, 100));
        want++;
      }
      if (!bal.eq(goal)) return 'the balance never lands on the target';
    }
    return expectMcs(q, uniqueIndex(values, (v) => v.eq(want)));
  },
};
