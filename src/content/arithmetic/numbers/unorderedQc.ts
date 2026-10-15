import { qcCompare, qcFromSamples } from '../../../engine/build';
import type { Rng } from '../../../engine/rng';
import { num } from '../../../engine/tex';
import type { Difficulty, QCChoice, Template, Trap } from '../../../engine/types';
import { expectQC, pickWeighted, qcEnd, swapQC } from './util';

export const unorderedTraps: Record<string, Trap> = {
  'nl-order-assumed': {
    label: 'Assumed the points lie on the line in the order of their letters',
    fix: 'Two distances do not fix the arrangement. $PQ = 5$ and $QR = 3$ allow $PR = 8$ (Q between) or $PR = 2$ (R between P and Q, or beyond). Sketch every arrangement the conditions allow.',
  },
};

type Cond = 'none' | 'between12' | 'not12' | 'between23';
interface Params {
  dists: number[];
  cond: Cond;
  B: number;
  swap: boolean;
  names: string;
}

const LETTERS = ['PQRS', 'XYZW', 'ABCD', 'JKLM'];

/** All allowed step signs for the distances under the condition. */
function arrangements(dists: number[], cond: Cond): number[][] {
  const n = dists.length;
  const out: number[][] = [];
  for (let m = 0; m < 1 << n; m++) {
    const s = Array.from({ length: n }, (_, i) => (m >> i & 1 ? 1 : -1));
    if (cond === 'between12' && s[0] !== s[1]) continue;
    if (cond === 'not12' && s[0] === s[1]) continue;
    if (cond === 'between23' && s[1] !== s[2]) continue;
    out.push(s);
  }
  return out.filter((s) => new Set(positions(dists, s)).size === dists.length + 1);
}

function positions(dists: number[], s: number[]) {
  const pos = [0];
  dists.forEach((d, i) => pos.push(pos[i] + s[i] * d));
  return pos;
}

