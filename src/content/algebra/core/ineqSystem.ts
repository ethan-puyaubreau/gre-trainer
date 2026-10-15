import { textChoices } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { lin, num } from '../../../engine/tex';
import type { Choice, Template, Trap } from '../../../engine/types';

/** Solution set of two linear inequalities joined by "and" / "or" (select one). */

type Op = '<' | '<=' | '>' | '>=';
const OP_TEX: Record<Op, string> = { '<': '<', '<=': '\\le', '>': '>', '>=': '\\ge' };
const FLIP: Record<Op, Op> = { '<': '>', '<=': '>=', '>': '<', '>=': '<=' };

interface Ineq {
  a: number;
  b: number;
  c: number;
  op: Op;
}
/** x (dir) v, closed when the sign is non-strict. */
interface HL {
  dir: '<' | '>';
  v: Frac;
  closed: boolean;
}
interface End {
  v: Frac;
  c: boolean;
}
interface Piece {
  lo?: End;
  hi?: End;
}
type PieceData = { lo?: [number, number, boolean]; hi?: [number, number, boolean] };
interface SysParams {
  q: [Ineq, Ineq];
  join: 'and' | 'or';
  sets: PieceData[][];
}

const dirOf = (op: Op): '<' | '>' => (op === '<' || op === '<=' ? '<' : '>');
const closedOf = (op: Op) => op === '<=' || op === '>=';
const ineqTex = (i: Ineq) => `${lin([[i.a, 'x'], [i.b, '']])} ${OP_TEX[i.op]} ${num(i.c)}`;

/** The correct half line: a x + b op c, dividing by a. */
const solve = (i: Ineq): HL => {
  const op = i.a < 0 ? FLIP[i.op] : i.op;
  return { dir: dirOf(op), v: new Frac(i.c - i.b, i.a), closed: closedOf(op) };
};
const unflipped = (i: Ineq): HL => ({ dir: dirOf(i.op), v: new Frac(i.c - i.b, i.a), closed: closedOf(i.op) });

function inter(p: HL, q: HL): Piece[] | null {
  if (p.dir === q.dir) {
    const pick = p.v.eq(q.v) ? { ...p, closed: p.closed && q.closed } : (p.dir === '<' ? p.v.lt(q.v) : p.v.gt(q.v)) ? p : q;
    return [pick.dir === '<' ? { hi: { v: pick.v, c: pick.closed } } : { lo: { v: pick.v, c: pick.closed } }];
  }
  const lo = p.dir === '>' ? p : q;
  const hi = p.dir === '<' ? p : q;
  if (!lo.v.lt(hi.v)) return null;
  return [{ lo: { v: lo.v, c: lo.closed }, hi: { v: hi.v, c: hi.closed } }];
}

function union(p: HL, q: HL): Piece[] | null {
  if (p.dir === q.dir) {
    const pick = p.v.eq(q.v) ? { ...p, closed: p.closed || q.closed } : (p.dir === '<' ? p.v.gt(q.v) : p.v.lt(q.v)) ? p : q;
    return [pick.dir === '<' ? { hi: { v: pick.v, c: pick.closed } } : { lo: { v: pick.v, c: pick.closed } }];
  }
  const lo = p.dir === '>' ? p : q;
  const hi = p.dir === '<' ? p : q;
  if (!hi.v.lt(lo.v)) return null;
  return [{ hi: { v: hi.v, c: hi.closed } }, { lo: { v: lo.v, c: lo.closed } }];
}

const pieceTex = (p: Piece): string => {
  if (p.lo && p.hi) return `${p.lo.v.toTex()} ${p.lo.c ? '\\le' : '<'} x ${p.hi.c ? '\\le' : '<'} ${p.hi.v.toTex()}`;
  if (p.hi) return `x ${p.hi.c ? '\\le' : '<'} ${p.hi.v.toTex()}`;
  return `x ${p.lo!.c ? '\\ge' : '>'} ${p.lo!.v.toTex()}`;
};
const setTex = (s: Piece[]) => `$${s.map(pieceTex).join(' \\text{ or } ')}$`;
const toData = (s: Piece[]): PieceData[] =>
  s.map((p) => ({ ...(p.lo ? { lo: [p.lo.v.n, p.lo.v.d, p.lo.c] as [number, number, boolean] } : {}), ...(p.hi ? { hi: [p.hi.v.n, p.hi.v.d, p.hi.c] as [number, number, boolean] } : {}) }));

