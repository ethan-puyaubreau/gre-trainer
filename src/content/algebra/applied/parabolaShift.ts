import { numericChoices } from '../../../engine/build';
import type { Rng } from '../../../engine/rng';
import { num, paren, poly } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { choiceFrac, firstTrap } from './trapNote';

// New alg.graphs style (MCS): a parabola is reflected and/or translated; read off a vertex
// coordinate, the maximum value or the y-intercept of the new graph.
export const parabolaShiftTraps: Record<string, Trap> = {
  'alg-gt-shift-direction': {
    label: 'Moved the graph the wrong way: right is $x - r$, so every point moves $+r$',
    fix: 'Translating a graph $r$ units to the right replaces $x$ by $x - r$ and adds $r$ to the $x$-coordinate of every point. Left does the opposite.',
  },
  'alg-gt-vertex-sign': {
    label: 'Took the vertex at $x = \\frac{b}{2}$ instead of $x = -\\frac{b}{2}$',
    fix: 'For $x^2 + bx + c$ the vertex is at $x = -\\frac{b}{2}$. Check with $x^2 - 6x$: it is $0$ at $x = 0$ and $x = 6$, so the axis is $x = 3$.',
  },
  'alg-gt-ignore-shift': {
    label: 'Ignored the translation and gave the vertex or constant of the original graph',
    fix: 'The question is about the new graph. Apply the translation to the original vertex, or substitute into the new function.',
  },
  'alg-gt-no-half': {
    label: 'Forgot to halve $b$ when finding the vertex',
    fix: 'The axis of $x^2 + bx + c$ is $x = -\\frac{b}{2}$, the midpoint of the two roots. The coefficient $b$ itself is twice the distance.',
  },
  'alg-gt-vertical-direction': {
    label: 'Moved the graph the wrong way vertically',
    fix: 'Moving a graph up $s$ units adds $s$ to every $y$-value; moving it down subtracts $s$. Read the word in the question.',
  },
  'alg-gt-ignore-vertical': {
    label: 'Forgot the vertical translation',
    fix: 'Both translations change the new graph. Apply the horizontal one to $x$ and the vertical one to $y$.',
  },
  'alg-gt-no-reflect': {
    label: 'Forgot that reflecting across the $x$-axis changes the sign of every $y$-value',
    fix: 'Reflecting across the $x$-axis turns $y = f(x)$ into $y = -f(x)$: the minimum value becomes a maximum value with the opposite sign.',
  },
  'alg-gt-use-constant': {
    label: 'Used the constant term $c$ as the extreme value',
    fix: 'The constant term is the value at $x = 0$, not at the vertex. The extreme value is $c - \\frac{b^2}{4}$ (complete the square).',
  },
};

interface SParams {
  mode: 'vertex-x' | 'y-intercept' | 'max';
  b: number;
  c: number;
  r: number; // signed horizontal shift, positive = right
  s: number; // signed vertical shift, positive = up
}

const nz = (rng: Rng, lo: number, hi: number) => rng.int(lo, hi) * rng.sign();
const fmt = (v: number) => `$${num(v)}$`;
const horiz = (r: number) => `${Math.abs(r)} unit${Math.abs(r) === 1 ? '' : 's'} to the ${r > 0 ? 'right' : 'left'}`;
const vert = (s: number) => `${Math.abs(s)} unit${Math.abs(s) === 1 ? '' : 's'} ${s > 0 ? 'up' : 'down'}`;

