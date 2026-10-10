import { describe, expect, it } from 'vitest';
import { parseDecimal } from '../src/engine/frac';
import { isAnswered, parseNumericResponse } from '../src/engine/grade';

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

describe('long input', () => {
  it('returns null instead of throwing past 15 digits', () => {
    expect(() => parseDecimal('99999999.99999999')).not.toThrow();
    expect(parseDecimal('99999999.99999999')).toBeNull();
    expect(parseDecimal('1234567890123456')).toBeNull();
    expect(parseDecimal('0.1234567890123456')).toBeNull();
    expect(parseDecimal('123456789012.345')?.toDecimalString()).toBe('123456789012.345');
  });

  it('never throws from the response parser', () => {
    const long = '9'.repeat(40);
    expect(parseNumericResponse({ format: 'ne', value: long })).toBeNull();
    expect(parseNumericResponse({ format: 'ne', num: long, den: '7' })).toBeNull();
    expect(parseNumericResponse({ format: 'ne', value: '99999999.99999999' })).toBeNull();
  });
});

describe('isAnswered numeric entry', () => {
  it('is false for responses that do not parse', () => {
    expect(isAnswered({ format: 'ne', value: '' })).toBe(false);
    expect(isAnswered({ format: 'ne', value: '1/2' })).toBe(false);
    expect(isAnswered({ format: 'ne', value: '1,5' })).toBe(false);
    expect(isAnswered({ format: 'ne', num: '3', den: '' })).toBe(false);
    expect(isAnswered({ format: 'ne', num: '', den: '4' })).toBe(false);
    expect(isAnswered({ format: 'ne', num: '3', den: '0' })).toBe(false);
  });

  it('is true for valid decimals and fractions', () => {
    expect(isAnswered({ format: 'ne', value: '-0.5' })).toBe(true);
    expect(isAnswered({ format: 'ne', value: '1,500' })).toBe(true);
    expect(isAnswered({ format: 'ne', num: '3', den: '4' })).toBe(true);
  });
});
