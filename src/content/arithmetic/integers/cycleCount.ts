import type { Template, Trap } from '../../../engine/types';
import { expectMcsBy, listAnd, spreadChoices } from './util';

export const cycleCountTraps: Record<string, Trap> = {
  'cycle-count-full-only': {
    label: 'Counted only the complete blocks',
    fix: 'After the whole blocks, a few lights are left over. Count how many of the target color are among those leftover lights (the first ones of the block).',
  },
  'cycle-count-partial-as-full': {
    label: 'Counted the unfinished block as a full block',
    fix: 'The last block stops early. Only its first lights are lit, so count only the target colors among them.',
  },
  'cycle-count-leftover-end': {
    label: 'Took the leftover lights from the end of the block',
    fix: 'The pattern always starts a block at its first color, so the leftover lights are the FIRST ones of the block, not the last ones.',
  },
  'cycle-count-proportion': {
    label: 'Used the share of the target color as if it were exact',
    fix: 'The share $per/L$ is only right over whole blocks. The leftover lights are a partial block and must be listed one by one.',
  },
  'cycle-count-blocks-not-targets': {
    label: 'Gave the number of complete blocks instead of the number of target lights',
    fix: 'Each block holds several lights of the target color, so multiply the number of blocks by the count per block, then add the leftover lights.',
  },
  'cycle-count-intro-in-cycle': {
    label: 'Started the repeating blocks at light 1 instead of after the opening lights',
    fix: 'The opening lights are not part of the cycle. Subtract their number first, then divide the rest into blocks.',
  },
};

const COLORS = ['red', 'blue', 'green', 'yellow', 'white', 'orange', 'purple'];

interface P {
  intro: string[];
  cycle: string[];
  target: string;
  a: number;
  b: number;
}

const cnt = (xs: string[], t: string) => xs.filter((x) => x === t).length;

/** Lights of the target color among the first N, by block arithmetic. */
function upTo(intro: string[], cycle: string[], t: string, N: number, how: 'true' | 'full' | 'ceil' | 'end' | 'noIntro'): number {
  const I = how === 'noIntro' ? 0 : intro.length;
  const L = cycle.length;
  const head = how === 'noIntro' ? 0 : cnt(intro.slice(0, Math.min(N, I)), t);
  if (N <= I) return head;
  const rest = N - I;
  const q = Math.floor(rest / L);
  const rem = rest % L;
  const per = cnt(cycle, t);
  if (how === 'full') return head + q * per;
  if (how === 'ceil') return head + Math.ceil(rest / L) * per;
  if (how === 'end') return head + q * per + (rem ? cnt(cycle.slice(-rem), t) : 0);
  return head + q * per + cnt(cycle.slice(0, rem), t);
}

