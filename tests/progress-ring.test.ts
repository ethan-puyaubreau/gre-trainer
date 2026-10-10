import { describe, expect, it } from 'vitest';
import { newSkillState, progressToNext, type Level, type SkillState } from '../src/mastery/model';

const at = (level: Level, over: Partial<SkillState> = {}): SkillState => ({ ...newSkillState(), level, ...over });

describe('progressToNext', () => {
  it('level 0 and 1 have nothing partial to show', () => {
    expect(progressToNext(at(0))).toBe(0);
    expect(progressToNext(at(1, { attempts: 1 }))).toBe(0);
  });

  it('level 2 counts clean styles out of 2', () => {
    expect(progressToNext(at(2))).toBe(0);
    expect(progressToNext(at(2, { styles: ['a'] }))).toBe(0.5);
    expect(progressToNext(at(2, { styles: ['a', 'b'] }))).toBe(1);
  });

  it('level 3 averages the style and day ratios', () => {
    expect(progressToNext(at(3))).toBe(0);
    expect(progressToNext(at(3, { styles: ['a', 'b'], days: ['d1'] }))).toBeCloseTo((2 / 3 + 1 / 2) / 2);
    expect(progressToNext(at(3, { styles: ['a', 'b', 'c'], days: ['d1'] }))).toBe(0.75);
    expect(progressToNext(at(3, { styles: ['a'], days: ['d1', 'd2'] }))).toBeCloseTo((1 / 3 + 1) / 2);
  });

  it('level 4 is full', () => {
    expect(progressToNext(at(4))).toBe(1);
  });

  it('clamps surplus credit to 1', () => {
    expect(progressToNext(at(2, { styles: ['a', 'b', 'c'] }))).toBe(1);
    expect(progressToNext(at(3, { styles: ['a', 'b', 'c', 'd'], days: ['d1', 'd2', 'd3'] }))).toBe(1);
  });
});
