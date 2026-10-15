import { flaggedChoices, letter } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { word } from './util';

// Select-all question for data.counting (arrangements with repeated letters), with its traps.
export const arrangementTraps: Record<string, Trap> = {
  'prob-repeats-ignored': {
    label: 'Counted every letter as different',
    fix: 'Swapping two identical letters gives the same arrangement. $n!$ counts them as different, so it is too large whenever a letter repeats.',
  },
  'prob-repeats-add-factorials': {
    label: 'Divided by a sum of factorials',
    fix: 'The repeated groups can be reordered independently, so their symmetries MULTIPLY: divide by $g_1! \\cdot g_2!$, never by $g_1! + g_2!$.',
  },
  'prob-repeats-divide-counts': {
    label: 'Divided by the counts instead of the factorials of the counts',
    fix: 'A group of $g$ identical letters can be ordered in $g!$ ways, not $g$ ways. Divide by $g!$.',
  },
  'prob-repeats-binom-full': {
    label: 'Chose the positions of each repeated letter from all positions',
    fix: 'Once the positions of one letter are taken, only the remaining positions are free for the next letter: $\\binom{n}{g_1}\\binom{n-g_1}{g_2}$, not $\\binom{n}{g_1}\\binom{n}{g_2}$.',
  },
  'prob-repeats-divide-singles': {
    label: 'Divided by the factorial of the letters that appear once',
    fix: 'Only repeated letters create identical arrangements. Letters that appear once are all different, so they add nothing to the denominator.',
  },
  'prob-repeats-lump': {
    label: 'Treated all the repeated letters as one group',
    fix: 'Two different repeated letters are two separate groups. Divide by $g_1!$ and by $g_2!$ separately, not by $(g_1 + g_2)!$.',
  },
};

type Node =
  | { k: 'fact'; n: number }
  | { k: 'factsum'; xs: number[] }
  | { k: 'binom'; n: number; r: number }
  | { k: 'perm'; n: number; r: number }
  | { k: 'lit'; n: number }
  | { k: 'mul'; xs: Node[] }
  | { k: 'div'; a: Node; b: Node }
  | { k: 'sum'; xs: Node[] };

const tex = (e: Node): string => {
  switch (e.k) {
    case 'fact':
      return `${e.n}!`;
    case 'factsum':
      return `(${e.xs.join(' + ')})!`;
    case 'binom':
      return `\\binom{${e.n}}{${e.r}}`;
    case 'perm':
      return `{}_{${e.n}}P_{${e.r}}`;
    case 'lit':
      return `${e.n}`;
    case 'mul':
      return e.xs.map(tex).join(' \\cdot ');
    case 'div':
      return `\\dfrac{${tex(e.a)}}{${tex(e.b)}}`;
    case 'sum':
      return e.xs.map(tex).join(' + ');
  }
};

const fact = (n: number): Frac => (n <= 1 ? new Frac(1) : new Frac(n).mul(fact(n - 1)));

/** Exact value of an expression. */
const val = (e: Node): Frac => {
  switch (e.k) {
    case 'fact':
      return fact(e.n);
    case 'factsum':
      return fact(e.xs.reduce((a, x) => a + x, 0));
    case 'binom':
      return fact(e.n).div(fact(e.r).mul(fact(e.n - e.r)));
    case 'perm':
      return fact(e.n).div(fact(e.n - e.r));
    case 'lit':
      return new Frac(e.n);
    case 'mul':
      return e.xs.reduce((a, x) => a.mul(val(x)), new Frac(1));
    case 'div':
      return val(e.a).div(val(e.b));
    case 'sum':
      return e.xs.reduce((a, x) => a.add(val(x)), new Frac(0));
  }
};

/** Number of distinct arrangements, by trying every letter in turn (no formula). */
function countArrangements(counts: number[], memo = new Map<string, number>()): number {
  if (counts.every((c) => c === 0)) return 1;
  const key = counts.join(',');
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  let total = 0;
  for (let i = 0; i < counts.length; i++)
    if (counts[i] > 0) {
      counts[i]--;
      total += countArrangements(counts, memo);
      counts[i]++;
    }
  memo.set(key, total);
  return total;
}

