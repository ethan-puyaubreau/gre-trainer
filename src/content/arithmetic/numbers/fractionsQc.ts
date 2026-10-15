import { qcFromSamples } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import { num } from '../../../engine/tex';
import type { Difficulty, QCChoice, Template } from '../../../engine/types';
import { expectQC, F, pickWeighted, qcEnd, swapQC } from './util';

type Fam = 'sq' | 'recip' | 'self' | 'cancel';
type Dom = 'pos' | 'below' | 'above' | 'atleast' | 'neg' | 'nonzero' | 'noteq' | 'ne';

interface Params {
  fam: Fam;
  dom: Dom;
  c: number;
  j: number;
  t: string; // threshold as a fraction "n/d"
  v: string;
  swap: boolean;
}

const parseT = (t: string) => {
  const [n, d] = t.split('/').map(Number);
  return F(n, d);
};

/** The two expressions (as functions of x) of each family. */
function exprs(fam: Fam, c: number, j: number): [(x: Frac) => Frac, (x: Frac) => Frac] {
  switch (fam) {
    case 'sq':
      return [(x) => x.mul(x), (x) => x.mul(c)];
    case 'recip':
      return [(x) => x.inv(), () => F(c)];
    case 'self':
      return [(x) => x, (x) => F(c).div(x)];
    case 'cancel':
      return [(x) => x.mul(x).sub(c * c).div(x.sub(c)), (x) => x.add(c + j)];
  }
}

const defined = (fam: Fam, c: number, x: Frac) => (fam === 'sq' ? true : fam === 'cancel' ? !x.eq(c) : !x.eq(0));
const inDom = (dom: Dom, t: Frac, x: Frac) => {
  switch (dom) {
    case 'pos':
      return x.gt(0);
    case 'below':
      return x.gt(0) && x.lt(t);
    case 'above':
      return x.gt(t);
    case 'atleast':
      return x.gte(t);
    case 'neg':
      return x.lt(0);
    case 'nonzero':
      return !x.eq(0);
    case 'noteq':
      return x.gt(0) && !x.eq(t);
    case 'ne':
      return !x.eq(t);
  }
};

const GRID: Frac[] = (() => {
  const out: Frac[] = [];
  for (const d of [1, 2, 3, 4, 5, 6]) for (let n = -12 * d; n <= 12 * d; n++) if (n !== 0 || d === 1) out.push(F(n, d));
  return out.filter((x, i) => out.findIndex((y) => y.eq(x)) === i).sort((a, b) => a.d + Math.abs(a.n) - (b.d + Math.abs(b.n)));
})();

const domTex = (dom: Dom, v: string, tTex: string) => {
  switch (dom) {
    case 'pos':
      return `$${v} > 0$`;
    case 'below':
      return `$0 < ${v} < ${tTex}$`;
    case 'above':
      return `$${v} > ${tTex}$`;
    case 'atleast':
      return `$${v} \\ge ${tTex}$`;
    case 'neg':
      return `$${v} < 0$`;
    case 'nonzero':
      return `$${v} \\ne 0$`;
    case 'noteq':
      return `$${v} > 0$ and $${v} \\ne ${tTex}$`;
    case 'ne':
      return `$${v} \\ne ${tTex}$`;
  }
};

const val = (x: Frac) => x.toTex();
const showX = (x: Frac, v: string) => `$${v} = ${val(x)}$`;

