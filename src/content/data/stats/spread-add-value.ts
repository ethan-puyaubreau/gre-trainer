import { qcFromSamples } from '../../../engine/build';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import { listTex, popSD } from './util';

export const spreadAddValueTraps: Record<string, Trap> = {
  'stat-add-more-values-more-spread': {
    label: 'Assumed that adding a number always makes the data more spread out',
    fix: 'A new number changes the range only if it falls outside the old extremes, and it lowers the standard deviation if it sits close to the mean.',
  },
  'stat-add-need-x': {
    label: 'Said the relationship cannot be determined because the new number is not known exactly',
    fix: 'Look at the whole interval allowed for the new number. If every value in it gives the same comparison, the answer is determined.',
  },
};

type Kind = 'inside' | 'outside' | 'straddle' | 'near' | 'far';

interface Params {
  list: number[];
  lo: number;
  hi: number;
  stat: 'range' | 'sd';
  side: 'A' | 'B';
}

const flip = (c: QCChoice): QCChoice => (c === 'A' ? 'B' : c === 'B' ? 'A' : c);
const rangeOf = (xs: number[]) => Math.max(...xs) - Math.min(...xs);

const addValueQC: Template<Params> = {
  id: 'data.spread.add-value-qc',
  skill: 'data.spread',
  format: 'qc',
  style: 'a number from an interval is added to a list: does the range or standard deviation change?',
  generate(rng, d) {
    const stat: Params['stat'] = d === 1 ? 'range' : d === 2 ? rng.pick(['range', 'sd']) : 'sd';
    const side: 'A' | 'B' = rng.chance(0.5) ? 'A' : 'B';
    for (;;) {
      const n = rng.int(d === 1 ? 5 : 6, d === 3 ? 8 : 7);
      const devs = rng.sample(Array.from({ length: 19 }, (_, i) => i - 9).filter((x) => x !== 0), n - 1);
      const last = -devs.reduce((s, x) => s + x, 0);
      if (last === 0 || devs.includes(last) || Math.abs(last) > 12) continue;
      const m = rng.int(30, 70);
      const list = [...devs, last].map((x) => m + x).sort((a, b) => a - b);
      const kind: Kind =
        stat === 'range'
          ? rng.pick<Kind>(d === 1 ? ['inside', 'inside', 'outside', 'outside', 'outside', 'straddle'] : ['inside', 'straddle', 'straddle', 'outside'])
          : rng.pick<Kind>(d === 2 ? ['near', 'near', 'far', 'far', 'straddle'] : ['near', 'far', 'straddle', 'straddle']);
      const sigma = popSD(list);
      const mn = list[0];
      const mx = list[n - 1];
      // classify one integer x for the chosen statistic: -1 = pushes the statistic down, 0 = unchanged, 1 = up, 9 = unclear
      const effect = (x: number): number => {
        if (stat === 'range') return x < mn || x > mx ? 1 : 0;
        const dev = Math.abs(x - m);
        return dev <= sigma - 0.2 ? -1 : dev >= 2 * sigma ? 1 : 9;
      };
      let lo = 0;
      let hi = 0;
      let found = false;
      for (let tries = 0; tries < 300 && !found; tries++) {
        lo = m + rng.int(-4 * 9, 4 * 9);
        if (lo < 1) continue;
        hi = lo + rng.int(2, 7);
        const xs = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
        const es = xs.map(effect);
        if (es.includes(9)) continue;
        const ups = es.filter((e) => e === 1).length;
        const downs = es.filter((e) => e === -1).length;
        const flats = es.filter((e) => e === 0).length;
        if (stat === 'range') {
          found = kind === 'inside' ? flats === xs.length : kind === 'outside' ? ups === xs.length : ups > 0 && flats > 0;
        } else {
          found = kind === 'near' ? downs === xs.length : kind === 'far' ? ups === xs.length : ups > 0 && downs > 0;
        }
      }
      if (!found) continue;
      const ansNew: QCChoice =
        kind === 'inside' ? 'C' : kind === 'outside' || kind === 'far' ? 'A' : kind === 'near' ? 'B' : 'D';
      const ans: QCChoice = side === 'A' ? ansNew : flip(ansNew);
      const wrongLetter = (target: QCChoice): QCChoice => (side === 'A' ? target : flip(target));
      const traps: QCQuestion['traps'] =
        kind === 'inside'
          ? { [wrongLetter('A')]: 'stat-add-more-values-more-spread' }
          : kind === 'near'
            ? { [wrongLetter('A')]: 'stat-add-more-values-more-spread' }
            : kind === 'straddle'
              ? undefined
              : { D: 'stat-add-need-x' };
      const word = stat === 'range' ? 'range' : 'standard deviation';
      const newQ = `The ${word} of the new list`;
      const oldQ = `The ${word} of the original list`;
      const setTex = `\\{${listTex(list)}\\}`;
      const sdStr = sigma.toFixed(1);
      let why: string;
      if (stat === 'range') {
        why =
          kind === 'inside'
            ? `The range is the greatest value minus the least, here $${mx} - ${mn} = ${mx - mn}$. A new number changes it only by becoming the new greatest or least value. Every allowed $x$, from ${lo} to ${hi}, lies between ${mn} and ${mx}, so the range stays ${mx - mn}: the quantities are equal.`
            : kind === 'outside'
              ? `The range is the greatest value minus the least, here $${mx} - ${mn} = ${mx - mn}$. A new number changes it only by going beyond ${mn} or ${mx}. Every allowed $x$, from ${lo} to ${hi}, is ${hi < mn || lo > mx ? 'outside' : 'beyond'} that interval, so the new range is greater (for example $x = ${lo < mn ? lo : hi}$ gives ${lo < mn ? mx - lo : hi - mn}).`
              : `The range is the greatest value minus the least, here $${mx} - ${mn} = ${mx - mn}$. If $x$ falls between ${mn} and ${mx}, the range stays ${mx - mn}. If $x$ goes beyond them it grows: $x = ${lo < mn ? lo : hi}$ gives ${lo < mn ? mx - lo : hi - mn}. The interval allows both, so the relationship cannot be determined.`;
      } else {
        why =
          kind === 'near'
            ? `The mean of the original list is ${m} and its standard deviation is about ${sdStr}. A new number within one standard deviation of the mean is closer to the center than a typical value, and the mean stays put or barely moves, so the standard deviation goes down. Every allowed $x$ (from ${lo} to ${hi}) is within ${sdStr} of ${m}.`
            : kind === 'far'
              ? `The mean of the original list is ${m} and its standard deviation is about ${sdStr}. A new number much farther from the mean than a typical value stretches the data and raises the standard deviation. Every allowed $x$ (from ${lo} to ${hi}) is more than ${(2 * sigma).toFixed(1)} from ${m}.`
              : `The mean of the original list is ${m} and its standard deviation is about ${sdStr}. A new number close to the mean lowers the standard deviation; one far from it raises it. The interval from ${lo} to ${hi} holds both kinds (${Math.abs(lo - m) < Math.abs(hi - m) ? lo : hi} is close to ${m}, ${Math.abs(lo - m) < Math.abs(hi - m) ? hi : lo} is far), so the relationship cannot be determined.`;
      }
      const trapLine =
        kind === 'inside'
          ? 'Trap: a new number does not always widen the list; it widens it only if it falls outside the old extremes.'
          : kind === 'near'
            ? 'Trap: more values do not mean more spread; a value near the mean lowers the standard deviation.'
            : kind === 'straddle'
              ? 'Trap: testing one value of $x$ proves nothing; test one near the center and one far from it.'
              : 'Trap: the exact value of $x$ is not needed when every allowed value gives the same comparison.';
      return {
        params: { list, lo, hi, stat, side },
        q: {
          format: 'qc',
          info: `List $S$ is $${setTex}$. One more integer, $x$, is added to the list, where $${lo} \\le x \\le ${hi}$.`,
          quantityA: side === 'A' ? newQ : oldQ,
          quantityB: side === 'A' ? oldQ : newQ,
          answer: ans,
          ...(traps ? { traps } : {}),
          explanation: `Decide how a new number acts on the statistic, then check the whole allowed interval.

${why}

${trapLine}

Rule: the range reacts only to a new extreme; the standard deviation falls when the new value sits near the mean and rises when it sits far from it.`,
        },
      };
    }
  },
  check(q, p) {
    if (q.format !== 'qc') return 'wrong format';
    const stat = (xs: number[]) => (p.stat === 'range' ? rangeOf(xs) : popSD(xs));
    const samples: [number, number][] = [];
    for (let x = p.lo; x <= p.hi; x++) samples.push([stat([...p.list, x]), stat(p.list)]);
    const a = qcFromSamples(samples);
    const expected = p.side === 'A' ? a : flip(a);
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

export const spreadAddValueTemplates: Template<any>[] = [addValueQC];
