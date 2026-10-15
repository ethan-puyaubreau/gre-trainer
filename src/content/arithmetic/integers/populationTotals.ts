import { flaggedChoices } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { gcd, lcm } from '../../../engine/math';
import type { Choice, Template, Trap } from '../../../engine/types';
import { expectMcm, listAnd } from './util';

export const populationTraps: Record<string, Trap> = {
  'int-added-denominators': {
    label: 'Added the denominators instead of finding their LCM',
    fix: 'For $\\frac{1}{4}$ and $\\frac{1}{6}$ of a group, 10 people fail ($\\frac{1}{4}$ of 10 is 2.5). The total must be a multiple of lcm$(4, 6) = 12$.',
  },
  'int-remainder-fraction-of-total': {
    label: 'Took the fraction of the remainder as a fraction of the total',
    fix: 'A fraction "of the remaining people" applies to what is left after the first group is removed. Write the remainder in terms of the total, then ask when that count is whole.',
  },
};

interface PopParams {
  fr: [number, number][];
  chain: boolean;
  totals: number[];
}

const DENS = [4, 5, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20];
const CONTEXTS = [
  { lead: 'At a company picnic,', noun: 'employees', verbs: ['ride the bus', 'bring a dish', 'play volleyball'] },
  { lead: 'In a school survey,', noun: 'students', verbs: ['walk to school', 'take the bus', 'ride a bike'] },
  { lead: 'At a conference,', noun: 'attendees', verbs: ['arrive by train', 'join the workshop', 'stay at the hotel'] },
  { lead: 'In a community choir,', noun: 'singers', verbs: ['sing soprano', 'play an instrument', 'read music'] },
];

/** Totals T that make every fraction a whole number of people: the multiples of the returned modulus. */
function modulus(fr: [number, number][], chain: boolean): number {
  if (!chain) return fr.reduce((m, [, p]) => lcm(m, p), 1);
  const [[a, p], [b, q]] = fr;
  return lcm(p, (p * q) / gcd((p - a) * b, p * q));
}

