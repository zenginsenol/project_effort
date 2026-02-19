'use client';

import { BarChart3, Target, TrendingUp, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

export default function AnalyticsPage(): React.ReactElement {
  const utils = trpc.useUtils();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [exportingFormat, setExportingFormat] = useState<'csv' | 'xlsx' | 'pdf' | null>(null);

  const orgsQuery = trpc.organization.list.useQuery(undefined, { retry: false });
  const orgId = orgsQuery.data?.[0]?.id ?? '';

  const projectsQuery = trpc.project.list.useQuery(
    { organizationId: orgId },
    { enabled: Boolean(orgId), retry: false },
  );

  useEffect(() => {
    if (!selectedProjectId && projectsQuery.data?.[0]?.id) {
      setSelectedProjectId(projectsQuery.data[0].id);
    }
  }, [projectsQuery.data, selectedProjectId]);

  const overviewQuery = trpc.analytics.overview.useQuery(
    { projectId: selectedProjectId },
    { enabled: Boolean(selectedProjectId), retry: false },
  );

  const velocityQuery = trpc.analytics.velocity.useQuery(
    { projectId: selectedProjectId, sprintCount: 6 },
    { enabled: Boolean(selectedProjectId), retry: false },
  );

  const accuracyQuery = trpc.analytics.accuracy.useQuery(
    { projectId: selectedProjectId },
    { enabled: Boolean(selectedProjectId), retry: false },
  );

  const teamBiasQuery = trpc.analytics.teamBias.useQuery(
    { projectId: selectedProjectId },
    { enabled: Boolean(selectedProjectId), retry: false },
  );

  const burndownQuery = trpc.analytics.burndown.useQuery(
    { projectId: selectedProjectId, days: 30 },
    { enabled: Boolean(selectedProjectId), retry: false },
  );

  const overview = overviewQuery.data;
  const velocity = velocityQuery.data ?? [];
  const maxVelocity = Math.max(1, ...velocity.flatMap((item) => [item.plannedPoints, item.completedPoints]));

  const taskStatuses = useMemo(() => {
    if (!overview?.tasksByStatus) {
      return [] as Array<{ status: string; count: number }>;
    }
    return Object.entries(overview.tasksByStatus).map(([status, count]) => ({
      status,
      count: Number(count),
    }));
  }, [overview?.tasksByStatus]);

  const loading = overviewQuery.isLoading
    || velocityQuery.isLoading
    || accuracyQuery.isLoading
    || teamBiasQuery.isLoading
    || burndownQuery.isLoading;

  async function handleExportCsv(): Promise<void> {
    if (!selectedProjectId || exportingFormat) {
      return;
    }

    try {
      setExportingFormat('csv');
      const response = await utils.analytics.exportCsv.fetch({ projectId: selectedProjectId });
      const blob = new Blob([response.content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = response.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExportingFormat(null);
    }
  }

  async function handleExportXlsx(): Promise<void> {
    if (!selectedProjectId || exportingFormat) {
      return;
    }

    try {
      setExportingFormat('xlsx');
      const response = await utils.analytics.exportXlsx.fetch({ projectId: selectedProjectId });
      const binary = Uint8Array.from(atob(response.contentBase64), (char) => char.charCodeAt(0));
      const blob = new Blob([binary], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = response.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExportingFormat(null);
    }
  }

  async function handleExportPdf(): Promise<void> {
    if (!selectedProjectId || exportingFormat) {
      return;
    }

    try {
      setExportingFormat('pdf');
      const response = await utils.analytics.exportPdf.fetch({ projectId: selectedProjectId });
      const binary = Uint8Array.from(atob(response.contentBase64), (char) => char.charCodeAt(0));
      const blob = new Blob([binary], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = response.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExportingFormat(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Analytics</h1>
      <p className="mt-1 text-muted-foreground">Project performance insights and trends.</p>

      <div className="mt-6 rounded-lg border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Select project</option>
            {(projectsQuery.data ?? []).map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
          <div className="flex items-center text-xs text-muted-foreground sm:col-span-2">
            Data source: analytics tRPC router (`overview`, `velocity`, `accuracy`, `teamBias`).
          </div>
        </div>
      </div>

      {loading && selectedProjectId && (
        <div className="mt-6 rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Loading analytics data...
        </div>
      )}

      {!selectedProjectId && (
        <div className="mt-6 rounded-lg border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">
          Select a project to load analytics.
        </div>
      )}

      {selectedProjectId && overview && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'Completion Rate',
                value: `${overview.completionRate}%`,
                icon: Target,
                color: 'text-green-600',
              },
              {
                label: 'Avg Story Points',
                value: overview.averagePoints.toFixed(1),
                icon: BarChart3,
                color: 'text-blue-600',
              },
              {
                label: 'Avg Hours',
                value: overview.averageHours.toFixed(1),
                icon: TrendingUp,
                color: 'text-purple-600',
              },
              {
                label: 'Sessions',
                value: String(overview.totalSessions),
                icon: Users,
                color: 'text-orange-600',
              },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border bg-card p-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
                  <stat.icon className={cn('h-5 w-5', stat.color)} />
                </div>
                <p className="mt-2 text-3xl font-bold">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
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
                  const percentage = overview.totalTasks > 0 ? (count / overview.totalTasks) * 100 : 0;
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
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold">Estimation Accuracy</h2>
              <div className="mt-4 space-y-2">
                {(accuracyQuery.data ?? []).slice(0, 8).map((item) => (
                  <div key={item.taskId} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Est: {item.estimated ?? '-'}h • Actual: {item.actual ?? '-'}h • Variance: {item.variance ?? '-'}%
                    </p>
                  </div>
                ))}
                {(accuracyQuery.data?.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground">No completed tasks with actual hours yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold">Team Bias</h2>
              <div className="mt-4 space-y-2">
                {(teamBiasQuery.data ?? []).map((item) => (
                  <div key={item.userId} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">User: {item.userId}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Avg estimate: {item.averageEstimate.toFixed(2)} • Entries: {item.totalEstimates}
                    </p>
                  </div>
                ))}
                {(teamBiasQuery.data?.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground">No estimation vote data available.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold">Burndown / Burnup (30 days)</h2>
            <div className="mt-4">
              {(burndownQuery.data ?? []).length > 0 ? (
                <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ height: '220px' }}>
                  {(burndownQuery.data ?? []).map((point) => {
                    const maxScope = Math.max(...(burndownQuery.data ?? []).map((item) => item.scope), 1);
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

          <div className="mt-6 rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold">Export Report</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              CSV/PDF/XLSX export actions are tracked in Phase D export tasks.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => { void handleExportCsv(); }}
                disabled={Boolean(exportingFormat)}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                {exportingFormat === 'csv' ? 'Exporting...' : 'Export as CSV'}
              </button>
              <button
                onClick={() => { void handleExportXlsx(); }}
                disabled={Boolean(exportingFormat)}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                {exportingFormat === 'xlsx' ? 'Exporting...' : 'Export as Excel'}
              </button>
              <button
                onClick={() => { void handleExportPdf(); }}
                disabled={Boolean(exportingFormat)}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                {exportingFormat === 'pdf' ? 'Exporting...' : 'Export as PDF'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
