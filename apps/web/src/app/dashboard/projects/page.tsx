'use client';

import {
  ArrowRight,
  CheckCircle2,
  Brain,
  Calculator,
  CircleDashed,
  FolderKanban,
  GitCompare,
  LayoutGrid,
  ListTodo,
  Plus,
  Save,
  Sparkles,
  SquarePen,
  Timer,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { trpc } from '@/lib/trpc';

type EditableProject = {
  id: string;
  name: string;
  description: string;
};

export default function ProjectsPage(): React.ReactElement {
  const utils = trpc.useUtils();
  const projectsQuery = trpc.project.list.useInfiniteQuery(
    { organizationId: '', limit: 20 },
    {
      retry: false,
      getNextPageParam: (lastPage) => {
        // If the response has pagination property, use it
        if (lastPage && typeof lastPage === 'object' && 'pagination' in lastPage) {
          const paginatedResponse = lastPage as { pagination: { nextCursor: string | null; hasMore: boolean } };
          return paginatedResponse.pagination.hasMore ? paginatedResponse.pagination.nextCursor : undefined;
        }
        return undefined;
      },
    }
  );
  const orgsQuery = trpc.organization.list.useQuery(undefined, { retry: false });

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState<EditableProject | null>(null);

  // Extract projects from paginated pages
  const projects = useMemo(() => {
    if (!projectsQuery.data?.pages) return [];

    return projectsQuery.data.pages.flatMap((page) => {
      // Handle paginated response (has data property)
      if (page && typeof page === 'object' && 'data' in page && Array.isArray((page as { data: unknown }).data)) {
        return (page as { data: unknown[] }).data;
      }
      return [];
    });
  }, [projectsQuery.data?.pages]);

  const orgId = projects[0]?.organizationId ?? orgsQuery.data?.[0]?.id ?? null;

  const totalTasks = useMemo(
    () => projects.reduce((sum, project) => sum + (project.tasks?.length ?? 0), 0),
    [projects],
  );
  const doneTasks = useMemo(
    () => projects.reduce((sum, project) => sum + (project.tasks?.filter((task) => task.status === 'done').length ?? 0), 0),
    [projects],
  );
  const activeTasks = useMemo(
    () => projects.reduce((sum, project) => sum + (project.tasks?.filter((task) => ['todo', 'in_progress', 'in_review'].includes(task.status)).length ?? 0), 0),
    [projects],
  );
  const completion = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const workflowCards = [
    {
      title: '1) Ingest Scope',
      detail: 'PRD veya analiz dokumanindan task cikart.',
      href: '/dashboard/analyzer',
      icon: Brain,
      cardClass: 'border-sky-300/60 bg-sky-100/55 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/35',
      iconClass: 'text-sky-700 dark:text-sky-300',
    },
    {
      title: '2) Execute in Kanban',
      detail: 'Project board uzerinde backlog -> done akisina gec.',
      href: '/dashboard/projects',
      icon: LayoutGrid,
      cardClass: 'border-emerald-300/60 bg-emerald-100/55 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/35',
      iconClass: 'text-emerald-700 dark:text-emerald-300',
    },
    {
      title: '3) Estimate and Compare',
      detail: 'Efor maliyet hesapla, senaryolari compare et.',
      href: '/dashboard/effort',
      icon: Calculator,
      cardClass: 'border-amber-300/60 bg-amber-100/55 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/35',
      iconClass: 'text-amber-700 dark:text-amber-300',
    },
  ] as const;

  const createProject = trpc.project.create.useMutation({
    onMutate: async (input) => {
      const queryInput = { organizationId: '', limit: 20 };
      await utils.project.list.cancel(queryInput);

      const previous = utils.project.list.getInfiniteData(queryInput);

      // Optimistically add the new project to the cache
      utils.project.list.setInfiniteData(queryInput, (old) => {
        if (!old) {
          return old;
        }

        // Create optimistic project with temporary data
        const optimisticProject = {
          id: `temp-${Date.now()}`,
          organizationId: input.organizationId,
          name: input.name,
          key: input.key,
          description: input.description ?? '',
          status: 'active' as const,
          defaultEstimationMethod: input.defaultEstimationMethod,
          createdAt: new Date(),
          updatedAt: new Date(),
          tasks: [],
        };

        // Add to the first page
        const firstPage = old.pages[0];
        if (firstPage && typeof firstPage === 'object' && 'data' in firstPage) {
          return {
            ...old,
            pages: [
              { ...firstPage, data: [optimisticProject, ...(firstPage as { data: typeof optimisticProject[] }).data] },
              ...old.pages.slice(1),
            ],
          };
        }

        return old;
      });

      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        utils.project.list.setInfiniteData({ organizationId: '', limit: 20 }, context.previous);
      }
    },
    onSuccess: async () => {
      setName('');
      setKey('');
      setDescription('');
      await utils.project.list.invalidate();
    },
  });

  const updateProject = trpc.project.update.useMutation({
    onMutate: async (input) => {
      const queryInput = { organizationId: '', limit: 20 };
      await utils.project.list.cancel(queryInput);

      const previous = utils.project.list.getInfiniteData(queryInput);

      // Optimistically update the project in the cache
      utils.project.list.setInfiniteData(queryInput, (old) => {
        if (!old) {
          return old;
        }

        const { id, ...changes } = input;

        // Update the project in all pages
        return {
          ...old,
          pages: old.pages.map((page) => {
            if (page && typeof page === 'object' && 'data' in page && Array.isArray((page as { data: unknown[] }).data)) {
              const pageTyped = page as { data: Array<{ id: string; [key: string]: unknown }> };
              return {
                ...page,
                data: pageTyped.data.map((project) =>
                  project.id === id ? { ...project, ...changes, updatedAt: new Date() } : project
                ),
              };
            }
            return page;
          }),
        };
      });

      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        utils.project.list.setInfiniteData({ organizationId: '', limit: 20 }, context.previous);
      }
    },
    onSuccess: async () => {
      setEditing(null);
      await utils.project.list.invalidate();
    },
  });

  function handleCreate(): void {
    if (!orgId) {
      return;
    }
    createProject.mutate({
      organizationId: orgId,
      name: name.trim(),
      key: key.trim().toUpperCase(),
      description: description.trim() || undefined,
      defaultEstimationMethod: 'planning_poker',
    });
  }

  function handleSaveEdit(): void {
    if (!editing) {
      return;
    }
    updateProject.mutate({
      id: editing.id,
      name: editing.name.trim(),
      description: editing.description.trim() || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="page-shell soft-surface noise-overlay">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="status-pill status-tone-in-progress">Plan Phase</span>
            <h1 className="mt-3 text-2xl font-bold md:text-3xl">Kanban Project Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Projeleri kur, tasklari yonet, cost analizine gec ve ciktilari release akisina aktar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/analyzer"
              className="inline-flex items-center gap-2 rounded-md border bg-background/85 px-3 py-2 text-sm font-medium hover:bg-background"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              Analyze docs
            </Link>
            <Link
              href="/dashboard/effort"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Continue to cost
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="dashboard-panel border-sky-300/60 bg-sky-100/55 p-3 dark:border-sky-800 dark:bg-sky-950/30">
            <p className="inline-flex items-center gap-1 text-xs text-sky-700 dark:text-sky-200">
              <LayoutGrid className="h-3.5 w-3.5" />
              Projects
            </p>
            <p className="mt-1 text-2xl font-semibold">{projects.length}</p>
          </div>
          <div className="dashboard-panel border-amber-300/60 bg-amber-100/55 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-200">
              <Timer className="h-3.5 w-3.5" />
              Active Tasks
            </p>
            <p className="mt-1 text-2xl font-semibold">{activeTasks}</p>
          </div>
          <div className="dashboard-panel border-emerald-300/60 bg-emerald-100/55 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
            <p className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Completion
            </p>
            <p className="mt-1 text-2xl font-semibold">{completion}%</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {workflowCards.map((item, index) => (
          <Link
            key={item.title}
            href={item.href}
            className={`animate-fade-up rounded-xl border p-4 transition-transform hover:-translate-y-0.5 ${item.cardClass}`}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <p className="inline-flex items-center gap-2 text-sm font-semibold">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/40 bg-white/70 dark:bg-black/15">
                <item.icon className={`h-4 w-4 ${item.iconClass}`} />
              </span>
              {item.title}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
          </Link>
        ))}
      </div>

      <div>
        <div>
          <h2 className="text-xl font-semibold">Create Project</h2>
          <p className="mt-1 text-sm text-muted-foreground">Yeni proje olusturup tasklari kanban boardda yonet.</p>
        </div>
      </div>

      <div className="dashboard-panel soft-surface rounded-xl p-4">
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <input
            className="rounded-md border bg-background/80 px-3 py-2 text-sm"
            placeholder="Project Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            className="rounded-md border bg-background/80 px-3 py-2 text-sm uppercase"
            placeholder="KEY"
            value={key}
            maxLength={10}
            onChange={(event) => setKey(event.target.value)}
          />
          <input
            className="rounded-md border bg-background/80 px-3 py-2 text-sm"
            placeholder="Description (optional)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="mt-3">
          <button
            onClick={handleCreate}
            disabled={!orgId || !name.trim() || !key.trim() || createProject.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {createProject.isPending ? 'Creating...' : 'Create Project'}
          </button>
          {!orgId && (
            <p className="mt-2 text-xs text-amber-600">
              Organization context not available. Configure auth/org context first.
            </p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Projects & Transition Shortcuts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Her proje kartindan kanban, effort, compare ve analyzer akislari arasinda hizli gecis yap.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const isEditing = editing?.id === project.id;
          const projectTasks = project.tasks ?? [];
          const backlogCount = projectTasks.filter((task) => task.status === 'backlog').length;
          const activeCount = projectTasks.filter((task) => ['todo', 'in_progress', 'in_review'].includes(task.status)).length;
          const doneCount = projectTasks.filter((task) => task.status === 'done').length;
          const progress = projectTasks.length > 0 ? Math.round((doneCount / projectTasks.length) * 100) : 0;

          return (
            <div key={project.id} className="dashboard-panel soft-surface animate-fade-up rounded-xl p-4">
              {!isEditing ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="status-pill status-tone-backlog">{project.key}</p>
                      <h3 className="text-lg font-semibold">{project.name}</h3>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <ListTodo className="h-3.5 w-3.5" />
                        {projectTasks.length} tasks
                      </p>
                    </div>
                    <button
                      onClick={() => setEditing({ id: project.id, name: project.name, description: project.description ?? '' })}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted/70"
                    >
                      <SquarePen className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                    {project.description || 'No description'}
                  </p>
                  <div className="mt-3 rounded-md border border-border/70 bg-background/70 p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full bg-gradient-to-r ${progress >= 80 ? 'from-emerald-500 to-teal-500' : progress >= 40 ? 'from-amber-500 to-orange-500' : 'from-sky-500 to-indigo-500'} transition-all`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded border border-zinc-300/60 bg-zinc-100/70 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900/60">Backlog: {backlogCount}</div>
                      <div className="rounded border border-amber-300/60 bg-amber-100/70 px-2 py-1 dark:border-amber-700 dark:bg-amber-950/50">Active: {activeCount}</div>
                      <div className="rounded border border-emerald-300/60 bg-emerald-100/70 px-2 py-1 dark:border-emerald-700 dark:bg-emerald-950/50">Done: {doneCount}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Link
                      href={`/dashboard/projects/${project.id}?view=board`}
                      className="inline-flex items-center gap-2 rounded-md border border-emerald-300/50 bg-emerald-100/60 px-3 py-2 text-sm font-medium hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40"
                    >
                      <FolderKanban className="h-4 w-4" />
                      Open Kanban Board
                    </Link>
                    <Link
                      href={`/dashboard/effort?projectId=${project.id}`}
                      className="inline-flex items-center gap-2 rounded-md border border-amber-300/50 bg-amber-100/60 px-3 py-2 text-sm font-medium hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40"
                    >
                      <Calculator className="h-4 w-4" />
                      Run Effort/Cost
                    </Link>
                    <Link
                      href={`/dashboard/compare?projectId=${project.id}`}
                      className="inline-flex items-center gap-2 rounded-md border border-indigo-300/50 bg-indigo-100/60 px-3 py-2 text-sm font-medium hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40"
                    >
                      <GitCompare className="h-4 w-4" />
                      Compare AI Models
                    </Link>
                    <Link
                      href={`/dashboard/analyzer?projectId=${project.id}`}
                      className="inline-flex items-center gap-2 rounded-md border border-sky-300/50 bg-sky-100/60 px-3 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
                    >
                      <Brain className="h-4 w-4" />
                      Add Tasks from Docs
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <input
                    className="w-full rounded-md border bg-background/85 px-3 py-2 text-sm"
                    value={editing.name}
                    onChange={(event) => setEditing((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
                  />
                  <textarea
                    className="mt-2 h-24 w-full rounded-md border bg-background/85 px-3 py-2 text-sm"
                    value={editing.description}
                    onChange={(event) => setEditing((prev) => (prev ? { ...prev, description: event.target.value } : prev))}
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={!editing.name.trim() || updateProject.isPending}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Save
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {!projectsQuery.isLoading && projects.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/80 p-12 text-center">
            <CircleDashed className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No projects yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create your first project to start estimating.</p>
          </div>
        )}
      </div>

      {/* Load More button */}
      {projectsQuery.hasNextPage && (
        <div className="flex justify-center">
          <button
            onClick={() => projectsQuery.fetchNextPage()}
            disabled={projectsQuery.isFetchingNextPage}
            className="inline-flex items-center gap-2 rounded-md border bg-background/85 px-4 py-2 text-sm font-medium hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            {projectsQuery.isFetchingNextPage ? (
              <>
                <CircleDashed className="h-4 w-4 animate-spin" />
                Loading more...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Load more projects
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
