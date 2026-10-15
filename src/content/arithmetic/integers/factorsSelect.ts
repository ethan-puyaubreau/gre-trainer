import { flaggedChoices } from '../../../engine/build';
import { factorize } from '../../../engine/math';
import { num, plain } from '../../../engine/tex';
import type { Choice, Template, Trap } from '../../../engine/types';
import { expectMcm, factorTex } from './util';

export const factorsSelectTraps: Record<string, Trap> = {
  'int-foreign-prime': {
    label: 'Used a prime that is not in the number',
    fix: 'Every factor of $N$ is built only from the primes of $N$. If 7 does not appear in the prime factorization, no factor is divisible by 7.',
  },
  'int-exponent-too-high': {
    label: 'Used a prime more often than the number does',
    fix: 'A factor can use each prime of $N$ at most as many times as $N$ does. If $N$ has $2^{3}$, then $2^{4} = 16$ cannot divide it.',
  },
  'int-multiple-not-factor': {
    label: 'Picked a multiple of the number instead of a factor',
    fix: 'A factor divides $N$, so it cannot exceed $N$. Numbers like $2N$ are multiples: they have $N$ as a factor, not the other way round.',
  },
};

interface FacSelParams {
  nums: number[];
  vals: number[];
}

const PRIMES = [2, 3, 5, 7];
const pow = (p: number, e: number) => p ** e;
const value = (v: number[], ps: number[]) => v.reduce((x, e, i) => x * pow(ps[i], e), 1);

/** Exponent vectors over ps with each exponent 0..max[i]. */
function vectors(max: number[]): number[][] {
  return max.reduce<number[][]>((acc, m) => acc.flatMap((v) => Array.from({ length: m + 1 }, (_, e) => [...v, e])), [[]]);
}

