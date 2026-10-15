import { describe, expect, it } from 'vitest';
import { AREAS } from '../src/content';
import { createRng } from '../src/engine/rng';
import type { Area } from '../src/engine/types';
import { Frac } from '../src/engine/frac';
import { grade } from '../src/engine/grade';
import { buildSection, choiceKeyResponse, loadRun, routeSection2, saveRun, SPECS, skillsToRework, type RunningSection, type SavedRun } from '../src/mastery/section';

const areas = AREAS.filter((a) => a.templates.length).map((a) => a.area) as Area[];

describe('section 2 routing', () => {
  it('sends 0-4 of 12 to easy, 5-8 to medium and 9-12 to hard', () => {
    const levels = Array.from({ length: 13 }, (_, k) => routeSection2(k, 12));
    expect(levels).toEqual([...Array(5).fill('easy'), ...Array(4).fill('medium'), ...Array(4).fill('hard')]);
  });
});

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
        if (areas.length === 4) {
          const data = questions.filter((q) => q.skillId.startsWith('data.')).length;
          expect(data).toBeLessThanOrEqual(Math.ceil(n * 0.5));
        }
        for (const [a, b] of sets) {
          expect(b).toBe(n - 1);
          const figs = questions.slice(a, b + 1).map((q) => JSON.stringify(q.figure));
          expect(new Set(figs).size).toBe(1);
        }
      }
    }
  });
});

describe('resuming a section', () => {
  const fakeStorage = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  };
  const running = (): RunningSection => {
    const { questions, sets } = buildSection(createRng(7), SPECS.s1, 'medium', areas);
    const responses = questions.map(() => undefined) as RunningSection['responses'];
    responses[0] = { format: 'qc', choice: 'B' };
    return { index: 0, spec: SPECS.s1, level: 'medium', questions, sets, responses, marked: questions.map(() => false), timeSpent: questions.map(() => 0), startedAt: 1000, endsAt: 2000 };
  };

  it('restores the same questions, with working answer keys, and the unanswered holes', () => {
    const storage = fakeStorage();
    const sec = running();
    const run: SavedRun = { length: 'full', done: [], sec };
    saveRun(run, storage);
    const back = loadRun(storage)!;
    expect(back.length).toBe('full');
    expect(back.sec).toEqual(sec);
    expect(back.sec!.responses[1]).toBeUndefined();
    const ne = back.sec!.questions.find((q) => q.format === 'ne')!;
    expect(ne.format === 'ne' && ne.answer instanceof Frac).toBe(true);
    expect(grade(ne, undefined).correct).toBe(false);
  });

  it('keeps finished sections between the two sections and forgets on null', () => {
    const storage = fakeStorage();
    const sec = running();
    saveRun({ length: 'full', done: [{ sec, correct: sec.questions.map(() => false), usedSec: 60 }] }, storage);
    const back = loadRun(storage)!;
    expect(back.sec).toBeUndefined();
    expect(back.done[0].sec.questions.map((q) => q.id)).toEqual(sec.questions.map((q) => q.id));
    saveRun(null, storage);
    expect(loadRun(storage)).toBeNull();
  });

  it('ignores garbage and unknown questions', () => {
    const bad = (raw: string) => loadRun({ getItem: () => raw });
    expect(bad('not json')).toBeNull();
    expect(bad('{"length":"full","done":[]}')).toBeNull();
    expect(bad('{"length":"s1","done":[],"sec":{"endsAt":5,"questions":["nope#1#1"],"responses":[]}}')).toBeNull();
  });
});

describe('choice keys', () => {
  const { questions } = buildSection(createRng(7), SPECS.s2, 'medium', areas);
  const of = (f: string) => questions.find((q) => q.format === f)!;

  it('picks QC and select-one choices by letter or digit, ignoring the rest', () => {
    expect(choiceKeyResponse(of('qc'), 'c', undefined)).toEqual({ format: 'qc', choice: 'C' });
    expect(choiceKeyResponse(of('qc'), '4', undefined)).toEqual({ format: 'qc', choice: 'D' });
    expect(choiceKeyResponse(of('qc'), 'E', undefined)).toBeNull();
    expect(choiceKeyResponse(of('mcs'), '2', undefined)).toEqual({ format: 'mcs', choice: 1 });
    expect(choiceKeyResponse(of('mcs'), 'H', undefined)).toBeNull();
    expect(choiceKeyResponse(of('mcs'), 'Enter', undefined)).toBeNull();
    expect(choiceKeyResponse(of('ne'), 'a', undefined)).toBeNull();
  });

  it('toggles select-all choices and keeps them sorted', () => {
    const q = of('mcm');
    const one = choiceKeyResponse(q, 'c', undefined);
    const two = choiceKeyResponse(q, 'a', one!);
    expect(two).toEqual({ format: 'mcm', choices: [0, 2] });
    expect(choiceKeyResponse(q, '1', two!)).toEqual({ format: 'mcm', choices: [2] });
  });
});

describe('skills to rework', () => {
  const items = (spec: Record<string, string>) => Object.entries(spec).flatMap(([skillId, marks]) => [...marks].map((m) => ({ skillId, ok: m === '+' })));

  it('lists the most missed skills first, at most three, and skips the ones got right', () => {
    const out = skillsToRework(items({ a: '+++', b: '-+-', c: '--', d: '-+', e: '+-+-+-' }));
    expect(out.map((x) => x.skillId)).toEqual(['e', 'c', 'b']);
    expect(out[0]).toEqual({ skillId: 'e', missed: 3, total: 6 });
    expect(skillsToRework(items({ a: '++', b: '+' }))).toEqual([]);
  });

  it('breaks a tie on the lower share right, then on the order met', () => {
    expect(skillsToRework(items({ a: '-+', b: '-', c: '-+' })).map((x) => x.skillId)).toEqual(['b', 'a', 'c']);
    expect(skillsToRework(items({ a: '-', b: '-', c: '-', d: '-' }), 2).map((x) => x.skillId)).toEqual(['a', 'b']);
  });
});
