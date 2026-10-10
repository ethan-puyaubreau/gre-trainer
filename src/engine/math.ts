// Integer helpers shared by generators and by the brute-force checks in tests.

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function lcm(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : Math.abs((a / gcd(a, b)) * b);
}

export function gcdAll(xs: readonly number[]): number {
  return xs.reduce((g, x) => gcd(g, x), 0);
}

export function lcmAll(xs: readonly number[]): number {
  return xs.reduce((l, x) => lcm(l, x), 1);
}

export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
}

export function primesUpTo(n: number): number[] {
  const out: number[] = [];
  for (let i = 2; i <= n; i++) if (isPrime(i)) out.push(i);
  return out;
}

/** Prime factorization as [prime, exponent] pairs, ascending. */
export function factorize(n: number): [number, number][] {
  n = Math.abs(n);
  const out: [number, number][] = [];
  for (let p = 2; p * p <= n; p++) {
    let e = 0;
    while (n % p === 0) {
      n /= p;
      e++;
    }
    if (e) out.push([p, e]);
  }
  if (n > 1) out.push([n, 1]);
  return out;
}

export function divisors(n: number): number[] {
  n = Math.abs(n);
  const small: number[] = [];
  const large: number[] = [];
  for (let i = 1; i * i <= n; i++) {
    if (n % i === 0) {
      small.push(i);
      if (i * i !== n) large.unshift(n / i);
    }
  }
  return [...small, ...large];
}

/** Mathematical modulo: result is always in [0, m). */
export function mod(a: number, m: number): number {
  return ((a % m) + m) % m;
}

export function range(from: number, to: number, step = 1): number[] {
  const out: number[] = [];
  for (let x = from; step > 0 ? x <= to : x >= to; x += step) out.push(x);
  return out;
}

export function sum(xs: readonly number[]): number {
  return xs.reduce((s, x) => s + x, 0);
}

export function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

export function nCr(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  r = Math.min(r, n - r);
  let num = 1;
  for (let i = 0; i < r; i++) num = (num * (n - i)) / (i + 1);
  return Math.round(num);
}

export function nPr(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  let out = 1;
  for (let i = 0; i < r; i++) out *= n - i;
  return out;
}

/** Largest k such that k^2 divides n, i.e. sqrt(n) = k * sqrt(n / k^2). */
export function squareOut(n: number): [number, number] {
  let outside = 1;
  let inside = n;
  for (let p = 2; p * p <= inside; p++) {
    while (inside % (p * p) === 0) {
      inside /= p * p;
      outside *= p;
    }
  }
  return [outside, inside];
}

/** Largest k such that k^3 divides n, i.e. cbrt(n) = k * cbrt(n / k^3). */
export function cubeOut(n: number): [number, number] {
  let outside = 1;
  let inside = n;
  for (let p = 2; p * p * p <= inside; p++) {
    while (inside % (p * p * p) === 0) {
      inside /= p * p * p;
      outside *= p;
    }
  }
  return [outside, inside];
}

export function isPerfectSquare(n: number): boolean {
  if (n < 0) return false;
  const r = Math.round(Math.sqrt(n));
  return r * r === n;
}

export function digitsOf(n: number): number[] {
  return Math.abs(n).toString().split('').map(Number);
}

/** Digits after the decimal point of p/q (p, q positive integers), first `count` of them. */
export function decimalDigits(p: number, q: number, count: number): number[] {
  let r = p % q;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    r *= 10;
    out.push(Math.floor(r / q));
    r %= q;
  }
  return out;
}

/** Population mean / median / standard deviation, for data analysis generators. */
export function mean(xs: readonly number[]): number {
  return sum(xs) / xs.length;
}

export function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function uniqueBy<T>(items: readonly T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((t) => {
    const k = key(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
