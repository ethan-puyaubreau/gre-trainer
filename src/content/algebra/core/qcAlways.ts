import { flaggedChoices } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';

/** Which expressions are greater than a reference for EVERY value in a region (select all). */
type Item =
  | { t: 'pow'; e: number }
  | { t: 'recip' }
  | { t: 'mul'; n: number; d: number }
  | { t: 'add'; c: number }
  | { t: 'sqdiv'; c: number }
  | { t: 'neg' };
interface AlwaysParams {
  ref: 1 | 2;
  /** open region: lo < x < hi (null = unbounded) */
  lo: number | null;
  hi: number | null;
  items: Item[];
}

const tex = (i: Item): string => {
  switch (i.t) {
    case 'pow': return i.e === 1 ? 'x' : `x^{${i.e}}`;
    case 'recip': return '\\frac{1}{x}';
    case 'mul': return i.d === 1 ? `${i.n}x` : `\\frac{x}{${i.d}}`;
    case 'add': return `x ${i.c < 0 ? '-' : '+'} ${Math.abs(i.c)}`;
    case 'sqdiv': return `\\frac{x^2}{${i.c}}`;
    case 'neg': return '-x';
  }
};
const evalF = (i: Item, x: Frac): Frac => {
  switch (i.t) {
    case 'pow': { let r = new Frac(1); for (let k = 0; k < i.e; k++) r = r.mul(x); return r; }
    case 'recip': return new Frac(1).div(x);
    case 'mul': return x.mul(new Frac(i.n, i.d));
    case 'add': return x.add(i.c);
    case 'sqdiv': return x.mul(x).div(i.c);
    case 'neg': return x.neg();
  }
};
const evalN = (i: Item, x: number): number => {
  switch (i.t) {
    case 'pow': return x ** i.e;
    case 'recip': return 1 / x;
    case 'mul': return (x * i.n) / i.d;
    case 'add': return x + i.c;
    case 'sqdiv': return (x * x) / i.c;
    case 'neg': return -x;
  }
};
const refItem = (r: 1 | 2): Item => ({ t: 'pow', e: r });

function regionTex(p: AlwaysParams): string {
  if (p.lo !== null && p.hi !== null) return `${num(p.lo)} < x < ${num(p.hi)}`;
  return p.lo !== null ? `x > ${num(p.lo)}` : `x < ${num(p.hi!)}`;
}

function gridOf(p: AlwaysParams): Frac[] {
  const out: Frac[] = [];
  if (p.lo !== null && p.hi !== null) for (let i = 1; i <= 15; i++) out.push(new Frac(p.lo * 16 + (p.hi - p.lo) * i, 16));
  else for (const s of [new Frac(1, 4), new Frac(1, 2), new Frac(1), new Frac(2), new Frac(5), new Frac(20)]) out.push(p.lo !== null ? s.add(p.lo) : new Frac(p.hi!).sub(s));
  return out.filter((x) => x.n !== 0);
}

type Verdict = 'always' | 'sometimes' | 'never';
const verdict = (it: Item, p: AlwaysParams, pts: Frac[]): { v: Verdict; witness?: Frac } => {
  const ref = refItem(p.ref);
  const bad = pts.filter((x) => !evalF(it, x).gt(evalF(ref, x)));
  if (bad.length === 0) return { v: 'always' };
  return { v: bad.length === pts.length ? 'never' : 'sometimes', witness: bad[0] };
};

const REGIONS_1: [number | null, number | null][] = [[1, null], [0, 1]];
const REGIONS_2: [number | null, number | null][] = [[1, null], [0, 1], [null, -1], [-1, 0], [0, null]];

