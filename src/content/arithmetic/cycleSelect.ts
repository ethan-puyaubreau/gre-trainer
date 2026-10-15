import { flaggedChoices } from '../../engine/build';
import type { Choice, Template, Trap } from '../../engine/types';
import { expectMcm } from './integers/util';

export const cycleSelectTraps: Record<string, Trap> = {
  'cycle-multiple-of-position': {
    label: 'Took every multiple of the letter\'s position inside the cycle',
    fix: 'If a letter is third in a cycle of 5, it is in positions 3, 8, 13, ... (remainder 3 on division by 5), not in every third position.',
  },
  'cycle-wrong-length': {
    label: 'Counted the length of the cycle wrongly',
    fix: 'Count the letters of one full cycle before dividing. Dividing by a number that is one too big or too small moves every remainder.',
  },
  'cycle-ignored-intro': {
    label: 'Treated the opening terms as part of the cycle',
    fix: 'The cycle starts after the opening terms. Subtract the number of opening terms from the position first, then divide by the cycle length.',
  },
};

interface CycParams {
  intro: string[];
  cycle: string[];
  target: string;
  vals: number[];
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** Letter at position n (1-based), built term by term. */
function letterAt(intro: string[], cycle: string[], n: number): string {
  const seq: string[] = [...intro];
  while (seq.length < n) seq.push(cycle[(seq.length - intro.length) % cycle.length]);
  return seq[n - 1];
}

const cyclePositions: Template<CycParams> = {
  id: 'arith.cycles.positions-select',
  skill: 'arith.cycles',
  format: 'mcm',
  style: 'which positions of a repeating pattern hold a given letter',
  generate(rng, diff) {
    for (;;) {
      let intro: string[] = [];
      let cycle: string[];
      let target: string;
      if (diff === 1) {
        cycle = rng.sample(LETTERS, rng.int(4, 7));
        target = rng.pick(cycle);
      } else if (diff === 2) {
        const k = rng.int(6, 8);
        const l = rng.shuffle(LETTERS);
        target = l[0];
        cycle = rng.shuffle([target, target, ...l.slice(1, k - 1)]);
        if (cycle.filter((x) => x === target).length !== 2) continue;
      } else {
        const l = rng.shuffle(LETTERS);
        const m = rng.int(2, 3);
        const k = rng.int(3, 5);
        intro = l.slice(0, m);
        cycle = l.slice(m, m + k);
        target = rng.pick(cycle);
      }
      const k = cycle.length;
      const m = intro.length;
      const posOf = cycle.flatMap((x, i) => (x === target ? [i + 1] : []));
      const ok = (n: number) => n > m && posOf.includes(((n - m - 1) % k) + 1);
      const noIntro = (n: number) => posOf.includes(((n - 1) % k) + 1);
      const [lo, hi] = diff === 1 ? [12, 150] : diff === 2 ? [20, 250] : [25, 320];
      const good: number[] = [];
      const bad: { v: number; trap: string }[] = [];
      for (let n = lo; n <= hi; n++) {
        if (ok(n)) good.push(n);
        else if (m > 0 && noIntro(n)) bad.push({ v: n, trap: 'cycle-ignored-intro' });
        else if (n > m && posOf.some((p) => ((n - m) % k) + 1 === p || ((n - m - 2 + k) % k) + 1 === p)) bad.push({ v: n, trap: 'cycle-off-by-one' });
        else if (m === 0 && posOf.some((p) => p > 1 && n % p === 0)) bad.push({ v: n, trap: 'cycle-multiple-of-position' });
        else if (m === 0 && [k - 1, k + 1].some((len) => len > 1 && posOf.includes(((n - 1) % len) + 1))) bad.push({ v: n, trap: 'cycle-wrong-length' });
      }
      const count = diff === 1 ? 5 : 6;
      const nGood = diff === 2 ? rng.int(2, 3) : rng.int(1, 2);
      if (good.length < nGood) continue;
      const classes = rng.shuffle([...new Set(bad.map((b) => b.trap))]);
      const pools = classes.map((c) => rng.shuffle(bad.filter((b) => b.trap === c)));
      const wrong: { v: number; trap: string }[] = [];
      for (let round = 0; wrong.length < count - nGood && round < 8; round++)
        for (const pool of pools) if (wrong.length < count - nGood && pool[round]) wrong.push(pool[round]);
      if (wrong.length < count - nGood || classes.length < 2) continue;
      const items = [...rng.sample(good, nGood).map((v) => ({ v, correct: true, trap: undefined as string | undefined })), ...wrong.map((w) => ({ ...w, correct: false }))].sort((x, y) => x.v - y.v);
      const { choices, answer } = flaggedChoices(items.map((x) => ({ text: `$${x.v}$`, correct: x.correct, ...(x.trap ? { trap: x.trap } : {}) })) as (Choice & { correct: boolean })[]);
      const show = (xs: string[]) => xs.join(', ');
      const twice = [...cycle, ...cycle];
      const stem =
        diff === 3
          ? `A sequence begins ${show(intro)}, and after that the letters ${show(cycle)} repeat in this order forever: ${show([...intro, ...twice.slice(0, k + 2)])}, ... Which of the following positions hold the letter ${target}? (The first term is in position 1.)`
          : `The letters ${show(cycle)} repeat in this order forever: ${show(twice.slice(0, k + 3))}, ... Which of the following positions hold the letter ${target}? (The first term is in position 1.)`;
      const rem = (n: number) => (n - m) % k;
      const bullets = items
        .map((x) => `- ${x.v}: ${m ? `${x.v - m} leaves` : 'leaves'} ${rem(x.v)}, so ${letterAt(intro, cycle, x.v)} ${x.correct ? '✓' : '✗'}`)
        .join('\n');
      const w = items.find((x) => !x.correct)!;
      const lens = [k - 1, k + 1].find((len) => len > 1 && posOf.includes(((w.v - 1) % len) + 1));
      const trapLine: Record<string, string> = {
        'cycle-off-by-one': `${w.v} lands next to the right place, on ${letterAt(intro, cycle, w.v)}`,
        'cycle-multiple-of-position': `${w.v} is a multiple of ${posOf.find((p) => p > 1 && w.v % p === 0)}, the position of ${target}, but positions repeat every ${k}`,
        'cycle-wrong-length': `${w.v} only works for a cycle of ${lens} letters, but this one has ${k}`,
        'cycle-ignored-intro': `${w.v} would work if the cycle began at term 1, but the first ${m} terms are not part of it`,
      };
      const where = posOf.length === 1 ? `position ${posOf[0]}` : `positions ${posOf.join(' and ')}`;
      const explanation = `Recognize: the pattern is a cycle of ${k} letters, so only a remainder on division by ${k} matters${m ? ` after the ${m} opening terms` : ''}.

In the cycle, ${target} sits in ${where}. ${m ? `Term $n$ is cycle position $(n - ${m}) \\bmod ${k}$.` : `Term $n$ holds ${target} when $n \\bmod ${k}$ is ${posOf.map((p) => p % k).join(' or ')}.`} A remainder of 0 means the last letter of the cycle.

${bullets}

Trap: ${trapLine[w.trap!]}. Reduce to a place in the cycle first.`;
      return {
        params: { intro, cycle, target, vals: items.map((x) => x.v) },
        q: { format: 'mcm', stem, instruction: 'Indicate all such positions.', choices, answer, explanation },
      };
    }
  },
  check(q, { intro, cycle, target, vals }) {
    return expectMcm(q, vals.flatMap((n, i) => (letterAt(intro, cycle, n) === target ? [i] : [])));
  },
};

export const cycleSelectTemplates: Template<any>[] = [cyclePositions];
