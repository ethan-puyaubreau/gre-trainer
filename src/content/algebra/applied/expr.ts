// A tiny expression tree for answer choices that are algebraic expressions. The same tree gives
// the TeX shown to the student and the value used by check(), so a choice can never display one
// thing and be graded as another.

import { Frac, frac } from '../../../engine/frac';
import { decimal, num } from '../../../engine/tex';

export type E =
  | { k: 'v'; name: string }
  | { k: 'n'; v: Frac; dec?: boolean }
  | { k: 'add'; a: E; b: E }
  | { k: 'sub'; a: E; b: E }
  | { k: 'mul'; a: E; b: E }
  | { k: 'div'; a: E; b: E };

export const V = (name: string): E => ({ k: 'v', name });
export const N = (v: Frac | number, dec = false): E => ({ k: 'n', v: v instanceof Frac ? v : frac(v), dec });
export const add = (a: E, b: E): E => ({ k: 'add', a, b });
export const subE = (a: E, b: E): E => ({ k: 'sub', a, b });
export const mul = (a: E, b: E): E => ({ k: 'mul', a, b });
export const div = (a: E, b: E): E => ({ k: 'div', a, b });

const isNum = (e: E): e is { k: 'n'; v: Frac; dec?: boolean } => e.k === 'n';
const isSum = (e: E) => e.k === 'add' || e.k === 'sub';

function numTex(e: { v: Frac; dec?: boolean }): string {
  return e.dec && e.v.isTerminating() ? decimal(e.v) : num(e.v);
}

/** TeX of an expression (inline style). */
export function tex(e: E): string {
  switch (e.k) {
    case 'v':
      return e.name;
    case 'n':
      return numTex(e);
    case 'add': {
      if (isNum(e.b) && e.b.v.sign() < 0) return `${tex(e.a)} - ${numTex({ v: e.b.v.neg(), dec: e.b.dec })}`;
      return `${tex(e.a)} + ${tex(e.b)}`;
    }
    case 'sub':
      return `${tex(e.a)} - ${isSum(e.b) ? `(${tex(e.b)})` : tex(e.b)}`;
    case 'mul': {
      const left = isNum(e.a) ? (e.a.v.eq(1) ? '' : e.a.v.eq(-1) ? '-' : numTex(e.a)) : isSum(e.a) ? `(${tex(e.a)})` : tex(e.a);
      if (e.b.k === 'v') return `${left}${e.b.name}`;
      if (isSum(e.b)) return `${left}(${tex(e.b)})`;
      if (e.b.k === 'mul' && isNum(e.b.a)) return `${left}\\left(${tex(e.b)}\\right)`;
      if (e.b.k === 'div') return `${left}${tex(e.b)}`;
      if (isNum(e.b)) return `${left} \\cdot ${tex(e.b)}`;
      return `${left}${tex(e.b)}`;
    }
    case 'div':
      return `\\dfrac{${tex(e.a)}}{${tex(e.b)}}`;
  }
}

/** Exact value for the given variable values. */
export function evalE(e: E, vars: Record<string, Frac>): Frac {
  switch (e.k) {
    case 'v': {
      const v = vars[e.name];
      if (!v) throw new Error(`evalE: no value for ${e.name}`);
      return v;
    }
    case 'n':
      return e.v;
    case 'add':
      return evalE(e.a, vars).add(evalE(e.b, vars));
    case 'sub':
      return evalE(e.a, vars).sub(evalE(e.b, vars));
    case 'mul':
      return evalE(e.a, vars).mul(evalE(e.b, vars));
    case 'div':
      return evalE(e.a, vars).div(evalE(e.b, vars));
  }
}
