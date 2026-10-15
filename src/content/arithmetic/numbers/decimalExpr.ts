import type { Frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import { decimal } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { expectMCS, F, numChoices, pickWeighted } from './util';

export const decimalExprTraps: Record<string, Trap> = {
  'dec-fraction-as-decimal': {
    label: 'Read the fraction $\\frac{a}{b}$ as the decimal $0.ab$',
    fix: 'A fraction is a quotient: divide the numerator by the denominator. $\\frac{3}{4} = 3 \\div 4 = 0.75$, not $0.34$.',
  },
  'dec-point-shift': {
    label: 'Put the decimal point one place too far left or right',
    fix: 'Count the decimal places of the factors: the product has as many places as both factors together. $0.6 \\times 0.25 = 0.15$, because $6 \\times 25 = 150$ and there are 3 places in all.',
  },
  'dec-division-flipped': {
    label: 'Multiplied where the problem divides, or divided where it multiplies',
    fix: 'Dividing by a fraction multiplies by its reciprocal: $0.9 \\div \\frac{3}{4} = 0.9 \\times \\frac{4}{3} = 1.2$, while $0.9 \\times \\frac{3}{4} = 0.675$.',
  },
  'dec-order-of-operations': {
    label: 'Worked strictly left to right and ignored the order of operations',
    fix: 'Multiplication and division come before addition and subtraction unless parentheses say otherwise: $1 - 0.5 \\times 0.5 = 0.75$, not $0.25$.',
  },
};

type Kind = 'sum' | 'prod' | 'quot' | 'order' | 'chain';
interface Params {
  kind: Kind;
  p: number;
  q: number;
  y: Frac;
  z: Frac;
  s: 1 | -1;
  rev: boolean;
  values: Frac[];
}

const FRACS: [number, number][] = [
  [1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 8], [3, 8], [5, 8], [7, 8],
  [7, 20], [9, 20], [3, 25], [7, 50], [9, 40],
];
const SMALL_Q = new Set([2, 4, 5, 8]);
const QUARTER = F(1, 4);

const dec = (x: Frac) => decimal(x);
const places = (x: Frac) => (x.toDecimalString().split('.')[1] ?? '').length;
const fracTex = (p: number, q: number) => `\\frac{${p}}{${q}}`;
const randDec = (rng: Rng, twoPlaces: boolean) =>
  twoPlaces && rng.chance(0.6) ? F(rng.pick([5, 15, 25, 35, 45, 65, 75, 85, 12, 24, 36, 48]), 100) : F(rng.int(1, 9), 10);

/** The expression with the fraction part replaced by g (g = the true fraction for the key). */
function evaluate(kind: Kind, g: Frac, y: Frac, z: Frac, s: number, rev: boolean): Frac {
  switch (kind) {
    case 'sum':
      return g.add(y.mul(s));
    case 'prod':
      return g.mul(y);
    case 'quot':
      return rev ? g.div(y) : y.div(g);
    case 'order':
      return g.add(y.mul(QUARTER).mul(s));
    case 'chain':
      return g.add(y.mul(s)).div(z);
  }
}

const decimalExpr: Template<Params> = {
  id: 'arith.decimals.fraction-decimal-expr',
  skill: 'arith.decimals',
  format: 'mcs',
  style: 'value of an expression mixing fractions and decimals',
  generate(rng, d) {
    for (;;) {
      const kind = pickWeighted<Kind>(
        rng,
        d === 1
          ? [['sum', 1]]
          : d === 2
            ? [['prod', 3], ['quot', 3], ['sum', 0.6]]
            : [['order', 3], ['chain', 3], ['quot', 1.5]],
      );
      const [p, q] = rng.pick(d === 1 ? FRACS.filter(([, b]) => SMALL_Q.has(b)) : FRACS);
      const y = randDec(rng, d !== 1 || rng.chance(0.5));
      const z = kind === 'chain' ? rng.pick([F(1, 5), F(1, 4), F(2, 5), F(1, 2), F(3, 10), F(3, 20)]) : F(1);
      const s: 1 | -1 = rng.chance(0.5) ? 1 : -1;
      const rev = rng.chance(0.5);
      const f = F(p, q);
      const key = evaluate(kind, f, y, z, s, rev);
      if (key.sign() <= 0 || !key.isTerminating() || key.eq(1) || key.eq(y) || key.eq(f) || key.toDecimalString().length > 8) continue;

      const cand: { v: Frac; trap: string }[] = [];
      if (SMALL_Q.has(q) && p < 10) cand.push({ v: evaluate(kind, F(p * 10 + q, 100), y, z, s, rev), trap: 'dec-fraction-as-decimal' });
      if (kind === 'prod') cand.push({ v: rev ? f.div(y) : y.div(f), trap: 'dec-division-flipped' });
      if (kind === 'quot') cand.push({ v: rev ? f.mul(y) : y.mul(f), trap: 'dec-division-flipped' });
      if (kind === 'order') cand.push({ v: f.add(y.mul(s)).mul(QUARTER), trap: 'dec-order-of-operations' });
      if (kind === 'chain') cand.push({ v: f.add(y.mul(s).div(z)), trap: 'dec-order-of-operations' });
      cand.push({ v: key.div(10), trap: 'dec-point-shift' }, { v: key.mul(10), trap: 'dec-point-shift' });
      const traps = cand.filter((c) => c.v.isTerminating() && c.v.sign() > 0 && !c.v.eq(key) && c.v.toDecimalString().length <= 9);

      const ch = numChoices(rng, {
        correct: key,
        traps: traps.map((t) => ({ value: t.v, trap: t.trap })),
        format: (v) => `$${dec(v)}$`,
      });
      const namedIdx = ch.choices.map((c, i) => (c.trap && c.trap !== 'dec-point-shift' ? i : -1)).filter((i) => i >= 0);
      if (!namedIdx.length || ch.choices.filter((c) => c.trap).length < 2) continue;

      const fx = fracTex(p, q);
      const ytx = dec(y);
      const op = s > 0 ? '+' : '-';
      let expr: string;
      let steps: string;
      switch (kind) {
        case 'sum':
          expr = s > 0 && rng.chance(0.5) ? `${ytx} + ${fx}` : `${fx} ${op} ${ytx}`;
          steps = `Convert the fraction: $${fx} = ${p} \\div ${q} = ${dec(f)}$. Then $${dec(f)} ${op} ${ytx} = ${dec(key)}$, lining up the decimal points.`;
          break;
        case 'prod':
          expr = rev ? `${fx} \\times ${ytx}` : `${ytx} \\times ${fx}`;
          steps = `Convert the fraction: $${fx} = ${dec(f)}$. Multiply as whole numbers, then place the point: the factors have ${places(f) + places(y)} decimal places in all, so $${dec(f)} \\times ${ytx} = ${dec(key)}$.`;
          break;
        case 'quot':
          expr = rev ? `${fx} \\div ${ytx}` : `${ytx} \\div ${fx}`;
          steps = rev
            ? `Convert the fraction: $${fx} = ${dec(f)}$. Then $${dec(f)} \\div ${ytx} = ${dec(key)}$, since $${ytx} \\times ${dec(key)} = ${dec(f)}$.`
            : `Dividing by $${fx}$ means multiplying by its reciprocal $${p === 1 ? q : fracTex(q, p)}$: $${ytx} \\times ${p === 1 ? q : fracTex(q, p)} = ${dec(key)}$.`;
          break;
        case 'order':
          expr = `${fx} ${op} ${ytx} \\times \\frac{1}{4}`;
          steps = `Multiplication comes first: $${ytx} \\times \\frac{1}{4} = ${dec(y.mul(QUARTER))}$. Then $${dec(f)} ${op} ${dec(y.mul(QUARTER))} = ${dec(key)}$.`;
          break;
        case 'chain':
          expr = `\\left(${fx} ${op} ${ytx}\\right) \\div ${dec(z)}`;
          steps = `Work inside the parentheses first: $${dec(f)} ${op} ${ytx} = ${dec(f.add(y.mul(s)))}$. Then divide the whole result: $${dec(f.add(y.mul(s)))} \\div ${dec(z)} = ${dec(key)}$.`;
          break;
      }
      const trapText: Record<string, string> = {
        'dec-fraction-as-decimal': `reading $${fx}$ as $0.${p}${q}$ gives`,
        'dec-division-flipped': 'using the opposite operation gives',
        'dec-order-of-operations': kind === 'order' ? 'working strictly left to right gives' : 'dividing only the last number gives',
      };
      const trapWhy: Record<string, string> = {
        'dec-fraction-as-decimal': 'but a fraction means numerator divided by denominator',
        'dec-division-flipped': 'but dividing by a fraction is multiplying by its reciprocal',
        'dec-order-of-operations': kind === 'order' ? 'but multiplication comes before addition and subtraction' : 'but the parentheses hold both numbers',
      };
      const tr = namedIdx.map((i) => `Trap: ${trapText[ch.choices[i].trap!]} $${dec(ch.values[i])}$, ${trapWhy[ch.choices[i].trap!]}.`).join(' ');
      const shiftIdx = ch.choices.findIndex((c) => c.trap === 'dec-point-shift');
      const shiftNote = shiftIdx >= 0 ? ' A choice with the same digits and the point misplaced is also there, so judge the size of the answer first.' : '';
      const inv: Record<Kind, string> = {
        sum: `${dec(key)} ${s > 0 ? '-' : '+'} ${ytx} = ${dec(f)}`,
        prod: `${dec(key)} \\div ${ytx} = ${dec(f)}`,
        quot: rev ? `${ytx} \\times ${dec(key)} = ${dec(f)}` : `${dec(f)} \\times ${dec(key)} = ${ytx}`,
        order: `${dec(key)} ${s > 0 ? '-' : '+'} ${dec(f)} = ${dec(y.mul(QUARTER))}`,
        chain: `${dec(key)} \\times ${dec(z)} = ${dec(f.add(y.mul(s)))}`,
      };
      const rule: Record<Kind, string> = {
        sum: 'Turn the fraction into a decimal by dividing, and line up the decimal points.',
        prod: 'In a product, the decimal places of the factors add up.',
        quot: 'Dividing by a fraction multiplies by its reciprocal.',
        order: 'Do multiplication and division before addition and subtraction.',
        chain: 'Parentheses first, then divide the whole result.',
      };
      return {
        params: { kind, p, q, y, z, s, rev, values: ch.values },
        q: {
          format: 'mcs',
          stem: rng.chance(0.5) ? `What is the value of $${expr}$ ?` : `Which of the following is equal to $${expr}$ ?`,
          choices: ch.choices,
          answer: ch.answer,
          explanation: `Recognize: a fraction and decimals in one expression, so write everything as decimals and follow the order of operations.

${steps}

Check: $${inv[kind]}$.

${tr}${shiftNote}

${rule[kind]}`,
        },
      };
    }
  },
  check(q, { kind, p, q: den, y, z, s, rev, values }) {
    // Floating-point re-evaluation of the written expression.
    const f = p / den;
    const Y = y.toNumber();
    const Z = z.toNumber();
    const v = kind === 'sum' ? f + s * Y : kind === 'prod' ? f * Y : kind === 'quot' ? (rev ? f / Y : Y / f) : kind === 'order' ? f + s * (Y * 0.25) : (f + s * Y) / Z;
    return expectMCS(q, values.findIndex((x) => Math.abs(x.toNumber() - v) < 1e-9));
  },
};

export const decimalExprTemplates: Template<any>[] = [decimalExpr];
