import { describe, it, expect } from 'vitest';
import { OutlierDetector } from '../outlier-detector';

describe('OutlierDetector', () => {
  const detector = new OutlierDetector(2.0);

  describe('analyze', () => {
    it('detects outliers', () => {
      const analysis = detector.analyze([5, 5, 5, 5, 5, 100]);
      expect(analysis.outliers.length).toBeGreaterThan(0);
      expect(analysis.outliers[0]!.value).toBe(100);
    });

    it('handles data with no outliers', () => {
      const analysis = detector.analyze([5, 6, 5, 6, 5]);
      expect(analysis.outliers.length).toBe(0);
    });

    it('returns clean values', () => {
      const analysis = detector.analyze([5, 5, 5, 5, 5, 100]);
      expect(analysis.cleanValues).not.toContain(100);
    });

    it('throws on less than 3 values', () => {
      expect(() => detector.analyze([1, 2])).toThrow(
        'At least 3 values are required for outlier detection',
      );
    });
  });

  describe('removeOutliers', () => {
    it('removes outliers from array', () => {
      const clean = detector.removeOutliers([5, 5, 5, 5, 5, 100]);
      expect(clean).not.toContain(100);
    });
  });

  describe('isOutlier', () => {
    it('identifies outlier value', () => {
      const values = [5, 5, 5, 5, 5, 100];
      expect(detector.isOutlier(100, values)).toBe(true);
      expect(detector.isOutlier(5, values)).toBe(false);
    });

    it('returns false for small datasets', () => {
      expect(detector.isOutlier(100, [5, 100])).toBe(false);
    });
  });
});
