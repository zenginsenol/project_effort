'use client';

import { useState } from 'react';

export function PertForm(): React.ReactElement {
  const [optimistic, setOptimistic] = useState('');
  const [mostLikely, setMostLikely] = useState('');
  const [pessimistic, setPessimistic] = useState('');
  const [result, setResult] = useState<{
    expected: number;
    stdDev: number;
    low: number;
    high: number;
  } | null>(null);

  function calculate(): void {
    const o = Number(optimistic);
    const m = Number(mostLikely);
    const p = Number(pessimistic);

    if (isNaN(o) || isNaN(m) || isNaN(p) || o < 0 || m < 0 || p < 0) return;
    if (o > m || m > p) return;

    const expected = (o + 4 * m + p) / 6;
    const stdDev = (p - o) / 6;

    setResult({
      expected: Math.round(expected * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      low: Math.round((expected - 2 * stdDev) * 100) / 100,
      high: Math.round((expected + 2 * stdDev) * 100) / 100,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">PERT Estimation</h3>
        <p className="text-sm text-muted-foreground">
          Three-point estimation: (O + 4M + P) / 6
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium">Optimistic (O)</label>
          <input
            type="number"
            min="0"
            value={optimistic}
            onChange={(e) => setOptimistic(e.target.value)}
            placeholder="Best case"
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Most Likely (M)</label>
          <input
            type="number"
            min="0"
            value={mostLikely}
            onChange={(e) => setMostLikely(e.target.value)}
            placeholder="Expected case"
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Pessimistic (P)</label>
          <input
            type="number"
            min="0"
            value={pessimistic}
            onChange={(e) => setPessimistic(e.target.value)}
            placeholder="Worst case"
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <button
        onClick={calculate}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Calculate
      </button>

      {result && (
        <div className="rounded-lg border bg-card p-6">
          <h4 className="mb-4 font-semibold">Results</h4>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{result.expected}</p>
              <p className="text-xs text-muted-foreground">Expected</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{result.stdDev}</p>
              <p className="text-xs text-muted-foreground">Std Dev</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{result.low}</p>
              <p className="text-xs text-muted-foreground">95% Low</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{result.high}</p>
              <p className="text-xs text-muted-foreground">95% High</p>
            </div>
          </div>

          {/* Simple bar visualization */}
          <div className="mt-6">
            <div className="relative h-8 overflow-hidden rounded-full bg-muted">
              <div
                className="absolute inset-y-0 bg-gradient-to-r from-green-400 via-blue-500 to-red-400 opacity-30"
                style={{
                  left: `${Math.max(0, (result.low / result.high) * 100)}%`,
                  right: '0%',
                }}
              />
              <div
                className="absolute inset-y-0 w-1 bg-primary"
                style={{ left: `${(result.expected / result.high) * 100}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>{result.low}</span>
              <span>{result.expected}</span>
              <span>{result.high}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
