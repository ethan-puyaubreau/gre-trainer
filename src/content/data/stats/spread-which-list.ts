import { letter, textChoices } from '../../../engine/build';
import type { Rng } from '../../../engine/rng';
import type { Template, Trap } from '../../../engine/types';
import { listTex, popSD } from './util';

export const spreadWhichListTraps: Record<string, Trap> = {
  'stat-sd-range-only': {
    label: 'Judged the spread by the range alone',
    fix: 'The range uses only the two extreme values. The standard deviation uses every value, so a list with a wide range and many values near the mean can have a small standard deviation.',
  },
  'stat-sd-distinct-count': {
    label: 'Chose the list with the most (or fewest) different values',
    fix: 'The number of different values does not measure spread. Look at how far the values sit from the mean, not at how many are different.',
  },
  'stat-sd-biggest-number': {
    label: 'Chose the list that contains the largest (or smallest) number',
    fix: 'One large number moves the standard deviation only by its distance from the mean, and the other values count too.',
  },
};

type Family = 'pairs' | 'two-point' | 'outlier' | 'two-outliers' | 'spaced' | 'clustered';
const FAMILIES: Family[] = ['pairs', 'two-point', 'outlier', 'two-outliers', 'spaced', 'clustered'];

interface Params {
  lists: number[][];
  ask: 'greatest' | 'least';
  mean: number;
}

function devsOf(f: Family, rng: Rng): number[] {
  if (f === 'pairs') {
    const [a, b, c] = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 3);
    return [a, -a, b, -b, c, -c];
  }
  if (f === 'two-point') {
    const a = rng.int(2, 10);
    return [a, a, a, -a, -a, -a];
  }
  if (f === 'outlier') {
    const c = rng.int(1, 4) * rng.sign();
    return [-c, -c, -c, -c, -c, 5 * c];
  }
  if (f === 'two-outliers') {
    const c = rng.int(6, 14);
    return [c, -c, 0, 0, 0, 0];
  }
  if (f === 'spaced') {
    const k = rng.int(1, 3);
    return [k, -k, 3 * k, -3 * k, 5 * k, -5 * k];
  }
  const [a, b, c] = [rng.int(0, 3), rng.int(0, 3), rng.int(0, 3)];
  return [a, -a, b, -b, c, -c];
}

const sumSq = (xs: number[]) => xs.reduce((s, x) => s + x * x, 0);
const spanOf = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
const distinct = (xs: number[]) => new Set(xs).size;
/** Index of the unique best element by key (null if tied). */
function unique(vals: number[], best: 'max' | 'min'): number | null {
  const target = best === 'max' ? Math.max(...vals) : Math.min(...vals);
  const idx = vals.flatMap((v, i) => (v === target ? [i] : []));
  return idx.length === 1 ? idx[0] : null;
}

