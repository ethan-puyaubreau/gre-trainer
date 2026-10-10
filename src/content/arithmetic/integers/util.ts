// Helpers shared by the integer templates. Everything here is independent of the formulas the
// generators use, so check() functions can rely on it to re-derive answers another way.

import { Frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import type { Choice, QCChoice, QuestionBody } from '../../../engine/types';

export const QC_WORDS: Record<QCChoice, string> = {
  A: 'Quantity A is greater',
  B: 'Quantity B is greater',
  C: 'the two quantities are equal',
  D: 'the relationship cannot be determined',
};

/** Primality table by the sieve of Eratosthenes (checks use it instead of trial division). */
export function sieve(n: number): boolean[] {
  const ok = Array.from({ length: n + 1 }, (_, i) => i >= 2);
  for (let i = 2; i * i <= n; i++) if (ok[i]) for (let j = i * i; j <= n; j += i) ok[j] = false;
  return ok;
}

const SIEVE = sieve(5000);
/** Primality by table lookup (n <= 5000). */
export function primeBySieve(n: number): boolean {
  if (n > 5000) throw new Error(`primeBySieve: ${n} too large`);
  return n >= 0 && SIEVE[n];
}

/** Count divisors by testing every candidate (slow, independent of the (a+1)(b+1) formula). */
export function countDivisorsBrute(n: number): number {
  let c = 0;
  for (let i = 1; i <= n; i++) if (n % i === 0) c++;
  return c;
}

/** Smallest prime factor of n >= 2, by trial division. */
export function smallestFactor(n: number): number {
  for (let p = 2; p * p <= n; p++) if (n % p === 0) return p;
  return n;
}

/** "27 = 3 \cdot 9" style reason why an odd composite is not prime (TeX). */
export function compositeReason(n: number): string {
  const p = smallestFactor(n);
  return `${n} = ${p} \\cdot ${n / p}`;
}

/** Product of prime powers in TeX: [[2,3],[5,1]] -> "2^{3} \cdot 5". */
export function factorTex(f: [number, number][]): string {
  return f.map(([p, e]) => (e === 1 ? `${p}` : `${p}^{${e}}`)).join(' \\cdot ');
}

/* ---------------------------------------------------------------------------------------------
 * A tiny arithmetic parser over plain strings: numbers, + - * / ^, unary minus, parentheses.
 * Correct precedence: ^ (right associative) > unary minus > * / > + -, so "-3^2" is -9.
 * Two "mistaken" modes reproduce classic student errors for trap values:
 *  - unaryTight: the minus sign binds before the exponent ("-3^2" read as 9),
 *  - flat: + - * / evaluated strictly left to right (no precedence between them).
 * ------------------------------------------------------------------------------------------- */
export interface ParseMode {
  unaryTight?: boolean;
  flat?: boolean;
}

export function evalExpr(src: string, mode: ParseMode = {}): Frac {
  const s = src.replace(/\s+/g, '');
  let i = 0;
  const peek = () => s[i];
  const eat = (c: string) => {
    if (s[i] !== c) throw new Error(`evalExpr: expected "${c}" at ${i} in "${src}"`);
    i++;
  };
  const number = (): Frac => {
    const m = /^\d+/.exec(s.slice(i));
    if (!m) throw new Error(`evalExpr: number expected at ${i} in "${src}"`);
    i += m[0].length;
    return new Frac(Number(m[0]));
  };
  const atom = (): Frac => {
    if (peek() === '(') {
      eat('(');
      const v = expr();
      eat(')');
      return v;
    }
    if (mode.unaryTight && peek() === '-') {
      eat('-');
      return atom().neg();
    }
    return number();
  };
  const power = (): Frac => {
    const base = atom();
    if (peek() === '^') {
      eat('^');
      const e = unary();
      if (!e.isInt()) throw new Error('evalExpr: non-integer exponent');
      return base.pow(e.n);
    }
    return base;
  };
  const unary = (): Frac => {
    if (peek() === '-') {
      if (mode.unaryTight) return power();
      eat('-');
      return unary().neg();
    }
    if (peek() === '+') {
      eat('+');
      return unary();
    }
    return power();
  };
  const apply = (op: string, a: Frac, b: Frac) => (op === '+' ? a.add(b) : op === '-' ? a.sub(b) : op === '*' ? a.mul(b) : a.div(b));
  const term = (): Frac => {
    let v = unary();
    while (peek() === '*' || peek() === '/') {
      const op = s[i++];
      v = apply(op, v, unary());
    }
    return v;
  };
  const expr = (): Frac => {
    if (mode.flat) {
      let v = unary();
      while (peek() && '+-*/'.includes(peek())) {
        const op = s[i++];
        v = apply(op, v, unary());
      }
      return v;
    }
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const op = s[i++];
      v = apply(op, v, term());
    }
    return v;
  };
  const v = expr();
  if (i !== s.length) throw new Error(`evalExpr: trailing input at ${i} in "${src}"`);
  return v;
}

