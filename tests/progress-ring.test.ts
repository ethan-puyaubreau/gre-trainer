import { describe, expect, it } from 'vitest';
import type { Format, Template } from '../src/engine/types';
import { newSkillState, nextCriteria, progressToNext, requirementsFor, type Level, type SkillState } from '../src/mastery/model';

const T0 = new Date(2026, 9, 10, 9, 0).getTime();
const H = 60 * 60 * 1000;
const tpl = (id: string, format: Format) => ({ id, skill: 's', format, style: id }) as unknown as Template<any>;
const reqOf = (...formats: Format[]) => requirementsFor(formats.map((f, i) => tpl(`t${i}`, f)));
// 4 styles: 3 needed, 2 formats, numeric entry.
const REQ = reqOf('mcs', 'qc', 'ne', 'mcs');

const at = (level: Level, over: Partial<SkillState> = {}): SkillState => ({ ...newSkillState(), level, ...over });
const proficient = at(3, { styles: { t0: 3, t1: 2 }, formats: ['mcs', 'qc'], firstCreditAt: T0 });
const ready = at(3, { styles: { t0: 3, t1: 2, t2: 2 }, formats: ['mcs', 'qc', 'ne'], firstCreditAt: T0 });

describe('nextCriteria', () => {
  it('has one step below Proficient and none at Mastered', () => {
    expect(nextCriteria(at(0), REQ, T0).map((c) => c.label)).toEqual(['Answer one question to start.']);
    expect(nextCriteria(at(1), REQ, T0).map((c) => c.label)).toEqual(['Answer one question correctly.']);
    const familiar = nextCriteria(at(2, { styles: { t0: 2 } }), REQ, T0);
    expect(familiar).toHaveLength(1);
    expect(familiar[0].label).toMatch(/^Answer 1 more question type correctly/);
    expect(nextCriteria(at(4), REQ, T0)).toEqual([]);
  });

  it('lists the five Mastered criteria at Proficient', () => {
    expect(nextCriteria(proficient, REQ, T0 + H).map((c) => [c.key, c.label, c.done])).toEqual([
      ['styles', 'Question types 2/3', false],
      ['formats', '2 formats', true],
      ['production', 'Numeric entry', false],
      ['hard', 'One hard question', true],
      ['retention', 'Back tomorrow after 03:00', false],
    ]);
  });

  it('names the production formats the skill has, and drops the criterion when it has none', () => {
    const production = (req: ReturnType<typeof reqOf>) => nextCriteria(at(3), req, T0).find((c) => c.key === 'production')?.label;
    expect(production(reqOf('mcs', 'ne', 'mcm'))).toBe('Numeric entry or select-all');
    expect(production(reqOf('qc', 'mcm'))).toBe('Select-all');
    expect(production(reqOf('qc', 'mcs'))).toBeUndefined();
    expect(nextCriteria(at(3), reqOf('qc', 'mcs'), T0)).toHaveLength(4);
  });

  it('counts the retention clock from the first credit', () => {
    const retention = (s: SkillState, now: number) => nextCriteria(s, REQ, now).find((c) => c.key === 'retention')!;
    expect(retention(proficient, T0 + 17 * H)).toMatchObject({ label: 'Back after 03:00', done: false }); // 02:00 the next day
    expect(retention(proficient, T0 + 18 * H - 1).done).toBe(false);
    expect(retention(proficient, T0 + 18 * H).done).toBe(true);
    expect(retention(at(3), T0 + 30 * H).done).toBe(false); // no credit since the last miss
  });
});

describe('progressToNext', () => {
  it('level 0 and 1 have nothing partial to show', () => {
    expect(progressToNext(at(0), REQ, T0)).toBe(0);
    expect(progressToNext(at(1, { attempts: 1 }), REQ, T0)).toBe(0);
  });

  it('level 2 counts credited styles out of 2', () => {
    expect(progressToNext(at(2), REQ, T0)).toBe(0);
    expect(progressToNext(at(2, { styles: { t0: 2 } }), REQ, T0)).toBe(0.5);
    expect(progressToNext(at(2, { styles: { t0: 2, t1: 3, t2: 2 } }), REQ, T0)).toBe(1);
  });

  it('level 3 is the share of criteria met, the style count counting pro rata', () => {
    expect(progressToNext(at(3), REQ, T0)).toBe(0);
    expect(progressToNext(proficient, REQ, T0 + H)).toBeCloseTo((2 / 3 + 1 + 0 + 1 + 0) / 5);
    expect(progressToNext(ready, REQ, T0 + H)).toBe(0.8);
    expect(progressToNext(ready, REQ, T0 + 18 * H)).toBe(1);
  });

  it('level 4 is full', () => {
    expect(progressToNext(at(4), REQ, T0)).toBe(1);
  });
});
