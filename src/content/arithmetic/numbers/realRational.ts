import { textChoices } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import type { Template, Trap } from '../../../engine/types';

export const realRationalTraps: Record<string, Trap> = {
  'num-root-sign-irrational': {
    label: 'Called a number irrational because it has a root sign',
    fix: 'Simplify first. $\\sqrt{49} = 7$, $\\sqrt[3]{27} = 3$ and $(5\\sqrt{2})^2 = 50$ are all rational. A root is irrational only when the radicand is not a perfect power.',
  },
  'num-product-of-roots-irrational': {
    label: 'Called a product of roots irrational without multiplying',
    fix: '$\\sqrt{a}\\cdot\\sqrt{b} = \\sqrt{ab}$. Check whether $ab$ is a perfect square: $\\sqrt{8}\\cdot\\sqrt{2} = \\sqrt{16} = 4$.',
  },
  'num-conjugate-product-irrational': {
    label: 'Missed that a conjugate product loses its root',
    fix: '$(p + \\sqrt{r})(p - \\sqrt{r}) = p^2 - r$: the middle terms cancel, so the result is rational.',
  },
  'num-irrational-sum-irrational': {
    label: 'Called a sum of irrationals irrational',
    fix: 'Irrational parts can cancel: $(3 + \\sqrt{2}) + (5 - \\sqrt{2}) = 8$. Combine the like radicals before deciding.',
  },
  'num-repeating-decimal-irrational': {
    label: 'Called a repeating decimal irrational',
    fix: 'A decimal that repeats forever is a fraction: $0.\\overline{3} = \\frac{1}{3}$. Only decimals with no repeating pattern are irrational.',
  },
  'num-nonsquare-root-rational': {
    label: 'Treated a root of a non-perfect power as rational',
    fix: '$\\sqrt{n}$ is rational only if $n$ is a perfect square ($\\sqrt[3]{n}$: a perfect cube). Otherwise it never ends or repeats.',
  },
  'num-product-always-rational': {
    label: 'Assumed a product of two roots is rational',
    fix: '$\\sqrt{a}\\cdot\\sqrt{b} = \\sqrt{ab}$, which is rational only when $ab$ is a perfect square. $\\sqrt{2}\\cdot\\sqrt{3} = \\sqrt{6}$ is irrational.',
  },
  'num-irrational-sum-rational': {
    label: 'Assumed a sum of two unlike roots is rational',
    fix: 'Unlike radicals cannot cancel. $\\sqrt{2} + \\sqrt{3}$ stays irrational, so there is no way to write it as a fraction.',
  },
  'num-rational-with-irrational': {
    label: 'Assumed a rational number combined with a root is rational',
    fix: 'A nonzero rational times an irrational, or a rational plus an irrational, is irrational: $3 + \\sqrt{2}$ and $2\\sqrt{5}$ never end or repeat.',
  },
  'num-square-removes-root': {
    label: 'Assumed squaring always removes the root',
    fix: 'Expand first: $(1 + \\sqrt{3})^2 = 4 + 2\\sqrt{3}$ still has a root. Only $(\\sqrt{r})^2$ alone becomes $r$.',
  },
  'num-pi-fraction-rational': {
    label: 'Called a number with $\\pi$ rational because it is a fraction',
    fix: '$\\pi$ is irrational, and a nonzero rational multiple of $\\pi$, or $\\pi$ plus a rational, is irrational too.',
  },
};

/** A number as a product of sums of c*sqrt(n) terms, or a cube root, or a known constant. */
type Spec = { kind: 'surd'; factors: [number, number][][] } | { kind: 'cube'; n: number } | { kind: 'const'; rational: boolean };
interface Item {
  tex: string;
  rational: boolean;
  trap: string;
  spec: Spec;
  why: string;
}
interface Params {
  items: { tex: string; spec: Spec }[];
  ask: 'rational' | 'irrational';
}