const combine = (join: 'and' | 'or', p: HL, q: HL) => (join === 'and' ? inter(p, q) : union(p, q));
const toggle = (s: Piece[]): Piece[] =>
  s.map((p) => ({ ...(p.lo ? { lo: { ...p.lo, c: !p.lo.c } } : {}), ...(p.hi ? { hi: { ...p.hi, c: !p.hi.c } } : {}) }));
const mirror = (h: HL): HL => ({ ...h, dir: h.dir === '<' ? '>' : '<' });

const TRAP_ORDER = ['alg-ineq-sys-noflip', 'alg-ineq-sys-connective', 'alg-ineq-sys-endpoint', 'alg-ineq-sys-no-divide', 'alg-ineq-sys-move-sign', 'alg-ineq-sys-one-only', 'alg-ineq-sys-mirror'];

const systemMCS: Template<SysParams> = {
  id: 'alg.inequalities.system-mcs',
  skill: 'alg.inequalities',
  format: 'mcs',
  style: 'solution set of two inequalities joined by and / or',
  generate(rng, d) {
    for (;;) {
      const mk = (neg: boolean): Ineq => {
        const mag = d === 1 ? rng.int(1, 3) : d === 2 ? rng.int(2, 5) : rng.int(2, 6);
        const a = (neg ? -1 : 1) * mag;
        const b = rng.int(-9, 9);
        const r = rng.int(-9, 9);
        return { a, b, c: a * r + b, op: rng.pick(['<', '<=', '>', '>='] as Op[]) };
      };
      const n1 = d === 1 ? false : rng.chance(0.5);
      const q: [Ineq, Ineq] = [mk(n1), mk(d === 1 ? true : rng.chance(0.6))];
      if (q[0].c === q[1].c) continue;
      const join: 'and' | 'or' = d === 3 ? rng.pick(['and', 'or']) : d === 2 ? rng.pick(['and', 'and', 'or']) : 'and';
      const h1 = solve(q[0]);
      const h2 = solve(q[1]);
      const good = combine(join, h1, h2);
      if (!good) continue;
      const other = join === 'and' ? 'or' : 'and';
      const cand: [string, Piece[] | null][] = [
        ['alg-ineq-sys-noflip', q.some((i) => i.a < 0) ? combine(join, unflipped(q[0]), unflipped(q[1])) : null],
        ['alg-ineq-sys-connective', combine(other, h1, h2)],
        ['alg-ineq-sys-endpoint', toggle(good)],
        ['alg-ineq-sys-no-divide', q.some((i) => Math.abs(i.a) > 1) ? combine(join, { ...h1, v: new Frac(q[0].c - q[0].b) }, { ...h2, v: new Frac(q[1].c - q[1].b) }) : null],
        ['alg-ineq-sys-move-sign', combine(join, { ...h1, v: new Frac(q[0].c + q[0].b, q[0].a) }, { ...h2, v: new Frac(q[1].c + q[1].b, q[1].a) })],
        ['alg-ineq-sys-one-only', [h1.dir === '<' ? { hi: { v: h1.v, c: h1.closed } } : { lo: { v: h1.v, c: h1.closed } }]],
        ['alg-ineq-sys-mirror', combine(join, mirror(h1), mirror(h2))],
      ];
      const goodTex = setTex(good);
      const seen = new Set([goodTex]);
      const wrong: { trap: string; set: Piece[] }[] = [];
      for (const [trap, set] of cand) {
        if (!set) continue;
        const t = setTex(set);
        if (seen.has(t)) continue;
        seen.add(t);
        wrong.push({ trap, set });
      }
      if (wrong.length < 4) continue;
      // keep four traps, dropping at random among the lower-priority ones
      const kept = [...wrong.slice(0, 2), ...rng.sample(wrong.slice(2), 2)].sort((x, y) => TRAP_ORDER.indexOf(x.trap) - TRAP_ORDER.indexOf(y.trap));
      const ch = textChoices(rng, goodTex, kept.map((w): Choice => ({ text: setTex(w.set), trap: w.trap })));
      const sets = ch.choices.map((c) => (c.text === goodTex ? good : kept.find((w) => setTex(w.set) === c.text)!.set));
      const step = (i: Ineq) => `$${ineqTex(i)}$ becomes $x ${OP_TEX[i.a < 0 ? FLIP[i.op] : i.op]} ${new Frac(i.c - i.b, i.a).toTex()}$${i.a < 0 ? ', since dividing by a negative number reverses the sign' : ''}`;
      const cited = kept.find((w) => w.trap === 'alg-ineq-sys-noflip') ?? kept[0];
      const trapText: Record<string, string> = {
        'alg-ineq-sys-noflip': 'dividing by a negative coefficient without reversing the sign turns that inequality around',
        'alg-ineq-sys-connective': `treating "${join}" as "${other}" keeps the wrong part of the two half-lines`,
        'alg-ineq-sys-endpoint': 'closing or opening an end changes whether the endpoint itself belongs',
        'alg-ineq-sys-no-divide': 'forgetting to divide by the coefficient leaves the ends at the wrong places',
        'alg-ineq-sys-move-sign': 'moving the constant across with the wrong sign shifts the ends',
        'alg-ineq-sys-one-only': 'solving only the first inequality ignores the second',
        'alg-ineq-sys-mirror': 'turning both signs around describes the opposite half-lines',
      };
      const explanation = `Solve each inequality alone, then combine: "and" keeps the overlap, "or" keeps everything covered by either.

${step(q[0])}; ${step(q[1])}.

${join === 'and' ? 'Both must hold, so keep the overlap' : 'Either may hold, so keep every value that fits at least one'}: ${goodTex}.

Trap: ${trapText[cited.trap]}. Rule: divide by the coefficient, flip the sign for a negative one, then apply and / or to the solved half-lines.`;
      return {
        q: {
          format: 'mcs',
          stem: `Which of the following is the set of all $x$ for which $${ineqTex(q[0])}$ ${join} $${ineqTex(q[1])}$?`,
          choices: ch.choices,
          answer: ch.answer,
          explanation,
        },
        params: { q, join, sets: sets.map(toData) },
      };
    }
  },
  check(q, { q: ineqs, join, sets }) {
    if (q.format !== 'mcs') return 'wrong format';
    // integer arithmetic on the grid x = k / 12 (every denominator that can occur divides 12)
    const holds = (i: Ineq, k: number) => {
      const l = i.a * k + 12 * i.b;
      const r = 12 * i.c;
      return i.op === '<' ? l < r : i.op === '<=' ? l <= r : i.op === '>' ? l > r : l >= r;
    };
    const inPiece = (p: PieceData, k: number) => {
      if (p.lo) {
        const [n, d, c] = p.lo;
        const l = k * d;
        const r = 12 * n;
        if (c ? l < r : l <= r) return false;
      }
      if (p.hi) {
        const [n, d, c] = p.hi;
        const l = k * d;
        const r = 12 * n;
        if (c ? l > r : l >= r) return false;
      }
      return true;
    };
    const hits: number[] = [];
    sets.forEach((s, idx) => {
      let all = true;
      for (let k = -480; k <= 480 && all; k++) {
        const truth = join === 'and' ? holds(ineqs[0], k) && holds(ineqs[1], k) : holds(ineqs[0], k) || holds(ineqs[1], k);
        if (s.some((p) => inPiece(p, k)) !== truth) all = false;
      }
      if (all) hits.push(idx);
    });
    return hits.length === 1 && hits[0] === q.answer ? null : `matching choices ${hits}, key ${q.answer}`;
  },
};

