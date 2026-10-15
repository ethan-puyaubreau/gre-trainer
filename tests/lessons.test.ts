import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LessonView } from '../src/components/LessonView';
import { AREAS, SKILLS } from '../src/content';
import { LESSONS, lessonDue, type Lesson } from '../src/content/lessons';
import { richErrors } from './validate';

/** Every Rich field of a lesson, with a label for error messages. */
const richFields = (l: Lesson): [string, string][] => [
  ['idea', l.idea],
  ['recognize', l.recognize],
  ['problem', l.example.problem],
  ...l.example.steps.map((s, i): [string, string] => [`step ${i + 1}`, s]),
  ['answer', l.example.answer],
];

/** Words as a reader counts them: a `$...$` formula is one word, `\$` is a money sign and not a delimiter. */
const words = (s: string) =>
  s
    .replace(/\\\$/g, '')
    .replace(/\$\$[^$]*\$\$|\$[^$]*\$/g, ' M ')
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w)).length;

const wordCount = (l: Lesson) => richFields(l).reduce((n, [, s]) => n + words(s), 0);

/** A step says why when it states a reason with an explicit connective. A bare "so" only gives a consequence, not a reason. */
const SAYS_WHY = /\b(because|since|therefore|hence|thus|that is why|which is why|this is why)\b/i;

describe('word counter', () => {
  it('counts a formula as one word and a money sign as nothing', () => {
    expect(words('Add $2 \\cdot 3 + x$ now')).toBe(3);
    // The text holds backslash-dollar pairs; the old pattern read "$5 and \$" as one formula.
    expect(words('Pay \\$5 or \\$6')).toBe(4);
    expect(words('It costs \\$5 and \\$1{,}200, so $x$ is $\\frac{1}{2}$.')).toBe(9);
    expect(words('Even $$x^2 = 4$$ counts once')).toBe(4);
  });
});

describe('lessons', () => {
  it('cover every skill and nothing else', () => {
    expect(Object.keys(LESSONS).sort()).toEqual(SKILLS.map((s) => s.id).sort());
  });

  for (const skill of SKILLS) {
    describe(skill.id, () => {
      const l = LESSONS[skill.id];
      if (!l) return it('has a lesson', () => expect(l).toBeDefined());
      const catalog = AREAS.find((a) => a.area === skill.area)!.traps;

      it('names 2-3 distinct traps from its own area catalog', () => {
        expect(l.traps.length).toBeGreaterThanOrEqual(2);
        expect(l.traps.length).toBeLessThanOrEqual(3);
        expect(new Set(l.traps).size).toBe(l.traps.length);
        expect(l.traps.filter((id) => !(id in catalog))).toEqual([]);
      });

      it('has a worked example of 2-4 steps that each say why', () => {
        expect(l.example.steps.length).toBeGreaterThanOrEqual(2);
        expect(l.example.steps.length).toBeLessThanOrEqual(4);
        expect(l.example.steps.filter((s) => !SAYS_WHY.test(s))).toEqual([]);
      });

      it('renders every field with KaTeX', () => {
        const errors = richFields(l).flatMap(([where, s]) => (s.trim() ? richErrors(s, `${skill.id} ${where}`) : [`${skill.id} ${where}: empty`]));
        expect(errors).toEqual([]);
      });

      it('has 100 to 220 words', () => {
        const n = wordCount(l);
        expect(n, `${skill.id}: ${n} words`).toBeGreaterThanOrEqual(100);
        expect(n, `${skill.id}: ${n} words`).toBeLessThanOrEqual(220);
      });
    });
  }
});

describe('lesson screen', () => {
  it('renders the idea, the example and the traps of every skill', () => {
    for (const skill of SKILLS) {
      const html = renderToStaticMarkup(createElement(LessonView, { skillId: skill.id }));
      expect(html, skill.id).toContain('Worked example');
      expect(html, skill.id).toContain('trap-box');
      expect(html, skill.id).not.toContain('katex-error');
    }
  });
});

describe('lessonDue', () => {
  const id = SKILLS[0].id;
  it('is true for an untouched skill whose lesson was not shown', () => {
    expect(lessonDue(id, { level: 0 })).toBe(true);
    expect(lessonDue(id, { enabled: true, level: 0, seen: [] })).toBe(true);
  });
  it('is false once shown, once the skill is started, or when lessons are off', () => {
    expect(lessonDue(id, { level: 0, seen: [id] })).toBe(false);
    expect(lessonDue(id, { level: 1 })).toBe(false);
    expect(lessonDue(id, { enabled: false, level: 0 })).toBe(false);
  });
  it('is false for a skill without a lesson', () => {
    expect(lessonDue('no.such.skill', { level: 0 })).toBe(false);
  });
});
