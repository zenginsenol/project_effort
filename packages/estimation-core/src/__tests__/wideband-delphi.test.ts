import { describe, it, expect } from 'vitest';
import { WidebandDelphi } from '../wideband-delphi';

describe('WidebandDelphi', () => {
  const delphi = new WidebandDelphi(0.2, 5);

  describe('processRound', () => {
    it('processes a round of estimates', () => {
      const round = delphi.processRound(1, [5, 6, 5, 7]);
      expect(round.roundNumber).toBe(1);
      expect(round.average).toBe(5.75);
      expect(round.range.min).toBe(5);
      expect(round.range.max).toBe(7);
    });

    it('detects convergence when estimates are close', () => {
      const round = delphi.processRound(1, [5, 5, 5, 5]);
      expect(round.hasConverged).toBe(true);
    });

    it('detects non-convergence when estimates are spread', () => {
      const round = delphi.processRound(1, [1, 5, 10, 20]);
      expect(round.hasConverged).toBe(false);
    });

    it('throws on empty estimates', () => {
      expect(() => delphi.processRound(1, [])).toThrow('At least one estimate is required');
    });

    it('throws on negative estimates', () => {
      expect(() => delphi.processRound(1, [-1, 5])).toThrow(
        'All estimates must be non-negative',
      );
    });
  });

  describe('finalize', () => {
    it('returns final result', () => {
      const round1 = delphi.processRound(1, [3, 5, 8, 10]);
      const round2 = delphi.processRound(2, [5, 6, 6, 7]);
      const result = delphi.finalize([round1, round2]);
      expect(result.totalRounds).toBe(2);
      expect(result.finalEstimate).toBe(6);
    });

    it('throws on empty rounds', () => {
      expect(() => delphi.finalize([])).toThrow('At least one round is required');
    });
  });

  describe('shouldContinue', () => {
    it('returns true for empty rounds', () => {
      expect(delphi.shouldContinue([])).toBe(true);
    });

    it('returns false when converged', () => {
      const round = delphi.processRound(1, [5, 5, 5, 5]);
      expect(delphi.shouldContinue([round])).toBe(false);
    });

    it('returns false at max rounds', () => {
      const rounds = Array.from({ length: 5 }, (_, i) =>
        delphi.processRound(i + 1, [1, 5, 10, 20]),
      );
      expect(delphi.shouldContinue(rounds)).toBe(false);
    });
  });
});
