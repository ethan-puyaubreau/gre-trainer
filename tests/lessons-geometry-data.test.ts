import { describe, expect, it } from 'vitest';
import { SKILLS, TRAPS } from '../src/content';
import { dataLessons } from '../src/content/data/lessons';
import { geometryLessons } from '../src/content/geometry/lessons';
import type { Lesson } from '../src/content/lessons';
import { richErrors } from './validate';

const areas = [
  { area: 'geometry', lessons: geometryLessons },
  { area: 'data', lessons: dataLessons },
] as const;

/** Every Rich field of a lesson, with a label for error messages. */
function richFields(id: string, l: Lesson): [string, string][] {
  return [
    [`${id}.idea`, l.idea],
    [`${id}.recognize`, l.recognize],
    [`${id}.problem`, l.example.problem],
    ...l.example.steps.map((s, i): [string, string] => [`${id}.step${i + 1}`, s]),
    [`${id}.answer`, l.example.answer],
  ];
}

/** Words of a lesson; each $...$ formula counts as one word. */
function wordCount(l: Lesson): number {
  return richFields('', l)
    .map(([, s]) => s.replace(/\$[^$]*\$/g, ' M ').split(/\s+/).filter(Boolean).length)
    .reduce((a, b) => a + b, 0);
}

for (const { area, lessons } of areas) {
  describe(`${area} lessons`, () => {
    const skills = SKILLS.filter((s) => s.area === area);

    it('has a lesson for every skill and nothing else', () => {
      expect(skills.length).toBeGreaterThan(0);
      expect(Object.keys(lessons).sort()).toEqual(skills.map((s) => s.id).sort());
    });

    for (const skill of skills) {
      describe(skill.id, () => {
        const l = lessons[skill.id];

        it('names 2-3 distinct traps that exist', () => {
          expect(l.traps.length).toBeGreaterThanOrEqual(2);
          expect(l.traps.length).toBeLessThanOrEqual(3);
          expect(new Set(l.traps).size).toBe(l.traps.length);
          for (const t of l.traps) expect(TRAPS[t], `unknown trap ${t}`).toBeDefined();
        });

        it('renders every Rich field with KaTeX', () => {
          expect(l.example.steps.length).toBeGreaterThanOrEqual(2);
          const errs = richFields(skill.id, l).flatMap(([where, s]) => (s.trim() ? richErrors(s, where) : [`${where}: empty`]));
          expect(errs).toEqual([]);
        });

        it('has 100 to 220 words', () => {
          const n = wordCount(l);
          expect(n, `${skill.id}: ${n} words`).toBeGreaterThanOrEqual(100);
          expect(n, `${skill.id}: ${n} words`).toBeLessThanOrEqual(220);
        });
      });
    }
  });
}
