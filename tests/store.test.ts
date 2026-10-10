import { describe, expect, it } from 'vitest';
import { decodeSegment } from '../src/router';

describe('router', () => {
  it('keeps a malformed escape instead of throwing', () => {
    expect(decodeSegment('50%')).toBe('50%');
    expect(decodeSegment('a%20b')).toBe('a b');
  });
});
