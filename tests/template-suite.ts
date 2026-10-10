import { describe, expect, it } from 'vitest';
import { TRAPS } from '../src/content';
import { generateBody, rngFor, SEED_POOL } from '../src/engine/generate';
import type { Difficulty, Template } from '../src/engine/types';
import { qKey, questionErrors } from './validate';

// More seeds for the full validation: SEEDS=1000 npm test
export const SEEDS = Number(process.env.SEEDS ?? 150);
const ONLY = process.env.ONLY; // substring filter on template ids, for focused runs
const DIFFS: Difficulty[] = [1, 2, 3];
/** Let the worker breathe during long synchronous loops (keeps vitest's RPC responsive). */
const tick = () => new Promise((r) => setTimeout(r, 0));

/** Registers the per-template tests (validation, verified pool, determinism, variety, positions). */
export function templateSuite(templates: Template<any>[]) {
  for (const t of templates.filter((t) => !ONLY || t.id.includes(ONLY))) {
    describe(t.id, () => {
      it(`generates valid, verified questions (${SEEDS} seeds x 3 difficulties)`, async () => {
        const errors = new Set<string>();
        for (const d of DIFFS) {
          for (let seed = 1; seed <= SEEDS; seed++) {
            if (seed % 25 === 0) await tick();
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

      it(`has a verified answer key for every question the app can serve (seeds 1-${SEED_POOL})`, async () => {
        // The full validation above covers the first SEEDS seeds; here every remaining seed of the
        // pool is generated and checked (answer key + basic structure, without KaTeX rendering).
        const errors: string[] = [];
        for (const d of DIFFS)
          for (let seed = SEEDS + 1; seed <= SEED_POOL && errors.length < 10; seed++) {
            if (seed % 50 === 0) await tick();
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
}
