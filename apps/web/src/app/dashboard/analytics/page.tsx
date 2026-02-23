'use client';

import { BarChart3, Target, TrendingUp, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { AccuracyTrendsChart } from './components/accuracy-trends-chart';
import { CalibrationRecommendations } from './components/calibration-recommendations';
import { TeamBiasAnalysis } from './components/team-bias-analysis';

const TaskDistributionChart = dynamic(
  () => import('./components/task-distribution-chart').then((mod) => ({ default: mod.TaskDistributionChart })),
  {
    loading: () => (
      <div className="rounded-lg border bg-card p-6">
        <div className="h-64 animate-pulse bg-muted" />
      </div>
    ),
    ssr: false,
  },
);

const VelocityChart = dynamic(
  () => import('./components/velocity-chart').then((mod) => ({ default: mod.VelocityChart })),
  {
    loading: () => (
      <div className="rounded-lg border bg-card p-6">
        <div className="h-64 animate-pulse bg-muted" />
      </div>
    ),
    ssr: false,
  },
);

const EstimationAccuracyList = dynamic(
  () => import('./components/estimation-accuracy-list').then((mod) => ({ default: mod.EstimationAccuracyList })),
  {
    loading: () => (
      <div className="rounded-lg border bg-card p-6">
        <div className="h-64 animate-pulse bg-muted" />
      </div>
    ),
    ssr: false,
  },
);

const TeamBiasList = dynamic(
  () => import('./components/team-bias-list').then((mod) => ({ default: mod.TeamBiasList })),
  {
    loading: () => (
      <div className="rounded-lg border bg-card p-6">
        <div className="h-64 animate-pulse bg-muted" />
      </div>
    ),
    ssr: false,
  },
);

const BurndownChart = dynamic(
  () => import('./components/burndown-chart').then((mod) => ({ default: mod.BurndownChart })),
  {
    loading: () => (
      <div className="rounded-lg border bg-card p-6">
        <div className="h-64 animate-pulse bg-muted" />
      </div>
    ),
    ssr: false,
  },
);

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

  const accuracyTrendsQuery = trpc.analytics.accuracyTrends.useQuery(
    { projectId: selectedProjectId },
    { enabled: Boolean(selectedProjectId), retry: false },
  );

  const enhancedTeamBiasQuery = trpc.analytics.enhancedTeamBias.useQuery(
    { projectId: selectedProjectId, groupBy: 'taskType' },
    { enabled: Boolean(selectedProjectId), retry: false },
  );

  const calibrationRecommendationsQuery = trpc.analytics.calibrationRecommendations.useQuery(
    { projectId: selectedProjectId },
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
    || burndownQuery.isLoading
    || accuracyTrendsQuery.isLoading
    || enhancedTeamBiasQuery.isLoading
    || calibrationRecommendationsQuery.isLoading;

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
            <TaskDistributionChart taskStatuses={taskStatuses} totalTasks={overview.totalTasks} />
            <VelocityChart velocity={velocity} maxVelocity={maxVelocity} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <EstimationAccuracyList accuracyData={accuracyQuery.data ?? []} />
            <TeamBiasList teamBiasData={teamBiasQuery.data ?? []} />
          </div>

          <BurndownChart burndownData={burndownQuery.data ?? []} />

          <div className="mt-6">
            <AccuracyTrendsChart
              data={accuracyTrendsQuery.data ?? []}
              isLoading={accuracyTrendsQuery.isLoading}
            />
          </div>

          <div className="mt-6">
            <TeamBiasAnalysis
              data={enhancedTeamBiasQuery.data ?? []}
              isLoading={enhancedTeamBiasQuery.isLoading}
            />
          </div>

          <div className="mt-6">
            <CalibrationRecommendations
              data={calibrationRecommendationsQuery.data}
              isLoading={calibrationRecommendationsQuery.isLoading}
            />
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
