import { flaggedChoices, letter } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { lin, num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { intExcept } from './util';

// "Select all" styles for alg.linear-equations and alg.systems, with their traps.
export const sameTraps: Record<string, Trap> = {
  'alg-eq-scale-one-side': {
    label: 'Multiplied only one side of the equation',
    fix: 'To keep an equation equivalent, apply the same operation to BOTH sides. Multiplying the left side by 3 requires multiplying the right side by 3.',
  },
  'alg-eq-constant-sign': {
    label: 'Moved a constant across the equals sign without changing its sign',
    fix: 'Moving $+q$ to the other side means subtracting $q$ from both sides: $2x + 5 = 9$ becomes $2x = 9 - 5$.',
  },
  'alg-eq-add-one-side': {
    label: 'Added a number to only one side',
    fix: 'Adding $t$ to the left side changes the equation unless you also add $t$ to the right side.',
  },
  'alg-eq-lost-constant': {
    label: 'Lost a constant term while rewriting',
    fix: 'Every term must survive each rewrite. Compare the constants of the old equation and the new one.',
  },
};

/* ================================================================== Equations with the same solution (MCM) */

/** p x + q = r x + s */
type LinEq = { p: number; q: number; r: number; s: number };
const eqStr = (e: LinEq) => `${lin([[e.p, 'x'], [e.q, '']])} = ${lin([[e.r, 'x'], [e.s, '']])}`;
const holdsAt = (e: LinEq, x: number) => e.p * x + e.q === e.r * x + e.s;

interface SameSolutionParams {
  x0: number;
  eqs: LinEq[];
}

const sameSolutionMCM: Template<SameSolutionParams> = {
  id: 'alg.linear-equations.same-solution-mcm',
  skill: 'alg.linear-equations',
  format: 'mcm',
  style: 'which rewritten equations keep the same solution',
  generate(rng, d) {
    for (;;) {
      let x0 = intExcept(rng, -9, 9, -1, 0, 1);
      let p: number;
      let q: number;
      let r: number;
      if (d === 1) {
        x0 = rng.int(2, 9);
        p = rng.int(2, 9);
        q = intExcept(rng, -9, 9, 0);
        r = 0;
      } else {
        const hi = d === 2 ? 9 : 12;
        p = intExcept(rng, -7, hi, 0);
        r = intExcept(rng, -7, hi, 0, p);
        q = intExcept(rng, d === 2 ? -12 : -20, d === 2 ? 12 : 20, 0);
      }
      const s = (p - r) * x0 + q;
      const base: LinEq = { p, q, r, s };
      const k = () => rng.pick([2, 3, 4, -1, -2, -3]);
      const t = () => intExcept(rng, -9, 9, 0);
      const k1 = k();
      const k2 = k();
      const k3 = k();
      const t1 = t();
      const t2 = t();
      const good: LinEq[] = [
        { p: k1 * p, q: k1 * q, r: k1 * r, s: k1 * s },
        { p: k2 * p, q: k2 * q, r: k2 * r, s: k2 * s },
        { p: p - r, q, r: 0, s },
        { p: r, q: s, r: p, s: q },
        { p, q: q + t1, r, s: s + t1 },
        { p, q: 0, r, s: s - q },
        { p: 0, q, r: r - p, s },
      ];
      const bad: { eq: LinEq; trap: string }[] = [];
      if (r !== 0) bad.push({ eq: { p: p + r, q, r: 0, s }, trap: 'alg-move-term-sign' });
      bad.push({ eq: { p: k3 * p, q: 0, r, s }, trap: 'alg-eq-lost-constant' });
      bad.push({ eq: { p: k3 * p, q: k3 * q, r, s }, trap: 'alg-eq-scale-one-side' });
      bad.push({ eq: { p: p - r, q: 0, r: 0, s: s + q }, trap: 'alg-eq-constant-sign' });
      bad.push({ eq: { p, q: q + t2, r, s }, trap: 'alg-eq-add-one-side' });
      const seen = new Set([eqStr(base)]);
      const fresh = (e: LinEq) => {
        const str = eqStr(e);
        if (seen.has(str) || e.p === e.r) return false;
        seen.add(str);
        return true;
      };
      const goods = rng.shuffle(good).filter((e) => holdsAt(e, x0) && fresh(e));
      const bads = rng.shuffle(bad).filter((b) => !holdsAt(b.eq, x0) && fresh(b.eq));
      const total = d === 1 ? 4 : d === 2 ? 5 : 6;
      const nGood = d === 1 ? rng.int(1, 2) : d === 2 ? rng.int(2, 3) : rng.int(2, 4);
      const nBad = total - nGood;
      // prefer wrong choices that come from different mistakes
      const pickedBad: typeof bads = [];
      for (const b of bads) if (!pickedBad.some((x) => x.trap === b.trap) && pickedBad.length < nBad) pickedBad.push(b);
      for (const b of bads) if (!pickedBad.includes(b) && pickedBad.length < nBad) pickedBad.push(b);
      if (goods.length < nGood || pickedBad.length < nBad) continue;
      const items = rng.shuffle([
        ...goods.slice(0, nGood).map((e) => ({ eq: e, ok: true, trap: undefined as string | undefined })),
        ...pickedBad.map((b) => ({ eq: b.eq, ok: false, trap: b.trap as string | undefined })),
      ]);
      const { choices, answer } = flaggedChoices(items.map((it) => ({ text: `$${eqStr(it.eq)}$`, correct: it.ok, ...(it.trap ? { trap: it.trap } : {}) })));
      const lines = items.map((it, i) => {
        const l = it.eq.p * x0 + it.eq.q;
        const rr = it.eq.r * x0 + it.eq.s;
        return `- ${letter(i)}: the sides are $${num(l)}$ and $${num(rr)}$, so ${it.ok ? 'it holds' : 'it fails'}.`;
      });
      const wi = items.findIndex((it) => !it.ok);
      const trapLine: Record<string, string> = {
        'alg-move-term-sign': `choice ${letter(wi)} moves $${lin([[r, 'x']])}$ to the left side without changing its sign.`,
        'alg-eq-lost-constant': `choice ${letter(wi)} loses the constant of the original equation while rewriting.`,
        'alg-eq-scale-one-side': `choice ${letter(wi)} multiplies only the left side.`,
        'alg-eq-constant-sign': `choice ${letter(wi)} moves a constant across the equals sign without changing its sign.`,
        'alg-eq-add-one-side': `choice ${letter(wi)} adds a number to only one side.`,
      };
      const explanation = `Equivalent equations have the same solution, so find it first. Collecting terms in $${eqStr(base)}$ gives $${lin([[p - r, 'x']])} = ${num(s - q)}$, so $x = ${num(x0)}$.

Now test $x = ${num(x0)}$ in each choice. A rewrite keeps the solution only if both sides still agree there:
${lines.join('\n')}

Trap: ${trapLine[items[wi].trap!]} One slip like this changes the solution.

Rule: a rewrite is safe only when the same operation is applied to both sides, and testing the solution is the quickest check.`;
      return {
        params: { x0, eqs: items.map((it) => it.eq) },
        q: {
          format: 'mcm',
          stem: `Which of the following equations have the same solution as the equation $${eqStr(base)}$?`,
          instruction: 'Indicate all such equations.',
          choices,
          answer,
          explanation,
        },
      };
    }
  },
  check(q, { x0, eqs }) {
    if (q.format !== 'mcm') return 'wrong format';
    const expected = eqs.flatMap((e, i) => (e.p !== e.r && new Frac(e.s - e.q, e.p - e.r).eq(x0) ? [i] : []));
    return JSON.stringify(expected) === JSON.stringify(q.answer) ? null : `expected ${JSON.stringify(expected)}, keyed ${JSON.stringify(q.answer)}`;
  },
};

export const sameTemplates: Template<any>[] = [sameSolutionMCM];
