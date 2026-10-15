import { qcCompare, qcFromSamples } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import { QC_WORDS, evalExpr, expectQc, plainToTex, substitute } from './util';

export const groupingCompareTraps: Record<string, Trap> = {
  'oo-grouping-ignored': {
    label: 'Read a grouped expression as if its parentheses were not there',
    fix: 'Parentheses change what an operation applies to: $a - (b + x)$ subtracts both $b$ and $x$, while $a - b + x$ does not. Evaluate the group first, as written.',
  },
};

interface Pair {
  plainA: string;
  plainB: string;
  fA: (x: number) => Frac;
  fB: (x: number) => Frac;
  /** x = 0 is not allowed (division) */
  nonzero?: boolean;
  why: string;
}

function pairBank(a: number, b: number, k: number): Record<string, Pair> {
  const F = frac;
  return {
    div: {
      plainA: `${a}/${b}*x`,
      plainB: `${a}/(${b}*x)`,
      fA: (x) => F(a).div(b).mul(x),
      fB: (x) => F(a).div(b * x),
      nonzero: true,
      why: `Dividing by $${b}$ and then multiplying by $x$ is not the same as dividing by $${b}x$: A equals $${k}x$ and B equals $\\frac{${k}}{x}$, so A is $x^2$ times B.`,
    },
    subsum: {
      plainA: `${a}-${b}+x`,
      plainB: `${a}-(${b}+x)`,
      fA: (x) => F(a - b + x),
      fB: (x) => F(a - b - x),
      why: `Subtracting the group $(${b} + x)$ removes both $${b}$ and $x$, but Quantity A adds $x$. So A minus B equals $2x$, which has the sign of $x$.`,
    },
    subeq: {
      plainA: `${a}-${b}+x`,
      plainB: `${a}-(${b}-x)`,
      fA: (x) => F(a - b + x),
      fB: (x) => F(a - b + x),
      why: `Subtracting a group reverses the sign of every term inside it: $${a} - (${b} - x) = ${a} - ${b} + x$. The two expressions are the same number for every $x$.`,
    },
    subchain: {
      plainA: `${a}-x-${b}`,
      plainB: `${a}-(x-${b})`,
      fA: (x) => F(a - x - b),
      fB: (x) => F(a - x + b),
      why: `Subtracting the group $(x - ${b})$ turns $-${b}$ into $+${b}$, so B equals $${a} - x + ${b}$. B minus A is $${2 * b}$, whatever $x$ is.`,
    },
    dist: {
      plainA: `${a}+${b}*x`,
      plainB: `(${a}+${b})*x`,
      fA: (x) => F(a + b * x),
      fB: (x) => F((a + b) * x),
      why: `Multiplying the group gives $(${a} + ${b})x = ${a}x + ${b}x$, so A minus B equals $${a} - ${a}x = ${a}(1 - x)$. Its sign depends on whether $x$ is below 1, equal to 1, or above 1.`,
    },
    sq: {
      plainA: `${b}*x^2`,
      plainB: `(${b}*x)^2`,
      fA: (x) => F(b).mul(x * x),
      fB: (x) => F(b * x).pow(2),
      why: `The exponent in B applies to the whole group: $(${b}x)^2 = ${b * b}x^2$, which is ${b} times Quantity A. B is larger unless $x = 0$, where both are 0.`,
    },
    frac: {
      plainA: `x+${a}/${b}`,
      plainB: `(x+${a})/${b}`,
      fA: (x) => F(x).add(F(a).div(b)),
      fB: (x) => F(x + a).div(b),
      why: `Dividing the group $(x + ${a})$ by $${b}$ also divides $x$, while in A only $${a}$ is divided. A minus B equals $x - \\frac{x}{${b}}$, which has the sign of $x$.`,
    },
  };
}

type DomKey = 'pos' | 'gt1' | 'nz' | 'int';
const DOMAINS: Record<DomKey, { vals: number[]; text: string }> = {
  pos: { vals: [1, 2, 3, 4, 5, 6, 7, 8, 9], text: '$x$ is a positive integer.' },
  gt1: { vals: [2, 3, 4, 5, 6, 7, 8, 9], text: '$x$ is an integer greater than 1.' },
  nz: { vals: [-9, -8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9], text: '$x$ is a nonzero integer.' },
  int: { vals: [-9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9], text: '$x$ is an integer.' },
};

interface Params {
  plainA: string;
  plainB: string;
  xs: number[];
}

const upper = (s: string) => s[0].toUpperCase() + s.slice(1);

