import { describe, expect, it } from 'vitest';
import { decide } from '../src/sync/decide';

const local = (answers: number) => ({ answers, empty: answers === 0 });
const remote = { updatedAt: '2026-11-01T10:00:00Z' };

describe('cloud sync decision', () => {
  it('pushes local progress when the account has none', () => {
    expect(decide({ local: local(5), remote: null, meta: { dirty: true }, uid: 'u' })).toBe('push');
    expect(decide({ local: local(0), remote: null, meta: { dirty: true }, uid: 'u' })).toBe('none');
  });
  it('takes the cloud copy into an empty browser (new device)', () => {
    expect(decide({ local: local(0), remote, meta: { dirty: true }, uid: 'u' })).toBe('pull');
  });
  it('pushes local changes when the cloud did not move', () => {
    expect(decide({ local: local(9), remote, meta: { uid: 'u', remoteUpdatedAt: remote.updatedAt, dirty: true }, uid: 'u' })).toBe('push');
    expect(decide({ local: local(9), remote, meta: { uid: 'u', remoteUpdatedAt: remote.updatedAt, dirty: false }, uid: 'u' })).toBe('none');
  });
  it('pulls when only the cloud moved', () => {
    expect(decide({ local: local(9), remote, meta: { uid: 'u', remoteUpdatedAt: '2026-10-01T00:00:00Z', dirty: false }, uid: 'u' })).toBe('pull');
  });
  it('asks when both moved, or when this browser holds data never synced with this account', () => {
    expect(decide({ local: local(9), remote, meta: { uid: 'u', remoteUpdatedAt: '2026-10-01T00:00:00Z', dirty: true }, uid: 'u' })).toBe('conflict');
    expect(decide({ local: local(9), remote, meta: { dirty: true }, uid: 'u' })).toBe('conflict');
    expect(decide({ local: local(9), remote, meta: { uid: 'other', remoteUpdatedAt: remote.updatedAt, dirty: false }, uid: 'u' })).toBe('conflict');
  });
});
