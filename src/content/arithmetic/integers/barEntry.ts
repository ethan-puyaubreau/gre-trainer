import type { Template, Trap } from '../../../engine/types';
import { Frac, frac } from '../../../engine/frac';
import { evalExpr, expectMcsBy, plainToTex } from './util';

export const barEntryTraps: Record<string, Trap> = {
  'oo-neither-grouped': {
    label: 'Typed a fraction bar without grouping the top or the bottom',
    fix: 'On one line, a fraction bar becomes a division of a whole group by a whole group: $(a+b)/(c+d)$. Without parentheses only the neighbouring number is divided.',
  },
  'oo-denominator-ungrouped': {
    label: 'Put only the first term of the denominator under the bar',
    fix: 'Everything under a fraction bar is divided by together. Typed on one line, a denominator with two terms needs parentheses: $a/(b+c)$, not $a/b+c$.',
  },
  'oo-numerator-ungrouped': {
    label: 'Divided only the last term of the numerator',
    fix: 'Everything above a fraction bar is divided together. Typed on one line, a numerator with two terms needs parentheses: $(a+b)/c$, not $a+b/c$.',
  },
  'oo-split-denominator': {
    label: 'Split a sum in the denominator into two fractions',
    fix: 'You can split a sum in the numerator, $\\frac{a+b}{c} = \\frac{a}{c}+\\frac{b}{c}$, but not one in the denominator: $\\frac{a}{b+c} \\ne \\frac{a}{b}+\\frac{a}{c}$ (try $a = 2$, $b = c = 1$).',
  },
  'oo-denominator-product': {
    label: 'Multiplied the terms of the denominator instead of adding them',
    fix: 'Keep the operation written under the bar: a denominator $b + c$ stays a sum, $a/(b+c)$.',
  },
  'oo-power-scope': {
    label: 'Moved an exponent onto a different part of the expression',
    fix: 'An exponent applies only to the number or group right before it. $(a-b)^2$ and $a^2-b$ are different, and so are $(a/c)^2$ and $a^2/c$ when a group is squared.',
  },
  'oo-bar-as-product': {
    label: 'Read the fraction bar as a multiplication',
    fix: 'A fraction bar means division. $(a+b)\\cdot c$ is not $(a+b)/c$.',
  },
  'oo-multiplier-in-denominator': {
    label: 'Pulled a multiplier into the denominator',
    fix: '$\\frac{a}{b+c}\\cdot d$ divides $a$ by $b+c$ and then multiplies by $d$. Typing $a/(b+c)/d$ or $a/(b+c\\cdot d)$ divides by $d$ or changes the sum.',
  },
};

const NOTE: Record<string, string> = {
  'oo-neither-grouped': 'divides only one number, because nothing is grouped',
  'oo-denominator-ungrouped': 'puts only the first term of the denominator under the bar',
  'oo-numerator-ungrouped': 'divides only the last term of the numerator',
  'oo-split-denominator': 'splits the sum in the denominator into two fractions',
  'oo-denominator-product': 'multiplies the terms of the denominator',
  'oo-power-scope': 'puts the exponent on the wrong part',
  'oo-bar-as-product': 'treats the bar as a multiplication',
  'oo-multiplier-in-denominator': 'pulls the multiplier into the denominator',
};

interface N {
  a: number;
  b: number;
  c: number;
  d: number;
  o1: '+' | '-';
  o2: '+' | '-';
}
interface Wrong {
  plain: string;
  trap: string;
}
interface Shape {
  tex: (n: N) => string;
  value: (n: N) => Frac;
  correct: (n: N) => string;
  wrongs: (n: N) => Wrong[];
  /** extra condition on the numbers */
  ok?: (n: N) => boolean;
}

const sg = (o: '+' | '-', x: number) => (o === '+' ? x : -x);

