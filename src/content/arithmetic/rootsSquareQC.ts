import { qcFromSamples } from '../../engine/build';
import type { QCChoice, QCQuestion, Template, Trap } from '../../engine/types';

export const rootsSquareTraps: Record<string, Trap> = {
  'root-square-is-base': {
    label: '$\\sqrt{u^2} = u$',
    fix: 'A square root is never negative, so $\\sqrt{u^2} = |u|$. It equals $u$ only when $u \\ge 0$: $\\sqrt{(-3)^2} = 3$, not $-3$.',
  },
};

interface Params {
  v: string;
  a: number;
  lo: number | null;
  hi: number | null;
  loC: boolean;
  hiC: boolean;
  s: 1 | -1;
}

const lin = (v: string, a: number) => `${v} ${a > 0 ? '-' : '+'} ${Math.abs(a)}`;
const rel = (r: string, closed: boolean) => (r === '>' ? (closed ? '\\ge' : '>') : closed ? '\\le' : '<');

function infoTex(p: Params): string {
  const { v, lo, hi, loC, hiC } = p;
  if (lo !== null && hi !== null) return `${lo} ${loC ? '\\le' : '<'} ${v} ${hiC ? '\\le' : '<'} ${hi}`;
  if (lo !== null) return `${v} ${rel('>', loC)} ${lo}`;
  return `${v} ${rel('<', hiC)} ${hi}`;
}

/** Answer when Quantity A is sqrt((x-a)^2) and Quantity B is s(x-a), from the shape of the allowed set. */
function answerOf(p: Params): QCChoice {
  const { a, lo, hi, loC, hiC, s } = p;
  if (s === 1) {
    if (lo !== null && lo >= a) return 'C'; // x - a >= 0 everywhere
    if (hi !== null && (hi < a || (hi === a && !hiC))) return 'A'; // x - a < 0 everywhere
    return 'D';
  }
  if (hi !== null && hi <= a) return 'C'; // x - a <= 0 everywhere
  if (lo !== null && (lo > a || (lo === a && !loC))) return 'A'; // x - a > 0 everywhere
  return 'D';
}

const inSet = (x: number, p: Params) => (p.lo === null || (p.loC ? x >= p.lo : x > p.lo)) && (p.hi === null || (p.hiC ? x <= p.hi : x < p.hi));

const sample = (p: Params) => {
  const xs: number[] = [];
  for (let k = -80; k <= 80; k++) if (inSet(k / 2, p)) xs.push(k / 2);
  return xs;
};
const valA = (x: number, a: number) => Math.sqrt(x * x - 2 * a * x + a * a);

