import { flaggedChoices, numericChoices, qcCompare, qcFromSamples } from '../../../engine/build';
import { frac, Frac } from '../../../engine/frac';
import { nCr, sum } from '../../../engine/math';
import type { Rng } from '../../../engine/rng';
import { decimal } from '../../../engine/tex';
import type { Choice, NumberLineFigure, QCChoice, QCQuestion, TableFigure, Template } from '../../../engine/types';
import { countCombinations, forEachCombination, mcmCheck, mcsCheck, neCheck, word } from './util';

const SKILL = 'data.probability';
const dtex = (f: Frac) => decimal(f);
const rel = (a: QCChoice) => (a === 'A' ? 'Quantity A is greater' : a === 'B' ? 'Quantity B is greater' : 'the two quantities are equal');

/** k random parts that add up to total, each at least min (distinct when that is easy to get). */
function partition(rng: Rng, total: number, k: number, min: number): number[] {
  let parts: number[] = [];
  for (let attempt = 0; attempt < 200; attempt++) {
    parts = Array.from({ length: k }, () => min);
    for (let left = total - k * min; left > 0; left--) parts[rng.int(0, k - 1)]++;
    if (new Set(parts).size === k) return parts;
  }
  return parts;
}

/* ================================================================== 1. One item drawn: not / neither / either (MCS) */

const COLORS = ['red', 'blue', 'green', 'yellow', 'white', 'black', 'orange', 'purple'];
const DRAW_CTX = [
  { container: 'jar', items: 'marbles', item: 'marble' },
  { container: 'box', items: 'pens', item: 'pen' },
  { container: 'bag', items: 'balloons', item: 'balloon' },
  { container: 'bowl', items: 'beads', item: 'bead' },
];

interface DrawParams {
  colors: string[];
  counts: number[];
  kind: 'not' | 'neither' | 'either';
  ex: number[];
  /** Index of the color some items are removed from, and how many (d3). */
  removeFrom: number;
  removed: number;
}

const twoPlaces = (f: Frac) => f.mul(100).isInt();

