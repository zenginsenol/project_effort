'use client';

import { Users } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

interface TeamBiasItem {
  dimension: 'type' | 'priority' | 'method' | 'user';
  value: string;
  taskCount: number;
  averageAccuracy: number;
  averageVariance: number;
  bias: string;
}

interface TeamBiasAnalysisProps {
  data: TeamBiasItem[];
  isLoading?: boolean;
}

const DIMENSION_LABELS: Record<TeamBiasItem['dimension'], string> = {
  type: 'Task Type',
  priority: 'Priority',
  method: 'Estimation Method',
  user: 'Team Member',
};

export function TeamBiasAnalysis({ data, isLoading }: TeamBiasAnalysisProps): React.ReactElement {
  const [selectedDimension, setSelectedDimension] = useState<TeamBiasItem['dimension']>('type');

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Team Bias Analysis</h2>
        <div className="mt-4 text-sm text-muted-foreground">
          Loading bias analysis...
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Team Bias Analysis</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Not enough completed tasks with actual hours to show bias analysis.
        </p>
      </div>
    );
  }

  const filteredData = data.filter((item) => item.dimension === selectedDimension);

  if (filteredData.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Team Bias Analysis</h2>
          <Users className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Estimation bias patterns by {DIMENSION_LABELS[selectedDimension].toLowerCase()}
        </p>

        <div className="mt-4 flex gap-2">
          {(['type', 'priority', 'method', 'user'] as const).map((dimension) => (
            <button
              key={dimension}
              onClick={() => setSelectedDimension(dimension)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                selectedDimension === dimension
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
              type="button"
            >
              {DIMENSION_LABELS[dimension]}
            </button>
          ))}
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          No data available for this dimension.
        </p>
      </div>
    );
  }

  const maxAbsVariance = Math.max(
    ...filteredData.map((item) => Math.abs(item.averageVariance)),
    20,
  );

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Team Bias Analysis</h2>
        <Users className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Estimation bias patterns by {DIMENSION_LABELS[selectedDimension].toLowerCase()}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(['type', 'priority', 'method', 'user'] as const).map((dimension) => (
          <button
            key={dimension}
            onClick={() => setSelectedDimension(dimension)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              selectedDimension === dimension
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
            type="button"
          >
            {DIMENSION_LABELS[dimension]}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-6">
        {filteredData.map((item) => {
          const variance = item.averageVariance;
          const isOptimistic = variance < -10;
          const isPessimistic = variance > 10;
          const isBalanced = !isOptimistic && !isPessimistic;

          const biasColor = isOptimistic
            ? 'bg-orange-500 dark:bg-orange-600'
            : isPessimistic
              ? 'bg-blue-500 dark:bg-blue-600'
              : 'bg-green-500 dark:bg-green-600';

          const biasTextColor = isOptimistic
            ? 'text-orange-600 dark:text-orange-500'
            : isPessimistic
              ? 'text-blue-600 dark:text-blue-500'
              : 'text-green-600 dark:text-green-500';

          const barWidth = Math.min((Math.abs(variance) / maxAbsVariance) * 100, 100);
          const biasLabel = isOptimistic
            ? 'Optimistic'
            : isPessimistic
              ? 'Pessimistic'
              : 'Balanced';

          return (
            <div key={`${item.dimension}-${item.value}`}>
              <div className="mb-2 flex items-baseline justify-between">
                <div className="flex items-baseline gap-3">
                  <span className="text-sm font-medium">{item.value}</span>
                  <span className={cn('text-lg font-bold', biasTextColor)}>
                    {variance >= 0 ? '+' : ''}
                    {variance.toFixed(1)}%
                  </span>
                  <span className={cn('text-xs font-medium', biasTextColor)}>
                    {biasLabel}
                  </span>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>{item.taskCount} tasks</div>
                  <div>{item.averageAccuracy.toFixed(1)}% accuracy</div>
                </div>
              </div>

              <div className="relative h-8 overflow-hidden rounded-full bg-muted">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-px w-full bg-border" />
                  <div
                    className="absolute h-full w-0.5 bg-border"
                    style={{ left: '50%' }}
                  />
                </div>
                {variance < 0 ? (
                  <div
                    className={cn('absolute right-1/2 h-full rounded-l-full transition-all', biasColor)}
                    style={{ width: `${barWidth / 2}%` }}
                  />
                ) : (
                  <div
                    className={cn('absolute left-1/2 h-full rounded-r-full transition-all', biasColor)}
                    style={{ width: `${barWidth / 2}%` }}
                  />
                )}
              </div>

              {item.taskCount < 3 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Low sample size - results may not be representative
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 space-y-2 rounded-md border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="font-medium">About Bias Analysis:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <span className="font-medium text-orange-600 dark:text-orange-500">Optimistic (&lt;-10%)</span> - Team
            consistently underestimates effort
          </li>
          <li>
            <span className="font-medium text-blue-600 dark:text-blue-500">Pessimistic (&gt;+10%)</span> - Team
            consistently overestimates effort
          </li>
          <li>
            <span className="font-medium text-green-600 dark:text-green-500">Balanced (-10% to +10%)</span> - Estimates
            are well-calibrated
          </li>
          <li>Variance shows the average percentage difference: (actual - estimated) / estimated × 100</li>
        </ul>
      </div>
    </div>
  );
}