const squareRootQC: Template<Params> = {
  id: 'arith.roots.square-root-sign-qc',
  skill: 'arith.roots',
  format: 'qc',
  style: 'the root of a square is an absolute value',
  generate(rng, d) {
    const v = rng.pick(['x', 'y', 't', 'n']);
    const s = rng.sign();
    const nz = (lowest: number, highest: number) => {
      let n = 0;
      while (n === 0) n = rng.int(lowest, highest);
      return n;
    };
    let p: Params;
    if (d === 1) {
      const c = nz(-9, 9);
      const up = rng.chance(0.5);
      const closed = rng.chance(0.5);
      p = { v, a: c, lo: up ? c : null, hi: up ? null : c, loC: closed, hiC: closed, s };
    } else if (d === 2) {
      const c = rng.int(-8, 8);
      const up = rng.chance(0.5);
      const closed = rng.chance(0.4);
      const k = rng.int(1, 6);
      // a on the side where the ray never reaches it most of the time; otherwise the ray crosses a
      const crosses = rng.chance(0.3);
      const a = c + (up === crosses ? 1 : -1) * k;
      if (a === 0) return squareRootQC.generate(rng, d);
      p = { v, a, lo: up ? c : null, hi: up ? null : c, loC: closed, hiC: closed, s };
    } else {
      const c1 = rng.int(-8, 5);
      const c2 = c1 + rng.int(2, 6);
      const a = rng.int(c1 - 4, c2 + 4);
      if (a === 0) return squareRootQC.generate(rng, d);
      p = { v, a, lo: c1, hi: c2, loC: rng.chance(0.4), hiC: rng.chance(0.4), s };
    }
    const answer = answerOf(p);
    if (d === 2 && answer === 'D' && rng.chance(0.4)) return squareRootQC.generate(rng, d);
    const xs = sample(p);
    const relAt = (x: number): QCChoice => {
      const A = valA(x, p.a);
      const B = p.s * (x - p.a);
      return Math.abs(A - B) < 1e-9 ? 'C' : A > B ? 'A' : 'B';
    };
    const inner = lin(v, p.a);
    const A0 = d === 3 ? `\\sqrt{${v}^2 ${p.a > 0 ? '-' : '+'} ${2 * Math.abs(p.a)}${v} + ${p.a * p.a}}` : `\\sqrt{(${inner})^2}`;
    const B0 = p.s === 1 ? inner : `${p.a} - ${v}`;
    const swap = rng.chance(0.5);
    const [qa, qb] = swap ? [B0, A0] : [A0, B0];
    const ans: QCChoice = swap && answer !== 'C' && answer !== 'D' ? (answer === 'A' ? 'B' : 'A') : answer;
    const trap = p.s === 1 && answer !== 'C' ? { C: 'root-square-is-base' } : undefined;
    const cond = `$${infoTex(p)}$`;
    let work: string;
    if (answer === 'D') {
      const first = xs.find((x) => relAt(x) === 'C');
      const second = xs.find((x) => relAt(x) !== 'C');
      const show = (x: number) => `for $${v} = ${x}$, Quantity ${swap ? 'B' : 'A'} is $${valA(x, p.a)}$ and Quantity ${swap ? 'A' : 'B'} is $${p.s * (x - p.a)}$`;
      work = `The sign of $${inner}$ changes inside the allowed values, so test both sides: ${show(first!)}; ${show(second!)}. Two different relations, so it cannot be determined.`;
    } else if (answer === 'C') {
      work = `On the allowed values $${inner}$ is ${p.s === 1 ? 'never negative' : 'never positive'}, so $|${inner}| = ${p.s === 1 ? inner : `${p.a} - ${v}`}$ and the quantities are equal.`;
    } else {
      work = `On the allowed values $${inner}$ is ${p.s === 1 ? 'negative' : 'positive'}, so $|${inner}|$ is positive while ${p.s === 1 ? `$${inner}$` : `$${p.a} - ${v}$`} is negative, and the root is greater.`;
    }
    const q: QCQuestion = {
      format: 'qc',
      info: cond,
      quantityA: `$${qa}$`,
      quantityB: `$${qb}$`,
      answer: ans,
      ...(trap ? { traps: trap } : {}),
      explanation: `A root of a square is an absolute value: ${d === 3 ? `$${v}^2 ${p.a > 0 ? '-' : '+'} ${2 * Math.abs(p.a)}${v} + ${p.a * p.a} = (${inner})^2$, and ` : ''}$\\sqrt{(${inner})^2} = |${inner}|$, which equals $${inner}$ only when $${inner} \\ge 0$.

${work[0].toUpperCase() + work.slice(1)}

Trap: dropping the absolute value and reading the root as $${inner}$ hides the negative case. The root of a square is never negative.`,
    };
    return { q, params: p };
  },
  check(q, p) {
    if (q.format !== 'qc') return 'wrong format';
    const swap = q.quantityA.includes('\\sqrt') === false;
    const raw = qcFromSamples(sample(p).map((x) => [valA(x, p.a), p.s * (x - p.a)] as [number, number]));
    const want: QCChoice = swap && (raw === 'A' || raw === 'B') ? (raw === 'A' ? 'B' : 'A') : raw;
    return q.answer === want ? null : `expected ${want}`;
  },
};

export const rootsSquareTemplates = [squareRootQC];
