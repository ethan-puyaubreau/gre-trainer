import { describe, expect, it } from 'vitest';
import { AREAS, SKILLS, TEMPLATES, TRAPS } from '../src/content';
import { arithmeticTraps } from '../src/content/arithmetic/traps';
import { integersTraps } from '../src/content/arithmetic/integers';
import { numbersTraps } from '../src/content/arithmetic/numbers';
import { appliedTraps } from '../src/content/algebra/applied';
import { coreTraps } from '../src/content/algebra/core';
import { probTraps } from '../src/content/data/prob';
import { statsTraps } from '../src/content/data/stats';
import { measureTraps } from '../src/content/geometry/measure';
import { shapesTraps } from '../src/content/geometry/shapes';
import { generateBody } from '../src/engine/generate';
import type { Difficulty } from '../src/engine/types';
import { richErrors } from './validate';

const DIFFS: Difficulty[] = [1, 2, 3];

describe('registry', () => {
  it('has unique template ids', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('has unique skill ids and every template points to an existing skill', () => {
    const ids = SKILLS.map((s) => s.id);
    expect(ids.length).toBe(new Set(ids).size);
    const known = new Set(ids);
    for (const t of TEMPLATES) expect(known.has(t.skill), `${t.id} -> ${t.skill}`).toBe(true);
  });

  it('gives every skill at least 3 question styles', () => {
    const thin = SKILLS.filter((s) => TEMPLATES.filter((t) => t.skill === s.id).length < 3).map((s) => s.id);
    expect(thin).toEqual([]);
  });

  it('has valid rich text in strategy cards and traps', () => {
    const errs = [
      ...SKILLS.flatMap((s) => richErrors(s.strategy, `${s.id}.strategy`)),
      ...Object.entries(TRAPS).flatMap(([id, t]) => [...richErrors(t.label, `trap ${id}.label`), ...richErrors(t.fix, `trap ${id}.fix`)]),
    ];
    expect(errs).toEqual([]);
  });

  it('has no trap id defined twice', () => {
    const maps = [arithmeticTraps, integersTraps, numbersTraps, coreTraps, appliedTraps, shapesTraps, measureTraps, statsTraps, probTraps];
    const seen = new Map<string, number>();
    for (const m of maps) for (const id of Object.keys(m)) seen.set(id, (seen.get(id) ?? 0) + 1);
    expect([...seen].filter(([, n]) => n > 1).map(([id]) => id)).toEqual([]);
  });

  it('gives every template of a data interpretation family the same figure for a seed', () => {
    const families = new Map<string, typeof TEMPLATES>();
    for (const t of TEMPLATES) if (t.set) families.set(t.set, [...(families.get(t.set) ?? []), t]);
    for (const [name, ts] of families) {
      expect(ts.length, `family ${name} needs at least 2 templates`).toBeGreaterThanOrEqual(2);
      for (const d of DIFFS)
        for (let seed = 1; seed <= 40; seed++) {
          const figs = ts.map((t) => JSON.stringify(generateBody(t, seed, d).q.figure ?? null));
          expect(new Set(figs).size, `family ${name} seed ${seed} d${d}`).toBe(1);
          expect(figs[0], `family ${name} has no figure`).not.toBe('null');
        }
    }
  });

  it('keeps each area self-consistent', () => {
    for (const a of AREAS) for (const s of a.skills) expect(s.area).toBe(a.area);
  });
});
