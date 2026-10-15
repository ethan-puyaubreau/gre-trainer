// A generator that finds its parameters degenerate (a named trap equals the right answer, a figure would
// have equal segments...) throws Redraw; `retrying` draws again from the same rng, so a seed stays reproducible.

import type { Frac } from '../../engine/frac';
import type { Template } from '../../engine/types';

export class Redraw extends Error {
  constructor(why = 'redraw') {
    super(why);
  }
}

export function retrying<P>(gen: Template<P>['generate']): Template<P>['generate'] {
  return (rng, d) => {
    for (let i = 0; i < 200; i++) {
      try {
        return gen(rng, d);
      } catch (e) {
        if (!(e instanceof Redraw)) throw e;
      }
    }
    throw new Error('too many redraws');
  };
}

/** Wraps every template of a family so that its generate() redraws on Redraw. */
export function retryAll<T extends Template<any>[]>(ts: T): T {
  return ts.map((t) => ({ ...t, generate: retrying(t.generate) })) as T;
}

/** A trap that equals the answer would be a wrong choice that is right: draw again instead of dropping it. */
export function noClash<T extends { value: Frac }>(traps: T[], answer: Frac): T[] {
  if (traps.some((t) => t.value.eq(answer))) throw new Redraw('a trap equals the answer');
  return traps;
}
