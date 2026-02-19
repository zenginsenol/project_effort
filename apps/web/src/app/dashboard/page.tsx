'use client';

import { useMemo, type ComponentType } from 'react';
import { BarChart3, FolderKanban, ListTodo, Users } from 'lucide-react';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

type StatCard = {
  name: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
};

export default function DashboardPage(): React.ReactElement {
  const projectsQuery = trpc.project.list.useQuery({ organizationId: '' }, { retry: false });

  const projectList = projectsQuery.data ?? [];
  const allTasks = useMemo(() => projectList.flatMap((project) => project.tasks ?? []), [projectList]);
  const activeTasks = useMemo(
    () => allTasks.filter((task) => ['backlog', 'todo', 'in_progress', 'in_review'].includes(task.status)).length,
    [allTasks],
  );
  const estimatedTasks = useMemo(
    () => allTasks.filter((task) => task.estimatedHours !== null || task.estimatedPoints !== null).length,
    [allTasks],
  );

  const orgId = projectList[0]?.organizationId ?? null;
  const teamQuery = trpc.team.list.useQuery(
    { organizationId: orgId ?? '00000000-0000-0000-0000-000000000000' },
    {
      enabled: Boolean(orgId),
      retry: false,
    },
  );

  const stats: StatCard[] = [
    { name: 'Total Projects', value: String(projectList.length), icon: FolderKanban, color: 'text-blue-600' },
    { name: 'Active Tasks', value: String(activeTasks), icon: ListTodo, color: 'text-green-600' },
    { name: 'Team Members', value: String(teamQuery.data?.length ?? 0), icon: Users, color: 'text-purple-600' },
    { name: 'Estimated Tasks', value: String(estimatedTasks), icon: BarChart3, color: 'text-orange-600' },
  ];

  const recentTasks = useMemo(() => {
    return [...allTasks]
      .sort((a, b) => {
        const aDate = new Date(a.updatedAt).getTime();
        const bDate = new Date(b.updatedAt).getTime();
        return bDate - aDate;
      })
      .slice(0, 5);
  }, [allTasks]);

  const hasError = projectsQuery.isError || teamQuery.isError;
  const isLoading = projectsQuery.isLoading || teamQuery.isLoading;

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">Welcome to EstimatePro. Overview of your workspace.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{stat.name}</span>
              <stat.icon className={cn('h-5 w-5', stat.color)} />
            </div>
            <p className="mt-2 text-3xl font-bold">{isLoading ? '...' : stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">Recent Activity</h2>
        <div className="mt-4 rounded-lg border bg-card p-6">
          {hasError && (
            <p className="text-sm text-red-600">
              Failed to load dashboard data. Check authentication and organization context.
            </p>
          )}
          {!hasError && isLoading && (
            <p className="text-sm text-muted-foreground">Loading recent activity...</p>
          )}
          {!hasError && !isLoading && recentTasks.length === 0 && (
            <p className="text-sm text-muted-foreground">No recent activity. Create a project to get started.</p>
          )}
          {!hasError && !isLoading && recentTasks.length > 0 && (
            <div className="space-y-3">
              {recentTasks.map((task) => (
                <div key={task.id} className="rounded-md border p-3">
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Status: {task.status} | Updated: {new Date(task.updatedAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
