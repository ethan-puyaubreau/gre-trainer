import { Frac } from '../../../engine/frac';
import { gcd } from '../../../engine/math';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { expectMCS, F, numChoices } from './util';

export const ratioMixtureTraps: Record<string, Trap> = {
  'rat-mix-add-terms': {
    label: 'Added the terms of the two ratios',
    fix: 'Ratios of mixtures of different sizes cannot be added term by term. Turn each ratio into amounts of each ingredient, add the amounts, then form the ratio.',
  },
  'rat-mix-term-for-amount': {
    label: 'Added the amount poured in to one term of the ratio',
    fix: 'A ratio term counts parts, not liters. First convert the ratio into actual amounts of each ingredient, then add the amount poured in.',
  },
  'rat-mix-equal-volumes': {
    label: 'Treated the two mixtures as if they had the same volume',
    fix: 'A bigger mixture counts for more. Multiply each ingredient fraction by the volume of its mixture before adding.',
  },
};

interface RMParams {
  a: number;
  b: number;
  c: number;
  d: number;
  x: number;
  y: number;
  /** pure ingredient poured in (d1): 0 = none, 1 = A, 2 = B */
  pure: 0 | 1 | 2;
  values: Frac[];
}

const CTX = [
  { cont: 'Jar', parts: ['syrup', 'water'], unit: 'liters' },
  { cont: 'Can', parts: ['blue paint', 'white paint'], unit: 'gallons' },
  { cont: 'Bar', parts: ['copper', 'tin'], unit: 'kilograms' },
  { cont: 'Tank', parts: ['juice concentrate', 'water'], unit: 'liters' },
];

const ratioText = (v: Frac) => `$${v.n} \\text{ to } ${v.d}$`;

