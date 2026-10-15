import type { Rng } from '../../../engine/rng';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { evalExpr, expectMcsBy, plainToTex, spreadChoices } from './util';

export const chainEvalTraps: Record<string, Trap> = {
  'oo-division-chain': {
    label: 'Divided by a product instead of dividing, then multiplying',
    fix: 'Multiplication and division have the same rank, so work left to right: $48 \\div 4 \\cdot 3 = 12 \\cdot 3 = 36$, not $48 \\div 12$.',
  },
  'oo-power-tower': {
    label: 'Worked a tower of exponents from the bottom up',
    fix: 'A tower is evaluated from the top down: $2^{3^2} = 2^9 = 512$. Working from the bottom, $(2^3)^2 = 64$, is a different number.',
  },
};

const NOTE: Record<string, string> = {
  'int-left-to-right': 'comes from working strictly left to right, ignoring the rank of the operations',
  'oo-power-scope': 'puts an exponent on a whole product instead of on one number',
  'power-as-product': 'multiplies by the exponent instead of repeating the base',
  'oo-division-chain': 'divides by a product instead of dividing, then multiplying',
  'oo-power-tower': 'works the tower of exponents from the bottom up',
  'int-distribute-power': 'splits a power over a difference',
  'num-sign-rules': 'flips the sign of an odd power of a negative number',
  'oo-grouping-ignored': 'drops a pair of parentheses',
};

interface Alt {
  plain: string;
  trap: string;
}
interface Inst {
  plain: string;
  tex: string;
  value: number;
  steps: string;
  alts: Alt[];
}

type Shape = (rng: Rng) => Inst | null;

const SHAPES: Record<string, Shape> = {
  // a - b * c^2
  squareProduct: (rng) => {
    const [a, b, c] = [rng.int(20, 90), rng.int(2, 9), rng.int(3, 9)];
    const plain = `${a}-${b}*${c}^2`;
    const value = a - b * c * c;
    return {
      plain,
      tex: plainToTex(plain),
      value,
      steps: `${a} - ${b} \\cdot ${c * c} = ${a} - ${b * c * c} = ${value}`,
      alts: [
        { plain: `(${a}-${b})*${c}^2`, trap: 'int-left-to-right' },
        { plain: `${a}-(${b}*${c})^2`, trap: 'oo-power-scope' },
        { plain: `${a}-${b}*${c}*2`, trap: 'power-as-product' },
      ],
    };
  },
  // a - b / c * d, with b a multiple of c * d
  divMul: (rng) => {
    const [a, c, d, m] = [rng.int(30, 99), rng.int(2, 6), rng.int(2, 6), rng.int(1, 4)];
    if (c === d) return null;
    const b = c * d * m;
    const plain = `${a}-${b}/${c}*${d}`;
    const value = a - (b / c) * d;
    return {
      plain,
      tex: plainToTex(plain),
      value,
      steps: `${a} - ${b} \\div ${c} \\cdot ${d} = ${a} - ${b / c} \\cdot ${d} = ${a} - ${(b / c) * d} = ${value}`,
      alts: [
        { plain: `${a}-${b}/(${c}*${d})`, trap: 'oo-division-chain' },
        { plain: `(${a}-${b})/${c}*${d}`, trap: 'int-left-to-right' },
        { plain: `(${a}-${b}/${c})*${d}`, trap: 'int-left-to-right' },
      ],
    };
  },
  // a^(b^c) - d
  tower: (rng) => {
    const [a, [b, c], d] = [rng.pick([2, 3]), rng.pick([[2, 3], [3, 2]]), rng.int(2, 40)];
    const plain = `${a}^${b}^${c}-${d}`;
    const top = a ** (b ** c);
    return {
      plain,
      tex: `${a}^{${b}^{${c}}} - ${d}`,
      value: top - d,
      steps: `${a}^{${b ** c}} - ${d} = ${num(top)} - ${d} = ${num(top - d)}`,
      alts: [
        { plain: `(${a}^${b})^${c}-${d}`, trap: 'oo-power-tower' },
        { plain: `${a}^${b}*${c}-${d}`, trap: 'power-as-product' },
        { plain: `${a}*${b}^${c}-${d}`, trap: 'oo-power-scope' },
      ],
    };
  },
  // a * b^2 - c * d^2
  twoSquares: (rng) => {
    const [a, b, c, d] = [rng.int(2, 6), rng.int(2, 7), rng.int(2, 6), rng.int(2, 7)];
    if (a * b * b === c * d * d) return null;
    const plain = `${a}*${b}^2-${c}*${d}^2`;
    const value = a * b * b - c * d * d;
    return {
      plain,
      tex: plainToTex(plain),
      value,
      steps: `${a} \\cdot ${b * b} - ${c} \\cdot ${d * d} = ${a * b * b} - ${c * d * d} = ${value}`,
      alts: [
        { plain: `(${a}*${b})^2-${c}*${d}^2`, trap: 'oo-power-scope' },
        { plain: `${a}*${b}^2-(${c}*${d})^2`, trap: 'oo-power-scope' },
        { plain: `(${a}*${b}^2-${c})*${d}^2`, trap: 'int-left-to-right' },
        { plain: `${a}*${b}*2-${c}*${d}*2`, trap: 'power-as-product' },
      ],
    };
  },
  // a - (b - c) * d^2, with b < c so the group is negative
  negGroup: (rng) => {
    const [a, b, c, d] = [rng.int(5, 40), rng.int(1, 6), rng.int(8, 15), rng.int(2, 6)];
    const plain = `${a}-(${b}-${c})*${d}^2`;
    const value = a - (b - c) * d * d;
    return {
      plain,
      tex: plainToTex(plain),
      value,
      steps: `${a} - (${b - c}) \\cdot ${d * d} = ${a} - (${(b - c) * d * d}) = ${value}`,
      alts: [
        { plain: `${a}-${b}-${c}*${d}^2`, trap: 'oo-grouping-ignored' },
        { plain: `(${a}-(${b}-${c}))*${d}^2`, trap: 'int-left-to-right' },
        { plain: `${a}-(${b}-${c})*${d}*2`, trap: 'power-as-product' },
        { plain: `${a}+(${b}-${c})*${d}^2`, trap: 'num-sign-rules' },
      ],
    };
  },
  // (a - b)^2 - c * (d - e)^3, with d < e
  twoGroups: (rng) => {
    const [a, b, c, d, e] = [rng.int(2, 9), rng.int(1, 8), rng.int(2, 5), rng.int(1, 4), rng.int(5, 8)];
    if (a === b) return null;
    const plain = `(${a}-${b})^2-${c}*(${d}-${e})^3`;
    const value = (a - b) ** 2 - c * (d - e) ** 3;
    return {
      plain,
      tex: plainToTex(plain),
      value,
      steps: `(${a - b})^{2} - ${c} \\cdot (${d - e})^{3} = ${(a - b) ** 2} - ${c} \\cdot (${(d - e) ** 3}) = ${(a - b) ** 2} + ${c * -((d - e) ** 3)} = ${value}`,
      alts: [
        { plain: `${a}^2-${b}^2-${c}*(${d}-${e})^3`, trap: 'int-distribute-power' },
        { plain: `(${a}-${b})^2-${c}*(${d}^3-${e}^3)`, trap: 'int-distribute-power' },
        { plain: `((${a}-${b})^2-${c})*(${d}-${e})^3`, trap: 'int-left-to-right' },
        { plain: `(${a}-${b})^2-${c}*(${e}-${d})^3`, trap: 'num-sign-rules' },
      ],
    };
  },
};

