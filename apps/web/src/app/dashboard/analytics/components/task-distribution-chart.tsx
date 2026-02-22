'use client';

import { cn } from '@/lib/utils';

interface TaskDistributionChartProps {
  taskStatuses: Array<{ status: string; count: number }>;
  totalTasks: number;
}

export function TaskDistributionChart({ taskStatuses, totalTasks }: TaskDistributionChartProps): React.ReactElement {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">Task Distribution</h2>
      <div className="mt-4 space-y-3">
        {taskStatuses.map(({ status, count }) => {
          const colors: Record<string, string> = {
            backlog: 'bg-gray-400',
            todo: 'bg-blue-400',
            in_progress: 'bg-yellow-400',
            in_review: 'bg-purple-400',
            done: 'bg-green-400',
            cancelled: 'bg-red-400',
          };
          const percentage = totalTasks > 0 ? (count / totalTasks) * 100 : 0;
          return (
            <div key={status}>
              <div className="flex items-center justify-between text-sm">
                <span className="capitalize">{status.replace('_', ' ')}</span>
                <span className="font-medium">{count}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full', colors[status] ?? 'bg-gray-400')}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
        {taskStatuses.length === 0 && (
          <p className="text-sm text-muted-foreground">No task data available.</p>
        )}
      </div>
    </div>
  );
}
