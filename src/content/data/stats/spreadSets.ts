import { flaggedChoices, letter } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';

// Select-all question for data.spread, with its traps.
export const spreadSetTraps: Record<string, Trap> = {
  'stat-sd-partial-shift': {
    label: 'Treated adding a number to only some values as a shift of the whole list',
    fix: 'A shift keeps the standard deviation only when EVERY value moves by the same amount. Moving some values and not others changes the distances between them.',
  },
  'stat-sd-same-mean': {
    label: 'Assumed the same mean means the same standard deviation',
    fix: 'The mean is the center; the standard deviation is how far the values sit from it. Two lists can share a mean and still have different spreads.',
  },
};

interface SpreadSetParams {
  base: number[];
  lists: number[][];
}

type Kind = 'shift' | 'reflect' | 'shiftreflect' | 'scale' | 'partial' | 'stretch';

/** Population variance of integers, exactly: (n * sum(x^2) - sum(x)^2) / n^2. */
const variance = (xs: number[]): Frac => {
  const n = xs.length;
  const s = xs.reduce((a, x) => a + x, 0);
  const s2 = xs.reduce((a, x) => a + x * x, 0);
  return new Frac(n * s2 - s * s, n * n);
};

const setTex = (xs: number[]) => `\\{${xs.map((x) => num(x)).join(', ')}\\}`;

