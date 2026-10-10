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
import { generateBody, rngFor, SEED_POOL } from '../src/engine/generate';
import type { Difficulty } from '../src/engine/types';
import { qKey, questionErrors, richErrors } from './validate';

// More seeds: SEEDS=1000 npm test
const SEEDS = Number(process.env.SEEDS ?? 150);
const ONLY = process.env.ONLY; // substring filter on template ids, for focused runs
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

for (const t of TEMPLATES.filter((t) => !ONLY || t.id.includes(ONLY))) {
  describe(t.id, () => {
    it(`generates valid, verified questions (${SEEDS} seeds x 3 difficulties)`, () => {
      const errors = new Set<string>();
      for (const d of DIFFS) {
        for (let seed = 1; seed <= SEEDS; seed++) {
          let out;
          try {
            out = generateBody(t, seed, d);
          } catch (e) {
            errors.add(`seed ${seed} d${d}: generate threw: ${(e as Error).message}`);
            continue;
          }
          for (const e of questionErrors(out.q, t, TRAPS)) errors.add(`seed ${seed} d${d}: ${e}`);
          let verdict: string | null;
          try {
            verdict = t.check(out.q, out.params, rngFor(t.id + ':check', seed, d));
          } catch (e) {
            verdict = `check threw: ${(e as Error).message}`;
          }
          if (verdict) errors.add(`seed ${seed} d${d}: WRONG ANSWER KEY: ${verdict}`);
          if (errors.size > 20) break;
        }
      }
      expect([...errors].slice(0, 20)).toEqual([]);
    });

    it(`has a verified answer key for every question the app can serve (seeds 1-${SEED_POOL})`, () => {
      // The full validation above covers the first SEEDS seeds; here every remaining seed of the
      // pool is generated and checked (answer key + basic structure, without KaTeX rendering).
      const errors: string[] = [];
      for (const d of DIFFS)
        for (let seed = SEEDS + 1; seed <= SEED_POOL && errors.length < 10; seed++) {
          try {
            const { q, params } = generateBody(t, seed, d);
            if (q.format !== t.format) errors.push(`seed ${seed} d${d}: format`);
            if (q.format === 'mcs' && !(q.answer >= 0 && q.answer < q.choices.length && q.choices.length === 5))
              errors.push(`seed ${seed} d${d}: bad choices`);
            if ((q.format === 'mcs' || q.format === 'mcm') && new Set(q.choices.map((c) => c.text)).size !== q.choices.length)
              errors.push(`seed ${seed} d${d}: duplicate choices`);
            const verdict = t.check(q, params, rngFor(t.id + ':check', seed, d));
            if (verdict) errors.push(`seed ${seed} d${d}: WRONG ANSWER KEY: ${verdict}`);
          } catch (e) {
            errors.push(`seed ${seed} d${d}: threw ${(e as Error).message}`);
          }
        }
      expect(errors).toEqual([]);
    });

    it('is deterministic for a given seed', () => {
      for (const d of DIFFS) for (const seed of [1, 7, 42]) expect(qKey(generateBody(t, seed, d).q)).toBe(qKey(generateBody(t, seed, d).q));
    });

    it('produces varied questions and answers', () => {
      const keys = new Set<string>();
      const answers = new Set<string>();
      for (const d of DIFFS) {
        for (let seed = 1; seed <= Math.min(SEEDS, 80); seed++) {
          const { q } = generateBody(t, seed, d);
          keys.add(qKey(q));
          answers.add(q.format === 'ne' ? q.answer.toString() : JSON.stringify(q.answer));
        }
      }
      expect(keys.size, 'distinct questions').toBeGreaterThanOrEqual(10);
      if (t.format === 'qc' || t.format === 'mcs') expect(answers.size, 'distinct answers / positions').toBeGreaterThanOrEqual(2);
    });

    if (t.format === 'mcs')
      it('spreads the correct answer over positions A to E', () => {
        const counts = [0, 0, 0, 0, 0];
        let n = 0;
        for (const d of DIFFS)
          for (let seed = 1; seed <= 80; seed++) {
            const { q } = generateBody(t, seed, d);
            if (q.format === 'mcs') {
              counts[q.answer]++;
              n++;
            }
          }
        const shares = counts.map((c) => c / n);
        expect(Math.max(...shares), `positions ${counts.join('/')}`).toBeLessThanOrEqual(0.45);
        expect(Math.min(...shares), `positions ${counts.join('/')}`).toBeGreaterThanOrEqual(0.05);
      });
  });
}
