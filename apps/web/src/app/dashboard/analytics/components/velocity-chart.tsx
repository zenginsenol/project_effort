'use client';

interface VelocityChartProps {
  velocity: Array<{
    sprintId: string;
    sprintName: string;
    plannedPoints: number;
    completedPoints: number;
  }>;
  maxVelocity: number;
}

export function VelocityChart({ velocity, maxVelocity }: VelocityChartProps): React.ReactElement {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">Sprint Velocity</h2>
      <div className="mt-4 flex items-end gap-2" style={{ height: '200px' }}>
        {velocity.map((sprint) => (
          <div key={sprint.sprintId} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full gap-0.5" style={{ height: '160px', alignItems: 'flex-end' }}>
              <div
                className="flex-1 rounded-t bg-blue-300 dark:bg-blue-700"
                style={{ height: `${(sprint.plannedPoints / maxVelocity) * 100}%` }}
                title={`Planned: ${sprint.plannedPoints}`}
              />
              <div
                className="flex-1 rounded-t bg-green-400 dark:bg-green-600"
                style={{ height: `${(sprint.completedPoints / maxVelocity) * 100}%` }}
                title={`Completed: ${sprint.completedPoints}`}
              />
            </div>
            <span className="text-xs text-muted-foreground">{sprint.sprintName.slice(0, 8)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-blue-300" /> Planned</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-green-400" /> Completed</span>
      </div>
      {velocity.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">No sprint velocity data yet.</p>
      )}
    </div>
  );
}
