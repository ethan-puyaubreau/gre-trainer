// Seeded PRNG (mulberry32) so every generated question is reproducible from its seed.

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  /** Random element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** New shuffled copy. */
  shuffle<T>(items: readonly T[]): T[];
  /** k distinct elements, in random order. */
  sample<T>(items: readonly T[], k: number): T[];
  /** true with probability p. */
  chance(p: number): boolean;
  /** +1 or -1. */
  sign(): 1 | -1;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => {
    if (max < min) throw new Error(`rng.int: empty range [${min}, ${max}]`);
    return min + Math.floor(next() * (max - min + 1));
  };
  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  return {
    next,
    int,
    pick: <T>(items: readonly T[]) => {
      if (items.length === 0) throw new Error('rng.pick: empty array');
      return items[Math.floor(next() * items.length)];
    },
    shuffle,
    sample: <T>(items: readonly T[], k: number) => {
      if (k > items.length) throw new Error('rng.sample: k larger than array');
      return shuffle(items).slice(0, k);
    },
    chance: (p: number) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
