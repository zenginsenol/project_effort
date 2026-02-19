'use client';

import { FolderKanban, Plus, Save, SquarePen } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

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
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="mt-1 text-muted-foreground">Manage your estimation projects.</p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Create New Project</h2>
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

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projectsQuery.data?.map((project) => {
          const isEditing = editing?.id === project.id;

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
                  <div className="mt-4">
                    <Link href={`/dashboard/projects/${project.id}`} className="text-sm font-medium text-primary hover:underline">
                      Open project
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

        {!projectsQuery.isLoading && (projectsQuery.data?.length ?? 0) === 0 && (
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
