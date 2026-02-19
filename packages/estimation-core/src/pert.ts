export interface PertInput {
  optimistic: number;
  mostLikely: number;
  pessimistic: number;
}

export interface PertResult {
  expected: number;
  standardDeviation: number;
  variance: number;
  confidenceRange: {
    low: number;
    high: number;
  };
}

export class PERT {
  public calculate(input: PertInput): PertResult {
    this.validate(input);

    const { optimistic: o, mostLikely: m, pessimistic: p } = input;

    const expected = (o + 4 * m + p) / 6;
    const standardDeviation = (p - o) / 6;
    const variance = standardDeviation ** 2;

    return {
      expected: Math.round(expected * 100) / 100,
      standardDeviation: Math.round(standardDeviation * 100) / 100,
      variance: Math.round(variance * 100) / 100,
      confidenceRange: {
        low: Math.round((expected - 2 * standardDeviation) * 100) / 100,
        high: Math.round((expected + 2 * standardDeviation) * 100) / 100,
      },
    };
  }

  public calculateBatch(inputs: readonly PertInput[]): PertResult[] {
    return inputs.map((input) => this.calculate(input));
  }

  public aggregateResults(results: readonly PertResult[]): PertResult {
    if (results.length === 0) {
      throw new Error('At least one result is required');
    }

    const totalExpected = results.reduce((sum, r) => sum + r.expected, 0);
    const totalVariance = results.reduce((sum, r) => sum + r.variance, 0);
    const totalStdDev = Math.sqrt(totalVariance);

    return {
      expected: Math.round(totalExpected * 100) / 100,
      standardDeviation: Math.round(totalStdDev * 100) / 100,
      variance: Math.round(totalVariance * 100) / 100,
      confidenceRange: {
        low: Math.round((totalExpected - 2 * totalStdDev) * 100) / 100,
        high: Math.round((totalExpected + 2 * totalStdDev) * 100) / 100,
      },
    };
  }

  private validate(input: PertInput): void {
    const { optimistic, mostLikely, pessimistic } = input;

    if (optimistic < 0 || mostLikely < 0 || pessimistic < 0) {
      throw new Error('All values must be non-negative');
    }

    if (optimistic > mostLikely) {
      throw new Error('Optimistic value must be less than or equal to most likely');
    }

    if (mostLikely > pessimistic) {
      throw new Error('Most likely value must be less than or equal to pessimistic');
    }
  }
}
