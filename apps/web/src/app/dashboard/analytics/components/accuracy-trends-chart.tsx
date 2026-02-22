'use client';

import { TrendingUp } from 'lucide-react';

import { cn } from '@/lib/utils';

interface AccuracyTrend {
  window: string;
  weeks: number;
  accuracyScore: number;
  taskCount: number;
  averageVariance: number;
}

interface AccuracyTrendsChartProps {
  data: AccuracyTrend[];
  isLoading?: boolean;
}

export function AccuracyTrendsChart({ data, isLoading }: AccuracyTrendsChartProps): React.ReactElement {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Accuracy Trends</h2>
        <div className="mt-4 text-sm text-muted-foreground">
          Loading accuracy trends...
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Accuracy Trends</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Not enough completed tasks with actual hours to show accuracy trends.
        </p>
      </div>
    );
  }

  const maxAccuracy = 100;
  const hasData = data.some((trend) => trend.taskCount > 0);

  if (!hasData) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Accuracy Trends</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Not enough completed tasks with actual hours to show accuracy trends.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Accuracy Trends</h2>
        <TrendingUp className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Estimation accuracy score over 4, 8, and 12 week periods
      </p>

      <div className="mt-6 space-y-6">
        {data.map((trend) => {
          const accuracyPercentage = Math.min((trend.accuracyScore / maxAccuracy) * 100, 100);
          const isGood = trend.accuracyScore >= 80;
          const isFair = trend.accuracyScore >= 60 && trend.accuracyScore < 80;
          const isPoor = trend.accuracyScore < 60;

          const barColor = isGood
            ? 'bg-green-500 dark:bg-green-600'
            : isFair
              ? 'bg-yellow-500 dark:bg-yellow-600'
              : 'bg-red-500 dark:bg-red-600';

          return (
            <div key={trend.window}>
              <div className="mb-2 flex items-baseline justify-between">
                <div className="flex items-baseline gap-3">
                  <span className="text-sm font-medium">{trend.window}</span>
                  <span
                    className={cn(
                      'text-2xl font-bold',
                      isGood && 'text-green-600 dark:text-green-500',
                      isFair && 'text-yellow-600 dark:text-yellow-500',
                      isPoor && 'text-red-600 dark:text-red-500',
                    )}
                  >
                    {trend.accuracyScore.toFixed(1)}%
                  </span>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>{trend.taskCount} tasks</div>
                  <div>
                    {trend.averageVariance >= 0 ? '+' : ''}
                    {trend.averageVariance.toFixed(1)}% variance
                  </div>
                </div>
              </div>

              <div className="relative h-8 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all', barColor)}
                  style={{ width: `${accuracyPercentage}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-px w-full bg-border" />
                  <div
                    className="absolute h-full border-r-2 border-dashed border-border"
                    style={{ left: '80%' }}
                  />
                </div>
              </div>

              {trend.taskCount === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  No completed tasks in this time window
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 space-y-2 rounded-md border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="font-medium">About Accuracy Score:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <span className="font-medium text-green-600 dark:text-green-500">80%+ = Good</span> - Estimates are close
            to actual effort
          </li>
          <li>
            <span className="font-medium text-yellow-600 dark:text-yellow-500">60-79% = Fair</span> - Room for
            improvement
          </li>
          <li>
            <span className="font-medium text-red-600 dark:text-red-500">&lt;60% = Needs attention</span> - Significant
            estimation gaps
          </li>
          <li>Variance shows the average over/under-estimation percentage</li>
        </ul>
      </div>
    </div>
  );
}
