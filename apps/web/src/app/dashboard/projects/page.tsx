'use client';

import {
  ArrowRight,
  Brain,
  Calculator,
  FolderKanban,
  GitCompare,
  LayoutGrid,
  Plus,
  Save,
  SquarePen,
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
  const projectsQuery = trpc.project.list.useQuery({ organizationId: '' }, { retry: false });
  const orgsQuery = trpc.organization.list.useQuery(undefined, { retry: false });

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState<EditableProject | null>(null);

  const orgId = projectsQuery.data?.[0]?.organizationId ?? orgsQuery.data?.[0]?.id ?? null;
  const projects = projectsQuery.data ?? [];

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

  const createProject = trpc.project.create.useMutation({
    onSuccess: async () => {
      setName('');
      setKey('');
      setDescription('');
      await utils.project.list.invalidate();
    },
  });

  const updateProject = trpc.project.update.useMutation({
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
      <div className="rounded-xl border bg-gradient-to-r from-primary/10 via-primary/5 to-background p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Kanban Project Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Projeleri kur, tasklari yonet, cost analizine gec ve ciktilari release akisina aktar.
            </p>
          </div>
          <Link
            href="/dashboard/analyzer"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Analyze docs
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border bg-card/70 p-3">
            <p className="text-xs text-muted-foreground">Projects</p>
            <p className="mt-1 text-xl font-semibold">{projects.length}</p>
          </div>
          <div className="rounded-md border bg-card/70 p-3">
            <p className="text-xs text-muted-foreground">Active Tasks</p>
            <p className="mt-1 text-xl font-semibold">{activeTasks}</p>
          </div>
          <div className="rounded-md border bg-card/70 p-3">
            <p className="text-xs text-muted-foreground">Completion</p>
            <p className="mt-1 text-xl font-semibold">{totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0}%</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {[
          {
            title: '1) Ingest Scope',
            detail: 'PRD veya analiz dokumanindan task cikart.',
            href: '/dashboard/analyzer',
            icon: Brain,
          },
          {
            title: '2) Execute in Kanban',
            detail: 'Project board uzerinde backlog -> done akisina gec.',
            href: '/dashboard/projects',
            icon: LayoutGrid,
          },
          {
            title: '3) Estimate and Compare',
            detail: 'Efor maliyet hesapla, senaryolari compare et.',
            href: '/dashboard/effort',
            icon: Calculator,
          },
        ].map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="rounded-lg border bg-card p-4 hover:bg-muted/30"
          >
            <p className="inline-flex items-center gap-2 text-sm font-semibold">
              <item.icon className="h-4 w-4 text-primary" />
              {item.title}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
          </Link>
        ))}
      </div>

      <div>
        <div>
          <h2 className="text-xl font-semibold">Create Project</h2>
          <p className="mt-1 text-sm text-muted-foreground">Yeni proje olusturup tasklari kanban boardda yonet.</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <input
            className="rounded-md border px-3 py-2 text-sm"
            placeholder="Project Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            className="rounded-md border px-3 py-2 text-sm uppercase"
            placeholder="KEY"
            value={key}
            maxLength={10}
            onChange={(event) => setKey(event.target.value)}
          />
          <input
            className="rounded-md border px-3 py-2 text-sm"
            placeholder="Description (optional)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="mt-3">
          <button
            onClick={handleCreate}
            disabled={!orgId || !name.trim() || !key.trim() || createProject.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
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
            <div key={project.id} className="rounded-lg border bg-card p-4">
              {!isEditing ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">{project.key}</p>
                      <h3 className="text-lg font-semibold">{project.name}</h3>
                    </div>
                    <button
                      onClick={() => setEditing({ id: project.id, name: project.name, description: project.description ?? '' })}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                    >
                      <SquarePen className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                    {project.description || 'No description'}
                  </p>
                  <div className="mt-3 rounded-md border p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded bg-muted/50 px-2 py-1">Backlog: {backlogCount}</div>
                      <div className="rounded bg-muted/50 px-2 py-1">Active: {activeCount}</div>
                      <div className="rounded bg-muted/50 px-2 py-1">Done: {doneCount}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2">
                    <Link
                      href={`/dashboard/projects/${project.id}?view=board`}
                      className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                    >
                      <FolderKanban className="h-4 w-4" />
                      Open Kanban Board
                    </Link>
                    <Link
                      href={`/dashboard/effort?projectId=${project.id}`}
                      className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                    >
                      <Calculator className="h-4 w-4" />
                      Run Effort/Cost
                    </Link>
                    <Link
                      href={`/dashboard/compare?projectId=${project.id}`}
                      className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                    >
                      <GitCompare className="h-4 w-4" />
                      Compare AI Models
                    </Link>
                    <Link
                      href={`/dashboard/analyzer?projectId=${project.id}`}
                      className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5"
                    >
                      <Brain className="h-4 w-4" />
                      Add Tasks from Docs
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <input
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={editing.name}
                    onChange={(event) => setEditing((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
                  />
                  <textarea
                    className="mt-2 h-24 w-full rounded-md border px-3 py-2 text-sm"
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
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card p-12 text-center">
            <FolderKanban className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No projects yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create your first project to start estimating.</p>
          </div>
        )}
      </div>
    </div>
  );
}
