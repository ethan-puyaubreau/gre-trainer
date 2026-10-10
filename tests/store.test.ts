import { describe, expect, it } from 'vitest';
import { decodeSegment } from '../src/router';
import { dropWeakFlags } from '../src/store/migrate';
import { initialData, isProgressData } from '../src/store/progress';

describe('router', () => {
  it('keeps a malformed escape instead of throwing', () => {
    expect(decodeSegment('50%')).toBe('50%');
    expect(decodeSegment('a%20b')).toBe('a b');
  });
});

describe('import validation', () => {
  const entry = { qid: 'x#1#1', skillId: 's', templateId: 't', correct: true, timeMs: 5, at: 1, mode: 'practice', traps: [], hinted: false };

  it('rejects a history entry that would crash the dashboard', () => {
    expect(isProgressData({ version: 1, skills: {}, history: [{ qid: 'x#1#1' }], remediation: [] })).toBe(false);
  });

  it('rejects null skills and a non-array sections', () => {
    expect(isProgressData({ ...initialData(), skills: null })).toBe(false);
    expect(isProgressData({ ...initialData(), sections: {} })).toBe(false);
    expect(isProgressData(null)).toBe(false);
  });

  it('accepts a valid export', () => {
    expect(isProgressData(JSON.parse(JSON.stringify(initialData())))).toBe(true);
    expect(isProgressData({ ...initialData(), history: [entry] })).toBe(true);
  });

  it('dropWeakFlags never throws on bad input', () => {
    expect(() => dropWeakFlags({ ...initialData(), skills: null } as never)).not.toThrow();
    expect(dropWeakFlags({ ...initialData(), skills: { a: 5 } } as never).skills).toEqual({});
  });
});