const SQFREE = [2, 3, 5, 6, 7, 10, 11, 13];
const PERFECT_SQ = new Set(Array.from({ length: 12 }, (_, i) => (i + 1) ** 2));
const sqrtTex = (n: number) => `\\sqrt{${n}}`;
const surd = (factors: [number, number][][]): Spec => ({ kind: 'surd', factors });

/* rational-looking builders */
const rSq = (rng: Rng): Item => {
  const k = rng.int(2, 15);
  return { tex: sqrtTex(k * k), rational: true, trap: 'num-root-sign-irrational', spec: surd([[[1, k * k]]]), why: `$\\sqrt{${k * k}} = ${k}$` };
};
const rCube = (rng: Rng): Item => {
  const k = rng.int(2, 7);
  return { tex: `\\sqrt[3]{${k ** 3}}`, rational: true, trap: 'num-root-sign-irrational', spec: { kind: 'cube', n: k ** 3 }, why: `$\\sqrt[3]{${k ** 3}} = ${k}$` };
};
const rProd = (rng: Rng): Item => {
  const r = rng.pick(SQFREE);
  const [m, n] = rng.sample([1, 2, 3, 4, 5], 2);
  const a = r * m * m;
  const b = r * n * n;
  return {
    tex: `${sqrtTex(a)} \\cdot ${sqrtTex(b)}`,
    rational: true,
    trap: 'num-product-of-roots-irrational',
    spec: surd([[[1, a]], [[1, b]]]),
    why: `$\\sqrt{${a}}\\cdot\\sqrt{${b}} = \\sqrt{${a * b}} = ${r * m * n}$`,
  };
};
const rSelf = (rng: Rng): Item => {
  const p = rng.int(2, 5);
  const r = rng.pick([2, 3, 5, 7]);
  return { tex: `\\left(${p}\\sqrt{${r}}\\right)^2`, rational: true, trap: 'num-root-sign-irrational', spec: surd([[[p, r]], [[p, r]]]), why: `$(${p}\\sqrt{${r}})^2 = ${p * p * r}$` };
};
const rConj = (rng: Rng): Item => {
  const p = rng.int(2, 6);
  const r = rng.pick([2, 3, 5, 7, 11]);
  return {
    tex: `\\left(${p} + \\sqrt{${r}}\\right)\\left(${p} - \\sqrt{${r}}\\right)`,
    rational: true,
    trap: 'num-conjugate-product-irrational',
    spec: surd([[[p, 1], [1, r]], [[p, 1], [-1, r]]]),
    why: `$(${p} + \\sqrt{${r}})(${p} - \\sqrt{${r}}) = ${p * p} - ${r} = ${p * p - r}$`,
  };
};
const rCancel = (rng: Rng): Item => {
  const p = rng.int(2, 8);
  const q = rng.int(2, 8);
  const r = rng.pick([2, 3, 5, 7, 11]);
  return {
    tex: `\\left(${p} + \\sqrt{${r}}\\right) + \\left(${q} - \\sqrt{${r}}\\right)`,
    rational: true,
    trap: 'num-irrational-sum-irrational',
    spec: surd([[[p, 1], [1, r], [q, 1], [-1, r]]]),
    why: `the $\\sqrt{${r}}$ terms cancel, leaving $${p} + ${q} = ${p + q}$`,
  };
};
const REPEATING: [string, number, number][] = [
  ['0.\\overline{3}', 1, 3],
  ['0.\\overline{6}', 2, 3],
  ['0.\\overline{27}', 3, 11],
  ['0.\\overline{45}', 5, 11],
  ['0.\\overline{81}', 9, 11],
  ['1.\\overline{4}', 13, 9],
  ['0.2\\overline{3}', 7, 30],
];
const rRepeat = (rng: Rng): Item => {
  const [tex, n, d] = rng.pick(REPEATING);
  return { tex, rational: true, trap: 'num-repeating-decimal-irrational', spec: { kind: 'const', rational: true }, why: `$${tex} = \\frac{${n}}{${d}}$` };
};