interface Params {
  plain: string;
  values: number[];
}

export const chainEvalMCS: Template<Params> = {
  id: 'arith.order-of-operations.chain-eval-mcs',
  skill: 'arith.order-of-operations',
  format: 'mcs',
  style: 'evaluate a chain with a power, a division run or a tower, with one named slip per wrong choice',
  generate(rng, d) {
    for (;;) {
      const key = rng.pick(d === 1 ? ['squareProduct', 'divMul'] : d === 2 ? ['tower', 'twoSquares'] : ['negGroup', 'twoGroups']);
      const inst = SHAPES[key](rng);
      if (!inst) continue;
      const { plain, tex, value, steps } = inst;
      if (Math.abs(value) > 30000 || value === 0 || value === 1) continue;
      const alts = inst.alts.filter((al, i, arr) => arr.findIndex((u) => evalExpr(u.plain).eq(evalExpr(al.plain)) && u.trap === al.trap) === i);
      const cands: { v: number; trap?: string }[] = [
        ...rng.shuffle(alts).map((al) => ({ v: evalExpr(al.plain).toNumber(), trap: al.trap })),
        ...[-value, 2 * value, -2 * value, 3 * value].map((v) => ({ v })),
      ].filter((c) => Math.abs(c.v) <= 60000);
      let built: ReturnType<typeof spreadChoices>;
      try {
        built = spreadChoices(rng, value, cands, (v) => `$${num(v)}$`, 5, 'shuffled');
      } catch {
        continue;
      }
      const values = built.choices.map((c) => Number(c.text.slice(1, -1).replace(/\{,\}/g, '')));
      const shown = built.choices
        .filter((c) => c.trap)
        .filter((c, i, arr) => arr.findIndex((u) => u.trap === c.trap) === i)
        .slice(0, 2);
      if (!shown.length) continue;
      const traps = shown.map((c) => `${c.text} ${NOTE[c.trap!]}`);
      return {
        params: { plain, values },
        q: {
          format: 'mcs',
          stem: `What is the value of $${tex}$?`,
          choices: built.choices,
          answer: built.answer,
          explanation: `Recognize a chain of different operations: rank decides the order, not position. Parentheses come first, then exponents (a tower is read from the top down), then multiplication and division from left to right, then addition and subtraction.

$$${tex} = ${steps}$$

Check: each step uses only the operation of highest rank that is left.

Trap: ${traps.join('; ')}. A different order of operations is a different expression, so follow the rank every time.`,
        },
      };
    }
  },
  check(q, { plain, values }) {
    const expected = evalExpr(plain).toNumber();
    return expectMcsBy(q, (i) => values[i] === expected);
  },
};

export const chainEvalTemplates: Template<any>[] = [chainEvalMCS];