const spreadSetsMCM: Template<SpreadSetParams> = {
  id: 'data.spread.same-sd-sets-mcm',
  skill: 'data.spread',
  format: 'mcm',
  style: 'which lists have the same standard deviation as a given list',
  generate(rng, d) {
    for (;;) {
      const n = d === 3 ? 6 : 5;
      // integer mean m and distinct integer deviations that sum to zero, so a stretch about the mean stays integral
      const devRange = d === 1 ? 5 : d === 2 ? 7 : 9;
      const devs: number[] = rng.sample(Array.from({ length: 2 * devRange + 1 }, (_, i) => i - devRange).filter((x) => x !== 0), n - 1);
      const last = -devs.reduce((a, x) => a + x, 0);
      if (last === 0 || devs.includes(last) || Math.abs(last) > devRange + 4) continue;
      const m = rng.int(devRange + 6, devRange + 30);
      const base = [...devs, last].map((x) => m + x).sort((a, b) => a - b);
      const goodKinds: Kind[] = d === 1 ? ['shift', 'reflect'] : ['shift', 'reflect', 'shiftreflect'];
      const badKinds: Kind[] = d === 1 ? ['scale', 'partial'] : ['scale', 'partial', 'stretch'];
      const total = d === 1 ? 4 : d === 2 ? 5 : 6;
      const nGood = d === 1 ? rng.int(1, 2) : d === 2 ? rng.int(2, 3) : rng.int(2, 4);
      const nBad = total - nGood;
      const kinds: Kind[] = [];
      const goodPool = rng.shuffle([...goodKinds, ...goodKinds]);
      for (let i = 0; i < nGood; i++) kinds.push(goodPool[i % goodPool.length]);
      const badPool = rng.shuffle([...badKinds, ...badKinds]);
      for (let i = 0; i < nBad; i++) kinds.push(badPool[i % badPool.length]);
      const items: { list: number[]; kind: Kind; how: string }[] = [];
      const used = new Set<string>([base.join(',')]);
      let failed = false;
      for (const kind of rng.shuffle(kinds)) {
        let list: number[];
        let how: string;
        if (kind === 'shift') {
          const c = rng.int(4, 25) * rng.pick([1, 1, -1]);
          list = base.map((x) => x + c);
          how = `each value of $S$ ${c > 0 ? 'plus' : 'minus'} ${Math.abs(c)}`;
        } else if (kind === 'reflect') {
          list = base.map((x) => -x);
          how = 'each value of $S$ times $-1$';
        } else if (kind === 'shiftreflect') {
          const c = base[base.length - 1] + rng.int(1, 12);
          list = base.map((x) => c - x);
          how = `${c} minus each value of $S$`;
        } else if (kind === 'scale') {
          const k = rng.pick([2, 3]);
          list = base.map((x) => k * x);
          how = `each value of $S$ times ${k}`;
        } else if (kind === 'partial') {
          const c = rng.int(3, 12);
          const cnt = rng.int(1, 2);
          const high = rng.chance(0.5);
          list = base.map((x, i) => (high ? i >= base.length - cnt : i < cnt) ? x + c : x);
          how = `${c} added to the ${cnt === 1 ? (high ? 'largest value' : 'smallest value') : `${high ? 'two largest' : 'two smallest'} values`} of $S$ only`;
        } else {
          const k = rng.pick([2, 3]);
          list = base.map((x) => m + k * (x - m));
          how = `each value of $S$ moved ${k} times as far from the mean, ${m}`;
        }
        const key = [...list].sort((a, b) => a - b).join(',');
        const same = variance(list).eq(variance(base));
        if (used.has(key) || list.some((x) => x < -200 || x > 400) || same !== (kind === 'shift' || kind === 'reflect' || kind === 'shiftreflect')) {
          failed = true;
          break;
        }
        used.add(key);
        items.push({ list: rng.shuffle(list), kind, how });
      }
      if (failed) continue;
      const ok = (k: Kind) => k === 'shift' || k === 'reflect' || k === 'shiftreflect';
      const trapOf: Record<Kind, string | undefined> = {
        shift: undefined,
        reflect: undefined,
        shiftreflect: undefined,
        scale: 'stat-sd-scale',
        partial: 'stat-sd-partial-shift',
        stretch: 'stat-sd-same-mean',
      };
      const { choices, answer } = flaggedChoices(items.map((it) => ({ text: `$${setTex(it.list)}$`, correct: ok(it.kind), ...(trapOf[it.kind] ? { trap: trapOf[it.kind] } : {}) })));
      const verdict: Record<Kind, string> = {
        shift: 'every distance from the mean is unchanged: same standard deviation.',
        reflect: 'the list is mirrored, so every distance from the mean is unchanged: same standard deviation.',
        shiftreflect: 'it mirrors the list and moves it, and neither changes any distance from the mean: same standard deviation.',
        scale: 'every distance from the mean is multiplied, so the standard deviation is multiplied too: different.',
        partial: 'the values move by different amounts, so the distances between them change: different.',
        stretch: 'the mean stays the same but every value sits farther from it, so the spread grows: different.',
      };
      const lines = items.map((it, i) => `- ${letter(i)}: ${it.how}. ${verdict[it.kind][0].toUpperCase()}${verdict[it.kind].slice(1)}`);
      const wi = items.findIndex((it) => !ok(it.kind));
      const trapLine: Record<string, string> = {
        'stat-sd-scale': `choice ${letter(wi)} multiplies every value, which is not a shift: a factor $k$ multiplies the standard deviation by $|k|$.`,
        'stat-sd-partial-shift': `choice ${letter(wi)} is tempting because it adds a number, but it adds it to some values only.`,
        'stat-sd-same-mean': `choice ${letter(wi)} keeps the mean of $S$, which is a wrong reason to expect the same spread.`,
      };
      const explanation = `The standard deviation measures how far the values sit from their mean, not where they sit on the number line. So decide, for each list, whether every distance from the mean is kept.

The mean of $S$ is ${m}. For each choice, the list is built from $S$ as follows:
${lines.join('\n')}

Trap: ${trapLine[trapOf[items[wi].kind]!]}

Rule: adding the same number to every value, or mirroring the list, keeps the standard deviation; multiplying by $k$ multiplies it by $|k|$.`;
      return {
        params: { base, lists: items.map((it) => it.list) },
        q: {
          format: 'mcm',
          stem: `Set $S$ is $${setTex(base)}$. Which of the following sets have the same standard deviation as set $S$?`,
          instruction: 'Indicate all such sets.',
          choices,
          answer,
          explanation,
        },
      };
    }
  },
  check(q, { base, lists }) {
    if (q.format !== 'mcm') return 'wrong format';
    // independent route: mean of squared deviations from the exact mean
    const byDeviation = (xs: number[]) => {
      const mean = new Frac(xs.reduce((a, x) => a + x, 0), xs.length);
      return xs.reduce((a, x) => a.add(new Frac(x).sub(mean).pow(2)), new Frac(0)).div(xs.length);
    };
    const v0 = byDeviation(base);
    const expected = lists.flatMap((l, i) => (byDeviation(l).eq(v0) ? [i] : []));
    return JSON.stringify(expected) === JSON.stringify(q.answer) ? null : `expected ${JSON.stringify(expected)}, keyed ${JSON.stringify(q.answer)}`;
  },
};

export const spreadSetTemplates: Template<any>[] = [spreadSetsMCM];