interface ArrangementParams {
  /** multiplicity of each distinct letter, including letters that appear once */
  counts: number[];
  exprs: Node[];
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const arrangementsMCM: Template<ArrangementParams> = {
  id: 'data.counting.arrangement-expressions-mcm',
  skill: 'data.counting',
  format: 'mcm',
  style: 'which expressions count the arrangements of letters with repeats',
  generate(rng, d) {
    for (;;) {
      let groups: number[];
      let n: number;
      if (d === 1) {
        n = rng.int(5, 6);
        groups = [rng.int(2, 3)];
      } else if (d === 2) {
        n = rng.int(6, 7);
        groups = rng.pick([[2, 2], [2, 3], [3, 2]]);
      } else {
        n = rng.int(7, 8);
        groups = rng.pick([[2, 3], [3, 3], [2, 4], [2, 2, 2], [2, 2, 3], [3, 2]]);
      }
      const used = groups.reduce((a, x) => a + x, 0);
      const s = n - used;
      if (s < 0) continue;
      const counts = [...groups, ...Array(s).fill(1)];
      const total = fact(n).div(groups.reduce((a, g) => a.mul(fact(g)), new Frac(1)));
      const r = groups.length;
      const facts = (gs: number[]): Node => (gs.length === 1 ? { k: 'fact', n: gs[0] } : { k: 'mul', xs: gs.map((g) => ({ k: 'fact', n: g }) as Node) });
      const seqBinoms = (gs: number[]): Node[] => {
        let left = n;
        return gs.map((g) => {
          const b: Node = { k: 'binom', n: left, r: g };
          left -= g;
          return b;
        });
      };
      const tail: Node[] = s >= 2 ? [{ k: 'fact', n: s }] : [];
      const good: Node[] = [];
      good.push({ k: 'div', a: { k: 'fact', n }, b: facts(groups) });
      good.push({ k: 'mul', xs: [...seqBinoms(groups), ...tail] });
      if (r === 1) {
        good.push({ k: 'perm', n, r: s });
        const prod: Node[] = [];
        for (let v = n; v > groups[0]; v--) prod.push({ k: 'lit', n: v });
        good.push({ k: 'mul', xs: prod });
      } else {
        good.push({ k: 'mul', xs: [...seqBinoms([...groups].reverse()), ...tail] });
        good.push({ k: 'mul', xs: [{ k: 'binom', n, r: groups[0] }, { k: 'div', a: { k: 'fact', n: n - groups[0] }, b: facts(groups.slice(1)) }] });
      }
      const bad: { e: Node; trap: string }[] = [
        { e: { k: 'fact', n }, trap: 'prob-repeats-ignored' },
        { e: { k: 'div', a: { k: 'fact', n }, b: { k: 'mul', xs: groups.map((g) => ({ k: 'lit', n: g }) as Node) } }, trap: 'prob-repeats-divide-counts' },
        { e: { k: 'mul', xs: groups.map((g) => ({ k: 'binom', n, r: g }) as Node) }, trap: 'prob-repeats-binom-full' },
      ];
      if (s >= 2) bad.push({ e: { k: 'div', a: { k: 'fact', n }, b: { k: 'mul', xs: [...groups, s].map((g) => ({ k: 'fact', n: g }) as Node) } }, trap: 'prob-repeats-divide-singles' });
      if (r >= 2) {
        bad.push({ e: { k: 'div', a: { k: 'fact', n }, b: { k: 'sum', xs: groups.map((g) => ({ k: 'fact', n: g }) as Node) } }, trap: 'prob-repeats-add-factorials' });
        bad.push({ e: { k: 'div', a: { k: 'fact', n }, b: { k: 'factsum', xs: groups } }, trap: 'prob-repeats-lump' });
      }
      const seen = new Set<string>();
      const fresh = (e: Node) => {
        const t = tex(e);
        if (seen.has(t)) return false;
        seen.add(t);
        return true;
      };
      const goods = rng.shuffle(good).filter((e) => val(e).eq(total) && fresh(e));
      const bads = rng.shuffle(bad).filter((b) => {
        const v = val(b.e);
        return v.isInt() && !v.eq(total) && fresh(b.e);
      });
      const nTotal = d === 1 ? 5 : d === 2 ? 6 : 7;
      const nGood = d === 1 ? 2 : d === 2 ? rng.int(2, 3) : rng.int(3, 4);
      const nBad = nTotal - nGood;
      if (goods.length < nGood || bads.length < nBad) continue;
      const items = rng.shuffle([
        ...goods.slice(0, nGood).map((e) => ({ e, ok: true, trap: undefined as string | undefined })),
        ...bads.slice(0, nBad).map((b) => ({ e: b.e, ok: false, trap: b.trap as string | undefined })),
      ]);
      const { choices, answer } = flaggedChoices(items.map((it) => ({ text: `$${tex(it.e)}$`, correct: it.ok, ...(it.trap ? { trap: it.trap } : {}) })));
      const names = rng.sample(LETTERS, counts.length).sort();
      const listing = counts.flatMap((c, i) => Array(c).fill(names[i])).join(', ');
      const lines = items.map((it, i) => {
        const v = val(it.e);
        return `- ${letter(i)}: equals $${num(v)}$${it.ok ? '' : `, not $${num(total)}$`}.`;
      });
      const wi = items.findIndex((it) => !it.ok);
      const g = groups;
      const trapLine: Record<string, string> = {
        'prob-repeats-ignored': `choice ${letter(wi)} is the number of arrangements of ${word(n)} different letters. Swapping two identical letters changes nothing, so it is too large.`,
        'prob-repeats-divide-counts': `choice ${letter(wi)} divides by the counts of the repeated letters, but a group of ${g[0]} identical letters can be ordered in $${g[0]}!$ ways, not ${g[0]}.`,
        'prob-repeats-binom-full': `choice ${letter(wi)} picks the positions of each repeated letter from all ${word(n)} positions, forgetting that earlier letters already use some.`,
        'prob-repeats-add-factorials': `choice ${letter(wi)} divides by a sum of factorials, but the symmetries of separate groups multiply.`,
        'prob-repeats-divide-singles': `choice ${letter(wi)} also divides by the factorial of the letters that appear once, but single letters are all different and change nothing.`,
        'prob-repeats-lump': `choice ${letter(wi)} treats the repeated letters as one big group instead of dividing by each group's factorial.`,
      };
      const denom = g.map((x) => `${x}!`).join(' \\cdot ');
      const explanation = `Identical letters make some orders look the same, so divide out the orders of each repeated letter. The ${word(n)} letters give $\\dfrac{${n}!}{${denom}} = \\dfrac{${num(fact(n))}}{${num(g.reduce((a, x) => a * fact(x).n, 1))}} = ${num(total)}$ arrangements.

Another correct way is to choose the positions of each repeated letter in turn with binomials, using only the positions still free, then arrange the single letters. Every correct choice is one of these counts rewritten in another form. Evaluate each choice:
${lines.join('\n')}

Trap: ${trapLine[items[wi].trap!]}

Rule: for letters with repeats, divide $n!$ by the factorial of each repeat count, or choose positions step by step from the places that are left.`;
      return {
        params: { counts, exprs: items.map((it) => it.e) },
        q: {
          format: 'mcm',
          stem: `The letters ${listing} are arranged in a row. Which of the following expressions equal the number of distinct arrangements of all ${word(n)} letters?`,
          instruction: 'Indicate all such expressions.',
          choices,
          answer,
          explanation,
        },
      };
    }
  },
  check(q, { counts, exprs }) {
    if (q.format !== 'mcm') return 'wrong format';
    const want = new Frac(countArrangements([...counts]));
    const expected = exprs.flatMap((e, i) => (val(e).eq(want) ? [i] : []));
    return JSON.stringify(expected) === JSON.stringify(q.answer) ? null : `expected ${JSON.stringify(expected)}, keyed ${JSON.stringify(q.answer)}`;
  },
};

export const arrangementTemplates: Template<any>[] = [arrangementsMCM];
