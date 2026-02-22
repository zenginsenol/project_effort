'use client';

interface BurndownChartProps {
  burndownData: Array<{
    date: string;
    scope: number;
    remaining: number;
    completed: number;
    idealRemaining: number;
  }>;
}

export function BurndownChart({ burndownData }: BurndownChartProps): React.ReactElement {
  const maxScope = Math.max(...burndownData.map((item) => item.scope), 1);

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">Burndown / Burnup (30 days)</h2>
      <div className="mt-4">
        {burndownData.length > 0 ? (
          <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ height: '220px' }}>
            {burndownData.map((point) => {
              const remainingHeight = (point.remaining / maxScope) * 100;
              const completedHeight = (point.completed / maxScope) * 100;
              const idealHeight = (point.idealRemaining / maxScope) * 100;
              return (
                <div key={point.date} className="flex min-w-[20px] flex-col items-center gap-1">
                  <div className="relative flex w-5 flex-col justify-end rounded bg-muted/40" style={{ height: '180px' }}>
                    <div
                      className="w-full rounded-t bg-green-400/80"
                      style={{ height: `${completedHeight}%` }}
                      title={`Completed: ${point.completed}`}
                    />
                    <div
                      className="w-full bg-red-400/80"
                      style={{ height: `${remainingHeight}%` }}
                      title={`Remaining: ${point.remaining}`}
                    />
                    <div
                      className="absolute left-0 right-0 border-t-2 border-blue-500"
                      style={{ bottom: `${idealHeight}%` }}
                      title={`Ideal Remaining: ${point.idealRemaining}`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{point.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Not enough task history for burndown data.</p>
        )}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-green-400" /> Burnup (completed)</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-red-400" /> Burndown (remaining)</span>
          <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-blue-500" /> Ideal line</span>
        </div>
      </div>
    </div>
  );
}
