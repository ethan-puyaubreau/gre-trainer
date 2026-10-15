import type { Frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { expectMCS, F, numChoices, pickWeighted } from './util';

export const partToWholeTraps: Record<string, Trap> = {
  'fr-fraction-of-part': {
    label: 'Applied the new fraction to the given part instead of to the whole',
    fix: 'The number you are given is only a part. First find the whole (divide the part by its fraction), then take the other fraction of that whole.',
  },
  'fr-answered-other-quantity': {
    label: 'Answered a different quantity than the one asked',
    fix: 'After the setup, reread the last sentence: the original amount, the amount removed, the amount left and the total spent are four different numbers.',
  },
  'fr-inverse-operation': {
    label: 'Multiplied by the fraction where the problem needs a division, or the reverse',
    fix: '"$\\frac{3}{8}$ of the whole is 45" means whole $\\times \\frac{3}{8} = 45$, so whole $= 45 \\div \\frac{3}{8} = 45 \\times \\frac{8}{3} = 120$, not $45 \\times \\frac{3}{8}$.',
  },
  'fr-fractions-added': {
    label: 'Added the two fractions as if both were taken from the original amount',
    fix: 'The second fraction applies to what is LEFT after the first, so the two fractions cannot be added. Multiply the remaining fractions: $\\left(1 - \\frac{1}{4}\\right)\\left(1 - \\frac{1}{3}\\right)$, not $1 - \\frac{1}{4} - \\frac{1}{3}$.',
  },
  'fr-undid-one-step': {
    label: 'Undid only one of the two steps',
    fix: 'Work backward through every step: divide the final amount by the second remaining fraction to get the amount before Tuesday, then divide again by the first remaining fraction to get the original amount.',
  },
};

type Mode = 'part-other' | 'less' | 'more' | 'two-step';
type Ask = 'whole' | 'change' | 'second' | 'total';

interface Params {
  mode: Mode;
  ask: Ask;
  a: number;
  b: number;
  c: number;
  d: number;
  N: number;
  values: Frac[];
}

const UNITS = ['stickers', 'tickets', 'bolts', 'pencils', 'batteries', 'cards'];
const FRS: [number, number][] = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 6], [5, 6], [3, 8], [5, 8], [1, 8], [3, 10], [7, 10]];
const tx = (a: number, b: number) => `$\\frac{${a}}{${b}}$`;
const fmt = (v: Frac) => `$${num(v.toNumber())}$`;

