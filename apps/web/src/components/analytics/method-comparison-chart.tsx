'use client';

import { BarChart3 } from 'lucide-react';

import { cn } from '@/lib/utils';

type EstimationMethod = 'planning_poker' | 'tshirt_sizing' | 'pert' | 'wideband_delphi';

interface TaskComparison {
  taskId: string;
  taskName: string;
  estimates: Record<string, number>;
}

interface MethodComparisonChartProps {
  taskComparisons: TaskComparison[];
  className?: string;
}

const METHOD_COLORS: Record<EstimationMethod, string> = {
  planning_poker: '#3b82f6', // blue-500
  tshirt_sizing: '#10b981', // green-500
  pert: '#8b5cf6', // purple-500
  wideband_delphi: '#f59e0b', // amber-500
};

const METHOD_LABELS: Record<EstimationMethod, string> = {
  planning_poker: 'Planning Poker',
  tshirt_sizing: 'T-Shirt Sizing',
  pert: 'PERT',
  wideband_delphi: 'Wideband Delphi',
};

export function MethodComparisonChart({ taskComparisons, className }: MethodComparisonChartProps): React.ReactElement {
  if (taskComparisons.length === 0) {
    return (
      <div className={cn('rounded-lg border bg-card p-6 text-center', className)}>
        <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">No task comparison data available</p>
      </div>
    );
  }

  // Extract all unique methods from the data
  const allMethods = Array.from(
    new Set(
      taskComparisons.flatMap((task) => Object.keys(task.estimates)),
    ),
  ) as EstimationMethod[];

  // Calculate max value for chart scaling
  const maxEstimate = Math.max(
    1,
    ...taskComparisons.flatMap((task) => Object.values(task.estimates)),
  );

  // Chart dimensions
  const chartHeight = 400;
  const chartPadding = { top: 20, right: 20, bottom: 80, left: 60 };
  const barGroupWidth = 100;
  const barWidth = Math.min(20, barGroupWidth / allMethods.length - 4);
  const chartWidth = Math.max(800, taskComparisons.length * (barGroupWidth + 20));
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;

  // Calculate scale
  const yScale = (value: number): number => {
    return plotHeight - (value / maxEstimate) * plotHeight;
  };

  return (
    <div className={cn('rounded-lg border bg-card p-6', className)}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-lg">Per-Task Estimate Comparison</h3>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-4">
        {allMethods.map((method) => (
          <div key={method} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded"
              style={{ backgroundColor: METHOD_COLORS[method] }}
            />
            <span className="text-sm text-muted-foreground">{METHOD_LABELS[method]}</span>
          </div>
        ))}
      </div>

      {/* Chart Container */}
      <div className="overflow-x-auto">
        <svg
          width={chartWidth}
          height={chartHeight}
          className="mx-auto"
        >
          {/* Y-axis grid lines and labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const value = maxEstimate * fraction;
            const y = chartPadding.top + yScale(value);

            return (
              <g key={fraction}>
                {/* Grid line */}
                <line
                  x1={chartPadding.left}
                  y1={y}
                  x2={chartWidth - chartPadding.right}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                  strokeDasharray="4"
                />
                {/* Y-axis label */}
                <text
                  x={chartPadding.left - 10}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-xs"
                >
                  {value.toFixed(0)}h
                </text>
              </g>
            );
          })}

          {/* X-axis line */}
          <line
            x1={chartPadding.left}
            y1={chartHeight - chartPadding.bottom}
            x2={chartWidth - chartPadding.right}
            y2={chartHeight - chartPadding.bottom}
            stroke="#e5e7eb"
            strokeWidth="2"
          />

          {/* Y-axis line */}
          <line
            x1={chartPadding.left}
            y1={chartPadding.top}
            x2={chartPadding.left}
            y2={chartHeight - chartPadding.bottom}
            stroke="#e5e7eb"
            strokeWidth="2"
          />

          {/* Bars and labels */}
          {taskComparisons.map((task, taskIndex) => {
            const groupX = chartPadding.left + taskIndex * (barGroupWidth + 20) + 30;

            return (
              <g key={task.taskId}>
                {/* Task name label */}
                <text
                  x={groupX + barGroupWidth / 2}
                  y={chartHeight - chartPadding.bottom + 15}
                  textAnchor="middle"
                  className="fill-foreground text-xs"
                >
                  <tspan x={groupX + barGroupWidth / 2} dy="0">
                    {task.taskName.length > 20 ? `${task.taskName.slice(0, 17)}...` : task.taskName}
                  </tspan>
                </text>

                {/* Bars for each method */}
                {allMethods.map((method, methodIndex) => {
                  const estimate = task.estimates[method] ?? 0;
                  const barX = groupX + methodIndex * (barWidth + 4);
                  const barY = chartPadding.top + yScale(estimate);
                  const barHeight = plotHeight - yScale(estimate);

                  return (
                    <g key={method}>
                      {/* Bar */}
                      <rect
                        x={barX}
                        y={barY}
                        width={barWidth}
                        height={barHeight}
                        fill={METHOD_COLORS[method]}
                        className="transition-opacity hover:opacity-80"
                      >
                        <title>{`${METHOD_LABELS[method]}: ${estimate.toFixed(1)}h`}</title>
                      </rect>

                      {/* Value label on top of bar */}
                      {estimate > 0 && barHeight > 20 && (
                        <text
                          x={barX + barWidth / 2}
                          y={barY - 4}
                          textAnchor="middle"
                          className="fill-muted-foreground text-[10px]"
                        >
                          {estimate.toFixed(1)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Y-axis label */}
          <text
            x={20}
            y={chartHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90, 20, ${chartHeight / 2})`}
            className="fill-muted-foreground text-sm font-medium"
          >
            Estimated Hours
          </text>
        </svg>
      </div>

      {/* Summary */}
      <div className="mt-4 rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">
        Showing {taskComparisons.length} task{taskComparisons.length !== 1 ? 's' : ''} with estimates
        from {allMethods.length} method{allMethods.length !== 1 ? 's' : ''}. Hover over bars to see exact values.
      </div>
    </div>
  );
}