const mixtureRatio: Template<RMParams> = {
  id: 'arith.ratios.mixture-mcs',
  skill: 'arith.ratios',
  format: 'mcs',
  style: 'ratio of ingredients after mixing',
  generate(rng, diff) {
    const ctx = rng.pick(CTX);
    const [PA, PB] = ctx.parts;
    for (;;) {
      const top = diff === 1 ? 5 : 7;
      const a = rng.int(1, top);
      const b = rng.int(1, top);
      const c = rng.int(1, top);
      const d = rng.int(1, top);
      if (a === b || gcd(a, b) !== 1) continue;
      const mixed = diff > 1;
      if (mixed && (c === d || gcd(c, d) !== 1 || a * (c + d) === c * (a + b))) continue;
      let x: number;
      let y = 0;
      let pure: RMParams['pure'] = 0;
      let m = 0;
      let n = 0;
      if (diff === 1) {
        x = (a + b) * rng.int(2, 6);
        y = rng.int(2, 12);
        pure = rng.chance(0.5) ? 1 : 2;
      } else if (diff === 2) {
        x = (a + b) * rng.int(1, 5);
        y = (c + d) * rng.int(1, 5);
        if (x === y) continue;
      } else {
        m = rng.int(1, 5);
        n = rng.int(1, 5);
        if (m === n || gcd(m, n) !== 1) continue;
        x = m * (a + b) * (c + d);
        y = n * (a + b) * (c + d);
      }
      const xa = F(a * x, a + b);
      const xb = F(b * x, a + b);
      const ya = diff === 1 ? F(pure === 1 ? y : 0) : F(c * y, c + d);
      const yb = diff === 1 ? F(pure === 2 ? y : 0) : F(d * y, c + d);
      const A = xa.add(ya);
      const B = xb.add(yb);
      const ans = A.div(B);
      if (ans.n === ans.d || ans.n > 60 || ans.d > 60) continue;
      const traps: { value: Frac; trap: string }[] = [
        { value: ans.inv(), trap: 'num-ratio-order' },
        { value: A.div(A.add(B)), trap: 'num-ratio-part-whole' },
      ];
      if (diff === 1)
        traps.push({
          value: pure === 1 ? F(a + y, b) : F(a, b + y),
          trap: 'rat-mix-term-for-amount',
        });
      else {
        traps.push({ value: F(a + c, b + d), trap: 'rat-mix-add-terms' });
        traps.push({
          value: F(a, a + b)
            .add(F(c, c + d))
            .div(F(b, a + b).add(F(d, c + d))),
          trap: 'rat-mix-equal-volumes',
        });
      }
      const fillers = [
        [ans.n + 1, ans.d],
        [ans.n - 1, ans.d],
        [ans.n, ans.d + 1],
        [ans.n, ans.d - 1],
      ]
        .filter(([p, q]) => p > 0 && q > 0)
        .map(([p, q]) => F(p, q));
      const { choices, answer, values } = numChoices(rng, {
        correct: ans,
        traps: traps.filter((t) => t.value.sign() > 0),
        fillers,
        format: ratioText,
        order: 'shuffled',
      });
      const shown = (v: Frac) => !v.eq(ans) && values.some((w) => w.eq(v));
      const u = ctx.unit;
      const stem =
        diff === 1
          ? `${ctx.cont} X holds ${x} ${u} of a mixture of ${PA} and ${PB} in the ratio ${a} to ${b}. Then ${y} ${u} of pure ${pure === 1 ? PA : PB} are poured into ${ctx.cont} X. What is the ratio of ${PA} to ${PB} in the new mixture?`
          : diff === 2
            ? `${ctx.cont} X holds ${x} ${u} of a mixture of ${PA} and ${PB} in the ratio ${a} to ${b}. ${ctx.cont} Y holds ${y} ${u} of a mixture of ${PA} and ${PB} in the ratio ${c} to ${d}. The contents of both are poured together. What is the ratio of ${PA} to ${PB} in the combined mixture?`
            : `Mixture X contains ${PA} and ${PB} in the ratio ${a} to ${b}. Mixture Y contains ${PA} and ${PB} in the ratio ${c} to ${d}. All ratios are measured in ${u}, and X and Y are combined so that the amount of X to the amount of Y is ${m} to ${n}. What is the ratio of ${PA} to ${PB} in the combined mixture?`;
      const vol = diff === 3 ? `Take ${num(x)} ${u} of X and ${num(y)} ${u} of Y, which keeps the volume ratio ${m} to ${n}. ` : '';
      const amounts =
        diff === 1
          ? `In X, ${PA} is $\\frac{${a}}{${a + b}}$ of ${x} ${u}, which is ${num(xa)}, and ${PB} is ${num(xb)}. Adding ${y} ${u} of pure ${pure === 1 ? PA : PB} makes ${PA} $${num(A)}$ and ${PB} $${num(B)}$.`
          : `In X, ${PA} is $\\frac{${a}}{${a + b}}$ of ${num(x)} ${u}, that is ${num(xa)}, and ${PB} is ${num(xb)}. In Y, ${PA} is $\\frac{${c}}{${c + d}}$ of ${num(y)} ${u}, that is ${num(ya)}, and ${PB} is ${num(yb)}. Together: ${PA} $${num(A)}$, ${PB} $${num(B)}$.`;
      const slips = [
        shown(F(a + c, b + d)) && diff > 1 ? `adding the ratios term by term ($${a} + ${c}$ and $${b} + ${d}$) ignores that the mixtures differ in volume` : '',
        diff === 1 && shown(pure === 1 ? F(a + y, b) : F(a, b + y)) ? `adding ${y} to a term of the ratio treats ${y} ${u} as ${y} parts` : '',
        shown(ans.inv()) ? `$${ans.d} \\text{ to } ${ans.n}$ has the order reversed` : '',
        shown(A.div(A.add(B))) ? `$${A.div(A.add(B)).n} \\text{ to } ${A.div(A.add(B)).d}$ compares ${PA} with the whole mixture` : '',
      ].filter(Boolean);
      return {
        params: { a, b, c, d, x, y, pure, values },
        q: {
          format: 'mcs',
          stem,
          choices,
          answer,
          explanation: `Recognize: a ratio describes a mixture only through its shape, so turn each ratio into amounts of ${PA} and ${PB} before combining.

${vol}${amounts} The ratio is $${num(A)} : ${num(B)}${A.eq(ans.n) ? '' : ` = ${ans.n} : ${ans.d}`}$.

Check: ${num(A)} + ${num(B)} = ${num(A.add(B))} ${u}, the total amount.

Trap: ${slips.length ? slips.slice(0, 2).join('; ') : 'ratios of different mixtures cannot be added'}. Always add amounts, never ratios.`,
        },
      };
    }
  },
  check(q, { a, b, c, d, x, y, pure, values }) {
    // Count the contents liter by liter: each block of a+b liters of a mixture holds a of A then b of B.
    let A = 0;
    let B = 0;
    for (let i = 0; i < x; i++) i % (a + b) < a ? A++ : B++;
    if (pure) for (let i = 0; i < y; i++) pure === 1 ? A++ : B++;
    else for (let i = 0; i < y; i++) i % (c + d) < c ? A++ : B++;
    const hits = values.flatMap((v, i) => (v.n * B === v.d * A ? [i] : []));
    return expectMCS(q, hits.length === 1 ? hits[0] : -1);
  },
};

export const ratioMixtureTemplates: Template<any>[] = [mixtureRatio];
