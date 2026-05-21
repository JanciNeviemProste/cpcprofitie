import { describe, expect, it } from 'vitest';
import { toBigInt } from '../db/bigint';

describe('toBigInt', () => {
  it('passes through bigint', () => {
    expect(toBigInt(BigInt(42))).toBe(BigInt(42));
  });
  it('parses string', () => {
    expect(toBigInt('123456789012345678')).toBe(BigInt('123456789012345678'));
  });
  it('converts safe number', () => {
    expect(toBigInt(42)).toBe(BigInt(42));
    expect(toBigInt(Number.MAX_SAFE_INTEGER)).toBe(BigInt(Number.MAX_SAFE_INTEGER));
  });
  it('throws on unsafe number (precision loss)', () => {
    expect(() => toBigInt(9_007_199_254_740_993)).toThrow(/safe integer/);
  });
  it('throws on unsupported type', () => {
    expect(() => toBigInt(null as unknown)).toThrow(/unsupported/);
    expect(() => toBigInt({} as unknown)).toThrow(/unsupported/);
  });
});
