import { frac } from '../../engine/frac';
import type { Template, Trap } from '../../engine/types';

export const rootsEquationTraps: Record<string, Trap> = {
  'root-skip-squaring': {
    label: 'Forgot to square the right side',
    fix: 'To undo $\\sqrt{x + p} = q$, square BOTH sides: $x + p = q^2$, not $x + p = q$.',
  },
  'root-extraneous': {
    label: 'Kept a root that does not fit the original equation',
    fix: 'Squaring can add solutions. Put every candidate back in the original equation: a square root cannot equal a negative number.',
  },
  'root-solved-for-radicand': {
    label: 'Stopped at the value under the radical',
    fix: 'Finding $\\sqrt{x + a} = s$ is not the end: the radicand is $x + a = s^2$, so $x = s^2 - a$.',
  },
};

interface Params {
  kind: 'direct' | 'extraneous' | 'two-roots';
  p: number;
  q: number;
  /** two-roots: radicands x + a and x - b, and the sum form */
  a: number;
  b: number;
  sum: boolean;
  c: number;
}

const plus = (v: string, n: number) => `${v} ${n < 0 ? '-' : '+'} ${Math.abs(n)}`;

const solveRoot: Template<Params> = {
  id: 'arith.roots.equation-ne',
  skill: 'arith.roots',
  format: 'ne',
  style: 'solve an equation with square roots',
  generate(rng, d) {
    if (d === 1) {
      const p = rng.int(-9, 9);
      const q = rng.int(2, 12);
      if (p === 0) return solveRoot.generate(rng, d);
      const x = q * q - p;
      return {
        params: { kind: 'direct', p, q, a: 0, b: 0, sum: false, c: 0 },
        q: {
          format: 'ne',
          stem: `If $\\sqrt{${plus('x', p)}} = ${q}$, what is the value of $x$?`,
          prefix: '$x =$',
          answer: frac(x),
          traps: [{ value: frac(q - p), trap: 'root-skip-squaring' }],
          explanation: `A square root equation is cleared by squaring. Both sides are nonnegative, so squaring loses nothing.

$\\sqrt{${plus('x', p)}} = ${q}$ gives $${plus('x', p)} = ${q}^2 = ${q * q}$, so $x = ${q * q} ${p > 0 ? '-' : '+'} ${Math.abs(p)} = ${x}$.

Check: $\\sqrt{${x} ${p > 0 ? '+' : '-'} ${Math.abs(p)}} = \\sqrt{${q * q}} = ${q}$.

Trap: leaving the right side as $${q}$ instead of $${q * q}$ leads to $${q - p}$, which does not satisfy the equation.

Rule: square both sides, then solve, then check.`,
        },
      };
    }
    if (d === 2) {
      const q = rng.int(1, 9);
      const x1 = q - rng.int(1, 6);
      const x0 = 2 * q + 1 - x1;
      const p = q * q - x0 * x1;
      if (p === 0) return solveRoot.generate(rng, d);
      const root = `\\sqrt{${plus('x', p)}}`;
      const rhs = `x - ${q}`;
      const form = rng.int(0, 2);
      const eq = form === 0 ? `${root} = ${rhs}` : form === 1 ? `${rhs} = ${root}` : `${root} + ${q} = x`;
      return {
        params: { kind: 'extraneous', p, q, a: 0, b: 0, sum: false, c: 0 },
        q: {
          format: 'ne',
          stem: `If $${eq}$, what is the value of $x$?`,
          prefix: '$x =$',
          answer: frac(x0),
          traps: [{ value: frac(x1), trap: 'root-extraneous' }],
          explanation: `The root is nonnegative, so $${rhs}$ must be nonnegative too. Square both sides: $${plus('x', p)} = (x - ${q})^2$, that is, $x^2 - ${2 * q + 1}x ${x0 * x1 < 0 ? '-' : '+'} ${Math.abs(x0 * x1)} = 0$, which factors as $(x - ${x0})(x ${x1 < 0 ? '+' : '-'} ${Math.abs(x1)}) = 0$.

Test the candidates. For $x = ${x0}$: $\\sqrt{${x0 + p}} = ${x0 - q}$ is true. For $x = ${x1}$: the right side $${x1} - ${q} = ${x1 - q}$ is negative, so it cannot equal a root.

Trap: $${x1}$ satisfies the squared equation but not the original one.

Rule: after squaring, always put each candidate back.`,
        },
      };
    }
    const s = rng.int(3, 9);
    const t = rng.int(1, s - 1);
    const a = rng.int(1, s * s - t * t - 1);
    const b = s * s - t * t - a;
    const sum = rng.chance(0.4);
    const c = sum ? s + t : s - t;
    const x0 = s * s - a;
    const left = `\\sqrt{${plus('x', a)}} ${sum ? '+' : '-'} \\sqrt{x - ${b}}`;
    return {
      params: { kind: 'two-roots', p: 0, q: 0, a, b, sum, c },
      q: {
        format: 'ne',
        stem: `If $${left} = ${c}$, what is the value of $x$?`,
        prefix: '$x =$',
        answer: frac(x0),
        traps: [
          { value: frac(s * s), trap: 'root-solved-for-radicand' },
          { value: frac(t * t), trap: 'root-solved-for-radicand' },
        ],
        explanation: `Two radicals: use the difference of their squares. Let $u = \\sqrt{${plus('x', a)}}$ and $v = \\sqrt{x - ${b}}$. Then $u^2 - v^2 = ${a} + ${b} = ${a + b}$, and $(u - v)(u + v) = ${a + b}$.

${sum ? `Here $u + v = ${c}$, so $u - v = ${a + b} \\div ${c} = ${s - t}$` : `Here $u - v = ${c}$, so $u + v = ${a + b} \\div ${c} = ${s + t}$`}. Adding the two equations gives $u = ${s}$, so $${plus('x', a)} = ${s * s}$ and $x = ${x0}$.

Check: $\\sqrt{${s * s}} ${sum ? '+' : '-'} \\sqrt{${t * t}} = ${s} ${sum ? '+' : '-'} ${t} = ${c}$.

Trap: $${s * s}$ and $${t * t}$ are the radicands, not $x$.`,
      },
    };
  },
  check(q, { kind, p, q: qq, a, b, sum, c }) {
    if (q.format !== 'ne') return 'wrong format';
    const hits: number[] = [];
    for (let x = -300; x <= 400; x++) {
      if (kind === 'direct') {
        if (x + p >= 0 && Math.abs(Math.sqrt(x + p) - qq) < 1e-9) hits.push(x);
      } else if (kind === 'extraneous') {
        if (x + p >= 0 && Math.abs(Math.sqrt(x + p) - (x - qq)) < 1e-9) hits.push(x);
      } else if (x + a >= 0 && x - b >= 0 && Math.abs(Math.sqrt(x + a) + (sum ? 1 : -1) * Math.sqrt(x - b) - c) < 1e-9) hits.push(x);
    }
    if (hits.length !== 1) return `${hits.length} solutions found`;
    return q.answer.eq(hits[0]) ? null : `expected ${hits[0]}`;
  },
};

export const rootsEquationTemplates = [solveRoot];
