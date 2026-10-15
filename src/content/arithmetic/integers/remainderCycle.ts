import { flaggedChoices } from '../../../engine/build';
import { gcd } from '../../../engine/math';
import type { Choice, Template, Trap } from '../../../engine/types';
import { expectMcm, listAnd } from './util';

export const remainderCycleTraps: Record<string, Trap> = {
  'int-used-divisor-remainder': {
    label: 'Used only the shift per step, not where the cycle starts',
    fix: 'If $N = ak + r$, each step of $k$ adds $a$ to $N$. The remainder on division by $b$ starts at the remainder of $r$ and then moves by ($a \\bmod b$) each step. The step alone is not a starting point.',
  },
  'int-remainder-any-possible': {
    label: 'Assumed every remainder below the divisor is possible',
    fix: 'Adding $a$ again and again moves the remainder in jumps of ($a \\bmod b$), so it visits only a cycle of values. Only remainders that differ from the first one by a multiple of gcd$(a, b)$ can occur.',
  },
};

interface RemParams {
  a: number;
  r: number;
  b: number;
  c: number;
  s: number;
  vals: number[];
}

const mod = (x: number, m: number) => ((x % m) + m) % m;

const remainderCycle: Template<RemParams> = {
  id: 'arith.divisibility.remainder-cycle',
  skill: 'arith.divisibility',
  format: 'mcm',
  style: 'N leaves remainder r on division by a: which remainders are possible on division by b',
  generate(rng, diff) {
    for (;;) {
      let a: number;
      let b: number;
      let c = 1;
      let s = 0;
      if (diff === 1) {
        b = rng.pick([6, 8, 10, 12, 14]);
        a = (b / 2) * rng.pick([3, 5, 7]);
      } else {
        a = rng.int(10, 45);
        b = rng.int(8, 30);
        if (diff === 3) {
          c = rng.int(2, 5);
          s = rng.int(1, 6);
        }
      }
      const g = gcd(c * a, b);
      if (diff === 1 ? g !== b / 2 : g === 1 || g === b) continue;
      const r = rng.int(1, a - 1);
      if (diff === 1 && r < b) continue;
      const start = mod(c * r + s, b);
      const step = mod(c * a, b);
      const poss = (v: number) => (v - start) % g === 0;
      const good: number[] = [];
      const bad: { v: number; trap: string }[] = [];
      for (let v = 0; v < b; v++) {
        if (poss(v)) good.push(v);
        else bad.push({ v, trap: v === mod(-start, b) ? 'int-remainder-complement' : v === step ? 'int-used-divisor-remainder' : 'int-remainder-any-possible' });
      }
      const count = diff === 1 ? 5 : 6;
      const nGood = diff === 1 ? 2 : rng.int(1, Math.min(3, good.length));
      if (bad.length < count - nGood) continue;
      const items = [...rng.sample(good, nGood).map((v) => ({ v, correct: true, trap: undefined as string | undefined })), ...rng.sample(bad, count - nGood).map((x) => ({ ...x, correct: false }))].sort((x, y) => x.v - y.v);
      if (items.length !== count) continue;
      const { choices, answer } = flaggedChoices(items.map((x) => ({ text: `$${x.v}$`, correct: x.correct, ...(x.trap ? { trap: x.trap } : {}) })) as (Choice & { correct: boolean })[]);
      const target = `$${c === 1 ? 'N' : `${c}N + ${s}`}$`;
      const cycle = Array.from({ length: b / g }, (_, j) => mod(start + j * step, b));
      const wrong = items.find((x) => !x.correct)!;
      const trapText: Record<string, string> = {
        'int-remainder-complement': `${wrong.v} comes from counting back from the next multiple of ${b}; remainders count up from the last multiple`,
        'int-used-divisor-remainder': `${wrong.v} is only the step ${step}, which says how the remainder moves and not where it starts`,
        'int-remainder-any-possible': `${wrong.v} is below ${b}, but the cycle never lands on it`,
      };
      const explanation = `Recognize: $N = ${a}k + ${r}$, and each step of $k$ adds ${a}, so the remainder on division by ${b} moves in a cycle.

${step === 0 ? `Here ${b} divides ${a}, so adding ${a} never changes the remainder: ${target} always leaves ${start}.` : `For $k = 0$, ${target} leaves ${start}. Each step adds ${step} (${c * a} mod ${b}), so the remainders run ${cycle.join(', ')} and then repeat.`} Only these values occur: ${listAnd(cycle.slice().sort((x, y) => x - y).map(String))}.

Check: $k = 1$ gives $N = ${a + r}$${c === 1 ? '' : `, so ${target} is ${c * (a + r) + s}`}, remainder ${mod(c * (a + r) + s, b)}.

Trap: ${trapText[wrong.trap!]}. Rule: the cycle reaches only values that share the start's remainder mod gcd$(${c * a}, ${b}) = ${g}$.`;
      return {
        params: { a, r, b, c, s, vals: items.map((x) => x.v) },
        q: {
          format: 'mcm',
          stem: `When the positive integer $N$ is divided by ${a}, the remainder is ${r}. Which of the following could be the remainder when ${target} is divided by ${b}?`,
          instruction: 'Indicate all such remainders.',
          choices,
          answer,
          explanation,
        },
      };
    }
  },
  check(q, { a, r, b, c, s, vals }) {
    const seen = new Set<number>();
    for (let k = 0; k <= 2 * b; k++) seen.add((c * (a * k + r) + s) % b);
    return expectMcm(q, vals.flatMap((v, i) => (seen.has(v) ? [i] : [])));
  },
};

export const remainderCycleTemplates: Template<any>[] = [remainderCycle];
