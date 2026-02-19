import { describe, it, expect } from 'vitest';
import { TShirtSizing } from '../tshirt-sizing';

describe('TShirtSizing', () => {
  const sizing = new TShirtSizing();

  describe('isValidSize', () => {
    it('accepts valid sizes', () => {
      expect(sizing.isValidSize('XS')).toBe(true);
      expect(sizing.isValidSize('M')).toBe(true);
      expect(sizing.isValidSize('XXL')).toBe(true);
    });

    it('rejects invalid sizes', () => {
      expect(sizing.isValidSize('XXXL')).toBe(false);
      expect(sizing.isValidSize('tiny')).toBe(false);
    });
  });

  describe('calculate', () => {
    it('finds consensus', () => {
      const result = sizing.calculate(['M', 'M', 'M', 'L']);
      expect(result.consensus).toBe('M');
    });

    it('returns null consensus on tie', () => {
      const result = sizing.calculate(['M', 'M', 'L', 'L']);
      expect(result.consensus).toBeNull();
    });

    it('calculates distribution', () => {
      const result = sizing.calculate(['S', 'M', 'M', 'L']);
      expect(result.distribution).toEqual({ S: 1, M: 2, L: 1 });
    });

    it('throws on empty votes', () => {
      expect(() => sizing.calculate([])).toThrow('At least one vote is required');
    });

    it('throws on invalid size', () => {
      expect(() => sizing.calculate(['XXXL'])).toThrow('Invalid size: XXXL');
    });
  });

  describe('toNumeric', () => {
    it('converts sizes to numbers', () => {
      expect(sizing.toNumeric('XS')).toBe(1);
      expect(sizing.toNumeric('M')).toBe(5);
      expect(sizing.toNumeric('XXL')).toBe(21);
    });

    it('throws on invalid size', () => {
      expect(() => sizing.toNumeric('invalid')).toThrow('Invalid size: invalid');
    });
  });

  describe('fromNumeric', () => {
    it('converts numbers to nearest size', () => {
      expect(sizing.fromNumeric(1)).toBe('XS');
      expect(sizing.fromNumeric(4)).toBe('M');
      expect(sizing.fromNumeric(10)).toBe('L');
    });
  });
});
