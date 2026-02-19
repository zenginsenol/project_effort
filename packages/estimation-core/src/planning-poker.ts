const FIBONACCI_SEQUENCE = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89] as const;

export interface PlanningPokerResult {
  votes: readonly number[];
  average: number;
  median: number;
  mode: number | null;
  consensus: number;
  agreement: number;
  hasConsensus: boolean;
  distribution: Record<number, number>;
}

export class PlanningPoker {
  private readonly validValues: readonly number[];

  constructor(customValues?: readonly number[]) {
    this.validValues = customValues ?? FIBONACCI_SEQUENCE;
  }

  public isValidVote(value: number): boolean {
    return this.validValues.includes(value);
  }

  public calculate(votes: readonly number[]): PlanningPokerResult {
    if (votes.length === 0) {
      throw new Error('At least one vote is required');
    }

    for (const vote of votes) {
      if (!this.isValidVote(vote)) {
        throw new Error(`Invalid vote value: ${String(vote)}`);
      }
    }

    const sorted = [...votes].sort((a, b) => a - b);
    const average = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
    const median = this.calculateMedian(sorted);
    const distribution = this.calculateDistribution(votes);
    const mode = this.calculateMode(distribution);
    const consensus = this.findNearestValid(median);
    const agreement = this.calculateAgreement(votes, consensus);

    return {
      votes,
      average: Math.round(average * 100) / 100,
      median,
      mode,
      consensus,
      agreement: Math.round(agreement * 100) / 100,
      hasConsensus: agreement >= 0.7,
      distribution,
    };
  }

  public findNearestValid(value: number): number {
    if (this.validValues.length === 0) {
      throw new Error('No valid values configured');
    }
    let nearest = this.validValues[0]!;
    let minDiff = Math.abs(value - nearest);

    for (const v of this.validValues) {
      const diff = Math.abs(value - v);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = v;
      }
    }

    return nearest;
  }

  private calculateMedian(sorted: readonly number[]): number {
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1]! + sorted[mid]!) / 2;
    }
    return sorted[mid]!;
  }

  private calculateDistribution(votes: readonly number[]): Record<number, number> {
    const dist: Record<number, number> = {};
    for (const vote of votes) {
      dist[vote] = (dist[vote] ?? 0) + 1;
    }
    return dist;
  }

  private calculateMode(distribution: Record<number, number>): number | null {
    let maxCount = 0;
    let mode: number | null = null;
    let hasTie = false;

    for (const [value, count] of Object.entries(distribution)) {
      if (count > maxCount) {
        maxCount = count;
        mode = Number(value);
        hasTie = false;
      } else if (count === maxCount) {
        hasTie = true;
      }
    }

    return hasTie ? null : mode;
  }

  private calculateAgreement(votes: readonly number[], consensus: number): number {
    const matching = votes.filter((v) => v === consensus).length;
    return matching / votes.length;
  }
}