const singleDraw: Template<DrawParams> = {
  id: 'data.probability.single-draw',
  skill: SKILL,
  format: 'mcs',
  style: 'one item drawn at random: not, neither ... nor, either ... or',
  generate(rng, d) {
    const ctx = rng.pick(DRAW_CTX);
    const kind: DrawParams['kind'] = d === 1 ? rng.pick(['not', 'either'] as const) : d === 2 ? rng.pick(['neither', 'neither', 'either'] as const) : 'neither';
    const m = d === 1 ? 4 : 5;
    const colors = rng.sample(COLORS, m);
    let counts: number[];
    let ex: number[];
    let removeFrom = -1;
    let removed = 0;
    let total: number;
    let fav: number;
    for (;;) {
      const N0 = rng.pick(d === 1 ? [20, 25, 40, 50] : [20, 25, 40, 50, 60]);
      if (d === 3) {
        removed = rng.int(2, 8);
        counts = partition(rng, N0 + removed, m, 3);
      } else counts = partition(rng, N0, m, 2);
      ex = kind === 'not' ? [rng.int(0, m - 1)] : rng.sample([0, 1, 2, 3, 4].slice(0, m), 2).sort((a, b) => a - b);
      if (d === 3) {
        removeFrom = rng.pick([0, 1, 2, 3, 4].filter((i) => !ex.includes(i)));
        if (counts[removeFrom] <= removed) continue;
      }
      total = sum(counts) - removed;
      const exCount = sum(ex.map((i) => counts[i]));
      fav = kind === 'either' ? exCount : total - exCount;
      if (fav > 0 && fav < total && twoPlaces(frac(fav, total))) break;
    }
    const correct = frac(fav, total);
    const exCount = sum(ex.map((i) => counts[i]));
    const traps: { value: Frac; trap: string }[] = [];
    const add = (v: Frac, trap: string) => {
      if (v.sign() > 0 && v.lt(1) && twoPlaces(v)) traps.push({ value: v, trap });
    };
    if (d === 3) {
      add(frac(sum(counts) - exCount, sum(counts)), 'prob-stale-total');
      add(frac(fav, sum(counts)), 'prob-stale-total');
    }
    if (kind === 'either') {
      add(frac(total - exCount, total), 'prob-wrong-event');
      add(frac(exCount, 100), 'prob-count-as-percent');
    } else {
      add(frac(exCount, total), 'prob-wrong-event');
      add(frac(exCount, 100), 'prob-count-as-percent');
      add(frac(100 - exCount, 100), 'prob-count-as-percent');
    }
    const fillers = [correct.add(frac(1, 20)), correct.sub(frac(1, 10)), correct.add(frac(1, 10)), correct.sub(frac(1, 20)), frac(1, 2)].filter((v) => v.sign() > 0 && v.lt(1));
    const { choices, answer } = numericChoices(rng, { correct, traps, fillers, format: (v) => `$${v.toNumber().toFixed(2)}$` });

    const list = colors.map((c, i) => `${counts[i]} are ${c}`);
    const listText = `${list.slice(0, -1).join(', ')}, and ${list[m - 1]}`;
    const exNames = ex.map((i) => colors[i]);
    const event = kind === 'not' ? `not ${exNames[0]}` : kind === 'neither' ? `neither ${exNames[0]} nor ${exNames[1]}` : `either ${exNames[0]} or ${exNames[1]}`;
    const removal = d === 3 ? ` First, ${removed} of the ${colors[removeFrom]} ${ctx.items} are removed from the ${ctx.container}. Then one of the remaining ${ctx.items} is to be chosen at random.` : ` One ${ctx.item} is to be chosen at random from the ${ctx.container}.`;
    const stem = `A ${ctx.container} contains ${sum(counts)} ${ctx.items}, of which ${listText}.${removal} What is the probability that the ${ctx.item} chosen will be ${event}?`;
    const exPart = ex.map((i) => counts[i]).join(' + ');
    const explanation =
      kind === 'either'
        ? `${cap(exNames.join(' or '))}: $${exPart} = ${exCount}$ of the ${total} ${ctx.items}, so the probability is $\\frac{${exCount}}{${total}} = ${correct.toNumber().toFixed(2)}$.

$${frac(total - exCount, total).toNumber().toFixed(2)}$ is the probability of the other colors.`
        : `${d === 3 ? `After the removal, ${sum(counts)} $-$ ${removed} = ${total} ${ctx.items} remain. ` : ''}${cap(exNames.join(' or '))}: $${exPart} = ${exCount}$, so ${kind === 'not' ? `not ${exNames[0]}` : `neither of them`}: $${total} - ${exCount} = ${fav}$. The probability is $\\frac{${fav}}{${total}} = ${correct.toNumber().toFixed(2)}$.

$\\frac{${exCount}}{${total}}$ is the probability of the excluded ${kind === 'not' ? 'color' : 'colors'}, and $${frac(exCount, 100).toNumber().toFixed(2)}$ treats a count of ${exCount} as ${exCount} percent.${
            d === 3 ? ` Dividing by ${sum(counts)} ignores the ${removed} ${ctx.items} that were removed.` : ''
          }`;
    return { params: { colors, counts, kind, ex, removeFrom, removed }, q: { format: 'mcs', stem, choices, answer, explanation } };
  },
  check(q, { colors, counts, kind, ex, removeFrom, removed }) {
    // Build the actual items, remove, then count.
    let items: number[] = counts.flatMap((c, i) => Array.from({ length: c }, () => i));
    if (removeFrom >= 0) {
      let left = removed;
      items = items.filter((c) => !(c === removeFrom && left-- > 0));
    }
    const fav = items.filter((c) => (kind === 'either' ? ex.includes(c) : !ex.includes(c))).length;
    void colors;
    return mcsCheck(q, `$${(fav / items.length).toFixed(2)}$`);
  },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ================================================================== 2. Independent events (NE) */

type IndAsk = 'both' | 'neither' | 'at-least-one' | 'exactly-one';
interface IndParams {
  mode: 'events' | 'coins' | 'dice';
  ps: Frac[];
  ask: IndAsk | 'mixed';
  n: number;
}

const IND_CTX = [
  {
    setup: (ps: string[]) =>
      ps.length === 2
        ? `Machines X and Y operate independently of each other. On any given day, the probability that machine X needs repair is ${ps[0]}, and the probability that machine Y needs repair is ${ps[1]}.`
        : `Machines X, Y, and Z operate independently of one another. On any given day, the probabilities that X, Y, and Z need repair are ${ps[0]}, ${ps[1]}, and ${ps[2]}, respectively.`,
    q: { both: 'both machines need repair', 'at-least-one': 'at least one of the machines needs repair', 'exactly-one': 'exactly one of the machines needs repair', neither: 'neither machine needs repair' } as Record<IndAsk, string>,
    q3: { 'at-least-one': 'at least one of the three machines needs repair', 'exactly-one': 'exactly one of the three machines needs repair' } as Partial<Record<IndAsk, string>>,
    tail: 'on a given day',
  },
  {
    setup: (ps: string[]) =>
      ps.length === 2
        ? `Ana and Ben will each take one free throw, independently. The probability that Ana makes her shot is ${ps[0]}, and the probability that Ben makes his shot is ${ps[1]}.`
        : `Ana, Ben, and Cy will each take one free throw, independently. The probabilities that Ana, Ben, and Cy make their shots are ${ps[0]}, ${ps[1]}, and ${ps[2]}, respectively.`,
    q: { both: 'both of them make their shots', 'at-least-one': 'at least one of them makes the shot', 'exactly-one': 'exactly one of them makes the shot', neither: 'neither of them makes the shot' } as Record<IndAsk, string>,
    q3: { 'at-least-one': 'at least one of the three makes the shot', 'exactly-one': 'exactly one of the three makes the shot' } as Partial<Record<IndAsk, string>>,
    tail: '',
  },
  {
    setup: (ps: string[]) =>
      ps.length === 2
        ? `The probability that it will rain in City X tomorrow is ${ps[0]}, and the probability that it will rain in City Y tomorrow is ${ps[1]}. Assume that the two events are independent.`
        : `The probabilities that it will rain tomorrow in Cities X, Y, and Z are ${ps[0]}, ${ps[1]}, and ${ps[2]}, respectively. Assume that the three events are independent.`,
    q: { both: 'it will rain in both cities', 'at-least-one': 'it will rain in at least one of the two cities', 'exactly-one': 'it will rain in exactly one of the two cities', neither: 'it will rain in neither city' } as Record<IndAsk, string>,
    q3: { 'at-least-one': 'it will rain in at least one of the three cities', 'exactly-one': 'it will rain in exactly one of the three cities' } as Partial<Record<IndAsk, string>>,
    tail: 'tomorrow',
  },
];

function indProb(ps: Frac[], ask: IndAsk): Frac {
  const qs = ps.map((p) => frac(1).sub(p));
  if (ask === 'both') return ps.reduce((a, b) => a.mul(b), frac(1));
  if (ask === 'neither') return qs.reduce((a, b) => a.mul(b), frac(1));
  if (ask === 'at-least-one') return frac(1).sub(qs.reduce((a, b) => a.mul(b), frac(1)));
  // exactly one
  return ps.reduce((acc, _p, i) => acc.add(ps.reduce((prod, pj, j) => prod.mul(j === i ? pj : qs[j]), frac(1))), frac(0));
}

const independent: Template<IndParams> = {
  id: 'data.probability.independent',
  skill: SKILL,
  format: 'ne',
  style: 'independent events: both, neither, at least one, exactly one',
  generate(rng, d) {
    const mode: IndParams['mode'] = d === 1 ? 'events' : d === 2 ? rng.pick(['events', 'events', 'coins', 'dice'] as const) : rng.pick(['events', 'coins', 'dice'] as const);
    let stem = '';
    let answer: Frac;
    let fractionBoxes = false;
    const traps: { value: Frac; trap: string }[] = [];
    let explanation = '';
    let ps: Frac[] = [];
    let ask: IndParams['ask'] = 'at-least-one';
    let n = 0;
    if (mode === 'events') {
      const k = d === 3 ? 3 : 2;
      const step = d === 3 ? 20 : 10;
      do {
        ps = Array.from({ length: k }, () => frac(rng.int(1, step - 1), step));
      } while (new Set(ps.map((p) => p.toString())).size < k || ps.some((p) => p.eq(frac(1, 2)) && d === 1));
      ask = d === 1 ? rng.pick(['both', 'neither'] as const) : rng.pick(['at-least-one', 'exactly-one'] as const);
      const ctx = rng.pick(IND_CTX);
      const pTex = ps.map((p) => dtex(p));
      const askText = k === 3 ? ctx.q3[ask]! : ctx.q[ask];
      stem = `${ctx.setup(pTex)} What is the probability that ${askText}${ctx.tail ? ` ${ctx.tail}` : ''}?`;
      answer = indProb(ps, ask);
      const qs = ps.map((p) => frac(1).sub(p));
      const pT = ps.map(dtex);
      const qT = qs.map(dtex);
      if (ask === 'both') {
        explanation = `Independent events multiply: $${pT.join(' \\times ')} = ${dtex(answer)}$.`;
        traps.push({ value: ps[0].add(ps[1]), trap: 'prob-add-probabilities' });
      } else if (ask === 'neither') {
        explanation = `Neither happens when both "not" events happen: $(1 - ${pT[0]})(1 - ${pT[1]}) = ${qT[0]} \\times ${qT[1]} = ${dtex(answer)}$.`;
        const t = frac(1).sub(ps[0]).sub(ps[1]);
        if (t.sign() > 0) traps.push({ value: t, trap: 'prob-add-probabilities' });
        traps.push({ value: frac(1).sub(ps[0].mul(ps[1])), trap: 'prob-wrong-event' });
      } else if (ask === 'at-least-one') {
        const none = qs.reduce((a, b) => a.mul(b), frac(1));
        explanation = `Use the complement. None of them happens with probability $${qT.join(' \\times ')} = ${dtex(none)}$, so at least one happens with probability $1 - ${dtex(none)} = ${dtex(answer)}$.

Adding the probabilities ($${pT.join(' + ')}$) counts the cases where more than one happens more than once.`;
        traps.push({ value: ps.reduce((a, b) => a.add(b), frac(0)), trap: 'prob-add-probabilities' });
        traps.push({ value: ps.reduce((a, b) => a.mul(b), frac(1)), trap: 'prob-and-vs-or' });
      } else {
        const terms = ps.map((_, i) => ps.map((p, j) => (j === i ? dtex(p) : dtex(qs[j]))).join(' \\times '));
        explanation = `Exactly one means one happens and the other${k === 3 ? 's do' : ' does'} not. Add the ${k} cases: $${terms.map((t) => `(${t})`).join(' + ')} = ${dtex(answer)}$.

$${dtex(indProb(ps, 'at-least-one'))}$ is the probability of at least one, which also includes the cases where more than one happens.`;
        traps.push({ value: indProb(ps, 'at-least-one'), trap: 'prob-exactly-vs-at-least' });
        traps.push({ value: ps.reduce((a, b) => a.add(b), frac(0)), trap: 'prob-add-probabilities' });
      }
    } else if (mode === 'coins') {
      fractionBoxes = true;
      n = rng.int(3, 5);
      ask = d === 3 && rng.chance(0.6) ? 'mixed' : 'at-least-one';
      const all = 2 ** n;
      if (ask === 'mixed') {
        answer = frac(all - 2, all);
        stem = `A fair coin is to be tossed ${n} times. What is the probability that the tosses will include at least one head and at least one tail?`;
        explanation = `There are $2^{${n}} = ${all}$ equally likely sequences. Only 2 of them fail: all heads and all tails. So the probability is $\\frac{${all} - 2}{${all}} = ${answer.toTex()}$.`;
        traps.push({ value: frac(all - 1, all), trap: 'prob-missed-case' });
      } else {
        answer = frac(all - 1, all);
        stem = `A fair coin is to be tossed ${n} times. What is the probability of getting at least one head?`;
        explanation = `The only way to get no head is ${n} tails in a row: $\\left(\\frac{1}{2}\\right)^{${n}} = \\frac{1}{${all}}$. So at least one head has probability $1 - \\frac{1}{${all}} = \\frac{${all - 1}}{${all}}$.`;
        traps.push({ value: frac(1, all), trap: 'prob-wrong-event' });
      }
    } else {
      fractionBoxes = true;
      const face = rng.int(1, 6);
      ask = rng.pick(d === 3 ? (['at-least-one', 'exactly-one'] as const) : (['at-least-one'] as const));
      ps = [frac(1, 6), frac(1, 6)];
      answer = indProb(ps, ask);
      n = face;
      stem = `Two fair six-sided dice, each with faces numbered 1 through 6, are to be rolled. What is the probability that ${ask === 'at-least-one' ? 'at least one' : 'exactly one'} of the dice will show a ${face}?`;
      explanation =
        ask === 'at-least-one'
          ? `Neither die shows a ${face} with probability $\\frac{5}{6} \\times \\frac{5}{6} = \\frac{25}{36}$, so at least one does with probability $1 - \\frac{25}{36} = \\frac{11}{36}$. (Count check: 6 + 6 outcomes contain a ${face}, minus the one outcome counted twice: 11 of 36.)

$\\frac{1}{6} + \\frac{1}{6} = \\frac{12}{36}$ counts the double ${face} twice.`
          : `Exactly one ${face}: first die ${face} and second not, or the reverse: $\\frac{1}{6} \\times \\frac{5}{6} + \\frac{5}{6} \\times \\frac{1}{6} = \\frac{10}{36} = \\frac{5}{18}$.

$\\frac{11}{36}$ also counts the outcome where both dice show ${face}.`;
      traps.push({ value: frac(1, 3), trap: 'prob-add-probabilities' });
      if (ask === 'exactly-one') traps.push({ value: frac(11, 36), trap: 'prob-exactly-vs-at-least' });
      else traps.push({ value: frac(1, 36), trap: 'prob-and-vs-or' });
    }
    return {
      params: { mode, ps, ask, n },
      q: {
        format: 'ne',
        stem: stem + (fractionBoxes ? '\n\nGive your answer as a fraction.' : ''),
        answer: answer!,
        ...(fractionBoxes ? { fractionBoxes: true } : {}),
        traps: traps.filter((t) => !t.value.eq(answer!) && t.value.sign() > 0),
        explanation,
      },
    };
  },
  check(q, { mode, ps, ask, n }) {
    // Enumerate every outcome of the independent experiments.
    if (mode === 'coins') {
      let good = 0;
      for (let m = 0; m < 2 ** n; m++) {
        const heads = m.toString(2).split('').filter((c) => c === '1').length;
        if (ask === 'mixed' ? heads > 0 && heads < n : heads > 0) good++;
      }
      return neCheck(q, frac(good, 2 ** n));
    }
    if (mode === 'dice') {
      let good = 0;
      for (let a = 1; a <= 6; a++)
        for (let b = 1; b <= 6; b++) {
          const hits = (a === n ? 1 : 0) + (b === n ? 1 : 0);
          if (ask === 'at-least-one' ? hits >= 1 : hits === 1) good++;
        }
      return neCheck(q, frac(good, 36));
    }
    let total = frac(0);
    for (let m = 0; m < 2 ** ps.length; m++) {
      let pr = frac(1);
      let happened = 0;
      ps.forEach((p, i) => {
        if ((m >> i) & 1) {
          pr = pr.mul(p);
          happened++;
        } else pr = pr.mul(frac(1).sub(p));
      });
      const ok = ask === 'both' ? happened === ps.length : ask === 'neither' ? happened === 0 : ask === 'at-least-one' ? happened >= 1 : happened === 1;
      if (ok) total = total.add(pr);
    }
    return neCheck(q, total);
  },
};

/* ================================================================== 3. Two draws without replacement (MCS) */

type WRAsk = 'both-a' | 'one-each' | 'at-least-one-b' | 'same';
interface WRParams {
  a: number;
  b: number;
  ask: WRAsk;
  /** For 'both-a': true when the question asks about the second group. */
  useB: boolean;
}

const WR_CTX = [
  { setup: (a: number, b: number) => `A bag contains ${a} red marbles and ${b} blue marbles. Two marbles are to be drawn at random from the bag, one after the other, without replacement.`, A: 'red', B: 'blue', A1: 'a red marble', B1: 'a blue marble', items: 'marbles', both: (s: string) => `both marbles drawn will be ${s}`, oneEach: 'one marble of each color will be drawn', atLeast: 'at least one blue marble will be drawn', same: 'the two marbles will be the same color' },
  { setup: (a: number, b: number) => `A team consists of ${a} women and ${b} men. Two members of the team are to be selected at random to attend a conference.`, A: 'women', B: 'men', A1: 'a woman', B1: 'a man', items: 'members', both: (s: string) => `both people selected will be ${s}`, oneEach: 'one woman and one man will be selected', atLeast: 'at least one man will be selected', same: 'the two people selected will be of the same gender' },
  { setup: (a: number, b: number) => `A box contains ${a} working light bulbs and ${b} defective light bulbs. Two bulbs are to be chosen at random from the box without replacement.`, A: 'working', B: 'defective', A1: 'a working bulb', B1: 'a defective bulb', items: 'bulbs', both: (s: string) => `both bulbs chosen will be ${s}`, oneEach: 'exactly one of the two bulbs chosen will be defective', atLeast: 'at least one defective bulb will be chosen', same: 'both bulbs will be working or both will be defective' },
];

const withoutReplacement: Template<WRParams> = {
  id: 'data.probability.without-replacement',
  skill: SKILL,
  format: 'mcs',
  style: 'two draws without replacement, fraction choices',
  generate(rng, d) {
    const ci = rng.int(0, WR_CTX.length - 1);
    const ctx = WR_CTX[ci];
    const a = rng.int(3, d === 1 ? 6 : 8);
    let b = rng.int(2, d === 1 ? 5 : 7);
    if (b === a) b = a - 1;
    const n = a + b;
    const ask: WRAsk = d === 1 ? 'both-a' : d === 2 ? rng.pick(['one-each', 'both-a', 'one-each'] as const) : rng.pick(['at-least-one-b', 'same'] as const);
    const pairs = n * (n - 1);
    const traps: { value: Frac; trap: string }[] = [];
    let correct: Frac;
    let stem = '';
    let explanation = '';
    const useB = ask === 'both-a' && rng.chance(0.4);
    if (ask === 'both-a') {
      const k = useB ? b : a;
      const label = useB ? ctx.B : ctx.A;
      correct = frac(k * (k - 1), pairs);
      stem = `${ctx.setup(a, b)} What is the probability that ${ctx.both(label)}?`;
      traps.push({ value: frac(k * k, n * n), trap: 'prob-with-replacement' }, { value: frac(k, n), trap: 'prob-one-draw' });
      explanation = `First draw: $\\frac{${k}}{${n}}$. Once ${useB ? ctx.B1 : ctx.A1} is gone, ${k - 1} of the remaining ${n - 1} are of that kind, so the second draw: $\\frac{${k - 1}}{${n - 1}}$. Multiply: $\\frac{${k}}{${n}} \\times \\frac{${k - 1}}{${n - 1}} = ${correct.toTex()}$.

$\\left(\\frac{${k}}{${n}}\\right)^2$ assumes the first one is put back.`;
    } else if (ask === 'one-each') {
      correct = frac(2 * a * b, pairs);
      stem = `${ctx.setup(a, b)} What is the probability that ${ctx.oneEach}?`;
      traps.push({ value: frac(a * b, pairs), trap: 'prob-one-order' }, { value: frac(2 * a * b, n * n), trap: 'prob-with-replacement' });
      explanation = `Two orders work: ${ctx.A1} then ${ctx.B1}, $\\frac{${a}}{${n}} \\times \\frac{${b}}{${n - 1}}$, or ${ctx.B1} then ${ctx.A1}, $\\frac{${b}}{${n}} \\times \\frac{${a}}{${n - 1}}$. Total: $2 \\times \\frac{${a * b}}{${pairs}} = ${correct.toTex()}$.

$${frac(a * b, pairs).toTex()}$ counts only one of the two orders.`;
    } else if (ask === 'at-least-one-b') {
      correct = frac(1).sub(frac(a * (a - 1), pairs));
      stem = `${ctx.setup(a, b)} What is the probability that ${ctx.atLeast}?`;
      traps.push({ value: frac(1).sub(frac(a * a, n * n)), trap: 'prob-with-replacement' }, { value: frac(b * (b - 1), pairs), trap: 'prob-and-vs-or' }, { value: frac(a * (a - 1), pairs), trap: 'prob-wrong-event' });
      explanation = `Use the complement. No ${ctx.B === 'blue' ? 'blue marble' : ctx.B === 'men' ? 'man' : 'defective bulb'} means both are ${ctx.A}: $\\frac{${a}}{${n}} \\times \\frac{${a - 1}}{${n - 1}} = ${frac(a * (a - 1), pairs).toTex()}$. So the probability is $1 - ${frac(a * (a - 1), pairs).toTex()} = ${correct.toTex()}$.

$${frac(b * (b - 1), pairs).toTex()}$ is the probability that both are ${ctx.B}, only one of the ways to get at least one.`;
    } else {
      correct = frac(a * (a - 1) + b * (b - 1), pairs);
      stem = `${ctx.setup(a, b)} What is the probability that ${ctx.same}?`;
      traps.push({ value: frac(a * (a - 1), pairs), trap: 'prob-missed-case' }, { value: frac(a * a + b * b, n * n), trap: 'prob-with-replacement' });
      explanation = `Add the two cases. Both ${ctx.A}: $\\frac{${a}}{${n}} \\times \\frac{${a - 1}}{${n - 1}} = \\frac{${a * (a - 1)}}{${pairs}}$. Both ${ctx.B}: $\\frac{${b}}{${n}} \\times \\frac{${b - 1}}{${n - 1}} = \\frac{${b * (b - 1)}}{${pairs}}$. Total: $\\frac{${a * (a - 1) + b * (b - 1)}}{${pairs}} = ${correct.toTex()}$.

$${frac(a * (a - 1), pairs).toTex()}$ is only the first case.`;
    }
    const fillers = rng
      .shuffle([frac(a * (a - 1), pairs), frac(b * (b - 1), pairs), frac(a, n), frac(b, n), frac(a * b, pairs), frac(1, 2), frac(a * a, n * n)])
      .filter((v) => v.sign() > 0 && v.lt(1));
    const { choices, answer } = numericChoices(rng, {
      correct: correct!,
      traps: traps.filter((t) => t.value.sign() > 0 && t.value.lt(1)),
      fillers,
      format: (v) => `$${v.toTex()}$`,
    });
    return { params: { a, b, ask, useB }, q: { format: 'mcs', stem, choices, answer, explanation } };
  },
  check(q, { a, b, ask, useB }) {
    const n = a + b;
    // Items 0..a-1 are of kind A. Enumerate ordered pairs of different items.
    let good = 0;
    let all = 0;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        all++;
        const x = i < a;
        const y = j < a;
        const ok =
          ask === 'both-a' ? (useB ? !x && !y : x && y) : ask === 'one-each' ? x !== y : ask === 'at-least-one-b' ? !x || !y : x === y;
        if (ok) good++;
      }
    return mcsCheck(q, `$${frac(good, all).toTex()}$`);
  },
};

