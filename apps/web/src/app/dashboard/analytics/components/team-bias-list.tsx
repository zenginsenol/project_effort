'use client';

interface TeamBiasListProps {
  teamBiasData: Array<{
    userId: string;
    averageEstimate: number;
    totalEstimates: number;
  }>;
}

export function TeamBiasList({ teamBiasData }: TeamBiasListProps): React.ReactElement {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">Team Bias</h2>
      <div className="mt-4 space-y-2">
        {teamBiasData.map((item) => (
          <div key={item.userId} className="rounded-md border p-3 text-sm">
            <p className="font-medium">User: {item.userId}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Avg estimate: {item.averageEstimate.toFixed(2)} • Entries: {item.totalEstimates}
            </p>
          </div>
        ))}
        {teamBiasData.length === 0 && (
          <p className="text-sm text-muted-foreground">No estimation vote data available.</p>
        )}
      </div>
    </div>
  );
}
