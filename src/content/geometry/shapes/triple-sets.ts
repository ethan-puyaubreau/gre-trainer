import { flaggedChoices } from '../../../engine/build';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { trapNotes } from '../notes';
import { Redraw, retryAll } from '../redraw';

/* Which sets of three lengths can be the sides of a right triangle (MCM). */

export const tripleSetTraps: Record<string, Trap> = {
  'geo-rt-near-miss': {
    label: 'Accepted a set that is close to a right triangle',
    fix: 'The test is exact: the squares of the two shorter sides must add up to the square of the longest. $4^2 + 5^2 = 41$ is close to $6^2 = 36$, but not equal.',
  },
  'geo-rt-sum-of-legs': {
    label: 'Added the shorter sides instead of their squares',
    fix: 'In a right triangle $a^2 + b^2 = c^2$, not $a + b = c$. In fact $a + b > c$ for every triangle, so a set with $a + b = c$ is not even a triangle.',
  },
  'geo-rt-no-root': {
    label: 'Forgot the square root of the sum of squares',
    fix: 'The hypotenuse is $\\sqrt{a^2 + b^2}$. A longest side equal to $a^2 + b^2$ itself is far too long: it breaks the triangle inequality.',
  },
  'geo-rt-squares-listed': {
    label: 'Took the squares of a Pythagorean triple as the sides',
    fix: 'If $3, 4, 5$ is a right triangle, the numbers $9, 16, 25$ are NOT: $9^2 + 16^2 = 337$, not $25^2 = 625$. Square the sides only inside the test.',
  },
  'geo-rt-45-doubled': {
    label: 'Took the hypotenuse of an isosceles right triangle as twice a leg',
    fix: 'The hypotenuse of a 45-45-90 triangle is a leg times $\\sqrt{2}$, about $1.41$ legs. Twice a leg would break the triangle: two legs of length $k$ leave no room for a side of $2k$.',
  },
  'geo-rt-ratio-mixed': {
    label: 'Mixed up the 45-45-90 and 30-60-90 ratios',
    fix: '45-45-90: $k, k, k\\sqrt{2}$. 30-60-90: $k, k\\sqrt{3}, 2k$. Check by squaring: $k^2 + 2k^2 = 3k^2$, which is not $4k^2$.',
  },
};

interface S {
  tex: string;
  sq: number;
}
interface Item {
  sides: S[];
  right: boolean;
  trap?: string;
}
interface Params {
  sets: number[][]; // squares of the sides of each choice
}

const int = (v: number): S => ({ tex: num(v), sq: v * v });
const rad = (k: number, q: number): S => ({ tex: k === 1 ? `\\sqrt{${q}}` : `${k}\\sqrt{${q}}`, sq: k * k * q });

const INT_TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
  [9, 40, 41],
];
/** n < p with p^2 - n^2 not a perfect square: the triple (sqrt(m), n, p). */
const RAD_PAIRS: [number, number][] = [
  [2, 3],
  [3, 4],
  [5, 6],
  [6, 7],
  [2, 4],
  [4, 6],
  [2, 5],
  [3, 6],
];

const isRight = (sq: number[]) => {
  const [a, b, c] = [...sq].sort((x, y) => x - y);
  return a + b === c;
};

