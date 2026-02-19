import { describe, it, expect } from 'vitest';
import { PlanningPoker } from '../planning-poker';

describe('PlanningPoker', () => {
  const poker = new PlanningPoker();

  describe('isValidVote', () => {
    it('accepts valid Fibonacci values', () => {
      expect(poker.isValidVote(0)).toBe(true);
      expect(poker.isValidVote(1)).toBe(true);
      expect(poker.isValidVote(5)).toBe(true);
      expect(poker.isValidVote(13)).toBe(true);
      expect(poker.isValidVote(89)).toBe(true);
    });

    it('rejects invalid values', () => {
      expect(poker.isValidVote(4)).toBe(false);
      expect(poker.isValidVote(7)).toBe(false);
      expect(poker.isValidVote(100)).toBe(false);
      expect(poker.isValidVote(-1)).toBe(false);
    });
  });

  describe('calculate', () => {
    it('calculates consensus for unanimous vote', () => {
      const result = poker.calculate([5, 5, 5, 5]);
      expect(result.consensus).toBe(5);
      expect(result.agreement).toBe(1);
      expect(result.hasConsensus).toBe(true);
    });

    it('calculates average correctly', () => {
      const result = poker.calculate([1, 3, 5, 8]);
      expect(result.average).toBe(4.25);
    });

    it('calculates median for odd count', () => {
      const result = poker.calculate([1, 3, 5]);
      expect(result.median).toBe(3);
    });

    it('calculates median for even count', () => {
      const result = poker.calculate([1, 3, 5, 8]);
      expect(result.median).toBe(4);
    });

    it('finds mode', () => {
      const result = poker.calculate([5, 5, 8, 3]);
      expect(result.mode).toBe(5);
    });

    it('returns null mode on tie', () => {
      const result = poker.calculate([5, 5, 8, 8]);
      expect(result.mode).toBeNull();
    });

    it('calculates distribution', () => {
      const result = poker.calculate([5, 5, 8, 3]);
      expect(result.distribution).toEqual({ 3: 1, 5: 2, 8: 1 });
    });

    it('throws on empty votes', () => {
      expect(() => poker.calculate([])).toThrow('At least one vote is required');
    });

    it('throws on invalid vote', () => {
      expect(() => poker.calculate([4])).toThrow('Invalid vote value: 4');
    });
  });

  describe('findNearestValid', () => {
    it('finds nearest Fibonacci value', () => {
      expect(poker.findNearestValid(4)).toBe(3);
      expect(poker.findNearestValid(6)).toBe(5);
      expect(poker.findNearestValid(10)).toBe(8);
    });
  });
});