/* ================================================================== 4. Choose k at random: combinations (MCS) */

interface ChooseParams {
  mode: 'line' | 'trait';
  coords: number[];
  k: number;
  ask: 'all-pos' | 'exactly-two-pos' | 'product-neg' | 'none-neg' | 'exactly-one' | 'at-least-one';
  N: number;
  t: number;
  r: number;
  /** For expression choices: the value of each choice, as a recipe evaluated in check(). */
  recipes: Recipe[];
}

/** A choice of the form  coef * prod(C(a, b)) / C(c, d)  or  1 - that, or a with-replacement power. */
type Recipe =
  | { kind: 'ratio'; num: [number, number][]; den: [number, number]; complement: boolean }
  | { kind: 'binomial'; r: number; p: [number, number]; x: number; complement: boolean };

function recipeValue(rc: Recipe, C: (n: number, k: number) => number): number {
  if (rc.kind === 'ratio') {
    const v = rc.num.reduce((p, [a, b]) => p * C(a, b), 1) / C(rc.den[0], rc.den[1]);
    return rc.complement ? 1 - v : v;
  }
  const p = rc.p[0] / rc.p[1];
  const v = C(rc.r, rc.x) * p ** rc.x * (1 - p) ** (rc.r - rc.x);
  return rc.complement ? 1 - v : v;
}

