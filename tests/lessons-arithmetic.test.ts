import { describe, expect, it } from 'vitest';
import { TRAPS } from '../src/content';
import { arithmetic } from '../src/content/arithmetic';
import { arithmeticLessons } from '../src/content/arithmetic/lessons';
import type { Lesson } from '../src/content/lessons';
import { richErrors } from './validate';

/** Every Rich field of a lesson, with a label for error messages. */
const richFields = (l: Lesson): [string, string][] => [
  ['idea', l.idea],
  ['recognize', l.recognize],
  ['example.problem', l.example.problem],
  ...l.example.steps.map((s, i): [string, string] => [`example.steps[${i}]`, s]),
  ['example.answer', l.example.answer],
];

/** Words as a reader counts them: TeX commands and bare operators are not words, `$` delimiters are dropped. */
const wordCount = (l: Lesson) =>
  richFields(l)
    .map(([, s]) => s.replace(/\$([^$]*)\$/g, (_, m: string) => ` ${m.replace(/\\[a-zA-Z]+/g, ' ')} `))
    .join(' ')
    .split(/\s+/)
    .filter((t) => /[A-Za-z0-9]/.test(t)).length;

describe('arithmetic lessons', () => {
  it('has no lesson for an unknown skill', () => {
    const ids = new Set(arithmetic.skills.map((s) => s.id));
    expect(Object.keys(arithmeticLessons).filter((id) => !ids.has(id))).toEqual([]);
  });

  for (const skill of arithmetic.skills) {
    describe(skill.id, () => {
      const lesson = arithmeticLessons[skill.id];

      it('has a lesson', () => {
        expect(lesson, `no lesson for ${skill.id}`).toBeDefined();
      });
      if (!lesson) return;

      it('names 2-3 distinct trap ids that exist', () => {
        expect(lesson.traps.length).toBeGreaterThanOrEqual(2);
        expect(lesson.traps.length).toBeLessThanOrEqual(3);
        expect(new Set(lesson.traps).size).toBe(lesson.traps.length);
        expect(lesson.traps.filter((t) => !(t in TRAPS))).toEqual([]);
      });

      it('renders every Rich field with KaTeX', () => {
        const errors = richFields(lesson).flatMap(([where, s]) => richErrors(s, `${skill.id}.${where}`));
        expect(errors).toEqual([]);
      });

      it('has a worked example with 2-4 steps', () => {
        expect(lesson.example.steps.length).toBeGreaterThanOrEqual(2);
        expect(lesson.example.steps.length).toBeLessThanOrEqual(4);
      });

      it('is 100-220 words long', () => {
        const n = wordCount(lesson);
        expect(n, `${skill.id}: ${n} words`).toBeGreaterThanOrEqual(100);
        expect(n, `${skill.id}: ${n} words`).toBeLessThanOrEqual(220);
      });
    });
  }
});
