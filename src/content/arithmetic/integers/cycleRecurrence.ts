import { frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { Template } from '../../../engine/types';
import { expectNe } from './util';

type Kind = 'flip' | 'diff' | 'sum';
interface P {
  kind: Kind;
  x: number;
  y: number; // for 'flip' this is the constant c
  N: number;
}

/** The period of the sequence, by the cycle formula. */
const period = (kind: Kind, x: number, y: number) => (kind === 'flip' ? [x, y - x] : [x, y, y - x, -x, -y, x - y]);
const T = (v: number) => `$${num(v)}$`;
const nz = (v: number) => (v < 0 ? `(${v})` : `${v}`);

const recurrence: Template<P> = {
  id: 'arith.cycles.recurrence-term',
  skill: 'arith.cycles',
  format: 'ne',
  style: 'far term (or sum of the first N terms) of a sequence defined by a recurrence whose terms repeat',
  generate(rng, diff) {
    for (;;) {
      const kind: Kind = diff === 1 ? 'flip' : diff === 2 ? 'diff' : 'sum';
      const x = rng.int(-9, 12);
      const y = kind === 'flip' ? rng.int(-6, 20) : rng.int(-9, 12);
      if (x === 0 || y === 0 || (kind === 'flip' ? y === 2 * x || y === x : y === x || y === 2 * x || x === -y)) continue;
      const N = kind === 'flip' ? rng.int(60, 999) : kind === 'diff' ? rng.int(40, 400) : rng.int(100, 900);
      const cyc = period(kind, x, y);
      const L = cyc.length;
      const rem = N % L;
      const at = (n: number) => cyc[(((n - 1) % L) + L) % L];
      let answer: number;
      let traps: { value: number; trap: string }[];
      let explanation: string;
      let stem: string;
      const termsTex = cyc.map((v) => T(v)).join(', ');
      if (kind === 'flip') {
        answer = at(N);
        traps = [{ value: at(N + 1), trap: 'cycle-off-by-one' }];
        stem = `A sequence has $a_1 = ${x}$ and $a_{n+1} = ${y} - a_n$ for every positive integer $n$. What is the value of $a_{${N}}$?`;
        explanation = `Write the first terms: $a_1 = ${x}$, $a_2 = ${y} - ${nz(x)} = ${num(y - x)}$, $a_3 = ${y} - ${nz(y - x)} = ${x}$. The terms return to the start, so they alternate ${T(x)}, ${T(y - x)}, ${T(x)}, and so on.

Odd positions hold ${T(x)} and even positions hold ${T(y - x)}. Since ${N} is ${N % 2 ? 'odd' : 'even'}, $a_{${N}} = ${num(answer)}$.

Check: $a_{${N % 2 ? 3 : 4}}$ also equals ${T(answer)}.

Trap: the other value, ${T(at(N + 1))}, comes from reading position ${N + 1}; position ${N} is ${N % 2 ? 'odd' : 'even'}. Rule: when terms repeat, list them until the start returns, then use the remainder of the position.`;
      } else if (kind === 'diff') {
        answer = at(N);
        traps = [
          { value: at(N + 1), trap: 'cycle-off-by-one' },
          { value: at(N - 1), trap: 'cycle-off-by-one' },
        ];
        stem = `A sequence has $a_1 = ${x}$, $a_2 = ${y}$, and $a_{n+2} = a_{n+1} - a_n$ for every positive integer $n$. What is the value of $a_{${N}}$?`;
        explanation = `Compute terms until the start returns: ${cyc.map((v, i) => `$a_{${i + 1}} = ${num(v)}$`).join(', ')}, then $a_7 = ${num(x)}$ and $a_8 = ${num(y)}$ again. The terms repeat every 6.

${N} $= 6 \\cdot ${Math.floor(N / 6)} + ${rem}$. ${rem === 0 ? `A remainder of 0 means the last term of the cycle, $a_6$` : `A remainder of ${rem} means the term $a_{${rem}}$`}, so $a_{${N}} = ${num(answer)}$.

Check: $a_{${rem || 6}} = ${num(answer)}$ in the list.

Trap: a neighbor term, such as ${T(at(N + 1))}, comes from an off-by-one in the remainder. Rule: a remainder of 0 lands on the last term of the cycle.`;
      } else {
                const partial = (n: number) => cyc.slice(0, ((n % L) + L) % L).reduce((s, v) => s + v, 0);
        answer = partial(N);
        if (rem < 2 || answer === 0) continue;
        traps = [
          { value: partial(N + 1), trap: 'cycle-count-terms' },
          { value: partial(N - 1), trap: 'cycle-count-terms' },
        ];
        stem = `A sequence has $a_1 = ${x}$, $a_2 = ${y}$, and $a_{n+2} = a_{n+1} - a_n$ for every positive integer $n$. What is the sum of the first ${N} terms?`;
        explanation = `The terms are ${termsTex}, then they repeat every 6. One full cycle adds to $${cyc.map((v) => nz(v)).join(' + ')} = 0$, so complete cycles contribute nothing.

${N} $= 6 \\cdot ${Math.floor(N / 6)} + ${rem}$. The ${rem} leftover terms are the first ${rem} of a new cycle: $${cyc.slice(0, rem).map((v) => nz(v)).join(' + ')} = ${num(answer)}$.

Check: the first ${N - rem} terms form ${Math.floor(N / 6)} whole cycles with sum 0.

Trap: counting ${rem + 1} leftover terms gives ${T(partial(N + 1))}, and ${rem - 1} gives ${T(partial(N - 1))}. Rule: find the sum of one cycle first; if it is 0 only the leftover terms matter.`;
      }
      const list = traps.filter((t, i) => t.value !== answer && traps.findIndex((u) => u.value === t.value) === i);
      if (Math.abs(answer) < 2) continue;
      return { params: { kind, x, y, N }, q: { format: 'ne', stem, answer: frac(answer), traps: list.map((t) => ({ value: frac(t.value), trap: t.trap })), explanation } };
    }
  },
  check(q, { kind, x, y, N }) {
    // simulate the recurrence term by term
    let a = x;
    let b = kind === 'flip' ? y - x : y;
    let total = 0;
    let last = 0;
    for (let n = 1; n <= N; n++) {
      last = a;
      total += a;
      if (kind === 'flip') [a, b] = [y - a, 0];
      else [a, b] = [b, b - a];
    }
    return expectNe(q, kind === 'sum' ? total : last);
  },
};

export const recurrenceTemplates: Template<any>[] = [recurrence];