function recipeTex(rc: Recipe): string {
  const b = (x: [number, number]) => `\\binom{${x[0]}}{${x[1]}}`;
  if (rc.kind === 'ratio') {
    const numT = rc.num.length ? rc.num.map(b).join('') : '1';
    const body = `\\dfrac{${numT}}{${b(rc.den)}}`;
    return rc.complement ? `$1 - ${body}$` : `$${body}$`;
  }
  const p = `\\frac{${rc.p[0]}}{${rc.p[1]}}`;
  const q = `\\frac{${rc.p[1] - rc.p[0]}}{${rc.p[1]}}`;
  const body =
    rc.x === 0
      ? `\\left(${q}\\right)^{${rc.r}}`
      : `${rc.r === 1 || rc.x === rc.r ? '' : rc.r}\\left(${p}\\right)${rc.x > 1 ? `^{${rc.x}}` : ''}\\left(${q}\\right)^{${rc.r - rc.x}}`;
  return rc.complement ? `$1 - ${body}$` : `$${body}$`;
}

const TRAIT_CTX = [
  { setup: (N: number, t: number) => `Of the ${N} plants in a greenhouse, ${t} have a certain leaf disease.`, items: 'plants', has: 'has the disease', haveNone: 'none of them has the disease' },
  { setup: (N: number, t: number) => `A shipment of ${N} laptops contains exactly ${t} laptops with a defective battery.`, items: 'laptops', has: 'has a defective battery', haveNone: 'none of them has a defective battery' },
  { setup: (N: number, t: number) => `Of the ${N} specimens in a laboratory, ${t} carry a certain gene.`, items: 'specimens', has: 'carries the gene', haveNone: 'none of them carries the gene' },
];

const chooseK: Template<ChooseParams> = {
  id: 'data.probability.choose-k',
  skill: SKILL,
  format: 'mcs',
  style: 'choose several items at random: probability with combinations',
  generate(rng, d) {
    const mode: ChooseParams['mode'] = d === 1 ? 'line' : d === 2 ? rng.pick(['line', 'trait'] as const) : 'trait';
    const p: ChooseParams = { mode, coords: [], k: 0, ask: 'all-pos', N: 0, t: 0, r: 0, recipes: [] };
    let stem = '';
    let figure: NumberLineFigure | undefined;
    let explanation = '';
    if (mode === 'line') {
      const total = rng.pick([5, 5, 6]);
      const pos = total === 5 ? rng.pick([3, 3, 2]) : rng.pick([3, 4]);
      const negs = rng.sample([-6, -5, -4, -3, -2, -1], total - pos);
      const poss = rng.sample([1, 2, 3, 4, 5, 6], pos);
      p.coords = [...negs, ...poss].sort((x, y) => x - y);
      p.ask = rng.pick(pos >= 3 ? (['all-pos', 'all-pos', 'exactly-two-pos', 'product-neg'] as const) : (['product-neg', 'none-neg', 'exactly-two-pos'] as const));
      p.k = p.ask === 'product-neg' || p.ask === 'none-neg' ? 2 : 3;
      if (p.ask === 'exactly-two-pos' && pos < 2) p.ask = 'product-neg';
      const names = ['P', 'Q', 'R', 'S', 'T', 'U'].slice(0, total);
      figure = {
        kind: 'numberLine',
        min: -7,
        max: 7,
        points: p.coords.map((c, i) => ({ at: c, name: names[i] })),
        ticks: Array.from({ length: 15 }, (_, i) => i - 7).map((x) => ({ at: x, ...(x % 7 === 0 || x === 0 ? { label: `$${x}$` } : {}) })),
      };
      const neg = total - pos;
      const all = nCr(total, p.k);
      let fav = 0;
      let favText = '';
      let correct: Frac;
      const traps: { value: Frac; trap: string }[] = [];
      if (p.ask === 'all-pos') {
        fav = nCr(pos, 3);
        favText = `all three from the ${pos} points with positive coordinates: $\\binom{${pos}}{3} = ${fav}$`;
        stem = `${word(total).replace(/^./, (c) => c.toUpperCase())} points are shown on the number line above. If 3 of the ${total} points are to be chosen at random, what is the probability that all 3 points chosen will have positive coordinates?`;
        traps.push({ value: frac(pos ** 3, total ** 3), trap: 'prob-with-replacement' }, { value: frac(pos, total), trap: 'prob-one-draw' }, { value: frac(1, all), trap: 'prob-missed-case' });
      } else if (p.ask === 'exactly-two-pos') {
        fav = nCr(pos, 2) * neg;
        favText = `2 of the ${pos} positive points and 1 of the ${neg} negative points: $\\binom{${pos}}{2} \\times ${neg} = ${fav}$`;
        stem = `${word(total).replace(/^./, (c) => c.toUpperCase())} points are shown on the number line above. If 3 of the ${total} points are to be chosen at random, what is the probability that exactly 2 of the points chosen will have positive coordinates?`;
        traps.push({ value: frac(nCr(pos, 2), all), trap: 'prob-missed-factor' }, { value: frac(3 * pos * pos * neg, total ** 3), trap: 'prob-with-replacement' });
      } else if (p.ask === 'product-neg') {
        fav = pos * neg;
        favText = `one positive and one negative point: $${pos} \\times ${neg} = ${fav}$`;
        stem = `${word(total).replace(/^./, (c) => c.toUpperCase())} points are shown on the number line above. If 2 of the ${total} points are to be chosen at random, what is the probability that the product of their coordinates will be negative?`;
        traps.push({ value: frac(2 * pos * neg, all), trap: 'prob-order-matters' }, { value: frac(pos * neg, total * total), trap: 'prob-with-replacement' }, { value: frac(nCr(neg, 2) + nCr(pos, 2), all), trap: 'prob-wrong-event' });
      } else {
        fav = nCr(pos, 2);
        favText = `both from the ${pos} points with positive coordinates: $\\binom{${pos}}{2} = ${fav}$`;
        stem = `${word(total).replace(/^./, (c) => c.toUpperCase())} points are shown on the number line above. If 2 of the ${total} points are to be chosen at random, what is the probability that neither of the points chosen will have a negative coordinate?`;
        traps.push({ value: frac(pos * pos, total * total), trap: 'prob-with-replacement' }, { value: frac(1).sub(frac(fav, all)), trap: 'prob-wrong-event' });
      }
      correct = frac(fav, all);
      explanation = `All choices of ${p.k} points out of ${total}: $\\binom{${total}}{${p.k}} = ${all}$, all equally likely. Favorable: ${favText}. Probability: $\\frac{${fav}}{${all}}${frac(fav, all).d !== all ? ` = ${correct.toTex()}` : ''}$.

The points are chosen without replacement, so the probability is not a power like $\\left(\\frac{${pos}}{${total}}\\right)^{${p.k}}$.`;
      const fillers = [correct.mul(2), correct.mul(frac(1, 2)), frac(1, 2), frac(fav + 1, all), frac(Math.max(1, fav - 1), all)].filter((v) => v.sign() > 0 && v.lt(1));
      const { choices, answer } = numericChoices(rng, { correct, traps: traps.filter((t) => t.value.sign() > 0 && t.value.lt(1)), fillers, format: (v) => `$${v.toTex()}$` });
      return { params: p, q: { format: 'mcs', stem, figure, choices, answer, explanation } };
    }
    // trait: expression choices
    const ctx = rng.pick(TRAIT_CTX);
    let N: number;
    let t: number;
    let r: number;
    do {
      N = rng.int(8, 12);
      t = rng.int(2, 4);
      r = rng.int(3, 4);
    } while (t === r || t + r === N || r > N - t);
    p.N = N;
    p.t = t;
    p.r = r;
    p.ask = d === 3 && rng.chance(0.5) ? 'at-least-one' : 'exactly-one';
    const ratio = (num: [number, number][], den: [number, number], complement = false): Recipe => ({ kind: 'ratio', num, den, complement });
    let correctR: Recipe;
    const wrong: { rc: Recipe; trap?: string }[] = [];
    if (p.ask === 'exactly-one') {
      correctR = ratio([[t, 1], [N - t, r - 1]], [N, r]);
      wrong.push(
        { rc: ratio([[t, 1]], [N, r]), trap: 'prob-missed-factor' },
        { rc: ratio([[t, 1], [N - t, r - 1]], [N, t]), trap: 'prob-wrong-denominator' },
        { rc: { kind: 'binomial', r, p: [t, N], x: 1, complement: false }, trap: 'prob-with-replacement' },
        { rc: ratio([[t, 1], [N - t, r]], [N, r]) },
        { rc: ratio([[N - t, r - 1]], [N, r]), trap: 'prob-missed-factor' },
        { rc: ratio([[t, 2], [N - t, r - 2]], [N, r]) },
        { rc: ratio([[t, 1]], [N, 1]), trap: 'prob-one-draw' },
      );
      stem = `${ctx.setup(N, t)} If ${r} of the ${N} ${ctx.items} are to be selected at random, without replacement, what is the probability that exactly 1 of the ${r} ${ctx.items} selected ${ctx.has}?`;
      explanation = `All selections of ${r} out of ${N}: $\\binom{${N}}{${r}}$. Favorable: choose the 1 from the ${t} that have it, $\\binom{${t}}{1}$, and the other ${r - 1} from the ${N - t} that do not, $\\binom{${N - t}}{${r - 1}}$. So the probability is $\\dfrac{\\binom{${t}}{1}\\binom{${N - t}}{${r - 1}}}{\\binom{${N}}{${r}}}$.

Dropping the factor $\\binom{${N - t}}{${r - 1}}$ forgets that the other ${r - 1} ${ctx.items} must be chosen too; a power of $\\frac{${t}}{${N}}$ would be drawing with replacement.`;
    } else {
      correctR = ratio([[N - t, r]], [N, r], true);
      wrong.push(
        { rc: ratio([[N - t, r]], [N, r]), trap: 'prob-wrong-event' },
        { rc: ratio([[t, 1]], [N, r]), trap: 'prob-missed-case' },
        { rc: { kind: 'binomial', r, p: [t, N], x: 0, complement: true }, trap: 'prob-with-replacement' },
        { rc: ratio([[t, r]], [N, r], true) },
        { rc: ratio([[t, 1], [N - t, r - 1]], [N, r]), trap: 'prob-exactly-vs-at-least' },
        { rc: ratio([[t, 1], [N - 1, r - 1]], [N, r]), trap: 'prob-at-least-one-overcount' },
        { rc: ratio([[t, 1]], [N, 1]), trap: 'prob-one-draw' },
      );
      stem = `${ctx.setup(N, t)} If ${r} of the ${N} ${ctx.items} are to be selected at random, without replacement, what is the probability that at least 1 of the ${r} ${ctx.items} selected ${ctx.has}?`;
      explanation = `Use the complement: ${ctx.haveNone} when all ${r} come from the ${N - t} without it, which has probability $\\dfrac{\\binom{${N - t}}{${r}}}{\\binom{${N}}{${r}}}$. So the answer is $1 - \\dfrac{\\binom{${N - t}}{${r}}}{\\binom{${N}}{${r}}}$.

$\\dfrac{\\binom{${N - t}}{${r}}}{\\binom{${N}}{${r}}}$ alone is the probability that ${ctx.haveNone}; $\\dfrac{\\binom{${t}}{1}\\binom{${N - t}}{${r - 1}}}{\\binom{${N}}{${r}}}$ counts only "exactly 1".`;
    }
    const cv = recipeValue(correctR, nCr);
    const kept: { rc: Recipe; trap?: string }[] = [];
    for (const w of wrong) {
      const v = recipeValue(w.rc, nCr);
      if (Math.abs(v - cv) > 1e-9 && kept.every((k) => Math.abs(recipeValue(k.rc, nCr) - v) > 1e-9) && kept.length < 4) kept.push(w);
    }
    const items = rng.shuffle([{ rc: correctR, ok: true as boolean, trap: undefined as string | undefined }, ...kept.map((k) => ({ rc: k.rc, ok: false, trap: k.trap }))]);
    p.recipes = items.map((i) => i.rc);
    const choices: Choice[] = items.map((i) => ({ text: recipeTex(i.rc), ...(i.trap ? { trap: i.trap } : {}) }));
    return { params: p, q: { format: 'mcs', stem, choices, answer: items.findIndex((i) => i.ok), explanation } };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'wrong format';
    if (p.mode === 'line') {
      const total = p.coords.length;
      let fav = 0;
      let all = 0;
      forEachCombination(total, p.k, (m) => {
        all++;
        const cs = m.map((i) => p.coords[i]);
        const posCount = cs.filter((c) => c > 0).length;
        const ok =
          p.ask === 'all-pos' ? posCount === 3 : p.ask === 'exactly-two-pos' ? posCount === 2 : p.ask === 'product-neg' ? cs[0] * cs[1] < 0 : cs.every((c) => c >= 0);
        if (ok) fav++;
      });
      return mcsCheck(q, `$${frac(fav, all).toTex()}$`);
    }
    // Brute force: items 0..t-1 have the trait; enumerate all selections of r.
    let fav = 0;
    let all = 0;
    forEachCombination(p.N, p.r, (m) => {
      all++;
      const hits = m.filter((i) => i < p.t).length;
      if (p.ask === 'exactly-one' ? hits === 1 : hits >= 1) fav++;
    });
    const target = fav / all;
    const C = (n: number, k: number) => countCombinations(n, k);
    const matches = p.recipes.map((rc, i) => (Math.abs(recipeValue(rc, C) - target) < 1e-9 ? i : -1)).filter((i) => i >= 0);
    if (matches.length !== 1) return `expected exactly one matching choice, got ${matches.length}`;
    return q.answer === matches[0] ? null : `expected choice ${matches[0]}`;
  },
};

