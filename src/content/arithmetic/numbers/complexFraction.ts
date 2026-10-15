import type { Frac } from '../../../engine/frac';
import { lcm } from '../../../engine/math';
import type { Template, Trap } from '../../../engine/types';
import { expectMCS, F, numChoices, pickWeighted } from './util';

export const complexFractionTraps: Record<string, Trap> = {
  'fr-add-across': {
    label: 'Added (or subtracted) the numerators and the denominators separately',
    fix: 'Fractions with different denominators need a common denominator first: $\\frac{1}{2} + \\frac{1}{3} = \\frac{3}{6} + \\frac{2}{6} = \\frac{5}{6}$, not $\\frac{2}{5}$.',
  },
  'fr-numerators-over-product': {
    label: 'Combined the numerators over the product of the denominators',
    fix: 'Each fraction must be rewritten with the common denominator before the numerators are combined: $\\frac{1}{2} + \\frac{1}{3} = \\frac{3 + 2}{6}$, where 3 and 2 are the rewritten numerators.',
  },
  'fr-product-for-quotient': {
    label: 'Multiplied where the expression divides',
    fix: 'Dividing by a number is multiplying by its reciprocal: $\\frac{1}{2} \\div \\frac{1}{4} = \\frac{1}{2} \\cdot 4 = 2$, while $\\frac{1}{2} \\cdot \\frac{1}{4} = \\frac{1}{8}$.',
  },
  'fr-invert-wrong-term': {
    label: 'Inverted the first fraction instead of the divisor',
    fix: 'In $x \\div y$, only the divisor $y$ is flipped: $\\frac{1}{2} \\div \\frac{1}{4} = \\frac{1}{2} \\cdot \\frac{4}{1}$. Flipping the dividend gives a different number.',
  },
  'fr-reciprocal-sum': {
    label: 'Treated the reciprocal of a sum as the sum of the reciprocals of the reciprocals',
    fix: '$\\frac{1}{\\frac{1}{a} + \\frac{1}{b}}$ is NOT $a + b$. Add the two fractions inside first, then take the reciprocal of that single fraction.',
  },
  'fr-forgot-final-reciprocal': {
    label: 'Stopped after the sum inside and forgot the outer reciprocal',
    fix: 'After adding the fractions in the denominator, the numerator 1 is still divided by that sum: flip it to finish.',
  },
  'fr-distribute-division': {
    label: 'Distributed a division over a subtraction in the divisor',
    fix: '$x \\div (y - z)$ is NOT $x \\div y - x \\div z$. Subtract inside the parentheses first, then divide once.',
  },
};

type Kind = 'sum' | 'diff' | 'div' | 'harm' | 'nest';
interface Params {
  kind: Kind;
  n: number[]; // a b c d e f
  stacked: boolean;
  values: Frac[];
}

const POOL: [number, number][] = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 6], [5, 6], [1, 8], [3, 8], [5, 8], [7, 8], [2, 7], [3, 7], [4, 9], [5, 9], [7, 10]];
const fx = (p: number, q: number) => `\\frac{${p}}{${q}}`;

function value(kind: Kind, n: number[]): Frac {
  const [a, b, c, d, e, f] = n;
  switch (kind) {
    case 'sum':
      return F(a, b).add(F(c, d));
    case 'diff':
      return F(a, b).sub(F(c, d));
    case 'div':
      return F(a, b).div(F(c, d));
    case 'harm':
      return F(1).div(F(1, a).add(F(1, b)));
    case 'nest':
      return F(a, b).div(F(c, d).sub(F(e, f)));
  }
}

