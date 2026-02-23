'use client';

interface EstimationAccuracyListProps {
  accuracyData: Array<{
    taskId: string;
    title: string;
    estimated: number | null;
    actual: number | null;
    variance: number | null;
  }>;
}

export function EstimationAccuracyList({ accuracyData }: EstimationAccuracyListProps): React.ReactElement {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">Estimation Accuracy</h2>
      <div className="mt-4 space-y-2">
        {accuracyData.slice(0, 8).map((item) => (
          <div key={item.taskId} className="rounded-md border p-3 text-sm">
            <p className="font-medium">{item.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Est: {item.estimated ?? '-'}h • Actual: {item.actual ?? '-'}h • Variance: {item.variance ?? '-'}%
            </p>
          </div>
        ))}
        {accuracyData.length === 0 && (
          <p className="text-sm text-muted-foreground">No completed tasks with actual hours yet.</p>
        )}
      </div>
    </div>
  );
}
