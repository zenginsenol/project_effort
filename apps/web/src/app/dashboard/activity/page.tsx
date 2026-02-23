'use client';

import { Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { ActivityFilters } from '@/components/activity/activity-filters';
import { ActivityItem } from '@/components/activity/activity-item';
import { trpc } from '@/lib/trpc';

const ITEMS_PER_PAGE = 20;

export default function ActivityPage(): React.ReactElement {
  const [filters, setFilters] = useState<{
    projectId?: string;
    activityType?: string;
    actorId?: string;
    startDate?: string;
    endDate?: string;
  }>({});
  const [page, setPage] = useState(0);

  const projectsQuery = trpc.project.list.useQuery({ organizationId: '' }, { retry: false });
  const orgId = projectsQuery.data?.[0]?.organizationId ?? null;

  const activitiesQuery = trpc.activity.list.useQuery(
    {
      organizationId: orgId ?? '',
      projectId: filters.projectId,
      activityType: filters.activityType,
      actorId: filters.actorId,
      startDate: filters.startDate,
      endDate: filters.endDate,
      limit: ITEMS_PER_PAGE,
      offset: page * ITEMS_PER_PAGE,
    },
    {
      retry: false,
      enabled: Boolean(orgId),
    },
  );

  const activities = activitiesQuery.data?.activities ?? [];
  const totalCount = activitiesQuery.data?.total ?? 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const hasNextPage = page < totalPages - 1;
  const hasPrevPage = page > 0;

  function handleFiltersChange(newFilters: typeof filters): void {
    setFilters(newFilters);
    setPage(0);
  }

  function handleNextPage(): void {
    if (hasNextPage) {
      setPage(page + 1);
    }
  }

  function handlePrevPage(): void {
    if (hasPrevPage) {
      setPage(page - 1);
    }
  }

  const isLoading = activitiesQuery.isLoading || projectsQuery.isLoading;
  const hasError = activitiesQuery.isError || projectsQuery.isError;

  return (
    <div className="space-y-6">
      <div className="page-shell soft-surface noise-overlay">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="status-pill status-tone-in-progress">Activity Feed</span>
            <h1 className="mt-3 text-2xl font-bold md:text-3xl">Organization Activity</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track all recent actions across your projects, tasks, sessions, and team activity.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-md border bg-background/85 px-3 py-2 text-sm font-medium">
              <Activity className="h-4 w-4 text-primary" />
              {totalCount} {totalCount === 1 ? 'activity' : 'activities'}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="dashboard-panel border-blue-300/60 bg-blue-100/55 p-3 dark:border-blue-800 dark:bg-blue-950/30">
            <p className="inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-200">
              <Activity className="h-3.5 w-3.5" />
              Total Activities
            </p>
            <p className="mt-1 text-2xl font-semibold">{totalCount}</p>
          </div>
          <div className="dashboard-panel border-emerald-300/60 bg-emerald-100/55 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
            <p className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-200">
              <Activity className="h-3.5 w-3.5" />
              Current Page
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {page + 1} / {Math.max(totalPages, 1)}
            </p>
          </div>
          <div className="dashboard-panel border-amber-300/60 bg-amber-100/55 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-200">
              <Activity className="h-3.5 w-3.5" />
              Showing
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {activities.length} {activities.length === 1 ? 'item' : 'items'}
            </p>
          </div>
        </div>
      </div>

      {orgId && (
        <div className="page-shell soft-surface">
          <ActivityFilters organizationId={orgId} filters={filters} onFiltersChange={handleFiltersChange} />
        </div>
      )}

      <div className="page-shell soft-surface">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Recent Activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            View all actions performed across your organization.
          </p>
        </div>

        {isLoading && (
          <div className="py-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            <p className="mt-3 text-sm text-muted-foreground">Loading activities...</p>
          </div>
        )}

        {hasError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
            <p className="text-sm text-red-700 dark:text-red-200">Failed to load activities. Please try again.</p>
          </div>
        )}

        {!isLoading && !hasError && activities.length === 0 && (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 py-12 text-center">
            <Activity className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-sm font-medium">No activities found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {Object.keys(filters).some((key) => filters[key as keyof typeof filters])
                ? 'Try adjusting your filters to see more results.'
                : 'Activities will appear here as your team works on projects.'}
            </p>
          </div>
        )}

        {!isLoading && !hasError && activities.length > 0 && (
          <>
            <div className="space-y-3">
              {activities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} showProject={!filters.projectId} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {page * ITEMS_PER_PAGE + 1} to {Math.min((page + 1) * ITEMS_PER_PAGE, totalCount)} of {totalCount} activities
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevPage}
                    disabled={!hasPrevPage}
                    className="inline-flex items-center gap-1 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                  <span className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={!hasNextPage}
                    className="inline-flex items-center gap-1 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