/* ================================================================== 5. Two-way table, conditional probability (NE) */

interface TableParams {
  rows: string[];
  cols: string[];
  cells: number[][];
  ask: 'joint' | 'given-row' | 'given-col' | 'given-not-row';
  r: number;
  c: number;
}

const TWT_CTX = [
  {
    title: 'EMPLOYEES OF COMPANY K, BY DEPARTMENT AND MEANS OF COMMUTING',
    rows: ['Sales', 'Engineering', 'Support'],
    cols: ['Drives', 'Public transit', 'Walks or bikes'],
    unit: 'employee',
    rowPhrase: (r: string) => `works in ${r}`,
    rowGiven: (r: string) => `the employee works in ${r}`,
    rowNot: (r: string) => `the employee does not work in ${r}`,
    colPhrase: (c: string) => (c === 'Drives' ? 'drives to work' : c === 'Public transit' ? 'takes public transit to work' : 'walks or bikes to work'),
    colGiven: (c: string) => (c === 'Drives' ? 'the employee drives to work' : c === 'Public transit' ? 'the employee takes public transit to work' : 'the employee walks or bikes to work'),
  },
  {
    title: 'STUDENTS AT A HIGH SCHOOL, BY GRADE AND SPORT PLAYED',
    rows: ['Grade 10', 'Grade 11', 'Grade 12'],
    cols: ['Soccer', 'Basketball', 'Swimming'],
    unit: 'student',
    rowPhrase: (r: string) => `is in ${r.toLowerCase().replace('grade', 'grade')}`,
    rowGiven: (r: string) => `the student is in ${r.replace('Grade', 'grade')}`,
    rowNot: (r: string) => `the student is not in ${r.replace('Grade', 'grade')}`,
    colPhrase: (c: string) => `plays ${c.toLowerCase()}`,
    colGiven: (c: string) => `the student plays ${c.toLowerCase()}`,
  },
  {
    title: 'SURVEY RESPONDENTS, BY AGE GROUP AND PREFERRED NEWS SOURCE',
    rows: ['Under 40', '40 or older', 'Undisclosed'],
    cols: ['Online', 'Television', 'Print'],
    unit: 'respondent',
    rowPhrase: (r: string) => (r === 'Under 40' ? 'is under 40 years old' : r === '40 or older' ? 'is 40 years old or older' : 'did not disclose an age'),
    rowGiven: (r: string) => (r === 'Under 40' ? 'the respondent is under 40 years old' : r === '40 or older' ? 'the respondent is 40 years old or older' : 'the respondent did not disclose an age'),
    rowNot: (r: string) => (r === 'Under 40' ? 'the respondent is not under 40 years old' : r === '40 or older' ? 'the respondent is not 40 years old or older' : 'the respondent disclosed an age'),
    colPhrase: (c: string) => `prefers ${c.toLowerCase()} news`,
    colGiven: (c: string) => `the respondent prefers ${c.toLowerCase()} news`,
  },
];