const triples: Template<Params> = {
  id: 'geo.right-triangles.triples-mcm',
  skill: 'geo.right-triangles',
  format: 'mcm',
  style: 'which sets of three lengths can be the sides of a right triangle',
  generate(rng, d) {
    const nTrue = rng.int(1, 3);
    const nFalse = 6 - nTrue;
    const trueItems: Item[] = [];
    const falseItems: Item[] = [];
    const intTriple = (maxScale: number) => {
      const [a, b, c] = rng.pick(INT_TRIPLES);
      const k = rng.int(1, Math.min(maxScale, Math.floor(45 / c) || 1));
      return [a * k, b * k, c * k] as [number, number, number];
    };
    const radTriple = () => {
      const [n, p] = rng.pick(RAD_PAIRS);
      return { m: p * p - n * n, n, p };
    };
    const makeTrue = (): Item => {
      if (d === 1) {
        const [a, b, c] = intTriple(2);
        return { sides: [int(a), int(b), int(c)], right: true };
      }
      if (d === 2) {
        const t = rng.pick(['int', 'int', 'int', 'iso']);
        if (t === 'iso') {
          const k = rng.int(2, 9);
          return { sides: [int(k), int(k), rad(k, 2)], right: true };
        }
        const [a, b, c] = intTriple(4);
        return { sides: [int(a), int(b), int(c)], right: true };
      }
      const t = rng.pick(['iso', 'sixty', 'pair', 'pair']);
      if (t === 'iso') {
        const k = rng.int(2, 9);
        return { sides: [int(k), int(k), rad(k, 2)], right: true };
      }
      if (t === 'sixty') {
        const k = rng.int(2, 9);
        return { sides: [int(k), rad(k, 3), int(2 * k)], right: true };
      }
      const { m, n, p } = radTriple();
      return { sides: [rad(1, m), int(n), int(p)], right: true };
    };
    const makeFalse = (): Item => {
      const kinds = d === 1 ? ['near', 'near', 'sum', 'noroot'] : d === 2 ? ['near', 'sum', 'noroot', 'squares', 'doubled'] : ['near', 'near', 'doubled', 'mixed', 'sum', 'noroot'];
      const kind = rng.pick(kinds);
      if (kind === 'near') {
        if (d === 3 && rng.chance(0.6)) {
          const { m, n, p } = radTriple();
          const m2 = m + rng.pick([-1, 1]);
          return { sides: [rad(1, m2), int(n), int(p)], right: false, trap: 'geo-rt-near-miss' };
        }
        const [a, b, c] = intTriple(d === 1 ? 2 : 4);
        const which = rng.int(0, 2);
        const delta = rng.pick([-1, 1]);
        const s = [a, b, c];
        s[which] += delta;
        return { sides: s.map(int), right: false, trap: 'geo-rt-near-miss' };
      }
      if (kind === 'sum') {
        const [a, b] = intTriple(2);
        return { sides: [int(a), int(b), int(a + b)], right: false, trap: 'geo-rt-sum-of-legs' };
      }
      if (kind === 'noroot') {
        const a = rng.int(3, 9);
        const b = rng.int(3, 9);
        if (a === b) throw new Redraw('equal legs');
        return { sides: [int(a), int(b), int(a * a + b * b)], right: false, trap: 'geo-rt-no-root' };
      }
      if (kind === 'squares') {
        const [a, b, c] = intTriple(1);
        return { sides: [int(a * a), int(b * b), int(c * c)], right: false, trap: 'geo-rt-squares-listed' };
      }
      if (kind === 'doubled') {
        const k = rng.int(2, 9);
        return { sides: [int(k), int(k), int(2 * k)], right: false, trap: 'geo-rt-45-doubled' };
      }
      const k = rng.int(2, 9);
      return { sides: [int(k), rad(k, 2), int(2 * k)], right: false, trap: 'geo-rt-ratio-mixed' };
    };
    while (trueItems.length < nTrue) trueItems.push(makeTrue());
    let guard = 0;
    while (falseItems.length < nFalse && guard++ < 60) falseItems.push(makeFalse());
    const all = [...trueItems, ...falseItems];
    for (const it of all) if (isRight(it.sides.map((s) => s.sq)) !== it.right) throw new Redraw('a decoy is right or a true set is not');
    const sig = all.map((it) => it.sides.map((x) => x.sq).sort((x, y) => x - y).join(','));
    if (new Set(sig).size !== sig.length) throw new Redraw('the same set twice');
    const items = all.map((it) => ({ ...it, sides: rng.shuffle(it.sides) }));
    const texts = items.map((it) => it.sides.map((s) => `$${s.tex}$`).join(', '));
    if (new Set(texts).size !== texts.length) throw new Redraw('duplicate sets');
    const order = rng.shuffle(items.map((_, i) => i));
    const shown = order.map((i) => ({ it: items[i], text: texts[i] }));
    const { choices, answer } = flaggedChoices(shown.map(({ it, text }) => ({ text, correct: it.right, ...(it.trap ? { trap: it.trap } : {}) })));
    const lines = shown
      .map(({ it, text }) => {
        const sq = it.sides.map((s) => s.sq).sort((x, y) => x - y);
        const sum = sq[0] + sq[1];
        return `- ${text}: the squares are $${num(sq[0])}$, $${num(sq[1])}$, $${num(sq[2])}$, and $${num(sq[0])} + ${num(sq[1])} = ${num(sum)}$${sum === sq[2] ? `, equal to the largest square. A right triangle.` : `, not $${num(sq[2])}$. Not a right triangle.`}`;
      })
      .join('\n');
    const notes = trapNotes(
      choices,
      {
        'geo-rt-near-miss': (vs) => `${vs} is close to a right triangle, but the squares must match exactly`,
        'geo-rt-sum-of-legs': (vs) => `${vs} comes from adding the shorter sides to get the longest, instead of adding their squares`,
        'geo-rt-no-root': (vs) => `${vs} uses the sum of the squares as the longest side and forgets the square root`,
        'geo-rt-squares-listed': (vs) => `${vs} lists the squares of a real right triangle, not its sides`,
        'geo-rt-45-doubled': (vs) => `${vs} takes the hypotenuse of an isosceles right triangle to be twice a leg, when it is a leg times $\\sqrt{2}$`,
        'geo-rt-ratio-mixed': (vs) => `${vs} mixes the 45-45-90 ratio with the 30-60-90 ratio`,
      },
      2,
    );
    return {
      params: { sets: items.map((it) => it.sides.map((s) => s.sq)).map((sq, i) => [...sq, order.indexOf(i)]) },
      q: {
        format: 'mcm',
        stem: 'Which of the following sets of three lengths could be the side lengths of a right triangle?',
        instruction: 'Indicate all such sets.',
        choices,
        answer,
        explanation: `Recognize: a set is a right triangle exactly when the squares of its two shorter sides add up to the square of the longest side. The order in which the lengths are listed does not matter, so sort by size first.

${lines}

${notes}

Rule: square all three lengths and test the sum of the two smaller squares against the largest.`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcm') return 'format';
    // p.sets[i] = [sq1, sq2, sq3, position of item i among the choices]
    const byPos = [...p.sets].sort((a, b) => a[3] - b[3]);
    const exp = byPos.flatMap((s, i) => {
      const [a, b, c] = s.slice(0, 3).map(Math.sqrt).sort((x, y) => x - y);
      return Math.abs(a * a + b * b - c * c) < 1e-9 * c * c ? [i] : [];
    });
    return JSON.stringify(exp) === JSON.stringify(q.answer) ? null : `expected ${exp}`;
  },
};

export const tripleSetTemplates = retryAll([triples]);