const alwaysMCM: Template<AlwaysParams> = {
  id: 'alg.qc-algebra.always-greater-mcm',
  skill: 'alg.qc-algebra',
  format: 'mcm',
  style: 'which expressions are greater than x for every x in a region',
  generate(rng, d) {
    for (;;) {
      const ref = rng.pick([1, 1, 2]) as 1 | 2;
      let lo: number | null;
      let hi: number | null;
      let pool: Item[];
      const sgnc = () => rng.pick([-1, 1]) * rng.int(1, 3);
      if (d === 3) {
        const m = rng.int(3, 5);
        [lo, hi] = [m, null];
        pool = [m - 1, m, m + 1, m + 2].map((c) => ({ t: 'sqdiv', c }) as Item).concat([{ t: 'add', c: rng.int(1, 3) }, { t: 'mul', n: rng.int(2, 3), d: 1 }, { t: 'mul', n: 1, d: 2 }, { t: 'recip' }]);
        if (ref === 2) continue;
      } else {
        [lo, hi] = rng.pick(d === 1 ? REGIONS_1 : REGIONS_2);
        pool = [{ t: 'pow', e: 3 }, { t: 'pow', e: 4 }, { t: 'recip' }, { t: 'mul', n: 1, d: 2 }, { t: 'mul', n: rng.int(2, 4), d: 1 }, { t: 'add', c: sgnc() }, { t: 'neg' }, { t: 'sqdiv', c: rng.int(2, 4) }, { t: 'pow', e: ref === 1 ? 2 : 1 }];
        if (ref === 1 && lo !== null && hi === null && lo === 0) continue; // plain x > 0 is covered by x > 1 style regions
      }
      const p: AlwaysParams = { ref, lo, hi, items: [] };
      const pts = gridOf(p);
      const rated = pool.map((it) => ({ it, ...verdict(it, p, pts) }));
      const ok = rng.shuffle(rated.filter((r) => r.v === 'always'));
      const bad = rng.shuffle(rated.filter((r) => r.v !== 'always'));
      const nOk = Math.min(ok.length, rng.int(1, 3));
      if (nOk < 1 || bad.length < 2) continue;
      const sometimes = bad.filter((r) => r.v === 'sometimes');
      const never = bad.filter((r) => r.v === 'never');
      const wrong = [...sometimes.slice(0, 2), ...never.slice(0, 2), ...sometimes.slice(2), ...never.slice(2)].slice(0, 5 - nOk + 1);
      if (nOk + wrong.length < 5) continue;
      const chosen = rng.shuffle([...ok.slice(0, nOk), ...wrong]);
      const fc = flaggedChoices(
        chosen.map((r) => ({
          text: `$${tex(r.it)}$`,
          correct: r.v === 'always',
          ...(r.v === 'always' ? {} : { trap: r.v === 'sometimes' ? 'alg-qcalways-one-value' : 'alg-qcalways-wrong-region' }),
        })),
      );
      const refTex = tex(refItem(p.ref));
      const first = ok[0];
      const w = wrong.find((r) => r.v === 'sometimes') ?? wrong[0];
      const wx = w.witness!;
      const at = (it: Item) => evalF(it, wx).toTex();
      const aTest = pts[Math.floor(pts.length / 2)];
      const explanation = `The question asks for expressions greater than $${refTex}$ at every allowed value, so one counterexample removes a choice.

Try several values in the region, such as $x = ${aTest.toTex()}$ and $x = ${wx.toTex()}$. ${ok.slice(0, nOk).map((r) => `$${tex(r.it)}$`).join(', ')} ${nOk === 1 ? 'stays' : 'stay'} above $${refTex}$ at each tested value, and the other choices fail at least once.

Trap: $${tex(w.it)}$ ${w.v === 'sometimes' ? 'beats' : 'never beats'} $${refTex}$ ${w.v === 'sometimes' ? 'at some values only, but at' : 'here: at'} $x = ${wx.toTex()}$ it is $${at(w.it)}$ against $${evalF(refItem(p.ref), wx).toTex()}$. Rule: "for every value" fails on one counterexample.`;
      void first;
      return {
        q: {
          format: 'mcm',
          stem: `If $${regionTex(p)}$, which of the following expressions are greater than $${refTex}$ for every such value of $x$?`,
          instruction: 'Indicate all such expressions.',
          choices: fc.choices,
          answer: fc.answer,
          explanation,
        },
        params: { ...p, items: chosen.map((r) => r.it) },
      };
    }
  },
  check(q, p, rng) {
    if (q.format !== 'mcm') return 'wrong format';
    if (p.items.some((it, i) => q.choices[i].text !== `$${tex(it)}$`)) return 'choice text mismatch';
    const ref = refItem(p.ref);
    const xs: number[] = [];
    for (let i = 0; i < 400; i++) {
      const u = rng.next() * 0.98 + 0.01;
      xs.push(p.lo !== null && p.hi !== null ? p.lo + u * (p.hi - p.lo) : p.lo !== null ? p.lo + u * u * 40 + 0.001 : p.hi! - u * u * 40 - 0.001);
    }
    const want = p.items.flatMap((it, i) => (xs.every((x) => evalN(it, x) > evalN(ref, x) + 1e-12) ? [i] : []));
    return want.join() === q.answer.join() ? null : `expected ${want}, key ${q.answer}`;
  },
};

export const alwaysTemplates = [alwaysMCM];

export const alwaysTraps: Record<string, Trap> = {
  'alg-qcalways-one-value': {
    label: 'Tested one value and called the expression always greater',
    fix: 'An expression can beat the reference at some allowed values and lose at others. "For every value" needs the whole region: look for the value where the order flips.',
  },
  'alg-qcalways-wrong-region': {
    label: 'Applied the behavior of powers from the wrong region',
    fix: 'On $x > 1$ powers grow, on $0 < x < 1$ they shrink, and for negative $x$ odd and even powers have opposite signs. Check which region the question uses.',
  },
};