const factorsSelect: Template<FacSelParams> = {
  id: 'arith.factors.select-all',
  skill: 'arith.factors',
  format: 'mcm',
  style: 'which of these numbers are factors (of one number, or of both of two numbers)',
  generate(rng, diff) {
    for (;;) {
      const both = diff === 3;
      const ps = [...PRIMES, 11];
      // exponents of the numbers over ps (the prime 11 never appears in a number: it is the foreign prime)
      const mk = (k: number, top: number): number[] => {
        const used = rng.sample([0, 1, 2, 3], k);
        return ps.map((_, i) => (used.includes(i) ? rng.int(1, top) : 0));
      };
      const exps = both ? [mk(3, 3), mk(3, 3)] : [mk(diff === 1 ? 2 : 3, diff === 1 ? 3 : 4)];
      if (!both && diff === 1 && exps[0].reduce((s, e) => s + e, 0) < 3) continue;
      const nums = exps.map((e) => value(e, ps));
      const cap = Math.min(2500, Math.max(60, 6 * Math.max(...nums)));
      if (nums.some((n) => n > (diff === 1 ? 600 : 2500))) continue;
      const maxE = ps.map((_, i) => Math.max(...exps.map((e) => e[i])));
      const common = ps.map((_, i) => Math.min(...exps.map((e) => e[i])));
      if (both && common.every((e) => e === 0)) continue;
      const good: number[] = [];
      const bad: { v: number; trap: string }[] = [];
      for (const vec of vectors(ps.map((_, i) => (i === 4 ? 1 : maxE[i] + 1)))) {
        const v = value(vec, ps);
        if (v < 2 || v > cap || nums.includes(v)) continue;
        const dividesAll = nums.every((n) => n % v === 0);
        if (dividesAll) good.push(v);
        else if (both && nums.some((n) => n % v === 0)) bad.push({ v, trap: 'int-one-condition-only' });
        else if (vec.some((e, i) => e > 0 && maxE[i] === 0)) bad.push({ v, trap: 'int-foreign-prime' });
        else bad.push({ v, trap: 'int-exponent-too-high' });
      }
      if (!both) for (const k of [2, 3]) if (nums[0] * k <= 4000) bad.push({ v: nums[0] * k, trap: 'int-multiple-not-factor' });
      const count = diff === 1 ? 5 : 6;
      const nGood = diff === 1 ? 2 : rng.int(2, 3);
      if (good.length < nGood) continue;
      const classes = rng.shuffle([...new Set(bad.map((b) => b.trap))]);
      const wrong: { v: number; trap: string }[] = [];
      const pools = classes.map((c) => rng.shuffle(bad.filter((b) => b.trap === c)));
      for (let round = 0; wrong.length < count - nGood && round < 6; round++)
        for (const pool of pools) if (wrong.length < count - nGood && pool[round] && !wrong.some((w) => w.v === pool[round].v)) wrong.push(pool[round]);
      if (wrong.length < count - nGood) continue;
      const items = [...rng.sample(good, nGood).map((v) => ({ v, correct: true, trap: undefined as string | undefined })), ...wrong.map((w) => ({ ...w, correct: false }))].sort((x, y) => x.v - y.v);
      const { choices, answer } = flaggedChoices(items.map((x) => ({ text: `$${num(x.v)}$`, correct: x.correct, ...(x.trap ? { trap: x.trap } : {}) })) as (Choice & { correct: boolean })[]);
      const fac = (e: number[]) => factorTex(ps.flatMap((p, i) => (e[i] > 0 ? [[p, e[i]] as [number, number]] : [])));
      const names = both ? ['M', 'N'] : ['N'];
      const subject = both ? 'factors of both $M$ and $N$' : diff === 1 ? `factors of $${num(nums[0])}$` : 'factors of $N$';
      const defs = diff === 1 ? '' : `Let ${exps.map((e, i) => `$${names[i]} = ${fac(e)}$`).join(' and ')}. `;
      const nm = (i: number) => (diff === 1 ? `$${num(nums[0])}$` : `$${names[i]}$`);
      const reason = (x: { v: number; trap?: string }): string => {
        const f = factorize(x.v);
        if (x.trap === 'int-multiple-not-factor') return `larger than ${nm(0)}, so a multiple`;
        if (x.trap === 'int-one-condition-only') return `does not divide ${nm(nums.findIndex((n) => n % x.v !== 0))}`;
        const out = f.find(([p]) => maxE[ps.indexOf(p)] === 0);
        if (out) return `uses the prime ${out[0]}, which ${both ? 'neither has' : `${nm(0)} lacks`}`;
        const hi = f.find(([p, e]) => e > common[ps.indexOf(p)])!;
        if (hi[1] === 1) return `uses the prime ${hi[0]}, missing from one number`;
        return `needs $${hi[0]}^{${hi[1]}}$, too many ${hi[0]}s`;
      };
      const bullets = items.map((x) => `- ${plain(x.v)}: ${x.correct ? `$${factorTex(factorize(x.v))}$, within the limits ✓` : `${reason(x)} ✗`}`).join('\n');
      const w = items.find((x) => !x.correct)!;
      const trapLine: Record<string, string> = {
        'int-multiple-not-factor': `${plain(w.v)} is a multiple of ${nm(0)}, not a factor`,
        'int-one-condition-only': `${plain(w.v)} fits only one of the two numbers`,
        'int-foreign-prime': `${plain(w.v)} is built from a prime that the number lacks`,
        'int-exponent-too-high': `${plain(w.v)} uses one prime more often than allowed`,
      };
      const explanation = `Recognize: a factor of a number uses only its primes, each at most as often as the number does.

${diff === 1 ? `Factor it: $${num(nums[0])} = ${fac(exps[0])}$. ` : ''}${both ? 'Each prime is limited by the smaller exponent. ' : ''}Test each choice:

${bullets}

Check: ${plain(items.find((x) => x.correct)!.v)} divides ${both ? 'both' : nm(0)} evenly.

Trap: ${trapLine[w.trap!]}. A factor stays inside the primes and exponents of the number.`;
      return {
        params: { nums, vals: items.map((x) => x.v) },
        q: {
          format: 'mcm',
          stem: `${defs}Which of the following are ${subject}?`,
          instruction: 'Indicate all such numbers.',
          choices,
          answer,
          explanation,
        },
      };
    }
  },
  check(q, { nums, vals }) {
    return expectMcm(q, vals.flatMap((v, i) => (nums.every((n) => n % v === 0) ? [i] : [])));
  },
};

export const factorsSelectTemplates: Template<any>[] = [factorsSelect];
