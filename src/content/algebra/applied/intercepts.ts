import { numericChoices } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import { lin, num, paren, poly } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { choiceFrac, firstTrap } from './trapNote';

// New alg.coordinate style: intercepts of a line (x-intercept from an equation or from two points,
// area of the triangle cut off by the axes).
export const interceptTraps: Record<string, Trap> = {
  'alg-ci-read-y': {
    label: 'Gave the y-intercept when the x-intercept was asked',
    fix: 'The x-intercept is where $y = 0$. Put $y = 0$ in the equation and solve for $x$; the constant term is the y-intercept.',
  },
  'alg-ci-multiply': {
    label: 'Multiplied by the slope instead of dividing by it',
    fix: 'Setting $mx + b = 0$ gives $x = -\\frac{b}{m}$. The slope divides; it never multiplies. Test the answer in the equation.',
  },
  'alg-ci-sign': {
    label: 'Lost the minus sign when moving the constant across',
    fix: 'From $mx + b = 0$ we get $mx = -b$, so $x = -\\frac{b}{m}$. Substitute the result: it must give $y = 0$.',
  },
  'alg-ci-invert': {
    label: 'Divided the slope by the constant instead of the constant by the slope',
    fix: 'From $mx = -b$ the unknown is $x = -\\frac{b}{m}$: the slope is the divisor. Substitute the result to see that $y$ is not $0$.',
  },
  'alg-ci-reuse-coordinate': {
    label: 'Gave a coordinate of one of the given points',
    fix: 'The given points are not on the $x$-axis. Use the slope to travel from a point to where $y = 0$.',
  },
  'alg-ci-one-intercept': {
    label: 'Used the same intercept for both legs',
    fix: 'The two legs are different: the x-intercept (set $y = 0$) and the y-intercept (set $x = 0$). Find both.',
  },
  'alg-ci-no-half': {
    label: 'Forgot the factor $\\frac{1}{2}$ in the area of a triangle',
    fix: 'The axes meet at a right angle, so the legs are the two intercepts and the area is $\\frac{1}{2}|p||q|$, half of the product.',
  },
  'alg-ci-sum-legs': {
    label: 'Added the two intercepts instead of multiplying them',
    fix: 'The area of a right triangle is half the product of its legs, not their sum.',
  },
  'alg-ci-coef-legs': {
    label: 'Used the coefficients of $x$ and $y$ as the legs',
    fix: 'The legs are the intercepts. For $ax + by = c$ they are $\\frac{c}{a}$ and $\\frac{c}{b}$, found by setting $y = 0$, then $x = 0$.',
  },
};

interface IParams {
  mode: 'eq' | 'pts' | 'area';
  m: number;
  b: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  g: number;
  p: number;
  q: number;
}

const blank: IParams = { mode: 'eq', m: 0, b: 0, x1: 0, y1: 0, x2: 0, y2: 0, g: 1, p: 0, q: 0 };
const nz = (rng: Rng, lo: number, hi: number) => rng.int(lo, hi) * rng.sign();
const fmt = (v: Frac) => `$${num(v)}$`;
/** n / dn as TeX with the sign in the numerator and no denominator 1. */
const ratio = (n: number, dn: number) => (Math.abs(dn) === 1 ? num(n * dn) : `\\frac{${num(dn < 0 ? -n : n)}}{${num(Math.abs(dn))}}`);