const SHAPES: Record<string, Shape> = {
  sums: {
    tex: ({ a, b, c, d, o1, o2 }) => `\\frac{${a} ${o1} ${b}}{${c} ${o2} ${d}}`,
    value: ({ a, b, c, d, o1, o2 }) => frac(a + sg(o1, b)).div(c + sg(o2, d)),
    correct: ({ a, b, c, d, o1, o2 }) => `(${a}${o1}${b})/(${c}${o2}${d})`,
    wrongs: ({ a, b, c, d, o1, o2 }) => [
      { plain: `${a}${o1}${b}/${c}${o2}${d}`, trap: 'oo-neither-grouped' },
      { plain: `(${a}${o1}${b}/${c})${o2}${d}`, trap: 'oo-neither-grouped' },
      { plain: `(${a}${o1}${b})/${c}${o2}${d}`, trap: 'oo-denominator-ungrouped' },
      { plain: `${a}${o1}${b}/(${c}${o2}${d})`, trap: 'oo-numerator-ungrouped' },
    ],
    ok: ({ a, b, c, d, o1, o2 }) => a + sg(o1, b) !== 0 && c + sg(o2, d) !== 0 && c + sg(o2, d) !== 1,
  },
  split: {
    tex: ({ a, b, c }) => `\\frac{${a}}{${b} + ${c}}`,
    value: ({ a, b, c }) => frac(a).div(b + c),
    correct: ({ a, b, c }) => `${a}/(${b}+${c})`,
    wrongs: ({ a, b, c }) => [
      { plain: `${a}/${b}+${c}`, trap: 'oo-denominator-ungrouped' },
      { plain: `${a}/${b}+${a}/${c}`, trap: 'oo-split-denominator' },
      { plain: `${a}/(${b}*${c})`, trap: 'oo-denominator-product' },
      { plain: `${a}+${b}/${c}`, trap: 'oo-neither-grouped' },
    ],
  },
  squareTop: {
    tex: ({ a, b, c }) => `\\frac{${a}^{2} - ${b}}{${c}}`,
    value: ({ a, b, c }) => frac(a * a - b).div(c),
    correct: ({ a, b, c }) => `(${a}^2-${b})/${c}`,
    wrongs: ({ a, b, c }) => [
      { plain: `${a}^2-${b}/${c}`, trap: 'oo-numerator-ungrouped' },
      { plain: `(${a}-${b})^2/${c}`, trap: 'oo-power-scope' },
      { plain: `(${a}^2-${b})*${c}`, trap: 'oo-bar-as-product' },
      { plain: `${a}^2-${b}*${c}`, trap: 'oo-bar-as-product' },
    ],
    ok: ({ a, b }) => a * a !== b,
  },
  timesFraction: {
    tex: ({ a, b, c, d }) => `\\frac{${a}}{${b} + ${c}} \\cdot ${d}`,
    value: ({ a, b, c, d }) => frac(a).div(b + c).mul(d),
    correct: ({ a, b, c, d }) => `${a}/(${b}+${c})*${d}`,
    wrongs: ({ a, b, c, d }) => [
      { plain: `${a}/((${b}+${c})*${d})`, trap: 'oo-multiplier-in-denominator' },
      { plain: `${a}/(${b}+${c}*${d})`, trap: 'oo-multiplier-in-denominator' },
      { plain: `${a}/${b}+${c}*${d}`, trap: 'oo-denominator-ungrouped' },
      { plain: `${a}/${b}+${a}/${c}*${d}`, trap: 'oo-split-denominator' },
    ],
  },
  squareFraction: {
    tex: ({ a, b, c }) => `\\left(\\frac{${a}}{${b} + ${c}}\\right)^{2}`,
    value: ({ a, b, c }) => frac(a).div(b + c).pow(2),
    correct: ({ a, b, c }) => `(${a}/(${b}+${c}))^2`,
    wrongs: ({ a, b, c }) => [
      { plain: `${a}^2/(${b}+${c})`, trap: 'oo-power-scope' },
      { plain: `${a}/(${b}+${c})^2`, trap: 'oo-power-scope' },
      { plain: `(${a}/${b}+${c})^2`, trap: 'oo-denominator-ungrouped' },
      { plain: `${a}/${b}+${c}^2`, trap: 'oo-denominator-ungrouped' },
    ],
  },
};

interface Params {
  target: Frac;
  plains: string[];
}

export const barEntryMCS: Template<Params> = {
  id: 'arith.order-of-operations.bar-entry-mcs',
  skill: 'arith.order-of-operations',
  format: 'mcs',
  style: 'which one-line entry matches a fraction with a grouped numerator or denominator',
  generate(rng, d) {
    for (;;) {
      const key = rng.pick(d === 1 ? ['sums'] : d === 2 ? ['split', 'squareTop', 'sums'] : ['timesFraction', 'squareFraction']);
      const shape = SHAPES[key];
      const hi = d === 1 ? 9 : 12;
      const n: N = { a: rng.int(2, hi), b: rng.int(2, hi), c: rng.int(2, hi), d: rng.int(2, hi), o1: d === 1 ? '+' : rng.pick(['+', '-'] as const), o2: rng.pick(['+', '-'] as const) };
      if (d === 2 && key === 'sums' && n.o1 === '+' && n.o2 === '+') continue; // level 2 mixes in a subtraction
      if (shape.ok && !shape.ok(n)) continue;
      const target = shape.value(n);
      const correct = shape.correct(n);
      let wrongs: Wrong[];
      try {
        wrongs = shape.wrongs(n).filter((w, i, arr) => arr.findIndex((u) => u.plain === w.plain) === i && !evalExpr(w.plain).eq(target));
      } catch {
        continue;
      }
      if (wrongs.length < 4) continue;
      const picked = wrongs.slice(0, 4);
      const items = rng.shuffle([{ plain: correct, trap: undefined as string | undefined }, ...picked.map((w) => ({ plain: w.plain, trap: w.trap as string | undefined }))]);
      const valueTex = (p: string) => evalExpr(p).toTex();
      const trapNotes = picked
        .filter((w, i, arr) => arr.findIndex((u) => u.trap === w.trap) === i)
        .slice(0, 2)
        .map((w) => `$${plainToTex(w.plain)}$ ${NOTE[w.trap]}`);
      return {
        params: { target, plains: items.map((it) => it.plain) },
        q: {
          format: 'mcs',
          stem: `Which of the following expressions, evaluated with the order of operations, has the same value as $${shape.tex(n)}$?`,
          choices: items.map((it) => ({ text: `$${plainToTex(it.plain)}$`, ...(it.trap ? { trap: it.trap } : {}) })),
          answer: items.findIndex((it) => it.trap === undefined),
          explanation: `Recognize a fraction written on one line: the bar divides the whole numerator by the whole denominator, so any part with two terms or an exponent needs its own parentheses.

The value of $${shape.tex(n)}$ is $${target.toTex()}$. The expression $${plainToTex(correct)}$ groups exactly what the bar groups, and evaluates to $${valueTex(correct)}$.

Trap: ${trapNotes.join('; and ')}. Without the parentheses, division and multiplication act on the nearest number only, before any addition or subtraction.

To type a fraction on one line, put parentheses around a numerator or denominator with more than one term.`,
        },
      };
    }
  },
  check(q, { target, plains }) {
    return expectMcsBy(q, (i) => evalExpr(plains[i]).eq(target));
  },
};

export const barEntryTemplates: Template<any>[] = [barEntryMCS];