const unordered: Template<Params> = {
  id: 'arith.number-line.unordered-distance-qc',
  skill: 'arith.number-line',
  format: 'qc',
  style: 'distance between the end points when the order of the points on the line is not given',
  generate(rng: Rng, diff: Difficulty) {
    let target = pickWeighted<QCChoice>(rng, [['A', 1], ['B', 1], ['C', 1], ['D', 1.3]]);
    for (let tries = 1; ; tries++) {
      if (tries % 50 === 0) target = pickWeighted<QCChoice>(rng, [['A', 1], ['B', 1], ['D', 1]]);
      const n = diff === 3 ? 3 : 2;
      const dists = Array.from({ length: n }, () => rng.int(diff === 3 ? 1 : 2, diff === 1 ? 9 : 12));
      if (n === 2 && dists[0] === dists[1]) continue;
      const cond: Cond =
        diff === 1 ? rng.pick(['between12', 'not12']) : diff === 2 ? rng.pick(['none', 'none', 'between12', 'not12']) : rng.pick(['none', 'between12', 'between23']);
      const arr = arrangements(dists, cond);
      if (!arr.length) continue;
      const vals = [...new Set(arr.map((s) => Math.abs(positions(dists, s)[n])))].sort((x, y) => x - y);
      const pool = new Set<number>();
      for (const v of vals) for (const dv of [0, 0, 1, -1, 2]) pool.add(v + dv);
      for (const x of dists) pool.add(x);
      const B = rng.pick([...pool].filter((x) => x > 0));
      const rels = new Set(vals.map((v) => qcCompare(v, B)));
      const rel: QCChoice = rels.size > 1 ? 'D' : [...rels][0];
      if (rel !== target) continue;
      const swap = rng.chance(0.5);
      const names = rng.pick(LETTERS);
      const L = names.slice(0, n + 1).split('');
      const answer = swap ? swapQC(rel) : rel;
      // the naive reading: the points are in order, so every step goes the same way
      const naive = dists.reduce((x, y) => x + y, 0);
      const naiveRel = qcCompare(naive, B);
      const naiveLetter = swap ? swapQC(naiveRel) : naiveRel;
      const lenTxt = n === 2 ? `${L[0]}${L[1]} = ${dists[0]}$ and $${L[1]}${L[2]} = ${dists[1]}` : `${L[0]}${L[1]} = ${dists[0]}$, $${L[1]}${L[2]} = ${dists[1]}$, and $${L[2]}${L[3]} = ${dists[2]}`;
      const condTxt: Record<Cond, string> = {
        none: '',
        between12: ` $${L[1]}$ is between $${L[0]}$ and $${L[2]}$.`,
        not12: ` $${L[1]}$ is not between $${L[0]}$ and $${L[2]}$.`,
        between23: ` $${L[2]}$ is between $${L[1]}$ and $${L[3]}$.`,
      };
      const ends = `$${L[0]}$ and $${L[n]}$`;
      const qa = `The distance between ${ends}`;
      const qb = `$${B}$`;
      // one example arrangement for each possible value
      const examples = vals.map((v) => {
        const s = arr.find((x) => Math.abs(positions(dists, x)[n]) === v)!;
        const pos = positions(dists, s);
        return `$${L.map((l, i) => `${l} = ${num(pos[i])}`).join(', ')}$ gives $${L[0]}${L[n]} = ${v}$`;
      });
      const sentenceCond = cond === 'none' ? 'Nothing says in what order the points lie, so every arrangement is allowed.' : 'The condition rules out some arrangements.';
      const verdict =
        rel === 'D'
          ? `Compared with ${B}, the possible distances ${vals.join(', ')} come out ${[...new Set(vals.map((v) => (v < B ? 'less' : v > B ? 'greater' : 'equal')))].join(' or ')}, depending on the arrangement.`
          : rel === 'C'
            ? `The only possible distance is ${B}.`
            : `Every possible distance is ${rel === 'A' ? 'greater' : 'less'} than ${B}.`;
      return {
        params: { dists, cond, B, swap, names },
        q: {
          format: 'qc',
          info: `Points $${L.join('$, $')}$ lie on a number line. $${lenTxt}$.${condTxt[cond]}`,
          quantityA: swap ? qb : qa,
          quantityB: swap ? qa : qb,
          answer,
          ...(naiveLetter !== answer ? { traps: { [naiveLetter]: 'nl-order-assumed' } } : {}),
          explanation: `Recognize: the letters do not fix the order of the points, so the distance can change with the arrangement.

Put $${L[0]}$ at 0 and move from point to point by the given distances, to the right or to the left. ${sentenceCond} Allowed arrangements: ${examples.join('; ')}. ${verdict}${
            naiveLetter !== answer ? ` Trap: adding all the distances, $${naive}$, assumes the points are in order and suggests ${naiveLetter}.` : ''
          }

With distances only, test every arrangement the conditions allow. ${qcEnd(answer)}`,
        },
      };
    }
  },
  check(q, { dists, cond, B, swap }) {
    // Enumerate explicit coordinates and apply the betweenness conditions geometrically.
    const n = dists.length;
    const pairs: [number, number][] = [];
    for (let m = 0; m < 1 << n; m++) {
      const pos = [0];
      for (let i = 0; i < n; i++) pos.push(pos[i] + (m >> i & 1 ? dists[i] : -dists[i]));
      const between = (x: number, y: number, z: number) => Math.min(y, z) < x && x < Math.max(y, z);
      if (cond === 'between12' && !between(pos[1], pos[0], pos[2])) continue;
      if (cond === 'not12' && between(pos[1], pos[0], pos[2])) continue;
      if (cond === 'between23' && !between(pos[2], pos[1], pos[3])) continue;
      if (new Set(pos).size !== pos.length) continue;
      const D = Math.abs(pos[n] - pos[0]);
      pairs.push(swap ? [B, D] : [D, B]);
    }
    return expectQC(q, qcFromSamples(pairs));
  },
};

export const unorderedTemplates: Template<any>[] = [unordered];
