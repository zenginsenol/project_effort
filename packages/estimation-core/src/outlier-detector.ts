export interface OutlierResult {
  value: number;
  index: number;
  zScore: number;
  isOutlier: boolean;
}

export interface OutlierAnalysis {
  values: readonly number[];
  mean: number;
  standardDeviation: number;
  threshold: number;
  results: readonly OutlierResult[];
  outliers: readonly OutlierResult[];
  cleanValues: readonly number[];
}

export class OutlierDetector {
  private readonly defaultThreshold: number;

  constructor(defaultThreshold = 2.0) {
    this.defaultThreshold = defaultThreshold;
  }

  public analyze(values: readonly number[], threshold?: number): OutlierAnalysis {
    if (values.length < 3) {
      throw new Error('At least 3 values are required for outlier detection');
    }

    const t = threshold ?? this.defaultThreshold;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const stdDev = this.calculateStdDev(values, mean);

    const results: OutlierResult[] = values.map((value, index) => {
      const zScore = stdDev === 0 ? 0 : Math.abs(value - mean) / stdDev;
      return {
        value,
        index,
        zScore: Math.round(zScore * 100) / 100,
        isOutlier: zScore > t,
      };
    });

    const outliers = results.filter((r) => r.isOutlier);
    const cleanValues = results.filter((r) => !r.isOutlier).map((r) => r.value);

    return {
      values,
      mean: Math.round(mean * 100) / 100,
      standardDeviation: Math.round(stdDev * 100) / 100,
      threshold: t,
      results,
      outliers,
      cleanValues,
    };
  }

  public removeOutliers(values: readonly number[], threshold?: number): readonly number[] {
    const analysis = this.analyze(values, threshold);
    return analysis.cleanValues;
  }

  public isOutlier(value: number, values: readonly number[], threshold?: number): boolean {
    if (values.length < 3) return false;
    const analysis = this.analyze(values, threshold);
    const result = analysis.results.find((r) => r.value === value);
    return result?.isOutlier ?? false;
  }

  private calculateStdDev(values: readonly number[], mean: number): number {
    const squaredDiffs = values.map((v) => (v - mean) ** 2);
    const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length;
    return Math.sqrt(variance);
  }
}