/* irrational builders */
const nonSquare = (rng: Rng, hi = 60) => {
  let n = rng.int(2, hi);
  while (PERFECT_SQ.has(n)) n = rng.int(2, hi);
  return n;
};
const iSq = (rng: Rng): Item => {
  const n = nonSquare(rng);
  return { tex: sqrtTex(n), rational: false, trap: 'num-nonsquare-root-rational', spec: surd([[[1, n]]]), why: `$\\sqrt{${n}}$: ${n} is not a perfect square` };
};
const iCube = (rng: Rng): Item => {
  let n = rng.int(2, 60);
  while ([8, 27].includes(n)) n = rng.int(2, 60);
  return { tex: `\\sqrt[3]{${n}}`, rational: false, trap: 'num-nonsquare-root-rational', spec: { kind: 'cube', n }, why: `$\\sqrt[3]{${n}}$: ${n} is not a perfect cube` };
};
const iProd = (rng: Rng): Item => {
  const [a, b] = rng.sample([2, 3, 5, 6, 7, 10, 11, 14, 15], 2);
  return {
    tex: `${sqrtTex(a)} \\cdot ${sqrtTex(b)}`,
    rational: false,
    trap: 'num-product-always-rational',
    spec: surd([[[1, a]], [[1, b]]]),
    why: `$\\sqrt{${a}}\\cdot\\sqrt{${b}} = \\sqrt{${a * b}}$, not a perfect square`,
  };
};
const iSum = (rng: Rng): Item => {
  const [a, b] = rng.sample([2, 3, 5, 6, 7, 10, 11], 2);
  return { tex: `${sqrtTex(a)} + ${sqrtTex(b)}`, rational: false, trap: 'num-irrational-sum-rational', spec: surd([[[1, a], [1, b]]]), why: `$\\sqrt{${a}} + \\sqrt{${b}}$: unlike roots cannot cancel` };
};
const iMixed = (rng: Rng): Item => {
  const p = rng.int(2, 9);
  const r = rng.pick([2, 3, 5, 6, 7, 10]);
  return rng.chance(0.5)
    ? { tex: `${p} + \\sqrt{${r}}`, rational: false, trap: 'num-rational-with-irrational', spec: surd([[[p, 1], [1, r]]]), why: `$${p} + \\sqrt{${r}}$: rational plus irrational` }
    : { tex: `${p}\\sqrt{${r}}`, rational: false, trap: 'num-rational-with-irrational', spec: surd([[[p, r]]]), why: `$${p}\\sqrt{${r}}$: nonzero rational times irrational` };
};
const iSquareSum = (rng: Rng): Item => {
  const r = rng.pick([2, 3, 5, 6, 7]);
  return {
    tex: `\\left(1 + \\sqrt{${r}}\\right)^2`,
    rational: false,
    trap: 'num-square-removes-root',
    spec: surd([[[1, 1], [1, r]], [[1, 1], [1, r]]]),
    why: `$(1 + \\sqrt{${r}})^2 = ${1 + r} + 2\\sqrt{${r}}$`,
  };
};
const PI_FORMS = ['\\frac{\\pi}{2}', '3\\pi', '\\pi - 3', '\\frac{\\pi}{4}', '2\\pi + 1', '5\\pi'];
const iPi = (rng: Rng): Item => {
  const tex = rng.pick(PI_FORMS);
  return { tex, rational: false, trap: 'num-pi-fraction-rational', spec: { kind: 'const', rational: false }, why: `$${tex}$ contains $\\pi$` };
};

