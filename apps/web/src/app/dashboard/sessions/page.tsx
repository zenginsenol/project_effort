'use client';

import { Clock, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { trpc } from '@/lib/trpc';

const sessionMethodOptions = [
  { value: 'planning_poker', label: 'Planning Poker' },
  { value: 'tshirt_sizing', label: 'T-Shirt Sizing' },
  { value: 'pert', label: 'PERT' },
  { value: 'wideband_delphi', label: 'Wideband Delphi' },
] as const;

type SessionMethod = typeof sessionMethodOptions[number]['value'];

export default function SessionsPage(): React.ReactElement {
  const utils = trpc.useUtils();

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<SessionMethod>('planning_poker');
  const [selectedTaskId, setSelectedTaskId] = useState('');

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

  const tasksQuery = trpc.task.list.useQuery(
    { projectId: selectedProjectId },
    { enabled: Boolean(selectedProjectId), retry: false },
  );

  const sessionsQuery = trpc.session.list.useQuery(
    { projectId: selectedProjectId },
    { enabled: Boolean(selectedProjectId), retry: false },
  );

  const teamQuery = trpc.team.list.useQuery(
    { organizationId: orgId },
    { enabled: Boolean(orgId), retry: false },
  );

  const currentUserId = (() => {
    const members = teamQuery.data ?? [];
    if (members.length === 0) {
      return null;
    }
    return members[0]?.userId ?? null;
  })();

  const createSessionMutation = trpc.session.create.useMutation({
    onSuccess: async () => {
      setSessionName('');
      setSelectedTaskId('');
      await utils.session.list.invalidate({ projectId: selectedProjectId });
    },
  });

  const joinSessionMutation = trpc.session.join.useMutation({
    onSuccess: async () => {
      await utils.session.list.invalidate({ projectId: selectedProjectId });
    },
  });

  function handleCreateSession(): void {
    if (!selectedProjectId || !sessionName.trim() || !currentUserId) {
      return;
    }

    createSessionMutation.mutate({
      projectId: selectedProjectId,
      name: sessionName.trim(),
      method: selectedMethod,
      moderatorId: currentUserId,
      taskId: selectedTaskId || undefined,
    });
  }

  function handleJoinSession(sessionId: string): void {
    if (!currentUserId) {
      return;
    }

    joinSessionMutation.mutate({
      sessionId,
      userId: currentUserId,
    });
  }

  const activeProjectName = projectsQuery.data?.find((project) => project.id === selectedProjectId)?.name;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Estimation Sessions</h1>
          <p className="mt-1 text-muted-foreground">Create, join, and manage live estimation sessions.</p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Create Session</h2>

        <div className="mt-3 grid gap-3 lg:grid-cols-4">
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

          <input
            value={sessionName}
            onChange={(event) => setSessionName(event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
            placeholder="Session name"
          />

          <select
            value={selectedMethod}
            onChange={(event) => setSelectedMethod(event.target.value as SessionMethod)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            {sessionMethodOptions.map((method) => (
              <option key={method.value} value={method.value}>{method.label}</option>
            ))}
          </select>

          <select
            value={selectedTaskId}
            onChange={(event) => setSelectedTaskId(event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">No specific task</option>
            {(tasksQuery.data ?? []).map((task) => (
              <option key={task.id} value={task.id}>{task.title}</option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={handleCreateSession}
            disabled={!selectedProjectId || !sessionName.trim() || !currentUserId || createSessionMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {createSessionMutation.isPending ? 'Creating...' : 'New Session'}
          </button>
          {!currentUserId && (
            <p className="text-xs text-amber-600">No organization member found for current user.</p>
          )}
        </div>
      </div>

      <div className="mt-6">
        {sessionsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading sessions...</p>}

        {!sessionsQuery.isLoading && (sessionsQuery.data?.length ?? 0) === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card p-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No sessions yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedProjectId
                ? `Start your first session for ${activeProjectName ?? 'this project'}.`
                : 'Select a project to see sessions.'}
            </p>
          </div>
        )}

        {!sessionsQuery.isLoading && (sessionsQuery.data?.length ?? 0) > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sessionsQuery.data?.map((session) => (
              <div key={session.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{session.name}</h3>
                    <p className="text-xs text-muted-foreground">{session.method}</p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                    {session.status}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {session.participants.length} participants
                </div>

                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/dashboard/sessions/${session.id}`}
                    className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    Open
                  </Link>
                  <button
                    onClick={() => handleJoinSession(session.id)}
                    disabled={!currentUserId || joinSessionMutation.isPending}
                    className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Join
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
