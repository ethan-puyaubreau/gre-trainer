import { describe, expect, it } from 'vitest';
import { parseDecimal } from '../src/engine/frac';

describe('parseDecimal commas', () => {
  it('rejects a comma that is not a thousands separator', () => {
    expect(parseDecimal('1,5')).toBeNull();
    expect(parseDecimal('1,50')).toBeNull();
    expect(parseDecimal('1234,567')).toBeNull();
    expect(parseDecimal(',5')).toBeNull();
    expect(parseDecimal('1,,500')).toBeNull();
    expect(parseDecimal('1,500,')).toBeNull();
  });

  it('accepts thousands groups with an optional decimal part', () => {
    expect(parseDecimal('1,500')?.eq(1500)).toBe(true);
    expect(parseDecimal('1,500.25')?.toDecimalString()).toBe('1500.25');
    expect(parseDecimal('-1,234,567')?.eq(-1234567)).toBe(true);
    expect(parseDecimal('-0.5')?.toDecimalString()).toBe('-0.5');
  });
});