const fractionsQc: Template<Params> = {
  id: 'arith.fractions.reciprocal-qc',
  skill: 'arith.fractions',
  format: 'qc',
  style: 'powers and reciprocals of a number compared on a range of values',
  generate(rng: Rng, d: Difficulty) {
    for (;;) {
      let fam: Fam;
      let dom: Dom;
      let c: number;
      let j = 0;
      if (d === 1) {
        fam = pickWeighted<Fam>(rng, [['sq', 1], ['recip', 1]]);
        c = fam === 'sq' ? rng.int(1, 3) : rng.int(2, 4);
        dom = pickWeighted<Dom>(rng, [['pos', 1.2], ['below', 1], ['above', 1]]);
      } else if (d === 2) {
        fam = pickWeighted<Fam>(rng, [['sq', 2], ['recip', 2], ['cancel', 1.2]]);
        c = fam === 'sq' ? rng.int(4, 9) : fam === 'recip' ? rng.int(5, 9) : rng.int(2, 6);
        dom = fam === 'cancel' ? 'noteq' : pickWeighted<Dom>(rng, [['pos', 1], ['below', 1], ['above', 1], ['neg', 0.8]]);
        if (fam === 'cancel') j = rng.pick([-1, 0, 0, 1]);
      } else {
        fam = pickWeighted<Fam>(rng, [['self', 3], ['sq', 2], ['recip', 1.5], ['cancel', 1]]);
        c = fam === 'self' ? rng.pick([4, 9, 16, 25]) : fam === 'sq' ? rng.int(2, 9) : fam === 'recip' ? rng.int(2, 9) : rng.int(7, 12);
        dom = fam === 'cancel' ? 'ne' : pickWeighted<Dom>(rng, [['atleast', 1.3], ['noteq', 1], ['nonzero', 1.3], ['neg', 0.8], ['below', 0.7], ['above', 0.7]]);
        if (fam === 'cancel') j = rng.pick([-1, 0, 1]);
      }
      if ((fam === 'self' || fam === 'recip') && dom === 'neg' && d === 3 && rng.chance(0.5)) continue;
      const tF = fam === 'sq' ? F(c) : fam === 'recip' ? F(1, c) : fam === 'self' ? F(Math.round(Math.sqrt(c))) : F(c);
      const t = `${tF.n}/${tF.d}`;
      const [E1, E2] = exprs(fam, c, j);
      const pool = [...GRID, tF, tF.mul(2), tF.div(2), tF.mul(3), tF.div(3)].filter((x, i, a) => a.findIndex((y) => y.eq(x)) === i).sort((a, b) => a.d + Math.abs(a.n) - (b.d + Math.abs(b.n)));
      const allowed = pool.filter((x) => inDom(dom, tF, x) && defined(fam, c, x));
      const rels = allowed.map((x) => (E1(x).gt(E2(x)) ? 'A' : E1(x).lt(E2(x)) ? 'B' : 'C') as QCChoice);
      const set = new Set(rels);
      const rel: QCChoice = set.size > 1 ? 'D' : rels[0];
      // keep the thresholds meaningful: with c = 1 only the 'x^2 vs x' classic
      const swap = rng.chance(0.5);
      const v = rng.pick(['x', 'x', 'y', 't']);
      const answer = swap ? swapQC(rel) : rel;
      const test0 = allowed[0];
      const rel0 = rels[0];
      const trapLetter = swap ? swapQC(rel0) : rel0;
      // two test values to show
      let pair: Frac[];
      if (rel === 'D') {
        const i1 = 0;
        const i2 = rels.findIndex((r) => r !== rels[0]);
        pair = [allowed[i1], allowed[i2]];
      } else {
        const alt = allowed.find((x) => !x.eq(test0) && (x.gt(0) === test0.gt(0)) && Math.abs(x.toNumber()) > 1) ?? allowed[1];
        pair = [test0, alt];
      }
      const cT = num(c);
      const e1: Record<Fam, string> = { sq: `${v}^2`, recip: `\\frac{1}{${v}}`, self: v, cancel: `\\frac{${v}^2 - ${c * c}}{${v} - ${c}}` };
      const e2: Record<Fam, string> = {
        sq: c === 1 ? v : `${cT}${v}`,
        recip: cT,
        self: `\\frac{${cT}}{${v}}`,
        cancel: `${v} + ${c + j}`,
      };
      const diffTex: Record<Fam, string> = {
        sq: c === 1 ? `${v}^2 - ${v} = ${v}(${v} - 1)` : `${v}^2 - ${cT}${v} = ${v}(${v} - ${cT})`,
        recip: `\\frac{1}{${v}} - ${cT} = \\frac{1 - ${cT}${v}}{${v}}`,
        self: `${v} - \\frac{${cT}}{${v}} = \\frac{${v}^2 - ${cT}}{${v}}`,
        cancel: `\\frac{(${v} - ${c})(${v} + ${c})}{${v} - ${c}} = ${v} + ${c}`,
      };
      const first = `Quantity ${swap ? 'B' : 'A'}`;
      const second = `Quantity ${swap ? 'A' : 'B'}`;
      const valsAt = (x: Frac) => `${first} is $${val(E1(x))}$ and ${second} is $${val(E2(x))}$`;
      const signWord =
        rel === 'D' ? 'positive for some allowed values and not positive for others' : rel === 'A' ? 'positive for every allowed value' : rel === 'B' ? 'negative for every allowed value' : 'zero for every allowed value';
      const body =
        fam === 'cancel'
          ? `For $${v}$ different from ${c}, the fraction simplifies: $${diffTex.cancel}$, so ${first} equals $${v} + ${c}$ for every allowed $${v}$. ${second} is $${v} + ${c + j}$, which ${j === 0 ? 'is the same' : `is ${Math.abs(j)} ${j > 0 ? 'more' : 'less'} than ${first}`}.`
          : `Compare $${e1[fam]}$ with $${e2[fam]}$ by subtracting: $${diffTex[fam]}$ is ${signWord}.`;
      const tests = `Check with values: at ${showX(pair[0], v)}, ${valsAt(pair[0])}; at ${showX(pair[1], v)}, ${valsAt(pair[1])}.`;
      const trap =
        trapLetter !== answer
          ? ` Trap: testing only ${showX(test0, v)} points to ${trapLetter}, but one value does not cover the whole range.`
          : '';
      return {
        params: { fam, dom, c, j, t, v, swap },
        q: {
          format: 'qc',
          info: `${domTex(dom, v, tF.toTex())}.`,
          quantityA: `$${swap ? e2[fam] : e1[fam]}$`,
          quantityB: `$${swap ? e1[fam] : e2[fam]}$`,
          answer,
          ...(trapLetter !== answer ? { traps: { [trapLetter]: 'tested-one-value' } } : {}),
          explanation: `Recognize: both quantities depend on $${v}$, so compare them over every allowed value, not just one.

${body} ${tests}${trap}

To compare two expressions in a variable, look at the sign of their difference over the whole allowed range. ${qcEnd(answer)}`,
        },
      };
    }
  },
  check(q, { fam, dom, c, j, t, swap }, rng) {
    const tF = parseT(t);
    const [E1, E2] = exprs(fam, c, j);
    const pairs: [Frac, Frac][] = [];
    const push = (x: Frac) => {
      if (!inDom(dom, tF, x) || !defined(fam, c, x)) return;
      pairs.push(swap ? [E2(x), E1(x)] : [E1(x), E2(x)]);
    };
    for (let k = -400; k <= 400; k++) push(F(k, 16));
    for (let i = 0; i < 60; i++) push(F(rng.int(-300, 300), rng.int(1, 37)));
    push(tF);
    push(tF.add(F(1, 1000)));
    push(tF.sub(F(1, 1000)));
    return expectQC(q, qcFromSamples(pairs));
  },
};

export const fractionsQcTemplates: Template<any>[] = [fractionsQc];