export const groupingCompareQC: Template<Params> = {
  id: 'arith.order-of-operations.grouping-compare-qc',
  skill: 'arith.order-of-operations',
  format: 'qc',
  style: 'two groupings of the same numbers (division chain, subtracted group, distributing): compare',
  generate(rng, d) {
    for (;;) {
      const b = d === 3 ? rng.int(7, 15) : rng.int(2, 6);
      const k = rng.int(2, d === 3 ? 9 : 8);
      const a = b * k;
      const bank = pairBank(a, b, k);
      const keys = d === 1 ? ['div', 'subsum', 'subeq', 'subchain', 'dist', 'sq', 'frac'] : d === 2 ? ['div', 'subsum', 'subeq', 'subchain', 'dist', 'sq', 'frac'] : ['div', 'subsum', 'dist', 'sq', 'frac'];
      const pair = bank[rng.pick(keys)];
      let xs: number[];
      let info: string;
      if (d === 1) {
        const x = rng.int(2, 9);
        xs = [x];
        info = `$x = ${x}$`;
      } else {
        const dom = DOMAINS[rng.pick(d === 2 ? (['gt1', 'pos', 'nz', 'int'] as DomKey[]) : (['pos', 'int', 'nz'] as DomKey[]))];
        if (pair.nonzero && dom.vals.includes(0)) continue;
        xs = dom.vals;
        info = dom.text;
      }
      const rels = xs.map((x) => ({ x, rel: qcCompare(pair.fA(x), pair.fB(x)) }));
      const answer: QCChoice = new Set(rels.map((r) => r.rel)).size > 1 ? 'D' : rels[0].rel;
      if (d === 3 && rng.chance(answer === 'D' ? 0.55 : 0.4)) continue; // level 3 leans on the hidden threshold, without becoming all D
      // the sign discussion of the distributing pair only matters while x can vary
      const why = pair.why.replace(/ Its sign depends on whether.*$/, answer === 'D' ? ' Its sign depends on whether $x$ is below 1, equal to 1, or above 1.' : d === 1 ? '' : ' For every allowed value of $x$ it has the same sign.');
      const show = (x: number, which: 'A' | 'B') => {
        const plain = which === 'A' ? pair.plainA : pair.plainB;
        const v = (which === 'A' ? pair.fA : pair.fB)(x);
        return `$${plainToTex(plain)} = ${plainToTex(substitute(plain, { x }))} = ${v.toTex()}$`;
      };
      const strip = (s: string) => s.replace(/[()]/g, '');
      const traps: QCQuestion['traps'] = {};
      let body: string;
      let trapLine: string;
      if (answer === 'D') {
        const sorted = [...rels].sort((p, q) => Math.abs(p.x) - Math.abs(q.x) || p.x - q.x);
        const c1 = sorted[0];
        const c2 = sorted.find((r) => r.rel !== c1.rel)!;
        const line = (c: { x: number; rel: QCChoice }) => `- $x = ${c.x}$: A is $${pair.fA(c.x).toTex()}$ and B is $${pair.fB(c.x).toTex()}$, so ${QC_WORDS[c.rel]}.`;
        traps[c1.rel] = 'tested-one-value';
        body = `The statement allows several values of $x$, so test allowed values.\n\n${line(c1)}\n${line(c2)}\n\n${why}\n\nTwo allowed values disagree, so the relationship cannot be determined. (D)`;
        trapLine = `\n\nTrap: stopping after $x = ${c1.x}$ would suggest that ${QC_WORDS[c1.rel]}. A comparison that holds for one allowed value is not enough.`;
      } else {
        const x = xs[Math.min(1, xs.length - 1)];
        const slip = qcCompare(evalExpr(substitute(strip(pair.plainA), { x })), evalExpr(substitute(strip(pair.plainB), { x })));
        if (slip !== answer) traps[slip] = 'oo-grouping-ignored';
        const lead = d === 1 ? `Substitute $x = ${x}$ and evaluate the parentheses first.` : `Every allowed value gives the same comparison, so test one value (here $x = ${x}$) and explain why with the algebra.`;
        body = `${lead}\n\n- Quantity A: ${show(x, 'A')}\n- Quantity B: ${show(x, 'B')}\n\n${why}\n\n${upper(QC_WORDS[answer])}. (${answer})`;
        trapLine = slip !== answer ? `\n\nTrap: reading $${plainToTex(pair.plainB)}$ without its parentheses, as $${plainToTex(strip(pair.plainB))}$, would suggest that ${QC_WORDS[slip]}.` : '';
      }
      return {
        params: { plainA: pair.plainA, plainB: pair.plainB, xs },
        q: {
          format: 'qc',
          info,
          quantityA: `$${plainToTex(pair.plainA)}$`,
          quantityB: `$${plainToTex(pair.plainB)}$`,
          answer,
          traps: Object.keys(traps).length ? traps : undefined,
          explanation: body + trapLine,
        },
      };
    }
  },
  check(q, { plainA, plainB, xs }) {
    return expectQc(q, qcFromSamples(xs.map((x): [Frac, Frac] => [evalExpr(substitute(plainA, { x })), evalExpr(substitute(plainB, { x }))])));
  },
};

export const groupingCompareTemplates: Template<any>[] = [groupingCompareQC];
