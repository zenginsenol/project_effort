export interface DelphiRound {
  roundNumber: number;
  estimates: readonly number[];
  average: number;
  median: number;
  range: { min: number; max: number };
  standardDeviation: number;
  hasConverged: boolean;
}

export interface DelphiResult {
  rounds: readonly DelphiRound[];
  finalEstimate: number;
  convergedInRound: number | null;
  totalRounds: number;
}

export class WidebandDelphi {
  private readonly convergenceThreshold: number;
  private readonly maxRounds: number;

  constructor(convergenceThreshold = 0.2, maxRounds = 5) {
    this.convergenceThreshold = convergenceThreshold;
    this.maxRounds = maxRounds;
  }

  public processRound(
    roundNumber: number,
    estimates: readonly number[],
    previousRounds: readonly DelphiRound[] = [],
  ): DelphiRound {
    if (estimates.length === 0) {
      throw new Error('At least one estimate is required');
    }

    if (estimates.some((e) => e < 0)) {
      throw new Error('All estimates must be non-negative');
    }

    const sorted = [...estimates].sort((a, b) => a - b);
    const average = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
    const median = this.calculateMedian(sorted);
    const min = sorted[0]!;
    const max = sorted[sorted.length - 1]!;
    const stdDev = this.calculateStdDev(estimates, average);

    const hasConverged = this.checkConvergence(estimates, average);

    return {
      roundNumber,
      estimates,
      average: Math.round(average * 100) / 100,
      median,
      range: { min, max },
      standardDeviation: Math.round(stdDev * 100) / 100,
      hasConverged,
    };
  }

  public finalize(rounds: readonly DelphiRound[]): DelphiResult {
    if (rounds.length === 0) {
      throw new Error('At least one round is required');
    }

    const lastRound = rounds[rounds.length - 1]!;
    const convergedRound = rounds.find((r) => r.hasConverged);

    return {
      rounds,
      finalEstimate: lastRound.median,
      convergedInRound: convergedRound?.roundNumber ?? null,
      totalRounds: rounds.length,
    };
  }

  public shouldContinue(rounds: readonly DelphiRound[]): boolean {
    if (rounds.length === 0) return true;
    if (rounds.length >= this.maxRounds) return false;

    const lastRound = rounds[rounds.length - 1]!;
    return !lastRound.hasConverged;
  }

  private checkConvergence(estimates: readonly number[], average: number): boolean {
    if (average === 0) return estimates.every((e) => e === 0);

    return estimates.every((e) => {
      const deviation = Math.abs(e - average) / average;
      return deviation <= this.convergenceThreshold;
    });
  }

  private calculateMedian(sorted: readonly number[]): number {
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1]! + sorted[mid]!) / 2;
    }
    return sorted[mid]!;
  }

  private calculateStdDev(values: readonly number[], mean: number): number {
    const squaredDiffs = values.map((v) => (v - mean) ** 2);
    const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length;
    return Math.sqrt(variance);
  }
}
