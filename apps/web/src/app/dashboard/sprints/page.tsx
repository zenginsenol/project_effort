'use client';

import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { trpc } from '@/lib/trpc';

const sprintStatusOptions = ['planning', 'active', 'completed', 'cancelled'] as const;

type SprintStatus = typeof sprintStatusOptions[number];

type SprintDraft = {
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
};

const emptyDraft: SprintDraft = {
  name: '',
  goal: '',
  startDate: '',
  endDate: '',
};

export default function SprintsPage(): React.ReactElement {
  const utils = trpc.useUtils();

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SprintDraft>(emptyDraft);

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

  const sprintsQuery = trpc.sprint.list.useQuery(
    { projectId: selectedProjectId },
    { enabled: Boolean(selectedProjectId), retry: false },
  );

  const tasksQuery = trpc.task.list.useQuery(
    { projectId: selectedProjectId },
    { enabled: Boolean(selectedProjectId), retry: false },
  );

  const createMutation = trpc.sprint.create.useMutation({
    onSuccess: async () => {
      setDraft(emptyDraft);
      await sprintsQuery.refetch();
      await utils.analytics.velocity.invalidate({ projectId: selectedProjectId, sprintCount: 6 });
    },
  });

  const updateMutation = trpc.sprint.update.useMutation({
    onSuccess: async () => {
      await sprintsQuery.refetch();
      await utils.analytics.velocity.invalidate({ projectId: selectedProjectId, sprintCount: 6 });
    },
  });

  const deleteMutation = trpc.sprint.delete.useMutation({
    onSuccess: async (_deletedSprint) => {
      setSelectedSprintId((current) => (current === _deletedSprint.id ? null : current));
      await sprintsQuery.refetch();
      await utils.analytics.velocity.invalidate({ projectId: selectedProjectId, sprintCount: 6 });
    },
  });

  const selectedSprint = useMemo(
    () => (sprintsQuery.data ?? []).find((sprint) => sprint.id === selectedSprintId) ?? null,
    [selectedSprintId, sprintsQuery.data],
  );

  const groupedTasks = useMemo(() => {
    const map = new Map<string, typeof tasksQuery.data>();
    for (const task of tasksQuery.data ?? []) {
      const list = map.get(task.status) ?? [];
      map.set(task.status, [...list, task]);
    }
    return map;
  }, [tasksQuery.data]);

  function handleCreate(): void {
    if (!selectedProjectId || !draft.name.trim()) {
      return;
    }

    createMutation.mutate({
      projectId: selectedProjectId,
      name: draft.name.trim(),
      goal: draft.goal.trim() || undefined,
      startDate: draft.startDate || undefined,
      endDate: draft.endDate || undefined,
    });
  }

  function handleUpdateStatus(sprintId: string, status: SprintStatus): void {
    updateMutation.mutate({ id: sprintId, status });
  }

  function handleDelete(sprintId: string): void {
    if (!window.confirm('Delete this sprint?')) {
      return;
    }
    deleteMutation.mutate({ id: sprintId });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sprints</h1>
          <p className="mt-1 text-muted-foreground">Plan sprint cycles and link them with project task board.</p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <select
            value={selectedProjectId}
            onChange={(event) => {
              setSelectedProjectId(event.target.value);
              setSelectedSprintId(null);
            }}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Select project</option>
            {(projectsQuery.data ?? []).map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
          <input
            value={draft.name}
            onChange={(event) => setDraft((previous) => ({ ...previous, name: event.target.value }))}
            placeholder="Sprint name"
            className="rounded-md border px-3 py-2 text-sm"
          />
          <input
            value={draft.goal}
            onChange={(event) => setDraft((previous) => ({ ...previous, goal: event.target.value }))}
            placeholder="Sprint goal (optional)"
            className="rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <input
            type="date"
            value={draft.startDate}
            onChange={(event) => setDraft((previous) => ({ ...previous, startDate: event.target.value }))}
            className="rounded-md border px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={draft.endDate}
            onChange={(event) => setDraft((previous) => ({ ...previous, endDate: event.target.value }))}
            className="rounded-md border px-3 py-2 text-sm"
          />
          <button
            onClick={handleCreate}
            disabled={!selectedProjectId || !draft.name.trim() || createMutation.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {createMutation.isPending ? 'Creating...' : 'New Sprint'}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Sprint List</h2>

          {(sprintsQuery.data?.length ?? 0) === 0 && !sprintsQuery.isLoading && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card p-10 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">No sprints yet for selected project.</p>
            </div>
          )}

          <div className="space-y-3">
            {(sprintsQuery.data ?? []).map((sprint) => (
              <button
                key={sprint.id}
                type="button"
                onClick={() => setSelectedSprintId(sprint.id)}
                className={`w-full rounded-lg border bg-card p-4 text-left ${selectedSprintId === sprint.id ? 'border-primary bg-primary/5' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{sprint.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{sprint.goal || 'No goal set'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {sprint.startDate || '-'} → {sprint.endDate || '-'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={sprint.status}
                      onChange={(event) => handleUpdateStatus(sprint.id, event.target.value as SprintStatus)}
                      className="rounded-md border px-2 py-1 text-xs"
                    >
                      {sprintStatusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(sprint.id);
                      }}
                      className="rounded-md border border-red-300 p-1 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Board Linkage</h2>

          {!selectedSprint && (
            <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
              Select a sprint to view task board linkage.
            </div>
          )}

          {selectedSprint && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-4">
                <h3 className="font-semibold">{selectedSprint.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sprint status: {selectedSprint.status}
                </p>
                <Link
                  href={`/dashboard/projects/${selectedProjectId}?view=board`}
                  className="mt-3 inline-flex rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Open Project Board
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {['backlog', 'todo', 'in_progress', 'in_review', 'done'].map((status) => (
                  <div key={status} className="rounded-lg border bg-card p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{status}</p>
                    <p className="mt-2 text-2xl font-bold">{groupedTasks.get(status)?.length ?? 0}</p>
                    <p className="mt-1 text-xs text-muted-foreground">tasks in selected project</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
