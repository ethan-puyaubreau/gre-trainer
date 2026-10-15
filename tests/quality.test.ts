import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { skillById, TEMPLATES } from '../src/content';
import { frac } from '../src/engine/frac';
import type { Area, QuestionBody, Template } from '../src/engine/types';
import { artifactHits, choiceValue, citedTrapValues, GATES, labelLength, templateGateFailures } from './quality';

// Content quality gates (rules in quality.ts). A template may break a rule only while the rule is
// listed for it in tests/quality-allow/<area>.json as { "<template id>": { "<gate>": "<reason>" } }.
// An entry whose rule now passes fails the test too, so the allowlists only shrink.
// Focused run: ONLY=arith.cycles npx vitest run tests/quality.test.ts

const ONLY = process.env.ONLY;
const AREAS: Area[] = ['arithmetic', 'algebra', 'geometry', 'data'];
const areaOf = (t: Template<any>) => skillById.get(t.skill)?.area;

describe('quality gate matchers', () => {
  const hits = (stem: string) => [...artifactHits({ format: 'ne', stem, answer: frac(2), explanation: '' } as QuestionBody).keys()];

  it('flag artifacts and leave clean text alone', () => {
    expect(hits('$1x + 3$')).toEqual(['artifacts.coef-1']);
    expect(hits('$0.1y + 21z + x_1y + x^{12} + 2^{-1} + 5 - (-3)$')).toEqual([]);
    expect(hits('$\\frac{3}{1}$')).toEqual(['artifacts.frac-1']);
    expect(hits('$x^{1}$')).toEqual(['artifacts.exp-1']);
    expect(hits('$5 - -3$')).toEqual(['artifacts.sign']);
    expect(hits('after $1$ years')).toEqual(['artifacts.plural-1']);
    expect(hits('a depth of 1 feet')).toEqual(['artifacts.plural-1']);
    expect(hits('1 people')).toEqual(['artifacts.plural-1']);
    expect(hits('1 is odd, 1 has one divisor, 11 years, \\$1 bills')).toEqual([]);
    expect(hits('the the end. So The answer')).toEqual(['artifacts.doubled-word', 'artifacts.so-the']);
  });

  it('read choice values, segment labels and cited trap results', () => {
    expect(choiceValue('0.5')!.eq(choiceValue('$\\frac{1}{2}$')!)).toBe(true);
    expect(choiceValue('$-2\\frac{1}{3}$')!.eq(frac(-7, 3))).toBe(true);
    expect(choiceValue('\\$1{,}250')!.eq(1250)).toBe(true);
    expect(choiceValue('$2x$')).toBeNull();
    expect(labelLength('$4\\sqrt{3}$')).toBeCloseTo(4 * Math.sqrt(3));
    expect(labelLength('$x$')).toBeNull();
    expect(citedTrapValues('Adding the counts ($20$) is wrong. It gives $5$.').map(String)).toEqual(['20']);
  });
});

for (const area of AREAS) {
  const file = `quality-allow/${area}.json`;
  const allow: Record<string, Record<string, string>> = JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
  const templates = TEMPLATES.filter((t) => areaOf(t) === area);

  describe(`quality gates: ${area}`, () => {
    it(`${file} lists templates of this area and known gates, each with a reason`, () => {
      const ids = new Set(templates.map((t) => t.id));
      const errors = Object.entries(allow).flatMap(([id, gates]) => [
        ...(ids.has(id) ? [] : [`${id}: not a template of this area`]),
        ...Object.entries(gates).flatMap(([g, reason]) => [
          ...((GATES as readonly string[]).includes(g) ? [] : [`${id}: unknown gate ${g}`]),
          ...(typeof reason === 'string' && reason.trim() ? [] : [`${id}: ${g} needs a reason`]),
        ]),
      ]);
      expect(errors).toEqual([]);
    });

    for (const t of templates.filter((t) => !ONLY || t.id.includes(ONLY)))
      it(t.id, () => {
        const fails: Map<string, string> = templateGateFailures(t);
        const allowed = allow[t.id] ?? {};
        const problems = [
          ...[...fails].filter(([g]) => !(g in allowed)).map(([g, msg]) => `${g}: ${msg}`),
          ...Object.keys(allowed)
            .filter((g) => !fails.has(g))
            .map((g) => `${g} passes now: remove it from ${file}`),
        ];
        expect(problems).toEqual([]);
      });
  });
}