const interceptsMCS: Template<IParams> = {
  id: 'alg.coordinate.intercepts-mcs',
  skill: 'alg.coordinate',
  format: 'mcs',
  style: 'x-intercept from an equation or two points; area cut off by the axes',
  generate(rng, d) {
    for (;;) {
      let stem: string;
      let answer: Frac;
      let traps: { value: Frac; trap: string }[];
      let order: string[];
      let params: IParams;
      let explain: (tnote: string) => string;
      let notes: Record<string, string>;
      if (d === 1) {
        const m = nz(rng, 2, 5);
        const k = nz(rng, 1, 9);
        const b = -m * k;
        answer = frac(k);
        traps = [
          { value: frac(b), trap: 'alg-ci-read-y' },
          { value: frac(-b * m), trap: 'alg-ci-multiply' },
          { value: frac(-k), trap: 'alg-ci-sign' },
          { value: frac(-m, b), trap: 'alg-ci-invert' },
        ];
        order = ['alg-ci-read-y', 'alg-ci-sign', 'alg-ci-multiply', 'alg-ci-invert'];
        notes = {
          'alg-ci-read-y': `$${num(b)}$ is the y-intercept, the value of $y$ at $x = 0$, not where the line meets the $x$-axis`,
          'alg-ci-sign': `dropping the minus sign gives $${num(-k)}$, but $${num(-k)}$ in the equation gives $y = ${num(-m * k + b)}$, not $0$`,
          'alg-ci-multiply': `multiplying by the slope gives $${num(-b * m)}$, but $y$ is not $0$ there`,
          'alg-ci-invert': `dividing the slope by the constant gives $${num(frac(-m, b))}$, which turns the division upside down`,
        };
        stem = `In the $xy$-plane, what is the $x$-intercept of the line with equation $y = ${poly([m, b])}$?`;
        explain = (t) => `The $x$-intercept is the point where the line crosses the $x$-axis, so $y = 0$ there.

Set $0 = ${poly([m, b])}$. Then $${poly([m, 0])} = ${num(-b)}$, and dividing both sides by $${num(m)}$ gives $x = ${k}$.

Check: $${num(m)}\\cdot ${paren(k)} + ${paren(b)} = 0$.

Trap: ${t}. Rule: the x-intercept comes from $y = 0$; the y-intercept comes from $x = 0$.`;
        params = { ...blank, mode: 'eq', m, b };
      } else if (d === 2) {
        const X = nz(rng, 1, 8);
        const dx = nz(rng, 1, 4);
        const dy = nz(rng, 1, 6);
        const t1 = nz(rng, 1, 4);
        const t2 = nz(rng, 1, 4);
        if (Math.abs(dx) === Math.abs(dy) || t1 === t2) continue;
        const x1 = X + dx * t1;
        const y1 = dy * t1;
        const x2 = X + dx * t2;
        const y2 = dy * t2;
        if (Math.max(Math.abs(x1), Math.abs(x2), Math.abs(y1), Math.abs(y2)) > 24) continue;
        const m = frac(y2 - y1, x2 - x1);
        const yint = frac(y1).sub(m.mul(x1));
        answer = frac(X);
        const mult = frac(x1).sub(m.mul(y1));
        const sgn = frac(x1).add(frac(y1).div(m));
        traps = [
          { value: mult, trap: 'alg-ci-multiply' },
          { value: sgn, trap: 'alg-ci-sign' },
          { value: yint, trap: 'alg-ci-read-y' },
          { value: frac(x2), trap: 'alg-ci-reuse-coordinate' },
        ];
        order = ['alg-ci-multiply', 'alg-ci-sign', 'alg-ci-read-y', 'alg-ci-reuse-coordinate'];
        notes = {
          'alg-ci-multiply': `multiplying $y$ by the slope instead of dividing gives $${num(mult)}$, a point that is not on the line`,
          'alg-ci-sign': `adding $\\frac{y}{m}$ instead of subtracting it gives $${num(sgn)}$, which moves the wrong way along the line`,
          'alg-ci-read-y': `$${num(yint)}$ is the y-intercept, found at $x = 0$, not at $y = 0$`,
          'alg-ci-reuse-coordinate': `$${num(x2)}$ is the x-coordinate of a given point, and that point has $y = ${num(y2)}$, not $0$`,
        };
        stem = `In the $xy$-plane, a line passes through the points $(${num(x1)}, ${num(y1)})$ and $(${num(x2)}, ${num(y2)})$. At what value of $x$ does the line cross the $x$-axis?`;
        const need = frac(-y1).div(m);
        explain = (t) => `Use the slope to walk from a known point to the $x$-axis.

The slope is $m = \\frac{${num(y2)} - ${paren(y1)}}{${num(x2)} - ${paren(x1)}} = ${num(m)}$. From $(${num(x1)}, ${num(y1)})$, $y$ must change by $${num(-y1)}$, which needs a change in $x$ of $\\frac{${num(-y1)}}{${num(m)}} = ${num(need)}$. So $x = ${num(x1)} ${need.sign() < 0 ? '-' : '+'} ${num(need.abs())} = ${num(answer)}$.

Check: $(${num(answer)}, 0)$ and $(${num(x1)}, ${num(y1)})$ again give slope $${num(m)}$.

Trap: ${t}. Rule: change in $x$ = needed change in $y$ divided by the slope.`;
        params = { ...blank, mode: 'pts', x1, y1, x2, y2 };
      } else {
        const p = nz(rng, 1, 6);
        const q = nz(rng, 1, 6);
        if (Math.abs(p) === Math.abs(q)) continue;
        const g = rng.pick([1, 2, 3]);
        const a = g * q;
        const b = g * p;
        const c = g * p * q;
        answer = frac(Math.abs(p * q), 2);
        const prod = frac(Math.abs(p * q));
        const sum = frac(Math.abs(p) + Math.abs(q));
        const coef = frac(Math.abs(a * b), 2);
        traps = [
          { value: prod, trap: 'alg-ci-no-half' },
          { value: coef, trap: 'alg-ci-coef-legs' },
          { value: sum, trap: 'alg-ci-sum-legs' },
          { value: frac(p * p, 2), trap: 'alg-ci-one-intercept' },
        ];
        order = ['alg-ci-no-half', 'alg-ci-coef-legs', 'alg-ci-sum-legs', 'alg-ci-one-intercept'];
        notes = {
          'alg-ci-no-half': `the product of the legs, $${num(prod)}$, is twice the area of the triangle`,
          'alg-ci-coef-legs': `using the coefficients $${Math.abs(a)}$ and $${Math.abs(b)}$ as legs gives $${num(coef)}$, but the legs are the intercepts`,
          'alg-ci-sum-legs': `adding the legs gives $${num(sum)}$, but a right triangle takes half their product`,
          'alg-ci-one-intercept': `squaring the x-intercept and halving gives $${num(frac(p * p, 2))}$, but the y-intercept is a different length`,
        };
        stem = `In the $xy$-plane, the line $${lin([[a, 'x'], [b, 'y']])} = ${num(c)}$ and the two coordinate axes enclose a triangle. What is the area of the triangle?`;
        explain = (t) => `The axes are perpendicular, so the triangle is right-angled and its legs are the intercepts.

Setting $y = 0$ gives $x = ${ratio(c, a)} = ${num(p)}$. Setting $x = 0$ gives $y = ${ratio(c, b)} = ${num(q)}$. The area is $\\frac{1}{2}\\cdot ${Math.abs(p)}\\cdot ${Math.abs(q)} = ${num(answer)}$.

Check: $(${num(p)}, 0)$ and $(0, ${num(q)})$ both satisfy the equation.

Trap: ${t}. Lengths are positive, so use $|p|$ and $|q|$ even when an intercept is negative.`;
        params = { ...blank, mode: 'area', g, p, q };
      }
      if (new Set(traps.filter((t) => !t.value.eq(answer)).map((t) => t.value.toString())).size < 4) continue;
      const built = numericChoices(rng, { correct: answer, traps, format: fmt, order: 'random' });
      if (built.choices.filter((c) => c.trap).length < 4) continue;
      const first = firstTrap(built.choices, order);
      return { params, q: { format: 'mcs', stem, choices: built.choices, answer: built.answer, explanation: explain(notes[first]) } };
    }
  },
  check(q, P) {
    if (q.format !== 'mcs') return 'wrong format';
    const key = q.choices[q.answer].text;
    const { n, d } = choiceFrac(key);
    const v = frac(n, d);
    if (P.mode === 'eq') return v.mul(P.m).add(P.b).eq(0) ? null : `keyed ${key} is not on the line`;
    if (P.mode === 'pts') {
      // the keyed point (v, 0) must be collinear with the two given points (cross product 0)
      const cross = frac(P.x2 - P.x1).mul(frac(0 - P.y1)).sub(frac(P.y2 - P.y1).mul(v.sub(P.x1)));
      return cross.eq(0) ? null : `keyed ${key} is not collinear`;
    }
    const a = P.g * P.q;
    const b = P.g * P.p;
    const c = P.g * P.p * P.q;
    let X: number | null = null;
    let Y: number | null = null;
    for (let t = -60; t <= 60; t++) {
      if (a * t === c) X = t;
      if (b * t === c) Y = t;
    }
    if (X === null || Y === null) return 'intercepts not found';
    const area = frac(Math.abs(X * Y), 2);
    return area.eq(v) ? null : `expected ${area}, keyed ${key}`;
  },
};

export const interceptTemplates: Template<any>[] = [interceptsMCS];