const patternCount: Template<P> = {
  id: 'arith.cycles.pattern-count',
  skill: 'arith.cycles',
  format: 'mcs',
  style: 'how many lights of one color among the first N (or numbered a to b) in a repeating pattern',
  generate(rng, diff) {
    let tries = 0;
    for (;;) {
      tries++;
      const target = rng.pick(COLORS);
      const per = rng.int(3, 4);
      const L = Math.min(6 + per, diff === 1 ? rng.int(7, 9) : rng.int(8, 10));
      const others = rng.sample(
        COLORS.filter((c) => c !== target),
        L - per,
      );
      const cycle = rng.shuffle([...others, ...Array(per).fill(target)]);
      const intro = diff === 3 ? rng.sample(COLORS, rng.int(2, 3)) : [];
      const a = diff === 3 ? rng.int(18, 90) : 1;
      const b = diff === 1 ? rng.int(20, 70) : diff === 2 ? rng.int(100, 420) : a + rng.int(70, 260);
      const range = diff === 3;
      const answer = upTo(intro, cycle, target, b, 'true') - (range ? upTo(intro, cycle, target, a - 1, 'true') : 0);
      const d = (how: Parameters<typeof upTo>[4]) => upTo(intro, cycle, target, b, how) - (range ? upTo(intro, cycle, target, a - 1, how) : 0);
      const cands: { v: number; trap: string }[] = [
        { v: d('full'), trap: 'cycle-count-full-only' },
        { v: d('ceil'), trap: 'cycle-count-partial-as-full' },
        { v: d('end'), trap: 'cycle-count-leftover-end' },
      ];
      const span = b - a + 1;
      cands.push({ v: Math.round((span * per) / L), trap: 'cycle-count-proportion' }, { v: Math.floor(span / L), trap: 'cycle-count-blocks-not-targets' });
      if (range) {
        cands.push({ v: d('noIntro'), trap: 'cycle-count-intro-in-cycle' }, { v: upTo(intro, cycle, target, b, 'true') - upTo(intro, cycle, target, a, 'true'), trap: 'cycle-count-terms' });
      }
      let res;
      try {
        res = spreadChoices(rng, answer, cands.filter((x) => x.v >= 0), (v) => `$${v}$`, 5, 'shuffled');
      } catch {
        continue;
      }
      const vs = res.choices.map((c) => Number(c.text.replace(/\$/g, ''))).sort((x, y) => x - y);
      if (vs.filter((v, i) => i && v - vs[i - 1] === 1).length > 2 && tries < 60) continue;
      const cite = res.choices.find((_, i) => i !== res.answer)!;
      const cv = Number(cite.text.replace(/\$/g, ''));
      const SAY: Record<string, string> = {
        'cycle-count-full-only': `Dropping the leftover lights gives $${cv}$, which counts only complete blocks.`,
        'cycle-count-partial-as-full': `Counting the unfinished block as a whole block gives $${cv}$, but only its first lights are lit.`,
        'cycle-count-leftover-end': `Taking the leftover lights from the end of the block gives $${cv}$, but they come from the start.`,
        'cycle-count-proportion': `Using the share ${per} out of ${L} on ${span} lights gives $${cv}$, which ignores how the leftover lights fall.`,
        'cycle-count-blocks-not-targets': `Counting the complete blocks gives $${cv}$, but each block holds ${per} ${target} lights.`,
        'cycle-count-intro-in-cycle': `Starting the blocks at light 1 gives $${cv}$, but the opening lights shift every block.`,
        'cycle-count-terms': `Leaving out light ${a} gives $${cv}$; the range includes both ends.`,
      };
      const list = cycle.join(', ');
      const I = intro.length;
      const N = b;
      const rest = N - I;
      const q = Math.floor(rest / L);
      const rem = rest % L;
      const stem = range
        ? `A strip of lights begins with ${listAnd(intro)}. After those, the colors follow a repeating order: ${list}, and then it starts over. How many of the lights numbered ${a} through ${b}, inclusive, are ${target}?`
        : `A strip of lights follows a repeating color order: ${list}, and then it starts over with ${cycle[0]}. How many of the first ${b} lights are ${target}?`;
      const explanation = range
        ? `Count the ${target} lights up to light ${b}, then remove those before light ${a}. The opening ${I} lights are not part of the blocks, so ${b} lights leave $${b} - ${I} = ${rest}$ in blocks of ${L}: ${q} full blocks (${q * per}) ${rem ? `plus ${rem} leftover lights, which are the first ${rem} of the block (${cnt(cycle.slice(0, rem), target)} ${target}), ` : 'and no leftover lights, '}plus ${cnt(intro, target)} in the opening: ${upTo(intro, cycle, target, b, 'true')} up to ${b}.

Up to light ${a - 1} the same method gives ${upTo(intro, cycle, target, a - 1, 'true')}, so the answer is $${upTo(intro, cycle, target, b, 'true')} - ${upTo(intro, cycle, target, a - 1, 'true')} = ${answer}$.

Trap: ${SAY[cite.trap!]}`
        : `The order has ${L} colors, with ${per} ${target} per block. In ${b} lights: $${b} = ${L} \\cdot ${q} + ${rem}$, so there are ${q} full blocks, giving $${q} \\cdot ${per} = ${q * per}$ ${target} lights.

The ${rem} leftover lights are the first ${rem} of the block${rem ? `: ${listAnd(cycle.slice(0, rem))}, with ${cnt(cycle.slice(0, rem), target)} ${target}` : ', so none'}. Total: $${answer}$.

Trap: ${SAY[cite.trap!]}`;
      return { params: { intro, cycle, target, a, b }, q: { format: 'mcs', stem, choices: res.choices, answer: res.answer, explanation } };
    }
  },
  check(q, { intro, cycle, target, a, b }) {
    let n = 0;
    for (let i = 1; i <= b; i++) {
      const color = i <= intro.length ? intro[i - 1] : cycle[(i - intro.length - 1) % cycle.length];
      if (i >= a && color === target) n++;
    }
    return expectMcsBy(q, (i) => q.format === 'mcs' && q.choices[i].text === `$${n}$`);
  },
};

export const patternCountTemplates: Template<any>[] = [patternCount];
