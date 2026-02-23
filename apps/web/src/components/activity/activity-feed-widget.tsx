'use client';

import Link from 'next/link';
import { Activity as ActivityIcon, ArrowRight, Loader2 } from 'lucide-react';

import { ActivityItem } from './activity-item';
import { trpc } from '@/lib/trpc';

export function ActivityFeedWidget(): React.ReactElement {
  const projectsQuery = trpc.project.list.useQuery({ organizationId: '' }, { retry: false });
  const projectList = projectsQuery.data ?? [];
  const orgId = projectList[0]?.organizationId ?? null;

  const activitiesQuery = trpc.activity.list.useQuery(
    {
      organizationId: orgId ?? '00000000-0000-0000-0000-000000000000',
      limit: 10,
      offset: 0,
    },
    {
      enabled: Boolean(orgId),
      retry: false,
    },
  );

  const activities = activitiesQuery.data?.activities ?? [];
  const isLoading = projectsQuery.isLoading || (Boolean(orgId) && activitiesQuery.isLoading);
  const hasError = projectsQuery.isError || activitiesQuery.isError;

  return (
    <section className="page-shell soft-surface noise-overlay">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ActivityIcon className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Recent Activity</h2>
        </div>
        <Link
          href="/dashboard/activity"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          View all
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : hasError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-950/20">
            <p className="text-sm text-red-600 dark:text-red-400">
              Failed to load activities. Please try again later.
            </p>
          </div>
        ) : activities.length === 0 ? (
          <div className="rounded-lg border bg-muted/30 p-8 text-center">
            <ActivityIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No activity yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Activity from your organization will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} showProject={true} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
