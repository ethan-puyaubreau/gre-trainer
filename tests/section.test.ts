import { describe, expect, it } from 'vitest';
import { AREAS } from '../src/content';
import { createRng } from '../src/engine/rng';
import type { Area } from '../src/engine/types';
import { buildSection } from '../src/mastery/section';

const areas = AREAS.filter((a) => a.templates.length).map((a) => a.area) as Area[];

describe('section builder', () => {
  it('builds sections of the official sizes with QC questions first', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const [n, minutes, formats] of [
        [12, 21, { qc: 4, mcs: 5, mcm: 1, ne: 2 }],
        [15, 26, { qc: 5, mcs: 6, mcm: 2, ne: 2 }],
      ] as const) {
        const { questions, sets } = buildSection(createRng(seed), { questions: n, minutes, formats }, 'medium', areas);
        expect(questions).toHaveLength(n);
        const regular = questions.slice(0, sets.length ? sets[0][0] : n);
        const firstNonQc = regular.findIndex((q) => q.format !== 'qc');
        if (firstNonQc >= 0) expect(regular.slice(firstNonQc).every((q) => q.format !== 'qc')).toBe(true);
        for (const [a, b] of sets) {
          expect(b).toBe(n - 1);
          const figs = questions.slice(a, b + 1).map((q) => JSON.stringify(q.figure));
          expect(new Set(figs).size).toBe(1);
        }
      }
    }
  });
});