const populationTotals: Template<PopParams> = {
  id: 'arith.lcm-gcd.population-totals',
  skill: 'arith.lcm-gcd',
  format: 'mcm',
  style: 'fractions of a group must be whole people: which totals are possible',
  generate(rng, diff) {
    const chain = diff === 3;
    const n = diff === 2 ? 3 : 2;
    for (;;) {
      const dens = rng.sample(DENS, n);
      const fr: [number, number][] = dens.map((p) => {
        const ok = Array.from({ length: p - 1 }, (_, i) => i + 1).filter((a) => gcd(a, p) === 1);
        return [rng.pick(ok), p];
      });
      if (!chain && fr.reduce((s, [a, p]) => s + a / p, 0) > 0.95) continue;
      const L = modulus(fr, chain);
      const naive = fr.reduce((m, [, p]) => lcm(m, p), 1);
      const [lo, hi] = diff === 1 ? [12, 72] : diff === 2 ? [30, 120] : [24, 120];
      if (L < lo || L > hi || (chain && L === naive)) continue;
      const top = Math.min(5 * L, 600);
      const sumDen = dens.reduce((s, p) => s + p, 0);
      const g = dens.reduce((m, p) => gcd(m, p), 0);
      const good: number[] = [];
      const bad: { v: number; trap: string }[] = [];
      for (let t = 8; t <= top; t++) {
        if (t % L === 0) good.push(t);
        else if (chain && t % naive === 0) bad.push({ v: t, trap: 'int-remainder-fraction-of-total' });
        else if (dens.some((p) => t % p === 0) || (chain && t % dens[0] === 0)) bad.push({ v: t, trap: 'int-one-condition-only' });
        else if (t % sumDen === 0) bad.push({ v: t, trap: 'int-added-denominators' });
        else if (g > 1 && t % g === 0) bad.push({ v: t, trap: 'int-gcd-lcm-swapped' });
      }
      const count = diff === 1 ? 5 : 6;
      const nGood = diff === 2 ? 2 : rng.int(1, 2);
      if (good.length < nGood) continue;
      const wrong: { v: number; trap: string }[] = [];
      const shuffled = rng.shuffle(bad);
      for (const x of shuffled) if (wrong.length < count - nGood && !wrong.some((w) => w.trap === x.trap)) wrong.push(x);
      for (const x of shuffled) if (wrong.length < count - nGood && !wrong.includes(x)) wrong.push(x);
      if (wrong.length < count - nGood) continue;
      const items = [...rng.sample(good, nGood).map((v) => ({ v, correct: true as const, trap: undefined as string | undefined })), ...wrong.map((w) => ({ ...w, correct: false as const }))].sort((x, y) => x.v - y.v);
      const { choices, answer } = flaggedChoices(items.map((x) => ({ text: `$${x.v}$`, correct: x.correct, ...(x.trap ? { trap: x.trap } : {}) })) as (Choice & { correct: boolean })[]);
      const ctx = rng.pick(CONTEXTS);
      const f = (i: number) => `$${new Frac(fr[i][0], fr[i][1]).toTex()}$`;
      const body = chain
        ? `exactly ${f(0)} of the ${ctx.noun} ${ctx.verbs[0]}, and exactly ${f(1)} of the remaining ${ctx.noun} ${ctx.verbs[1]}`
        : fr.map((_, i) => `${i === n - 1 ? 'and ' : ''}exactly ${f(i)} of the ${ctx.noun} ${ctx.verbs[i]}`).join(', ');
      const T = L;
      const x1 = (T * fr[0][0]) / fr[0][1];
      const trapPick = items.find((x) => !x.correct)!;
      const trapText: Record<string, string> = {
        'int-one-condition-only': `${trapPick.v} satisfies only some of the fractions, so another group is not whole`,
        'int-added-denominators': `${trapPick.v} is the sum of the denominators, which has no reason to work`,
        'int-gcd-lcm-swapped': `${trapPick.v} is a multiple of the common divisor ${g}, which is too weak`,
        'int-remainder-fraction-of-total': `${trapPick.v} makes the second fraction whole only if it applies to the total, but it applies to the remainder`,
      };
      const tests = `Test each choice against ${L}: ${items.map((x) => (x.correct ? `${x.v} = ${x.v / L} \u00d7 ${L} works` : `${x.v} = ${Math.floor(x.v / L)} \u00d7 ${L} + ${x.v % L} does not`)).join('; ')}.`;
      const explanation = chain
        ? `Recognize: groups of people are whole numbers, so every count must be an integer.

${f(0)} of the total is whole only for a multiple of ${fr[0][1]}. Then the remaining people are $T - \\frac{${fr[0][0]}}{${fr[0][1]}}T$, and ${f(1)} of them must be whole too. Together the two conditions need a multiple of ${L}.

Check with ${T}: ${x1} people in the first group, ${T - x1} remain, and ${f(1)} of ${T - x1} is ${((T - x1) * fr[1][0]) / fr[1][1]}.

${tests}

Trap: ${trapText[trapPick.trap!]}. Chain the conditions in order; do not read all fractions off the total.`
        : `Recognize: a fraction of a group of people must be a whole number, so every fraction must work at the same time.

Each fraction is in lowest terms, so its denominator must divide the total. The total is a multiple of ${listAnd(dens.map(String))}, that is, of lcm$(${dens.join(', ')}) = ${L}$.

Check with ${T}: ${listAnd(fr.map(([a, p]) => `${f(fr.findIndex((z) => z[1] === p))} of ${T} is ${(T * a) / p}`))}.

${tests}

Trap: ${trapText[trapPick.trap!]}. A total must be a multiple of the LCM of the denominators, not of one of them.`;
      return {
        params: { fr, chain, totals: items.map((x) => x.v) },
        q: { format: 'mcm', stem: `${ctx.lead} ${body}. Which of the following could be the total number of ${ctx.noun}?`, instruction: 'Indicate all such numbers.', choices, answer, explanation },
      };
    }
  },
  check(q, { fr, chain, totals }) {
    const whole = (T: number) => {
      const x = new Frac(fr[0][0], fr[0][1]).mul(T);
      if (!x.isInt()) return false;
      if (!chain) return fr.every(([a, p]) => new Frac(a, p).mul(T).isInt());
      return new Frac(fr[1][0], fr[1][1]).mul(new Frac(T).sub(x)).isInt();
    };
    return expectMcm(q, totals.flatMap((T, i) => (whole(T) ? [i] : [])));
  },
};

export const populationTemplates: Template<any>[] = [populationTotals];
