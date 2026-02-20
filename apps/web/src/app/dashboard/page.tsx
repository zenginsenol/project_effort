'use client';

import Link from 'next/link';
import { useMemo, type ComponentType } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FolderKanban,
  ListTodo,
  Loader2,
  Plug,
  Users,
} from 'lucide-react';

import { dashboardNavItems, workflowPhases } from '@/components/layout/navigation-data';
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
  const apiKeysQuery = trpc.apiKeys.list.useQuery(undefined, { retry: false });

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
  const doneTasks = useMemo(() => allTasks.filter((task) => task.status === 'done').length, [allTasks]);
  const firstProjectId = projectList[0]?.id ?? '';

  const orgId = projectList[0]?.organizationId ?? null;
  const teamQuery = trpc.team.list.useQuery(
    { organizationId: orgId ?? '00000000-0000-0000-0000-000000000000' },
    {
      enabled: Boolean(orgId),
      retry: false,
    },
  );
  const analysesQuery = trpc.effort.listAnalyses.useQuery(
    { projectId: firstProjectId },
    { enabled: Boolean(firstProjectId), retry: false },
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

  const activeProviders = useMemo(
    () => (apiKeysQuery.data ?? []).filter((key) => key.isActive).length,
    [apiKeysQuery.data],
  );

  const statusCounts = useMemo(() => {
    return allTasks.reduce<Record<string, number>>((acc, task) => {
      acc[task.status] = (acc[task.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [allTasks]);

  const completedPhases = useMemo(() => {
    let count = 0;
    if (allTasks.length > 0) {
      count += 1;
    }
    if (projectList.length > 0) {
      count += 1;
    }
    if (estimatedTasks > 0 && (analysesQuery.data?.length ?? 0) > 0) {
      count += 1;
    }
    if (activeProviders > 0 || doneTasks > 0) {
      count += 1;
    }
    return count;
  }, [activeProviders, allTasks.length, analysesQuery.data, doneTasks, estimatedTasks, projectList.length]);

  const hasError = projectsQuery.isError || teamQuery.isError || analysesQuery.isError || apiKeysQuery.isError;
  const isLoading = projectsQuery.isLoading
    || (Boolean(orgId) && teamQuery.isLoading)
    || (Boolean(firstProjectId) && analysesQuery.isLoading)
    || apiKeysQuery.isLoading;

  const flowCompletion = Math.round((completedPhases / workflowPhases.length) * 100);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-gradient-to-r from-primary/10 via-primary/5 to-background p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Go-live Control Center</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Dokumandan task cikarma, kanban planlama, cost analizi ve GitHub operasyonunu tek akista yonet.
            </p>
          </div>
          <Link
            href="/dashboard/analyzer"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Start from docs
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-card/70 p-3">
            <p className="text-xs text-muted-foreground">Flow Completion</p>
            <p className="mt-1 text-xl font-semibold">{flowCompletion}%</p>
            <p className="text-xs text-muted-foreground">
              {completedPhases}/{workflowPhases.length} phase completed
            </p>
          </div>
          <div className="rounded-lg border bg-card/70 p-3">
            <p className="text-xs text-muted-foreground">Saved Analyses</p>
            <p className="mt-1 text-xl font-semibold">{analysesQuery.data?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">for first active project</p>
          </div>
          <div className="rounded-lg border bg-card/70 p-3">
            <p className="text-xs text-muted-foreground">Active AI Providers</p>
            <p className="mt-1 text-xl font-semibold">{activeProviders}</p>
            <p className="text-xs text-muted-foreground">settings and compare-ready providers</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {workflowPhases.map((phase) => {
          const items = dashboardNavItems.filter((item) => item.phase === phase.phase);
          return (
            <article key={phase.phase} className="rounded-lg border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{phase.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{phase.subtitle}</p>
              <div className="mt-3 space-y-2">
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-start justify-between rounded-md border px-3 py-2 hover:bg-muted/40"
                  >
                    <span>
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <item.icon className="mt-0.5 h-4 w-4" />
                        {item.name}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
                    </span>
                    <ArrowRight className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Transfer Map</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Hangi cikti hangi modulde kullaniliyor bilgisini adim bazli izle.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">1) Analyzer output -&gt; Projects Kanban</p>
            <p className="mt-1 text-sm font-medium">{allTasks.length} task proje backloglarinda tutuluyor.</p>
            <Link href="/dashboard/projects" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Kanban projects
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">2) Kanban tasks -&gt; Effort snapshots</p>
            <p className="mt-1 text-sm font-medium">{estimatedTasks} task estimate-ready, {(analysesQuery.data?.length ?? 0)} snapshot saved.</p>
            <Link href="/dashboard/effort" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Effort workspace
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">3) Effort analyses -&gt; Compare</p>
            <p className="mt-1 text-sm font-medium">Model/provider senaryolari yan yana fiyat ve sure farklariyla kiyaslanir.</p>
            <Link href="/dashboard/compare" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Compare matrix
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">4) Final analyses -&gt; GitHub / Ops</p>
            <p className="mt-1 text-sm font-medium">Secilen analiz issue/export olarak aktarilir ve sprint operasyonuna girer.</p>
            <Link href="/dashboard/integrations" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Integration controls
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_360px]">
        <section className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <div className="mt-4">
            {hasError && (
              <p className="text-sm text-red-600">
                Failed to load dashboard data. Check authentication and organization context.
              </p>
            )}
            {!hasError && isLoading && (
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading recent activity...
              </p>
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
        </section>

        <section className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">Execution Pulse</h2>
          <div className="mt-4 space-y-2">
            {([
              { status: 'backlog', count: statusCounts.backlog ?? 0 },
              { status: 'todo', count: statusCounts.todo ?? 0 },
              { status: 'in_progress', count: statusCounts.in_progress ?? 0 },
              { status: 'in_review', count: statusCounts.in_review ?? 0 },
              { status: 'done', count: statusCounts.done ?? 0 },
            ]).map((row) => (
              <div key={row.status} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="text-muted-foreground">{row.status.replace('_', ' ')}</span>
                <span className={cn('font-semibold', row.status === 'done' ? 'text-green-600' : 'text-foreground')}>
                  {row.count}
                </span>
              </div>
            ))}
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              <p className="inline-flex items-center gap-1 font-medium text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                Go-live signal
              </p>
              <p className="mt-1">
                Done tasks: {doneTasks}, connected providers: {activeProviders}, integrations ready via settings/integrations.
              </p>
              <div className="mt-2 flex gap-2">
                <Link href="/dashboard/settings" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <Plug className="h-3.5 w-3.5" />
                  Settings
                </Link>
                <Link href="/dashboard/integrations" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <Plug className="h-3.5 w-3.5" />
                  Integrations
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