/* exact test, independent of the builders: expand and reduce every radical to square-free form */
function squareFree(n: number): [number, number] {
  let out = 1;
  let rest = n;
  for (let f = 2; f * f <= rest; f++) while (rest % (f * f) === 0) ((rest /= f * f), (out *= f));
  return [out, rest];
}
function isRational(spec: Spec): boolean {
  if (spec.kind === 'const') return spec.rational;
  if (spec.kind === 'cube') return Number.isInteger(Math.round(Math.cbrt(spec.n))) && Math.round(Math.cbrt(spec.n)) ** 3 === spec.n;
  let acc = new Map<number, Frac>([[1, new Frac(1)]]);
  for (const sum of spec.factors) {
    const next = new Map<number, Frac>();
    for (const [k, v] of acc)
      for (const [c, n] of sum) {
        const [out, sf] = squareFree(k * n);
        next.set(sf, (next.get(sf) ?? new Frac(0)).add(v.mul(c * out)));
      }
    acc = next;
  }
  return [...acc].every(([k, v]) => k === 1 || v.eq(0));
}

const pickKinds = (rng: Rng, pool: ((rng: Rng) => Item)[], n: number, minKinds: number): Item[] => {
  for (;;) {
    const items = Array.from({ length: n }, () => rng.pick(pool)(rng));
    const texts = new Set(items.map((i) => i.tex));
    const kinds = new Set(items.map((i) => i.trap + i.tex.replace(/[0-9]/g, '')));
    if (texts.size === n && kinds.size >= minKinds) return items;
  }
};

const rationalSets: Template<Params> = {
  id: 'arith.real-numbers.rational-irrational',
  skill: 'arith.real-numbers',
  format: 'mcs',
  style: 'which number is rational (or irrational): simplify the roots first',
  generate(rng, d) {
    const ask = rng.pick(['rational', 'irrational'] as const);
    const R = d === 1 ? [rSq] : d === 2 ? [rSq, rCube, rProd, rSelf] : [rProd, rSelf, rConj, rCancel, rRepeat, rCube];
    const I = d === 1 ? [iSq] : d === 2 ? [iSq, iCube, iProd, iMixed] : [iProd, iSum, iSquareSum, iPi, iCube, iMixed];
    const minKinds = d === 1 ? 1 : d === 2 ? 3 : 4;
    const one = ask === 'rational' ? pickKinds(rng, R, 1, 1) : pickKinds(rng, I, 1, 1);
    const rest = pickKinds(rng, ask === 'rational' ? I : R, 4, Math.min(minKinds, 4));
    const all = [...one, ...rest];
    if (new Set(all.map((i) => i.tex)).size < 5) return rationalSets.generate(rng, d);
    const { choices, answer } = textChoices(
      rng,
      `$${one[0].tex}$`,
      rest.map((i) => ({ text: `$${i.tex}$`, trap: i.trap })),
    );
    const byText = new Map(all.map((i) => [`$${i.tex}$`, i]));
    const ordered = choices.map((c) => byText.get(c.text)!);
    const lines = ordered.map((i) => `- ${i.why}: ${i.rational ? 'rational' : 'irrational'}`).join('\n');
    return {
      params: { items: ordered.map((i) => ({ tex: i.tex, spec: i.spec })), ask },
      q: {
        format: 'mcs',
        stem: `Which of the following numbers is ${ask}?`,
        choices,
        answer,
        explanation: `Decide each number by simplifying it, not by how it looks.

${lines}

Only $${one[0].tex}$ is ${ask}.

Rule: a root is rational only when its radicand is a perfect power, and roots can cancel or multiply into a whole number.`,
      },
    };
  },
  check(q, { items, ask }) {
    if (q.format !== 'mcs') return 'wrong format';
    const hits = items.map((it, i) => [i, isRational(it.spec) === (ask === 'rational')] as const).filter(([, ok]) => ok);
    if (hits.length !== 1) return `${hits.length} choices are ${ask}`;
    return hits[0][0] === q.answer ? null : `answer should be ${hits[0][0]}`;
  },
};

export const realRationalTemplates = [rationalSets];