const complexFraction: Template<Params> = {
  id: 'arith.fractions.complex-value-mcs',
  skill: 'arith.fractions',
  format: 'mcs',
  style: 'value of a sum, quotient or nested expression of fractions',
  generate(rng, diff) {
    for (;;) {
      const kind = pickWeighted<Kind>(rng, diff === 1 ? [['sum', 1], ['diff', 1]] : diff === 2 ? [['div', 3], ['sum', 1], ['diff', 1]] : [['harm', 2], ['nest', 3]]);
      let n: number[];
      if (kind === 'harm') n = [rng.int(2, 12), rng.int(2, 12)];
      else {
        const k = kind === 'nest' ? 3 : 2;
        const ps = rng.sample(POOL, k);
        n = ps.flatMap(([p, q]) => [p, q]);
      }
      if (kind === 'harm' && n[0] === n[1]) continue;
      const [a, b, c, d, e, f] = n;
      if (kind === 'diff' && !F(a, b).gt(F(c, d))) continue;
      if (kind === 'nest' && !F(c, d).gt(F(e, f))) continue;
      if (kind !== 'harm' && kind !== 'nest' && b === d && diff > 1) continue;
      if (kind === 'sum' || kind === 'diff') {
        if (b === d || (diff === 1 && lcm(b, d) > 24)) continue;
      }
      const key = value(kind, n);
      if (key.sign() <= 0 || key.eq(1) || key.d > 120 || key.n > 120) continue;
      const cand: { v: Frac; trap: string }[] = [];
      if (kind === 'sum') cand.push({ v: F(a + c, b + d), trap: 'fr-add-across' }, { v: F(a + c, b * d), trap: 'fr-numerators-over-product' });
      if (kind === 'diff') cand.push({ v: F(a - c, b - d === 0 ? 1 : b - d), trap: 'fr-add-across' }, { v: F(a - c, b * d), trap: 'fr-numerators-over-product' });
      if (kind === 'div') cand.push({ v: F(a, b).mul(F(c, d)), trap: 'fr-product-for-quotient' }, { v: F(b, a).mul(F(c, d)), trap: 'fr-invert-wrong-term' });
      if (kind === 'harm') cand.push({ v: F(a + b), trap: 'fr-reciprocal-sum' }, { v: F(1, a).add(F(1, b)), trap: 'fr-forgot-final-reciprocal' });
      if (kind === 'nest')
        cand.push(
          { v: F(a, b).div(F(c, d)).sub(F(a, b).div(F(e, f))), trap: 'fr-distribute-division' },
          { v: F(a, b).mul(F(c, d).sub(F(e, f))), trap: 'fr-product-for-quotient' },
          { v: F(c, d).sub(F(e, f)).div(F(a, b)), trap: 'fr-invert-wrong-term' },
        );
      const traps = cand.filter((t) => t.v.sign() > 0 && !t.v.eq(key) && t.v.d <= 200 && t.v.n <= 400);
      if (traps.length < 2) continue;
      const fillers = [key.inv(), key.mul(2), key.div(2), key.add(F(1, 2)), key.mul(3).div(2), key.add(1)].filter((v) => v.sign() > 0 && v.d <= 200 && v.n <= 400);
      let ch;
      try {
        ch = numChoices(rng, { correct: key, traps: traps.map((t) => ({ value: t.v, trap: t.trap })), fillers: rng.shuffle(fillers), order: 'shuffled', format: (v) => `$${v.toTex()}$` });
      } catch {
        continue;
      }
      const named = ch.choices.map((c0, i) => ({ c0, i })).filter((x) => x.c0.trap);
      if (named.length < 2) continue;
      const stacked = kind === 'div' && rng.chance(0.5);
      let expr: string;
      let steps: string;
      let check: string;
      switch (kind) {
        case 'sum':
        case 'diff': {
          const L = lcm(b, d);
          const op = kind === 'sum' ? '+' : '-';
          expr = `${fx(a, b)} ${op} ${fx(c, d)}`;
          steps = `Use the common denominator ${L}: $${fx(a, b)} = ${fx((a * L) / b, L)}$ and $${fx(c, d)} = ${fx((c * L) / d, L)}$. Then $${fx((a * L) / b, L)} ${op} ${fx((c * L) / d, L)} = ${fx((a * L) / b + (kind === 'sum' ? 1 : -1) * ((c * L) / d), L)}${key.d === L ? '' : ` = ${key.toTex()}`}$.`;
          check = `$${key.toTex()} ${kind === 'sum' ? '-' : '+'} ${fx(c, d)} = ${fx(a, b)}$`;
          break;
        }
        case 'div':
          expr = stacked ? `\\frac{${fx(a, b)}}{${fx(c, d)}}` : `${fx(a, b)} \\div ${fx(c, d)}`;
          steps = `Dividing by $${fx(c, d)}$ is multiplying by its reciprocal: $${fx(a, b)} \\cdot ${c === 1 ? d : fx(d, c)} = ${fx(a * d, b * c)}${key.d === b * c && key.n === a * d ? '' : ` = ${key.toTex()}`}$.`;
          check = `$${key.toTex()} \\cdot ${fx(c, d)} = ${fx(a, b)}$`;
          break;
        case 'harm':
          expr = `\\frac{1}{\\frac{1}{${a}} + \\frac{1}{${b}}}`;
          steps = `Add inside first: $\\frac{1}{${a}} + \\frac{1}{${b}} = \\frac{${b} + ${a}}{${a * b}} = ${fx(a + b, a * b)}${F(a + b, a * b).d === a * b ? '' : ` = ${F(a + b, a * b).toTex()}`}$. The expression is 1 divided by this, which is its reciprocal: $${key.toTex()}$.`;
          check = `$${key.toTex()}$ is smaller than both $${a}$ and $${b}$, as it must be, since the sum of the two reciprocals is larger than either one`;
          break;
        case 'nest': {
          const g = F(c, d).sub(F(e, f));
          expr = `${fx(a, b)} \\div \\left(${fx(c, d)} - ${fx(e, f)}\\right)`;
          steps = `Work inside the parentheses first: $${fx(c, d)} - ${fx(e, f)} = ${g.toTex()}$. Then divide once: $${fx(a, b)} \\div ${g.toTex()} = ${fx(a, b)} \\cdot ${g.inv().toTex()} = ${key.toTex()}$.`;
          check = `$${key.toTex()} \\cdot ${g.toTex()} = ${fx(a, b)}$`;
          break;
        }
      }
      const why: Record<string, string> = {
        'fr-add-across': 'combining numerators and denominators separately gives',
        'fr-numerators-over-product': 'putting the original numerators over the product of the denominators gives',
        'fr-product-for-quotient': 'multiplying where the expression divides gives',
        'fr-invert-wrong-term': 'flipping the wrong fraction gives',
        'fr-reciprocal-sum': 'reading the expression as the sum of the two denominators gives',
        'fr-forgot-final-reciprocal': 'stopping after the sum of the reciprocals gives',
        'fr-distribute-division': 'dividing by each term separately gives',
      };
      const seen = new Set<string>();
      const tr = named
        .filter((x) => !seen.has(x.c0.trap!) && seen.add(x.c0.trap!))
        .slice(0, 2)
        .map((x) => `Trap: ${why[x.c0.trap!]} $${ch.values[x.i].toTex()}$.`)
        .join(' ');
      return {
        params: { kind, n, stacked, values: ch.values },
        q: {
          format: 'mcs',
          stem: `What is the value of $${expr}$ ?`,
          choices: ch.choices,
          answer: ch.answer,
          explanation: `Recognize: an expression built from fractions, so work with one operation at a time and keep every result a fraction.

${steps}

Check: ${check}.

${tr}

Add with a common denominator; divide by multiplying by the reciprocal; do parentheses first.`,
        },
      };
    }
  },
  check(q, { kind, n, values }) {
    // Floating-point evaluation of the written expression.
    const [a, b, c, d, e, f] = n;
    let v: number;
    if (kind === 'sum') v = a / b + c / d;
    else if (kind === 'diff') v = a / b - c / d;
    else if (kind === 'div') v = a / b / (c / d);
    else if (kind === 'harm') v = 1 / (1 / a + 1 / b);
    else v = a / b / (c / d - e / f);
    return expectMCS(q, values.findIndex((x) => Math.abs(x.toNumber() - v) < 1e-9));
  },
};

export const complexFractionTemplates: Template<any>[] = [complexFraction];
