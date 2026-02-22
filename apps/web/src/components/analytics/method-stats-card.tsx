'use client';

import { BarChart3, TrendingUp } from 'lucide-react';

import { cn } from '@/lib/utils';

type EstimationMethod = 'planning_poker' | 'tshirt_sizing' | 'pert' | 'wideband_delphi';

interface ConfidenceInterval {
  lower: number;
  upper: number;
}

interface MethodStats {
  method: EstimationMethod;
  mean: number;
  median: number;
  standardDeviation: number;
  confidenceInterval: ConfidenceInterval;
  taskCount: number;
}

interface MethodStatsCardProps {
  stats: MethodStats;
  isRecommended?: boolean;
}

const METHOD_LABELS: Record<EstimationMethod, { name: string; icon: string }> = {
  planning_poker: { name: 'Planning Poker', icon: '🃏' },
  tshirt_sizing: { name: 'T-Shirt Sizing', icon: '👕' },
  pert: { name: 'PERT', icon: '📊' },
  wideband_delphi: { name: 'Wideband Delphi', icon: '🎯' },
};

export function MethodStatsCard({ stats, isRecommended = false }: MethodStatsCardProps): React.ReactElement {
  const methodInfo = METHOD_LABELS[stats.method];

  // Calculate coefficient of variation for visual indicator
  const coefficientOfVariation = stats.mean > 0 ? (stats.standardDeviation / stats.mean) * 100 : 0;

  // Determine variance level and color
  const varianceLevel = coefficientOfVariation < 20
    ? { label: 'Low Variance', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' }
    : coefficientOfVariation < 40
      ? { label: 'Medium Variance', color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' }
      : { label: 'High Variance', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' };

  return (
    <div className={cn(
      'rounded-xl border-2 p-4 transition-all',
      isRecommended
        ? 'border-primary/50 bg-primary/5 shadow-md'
        : 'border-border bg-card',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{methodInfo.icon}</span>
          <div>
            <h3 className="font-semibold text-lg">{methodInfo.name}</h3>
            <p className="text-xs text-muted-foreground">{stats.taskCount} tasks analyzed</p>
          </div>
        </div>
        {isRecommended && (
          <div className="flex items-center gap-1 rounded-full bg-primary px-3 py-1">
            <TrendingUp className="h-3 w-3 text-primary-foreground" />
            <span className="text-xs font-bold text-primary-foreground">Recommended</span>
          </div>
        )}
      </div>

      {/* Statistics Grid */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-background p-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <BarChart3 className="h-3 w-3" />
            <span>Mean</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-foreground">{stats.mean.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">hours</p>
        </div>

        <div className="rounded-lg bg-background p-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <BarChart3 className="h-3 w-3" />
            <span>Median</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-foreground">{stats.median.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">hours</p>
        </div>

        <div className="rounded-lg bg-background p-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <BarChart3 className="h-3 w-3" />
            <span>Std Dev</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-foreground">{stats.standardDeviation.toFixed(1)}</p>
          <p className={cn('text-xs font-medium', varianceLevel.color)}>
            {varianceLevel.label}
          </p>
        </div>

        <div className="rounded-lg bg-background p-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <BarChart3 className="h-3 w-3" />
            <span>95% CI</span>
          </div>
          <p className="mt-1 text-sm font-bold text-foreground">
            {stats.confidenceInterval.lower.toFixed(1)} - {stats.confidenceInterval.upper.toFixed(1)}
          </p>
          <p className="text-xs text-muted-foreground">hours</p>
        </div>
      </div>

      {/* Variance Indicator */}
      <div className={cn(
        'mt-3 rounded-md p-2 text-center',
        varianceLevel.bgColor,
        varianceLevel.borderColor,
        'border',
      )}>
        <p className={cn('text-xs font-semibold', varianceLevel.color)}>
          Coefficient of Variation: {coefficientOfVariation.toFixed(1)}%
        </p>
      </div>
    </div>
  );
}
