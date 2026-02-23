'use client';

import { Lightbulb, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';

interface CalibrationRecommendation {
  category: string;
  adjustmentFactor: number;
  description: string;
  confidence: number;
}

interface CalibrationRecommendationsData {
  recommendations: CalibrationRecommendation[];
  overallInsight: string;
}

interface CalibrationRecommendationsProps {
  data: CalibrationRecommendationsData | undefined;
  isLoading?: boolean;
}

export function CalibrationRecommendations({
  data,
  isLoading,
}: CalibrationRecommendationsProps): React.ReactElement {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">AI Calibration Recommendations</h2>
        <div className="mt-4 text-sm text-muted-foreground">
          Generating AI-powered calibration insights...
        </div>
      </div>
    );
  }

  if (!data || data.recommendations.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">AI Calibration Recommendations</h2>
          <Sparkles className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          {data?.overallInsight || 'Not enough historical data to generate calibration recommendations. Complete more tasks with actual hours to unlock AI insights.'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">AI Calibration Recommendations</h2>
        <Sparkles className="h-5 w-5 text-purple-500 dark:text-purple-400" />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        AI-powered suggestions to improve future estimation accuracy
      </p>

      {data.overallInsight && (
        <div className="mt-4 rounded-md border border-purple-200 bg-purple-50 p-4 dark:border-purple-900/50 dark:bg-purple-950/20">
          <div className="flex items-start gap-3">
            <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-purple-600 dark:text-purple-400" />
            <div>
              <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                Overall Insight
              </p>
              <p className="mt-1 text-sm text-purple-800 dark:text-purple-200">
                {data.overallInsight}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {data.recommendations.map((rec, index) => {
          const adjustmentPercentage = Math.abs((rec.adjustmentFactor - 1.0) * 100);
          const isBuffer = rec.adjustmentFactor > 1.0;
          const isReduction = rec.adjustmentFactor < 1.0;
          const isNeutral = Math.abs(rec.adjustmentFactor - 1.0) < 0.05;

          const confidencePercentage = rec.confidence * 100;
          const isHighConfidence = rec.confidence >= 0.7;
          const isMediumConfidence = rec.confidence >= 0.4 && rec.confidence < 0.7;
          const isLowConfidence = rec.confidence < 0.4;

          const confidenceColor = isHighConfidence
            ? 'bg-green-500 dark:bg-green-600'
            : isMediumConfidence
              ? 'bg-yellow-500 dark:bg-yellow-600'
              : 'bg-orange-500 dark:bg-orange-600';

          const confidenceTextColor = isHighConfidence
            ? 'text-green-600 dark:text-green-500'
            : isMediumConfidence
              ? 'text-yellow-600 dark:text-yellow-500'
              : 'text-orange-600 dark:text-orange-500';

          const adjustmentColor = isNeutral
            ? 'text-gray-600 dark:text-gray-400'
            : isBuffer
              ? 'text-orange-600 dark:text-orange-500'
              : 'text-blue-600 dark:text-blue-500';

          return (
            <div
              key={`${rec.category}-${index}`}
              className="rounded-lg border bg-muted/30 p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{rec.category}</h3>
                    {!isNeutral && (
                      <span className={cn('text-lg font-bold', adjustmentColor)}>
                        {rec.adjustmentFactor.toFixed(2)}x
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {rec.description}
                  </p>
                  {!isNeutral && (
                    <p className="mt-2 text-xs font-medium text-foreground">
                      {isBuffer ? (
                        <>
                          💡 Apply a <span className="text-orange-600 dark:text-orange-500">+{adjustmentPercentage.toFixed(0)}% buffer</span> to estimates
                        </>
                      ) : (
                        <>
                          💡 Consider a <span className="text-blue-600 dark:text-blue-500">-{adjustmentPercentage.toFixed(0)}% reduction</span> to estimates
                        </>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Confidence</p>
                    <p className={cn('text-sm font-bold', confidenceTextColor)}>
                      {confidencePercentage.toFixed(0)}%
                    </p>
                  </div>
                  <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full transition-all', confidenceColor)}
                      style={{ width: `${confidencePercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 space-y-2 rounded-md border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="font-medium">About Adjustment Factors:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <span className="font-medium text-orange-600 dark:text-orange-500">&gt;1.0x = Buffer</span> - Team tends to
            underestimate (e.g., 1.3x means add 30% buffer)
          </li>
          <li>
            <span className="font-medium text-blue-600 dark:text-blue-500">&lt;1.0x = Reduction</span> - Team tends to
            overestimate (e.g., 0.8x means reduce by 20%)
          </li>
          <li>
            <span className="font-medium text-gray-600 dark:text-gray-400">~1.0x = Neutral</span> - Estimates are
            well-calibrated for this category
          </li>
          <li>Higher confidence = More historical data supporting the recommendation</li>
        </ul>
      </div>
    </div>
  );
}
