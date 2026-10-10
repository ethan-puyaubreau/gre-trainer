import { describe, expect, it } from 'vitest';
import { AREAS, SKILLS, TEMPLATES, TRAPS } from '../src/content';
import { arithmeticTraps } from '../src/content/arithmetic/traps';
import { integersTraps } from '../src/content/arithmetic/integers';
import { numbersTraps } from '../src/content/arithmetic/numbers';
import { generateBody, rngFor } from '../src/engine/generate';
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
    const maps = [arithmeticTraps, integersTraps, numbersTraps, ...AREAS.filter((a) => a.area !== 'arithmetic').map((a) => a.traps)];
    const seen = new Map<string, number>();
    for (const m of maps) for (const id of Object.keys(m)) seen.set(id, (seen.get(id) ?? 0) + 1);
    expect([...seen].filter(([, n]) => n > 1).map(([id]) => id)).toEqual([]);
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
  });
}