export const systemTemplates = [systemMCS];

export const systemTraps: Record<string, Trap> = {
  'alg-ineq-sys-noflip': {
    label: 'Did not reverse the sign when dividing by a negative coefficient',
    fix: 'Dividing both sides by a negative number reverses the inequality: $-3x \\ge 12$ gives $x \\le -4$.',
  },
  'alg-ineq-sys-connective': {
    label: 'Swapped "and" with "or"',
    fix: '"And" keeps only the overlap of the two solved half-lines; "or" keeps every value that fits either one.',
  },
  'alg-ineq-sys-endpoint': {
    label: 'Opened or closed an end of the interval by mistake',
    fix: 'The end belongs to the set only when the original sign is $\\le$ or $\\ge$, and dividing by a negative number keeps that.',
  },
  'alg-ineq-sys-no-divide': {
    label: 'Stopped before dividing by the coefficient of $x$',
    fix: 'After isolating $ax$, divide by $a$ to get $x$ itself: $4x < 12$ means $x < 3$, not $x < 12$.',
  },
  'alg-ineq-sys-move-sign': {
    label: 'Moved the constant across with the wrong sign',
    fix: 'Undo $+b$ by subtracting $b$ from both sides: $2x + 3 < 9$ gives $2x < 6$, not $2x < 12$.',
  },
  'alg-ineq-sys-one-only': {
    label: 'Solved only one of the two inequalities',
    fix: 'Both inequalities are part of the question: solve each, then combine them with the connective given.',
  },
  'alg-ineq-sys-mirror': {
    label: 'Reversed the direction of both solved inequalities',
    fix: 'Solve carefully for $x$, and read each result back: test one value from the set in the original inequalities.',
  },
};