const parabolaShiftMCS: Template<SParams> = {
  id: 'alg.graphs.parabola-shift-mcs',
  skill: 'alg.graphs',
  format: 'mcs',
  style: 'reflect and translate a parabola: vertex, maximum value, y-intercept of the new graph',
  generate(rng, d) {
    for (;;) {
      const beta = nz(rng, 1, 6);
      const b = 2 * beta;
      const c = rng.int(-9, 12);
      if (c === beta * beta) continue;
      const fx = (x: number) => x * x + b * x + c;
      const f = `f(x) = ${poly([1, b, c])}`;
      let stem: string;
      let params: SParams;
      let answer: number;
      let traps: { value: number; trap: string }[];
      let order: string[];
      let explain: (t: string) => string;
      let notes: Record<string, string>;
      if (d === 1) {
        const r = nz(rng, 1, 7);
        answer = -beta + r;
        stem = `The graph of $y = f(x)$ in the $xy$-plane is a parabola, where $${f}$. The graph is translated ${horiz(r)} to form the graph of $y = g(x)$. What is the $x$-coordinate of the vertex of the graph of $g$?`;
        traps = [
          { value: -beta - r, trap: 'alg-gt-shift-direction' },
          { value: beta + r, trap: 'alg-gt-vertex-sign' },
          { value: -beta, trap: 'alg-gt-ignore-shift' },
          { value: -b + r, trap: 'alg-gt-no-half' },
        ];
        order = ['alg-gt-shift-direction', 'alg-gt-no-half', 'alg-gt-vertex-sign', 'alg-gt-ignore-shift'];
        notes = {
          'alg-gt-shift-direction': `moving the graph ${r > 0 ? 'left' : 'right'} instead gives $${num(-beta - r)}$, the opposite direction`,
          'alg-gt-no-half': `using $-b = ${num(-b)}$ without halving gives $${num(-b + r)}$, but the vertex of the original is at $-\\frac{b}{2}$`,
          'alg-gt-vertex-sign': `taking the vertex at $\\frac{b}{2}$ gives $${num(beta + r)}$, on the wrong side of the origin`,
          'alg-gt-ignore-shift': `$${num(-beta)}$ is the vertex of the original graph, before the translation`,
        };
        explain = (t) => `A translation moves the vertex by the same amount, so find the vertex of $f$ first.

For $x^2 + bx + c$ the vertex is at $x = -\\frac{b}{2} = -\\frac{${num(b)}}{2} = ${num(-beta)}$. Moving the graph ${horiz(r)} adds $${num(r)}$ to every $x$-coordinate: $${num(-beta)} ${r > 0 ? '+' : '-'} ${Math.abs(r)} = ${num(answer)}$.

Check: $g(x) = f(x ${r > 0 ? '-' : '+'} ${Math.abs(r)})$ is smallest when $x ${r > 0 ? '-' : '+'} ${Math.abs(r)} = ${num(-beta)}$, so $x = ${num(answer)}$.

Trap: ${t}. Rule: right adds to $x$, left subtracts.`;
        params = { mode: 'vertex-x', b, c, r, s: 0 };
      } else if (d === 2) {
        const r = nz(rng, 1, 5);
        const s = nz(rng, 1, 9);
        answer = fx(-r) + s;
        stem = `The graph of $y = f(x)$ in the $xy$-plane is a parabola, where $${f}$. The graph is translated ${horiz(r)} and then ${vert(s)} to form the graph of $y = g(x)$. What is the $y$-intercept of the graph of $g$?`;
        traps = [
          { value: fx(r) + s, trap: 'alg-gt-shift-direction' },
          { value: c + s, trap: 'alg-gt-ignore-shift' },
          { value: fx(-r) - s, trap: 'alg-gt-vertical-direction' },
          { value: fx(-r), trap: 'alg-gt-ignore-vertical' },
        ];
        order = ['alg-gt-shift-direction', 'alg-gt-ignore-shift', 'alg-gt-vertical-direction', 'alg-gt-ignore-vertical'];
        notes = {
          'alg-gt-shift-direction': `using $f(${num(r)})$ instead of $f(${num(-r)})$ gives $${num(fx(r) + s)}$, the translation in the wrong direction`,
          'alg-gt-ignore-shift': `$${num(c + s)}$ only moves the old intercept $${num(c)}$ vertically and forgets the horizontal translation`,
          'alg-gt-vertical-direction': `${s > 0 ? 'subtracting' : 'adding'} the vertical amount gives $${num(fx(-r) - s)}$, the wrong way`,
          'alg-gt-ignore-vertical': `$${num(fx(-r))}$ stops after the horizontal translation`,
        };
        explain = (t) => `The new function is $g(x) = f(x ${r > 0 ? '-' : '+'} ${Math.abs(r)}) ${s > 0 ? '+' : '-'} ${Math.abs(s)}$: the horizontal move changes the input, the vertical move changes the output.

The $y$-intercept is $g(0) = f(${num(-r)}) ${s > 0 ? '+' : '-'} ${Math.abs(s)}$. Now $f(${num(-r)}) = ${paren(-r)}^2 + ${paren(b)}\\cdot ${paren(-r)} + ${paren(c)} = ${num(fx(-r))}$, so $g(0) = ${num(answer)}$.

Check: the original point $(${num(-r)}, ${num(fx(-r))})$ moves ${horiz(r)} to $(0, ${num(fx(-r))})$, then ${vert(s)} to $(0, ${num(answer)})$.

Trap: ${t}. Rule: to read the new graph at $x = 0$, look at the old graph at $x = ${num(-r)}$.`;
        params = { mode: 'y-intercept', b, c, r, s };
      } else {
        const r = nz(rng, 1, 7);
        const s = nz(rng, 1, 9);
        const minF = c - beta * beta;
        answer = -minF + s;
        stem = `The graph of $y = f(x)$ in the $xy$-plane is a parabola, where $${f}$. The graph is reflected across the $x$-axis, then translated ${horiz(r)} and ${vert(s)} to form the graph of $y = g(x)$. What is the maximum value of $g$?`;
        traps = [
          { value: minF + s, trap: 'alg-gt-no-reflect' },
          { value: -c + s, trap: 'alg-gt-use-constant' },
          { value: -minF - s, trap: 'alg-gt-vertical-direction' },
          { value: -minF, trap: 'alg-gt-ignore-vertical' },
        ];
        order = ['alg-gt-no-reflect', 'alg-gt-use-constant', 'alg-gt-vertical-direction', 'alg-gt-ignore-vertical'];
        notes = {
          'alg-gt-no-reflect': `skipping the reflection gives $${num(minF + s)}$, which is the minimum of a parabola that still opens upward`,
          'alg-gt-use-constant': `using the constant $${num(c)}$ gives $${num(-c + s)}$, but $${num(c)}$ is the value at $x = 0$, not at the vertex`,
          'alg-gt-vertical-direction': `moving the graph ${s > 0 ? 'down' : 'up'} gives $${num(-minF - s)}$, the wrong vertical direction`,
          'alg-gt-ignore-vertical': `$${num(-minF)}$ is the maximum right after the reflection, before the vertical translation`,
        };
        explain = (t) => `After the reflection the parabola opens downward, so $g$ has a maximum at its vertex. A horizontal translation never changes a maximum value.

Complete the square: $f(x) = (x ${beta > 0 ? '+' : '-'} ${Math.abs(beta)})^2 ${minF < 0 ? '-' : '+'} ${Math.abs(minF)}$, with minimum value $${num(minF)}$. The reflection gives a maximum of $${num(-minF)}$, and moving ${vert(s)} changes it to $${num(-minF)} ${s > 0 ? '+' : '-'} ${Math.abs(s)} = ${num(answer)}$.

Check: at $x = ${num(-beta + r)}$, $g(x) = -(0 ${minF < 0 ? '-' : '+'} ${Math.abs(minF)}) ${s > 0 ? '+' : '-'} ${Math.abs(s)} = ${num(answer)}$.

Trap: ${t}. Rule: reflect the extreme value, then shift it vertically; ignore horizontal moves.`;
        params = { mode: 'max', b, c, r, s };
      }
      if (new Set(traps.map((t) => t.value).filter((v) => v !== answer)).size < 4) continue;
      if (Math.abs(answer) > 400) continue;
      const built = numericChoices(rng, {
        correct: answer,
        traps: traps.map((t) => ({ value: t.value, trap: t.trap })),
        format: (v) => fmt(v.n),
        order: 'random',
      });
      if (built.choices.filter((ch) => ch.trap).length < 4) continue;
      const first = firstTrap(built.choices, order);
      return { params, q: { format: 'mcs', stem, choices: built.choices, answer: built.answer, explanation: explain(notes[first]) } };
    }
  },
  check(q, P) {
    if (q.format !== 'mcs') return 'wrong format';
    const f = (x: number) => x * x + P.b * x + P.c;
    const key = choiceFrac(q.choices[q.answer].text);
    if (key.d !== 1) return 'keyed value is not an integer';
    let want: number;
    if (P.mode === 'vertex-x') {
      const g = (x: number) => f(x - P.r);
      let best = -60;
      for (let x = -60; x <= 60; x++) if (g(x) < g(best)) best = x;
      want = best;
    } else if (P.mode === 'y-intercept') {
      want = f(0 - P.r) + P.s;
    } else {
      const g = (x: number) => -f(x - P.r) + P.s;
      want = -Infinity;
      for (let x = -60; x <= 60; x++) want = Math.max(want, g(x));
    }
    return want === key.n ? null : `expected ${want}, keyed ${key.n}`;
  },
};

export const parabolaShiftTemplates: Template<any>[] = [parabolaShiftMCS];
