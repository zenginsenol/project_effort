'use client';

import { AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { AgreementScore } from '@/components/analytics/agreement-score';
import { MethodComparisonChart } from '@/components/analytics/method-comparison-chart';
import { MethodStatsCard } from '@/components/analytics/method-stats-card';
import { trpc } from '@/lib/trpc';

export default function MethodComparisonPage(): React.ReactElement {
  const utils = trpc.useUtils();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [exportingFormat, setExportingFormat] = useState<'csv' | 'xlsx' | null>(null);

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

  const methodComparisonQuery = trpc.analytics.methodComparison.useQuery(
    { projectId: selectedProjectId },
    { enabled: Boolean(selectedProjectId), retry: false },
  );

  const loading = methodComparisonQuery.isLoading;
  const error = methodComparisonQuery.error;
  const data = methodComparisonQuery.data;

  async function handleExportCsv(): Promise<void> {
    if (!selectedProjectId || exportingFormat) {
      return;
    }

    try {
      setExportingFormat('csv');
      const response = await utils.analytics.exportMethodComparisonCsv.fetch({ projectId: selectedProjectId });
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
      const response = await utils.analytics.exportMethodComparisonXlsx.fetch({ projectId: selectedProjectId });
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

  return (
    <div>
      <h1 className="text-2xl font-bold">Estimation Method Comparison</h1>
      <p className="mt-1 text-muted-foreground">
        Compare different estimation methods side-by-side to validate estimates and build confidence.
      </p>

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
            Data source: analytics tRPC router (`methodComparison`).
          </div>
        </div>
      </div>

      {loading && selectedProjectId && (
        <div className="mt-6 rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Loading method comparison data...
        </div>
      )}

      {!selectedProjectId && (
        <div className="mt-6 rounded-lg border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">
          Select a project to compare estimation methods.
        </div>
      )}

      {error && selectedProjectId && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <p className="font-semibold">Error loading data</p>
          </div>
          <p className="mt-2 text-sm text-red-600">{error.message}</p>
        </div>
      )}

      {selectedProjectId && data && !error && (
        <>
          {/* Export Section */}
          <div className="mt-6 rounded-lg border bg-card p-4">
            <h3 className="font-semibold mb-3">Export Data</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleExportCsv}
                disabled={exportingFormat !== null}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportingFormat === 'csv' ? 'Exporting CSV...' : 'Export CSV'}
              </button>
              <button
                onClick={handleExportXlsx}
                disabled={exportingFormat !== null}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportingFormat === 'xlsx' ? 'Exporting XLSX...' : 'Export XLSX'}
              </button>
            </div>
          </div>

          {/* Agreement Score Section */}
          <div className="mt-6">
            <AgreementScore
              score={data.agreementScore}
              description="Method agreement indicates how closely different estimation methods converged for this project"
            />
          </div>

          {/* Method Statistics Cards */}
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-4">Method Statistics</h2>
            {data.methodStats.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">
                No estimation data available for this project. Estimates need to be created using multiple methods.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.methodStats.map((stats) => (
                  <MethodStatsCard
                    key={stats.method}
                    stats={stats}
                    isRecommended={data.recommendation?.preferredMethod === stats.method}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Recommendation Section */}
          {data.recommendation && (
            <div className="mt-6 rounded-lg border bg-card p-6">
              <h2 className="text-xl font-semibold mb-2">Recommendation</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Based on variance analysis and historical accuracy
              </p>
              <div className="rounded-md bg-primary/5 border border-primary/20 p-4">
                <p className="text-sm">
                  <span className="font-semibold text-primary">Recommended: </span>
                  <span>{data.recommendation.reason}</span>
                </p>
              </div>
            </div>
          )}

          {/* Task Comparison Chart */}
          {data.taskComparisons.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-4">Per-Task Comparison</h2>
              <MethodComparisonChart taskComparisons={data.taskComparisons} />
            </div>
          )}

          {/* Summary Statistics */}
          {data.methodStats.length > 0 && (
            <div className="mt-6 rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-3">Summary</h3>
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Methods Analyzed:</span>
                  <span className="font-medium">{data.methodStats.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tasks Compared:</span>
                  <span className="font-medium">{data.taskComparisons.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agreement Score:</span>
                  <span className="font-medium">{Math.round(data.agreementScore)}%</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