const whichListMcs: Template<Params> = {
  id: 'data.spread.which-list-sd',
  skill: 'data.spread',
  format: 'mcs',
  style: 'which of five lists with the same mean has the greatest or least standard deviation',
  generate(rng, d) {
    const ratio = d === 1 ? 1.5 : d === 2 ? 1.25 : 1.1;
    for (;;) {
      const fams = rng.sample(FAMILIES, 5);
      const mean = rng.int(30, 70);
      const devs = fams.map((f) => devsOf(f, rng));
      const ss = devs.map(sumSq);
      const ask: Params['ask'] = d === 1 ? 'greatest' : rng.pick(['greatest', 'least']);
      const order = [...ss].sort((a, b) => a - b);
      const gap = ask === 'greatest' ? order[4] / order[3] : order[1] / Math.max(order[0], 1e-9);
      if (order[0] === 0 || gap < ratio) continue;
      const lists = devs.map((v) => v.map((x) => mean + x).sort((a, b) => a - b));
      if (new Set(lists.map((l) => l.join(','))).size < 5) continue;
      const key = ss.indexOf(ask === 'greatest' ? order[4] : order[0]);
      const spans = lists.map(spanOf);
      const dist = lists.map(distinct);
      const tops = lists.map((l) => l[5]);
      const bySpan = unique(spans, ask === 'greatest' ? 'max' : 'min');
      const byDist = unique(dist, ask === 'greatest' ? 'max' : 'min');
      const byTop = unique(tops, ask === 'greatest' ? 'max' : 'min');
      const traps = new Map<number, string>();
      for (const [i, id] of [[bySpan, 'stat-sd-range-only'], [byDist, 'stat-sd-distinct-count'], [byTop, 'stat-sd-biggest-number']] as [number | null, string][])
        if (i !== null && i !== key && !traps.has(i)) traps.set(i, id);
      const need = d === 3 ? 3 : 2;
      if (traps.size < need) continue;
      if (d === 3 && !(bySpan !== null && bySpan !== key && byDist !== null && byDist !== key)) continue;
      const text = (l: number[]) => `$\\{${listTex(l)}\\}$`;
      const wrong = lists.flatMap((l, i) => (i === key ? [] : [{ text: text(l), ...(traps.has(i) ? { trap: traps.get(i)! } : {}) }]));
      const ch = textChoices(rng, text(lists[key]), wrong);
      const idxOf = (t: string) => ch.choices.findIndex((c) => c.text === t);
      const lines = lists.map((l, i) => {
        const sq = devs[i].map((x) => x * x).sort((a, b) => a - b);
        return `- ${letter(idxOf(text(l)))}: $${sq.join(' + ')} = ${ss[i]}$`;
      });
      lines.sort();
      const [tIdx, tId] = [...traps.entries()][rng.int(0, traps.size - 1)];
      const tLetter = letter(idxOf(text(lists[tIdx])));
      const trapText: Record<string, string> = {
        'stat-sd-range-only': `choice ${tLetter} has ${ask === 'greatest' ? 'the widest' : 'the narrowest'} range, $${spans[tIdx]}$ wide, but its squares add up to only $${ss[tIdx]}$, so range alone misleads.`,
        'stat-sd-distinct-count': `choice ${tLetter} has ${ask === 'greatest' ? 'the most' : 'the fewest'} different values, $${dist[tIdx]}$ of them, yet its squares add up to $${ss[tIdx]}$.`,
        'stat-sd-biggest-number': `choice ${tLetter} holds ${ask === 'greatest' ? 'the largest' : 'the smallest top'} number, $${tops[tIdx]}$, but its squares add up to $${ss[tIdx]}$.`,
      };
      return {
        params: { lists, ask, mean },
        q: {
          format: 'mcs',
          stem: `Each of the following lists has six numbers and a mean of ${mean}. Which list has the ${ask === 'greatest' ? 'greatest' : 'least'} standard deviation?`,
          choices: ch.choices,
          answer: ch.answer,
          explanation: `With the same mean and the same number of values, the standard deviation ranks like the sum of the squared distances from the mean, so compare those sums.

Squared distances from ${mean} and their sums:
${lines.join('\n')}

The ${ask} sum is ${ss[key]}, in choice ${letter(ch.answer)}.

Trap: ${trapText[tId]}

Rule: the standard deviation depends on every value's distance from the mean, not on the extremes alone.`,
        },
      };
    }
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'wrong format';
    // floating-point standard deviations, independent of the sums of squares used to generate
    const sds = p.lists.map(popSD);
    const target = p.ask === 'greatest' ? Math.max(...sds) : Math.min(...sds);
    const winners = sds.flatMap((s, i) => (Math.abs(s - target) < 1e-9 ? [i] : []));
    if (winners.length !== 1) return 'tie';
    const want = `$\\{${p.lists[winners[0]].map(String).join(',\\ ')}\\}$`;
    return q.choices[q.answer].text === want ? null : `expected ${want}, keyed ${q.choices[q.answer].text}`;
  },
};

export const spreadWhichListTemplates: Template<any>[] = [whichListMcs];