/** Substitute variable values into a plain expression. With parens=false a negative value is pasted bare (the classic slip). */
export function substitute(plain: string, vars: Record<string, number>, parens = true): string {
  return plain.replace(/[a-z]/g, (v) => {
    if (!(v in vars)) throw new Error(`substitute: unknown variable ${v}`);
    const x = vars[v];
    return x < 0 && parens ? `(${x})` : `${x}`;
  });
}

/* ---------------------------------------------------------------------------------------------
 * Small helpers for check() functions.
 * ------------------------------------------------------------------------------------------- */

export function expectQc(q: QuestionBody, expected: QCChoice): string | null {
  if (q.format !== 'qc') return 'wrong format';
  return q.answer === expected ? null : `expected ${expected}, got ${q.answer}`;
}

export function expectNe(q: QuestionBody, expected: Frac | number): string | null {
  if (q.format !== 'ne') return 'wrong format';
  return q.answer.eq(expected) ? null : `expected ${expected.toString()}, got ${q.answer.toString()}`;
}

/** MCS: exactly one choice must match `isCorrect`, and it must be the keyed one. */
export function expectMcsBy(q: QuestionBody, isCorrect: (i: number) => boolean): string | null {
  if (q.format !== 'mcs') return 'wrong format';
  const ok = q.choices.map((_, i) => i).filter(isCorrect);
  if (ok.length !== 1) return `${ok.length} choices are correct (${ok.join(',')})`;
  return ok[0] === q.answer ? null : `answer should be choice ${ok[0]}, key says ${q.answer}`;
}

export function expectMcm(q: QuestionBody, expected: number[]): string | null {
  if (q.format !== 'mcm') return 'wrong format';
  if (!expected.length) return 'no correct choice';
  return JSON.stringify(expected) === JSON.stringify(q.answer) ? null : `expected [${expected}], got [${q.answer}]`;
}

/** Join items as "a, b and c". */
export function listAnd(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * TeX for a plain expression: "3*x^2-(y+1)*(y-1)" -> "3x^{2} - (y + 1)(y - 1)".
 * '*' becomes juxtaposition, or \cdot between two numbers; '/' becomes \div; binary + and - get spaces.
 */
export function plainToTex(plain: string): string {
  const s = plain.replace(/\s+/g, '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const prev = s[i - 1];
    if (c === '*') {
      out += /\d/.test(s[i + 1]) ? ' \\cdot ' : '';
      continue;
    }
    if (c === '/') {
      out += ' \\div ';
      continue;
    }
    if (c === '^') {
      const m = /^(-?\d+|[a-z])/.exec(s.slice(i + 1));
      if (!m) throw new Error(`plainToTex: bad exponent in ${plain}`);
      out += `^{${m[0]}}`;
      i += m[0].length;
      continue;
    }
    if ((c === '+' || c === '-') && prev !== undefined && /[\da-z)]/.test(prev)) {
      out += ` ${c} `;
      continue;
    }
    out += c;
  }
  return out;
}

/**
 * Numeric choices (ascending) with the correct answer at a random feasible position: picks how many
 * wrong values go below and above the answer, preferring candidates tagged with a trap.
 */
export function spreadChoices(
  rng: Rng,
  correct: number,
  cands: { v: number; trap?: string }[],
  format: (v: number) => string = (v) => `$${v}$`,
  count = 5,
): { choices: Choice[]; answer: number } {
  const seen = new Set<number>([correct]);
  const uniq: { v: number; trap?: string }[] = [];
  for (const c of cands) {
    if (!Number.isFinite(c.v) || seen.has(c.v)) continue;
    seen.add(c.v);
    uniq.push(c);
  }
  const below = uniq.filter((c) => c.v < correct);
  const above = uniq.filter((c) => c.v > correct);
  const need = count - 1;
  const feasible: number[] = [];
  for (let k = 0; k <= need; k++) if (below.length >= k && above.length >= need - k) feasible.push(k);
  if (!feasible.length) throw new Error(`spreadChoices: not enough candidates around ${correct}`);
  const k = rng.pick(feasible);
  const side = (xs: { v: number; trap?: string }[], n: number) => [...rng.shuffle(xs.filter((c) => c.trap)), ...rng.shuffle(xs.filter((c) => !c.trap))].slice(0, n);
  const items = [{ v: correct, ok: true as boolean, trap: undefined as string | undefined }, ...[...side(below, k), ...side(above, need - k)].map((c) => ({ v: c.v, ok: false, trap: c.trap }))].sort(
    (a, b) => a.v - b.v,
  );
  return {
    choices: items.map((it) => ({ text: format(it.v), ...(it.trap ? { trap: it.trap } : {}) })),
    answer: items.findIndex((it) => it.ok),
  };
}
