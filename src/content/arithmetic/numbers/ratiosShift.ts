import { qcFromSamples } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { gcd } from '../../../engine/math';
import { fr as frTex } from '../../../engine/tex';
import { plural } from '../../../engine/text';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import { expectQC, F, pickWeighted, qcEnd, swapQC } from './util';

export const ratioShiftTraps: Record<string, Trap> = {
  'rat-add-keeps-ratio': {
    label: 'Assumed that changing both groups leaves the ratio alone',
    fix: 'Only multiplying (or dividing) both terms keeps a ratio. Adding or removing the same number moves it toward $1 : 1$ or away from it: $\\frac{2+3}{5+3} = \\frac{5}{8}$ is not $\\frac{2}{5}$.',
  },
};

type Mode = 'add-known' | 'remove-known' | 'scale' | 'add-unknown' | 'remove-unknown' | 'mix-known' | 'mix-unknown';

interface RSParams {
  mode: Mode;
  /** known ratio or known counts */
  p: number;
  q: number;
  /** amount added or removed from the first / second group */
  x: number;
  y: number;
  swap: boolean;
}

const CTX = [
  { n1: 'boys', n2: 'girls', s1: 'boy', s2: 'girl', grp: 'A club', verb: ['join the club', 'leave the club'] },
  { n1: 'cats', n2: 'dogs', s1: 'cat', s2: 'dog', grp: 'A shelter', verb: ['arrive at the shelter', 'are adopted'] },
  { n1: 'red marbles', n2: 'blue marbles', s1: 'red marble', s2: 'blue marble', grp: 'A bag', verb: ['are put in the bag', 'are taken out of the bag'] },
];

const coprimePair = (rng: { int(a: number, b: number): number }, lo: number, hi: number): [number, number] => {
  for (;;) {
    const p = rng.int(lo, hi);
    const q = rng.int(lo, hi);
    if (p !== q && gcd(p, q) === 1) return [p, q];
  }
};