const partToWhole: Template<Params> = {
  id: 'arith.fractions.part-to-whole-mcs',
  skill: 'arith.fractions',
  format: 'mcs',
  style: 'find the whole from a fraction of it, then use another fraction or a change',
  generate(rng: Rng, diff) {
    for (;;) {
      const mode = pickWeighted<Mode>(rng, diff === 1 ? [['part-other', 1]] : diff === 2 ? [['less', 1], ['more', 1], ['part-other', 0.5]] : [['two-step', 3], ['less', 1]]);
      const [a, b] = rng.pick(mode === 'more' ? FRS.filter(([x, y]) => x < y && y <= 6) : FRS);
      let [c, d] = rng.pick(FRS);
      if (mode !== 'two-step' && mode !== 'part-other') [c, d] = [1, 1];
      if (c === a && d === b) continue;
      const N = rng.int(diff === 1 ? 4 : diff === 2 ? 8 : 12, diff === 1 ? 30 : diff === 2 ? 60 : 90) * (diff === 3 ? rng.pick([6, 12, 24]) : rng.pick([6, 8, 12, 24]));
      const unit = rng.pick(UNITS);
      const n = F(N);
      const fa = F(a, b);
      const fc = F(c, d);
      let ask: Ask;
      let key: Frac;
      let stem: string;
      let cand: { v: Frac; trap: string }[];
      let steps: string;
      let K: Frac;
      if (mode === 'part-other') {
        ask = 'whole';
        K = n.mul(fa);
        key = n.mul(fc);
        stem = `${tx(a, b)} of the ${unit} in a collection are blue, and there are ${num(K.toNumber())} blue ${unit}. How many ${unit} are in ${tx(c, d)} of the collection?`;
        cand = [
          { v: K.mul(fc), trap: 'fr-fraction-of-part' },
          { v: n, trap: 'fr-answered-other-quantity' },
          { v: K.mul(fa), trap: 'fr-inverse-operation' },
          { v: n.mul(fc.inv()), trap: 'fr-inverse-operation' },
        ];
        steps = `Blue ${unit} are ${tx(a, b)} of the collection, so the collection has $${num(K.toNumber())} \\div ${fa.toTex()} = ${num(K.toNumber())} \\times ${a === 1 ? b : `\\frac{${b}}{${a}}`} = ${num(N)}$ ${unit}. Then ${tx(c, d)} of $${num(N)}$ is $${num(key.toNumber())}$.`;
      } else if (mode === 'less' || mode === 'more') {
        const sign = mode === 'less' ? -1 : 1;
        const factor = F(1).add(fa.mul(sign));
        K = n.mul(factor);
        ask = rng.chance(0.55) ? 'whole' : 'change';
        const change = n.mul(fa);
        key = ask === 'whole' ? n : change;
        const verb = mode === 'less' ? 'removed from' : 'added to';
        stem =
          ask === 'whole'
            ? `After ${tx(a, b)} of the ${unit} in a box were ${mode === 'less' ? 'removed' : 'added again'}, there were ${num(K.toNumber())} ${unit} in the box. How many ${unit} were in the box at first?`
            : `A box held some ${unit}. Then ${tx(a, b)} of the original number was ${verb} the box, so that it held ${num(K.toNumber())} ${unit}. How many ${unit} were ${mode === 'less' ? 'removed' : 'added'}?`;
        if (mode === 'more' && ask === 'whole') stem = `After ${tx(a, b)} of the original number of ${unit} was added to a box, it held ${num(K.toNumber())} ${unit}. How many ${unit} were in the box at first?`;
        cand =
          ask === 'whole'
            ? [
                { v: K.mul(F(1).sub(fa.mul(sign))), trap: 'fr-fraction-of-part' },
                { v: K.mul(fa.inv()), trap: 'fr-inverse-operation' },
                { v: K, trap: 'fr-answered-other-quantity' },
                { v: change, trap: 'fr-answered-other-quantity' },
              ]
            : [
                { v: n, trap: 'fr-answered-other-quantity' },
                { v: K.mul(fa), trap: 'fr-fraction-of-part' },
                { v: K, trap: 'fr-answered-other-quantity' },
              ];
        steps = `The ${mode === 'less' ? 'remaining' : 'new'} number is $1 ${mode === 'less' ? '-' : '+'} ${fa.toTex()} = ${factor.toTex()}$ of the original, so the original is $${num(K.toNumber())} \\div ${factor.toTex()} = ${num(N)}$.${
          ask === 'change' ? ` The amount ${mode === 'less' ? 'removed' : 'added'} is ${tx(a, b)} of $${num(N)}$, which is $${num(change.toNumber())}$.` : ''
        }`;
      } else {
        const keep1 = F(1).sub(fa);
        const keep2 = F(1).sub(fc);
        K = n.mul(keep1).mul(keep2);
        const second = n.mul(keep1).mul(fc);
        const total = n.sub(K);
        ask = pickWeighted<Ask>(rng, [['total', 2], ['second', 1.5], ['whole', 1]]);
        key = ask === 'total' ? total : ask === 'second' ? second : n;
        stem = `A shop sold ${tx(a, b)} of its ${unit} on Monday and ${tx(c, d)} of the ${unit} that were left on Tuesday. After Tuesday, ${num(K.toNumber())} ${unit} remained. ${
          ask === 'total' ? `How many ${unit} did the shop sell in all?` : ask === 'second' ? `How many ${unit} did the shop sell on Tuesday?` : `How many ${unit} did the shop have before Monday?`
        }`;
        const wrongKeep = F(1).sub(fa).sub(fc);
        cand = [
          ...(wrongKeep.sign() > 0 ? [{ v: K.div(wrongKeep), trap: 'fr-fractions-added' }] : []),
          ...(ask === 'total' ? [{ v: n, trap: 'fr-answered-other-quantity' }, { v: n.mul(fa.add(fc)), trap: 'fr-fractions-added' }, { v: second, trap: 'fr-answered-other-quantity' }] : []),
          ...(ask === 'second' ? [{ v: n.mul(fc), trap: 'num-fraction-of-whole' }, { v: total, trap: 'fr-answered-other-quantity' }, { v: n, trap: 'fr-answered-other-quantity' }] : []),
          ...(ask === 'whole' ? [{ v: K.div(keep2), trap: 'fr-undid-one-step' }, { v: total, trap: 'fr-answered-other-quantity' }] : []),
        ];
        steps = `After Monday, $1 - ${fa.toTex()} = ${keep1.toTex()}$ of the ${unit} are left; after Tuesday, $${keep2.toTex()}$ of those. So $${keep1.toTex()} \\cdot ${keep2.toTex()} = ${keep1.mul(keep2).toTex()}$ of the original number remains, and the original number is $${num(K.toNumber())} \\div ${keep1.mul(keep2).toTex()} = ${num(N)}$. Tuesday's sales were ${tx(c, d)} of $${num(keep1.mul(n).toNumber())}$, which is $${num(second.toNumber())}$, and the total sold is $${num(N)} - ${num(K.toNumber())} = ${num(total.toNumber())}$.`;
      }
      const traps = cand.filter((t) => t.v.isInt() && t.v.sign() > 0 && !t.v.eq(key));
      if (traps.length < 2 || !key.isInt() || !K.isInt() || key.sign() <= 0) continue;
      let ch;
      try {
        const fillers = [key.mul(2), key.div(2), key.mul(3).div(2), key.mul(2).div(3), key.mul(5).div(4), key.mul(4).div(5), key.mul(3), key.div(3)].filter((v) => v.isInt() && v.sign() > 0);
        ch = numChoices(rng, { correct: key, traps: traps.map((t) => ({ value: t.v, trap: t.trap })), fillers: rng.shuffle(fillers), format: fmt });
      } catch {
        continue;
      }
      const total0 = N - K.toNumber();
      const named = ch.choices.map((c0, i) => ({ c0, i })).filter((x) => x.c0.trap);
      if (named.length < 2) continue;
      const why: Record<string, string> = {
        'fr-fraction-of-part': 'taking the fraction of the given part instead of the whole gives',
        'fr-answered-other-quantity': 'answering a different quantity gives',
        'fr-inverse-operation': 'multiplying where a division is needed (or the reverse) gives',
        'fr-fractions-added': 'adding the two fractions and applying the sum to the whole, although the second fraction is taken from what was left, gives',
        'fr-undid-one-step': 'undoing only the Tuesday sale, and not the Monday one, gives',
        'num-fraction-of-whole': 'taking the second fraction of the original number, not of what was left, gives',
      };
      const seen = new Set<string>();
      const tr = named
        .filter((x) => !seen.has(x.c0.trap!) && seen.add(x.c0.trap!))
        .slice(0, 2)
        .map((x) => `Trap: ${why[x.c0.trap!]} $${num(ch.values[x.i].toNumber())}$.`)
        .join(' ');
      return {
        params: { mode, ask, a, b, c, d, N, values: ch.values },
        q: {
          format: 'mcs',
          stem,
          choices: ch.choices,
          answer: ch.answer,
          explanation: `Recognize: a fraction of an unknown whole is known, so find the whole first.

${steps}

Check: ${
  mode === 'two-step'
    ? `$${num(N)} - ${num(total0)} = ${num(K.toNumber())}$, the number left.`
    : mode === 'part-other'
      ? `${tx(a, b)} of $${num(N)}$ is $${num(K.toNumber())}$, as given.`
      : `$${num(N)} ${mode === 'less' ? '-' : '+'} ${num(N * a / b)} = ${num(K.toNumber())}$, as given.`
}

${tr}

A fraction of the whole is a part: divide the part by its fraction to recover the whole.`,
        },
      };
    }
  },
  check(q, { mode, ask, a, b, c, d, N, values }) {
    // Simulation: try every whole number of items and keep the ones that reproduce the story.
    const sols: number[] = [];
    const given = (() => {
      if (mode === 'part-other') return (N * a) / b;
      if (mode === 'less') return N - (N * a) / b;
      if (mode === 'more') return N + (N * a) / b;
      return N - (N * a) / b - ((N - (N * a) / b) * c) / d;
    })();
    for (let x = 1; x <= 5000; x++) {
      let r: number;
      if (mode === 'part-other') r = (x * a) / b;
      else if (mode === 'less') r = x - (x * a) / b;
      else if (mode === 'more') r = x + (x * a) / b;
      else {
        const s1 = (x * a) / b;
        r = x - s1 - ((x - s1) * c) / d;
      }
      if (Math.abs(r - given) < 1e-9) sols.push(x);
    }
    if (sols.length !== 1 || sols[0] !== N) return `story fits ${sols.length} wholes`;
    const x = sols[0];
    let v: number;
    if (mode === 'part-other') v = (x * c) / d;
    else if (mode === 'less' || mode === 'more') v = ask === 'whole' ? x : (x * a) / b;
    else {
      const s1 = (x * a) / b;
      v = ask === 'whole' ? x : ask === 'second' ? ((x - s1) * c) / d : s1 + ((x - s1) * c) / d;
    }
    return expectMCS(q, values.findIndex((f) => Math.abs(f.toNumber() - v) < 1e-9));
  },
};

export const partToWholeTemplates: Template<any>[] = [partToWhole];