const twoWayTable: Template<TableParams> = {
  id: 'data.probability.two-way-table',
  skill: SKILL,
  format: 'ne',
  style: 'probability and conditional probability from a two-way table',
  generate(rng, d) {
    const ci = rng.int(0, TWT_CTX.length - 1);
    const ctx = TWT_CTX[ci];
    const nr = d === 3 ? 3 : 2;
    const nc = d === 1 ? 2 : rng.pick([2, 3]);
    const rows = ctx.rows.slice(0, nr);
    const cols = ctx.cols.slice(0, nc);
    const cells = rows.map(() => cols.map(() => rng.int(6, d === 1 ? 40 : 75)));
    const ask: TableParams['ask'] = d === 1 ? rng.pick(['joint', 'given-row'] as const) : d === 2 ? rng.pick(['given-row', 'given-col'] as const) : rng.pick(['given-col', 'given-not-row'] as const);
    const r = rng.int(0, nr - 1);
    const c = rng.int(0, nc - 1);
    const rowT = cells.map((row) => sum(row));
    const colT = cols.map((_, j) => sum(cells.map((row) => row[j])));
    const grand = sum(rowT);
    const table: TableFigure = {
      kind: 'table',
      title: ctx.title,
      headers: ['', ...cols, 'Total'],
      rows: [...rows.map((rn, i) => [rn, ...cells[i].map((x) => `${x}`), `${rowT[i]}`]), ['Total', ...colT.map((x) => `${x}`), `${grand}`]],
    };
    let answer: Frac;
    let stem = '';
    let explanation = '';
    const traps: { value: Frac; trap: string }[] = [];
    const cell = cells[r][c];
    const u = ctx.unit;
    if (ask === 'joint') {
      answer = frac(cell, grand);
      stem = `If one ${u} is to be selected at random from all the ${u}s in the table, what is the probability that the ${u} selected ${ctx.rowPhrase(rows[r])} and ${ctx.colPhrase(cols[c])}?`;
      traps.push({ value: frac(cell, rowT[r]), trap: 'prob-wrong-denominator' }, { value: frac(cell, colT[c]), trap: 'prob-wrong-denominator' });
      explanation = `The ${u} must be in the ${rows[r]} row AND the ${cols[c]} column: ${cell} of all ${grand} ${u}s. Probability: $\\frac{${cell}}{${grand}}${answer.d !== grand ? ` = ${answer.toTex()}` : ''}$.

Dividing by the row total ${rowT[r]} would answer a different question ("given ${ctx.rowGiven(rows[r])}").`;
    } else if (ask === 'given-row') {
      answer = frac(cell, rowT[r]);
      stem = `If one ${u} is to be selected at random from the ${u}s in the table, what is the probability that the ${u} ${ctx.colPhrase(cols[c])}, given that ${ctx.rowGiven(rows[r])}?`;
      traps.push({ value: frac(cell, grand), trap: 'prob-wrong-denominator' }, { value: frac(cell, colT[c]), trap: 'prob-reversed-condition' });
      explanation = `"Given that ${ctx.rowGiven(rows[r])}" restricts the choice to the ${rows[r]} row: ${rowT[r]} ${u}s, of whom ${cell} are in the ${cols[c]} column. Probability: $\\frac{${cell}}{${rowT[r]}}${answer.d !== rowT[r] ? ` = ${answer.toTex()}` : ''}$.

$\\frac{${cell}}{${grand}}$ divides by everyone instead of the given group, and $\\frac{${cell}}{${colT[c]}}$ reverses the condition.`;
    } else if (ask === 'given-col') {
      answer = frac(cell, colT[c]);
      stem = `If one ${u} is to be selected at random from the ${u}s in the table, what is the probability that the ${u} ${ctx.rowPhrase(rows[r])}, given that ${ctx.colGiven(cols[c])}?`;
      traps.push({ value: frac(cell, grand), trap: 'prob-wrong-denominator' }, { value: frac(cell, rowT[r]), trap: 'prob-reversed-condition' });
      explanation = `"Given that ${ctx.colGiven(cols[c])}" restricts the choice to the ${cols[c]} column: ${colT[c]} ${u}s, of whom ${cell} are in the ${rows[r]} row. Probability: $\\frac{${cell}}{${colT[c]}}${answer.d !== colT[c] ? ` = ${answer.toTex()}` : ''}$.

$\\frac{${cell}}{${grand}}$ divides by everyone instead of the given group, and $\\frac{${cell}}{${rowT[r]}}$ reverses the condition.`;
    } else {
      const colOthers = colT[c] - cell;
      const restT = grand - rowT[r];
      answer = frac(colOthers, restT);
      stem = `If one ${u} is to be selected at random from the ${u}s in the table, what is the probability that the ${u} ${ctx.colPhrase(cols[c])}, given that ${ctx.rowNot(rows[r])}?`;
      traps.push({ value: frac(colOthers, grand), trap: 'prob-wrong-denominator' }, { value: frac(colT[c], grand), trap: 'prob-ignored-restriction' }, { value: frac(cell, rowT[r]), trap: 'prob-wrong-event' });
      explanation = `The condition leaves the other ${nr - 1} rows: $${grand} - ${rowT[r]} = ${restT}$ ${u}s. Among them, the ${cols[c]} column has $${colT[c]} - ${cell} = ${colOthers}$. Probability: $\\frac{${colOthers}}{${restT}}${answer.d !== restT ? ` = ${answer.toTex()}` : ''}$.

$\\frac{${colOthers}}{${grand}}$ divides by all ${grand} ${u}s instead of the ${restT} who meet the condition.`;
    }
    return {
      params: { rows, cols, cells, ask, r, c },
      q: {
        format: 'ne',
        figure: table,
        stem: `The table shows the distribution of ${grand} ${u}s.\n\n${stem}\n\nGive your answer as a fraction.`,
        answer: answer!,
        fractionBoxes: true,
        traps: traps.filter((t) => !t.value.eq(answer!)).filter((t, i, arr) => arr.findIndex((x) => x.value.eq(t.value)) === i),
        explanation,
      },
    };
  },
  check(q, { cells, ask, r, c }) {
    // Expand the table into individual people and filter them.
    const people: [number, number][] = [];
    cells.forEach((row, i) => row.forEach((n, j) => {
      for (let k = 0; k < n; k++) people.push([i, j]);
    }));
    let pool = people;
    if (ask === 'given-row') pool = people.filter(([i]) => i === r);
    if (ask === 'given-col') pool = people.filter(([, j]) => j === c);
    if (ask === 'given-not-row') pool = people.filter(([i]) => i !== r);
    const hit = pool.filter(([i, j]) => (ask === 'given-not-row' || ask === 'given-row' ? j === c : ask === 'given-col' ? i === r : i === r && j === c)).length;
    return neCheck(q, frac(hit, pool.length));
  },
};

/* ================================================================== 6. Compare probabilities (QC) */

interface CmpParams {
  kind: 'joint' | 'union' | 'symbolic' | 'dice' | 'replacement';
  pE: Frac;
  pF: Frac;
  relation: 'independent' | 'exclusive' | 'none';
  k: Frac;
  /** symbolic: which comparison (A side is always the event, B the expression). */
  sym: 'exactly-vs-union' | 'exactly-vs-sum' | 'exactly-vs-2rs' | 'exactly-vs-rs' | 'neither-vs-1rs';
  s1: number;
  s2: number;
  red: number;
  blue: number;
  rAsk: 'both-red' | 'one-each';
  swap: boolean;
}

const diceWays = (s: number) => 6 - Math.abs(s - 7);

