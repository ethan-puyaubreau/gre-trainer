import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../src/content';
import { Frac } from '../src/engine/frac';
import { generateBody, rngFor } from '../src/engine/generate';
import type { QuestionBody } from '../src/engine/types';

// Sanity check of the checks themselves: a corrupted answer key must be rejected.
function corrupt(q: QuestionBody): QuestionBody {
  switch (q.format) {
    case 'qc':
      return { ...q, answer: q.answer === 'A' ? 'B' : 'A' };
    case 'mcs':
      return { ...q, answer: (q.answer + 1) % q.choices.length };
    case 'mcm': {
      const flip = q.answer.includes(0) ? q.answer.filter((i) => i !== 0) : [0, ...q.answer];
      return { ...q, answer: flip.length ? flip : [1] };
    }
    case 'ne':
      return { ...q, answer: q.answer.add(new Frac(1, 1)) };
  }
}

describe('checks reject wrong answer keys', () => {
  for (const t of TEMPLATES) {
    it(t.id, () => {
      let rejected = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const { q, params } = generateBody(t, seed, 2);
        if (t.check(corrupt(q), params, rngFor(t.id + ':check', seed, 2)) !== null) rejected++;
      }
      expect(rejected).toBe(30);
    });
  }
});
