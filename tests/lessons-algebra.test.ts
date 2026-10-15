import { describe, expect, it } from 'vitest';
import { TRAPS } from '../src/content';
import { algebra } from '../src/content/algebra';
import { algebraLessons } from '../src/content/algebra/lessons';
import { richErrors } from './validate';

/** Words of a Rich string, counting each $...$ formula as one word. */
const words = (s: string) =>
  s
    .replace(/\$[^$]*\$/g, ' M ')
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w)).length;

describe('algebra lessons', () => {
  it('covers every algebra skill and nothing else', () => {
    expect(Object.keys(algebraLessons).sort()).toEqual(algebra.skills.map((s) => s.id).sort());
  });

  for (const s of algebra.skills) {
    describe(s.id, () => {
      const l = algebraLessons[s.id];
      const fields: [string, string][] = [
        ['idea', l.idea],
        ['recognize', l.recognize],
        ['problem', l.example.problem],
        ...l.example.steps.map((t, i): [string, string] => [`step ${i + 1}`, t]),
        ['answer', l.example.answer],
      ];

      it('names 2-3 existing algebra traps', () => {
        expect(l.traps.length).toBeGreaterThanOrEqual(2);
        expect(l.traps.length).toBeLessThanOrEqual(3);
        expect(new Set(l.traps).size).toBe(l.traps.length);
        for (const id of l.traps) {
          expect(TRAPS[id], id).toBeDefined();
          expect(algebra.traps[id], id).toBeDefined();
        }
      });

      it('renders every Rich field with KaTeX', () => {
        expect(fields.flatMap(([where, t]) => richErrors(t, `${s.id} ${where}`))).toEqual([]);
      });

      it('explains every step and stays between 100 and 220 words', () => {
        for (const t of l.example.steps) expect(t).toMatch(/because/);
        const n = fields.reduce((sum, [, t]) => sum + words(t), 0);
        expect(n, `${s.id}: ${n} words`).toBeGreaterThanOrEqual(100);
        expect(n, `${s.id}: ${n} words`).toBeLessThanOrEqual(220);
      });
    });
  }
});
