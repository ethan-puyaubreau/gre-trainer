import { describe, expect, it } from 'vitest';
import { newSkillState } from '../src/mastery/model';
import { dropWeakFlags } from '../src/store/migrate';
import { initialData } from '../src/store/progress';

describe('progress migration', () => {
  it('starts from zero: no skill is pre-flagged', () => {
    expect(initialData().skills).toEqual({});
  });

  it('removes unanswered flagged skills and keeps the answered ones without the flag', () => {
    const data = initialData();
    data.skills = {
      'arith.primes': { ...newSkillState(), level: 1, flagged: true } as never,
      'arith.roots': { ...newSkillState(), level: 2, attempts: 3, correct: 2, flagged: true } as never,
      'alg.linear': { ...newSkillState(), level: 3, attempts: 5 },
    };
    const out = dropWeakFlags(data).skills;
    expect(Object.keys(out).sort()).toEqual(['alg.linear', 'arith.roots']);
    expect(out['arith.roots']).toEqual({ ...newSkillState(), level: 2, attempts: 3, correct: 2 });
  });
});
