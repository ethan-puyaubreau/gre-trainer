// Text helpers that keep generated wording free of artifacts such as "1 years", "1x" or "5 - -3".

import { Frac } from './frac';
import { num, plain } from './tex';

/** Count with its noun, plain text: plural(1, 'year') -> "1 year", plural(3, 'foot', 'feet') -> "3 feet". */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${plain(n)} ${Math.abs(n) === 1 ? singular : pluralForm}`;
}

/** Coefficient times a variable, TeX: term(1, 'x') -> "x", term(-1, 'x') -> "-x", term(frac(1, 2), 'x') -> "\frac{1}{2}x", "" for 0. */
export function term(coef: number | Frac, variable: string): string {
  const c = Number(coef);
  if (c === 0) return '';
  if (variable && Math.abs(c) === 1) return c < 0 ? `-${variable}` : variable;
  return num(coef) + variable;
}

/** "a - b" in TeX with the sign folded: minus('x', 3) -> "x - 3", minus('x', -3) -> "x + 3", minus('x', 0) -> "x". */
export function minus(a: string, b: number | Frac): string {
  const v = Number(b);
  if (v === 0) return a;
  return `${a} ${v < 0 ? '+' : '-'} ${num(b instanceof Frac ? b.abs() : Math.abs(b))}`;
}
