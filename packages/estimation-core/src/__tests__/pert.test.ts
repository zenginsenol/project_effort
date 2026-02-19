import { describe, it, expect } from 'vitest';
import { PERT } from '../pert';

describe('PERT', () => {
  const pert = new PERT();

  describe('calculate', () => {
    it('calculates expected value correctly', () => {
      const result = pert.calculate({ optimistic: 2, mostLikely: 5, pessimistic: 14 });
      expect(result.expected).toBe(6);
    });

    it('calculates standard deviation correctly', () => {
      const result = pert.calculate({ optimistic: 2, mostLikely: 5, pessimistic: 14 });
      expect(result.standardDeviation).toBe(2);
    });

    it('calculates confidence range', () => {
      const result = pert.calculate({ optimistic: 2, mostLikely: 5, pessimistic: 14 });
      expect(result.confidenceRange.low).toBe(2);
      expect(result.confidenceRange.high).toBe(10);
    });

    it('handles equal values', () => {
      const result = pert.calculate({ optimistic: 5, mostLikely: 5, pessimistic: 5 });
      expect(result.expected).toBe(5);
      expect(result.standardDeviation).toBe(0);
    });

    it('throws on negative values', () => {
      expect(() => pert.calculate({ optimistic: -1, mostLikely: 5, pessimistic: 10 })).toThrow(
        'All values must be non-negative',
      );
    });

    it('throws if optimistic > mostLikely', () => {
      expect(() => pert.calculate({ optimistic: 10, mostLikely: 5, pessimistic: 15 })).toThrow(
        'Optimistic value must be less than or equal to most likely',
      );
    });

    it('throws if mostLikely > pessimistic', () => {
      expect(() => pert.calculate({ optimistic: 2, mostLikely: 15, pessimistic: 10 })).toThrow(
        'Most likely value must be less than or equal to pessimistic',
      );
    });
  });

  describe('aggregateResults', () => {
    it('aggregates multiple PERT results', () => {
      const results = [
        pert.calculate({ optimistic: 2, mostLikely: 5, pessimistic: 14 }),
        pert.calculate({ optimistic: 1, mostLikely: 3, pessimistic: 5 }),
      ];
      const aggregate = pert.aggregateResults(results);
      expect(aggregate.expected).toBe(9);
    });

    it('throws on empty results', () => {
      expect(() => pert.aggregateResults([])).toThrow('At least one result is required');
    });
  });
});
