'use client';

import {
  ArrowLeft,
  Brain,
  Calculator,
  Github,
  GitCompare,
  LayoutGrid,
  Link2,
  ListTodo,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  WandSparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { trpc } from '@/lib/trpc';

const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';
const statusOptions = ['', 'backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'] as const;
const typeOptions = ['', 'epic', 'feature', 'story', 'task', 'subtask', 'bug'] as const;
const priorityOptions = ['critical', 'high', 'medium', 'low', 'none'] as const;
const sortOptions = ['created_desc', 'created_asc', 'title_asc', 'priority_desc'] as const;
const viewOptions = ['list', 'board'] as const;

type StatusOption = typeof statusOptions[number];
type TypeOption = typeof typeOptions[number];
type PriorityOption = typeof priorityOptions[number];
type SortOption = typeof sortOptions[number];
type ViewOption = typeof viewOptions[number];
type TaskStatus = Exclude<StatusOption, ''>;
type TaskType = Exclude<TypeOption, ''>;
type GithubConnectionOption = {
  integrationId: string;
  displayName: string;
  updatedAt: string;
  lastSyncAt: string | null;
};

type CreateTaskDraft = {
  title: string;
  description: string;
  status: TaskStatus;
  type: TaskType;
  priority: PriorityOption;
};

type TaskDetailDraft = {
  title: string;
  description: string;
  status: TaskStatus;
  type: TaskType;
  priority: PriorityOption;
  estimatedPoints: string;
  estimatedHours: string;
};

const defaultCreateTaskDraft: CreateTaskDraft = {
  title: '',
  description: '',
  status: 'backlog',
  type: 'task',
  priority: 'medium',
};

const estimatePresets: Array<{ label: string; points: number; hours: number }> = [
  { label: 'XS', points: 1, hours: 2 },
  { label: 'S', points: 2, hours: 4 },
  { label: 'M', points: 3, hours: 8 },
  { label: 'L', points: 5, hours: 16 },
  { label: 'XL', points: 8, hours: 24 },
];

const boardColumns: Array<{
  key: Exclude<StatusOption, ''>;
  title: string;
  toneClass: string;
  badgeClass: string;
}> = [
  {
    key: 'backlog',
    title: 'Backlog',
    toneClass: 'border-zinc-300/70 bg-zinc-100/60 dark:border-zinc-700 dark:bg-zinc-900/55',
    badgeClass: 'status-pill status-tone-backlog',
  },
  {
    key: 'todo',
    title: 'To Do',
    toneClass: 'border-sky-300/70 bg-sky-100/60 dark:border-sky-700 dark:bg-sky-950/45',
    badgeClass: 'status-pill status-tone-todo',
  },
  {
    key: 'in_progress',
    title: 'In Progress',
    toneClass: 'border-amber-300/70 bg-amber-100/60 dark:border-amber-700 dark:bg-amber-950/45',
    badgeClass: 'status-pill status-tone-in-progress',
  },
  {
    key: 'in_review',
    title: 'In Review',
    toneClass: 'border-indigo-300/70 bg-indigo-100/60 dark:border-indigo-700 dark:bg-indigo-950/45',
    badgeClass: 'status-pill status-tone-in-review',
  },
  {
    key: 'done',
    title: 'Done',
    toneClass: 'border-emerald-300/70 bg-emerald-100/60 dark:border-emerald-700 dark:bg-emerald-950/45',
    badgeClass: 'status-pill status-tone-done',
  },
  {
    key: 'cancelled',
    title: 'Cancelled',
    toneClass: 'border-rose-300/70 bg-rose-100/60 dark:border-rose-700 dark:bg-rose-950/45',
    badgeClass: 'status-pill status-tone-cancelled',
  },
];

const priorityStyleMap: Record<PriorityOption, string> = {
  critical: 'border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-200',
  high: 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200',
  medium: 'border-sky-300 bg-sky-100 text-sky-700 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-200',
  low: 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200',
  none: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200',
};

function getStatusPillClass(status: TaskStatus): string {
  const found = boardColumns.find((column) => column.key === status);
  return found?.badgeClass ?? 'status-pill status-tone-backlog';
}

export default function ProjectDetailPage(): React.ReactElement {
  const utils = trpc.useUtils();
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createTaskDraft, setCreateTaskDraft] = useState<CreateTaskDraft>(defaultCreateTaskDraft);
  const [taskDetailDraft, setTaskDetailDraft] = useState<TaskDetailDraft | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [githubRepoInput, setGithubRepoInput] = useState('');
  const [githubAutoSync, setGithubAutoSync] = useState(true);
  const [selectedGithubIntegrationId, setSelectedGithubIntegrationId] = useState('');
  const [githubNotice, setGithubNotice] = useState('');
  const autoSyncedKeysRef = useRef(new Set<string>());

  const statusParam = searchParams.get('status');
  const typeParam = searchParams.get('type');
  const sortParam = searchParams.get('sort');
  const viewParam = searchParams.get('view');

  const status = statusOptions.includes((statusParam ?? '') as StatusOption) ? (statusParam ?? '') as StatusOption : '';
  const type = typeOptions.includes((typeParam ?? '') as TypeOption) ? (typeParam ?? '') as TypeOption : '';
  const sort = sortOptions.includes((sortParam ?? '') as SortOption) ? (sortParam ?? 'created_desc') as SortOption : 'created_desc';
  const view = viewOptions.includes((viewParam ?? '') as ViewOption) ? (viewParam ?? 'list') as ViewOption : 'list';

  const projectQuery = trpc.project.getById.useQuery({ id: projectId }, { retry: false });

  const tasksInput = useMemo(
    () => ({
      projectId,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    }),
    [projectId, status, type],
  );

  const tasksQuery = trpc.task.list.useQuery(tasksInput, { retry: false });
  const selectedTaskQuery = trpc.task.getById.useQuery(
    { id: selectedTaskId ?? EMPTY_UUID },
    { enabled: Boolean(selectedTaskId), retry: false },
  );
  const githubProjectLinkInput = useMemo(
    () => ({
      projectId,
      ...(selectedGithubIntegrationId ? { integrationId: selectedGithubIntegrationId } : {}),
    }),
    [projectId, selectedGithubIntegrationId],
  );
  const githubProjectLinkQuery = trpc.integration.getGithubProjectLink.useQuery(githubProjectLinkInput, {
    enabled: Boolean(projectId),
    retry: false,
  });
  const githubConnections = (githubProjectLinkQuery.data?.availableConnections ?? []) as GithubConnectionOption[];

  const linkGithubProjectMutation = trpc.integration.linkGithubProject.useMutation({
    onSuccess: async (result) => {
      setGithubNotice(`GitHub repository linked: ${result.repository}`);
      await githubProjectLinkQuery.refetch();
    },
    onError: (error) => {
      setGithubNotice(`GitHub link failed: ${error.message}`);
    },
  });

  const syncGithubProjectMutation = trpc.integration.syncGithubProject.useMutation({
    onSuccess: async (result) => {
      setGithubNotice(`GitHub sync completed: ${result.syncedCount}/${result.importedCount} task imported.`);
      await Promise.all([
        githubProjectLinkQuery.refetch(),
        utils.task.list.invalidate(tasksInput),
        selectedTaskId ? utils.task.getById.invalidate({ id: selectedTaskId }) : Promise.resolve(),
      ]);
    },
    onError: (error) => {
      setGithubNotice(`GitHub sync failed: ${error.message}`);
    },
  });

  useEffect(() => {
    if (!selectedTaskQuery.data) {
      setTaskDetailDraft(null);
      return;
    }

    setTaskDetailDraft({
      title: selectedTaskQuery.data.title,
      description: selectedTaskQuery.data.description ?? '',
      status: selectedTaskQuery.data.status as TaskStatus,
      type: selectedTaskQuery.data.type as TaskType,
      priority: selectedTaskQuery.data.priority as PriorityOption,
      estimatedPoints: selectedTaskQuery.data.estimatedPoints?.toString() ?? '',
      estimatedHours: selectedTaskQuery.data.estimatedHours?.toString() ?? '',
    });
  }, [selectedTaskQuery.data]);

  useEffect(() => {
    if (!selectedGithubIntegrationId && githubProjectLinkQuery.data?.integrationId) {
      setSelectedGithubIntegrationId(githubProjectLinkQuery.data.integrationId);
    }
  }, [githubProjectLinkQuery.data?.integrationId, selectedGithubIntegrationId]);

  useEffect(() => {
    if (githubConnections.length === 0) {
      if (selectedGithubIntegrationId) {
        setSelectedGithubIntegrationId('');
      }
      return;
    }
    if (selectedGithubIntegrationId && githubConnections.some((item) => item.integrationId === selectedGithubIntegrationId)) {
      return;
    }
    const firstIntegrationId = githubConnections[0]?.integrationId ?? '';
    setSelectedGithubIntegrationId(firstIntegrationId);
  }, [githubConnections, selectedGithubIntegrationId]);

  useEffect(() => {
    const link = githubProjectLinkQuery.data?.link;
    if (!link) {
      setGithubRepoInput('');
      setGithubAutoSync(true);
      return;
    }
    setGithubRepoInput(link.externalProjectId);
    setGithubAutoSync(link.autoSync);
  }, [
    githubProjectLinkQuery.data?.link?.autoSync,
    githubProjectLinkQuery.data?.link?.externalProjectId,
  ]);

  useEffect(() => {
    const link = githubProjectLinkQuery.data?.link;
    if (
      !githubProjectLinkQuery.data?.connected
      || !link?.autoSync
      || !link.externalProjectId
      || syncGithubProjectMutation.isPending
    ) {
      return;
    }

    const autoSyncKey = `${projectId}:${selectedGithubIntegrationId}:${link.externalProjectId}`;
    if (autoSyncedKeysRef.current.has(autoSyncKey)) {
      return;
    }

    autoSyncedKeysRef.current.add(autoSyncKey);
    syncGithubProjectMutation.mutate({
      projectId,
      ...(selectedGithubIntegrationId ? { integrationId: selectedGithubIntegrationId } : {}),
    });
  }, [
    githubProjectLinkQuery.data?.connected,
    githubProjectLinkQuery.data?.link?.autoSync,
    githubProjectLinkQuery.data?.link?.externalProjectId,
    projectId,
    selectedGithubIntegrationId,
    syncGithubProjectMutation,
  ]);

  const createTaskMutation = trpc.task.create.useMutation({
    onSuccess: async (createdTask) => {
      setCreateTaskDraft(defaultCreateTaskDraft);
      setSelectedTaskId(createdTask.id);
      await Promise.all([
        utils.task.list.invalidate(tasksInput),
        utils.task.getById.invalidate({ id: createdTask.id }),
      ]);
    },
  });

  const createSubtaskMutation = trpc.task.create.useMutation({
    onSuccess: async () => {
      setNewSubtaskTitle('');
      await Promise.all([
        utils.task.list.invalidate(tasksInput),
        selectedTaskId ? utils.task.getById.invalidate({ id: selectedTaskId }) : Promise.resolve(),
      ]);
    },
  });

  const updateTaskMutation = trpc.task.update.useMutation({
    onMutate: async (input) => {
      await utils.task.list.cancel(tasksInput);
      await utils.task.getById.cancel({ id: input.id });

      const previous = utils.task.list.getData(tasksInput);
      const previousDetail = utils.task.getById.getData({ id: input.id });

      utils.task.list.setData(tasksInput, (old) => {
        if (!old) {
          return old;
        }
        const { id, ...changes } = input;
        return old.map((task) => (task.id === id ? { ...task, ...changes } : task));
      });

      utils.task.getById.setData({ id: input.id }, (old) => {
        if (!old) {
          return old;
        }
        return { ...old, ...input };
      });

      return { previous, previousDetail, taskId: input.id };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        utils.task.list.setData(tasksInput, context.previous);
      }
      if (context?.previousDetail && context.taskId) {
        utils.task.getById.setData({ id: context.taskId }, context.previousDetail);
      }
    },
    onSettled: async (_data, _error, input) => {
      await Promise.all([
        utils.task.list.invalidate(tasksInput),
        utils.task.getById.invalidate({ id: input.id }),
      ]);
    },
  });

  const deleteTaskMutation = trpc.task.delete.useMutation({
    onSuccess: async () => {
      const deletedTaskId = selectedTaskId;
      setSelectedTaskId(null);
      setTaskDetailDraft(null);
      await Promise.all([
        utils.task.list.invalidate(tasksInput),
        deletedTaskId ? utils.task.getById.invalidate({ id: deletedTaskId }) : Promise.resolve(),
      ]);
    },
  });

  const sortedTasks = useMemo(() => {
    const list = [...(tasksQuery.data ?? [])];
    switch (sort) {
      case 'created_asc':
        return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case 'title_asc':
        return list.sort((a, b) => a.title.localeCompare(b.title));
      case 'priority_desc': {
        const order = { critical: 5, high: 4, medium: 3, low: 2, none: 1 } as const;
        return list.sort((a, b) => order[b.priority] - order[a.priority]);
      }
      default:
        return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }, [tasksQuery.data, sort]);

  const groupedByStatus = useMemo(() => {
    const groups = new Map<string, typeof sortedTasks>();
    for (const task of sortedTasks) {
      const existing = groups.get(task.status) ?? [];
      groups.set(task.status, [...existing, task]);
    }
    return groups;
  }, [sortedTasks]);

  function setQueryParam(key: string, value: string): void {
    const current = new URLSearchParams(searchParams.toString());
    if (!value) {
      current.delete(key);
    } else {
      current.set(key, value);
    }
    const query = current.toString();
    router.replace(query ? `/dashboard/projects/${projectId}?${query}` : `/dashboard/projects/${projectId}`);
  }

  function handleDrop(taskId: string, targetStatus: Exclude<StatusOption, ''>): void {
    const taskList = tasksQuery.data ?? [];
    const movingTask = taskList.find((task) => task.id === taskId);
    if (!movingTask) {
      return;
    }

    const targetColumnTasks = taskList
      .filter((task) => task.status === targetStatus && task.id !== taskId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const nextSortOrder = (targetColumnTasks.at(-1)?.sortOrder ?? 0) + 1;
    updateTaskMutation.mutate({
      id: taskId,
      status: targetStatus,
      sortOrder: nextSortOrder,
    });
  }

  function parseNumericInput(raw: string): number | null | 'invalid' {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0) {
      return 'invalid';
    }
    return parsed;
  }

  function handleCreateTask(): void {
    if (!createTaskDraft.title.trim()) {
      return;
    }

    createTaskMutation.mutate({
      projectId,
      title: createTaskDraft.title.trim(),
      description: createTaskDraft.description.trim() || undefined,
      status: createTaskDraft.status,
      type: createTaskDraft.type,
      priority: createTaskDraft.priority,
    });
  }

  function handleSaveTaskDetail(): void {
    if (!selectedTaskId || !taskDetailDraft?.title.trim()) {
      return;
    }

    const parsedPoints = parseNumericInput(taskDetailDraft.estimatedPoints);
    const parsedHours = parseNumericInput(taskDetailDraft.estimatedHours);
    if (parsedPoints === 'invalid' || parsedHours === 'invalid') {
      return;
    }

    updateTaskMutation.mutate({
      id: selectedTaskId,
      title: taskDetailDraft.title.trim(),
      description: taskDetailDraft.description.trim() || undefined,
      status: taskDetailDraft.status,
      type: taskDetailDraft.type,
      priority: taskDetailDraft.priority,
      estimatedPoints: parsedPoints,
      estimatedHours: parsedHours,
    });
  }

  function handleDeleteTask(): void {
    if (!selectedTaskId) {
      return;
    }
    if (!window.confirm('Delete this task permanently?')) {
      return;
    }
    deleteTaskMutation.mutate({ id: selectedTaskId });
  }

  function applyEstimatePreset(points: number, hours: number): void {
    setTaskDetailDraft((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        estimatedPoints: String(points),
        estimatedHours: String(hours),
      };
    });
  }

  function handleCreateSubtask(): void {
    if (!selectedTaskId || !newSubtaskTitle.trim()) {
      return;
    }

    createSubtaskMutation.mutate({
      projectId,
      parentId: selectedTaskId,
      title: newSubtaskTitle.trim(),
      description: '',
      status: taskDetailDraft?.status ?? 'backlog',
      type: 'subtask',
      priority: taskDetailDraft?.priority ?? 'medium',
    });
  }

  function handleSaveGithubLink(): void {
    const repository = githubRepoInput.trim();
    if (!repository) {
      return;
    }

    setGithubNotice('');
    linkGithubProjectMutation.mutate({
      projectId,
      repository,
      autoSync: githubAutoSync,
      ...(selectedGithubIntegrationId
        ? { integrationId: selectedGithubIntegrationId }
        : {}),
    });
  }

  function handleSyncGithubNow(): void {
    setGithubNotice('');
    syncGithubProjectMutation.mutate({
      projectId,
      ...(selectedGithubIntegrationId
        ? { integrationId: selectedGithubIntegrationId }
        : {}),
    });
  }

  return (
    <div>
      <div className="page-shell soft-surface noise-overlay">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/projects" className="rounded-md border bg-background/75 p-1.5 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{projectQuery.data?.name ?? 'Project Details'}</h1>
            <p className="text-sm text-muted-foreground">Project ID: {projectId}</p>
          </div>
          <span className="ml-auto status-pill status-tone-in-progress">Kanban Management</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Link
          href={`/dashboard/analyzer?projectId=${projectId}`}
          className="rounded-xl border border-sky-300/60 bg-sky-100/55 p-3 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/35"
        >
          <p className="inline-flex items-center gap-2 text-sm font-semibold">
            <Brain className="h-4 w-4 text-sky-700 dark:text-sky-300" />
            Add Tasks from Docs
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Yeni dokumanlardan backloga task ekle.</p>
        </Link>
        <Link
          href={`/dashboard/effort?projectId=${projectId}`}
          className="rounded-xl border border-amber-300/60 bg-amber-100/55 p-3 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/35"
        >
          <p className="inline-flex items-center gap-2 text-sm font-semibold">
            <Calculator className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            Effort & Cost
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Bu projenin efor maliyet analizine gec.</p>
        </Link>
        <Link
          href={`/dashboard/compare?projectId=${projectId}`}
          className="rounded-xl border border-indigo-300/60 bg-indigo-100/55 p-3 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/35"
        >
          <p className="inline-flex items-center gap-2 text-sm font-semibold">
            <GitCompare className="h-4 w-4 text-indigo-700 dark:text-indigo-300" />
            Compare Models
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Ayni kapsam icin provider/model sonucunu kiyasla.</p>
        </Link>
      </div>

      <div className="mt-6 dashboard-panel soft-surface rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4" />
            <h2 className="text-sm font-semibold">GitHub Integration</h2>
          </div>
          {githubProjectLinkQuery.data?.connected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
              Not connected
            </span>
          )}
        </div>

        {!githubProjectLinkQuery.data?.connected && (
          <div className="mt-3 rounded-md border border-dashed border-amber-300/70 bg-amber-100/45 p-3 text-sm text-muted-foreground dark:border-amber-700 dark:bg-amber-950/25">
            Connect GitHub first from{' '}
            <Link href="/dashboard/integrations" className="font-medium underline">
              Integrations
            </Link>
            , then link this project to a repository.
          </div>
        )}

        {githubProjectLinkQuery.data?.connected && (
          <>
            <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,260px)_1fr]">
              <label className="text-xs font-medium text-muted-foreground">GitHub connection</label>
              <label className="text-xs font-medium text-muted-foreground">Repository for this project</label>
              <select
                value={selectedGithubIntegrationId}
                onChange={(event) => {
                  setSelectedGithubIntegrationId(event.target.value);
                  setGithubNotice('');
                }}
                className="rounded-md border bg-background/85 px-3 py-2 text-sm"
              >
                {githubConnections.map((connection) => (
                  <option key={connection.integrationId} value={connection.integrationId}>
                    {connection.displayName}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={githubRepoInput}
                onChange={(event) => setGithubRepoInput(event.target.value)}
                placeholder="owner/repo or https://github.com/owner/repo"
                className="rounded-md border bg-background/85 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-[auto_auto]">
              <button
                onClick={handleSaveGithubLink}
                disabled={!githubRepoInput.trim() || linkGithubProjectMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-md border bg-background/80 px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                <Link2 className="h-4 w-4" />
                {linkGithubProjectMutation.isPending ? 'Linking...' : 'Save Link'}
              </button>
              <button
                onClick={handleSyncGithubNow}
                disabled={!githubRepoInput.trim() || syncGithubProjectMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${syncGithubProjectMutation.isPending ? 'animate-spin' : ''}`} />
                {syncGithubProjectMutation.isPending ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Each project can map to a different `owner/repo` and different GitHub connection.
            </p>
          </>
        )}

        {githubProjectLinkQuery.data?.connected && (
          <label className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={githubAutoSync}
              onChange={(event) => setGithubAutoSync(event.target.checked)}
              className="h-4 w-4"
            />
            Auto-sync when project is opened
          </label>
        )}

        <div className="mt-3 rounded-md border border-dashed bg-background/65 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">GitHub entegrasyonu ne sağlar?</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>Repo issue&apos;larını projeye task olarak çeker (duplicate başlıkları atlar).</li>
            <li>Label&apos;lardan tür eşlemesi yapar: epic, feature, story, subtask, bug, task.</li>
            <li>Label&apos;lardan öncelik eşler: critical/high/medium/low (P0-P3 dahil).</li>
            <li>Label&apos;lardan story point okur: `sp:3`, `points:5`, `estimate:8` formatları.</li>
            <li>Proje bazlı repo linki saklar, istenirse proje açılışında otomatik senkron yapar.</li>
          </ul>
        </div>

        {githubProjectLinkQuery.data?.link?.externalProjectId && (
          <p className="mt-2 text-xs text-muted-foreground">
            Linked repo: {githubProjectLinkQuery.data.link.externalProjectId}
          </p>
        )}
        {githubNotice && (
          <p className="mt-2 text-xs text-muted-foreground">{githubNotice}</p>
        )}
      </div>

      <div className="mt-6 dashboard-panel soft-surface rounded-xl p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <select
            className="rounded-md border bg-background/85 px-3 py-2 text-sm"
            value={status}
            onChange={(event) => setQueryParam('status', event.target.value)}
          >
            {statusOptions.map((value) => (
              <option key={value || 'all'} value={value}>
                {value ? `Status: ${value}` : 'All Statuses'}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border bg-background/85 px-3 py-2 text-sm"
            value={type}
            onChange={(event) => setQueryParam('type', event.target.value)}
          >
            {typeOptions.map((value) => (
              <option key={value || 'all'} value={value}>
                {value ? `Type: ${value}` : 'All Types'}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border bg-background/85 px-3 py-2 text-sm"
            value={sort}
            onChange={(event) => setQueryParam('sort', event.target.value)}
          >
            <option value="created_desc">Newest First</option>
            <option value="created_asc">Oldest First</option>
            <option value="title_asc">Title A-Z</option>
            <option value="priority_desc">Priority High-Low</option>
          </select>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setQueryParam('view', 'list')}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium ${view === 'list' ? 'border-indigo-300 bg-indigo-100 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200' : 'border-border bg-background/80 text-muted-foreground hover:bg-muted'}`}
            >
              <ListTodo className="h-4 w-4" />
              List
            </button>
            <button
              onClick={() => setQueryParam('view', 'board')}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium ${view === 'board' ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200' : 'border-border bg-background/80 text-muted-foreground hover:bg-muted'}`}
            >
              <LayoutGrid className="h-4 w-4" />
              Board
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Filters and sort state persist in URL query parameters for shareable/reload-safe views.
        </p>
      </div>

      <div className="mt-6 dashboard-panel soft-surface rounded-xl p-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Create Task</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-6">
          <input
            className="rounded-md border bg-background/85 px-3 py-2 text-sm lg:col-span-2"
            placeholder="Task title"
            value={createTaskDraft.title}
            onChange={(event) => {
              setCreateTaskDraft((previous) => ({ ...previous, title: event.target.value }));
            }}
          />
          <input
            className="rounded-md border bg-background/85 px-3 py-2 text-sm lg:col-span-2"
            placeholder="Description (optional)"
            value={createTaskDraft.description}
            onChange={(event) => {
              setCreateTaskDraft((previous) => ({ ...previous, description: event.target.value }));
            }}
          />
          <select
            className="rounded-md border bg-background/85 px-3 py-2 text-sm"
            value={createTaskDraft.type}
            onChange={(event) => {
              setCreateTaskDraft((previous) => ({ ...previous, type: event.target.value as TaskType }));
            }}
          >
            {typeOptions
              .filter((value): value is TaskType => value !== '')
              .map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
          </select>
          <select
            className="rounded-md border bg-background/85 px-3 py-2 text-sm"
            value={createTaskDraft.priority}
            onChange={(event) => {
              setCreateTaskDraft((previous) => ({ ...previous, priority: event.target.value as PriorityOption }));
            }}
          >
            {priorityOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={handleCreateTask}
            disabled={!createTaskDraft.title.trim() || createTaskMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
          </button>
          <button
            onClick={() => setCreateTaskDraft(defaultCreateTaskDraft)}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
        <div>
          {tasksQuery.isLoading && <p className="text-sm text-muted-foreground">Loading tasks...</p>}
          {!tasksQuery.isLoading && view === 'list' && (
            <div className="dashboard-panel rounded-xl">
              <div className="grid grid-cols-5 border-b bg-background/60 px-4 py-2 text-xs font-semibold text-muted-foreground">
                <span>Title</span>
                <span>Status</span>
                <span>Type</span>
                <span>Priority</span>
                <span>Estimate</span>
              </div>
              {sortedTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`grid w-full grid-cols-5 border-b border-border/60 px-4 py-3 text-left text-sm hover:bg-muted/50 ${selectedTaskId === task.id ? 'bg-primary/10' : ''}`}
                >
                  <span className="font-medium">{task.title}</span>
                  <span className={getStatusPillClass(task.status as TaskStatus)}>{task.status}</span>
                  <span>{task.type}</span>
                  <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-semibold ${priorityStyleMap[task.priority as PriorityOption]}`}>
                    {task.priority}
                  </span>
                  <span>
                    {task.estimatedPoints ?? '-'} pt / {task.estimatedHours ?? '-'} h
                  </span>
                </button>
              ))}
              {sortedTasks.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">No tasks for current filter.</div>
              )}
            </div>
          )}

          {!tasksQuery.isLoading && view === 'board' && (
            <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-4">
              {boardColumns.map((column, index) => (
                <div key={column.key} className="w-72 flex-shrink-0">
                  <div className={`animate-fade-up rounded-xl border shadow-sm ${column.toneClass}`} style={{ animationDelay: `${index * 45}ms` }}>
                    <div className="flex items-center justify-between border-b border-border/70 p-3">
                      <h3 className="text-sm font-semibold">{column.title}</h3>
                      <span className={column.badgeClass}>
                        {groupedByStatus.get(column.key)?.length ?? 0}
                      </span>
                    </div>
                    <div
                      className="space-y-2 p-2"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const taskId = event.dataTransfer.getData('text/task-id');
                        if (taskId) {
                          handleDrop(taskId, column.key);
                        }
                      }}
                    >
                      {(groupedByStatus.get(column.key) ?? []).map((task) => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData('text/task-id', task.id);
                          }}
                          onClick={() => setSelectedTaskId(task.id)}
                          className={`cursor-move rounded-lg border bg-background/85 p-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow ${selectedTaskId === task.id ? 'border-primary/50 ring-1 ring-primary/35' : 'border-border/70'}`}
                        >
                          <p className="text-sm font-medium">{task.title}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="inline-flex rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                              {task.type}
                            </span>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityStyleMap[task.priority as PriorityOption]}`}>
                              {task.priority}
                            </span>
                          </div>
                        </div>
                      ))}
                      {(groupedByStatus.get(column.key)?.length ?? 0) === 0 && (
                        <p className="rounded-md border border-dashed border-border/80 bg-background/70 p-2 text-xs text-muted-foreground">No tasks</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="dashboard-panel soft-surface rounded-xl p-4 xl:sticky xl:top-4 xl:h-fit">
          <h2 className="text-sm font-semibold text-muted-foreground">Task Detail</h2>
          {!selectedTaskId && (
            <p className="mt-2 text-sm text-muted-foreground">
              Select a task from list/board to edit details, estimates, or delete it.
            </p>
          )}
          {selectedTaskId && selectedTaskQuery.isLoading && (
            <p className="mt-2 text-sm text-muted-foreground">Loading selected task...</p>
          )}
          {selectedTaskId && taskDetailDraft && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Title</label>
                <input
                  className="w-full rounded-md border bg-background/85 px-3 py-2 text-sm"
                  value={taskDetailDraft.title}
                  onChange={(event) => {
                    setTaskDetailDraft((previous) => (
                      previous ? { ...previous, title: event.target.value } : previous
                    ));
                  }}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Description</label>
                <textarea
                  className="h-24 w-full rounded-md border bg-background/85 px-3 py-2 text-sm"
                  value={taskDetailDraft.description}
                  onChange={(event) => {
                    setTaskDetailDraft((previous) => (
                      previous ? { ...previous, description: event.target.value } : previous
                    ));
                  }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Status</label>
                  <select
                    className="w-full rounded-md border bg-background/85 px-2 py-2 text-sm"
                    value={taskDetailDraft.status}
                    onChange={(event) => {
                      setTaskDetailDraft((previous) => (
                        previous ? { ...previous, status: event.target.value as TaskStatus } : previous
                      ));
                    }}
                  >
                    {statusOptions
                      .filter((value): value is TaskStatus => value !== '')
                      .map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Type</label>
                  <select
                    className="w-full rounded-md border bg-background/85 px-2 py-2 text-sm"
                    value={taskDetailDraft.type}
                    onChange={(event) => {
                      setTaskDetailDraft((previous) => (
                        previous ? { ...previous, type: event.target.value as TaskType } : previous
                      ));
                    }}
                  >
                    {typeOptions
                      .filter((value): value is TaskType => value !== '')
                      .map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Priority</label>
                  <select
                    className="w-full rounded-md border bg-background/85 px-2 py-2 text-sm"
                    value={taskDetailDraft.priority}
                    onChange={(event) => {
                      setTaskDetailDraft((previous) => (
                        previous ? { ...previous, priority: event.target.value as PriorityOption } : previous
                      ));
                    }}
                  >
                    {priorityOptions.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Estimated Points</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-md border bg-background/85 px-3 py-2 text-sm"
                    value={taskDetailDraft.estimatedPoints}
                    onChange={(event) => {
                      setTaskDetailDraft((previous) => (
                        previous ? { ...previous, estimatedPoints: event.target.value } : previous
                      ));
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Estimated Hours</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-md border bg-background/85 px-3 py-2 text-sm"
                    value={taskDetailDraft.estimatedHours}
                    onChange={(event) => {
                      setTaskDetailDraft((previous) => (
                        previous ? { ...previous, estimatedHours: event.target.value } : previous
                      ));
                    }}
                  />
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Estimation Actions</p>
                <div className="flex flex-wrap gap-2">
                  {estimatePresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyEstimatePreset(preset.points, preset.hours)}
                      className="inline-flex items-center gap-1 rounded-md border bg-background/80 px-2 py-1 text-xs font-medium hover:bg-muted"
                    >
                      <WandSparkles className="h-3 w-3" />
                      {preset.label} ({preset.points}pt / {preset.hours}h)
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setTaskDetailDraft((previous) => (
                        previous
                          ? { ...previous, estimatedPoints: '', estimatedHours: '' }
                          : previous
                      ));
                    }}
                    className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted"
                  >
                    Clear Estimate
                  </button>
                </div>
              </div>

              <div className="rounded-md border bg-background/60 p-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  Subtasks ({selectedTaskQuery.data?.children?.length ?? 0})
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    className="flex-1 rounded-md border bg-background/85 px-3 py-1.5 text-sm"
                    placeholder="New subtask title"
                    value={newSubtaskTitle}
                    onChange={(event) => setNewSubtaskTitle(event.target.value)}
                  />
                  <button
                    onClick={handleCreateSubtask}
                    disabled={!newSubtaskTitle.trim() || createSubtaskMutation.isPending}
                    className="inline-flex items-center gap-1 rounded-md border bg-background/80 px-2 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveTaskDetail}
                  disabled={!taskDetailDraft.title.trim() || updateTaskMutation.isPending}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {updateTaskMutation.isPending ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleDeleteTask}
                  disabled={deleteTaskMutation.isPending}
                  className="inline-flex items-center justify-center gap-1 rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
