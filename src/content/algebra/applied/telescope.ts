import { numericChoices } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { lin, num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';

// New question styles for alg.sequences, with their traps.
export const telescopeTraps: Record<string, Trap> = {
  'alg-telescope-no-shift': {
    label: 'Matched the denominator of the difference to the index instead of to $m + c$',
    fix: 'The term $a_m$ has denominator $m + c$, not $m$. Set $m + c$ equal to the denominator you found, then subtract $c$.',
  },
  'alg-telescope-index-product': {
    label: 'Multiplied the two indices to get the new index',
    fix: 'It is the denominators $k + c$ and $k + c + 1$ that multiply, not the indices $k$ and $k + 1$. The shift $c$ is part of every denominator.',
  },
  'alg-telescope-index-difference': {
    label: 'Subtracted the indices because the terms were subtracted',
    fix: 'Subtracting two terms does not subtract their indices. Write both terms as fractions and put them over a common denominator.',
  },
  'alg-telescope-shift-sign': {
    label: 'Added $c$ instead of subtracting it after matching denominators',
    fix: 'From $m + c = N$ the index is $m = N - c$. Check with a small case: if $c = 2$ and $N = 12$, then $m = 10$ because $10 + 2 = 12$.',
  },
  'alg-telescope-add-denominators': {
    label: 'Added the denominators when subtracting the fractions',
    fix: '$\\frac{1}{p} - \\frac{1}{q} = \\frac{q - p}{pq}$. The denominators multiply; they are never added.',
  },
  'alg-telescope-off-pair': {
    label: 'Built the denominators from the neighbouring terms instead of the two terms in the question',
    fix: '$a_k - a_{k+1}$ uses the denominators $k + c$ and $k + c + 1$, exactly the indices written in the question. Substitute them before multiplying.',
  },
};

interface TelescopeParams {
  a: number;
  c: number;
  k: number;
  g: number;
  L: string;
}

const LETTERS = ['a', 'b', 's', 't'];
const PRIORITY = ['alg-telescope-no-shift', 'alg-telescope-index-product', 'alg-telescope-add-denominators', 'alg-telescope-index-difference', 'alg-telescope-shift-sign', 'alg-telescope-off-pair'];

const telescopeMCS: Template<TelescopeParams> = {
  id: 'alg.sequences.telescoping-mcs',
  skill: 'alg.sequences',
  format: 'mcs',
  style: 'the difference of two terms of a/(n + c) is another term',
  generate(rng, d) {
    for (;;) {
      const L = rng.pick(LETTERS);
      const a = d === 1 ? rng.int(2, 9) : rng.int(2, 12);
      let c: number;
      let k: number;
      let g: number;
      if (d === 1) {
        c = rng.int(1, 4);
        k = rng.int(2, 5);
        g = 1;
      } else if (d === 2) {
        c = rng.int(1, 6);
        k = rng.int(4, 11);
        g = 1;
      } else {
        c = rng.pick([-4, -3, -2, -1, 1, 2, 3, 4, 5, 6]);
        g = rng.pick([2, 3]);
        k = rng.int(Math.max(5, 2 - c), 12);
      }
      const D = k + c;
      const E = k + g + c;
      if (D < 1 || (D * E) % g !== 0) continue;
      const N = (D * E) / g;
      const m = N - c;
      if (m === k || m === k + g) continue;
      const traps: { value: number; trap: string }[] = [
        { value: N, trap: 'alg-telescope-no-shift' },
        { value: k * (k + g), trap: 'alg-telescope-index-product' },
        { value: N + c, trap: 'alg-telescope-shift-sign' },
        { value: D + E - c, trap: 'alg-telescope-add-denominators' },
        { value: g, trap: 'alg-telescope-index-difference' },
      ];
      if ((E * (E + g)) % g === 0) traps.push({ value: (E * (E + g)) / g - c, trap: 'alg-telescope-off-pair' });
      if (D - g >= 1 && ((D - g) * D) % g === 0) traps.push({ value: ((D - g) * D) / g - c, trap: 'alg-telescope-off-pair' });
      const built = numericChoices(rng, { correct: m, traps, format: (v) => `$${num(v)}$` });
      const sh = (v: string) => `${v} ${c < 0 ? '-' : '+'} ${Math.abs(c)}`;
      const sentence: Record<string, string> = {
        'alg-telescope-no-shift': `$${num(N)}$ is tempting, since it is the denominator we found. But the term $${L}_m$ has denominator $${sh('m')}$, so $m = ${num(N)} ${c < 0 ? '+' : '-'} ${Math.abs(c)}$, not $${num(N)}$`,
        'alg-telescope-index-product': `multiplying the indices $${k}$ and $${k + g}$ gives $${num(k * (k + g))}$, but the numbers to multiply are the denominators $${D}$ and $${E}$`,
        'alg-telescope-shift-sign': `adding the shift to the matched denominator instead of subtracting it gives $${num(N + c)}$, which does not satisfy $${sh('m')} = ${num(N)}$`,
        'alg-telescope-add-denominators': `adding the denominators $${D}$ and $${E}$ gives $${num(D + E - c)}$ after the shift, but denominators multiply`,
        'alg-telescope-index-difference': `subtracting the indices, which are $${g}$ apart, gives $${num(g)}$, but the terms are fractions, not indices`,
        'alg-telescope-off-pair': `using the neighbours of $${L}_{${k}}$ and $${L}_{${k + g}}$ builds the wrong denominators and lands on another index`,
      };
      const present = new Set(built.choices.map((ch) => ch.trap));
      const firstTrap = PRIORITY.find((id) => present.has(id))!;
      const common =
        g === 1 ? `\\dfrac{${a}(${E} - ${D})}{${D} \\cdot ${E}} = \\dfrac{${a}}{${num(N)}}` : `\\dfrac{${a}(${E} - ${D})}{${D} \\cdot ${E}} = \\dfrac{${num(a * g)}}{${num(D * E)}} = \\dfrac{${a}}{${num(N)}}`;
      const explanation = `A difference of two fractions with the same numerator: put them over a common denominator.

$${L}_{${k}} - ${L}_{${k + g}} = \\dfrac{${a}}{${D}} - \\dfrac{${a}}{${E}} = ${common}$. Subtracting fractions never subtracts or adds their denominators: they multiply.

For $${L}_m = \\dfrac{${a}}{${sh('m')}}$ to equal $\\dfrac{${a}}{${num(N)}}$ we need $${sh('m')} = ${num(N)}$, so $m = ${num(m)}$.

Check: $${L}_{${num(m)}} = \\dfrac{${a}}{${sh(num(m))}} = \\dfrac{${a}}{${num(N)}}$.

Trap: ${sentence[firstTrap]}.

Rule: a term of $\\dfrac{a}{n + c}$ is fixed by its denominator, so compare denominators and remember the shift $c$.`;
      return {
        params: { a, c, k, g, L },
        q: {
          format: 'mcs',
          stem: `A sequence is defined by $${L}_n = \\dfrac{${a}}{${lin([[1, 'n'], [c, '']])}}$ for every positive integer $n$. If $${L}_{${k}} - ${L}_{${k + g}} = ${L}_m$ for some positive integer $m$, what is $m$?`,
          choices: built.choices,
          answer: built.answer,
          explanation,
        },
      };
    }
  },
  check(q, { a, c, k, g }) {
    if (q.format !== 'mcs') return 'wrong format';
    const diff = new Frac(a, k + c).sub(new Frac(a, k + g + c));
    let found: number | null = null;
    for (let n = 1; n <= 2000; n++) {
      if (n + c === 0) continue;
      if (frac(a).div(n + c).eq(diff)) {
        found = n;
        break;
      }
    }
    if (found === null) return 'no term equals the difference';
    return q.choices[q.answer].text === `$${num(found)}$` ? null : `expected ${found}, keyed ${q.choices[q.answer].text}`;
  },
};

export const telescopeTemplates: Template<any>[] = [telescopeMCS];
