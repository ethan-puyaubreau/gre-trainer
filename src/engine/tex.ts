// Small TeX formatting helpers for generators. All return TeX meant to go INSIDE $...$,
// except usd() which works both inside and outside math.

import { Frac, fmtInt, type FracLike } from './frac';

/** Number to TeX: integers get thousands separators, Fracs become \frac, other numbers print as decimals. */
export function num(x: FracLike | number): string {
  if (x instanceof Frac) return x.toTex();
  if (Number.isInteger(x)) return fmtInt(x);
  return decimal(x);
}

/** Decimal TeX for a JS number or terminating Frac: 1234.5 -> 1{,}234.5 */
export function decimal(x: FracLike | number, places?: number): string {
  let s: string;
  if (x instanceof Frac) s = x.toDecimalString();
  else s = places === undefined ? stripFloat(x) : x.toFixed(places);
  if (places !== undefined && x instanceof Frac) s = x.toNumber().toFixed(places);
  const neg = s.startsWith('-');
  const [i, d] = (neg ? s.slice(1) : s).split('.');
  return (neg ? '-' : '') + fmtInt(Number(i)) + (d ? '.' + d : '');
}

function stripFloat(x: number): string {
  // 0.1 + 0.2 style noise -> round to 10 significant decimals
  return Number(x.toFixed(10)).toString();
}

/** Fraction TeX with optional display style. */
export function fr(n: number, d: number, display = false): string {
  return new Frac(n, d).toTex({ dfrac: display });
}

/** Money: usd(18) -> "\$18", usd(18, 2) -> "\$18.00", usd(1250) -> "\$1,250". Safe in and out of math. */
export function usd(x: number, places?: number): string {
  const neg = x < 0;
  const abs = Math.abs(x);
  const s = places === undefined ? stripFloat(abs) : abs.toFixed(places);
  const [i, d] = s.split('.');
  const body = Number(i).toLocaleString('en-US') + (d ? '.' + d : '');
  return (neg ? '-' : '') + '\\$' + body;
}

/** Plain-text number with commas (outside math): 12000 -> "12,000". */
export function plain(x: number): string {
  if (Number.isInteger(x)) return x.toLocaleString('en-US');
  return stripFloat(x);
}

export function sqrt(radicand: string | number, index = 2): string {
  const r = typeof radicand === 'number' ? num(radicand) : radicand;
  return index === 2 ? `\\sqrt{${r}}` : `\\sqrt[${index}]{${r}}`;
}

/**
 * Polynomial / linear expression from coefficients, highest power first.
 * poly([3, -2, 1], 'x') -> "3x^{2} - 2x + 1"; zero terms are skipped; coefficient 1 is hidden.
 */
export function poly(coefs: (number | Frac)[], v = 'x'): string {
  const deg = coefs.length - 1;
  const parts: string[] = [];
  coefs.forEach((c0, i) => {
    const c = c0 instanceof Frac ? c0 : new Frac(c0);
    if (c.n === 0) return;
    const p = deg - i;
    const neg = c.n < 0;
    const a = c.abs();
    const varPart = p === 0 ? '' : p === 1 ? v : `${v}^{${p}}`;
    const coefPart = p !== 0 && a.eq(1) ? '' : a.toTex();
    const term = coefPart + varPart;
    if (parts.length === 0) parts.push((neg ? '-' : '') + term);
    else parts.push((neg ? ' - ' : ' + ') + term);
  });
  return parts.length ? parts.join('') : '0';
}

/** Linear combination of named terms: lin([[2,'x'],[-3,'y'],[5,'']]) -> "2x - 3y + 5". */
export function lin(terms: [number | Frac, string][]): string {
  const parts: string[] = [];
  for (const [c0, v] of terms) {
    const c = c0 instanceof Frac ? c0 : new Frac(c0);
    if (c.n === 0) continue;
    const neg = c.n < 0;
    const a = c.abs();
    const coef = v && a.eq(1) ? '' : a.toTex();
    const term = coef + v;
    if (parts.length === 0) parts.push((neg ? '-' : '') + term);
    else parts.push((neg ? ' - ' : ' + ') + term);
  }
  return parts.length ? parts.join('') : '0';
}

/** Wrap a negative number in parentheses for substitution: paren(-3) -> "(-3)". */
export function paren(x: number | Frac): string {
  const t = num(x);
  return (x instanceof Frac ? x.n < 0 : x < 0) ? `(${t})` : t;
}

/** Ordinal in plain text: 1 -> "1st", 22 -> "22nd", 40 -> "40th". */
export function ordinal(n: number): string {
  const s = n % 100;
  if (s >= 11 && s <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

/** Clock time in plain text from minutes after midnight: 630 -> "10:30 in the morning". */
export function clock(minutes: number, style: 'gre' | 'short' = 'gre'): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const hm = `${h12}:${m.toString().padStart(2, '0')}`;
  if (style === 'short') return `${hm} ${h24 < 12 ? 'a.m.' : 'p.m.'}`;
  if (h24 === 12 && m === 0) return '12:00 noon';
  if (h24 < 12) return `${hm} in the morning`;
  if (h24 < 18) return `${hm} in the afternoon`;
  return `${hm} in the evening`;
}
