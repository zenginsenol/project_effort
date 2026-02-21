const DEFAULT_SIZE_MAP: Record<string, number> = {
  XS: 1,
  S: 2,
  M: 5,
  L: 8,
  XL: 13,
  XXL: 21,
};

export interface TShirtSizingResult {
  votes: readonly string[];
  distribution: Record<string, number>;
  consensus: string | null;
  numericEquivalent: number;
  agreement: number;
}

export class TShirtSizing {
  private readonly sizeMap: Record<string, number>;
  private readonly validSizes: readonly string[];

  constructor(customMap?: Record<string, number>) {
    this.sizeMap = customMap ?? DEFAULT_SIZE_MAP;
    this.validSizes = Object.keys(this.sizeMap);
  }

  public isValidSize(size: string): boolean {
    return this.validSizes.includes(size);
  }

  public calculate(votes: readonly string[]): TShirtSizingResult {
    if (votes.length === 0) {
      throw new Error('At least one vote is required');
    }

    for (const vote of votes) {
      if (!this.isValidSize(vote)) {
        throw new Error(`Invalid size: ${vote}`);
      }
    }

    const distribution = this.calculateDistribution(votes);
    const consensus = this.findConsensus(distribution);
    const numericValues = votes.map((v) => this.sizeMap[v]!);
    const numericAvg = numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length;
    const numericEquivalent = this.findNearestSize(numericAvg);
    const agreement = consensus
      ? (distribution[consensus] ?? 0) / votes.length
      : 0;

    return {
      votes,
      distribution,
      consensus,
      numericEquivalent: this.sizeMap[numericEquivalent] ?? numericAvg,
      agreement: Math.round(agreement * 100) / 100,
    };
  }

  public toNumeric(size: string): number {
    const value = this.sizeMap[size];
    if (value === undefined) {
      throw new Error(`Invalid size: ${size}`);
    }
    return value;
  }

  public fromNumeric(value: number): string {
    return this.findNearestSize(value);
  }

  private calculateDistribution(votes: readonly string[]): Record<string, number> {
    const dist: Record<string, number> = {};
    for (const vote of votes) {
      dist[vote] = (dist[vote] ?? 0) + 1;
    }
    return dist;
  }

  private findConsensus(distribution: Record<string, number>): string | null {
    let maxCount = 0;
    let consensus: string | null = null;
    let hasTie = false;

    for (const [size, count] of Object.entries(distribution)) {
      if (count > maxCount) {
        maxCount = count;
        consensus = size;
        hasTie = false;
      } else if (count === maxCount) {
        hasTie = true;
      }
    }

    return hasTie ? null : consensus;
  }

  private findNearestSize(value: number): string {
    let nearest = this.validSizes[0]!;
    let minDiff = Math.abs(value - this.sizeMap[nearest]!);

    for (const size of this.validSizes) {
      const diff = Math.abs(value - this.sizeMap[size]!);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = size;
      }
    }

    return nearest;
  }
}
