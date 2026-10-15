import { Frac, frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import type { Template, Trap } from '../../../engine/types';
import { evalExpr, expectNe, plainToTex, substitute } from './util';

export const functionEvalTraps: Record<string, Trap> = {
  'oo-composition-order': {
    label: 'Applied the two functions in the wrong order',
    fix: 'In $f(g(x))$ the inner function $g$ acts first and its result becomes the input of $f$. $g(f(x))$ is usually a different number.',
  },
  'oo-composition-stopped': {
    label: 'Stopped after the inner function',
    fix: 'The value of $g(-2)$ is only the input of $f$. Substitute it into $f$ to finish.',
  },
  'oo-difference-order': {
    label: 'Subtracted the two function values in the wrong order',
    fix: '$f(p) - f(q)$ means the value at $p$ minus the value at $q$, in that order. Reversing them flips the sign.',
  },
};

interface Fn {
  plain: string;
  f: (x: number, a: number, b: number) => number;
}

const FNS: Fn[] = [
  { plain: 'x^2-a*x+b', f: (x, a, b) => x * x - a * x + b },
  { plain: 'a-x^2', f: (x, a) => a - x * x },
  { plain: 'a*x^2+b*x', f: (x, a, b) => a * x * x + b * x },
  { plain: '(x-a)^2-b', f: (x, a, b) => (x - a) ** 2 - b },
  { plain: 'x^3-a*x', f: (x, a) => x ** 3 - a * x },
];
const LINEAR = [
  { plain: 'a*x+b', f: (x: number, a: number, b: number) => a * x + b },
  { plain: 'a-b*x', f: (x: number, a: number, b: number) => a - b * x },
];

/** Replace a and b by their values in a function template (keeps x). */
const fill = (plain: string, a: number, b: number) => plain.replace(/a/g, String(a)).replace(/b/g, String(b));
const at = (plain: string, x: number, bare = false) => evalExpr(substitute(plain, { x }, !bare));

type Mode = 'single' | 'diff' | 'comp';

interface Params {
  mode: Mode;
  fPlain: string;
  gPlain: string;
  s: number;
  t: number;
}

export const functionEvalNE: Template<Params> = {
  id: 'arith.order-of-operations.function-eval-ne',
  skill: 'arith.order-of-operations',
  format: 'ne',
  style: 'evaluate a function at a negative input: one value, a difference of two values, or a composition',
  generate(rng: Rng, d) {
    const mode: Mode = d === 1 ? 'single' : d === 2 ? 'diff' : 'comp';
    for (;;) {
      const fn = rng.pick(d === 1 ? FNS.slice(0, 3) : FNS);
      const [a, b] = [rng.int(2, d === 3 ? 5 : 7), rng.int(2, d === 3 ? 5 : 8)];
      const fPlain = fill(fn.plain, a, b);
      const F = (x: number) => fn.f(x, a, b);
      const fTex = plainToTex(fPlain);
      const showAt = (plain: string, x: number, v: number | Frac, name = 'f') => `$${name}(${x}) = ${plainToTex(substitute(plain, { x }))} = ${v}$`;
      if (mode === 'single') {
        const s = -rng.int(2, 5);
        const value = F(s);
        const bare = at(fPlain, s, true);
        const traps = [{ value: bare, trap: 'int-no-parentheses' }].filter((t) => !t.value.eq(value));
        if (Math.abs(value) > 500) continue;
        return {
          params: { mode, fPlain, gPlain: '', s, t: 0 },
          q: {
            format: 'ne',
            stem: `The function $f$ is defined by $f(x) = ${fTex}$. What is the value of $f(${s})$?`,
            answer: frac(value),
            traps,
            explanation: `Recognize function notation: $f(${s})$ means replace every $x$ by $${s}$, keeping the parentheses around the negative input, and then follow the order of operations.

${showAt(fPlain, s, value)}

Check: the exponent is applied to the whole input, so $(${s})^2 = ${s * s}$ is positive, and an odd power keeps the negative sign.

${traps.length ? `Trap: pasting $${s}$ without parentheses gives a different expression that evaluates to $${bare.toTex()}$, because a minus sign in front of a power is applied after the power. ` : ''}Always put a negative input in parentheses before you substitute.`,
          },
        };
      }
      if (mode === 'diff') {
        const p = -rng.int(2, 4);
        const q = rng.int(2, 4);
        const value = F(p) - F(q);
        if (value === 0 || Math.abs(value) > 500) continue;
        const reversed = -value;
        const bare = at(fPlain, p, true).sub(at(fPlain, q, true));
        const traps = [
          { value: frac(reversed), trap: 'oo-difference-order' },
          { value: bare, trap: 'int-no-parentheses' },
        ].filter((t, i, arr) => !t.value.eq(value) && arr.findIndex((u) => u.value.eq(t.value)) === i);
        return {
          params: { mode, fPlain, gPlain: '', s: p, t: q },
          q: {
            format: 'ne',
            stem: `The function $f$ is defined by $f(x) = ${fTex}$. What is the value of $f(${p}) - f(${q})$?`,
            answer: frac(value),
            traps,
            explanation: `Recognize two function values to subtract: find each one separately, then subtract the second from the first.

- ${showAt(fPlain, p, F(p))}
- ${showAt(fPlain, q, F(q))}

So $f(${p}) - f(${q}) = ${F(p)} - ${F(q) < 0 ? `(${F(q)})` : F(q)} = ${value}$.

Trap: reversing the order of the subtraction gives $${reversed}$, the opposite sign. Substituting $${p}$ without parentheses is the other slip. Keep the order the question gives.`,
          },
        };
      }
      // composition f(g(s))
      const gl = rng.pick(LINEAR);
      const [ga, gb] = [rng.int(2, 5), rng.int(2, 6)];
      const gPlain = fill(gl.plain, ga, gb);
      const G = (x: number) => gl.f(x, ga, gb);
      const s = -rng.int(1, 4);
      const inner = G(s);
      if (inner === s || inner === 0) continue;
      const value = F(inner);
      const swapped = G(F(s));
      const bareOuter = at(fPlain, inner, true);
      if (Math.abs(value) > 4000 || Math.abs(swapped) > 4000) continue;
      const traps = [
        { value: frac(swapped), trap: 'oo-composition-order' },
        { value: frac(inner), trap: 'oo-composition-stopped' },
        { value: bareOuter, trap: 'int-no-parentheses' },
      ].filter((t, i, arr) => !t.value.eq(value) && arr.findIndex((u) => u.value.eq(t.value)) === i);
      return {
        params: { mode, fPlain, gPlain, s, t: 0 },
        q: {
          format: 'ne',
          stem: `The functions $f$ and $g$ are defined by $f(x) = ${fTex}$ and $g(x) = ${plainToTex(gPlain)}$. What is the value of $f(g(${s}))$?`,
          answer: frac(value),
          traps,
          explanation: `Recognize a composition: in $f(g(${s}))$ the inner function $g$ acts first, and its result is the input of $f$.

- ${showAt(gPlain, s, inner, 'g')}
- ${showAt(fPlain, inner, value)}

So $f(g(${s})) = ${value}$.

Trap: applying $f$ first and then $g$ is the other order and gives $${swapped}$. Stopping at $g(${s}) = ${inner}$ is also tempting. Work from the inside out, with parentheses around a negative value.`,
        },
      };
    }
  },
  check(q, { mode, fPlain, gPlain, s, t }) {
    const val = (plain: string, x: number) => evalExpr(substitute(plain, { x }));
    if (mode === 'single') return expectNe(q, val(fPlain, s));
    if (mode === 'diff') return expectNe(q, val(fPlain, s).sub(val(fPlain, t)));
    return expectNe(q, val(fPlain, val(gPlain, s).toNumber()));
  },
};

export const functionEvalTemplates: Template<any>[] = [functionEvalNE];
