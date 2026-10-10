// Exact rational numbers. Answers are stored as Frac so 2.5, 2.50 and 5/2 all compare equal
// and no floating-point error can leak into an answer key.

function gcdInt(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

function assertSafe(n: number, what: string): void {
  if (!Number.isSafeInteger(n)) throw new Error(`Frac: ${what} is not a safe integer (${n})`);
}

export type FracLike = Frac | number;

export class Frac {
  readonly n: number;
  readonly d: number;

  constructor(n: number, d = 1) {
    assertSafe(n, 'numerator');
    assertSafe(d, 'denominator');
    if (d === 0) throw new Error('Frac: zero denominator');
    if (d < 0) {
      n = -n;
      d = -d;
    }
    const g = gcdInt(n, d) || 1;
    this.n = n / g + 0; // + 0 turns -0 into 0
    this.d = d / g;
  }

  static of(x: FracLike): Frac {
    if (x instanceof Frac) return x;
    if (Number.isInteger(x)) return new Frac(x, 1);
    throw new Error(`Frac.of: non-integer number ${x}; build fractions explicitly`);
  }

  add(o: FracLike): Frac {
    const b = Frac.of(o);
    return new Frac(this.n * b.d + b.n * this.d, this.d * b.d);
  }
  sub(o: FracLike): Frac {
    const b = Frac.of(o);
    return new Frac(this.n * b.d - b.n * this.d, this.d * b.d);
  }
  mul(o: FracLike): Frac {
    const b = Frac.of(o);
    return new Frac(this.n * b.n, this.d * b.d);
  }
  div(o: FracLike): Frac {
    const b = Frac.of(o);
    if (b.n === 0) throw new Error('Frac: division by zero');
    return new Frac(this.n * b.d, this.d * b.n);
  }
  neg(): Frac {
    return new Frac(-this.n, this.d);
  }
  abs(): Frac {
    return new Frac(Math.abs(this.n), this.d);
  }
  inv(): Frac {
    return new Frac(this.d, this.n);
  }
  pow(k: number): Frac {
    if (!Number.isInteger(k)) throw new Error('Frac.pow: integer exponents only');
    if (k < 0) return this.inv().pow(-k);
    let r = new Frac(1);
    for (let i = 0; i < k; i++) r = r.mul(this);
    return r;
  }
  cmp(o: FracLike): -1 | 0 | 1 {
    const b = Frac.of(o);
    const l = this.n * b.d;
    const r = b.n * this.d;
    return l < r ? -1 : l > r ? 1 : 0;
  }
  eq(o: FracLike): boolean {
    return this.cmp(o) === 0;
  }
  lt(o: FracLike): boolean {
    return this.cmp(o) < 0;
  }
  gt(o: FracLike): boolean {
    return this.cmp(o) > 0;
  }
  lte(o: FracLike): boolean {
    return this.cmp(o) <= 0;
  }
  gte(o: FracLike): boolean {
    return this.cmp(o) >= 0;
  }
  isInt(): boolean {
    return this.d === 1;
  }
  sign(): -1 | 0 | 1 {
    return this.n < 0 ? -1 : this.n > 0 ? 1 : 0;
  }
  valueOf(): number {
    return this.n / this.d;
  }
  toNumber(): number {
    return this.n / this.d;
  }

  /** True when the decimal expansion terminates. */
  isTerminating(): boolean {
    let d = this.d;
    while (d % 2 === 0) d /= 2;
    while (d % 5 === 0) d /= 5;
    return d === 1;
  }

  /** Exact decimal string if terminating, e.g. 0.918; otherwise throws. */
  toDecimalString(): string {
    if (!this.isTerminating()) throw new Error(`Frac ${this.toString()} has no terminating decimal`);
    const neg = this.n < 0;
    let n = Math.abs(this.n);
    const whole = Math.floor(n / this.d);
    n = n % this.d;
    let digits = '';
    while (n !== 0) {
      n *= 10;
      digits += Math.floor(n / this.d).toString();
      n %= this.d;
    }
    return (neg ? '-' : '') + whole.toString() + (digits ? '.' + digits : '');
  }

  /** "3/4", "-2", ... */
  toString(): string {
    return this.d === 1 ? `${this.n}` : `${this.n}/${this.d}`;
  }

  /** TeX: \frac{3}{4}, -\frac{1}{2}, 5. */
  toTex(opts: { dfrac?: boolean } = {}): string {
    if (this.d === 1) return fmtInt(this.n);
    const f = opts.dfrac ? '\\dfrac' : '\\frac';
    const s = this.n < 0 ? '-' : '';
    return `${s}${f}{${fmtInt(Math.abs(this.n))}}{${fmtInt(this.d)}}`;
  }
}

export const frac = (n: number, d = 1) => new Frac(n, d);

/** Integer with thousands separators, as the GRE prints them: 12,000. Inside TeX use {,}. */
export function fmtInt(n: number, tex = true): string {
  const s = Math.abs(n).toString();
  if (Math.abs(n) < 1000) return (n < 0 ? '-' : '') + s;
  const sep = tex ? '{,}' : ',';
  const parts: string[] = [];
  for (let i = s.length; i > 0; i -= 3) parts.unshift(s.slice(Math.max(0, i - 3), i));
  return (n < 0 ? '-' : '') + parts.join(sep);
}

/** Integer with thousands separators for plain text (not TeX). */
export function fmtNum(n: number): string {
  if (Number.isInteger(n)) return fmtInt(n, false);
  return n.toString();
}

/** Normalise the unicode minus and drop thousands commas; null if a comma is anywhere else. */
function stripThousands(raw: string): string | null {
  const s = raw.trim().replace(/−/g, '-');
  if (!s.includes(',')) return s;
  return /^-?\d{1,3}(,\d{3})+(\.\d*)?$/.test(s) ? s.replace(/,/g, '') : null;
}

/**
 * Parse a numeric-entry string the way the GRE accepts it: integers, decimals,
 * negative numbers, thousands separators. Returns null on anything else.
 */
export function parseDecimal(raw: string): Frac | null {
  const s = stripThousands(raw);
  if (s === null || !/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const neg = s.startsWith('-');
  const body = neg ? s.slice(1) : s;
  const [intPart, decPart = ''] = body.split('.');
  if (decPart.length > 12 || intPart.length > 12) return null;
  const n = Number((intPart || '0') + decPart);
  const d = 10 ** decPart.length;
  return new Frac(neg ? -n : n, d);
}

/** Parse an integer box (used for fraction numerator/denominator boxes). No decimal point allowed. */
export function parseIntBox(raw: string): number | null {
  const s = stripThousands(raw);
  if (s === null || !/^-?\d{1,12}$/.test(s)) return null;
  return Number(s);
}