const compareQC: Template<CmpParams> = {
  id: 'data.probability.compare-qc',
  skill: SKILL,
  format: 'qc',
  style: 'compare probabilities: independent, mutually exclusive, exactly one, dice, replacement',
  generate(rng, d) {
    const kind: CmpParams['kind'] = rng.pick(
      d === 1 ? (['joint', 'dice', 'replacement'] as const) : d === 2 ? (['joint', 'union', 'symbolic', 'replacement', 'dice'] as const) : (['joint', 'union', 'symbolic', 'symbolic'] as const),
    );
    const p: CmpParams = { kind, pE: frac(0), pF: frac(0), relation: 'none', k: frac(0), sym: 'exactly-vs-union', s1: 0, s2: 0, red: 0, blue: 0, rAsk: 'both-red', swap: rng.chance(0.5) };
    let info: string | undefined;
    let qa = '';
    let qb = '';
    let answer: QCChoice;
    let traps: QCQuestion['traps'];
    let explanation = '';
    if (kind === 'joint' || kind === 'union') {
      p.pE = frac(rng.int(2, 8), 10);
      p.pF = frac(rng.int(2, 8), 10);
      p.relation = d === 1 ? 'independent' : rng.pick(['independent', 'exclusive', 'none', 'none'] as const);
      if (p.relation === 'exclusive' && p.pE.add(p.pF).gt(1)) p.relation = 'none';
      const lo = Frac.of(0).add(p.pE.add(p.pF).sub(1)).sign() > 0 ? p.pE.add(p.pF).sub(1) : frac(0);
      const hi = p.pE.lt(p.pF) ? p.pE : p.pF;
      const prod = p.pE.mul(p.pF);
      const relText = p.relation === 'independent' ? ' Events $E$ and $F$ are independent.' : p.relation === 'exclusive' ? ' Events $E$ and $F$ are mutually exclusive.' : '';
      info = `For events $E$ and $F$, $P(E) = ${dtex(p.pE)}$ and $P(F) = ${dtex(p.pF)}$.${relText}`;
      if (kind === 'joint') {
        qa = 'The probability that both $E$ and $F$ occur';
        const value = p.relation === 'independent' ? prod : p.relation === 'exclusive' ? frac(0) : null;
        const roll = rng.next();
        if (value) p.k = roll < 0.45 ? value : value.add(frac(rng.pick([-1, 1, 2]), 20));
        else p.k = roll < 0.5 ? prod : roll < 0.75 ? hi.add(frac(1, 10)) : lo.sign() > 0 ? lo.sub(frac(1, 20)) : lo.add(hi).mul(frac(1, 2));
        if (p.k.sign() <= 0) p.k = frac(1, 20);
        qb = `$${dtex(p.k)}$`;
        if (value) answer = qcCompare(value, p.k);
        else answer = p.k.gt(hi) ? 'B' : p.k.lt(lo) ? 'A' : 'D';
        if (answer === 'D' && p.k.eq(prod)) traps = { C: 'prob-assume-independent' };
        if (p.relation === 'exclusive' && p.k.eq(prod)) traps = { C: 'prob-assume-independent' };
        explanation =
          p.relation === 'independent'
            ? `For independent events, $P(E \\text{ and } F) = P(E)P(F) = ${dtex(p.pE)} \\times ${dtex(p.pF)} = ${dtex(prod)}$. Compare with $${dtex(p.k)}$: ${rel(answer)}. (${answer})`
            : p.relation === 'exclusive'
              ? `Mutually exclusive events cannot occur together, so $P(E \\text{ and } F) = 0$, which is less than $${dtex(p.k)}$. (B)

Multiplying $${dtex(p.pE)} \\times ${dtex(p.pF)}$ would assume independence, which is not given (and is impossible here).`
              : `Without more information, $P(E \\text{ and } F)$ can be anything from $${dtex(lo)}$${lo.sign() > 0 ? ` (since $P(E) + P(F) - 1 = ${dtex(lo)}$)` : ''} up to $${dtex(hi)}$ (when one event is contained in the other). ${
                  answer === 'D'
                    ? `$${dtex(p.k)}$ is in that range, and so are values above and below it. (D)${p.k.eq(prod) ? `\n\nThe value $${dtex(prod)}$ assumes the events are independent, which is not given.` : ''}`
                    : answer === 'B'
                      ? `Even the greatest possible value, $${dtex(hi)}$, is less than $${dtex(p.k)}$. (B)`
                      : `Even the least possible value, $${dtex(lo)}$, is greater than $${dtex(p.k)}$. (A)`
                }`;
      } else {
        qa = 'The probability that at least one of the events $E$ and $F$ occurs';
        const sumP = p.pE.add(p.pF);
        p.k = rng.chance(0.6) ? sumP : sumP.sub(prod);
        if (p.k.gt(1) && rng.chance(0.5)) p.k = frac(1);
        qb = `$${dtex(p.k)}$`;
        const uLo = p.pE.gt(p.pF) ? p.pE : p.pF;
        const uHi = sumP.gt(1) ? frac(1) : sumP;
        if (p.relation === 'independent') answer = qcCompare(sumP.sub(prod), p.k);
        else if (p.relation === 'exclusive') answer = qcCompare(sumP, p.k);
        else answer = p.k.gt(uHi) ? 'B' : p.k.lt(uLo) ? 'A' : 'D';
        if (p.relation !== 'exclusive' && p.k.eq(sumP) && answer !== 'C') traps = { C: 'prob-assume-exclusive' };
        const formula = `$P(E \\text{ or } F) = P(E) + P(F) - P(E \\text{ and } F)$`;
        explanation =
          p.relation === 'independent'
            ? `${formula}, and for independent events $P(E \\text{ and } F) = ${dtex(p.pE)} \\times ${dtex(p.pF)} = ${dtex(prod)}$. So $P(E \\text{ or } F) = ${dtex(sumP)} - ${dtex(prod)} = ${dtex(sumP.sub(prod))}$. Compare with $${dtex(p.k)}$: ${rel(answer)}. (${answer})`
            : p.relation === 'exclusive'
              ? `${formula}, and mutually exclusive events never occur together, so $P(E \\text{ or } F) = ${dtex(p.pE)} + ${dtex(p.pF)} = ${dtex(sumP)}$. Compare with $${dtex(p.k)}$: ${rel(answer)}. (${answer})`
              : `${formula}. Since $P(E \\text{ and } F)$ is not known, $P(E \\text{ or } F)$ can be anything from $${dtex(uLo)}$ (one event inside the other) to $${dtex(uHi)}$${sumP.gt(1) ? '' : ' (mutually exclusive events)'}. ${
                  answer === 'D' ? `$${dtex(p.k)}$ is in that range but other values are possible too. (D)` : answer === 'B' ? `Every possible value is less than $${dtex(p.k)}$. (B)` : `Every possible value is greater than $${dtex(p.k)}$. (A)`
                }${p.k.eq(sumP) && answer !== 'C' ? `\n\nAdding $${dtex(p.pE)} + ${dtex(p.pF)}$ assumes the events cannot occur together, which is not given.` : ''}`;
      }
    } else if (kind === 'symbolic') {
      p.sym = rng.pick(['exactly-vs-union', 'exactly-vs-sum', 'exactly-vs-2rs', 'exactly-vs-rs', 'neither-vs-1rs'] as const);
      info = `Events $G$ and $H$ are independent, with $P(G) = r$ and $P(H) = s$, where $0 < r < 1$ and $0 < s < 1$.`;
      qa = p.sym === 'neither-vs-1rs' ? 'The probability that neither $G$ nor $H$ occurs' : 'The probability that $G$ or $H$ occurs, but not both';
      const exprs: Record<CmpParams['sym'], string> = {
        'exactly-vs-union': '$r + s - rs$',
        'exactly-vs-sum': '$r + s$',
        'exactly-vs-2rs': '$r + s - 2rs$',
        'exactly-vs-rs': '$rs$',
        'neither-vs-1rs': '$1 - r - s$',
      };
      qb = exprs[p.sym];
      answer = { 'exactly-vs-union': 'B', 'exactly-vs-sum': 'B', 'exactly-vs-2rs': 'C', 'exactly-vs-rs': 'D', 'neither-vs-1rs': 'A' }[p.sym] as QCChoice;
      if (p.sym === 'exactly-vs-union') traps = { C: 'prob-exactly-vs-at-least' };
      if (p.sym === 'exactly-vs-sum') traps = { C: 'prob-add-probabilities' };
      if (p.sym === 'neither-vs-1rs') traps = { C: 'prob-add-probabilities' };
      const exactly = 'P(\\text{exactly one}) = r(1 - s) + (1 - r)s = r + s - 2rs';
      explanation =
        p.sym === 'neither-vs-1rs'
          ? `By independence, $P(\\text{neither}) = (1 - r)(1 - s) = 1 - r - s + rs$. That is $rs$ more than $1 - r - s$, and $rs > 0$. (A)

$1 - r - s$ subtracts the overlap twice: it treats the events as if they could not occur together.`
          : p.sym === 'exactly-vs-union'
            ? `$${exactly}$, while $r + s - rs$ is the probability of at least one. Their difference is $rs > 0$ (the "both" case), so Quantity B is greater. (B)`
            : p.sym === 'exactly-vs-sum'
              ? `$${exactly}$, which is $2rs$ less than $r + s$. Since $rs > 0$, Quantity B is greater. (B)`
              : p.sym === 'exactly-vs-2rs'
                ? `$${exactly}$: the two quantities are equal for every $r$ and $s$. (C)`
                : `$${exactly}$. Compare with $rs$: for $r = s = 0.1$, A is $0.18$ and B is $0.01$; for $r = s = 0.9$, A is $0.18$ and B is $0.81$. The relationship cannot be determined. (D)`;
    } else if (kind === 'dice') {
      p.s1 = rng.int(3, 11);
      const roll = rng.next();
      p.s2 = roll < 0.3 ? 14 - p.s1 : rng.pick([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter((x) => x !== p.s1 && x !== 14 - p.s1));
      if (p.s2 === p.s1) p.s2 = p.s1 === 7 ? 6 : 7;
      info = 'Two fair six-sided dice, each with faces numbered 1 through 6, are to be rolled.';
      qa = `The probability that the sum of the two numbers rolled will be ${p.s1}`;
      qb = `The probability that the sum of the two numbers rolled will be ${p.s2}`;
      const w1 = diceWays(p.s1);
      const w2 = diceWays(p.s2);
      answer = qcCompare(w1, w2);
      if (answer !== 'C') traps = { C: 'prob-sums-equally-likely' };
      explanation = `There are 36 equally likely outcomes. A sum of ${p.s1} happens in ${w1} of them and a sum of ${p.s2} in ${w2} (the number of ways is $6 - |s - 7|$: sums near 7 are the most likely). So the probabilities are $\\frac{${w1}}{36}$ and $\\frac{${w2}}{36}$: ${rel(answer)}. (${answer})

The 11 possible sums are not equally likely.`;
    } else {
      p.red = rng.int(2, 6);
      p.blue = rng.int(2, 6);
      p.rAsk = d === 1 ? 'both-red' : rng.pick(['both-red', 'one-each'] as const);
      const n = p.red + p.blue;
      info = `A bag contains ${p.red} red marbles and ${p.blue} blue marbles. Two marbles are to be drawn at random from the bag.`;
      const ev = p.rAsk === 'both-red' ? 'both marbles drawn will be red' : 'the two marbles drawn will be of different colors';
      const withR = `The probability that ${ev} if the first marble is put back in the bag before the second is drawn`;
      const without = `The probability that ${ev} if the first marble is not put back in the bag`;
      const vWith = p.rAsk === 'both-red' ? frac(p.red * p.red, n * n) : frac(2 * p.red * p.blue, n * n);
      const vWithout = p.rAsk === 'both-red' ? frac(p.red * (p.red - 1), n * (n - 1)) : frac(2 * p.red * p.blue, n * (n - 1));
      [qa, qb] = p.swap ? [without, withR] : [withR, without];
      answer = p.swap ? qcCompare(vWithout, vWith) : qcCompare(vWith, vWithout);
      traps = { C: 'prob-with-replacement' };
      explanation =
        p.rAsk === 'both-red'
          ? `With replacement: $\\frac{${p.red}}{${n}} \\times \\frac{${p.red}}{${n}} = ${vWith.toTex()}$. Without replacement: $\\frac{${p.red}}{${n}} \\times \\frac{${p.red - 1}}{${n - 1}} = ${vWithout.toTex()}$, smaller because once a red marble is gone, red is less likely on the second draw. ${rel(answer).replace(/^./, (c) => c.toUpperCase())}. (${answer})`
          : `With replacement: $2 \\times \\frac{${p.red}}{${n}} \\times \\frac{${p.blue}}{${n}} = ${vWith.toTex()}$. Without replacement: $2 \\times \\frac{${p.red}}{${n}} \\times \\frac{${p.blue}}{${n - 1}} = ${vWithout.toTex()}$, larger because after one color is drawn, the other color makes up a bigger share of what is left. ${rel(answer).replace(/^./, (c) => c.toUpperCase())}. (${answer})`;
    }
    if (traps && traps[answer!]) delete traps[answer!];
    if (traps && !Object.keys(traps).length) traps = undefined;
    return { params: p, q: { format: 'qc', info, quantityA: qa, quantityB: qb, answer: answer!, ...(traps ? { traps } : {}), explanation } };
  },
  check(q, p) {
    let expected: QCChoice;
    if (p.kind === 'joint' || p.kind === 'union') {
      // Sample every feasible joint probability x = P(E and F) on a fine grid.
      const xs: Frac[] = [];
      if (p.relation === 'independent') xs.push(p.pE.mul(p.pF));
      else if (p.relation === 'exclusive') xs.push(frac(0));
      else for (let i = 0; i <= 100; i++) xs.push(frac(i, 100));
      const samples: [Frac, Frac][] = [];
      for (const x of xs) {
        const regions = [x, p.pE.sub(x), p.pF.sub(x), frac(1).sub(p.pE).sub(p.pF).add(x)];
        if (regions.some((r) => r.sign() < 0)) continue;
        samples.push([p.kind === 'joint' ? x : p.pE.add(p.pF).sub(x), p.k]);
      }
      expected = qcFromSamples(samples);
    } else if (p.kind === 'symbolic') {
      const samples: [Frac, Frac][] = [];
      for (let i = 1; i < 10; i++)
        for (let j = 1; j < 10; j++) {
          const r = frac(i, 10);
          const s = frac(j, 10);
          // enumerate the four outcomes
          const pGH = r.mul(s);
          const pG = r.mul(frac(1).sub(s));
          const pH = frac(1).sub(r).mul(s);
          const pNone = frac(1).sub(r).mul(frac(1).sub(s));
          const a = p.sym === 'neither-vs-1rs' ? pNone : pG.add(pH);
          const b = { 'exactly-vs-union': pG.add(pH).add(pGH), 'exactly-vs-sum': r.add(s), 'exactly-vs-2rs': r.add(s).sub(r.mul(s).mul(2)), 'exactly-vs-rs': r.mul(s), 'neither-vs-1rs': frac(1).sub(r).sub(s) }[p.sym];
          samples.push([a, b]);
        }
      expected = qcFromSamples(samples);
    } else if (p.kind === 'dice') {
      let w1 = 0;
      let w2 = 0;
      for (let a = 1; a <= 6; a++)
        for (let b = 1; b <= 6; b++) {
          if (a + b === p.s1) w1++;
          if (a + b === p.s2) w2++;
        }
      expected = qcCompare(w1, w2);
    } else {
      const n = p.red + p.blue;
      let gw = 0;
      let aw = 0;
      let go = 0;
      let ao = 0;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const ok = p.rAsk === 'both-red' ? i < p.red && j < p.red : i < p.red !== j < p.red;
          aw++;
          if (ok) gw++;
          if (i !== j) {
            ao++;
            if (ok) go++;
          }
        }
      const vWith = frac(gw, aw);
      const vWithout = frac(go, ao);
      expected = p.swap ? qcCompare(vWithout, vWith) : qcCompare(vWith, vWithout);
    }
    return q.format === 'qc' && q.answer === expected ? null : `expected ${expected}`;
  },
};