const shiftQC: Template<RSParams> = {
  id: 'arith.ratios.shift-qc',
  skill: 'arith.ratios',
  format: 'qc',
  style: 'what adding or removing the same amount does to a ratio',
  generate(rng, d) {
    const ctx = rng.pick(CTX);
    const mode = pickWeighted<Mode>(
      rng,
      d === 1
        ? [
            ['add-known', 4],
            ['scale', 2],
            ['add-unknown', 2],
          ]
        : d === 2
          ? [
              ['add-known', 2.5],
              ['remove-known', 2.5],
              ['scale', 1.5],
              ['add-unknown', 1.2],
              ['remove-unknown', 1.2],
            ]
          : [
              ['mix-known', 6],
              ['mix-unknown', 2],
            ],
    );
    const swap = rng.chance(0.45);
    const { n1, n2, grp } = ctx;
    const c1 = (n: number) => plural(n, ctx.s1, ctx.n1);
    const c2 = (n: number) => plural(n, ctx.s2, ctx.n2);
    const [p, q] = d === 1 ? coprimePair(rng, 1, 6) : coprimePair(rng, 2, 12);
    let x = d === 1 ? rng.int(2, 9) : rng.int(2, 15);
    let y = x;
    const fr = (a: number, b: number) => `$${frTex(a, b)}$`;
    const done = (pp: number, qq: number, rel: QCChoice, info: string, rec: string, why: string) =>
      finish({ mode, p: pp, q: qq, x, y, swap }, rel, info, rec, why, ctx);
    const ADD = 'Recognize: the same amount is added to both groups, which is not the same as multiplying both by one factor.';
    if (mode === 'add-known')
      return done(
        p,
        q,
        p < q ? 'A' : 'B',
        `The ratio of ${n1} to ${n2} in ${grp.toLowerCase()} is ${p} to ${q}. Then ${x} more ${n1} and ${x} more ${n2} ${ctx.verb[0]}.`,
        ADD,
        `Adding the same number to both terms pulls the ratio toward $1 : 1$. Test with ${c1(p)} and ${c2(q)}: ${fr(p, q)} becomes ${fr(p + x, q + x)}, which is ${p < q ? 'greater' : 'less'} because the ratio was ${p < q ? 'below' : 'above'} 1. Doubling the counts to ${p * 2} and ${q * 2} gives ${fr(p * 2 + x, q * 2 + x)}, still ${p < q ? 'greater' : 'less'} than ${fr(p, q)}.`,
      );
    if (mode === 'remove-known') {
      let b: number;
      let g: number;
      do {
        b = rng.int(8, 40);
        g = rng.int(8, 40);
        x = rng.int(2, Math.min(b, g) - 2);
      } while (b === g || gcd(b, g) !== 1);
      y = x;
      return done(
        b,
        g,
        b < g ? 'B' : 'A',
        `${grp} has ${b} ${n1} and ${g} ${n2}. Then ${x} ${n1} and ${x} ${n2} ${ctx.verb[1]}.`,
        'Recognize: the same amount is removed from both groups, which is not the same as dividing both by one factor.',
        `Removing the same number from both terms pushes the ratio away from $1 : 1$. Before: ${fr(b, g)}. After: ${fr(b - x, g - x)}, which is ${b < g ? 'smaller' : 'larger'} because the ratio was ${b < g ? 'below' : 'above'} 1. For instance ${fr(3, 5)} becomes ${fr(1, 3)} when 2 are removed from each.`,
      );
    }
    if (mode === 'scale') {
      x = rng.pick([2, 3, 4, 5]);
      y = x;
      return done(
        p,
        q,
        'C',
        `The ratio of ${n1} to ${n2} in ${grp.toLowerCase()} is ${p} to ${q}. Later, the number of ${n1} and the number of ${n2} are each multiplied by ${x}.`,
        'Recognize: both numbers are multiplied by the same factor.',
        `Multiplying both terms by ${x} keeps the ratio: ${fr(x * p, x * q)} becomes ${fr(p, q)} after dividing top and bottom by ${x}. Adding ${x} to both would not: ${fr(p + x, q + x)} differs from ${fr(p, q)}.`,
      );
    }
    if (mode === 'add-unknown' || mode === 'remove-unknown') {
      const add = mode === 'add-unknown';
      const lo = add ? 1 : x + 1;
      const mv = (b: number, g: number) => (add ? fr(b + x, g + x) : fr(b - x, g - x));
      const info = add
        ? `The numbers of ${n1} and ${n2} in ${grp.toLowerCase()} are positive integers that are not equal. Then ${x} more ${n1} and ${x} more ${n2} ${ctx.verb[0]}.`
        : `The numbers of ${n1} and ${n2} in ${grp.toLowerCase()} are integers greater than ${x} that are not equal. Then ${x} ${n1} and ${x} ${n2} ${ctx.verb[1]}.`;
      return done(
        p,
        q,
        'D',
        info,
        add ? ADD : 'Recognize: the same amount is removed from both groups, which is not the same as dividing both by one factor.',
        `Which way the ratio moves depends on which group is larger. With ${c1(lo + 2)} and ${c2(lo)}, ${fr(lo + 2, lo)} becomes ${mv(lo + 2, lo)} (${add ? 'down' : 'up'}). With ${c1(lo)} and ${c2(lo + 2)}, ${fr(lo, lo + 2)} becomes ${mv(lo, lo + 2)} (${add ? 'up' : 'down'}). Two allowed cases disagree.`,
      );
    }
    const MIX = 'Recognize: different amounts are added to the two groups, so the new ratio lies between the old ratio and the ratio of the newcomers.';
    if (mode === 'mix-known') {
      if (rng.chance(0.34)) {
        const k = rng.int(1, 4);
        x = p * k;
        y = q * k;
        return done(
          p,
          q,
          'C',
          `The ratio of ${n1} to ${n2} in ${grp.toLowerCase()} is ${p} to ${q}. Then ${x} more ${n1} and ${y} more ${n2} ${ctx.verb[0]}.`,
          MIX,
          `The newcomers are in the ratio ${x} to ${y}, which reduces to ${p} to ${q}, the ratio of the group they join. With ${p}m and ${q}m before, after there are ${p}(m + ${k}) and ${q}(m + ${k}), so the ratio is still ${fr(p, q)}.`,
        );
      }
      let a: number;
      let b: number;
      do [a, b] = [rng.int(2, 14), rng.int(2, 14)];
      while (a * q === b * p);
      x = a;
      y = b;
      const up = a * q > b * p;
      return done(
        p,
        q,
        up ? 'A' : 'B',
        `The ratio of ${n1} to ${n2} in ${grp.toLowerCase()} is ${p} to ${q}. Then ${a} more ${n1} and ${b} more ${n2} ${ctx.verb[0]}.`,
        MIX,
        `The newcomers are in the ratio ${fr(a, b)}, which is ${up ? 'greater' : 'less'} than ${fr(p, q)}, so the ratio of the whole group moves ${up ? 'up' : 'down'} toward it. Test with ${p} and ${q}: ${fr(p + a, q + b)} against ${fr(p, q)}.`,
      );
    }
    let a: number;
    let b: number;
    do [a, b] = [rng.int(2, 12), rng.int(2, 12)];
    while (a === b);
    x = a;
    y = b;
    return done(
      p,
      q,
      'D',
      `The numbers of ${n1} and ${n2} in ${grp.toLowerCase()} are positive integers. Then ${a} more ${n1} and ${b} more ${n2} ${ctx.verb[0]}.`,
      MIX,
      `The new ratio moves toward the newcomers' ratio ${fr(a, b)}: it falls if the group started above it and rises if below. Start with ${c1(2 * a)} and ${c2(b)}: ${fr(2 * a, b)} becomes ${fr(3 * a, 2 * b)} (down). Start with ${c1(a)} and ${c2(2 * b)}: ${fr(a, 2 * b)} becomes ${fr(2 * a, 3 * b)} (up).`,
    );
  },
  check(q, { mode, p, q: qq, x, y, swap }) {
    let samples: [Frac, Frac][] = [];
    const ms = Array.from({ length: 24 }, (_, i) => i + 1);
    if (mode === 'add-known' || mode === 'scale' || mode === 'mix-known') {
      // counts are any multiple of p and q
      for (const m of ms) {
        const [b, g] = [p * m, qq * m];
        const [b2, g2] = mode === 'scale' ? [b * x, g * y] : [b + x, g + y];
        samples.push([F(b2, g2), F(b, g)]);
      }
    } else if (mode === 'remove-known') samples.push([F(p - x, qq - y), F(p, qq)]);
    else {
      // unknown counts: every allowed pair
      const lo = mode === 'remove-unknown' ? x + 1 : 1;
      for (let b = lo; b <= lo + 12; b++)
        for (let g = lo; g <= lo + 12; g++) {
          if (mode !== 'mix-unknown' && b === g) continue;
          samples.push(mode === 'remove-unknown' ? [F(b - x, g - y), F(b, g)] : [F(b + x, g + y), F(b, g)]);
        }
    }
    if (swap) samples = samples.map(([a, b]) => [b, a]);
    return expectQC(q, qcFromSamples(samples));
  },
};

function finish(params: RSParams, relRaw: QCChoice, info: string, rec: string, why: string, ctx: (typeof CTX)[number]): { params: RSParams; q: QCQuestion } {
  const answer = params.swap ? swapQC(relRaw) : relRaw;
  const A = `The ratio of ${ctx.n1} to ${ctx.n2} after the change`;
  const B = `The ratio of ${ctx.n1} to ${ctx.n2} before the change`;
  return {
    params,
    q: {
      format: 'qc',
      info,
      quantityA: params.swap ? B : A,
      quantityB: params.swap ? A : B,
      answer,
      traps: answer === 'C' ? undefined : { C: 'rat-add-keeps-ratio' },
      explanation: `${rec}

${why}

${qcEnd(answer)} Multiplying both terms keeps a ratio; adding to both terms moves it toward the ratio of what was added.`,
    },
  };
}

export const ratioShiftTemplates: Template<any>[] = [shiftQC];
