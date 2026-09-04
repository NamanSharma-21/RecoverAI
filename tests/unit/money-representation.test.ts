import { describe, it, expect } from 'vitest';
import { toMinorUnits, toDisplayCurrency } from '../../src/domain/types';
import { AmountMinorSchema } from '../../src/domain/schemas';

describe('Money Representation & Currency Precision', () => {
  it('converts major units to minor units without floating-point drift', () => {
    expect(toMinorUnits(1.00)).toBe(100);
    expect(toMinorUnits(99.99)).toBe(9999);
    expect(toMinorUnits(1499)).toBe(149900);
    expect(toMinorUnits(5000)).toBe(500000);
    expect(toMinorUnits(25000)).toBe(2500000);
    expect(toMinorUnits(50000)).toBe(5000000);
  });

  it('handles floating point precision edge cases reliably', () => {
    // 19.99 * 100 in vanilla JS is 1998.9999999999998
    expect(toMinorUnits(19.99)).toBe(1999);
    // 0.1 + 0.2 in vanilla JS is 0.30000000000000004
    expect(toMinorUnits(0.1 + 0.2)).toBe(30);
  });

  it('formats minor units to Indian Rupee display format', () => {
    expect(toDisplayCurrency(100, 'INR')).toBe('₹1.00');
    expect(toDisplayCurrency(9999, 'INR')).toBe('₹99.99');
    expect(toDisplayCurrency(149900, 'INR')).toBe('₹1,499.00');
    expect(toDisplayCurrency(500000, 'INR')).toBe('₹5,000.00');
    expect(toDisplayCurrency(5000000, 'INR')).toBe('₹50,000.00');
  });

  it('validates minor units with AmountMinorSchema', () => {
    // Valid integer amounts
    expect(AmountMinorSchema.safeParse(100).success).toBe(true);
    expect(AmountMinorSchema.safeParse(500000).success).toBe(true);
    expect(AmountMinorSchema.safeParse(0).success).toBe(true);

    // Negative amounts are rejected
    expect(AmountMinorSchema.safeParse(-100).success).toBe(false);

    // Fractional amounts in minor units are rejected (must be integer paise)
    expect(AmountMinorSchema.safeParse(100.5).success).toBe(false);
  });
});