/* ================================================================== 7. Possible values of P(A or B) / P(A and B) (MCM) */

interface PossibleParams {
  pA: Frac;
  pB: Frac;
  ask: 'or' | 'and';
  values: Frac[];
}

const possibleValues: Template<PossibleParams> = {
  id: 'data.probability.possible-values',
  skill: SKILL,
  format: 'mcm',
  style: 'which values could P(A or B) or P(A and B) be',
  generate(rng, d) {
    const ask: PossibleParams['ask'] = d === 1 ? 'or' : d === 2 ? rng.pick(['or', 'and'] as const) : rng.pick(['and', 'or'] as const);
    const useFractions = d >= 2 && rng.chance(0.5);
    let pA: Frac;
    let pB: Frac;
    let den: number;
    for (;;) {
      den = useFractions ? rng.pick([8, 12, 10]) : 20;
      pA = frac(rng.int(Math.ceil(den * 0.2), Math.floor(den * 0.8)), den);
      pB = frac(rng.int(Math.ceil(den * 0.15), Math.floor(den * 0.7)), den);
      if (pA.eq(pB)) continue;
      if (ask === 'and' && d === 3 && !pA.add(pB).gt(1)) continue; // a positive lower bound
      if (ask === 'or' && pA.add(pB).gt(1) && d === 1) continue;
      break;
    }
    const sumP = pA.add(pB);
    const lo = ask === 'or' ? (pA.gt(pB) ? pA : pB) : sumP.gt(1) ? sumP.sub(1) : frac(0);
    const hi = ask === 'or' ? (sumP.gt(1) ? frac(1) : sumP) : pA.lt(pB) ? pA : pB;
    // Candidate values on the grid 1/den, spread around the interval.
    const step = frac(1, den);
    const cands: { v: Frac; trap?: string }[] = [];
    const inside: Frac[] = [];
    for (let v = lo; !v.gt(hi); v = v.add(step)) inside.push(v);
    const pickIn = rng.sample(inside, Math.min(inside.length, rng.int(1, 3)));
    if (rng.chance(0.5) && !pickIn.some((v) => v.eq(lo))) pickIn.push(lo);
    for (const v of pickIn) cands.push({ v });
    const below = lo.sub(step.mul(rng.int(1, 3)));
    if (below.sign() > 0) cands.push({ v: below, trap: ask === 'or' ? 'prob-union-below-max' : 'prob-and-floor' });
    const above = hi.add(step.mul(rng.int(1, 3)));
    if (above.lt(1)) cands.push({ v: above, trap: ask === 'or' ? 'prob-add-probabilities' : 'prob-and-above-min' });
    if (ask === 'and' && sumP.gt(1) && lo.sub(step).sign() > 0 && !cands.some((c) => c.v.eq(lo.sub(step)))) cands.push({ v: lo.sub(step), trap: 'prob-and-floor' });
    if (ask === 'or' && !sumP.gt(1) && !cands.some((c) => c.v.eq(sumP))) cands.push({ v: sumP });
    const uniq = cands.filter((c, i) => cands.findIndex((x) => x.v.eq(c.v)) === i);
    while (uniq.length < 4) {
      const v = frac(rng.int(1, den - 1), den);
      if (!uniq.some((c) => c.v.eq(v))) uniq.push({ v, ...(v.lt(lo) ? { trap: ask === 'or' ? 'prob-union-below-max' : 'prob-and-floor' } : v.gt(hi) ? { trap: ask === 'or' ? 'prob-add-probabilities' : 'prob-and-above-min' } : {}) });
    }
    const chosen = uniq.slice(0, 6).sort((a, b) => a.v.cmp(b.v));
    const fmt = (v: Frac) => (useFractions ? `$${v.toTex()}$` : `$${dtex(v)}$`);
    const { choices, answer } = flaggedChoices(chosen.map((c) => ({ text: fmt(c.v), correct: !c.v.lt(lo) && !c.v.gt(hi), ...(c.trap && (c.v.lt(lo) || c.v.gt(hi)) ? { trap: c.trap } : {}) })));
    const ptex = (v: Frac) => (useFractions ? v.toTex() : dtex(v));
    const evText = ask === 'or' ? 'that $A$ or $B$ or both will occur' : 'that both $A$ and $B$ will occur';
    const stem = `For events $A$ and $B$, the probability that $A$ will occur is $${ptex(pA)}$, and the probability that $B$ will occur is $${ptex(pB)}$. Which of the following could be the probability ${evText}?`;
    const big = pA.gt(pB) ? 'A' : 'B';
    const small = big === 'A' ? 'B' : 'A';
    const explanation =
      ask === 'or'
        ? `$P(A \\text{ or } B)$ is smallest when $${small}$ is entirely inside $${big}$: then it equals $P(${big}) = ${ptex(lo)}$. It is largest when the events cannot occur together: $${ptex(pA)} + ${ptex(pB)} = ${ptex(sumP)}$${sumP.gt(1) ? ', but a probability cannot exceed 1, so the greatest value is 1' : ''}. So the possible values are from $${ptex(lo)}$ to $${ptex(hi)}$, inclusive.

A value below $${ptex(lo)}$ is impossible: whenever $${big}$ occurs, "$A$ or $B$" occurs.`
        : `$P(A \\text{ and } B)$ cannot exceed the smaller probability, $${ptex(hi)}$ (that happens when one event is inside the other). ${
            sumP.gt(1)
              ? `It also cannot be less than $P(A) + P(B) - 1 = ${ptex(sumP)} - 1 = ${ptex(lo)}$, because $P(A \\text{ or } B) = P(A) + P(B) - P(A \\text{ and } B)$ cannot exceed 1.`
              : 'It can be as small as 0 (mutually exclusive events).'
          } So the possible values are from $${ptex(lo)}$ to $${ptex(hi)}$, inclusive.`;
    return {
      params: { pA, pB, ask, values: chosen.map((c) => c.v) },
      q: { format: 'mcm', stem, instruction: 'Indicate all such probabilities.', choices, answer, explanation },
    };
  },
  check(q, { pA, pB, ask, values }) {
    // A value is possible when the four Venn regions it implies are all probabilities in [0, 1].
    const truth = values.map((v) => {
      const x = ask === 'and' ? v : pA.add(pB).sub(v);
      const regions = [x, pA.sub(x), pB.sub(x), frac(1).sub(pA).sub(pB).add(x)];
      return regions.every((r) => r.sign() >= 0 && !r.gt(1));
    });
    return mcmCheck(q, truth);
  },
};

export const probabilityTemplates: Template<any>[] = [singleDraw, independent, withoutReplacement, chooseK, twoWayTable, compareQC, possibleValues];
