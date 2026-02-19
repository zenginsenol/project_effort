'use client';

import {
  AlertTriangle,
  Download,
  Github,
  GitCompare,
  Calculator,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  FileText,
  Save,
  Sparkles,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  backlog: 'bg-gray-100 text-gray-700',
  todo: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  in_review: 'bg-purple-100 text-purple-700',
  done: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
  none: 'bg-gray-100 text-gray-700',
};

const TYPE_COLORS: Record<string, string> = {
  epic: 'bg-purple-100 text-purple-700',
  feature: 'bg-blue-100 text-blue-700',
  story: 'bg-green-100 text-green-700',
  task: 'bg-gray-100 text-gray-700',
  subtask: 'bg-gray-50 text-gray-600',
  bug: 'bg-red-100 text-red-700',
};

const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';
const AI_PROVIDER_OPTIONS = ['openai', 'anthropic', 'openrouter'] as const;
const AI_REASONING_OPTIONS = ['low', 'medium', 'high', 'xhigh'] as const;
const ADDITIONAL_COST_FREQUENCIES = ['one_time', 'monthly', 'annual'] as const;

type AIProviderOption = typeof AI_PROVIDER_OPTIONS[number];
type AIReasoningOption = typeof AI_REASONING_OPTIONS[number];
type AdditionalCostFrequency = typeof ADDITIONAL_COST_FREQUENCIES[number];

type AdditionalCostDraft = {
  id?: string;
  label: string;
  amount: number;
  frequency: AdditionalCostFrequency;
  note: string;
};

export default function EffortPage(): React.ReactElement {
  const utils = trpc.useUtils();

  const [hourlyRate, setHourlyRate] = useState(150);
  const [currency, setCurrency] = useState('TRY');
  const [contingency, setContingency] = useState(20);
  const [workHoursPerDay, setWorkHoursPerDay] = useState(8);
  const [monthlyInfraOpsCost, setMonthlyInfraOpsCost] = useState(15000);
  const [annualDomainCost, setAnnualDomainCost] = useState(1200);
  const [monthlyMaintenanceHours, setMonthlyMaintenanceHours] = useState(80);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [autoApplyKanban, setAutoApplyKanban] = useState(true);
  const [autoMoveFirstWeekToTodo, setAutoMoveFirstWeekToTodo] = useState(true);
  const [kanbanSyncNotice, setKanbanSyncNotice] = useState('');
  const [showTasks, setShowTasks] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('summary');
  const autoAppliedSignatureRef = useRef<string | null>(null);
  const [analysisName, setAnalysisName] = useState('');
  const [analysisDescription, setAnalysisDescription] = useState('');
  const [analysisAssumptionsText, setAnalysisAssumptionsText] = useState('');
  const [aiInputText, setAiInputText] = useState('');
  const [aiProjectContext, setAiProjectContext] = useState('');
  const [aiProvider, setAiProvider] = useState<AIProviderOption>('openai');
  const [aiModel, setAiModel] = useState('');
  const [aiReasoningEffort, setAiReasoningEffort] = useState<AIReasoningOption>('medium');
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCostDraft[]>([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState('');
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [githubRepositoryOverride, setGithubRepositoryOverride] = useState('');
  const [analysisNotice, setAnalysisNotice] = useState('');
  const [exportingFormat, setExportingFormat] = useState<'json' | 'csv' | 'md' | null>(null);

  const effortQuery = trpc.effort.calculate.useQuery({
    projectId: selectedProjectId,
    hourlyRate,
    currency,
    contingencyPercent: contingency,
    workHoursPerDay,
  }, {
    enabled: !!selectedProjectId,
    retry: false,
  });

  const roadmapQuery = trpc.effort.roadmap.useQuery({
    projectId: selectedProjectId,
    contingencyPercent: contingency,
    workHoursPerDay,
    includeCompleted,
  }, {
    enabled: !!selectedProjectId,
    retry: false,
  });

  const applyRoadmapMutation = trpc.effort.applyRoadmap.useMutation({
    onSuccess: async (result) => {
      setKanbanSyncNotice(
        `Kanban updated: ${result.updatedCount} task(s), ${result.movedToTodo} moved to todo, ${result.movedToBacklog} moved to backlog.`,
      );
      await utils.task.list.invalidate({ projectId: result.project.id });
    },
    onError: (error) => {
      autoAppliedSignatureRef.current = null;
      setKanbanSyncNotice(`Kanban sync failed: ${error.message}`);
    },
  });

  // Also fetch project list to allow selection
  const allProjectsQuery = trpc.project.list.useQuery({
    organizationId: '',
  }, { retry: false });

  const analysesQuery = trpc.effort.listAnalyses.useQuery(
    { projectId: selectedProjectId },
    { enabled: Boolean(selectedProjectId), retry: false },
  );

  const selectedAnalysisQuery = trpc.effort.getAnalysis.useQuery(
    { analysisId: selectedAnalysisId || EMPTY_UUID },
    { enabled: Boolean(selectedAnalysisId), retry: false },
  );

  const compareAnalysesQuery = trpc.effort.compareAnalyses.useQuery(
    { projectId: selectedProjectId, analysisIds: compareSelection },
    { enabled: Boolean(selectedProjectId) && compareSelection.length >= 2, retry: false },
  );

  const saveCurrentAnalysisMutation = trpc.effort.saveCurrentAnalysis.useMutation({
    onSuccess: async (analysis) => {
      setAnalysisNotice(`Analysis saved: ${analysis.name}`);
      setSelectedAnalysisId(analysis.id);
      await analysesQuery.refetch();
    },
    onError: (error) => {
      setAnalysisNotice(`Save failed: ${error.message}`);
    },
  });

  const createAiAnalysisMutation = trpc.effort.createAiAnalysis.useMutation({
    onSuccess: async (analysis) => {
      setAnalysisNotice(`AI analysis created: ${analysis.name}`);
      setSelectedAnalysisId(analysis.id);
      await analysesQuery.refetch();
    },
    onError: (error) => {
      setAnalysisNotice(`AI analysis failed: ${error.message}`);
    },
  });

  const updateAnalysisMutation = trpc.effort.updateAnalysis.useMutation({
    onSuccess: async (analysis) => {
      setAnalysisNotice(`Analysis updated: ${analysis.name}`);
      await Promise.all([
        analysesQuery.refetch(),
        selectedAnalysisQuery.refetch(),
      ]);
    },
    onError: (error) => {
      setAnalysisNotice(`Update failed: ${error.message}`);
    },
  });

  const deleteAnalysisMutation = trpc.effort.deleteAnalysis.useMutation({
    onSuccess: async () => {
      setAnalysisNotice('Analysis deleted.');
      setSelectedAnalysisId('');
      setCompareSelection([]);
      await analysesQuery.refetch();
    },
    onError: (error) => {
      setAnalysisNotice(`Delete failed: ${error.message}`);
    },
  });

  const syncAnalysisToGithubMutation = trpc.effort.syncAnalysisToGithub.useMutation({
    onSuccess: async (result) => {
      setAnalysisNotice(`GitHub sync complete: #${result.issueNumber}`);
      await Promise.all([
        analysesQuery.refetch(),
        selectedAnalysisQuery.refetch(),
      ]);
    },
    onError: (error) => {
      setAnalysisNotice(`GitHub sync failed: ${error.message}`);
    },
  });

  const data = effortQuery.data;
  const roadmapData = roadmapQuery.data;

  const autoApplySignature = useMemo(() => {
    if (!selectedProjectId) {
      return '';
    }
    return [
      selectedProjectId,
      contingency,
      workHoursPerDay,
      includeCompleted ? '1' : '0',
      autoMoveFirstWeekToTodo ? '1' : '0',
    ].join(':');
  }, [autoMoveFirstWeekToTodo, contingency, includeCompleted, selectedProjectId, workHoursPerDay]);

  useEffect(() => {
    setKanbanSyncNotice('');
    autoAppliedSignatureRef.current = null;
    setAnalysisNotice('');
    setSelectedAnalysisId('');
    setCompareSelection([]);
    setGithubRepositoryOverride('');
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedAnalysisId || !analysesQuery.data?.[0]) {
      return;
    }
    setSelectedAnalysisId(analysesQuery.data[0].id);
  }, [analysesQuery.data, selectedAnalysisId]);

  useEffect(() => {
    if (!selectedAnalysisQuery.data) {
      return;
    }

    const analysis = selectedAnalysisQuery.data;
    setAnalysisName(analysis.name ?? '');
    setAnalysisDescription(analysis.description ?? '');
    setAnalysisAssumptionsText((analysis.assumptions ?? []).join('\n'));
    setHourlyRate(analysis.parameters.hourlyRate);
    setCurrency(analysis.parameters.currency);
    setContingency(analysis.parameters.contingencyPercent);
    setWorkHoursPerDay(analysis.parameters.workHoursPerDay);
    setMonthlyInfraOpsCost(analysis.editableSections.monthlyInfraOpsCost);
    setAnnualDomainCost(analysis.editableSections.annualDomainCost);
    setMonthlyMaintenanceHours(analysis.editableSections.monthlyMaintenanceHours);
    setAdditionalCosts(
      (analysis.editableSections.additionalCosts ?? []).map((item) => ({
        id: item.id,
        label: item.label,
        amount: item.amount,
        frequency: item.frequency as AdditionalCostFrequency,
        note: item.note ?? '',
      })),
    );
    setGithubRepositoryOverride(analysis.github.repository ?? '');
  }, [selectedAnalysisQuery.data]);

  useEffect(() => {
    if (!selectedProjectId || !autoApplyKanban || !roadmapData || applyRoadmapMutation.isPending) {
      return;
    }
    if (autoAppliedSignatureRef.current === autoApplySignature) {
      return;
    }

    autoAppliedSignatureRef.current = autoApplySignature;
    applyRoadmapMutation.mutate({
      projectId: selectedProjectId,
      contingencyPercent: contingency,
      workHoursPerDay,
      includeCompleted,
      autoMoveFirstWeekToTodo,
    });
  }, [
    applyRoadmapMutation,
    autoApplyKanban,
    autoApplySignature,
    autoMoveFirstWeekToTodo,
    contingency,
    includeCompleted,
    roadmapData,
    selectedProjectId,
    workHoursPerDay,
  ]);

  const formatCurrency = (amount: number) => {
    if (currency === 'TRY') return `${amount.toLocaleString('tr-TR')} TL`;
    if (currency === 'USD') return `$${amount.toLocaleString('en-US')}`;
    if (currency === 'EUR') return `${amount.toLocaleString('de-DE')} EUR`;
    return `${amount.toLocaleString()} ${currency}`;
  };

  const annualMaintenanceCost = monthlyMaintenanceHours * hourlyRate * 12;
  const annualInfraOpsCost = monthlyInfraOpsCost * 12;
  const firstYearOpsCost = annualInfraOpsCost + annualMaintenanceCost + annualDomainCost;
  const firstYearTotalCost = (data?.summary.totalCost ?? 0) + firstYearOpsCost;

  function handleApplyRoadmap(): void {
    if (!selectedProjectId) {
      return;
    }

    autoAppliedSignatureRef.current = autoApplySignature;
    applyRoadmapMutation.mutate({
      projectId: selectedProjectId,
      contingencyPercent: contingency,
      workHoursPerDay,
      includeCompleted,
      autoMoveFirstWeekToTodo,
    });
  }

  function assumptionsFromText(): string[] {
    return analysisAssumptionsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function editableSectionsPayload() {
    return {
      monthlyInfraOpsCost,
      annualDomainCost,
      monthlyMaintenanceHours,
      additionalCosts: additionalCosts
        .filter((item) => item.label.trim().length > 0)
        .map((item) => ({
          id: item.id,
          label: item.label.trim(),
          amount: Number.isFinite(item.amount) ? Math.max(0, item.amount) : 0,
          frequency: item.frequency,
          note: item.note.trim() || undefined,
        })),
    };
  }

  function handleSaveCurrentAnalysis(): void {
    if (!selectedProjectId) {
      return;
    }

    saveCurrentAnalysisMutation.mutate({
      projectId: selectedProjectId,
      name: analysisName.trim() || undefined,
      description: analysisDescription.trim() || undefined,
      assumptions: assumptionsFromText(),
      parameters: {
        hourlyRate,
        currency,
        contingencyPercent: contingency,
        workHoursPerDay,
      },
      editableSections: editableSectionsPayload(),
    });
  }

  function handleCreateAiAnalysis(): void {
    if (!selectedProjectId || !aiInputText.trim()) {
      return;
    }

    createAiAnalysisMutation.mutate({
      projectId: selectedProjectId,
      name: analysisName.trim() || undefined,
      description: analysisDescription.trim() || undefined,
      assumptions: assumptionsFromText(),
      parameters: {
        hourlyRate,
        currency,
        contingencyPercent: contingency,
        workHoursPerDay,
      },
      editableSections: editableSectionsPayload(),
      text: aiInputText.trim(),
      projectContext: aiProjectContext.trim() || undefined,
      provider: aiProvider,
      model: aiModel.trim() || undefined,
      reasoningEffort: aiReasoningEffort,
    });
  }

  function handleUpdateSelectedAnalysis(): void {
    if (!selectedAnalysisId) {
      return;
    }

    updateAnalysisMutation.mutate({
      analysisId: selectedAnalysisId,
      name: analysisName.trim() || undefined,
      description: analysisDescription.trim() || null,
      assumptions: assumptionsFromText(),
      parameters: {
        hourlyRate,
        currency,
        contingencyPercent: contingency,
        workHoursPerDay,
      },
      editableSections: editableSectionsPayload(),
    });
  }

  function handleDeleteSelectedAnalysis(): void {
    if (!selectedAnalysisId) {
      return;
    }
    if (!window.confirm('Delete selected analysis permanently?')) {
      return;
    }
    deleteAnalysisMutation.mutate({ analysisId: selectedAnalysisId });
  }

  function addAdditionalCost(): void {
    setAdditionalCosts((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        label: '',
        amount: 0,
        frequency: 'one_time',
        note: '',
      },
    ]);
  }

  function updateAdditionalCost(index: number, patch: Partial<AdditionalCostDraft>): void {
    setAdditionalCosts((previous) => previous.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    )));
  }

  function removeAdditionalCost(index: number): void {
    setAdditionalCosts((previous) => previous.filter((_item, itemIndex) => itemIndex !== index));
  }

  function toggleCompareSelection(analysisId: string): void {
    setCompareSelection((previous) => {
      if (previous.includes(analysisId)) {
        return previous.filter((item) => item !== analysisId);
      }
      if (previous.length >= 6) {
        return previous;
      }
      return [...previous, analysisId];
    });
  }

  async function handleExportAnalysis(format: 'json' | 'csv' | 'md'): Promise<void> {
    if (!selectedAnalysisId || exportingFormat) {
      return;
    }

    try {
      setExportingFormat(format);
      const response = await utils.effort.exportAnalysis.fetch({
        analysisId: selectedAnalysisId,
        format,
      });
      const blob = new Blob([response.content], { type: response.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = response.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setAnalysisNotice(`Export ready: ${response.filename}`);
    } catch (error) {
      setAnalysisNotice(
        `Export failed: ${error instanceof Error ? error.message : 'Unexpected error'}`,
      );
    } finally {
      setExportingFormat(null);
    }
  }

  function handleSyncSelectedAnalysisToGithub(): void {
    if (!selectedAnalysisId) {
      return;
    }

    syncAnalysisToGithubMutation.mutate({
      analysisId: selectedAnalysisId,
      repository: githubRepositoryOverride.trim() || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" />
          Effort & Cost Calculator
        </h1>
        <p className="mt-1 text-muted-foreground">
          Calculate man-hours, project cost, and delivery timeline for your projects.
        </p>
      </div>

      {/* Parameters Panel */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Calculation Parameters</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select a project...</option>
              {(allProjectsQuery.data ?? []).map((p: { id: string; name: string }) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Hourly Rate</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                min={0}
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="rounded-md border bg-background px-2 py-2 text-sm"
              >
                <option value="TRY">TL</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Contingency %</label>
            <input
              type="number"
              value={contingency}
              onChange={(e) => setContingency(Number(e.target.value))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              min={0}
              max={100}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Work Hours/Day</label>
            <input
              type="number"
              value={workHoursPerDay}
              onChange={(e) => setWorkHoursPerDay(Number(e.target.value))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              min={1}
              max={24}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                void effortQuery.refetch();
                void roadmapQuery.refetch();
              }}
              disabled={!selectedProjectId}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Calculate
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={(event) => setIncludeCompleted(event.target.checked)}
              className="h-4 w-4"
            />
            Include completed tasks in roadmap
          </label>
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={autoApplyKanban}
              onChange={(event) => setAutoApplyKanban(event.target.checked)}
              className="h-4 w-4"
            />
            Auto-apply roadmap to Kanban
          </label>
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={autoMoveFirstWeekToTodo}
              onChange={(event) => setAutoMoveFirstWeekToTodo(event.target.checked)}
              className="h-4 w-4"
            />
            Move week-1 tasks to Todo
          </label>
          <button
            onClick={handleApplyRoadmap}
            disabled={!selectedProjectId || applyRoadmapMutation.isPending}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {applyRoadmapMutation.isPending ? 'Applying...' : 'Apply Roadmap to Kanban'}
          </button>
        </div>
        {kanbanSyncNotice && (
          <p className="mt-3 text-sm text-muted-foreground">{kanbanSyncNotice}</p>
        )}

        <div className="mt-5 rounded-md border border-dashed p-4">
          <h3 className="text-sm font-semibold">Operational Cost Inputs (Year-1 Projection)</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Infra/Ops Monthly</label>
              <input
                type="number"
                value={monthlyInfraOpsCost}
                onChange={(event) => setMonthlyInfraOpsCost(Number(event.target.value))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                min={0}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Domain/SSL Annual</label>
              <input
                type="number"
                value={annualDomainCost}
                onChange={(event) => setAnnualDomainCost(Number(event.target.value))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                min={0}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Maintenance Hours / Month</label>
              <input
                type="number"
                value={monthlyMaintenanceHours}
                onChange={(event) => setMonthlyMaintenanceHours(Number(event.target.value))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                min={0}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Calculation: Infra(12 ay) + Bakim isciligi(12 ay) + Domain/SSL (yillik)
          </p>
        </div>
      </div>

      {!selectedProjectId && (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center">
          <Calculator className="h-12 w-12 text-muted-foreground/50 mx-auto" />
          <h3 className="mt-4 text-lg font-medium">Select a Project</h3>
          <p className="mt-1 text-sm text-muted-foreground">Choose a project above to calculate effort and cost.</p>
        </div>
      )}

      {effortQuery.isLoading && selectedProjectId && (
        <div className="rounded-lg border bg-card p-12 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-muted-foreground">Calculating...</p>
        </div>
      )}

      {effortQuery.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="text-red-700">Error: {effortQuery.error.message}</p>
        </div>
      )}

      {roadmapQuery.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="text-red-700">Roadmap error: {roadmapQuery.error.message}</p>
        </div>
      )}

      {roadmapData && (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Execution Roadmap</h2>
              <p className="text-sm text-muted-foreground">
                Project: {roadmapData.project.name} ({roadmapData.project.key})
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {roadmapData.summary.totalWithContingency}h total / {roadmapData.summary.totalWeeks} week(s)
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Planned Hours</p>
              <p className="text-lg font-semibold">{roadmapData.summary.totalPlannedHours}h</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Contingency</p>
              <p className="text-lg font-semibold">{roadmapData.summary.contingencyHours}h</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="text-lg font-semibold">{roadmapData.summary.totalDays} day(s)</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Weekly Capacity</p>
              <p className="text-lg font-semibold">{roadmapData.summary.hoursPerWeek}h/week</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {roadmapData.phases.map((phase) => (
              <div key={phase.week} className="rounded-md border">
                <div className="flex items-center justify-between border-b px-4 py-2">
                  <p className="font-medium">
                    Week {phase.week} (Day {phase.startDay}-{phase.endDay})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {phase.taskCount} item(s) • {phase.totalHours}h
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="px-4 py-2 font-medium">Task</th>
                        <th className="px-4 py-2 font-medium">Priority</th>
                        <th className="px-4 py-2 font-medium">Current</th>
                        <th className="px-4 py-2 font-medium">Suggested</th>
                        <th className="px-4 py-2 text-right font-medium">Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {phase.tasks.map((task) => (
                        <tr key={`${phase.week}-${task.taskId ?? task.title}`} className="border-t">
                          <td className="px-4 py-2">{task.title}</td>
                          <td className="px-4 py-2">
                            <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', PRIORITY_COLORS[task.priority] || 'bg-gray-100')}>
                              {task.priority}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[task.currentStatus] || 'bg-gray-100')}>
                              {task.currentStatus}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[task.recommendedStatus] || 'bg-gray-100')}>
                              {task.recommendedStatus}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right">{task.estimatedHours}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {roadmapData.phases.length === 0 && (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No estimable tasks found to build a roadmap.
              </div>
            )}
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total Tasks</span>
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <p className="mt-2 text-3xl font-bold">{data.summary.totalTasks}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.summary.estimatedTasks} estimated, {data.summary.unestimatedTasks} pending
              </p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total Man-Hours</span>
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <p className="mt-2 text-3xl font-bold">{data.summary.totalEstimatedHours}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                +{data.summary.contingencyHours}h contingency = {data.summary.totalWithContingency}h
              </p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Duration</span>
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <p className="mt-2 text-3xl font-bold">{data.summary.totalDays} days</p>
              <p className="mt-1 text-xs text-muted-foreground">
                ~{data.summary.totalWeeks} weeks ({workHoursPerDay}h/day)
              </p>
            </div>
            <div className="rounded-lg border bg-gradient-to-br from-primary/10 to-primary/5 p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total Cost</span>
                <DollarSign className="h-5 w-5 text-orange-600" />
              </div>
              <p className="mt-2 text-3xl font-bold text-primary">{formatCurrency(data.summary.totalCost)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Base: {formatCurrency(data.summary.baseCost)} + Buffer: {formatCurrency(data.summary.contingencyCost)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Annual Infra/Ops</p>
              <p className="mt-1 text-xl font-semibold">{formatCurrency(annualInfraOpsCost)}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(monthlyInfraOpsCost)}/month x 12</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Annual Maintenance</p>
              <p className="mt-1 text-xl font-semibold">{formatCurrency(annualMaintenanceCost)}</p>
              <p className="text-xs text-muted-foreground">{monthlyMaintenanceHours}h/month x {formatCurrency(hourlyRate)}/h</p>
            </div>
            <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
              <p className="text-xs text-muted-foreground">Year-1 Total (Dev + Ops)</p>
              <p className="mt-1 text-xl font-semibold text-primary">{formatCurrency(firstYearTotalCost)}</p>
              <p className="text-xs text-muted-foreground">
                Dev: {formatCurrency(data.summary.totalCost)} + Ops: {formatCurrency(firstYearOpsCost)}
              </p>
            </div>
          </div>

          {/* Unestimated Tasks Warning */}
          {data.unestimatedTasks.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-yellow-800">{data.unestimatedTasks.length} tasks without estimation</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  These tasks are included in the count but have no estimated hours. The total cost may be higher.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.unestimatedTasks.slice(0, 5).map(t => (
                    <span key={t.id} className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                      {t.title}
                    </span>
                  ))}
                  {data.unestimatedTasks.length > 5 && (
                    <span className="text-xs text-yellow-700">+{data.unestimatedTasks.length - 5} more</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Breakdown by Type */}
          <div className="rounded-lg border bg-card">
            <button
              onClick={() => setExpandedSection(expandedSection === 'type' ? null : 'type')}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <h2 className="text-lg font-semibold">Breakdown by Task Type</h2>
              {expandedSection === 'type' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
            {expandedSection === 'type' && (
              <div className="border-t p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium text-right">Count</th>
                      <th className="pb-2 font-medium text-right">Hours</th>
                      <th className="pb-2 font-medium text-right">Points</th>
                      <th className="pb-2 font-medium text-right">Cost</th>
                      <th className="pb-2 font-medium text-right">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.breakdown.byType).map(([type, info]) => (
                      <tr key={type} className="border-t">
                        <td className="py-2">
                          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', TYPE_COLORS[type] || 'bg-gray-100')}>
                            {type}
                          </span>
                        </td>
                        <td className="py-2 text-right">{(info as { count: number }).count}</td>
                        <td className="py-2 text-right">{(info as { hours: number }).hours}h</td>
                        <td className="py-2 text-right">{(info as { points: number }).points}pts</td>
                        <td className="py-2 text-right font-medium">{formatCurrency((info as { cost: number }).cost)}</td>
                        <td className="py-2 text-right text-muted-foreground">
                          {data.summary.totalEstimatedHours > 0
                            ? Math.round(((info as { hours: number }).hours / data.summary.totalEstimatedHours) * 100)
                            : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Breakdown by Priority */}
          <div className="rounded-lg border bg-card">
            <button
              onClick={() => setExpandedSection(expandedSection === 'priority' ? null : 'priority')}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <h2 className="text-lg font-semibold">Breakdown by Priority</h2>
              {expandedSection === 'priority' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
            {expandedSection === 'priority' && (
              <div className="border-t p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Priority</th>
                      <th className="pb-2 font-medium text-right">Count</th>
                      <th className="pb-2 font-medium text-right">Hours</th>
                      <th className="pb-2 font-medium text-right">Cost</th>
                      <th className="pb-2 font-medium text-right">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.breakdown.byPriority).map(([priority, info]) => (
                      <tr key={priority} className="border-t">
                        <td className="py-2">
                          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', PRIORITY_COLORS[priority] || 'bg-gray-100')}>
                            {priority}
                          </span>
                        </td>
                        <td className="py-2 text-right">{(info as { count: number }).count}</td>
                        <td className="py-2 text-right">{(info as { hours: number }).hours}h</td>
                        <td className="py-2 text-right font-medium">{formatCurrency((info as { cost: number }).cost)}</td>
                        <td className="py-2 text-right text-muted-foreground">
                          {data.summary.totalEstimatedHours > 0
                            ? Math.round(((info as { hours: number }).hours / data.summary.totalEstimatedHours) * 100)
                            : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Breakdown by Status */}
          <div className="rounded-lg border bg-card">
            <button
              onClick={() => setExpandedSection(expandedSection === 'status' ? null : 'status')}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <h2 className="text-lg font-semibold">Breakdown by Status</h2>
              {expandedSection === 'status' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
            {expandedSection === 'status' && (
              <div className="border-t p-4">
                <div className="mb-4">
                  {/* Progress bar */}
                  <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
                    {Object.entries(data.breakdown.byStatus).map(([status, info]) => {
                      const pct = data.summary.totalTasks > 0
                        ? ((info as { count: number }).count / data.summary.totalTasks) * 100
                        : 0;
                      const colors: Record<string, string> = {
                        done: 'bg-green-500',
                        in_review: 'bg-purple-500',
                        in_progress: 'bg-yellow-500',
                        todo: 'bg-blue-500',
                        backlog: 'bg-gray-400',
                      };
                      return <div key={status} className={cn(colors[status] || 'bg-gray-300')} style={{ width: `${pct}%` }} title={`${status}: ${(info as { count: number }).count}`} />;
                    })}
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium text-right">Count</th>
                      <th className="pb-2 font-medium text-right">Hours</th>
                      <th className="pb-2 font-medium text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.breakdown.byStatus).map(([status, info]) => (
                      <tr key={status} className="border-t">
                        <td className="py-2">
                          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[status] || 'bg-gray-100')}>
                            {status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2 text-right">{(info as { count: number }).count}</td>
                        <td className="py-2 text-right">{(info as { hours: number }).hours}h</td>
                        <td className="py-2 text-right font-medium">{formatCurrency((info as { cost: number }).cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* All Tasks Detail */}
          <div className="rounded-lg border bg-card">
            <button
              onClick={() => setShowTasks(!showTasks)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <h2 className="text-lg font-semibold">All Tasks Detail ({data.tasks.length})</h2>
              {showTasks ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
            {showTasks && (
              <div className="border-t overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground bg-muted/50">
                      <th className="p-3 font-medium">Title</th>
                      <th className="p-3 font-medium">Type</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium">Priority</th>
                      <th className="p-3 font-medium text-right">Est. Hours</th>
                      <th className="p-3 font-medium text-right">Actual Hours</th>
                      <th className="p-3 font-medium text-right">Points</th>
                      <th className="p-3 font-medium text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tasks.map((task) => (
                      <tr key={task.id} className="border-t hover:bg-muted/30">
                        <td className="p-3 font-medium max-w-xs truncate">{task.title}</td>
                        <td className="p-3">
                          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', TYPE_COLORS[task.type] || 'bg-gray-100')}>
                            {task.type}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[task.status] || 'bg-gray-100')}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', PRIORITY_COLORS[task.priority] || 'bg-gray-100')}>
                            {task.priority}
                          </span>
                        </td>
                        <td className="p-3 text-right">{task.estimatedHours ?? '-'}h</td>
                        <td className="p-3 text-right">{task.actualHours ?? '-'}h</td>
                        <td className="p-3 text-right">{task.estimatedPoints ?? '-'}</td>
                        <td className="p-3 text-right font-medium">{formatCurrency(task.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/50 font-bold">
                      <td className="p-3" colSpan={4}>TOTAL</td>
                      <td className="p-3 text-right">{data.summary.totalEstimatedHours}h</td>
                      <td className="p-3 text-right">{data.summary.totalActualHours}h</td>
                      <td className="p-3 text-right">{data.summary.totalEstimatedPoints}</td>
                      <td className="p-3 text-right">{formatCurrency(data.summary.baseCost)}</td>
                    </tr>
                    <tr className="bg-primary/5 font-bold text-primary">
                      <td className="p-3" colSpan={4}>TOTAL (with {contingency}% contingency)</td>
                      <td className="p-3 text-right">{data.summary.totalWithContingency}h</td>
                      <td className="p-3 text-right">-</td>
                      <td className="p-3 text-right">-</td>
                      <td className="p-3 text-right">{formatCurrency(data.summary.totalCost)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Cost Summary Box */}
          <div className="rounded-lg border-2 border-primary bg-gradient-to-r from-primary/5 to-primary/10 p-6">
            <h2 className="text-xl font-bold mb-4">Cost Summary</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Project</p>
                <p className="text-lg font-bold">{data.project.name}</p>
                <p className="text-xs text-muted-foreground">{data.project.key}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Effort</p>
                <p className="text-lg font-bold">{data.summary.totalWithContingency} man-hours</p>
                <p className="text-xs text-muted-foreground">
                  {data.summary.totalEstimatedHours}h base + {data.summary.contingencyHours}h buffer ({contingency}%)
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Timeline</p>
                <p className="text-lg font-bold">{data.summary.totalDays} work days</p>
                <p className="text-xs text-muted-foreground">
                  ~{data.summary.totalWeeks} weeks (1 developer, {workHoursPerDay}h/day)
                </p>
              </div>
            </div>
            <div className="mt-6 border-t border-primary/20 pt-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Grand Total</p>
                  <p className="text-xs text-muted-foreground">@ {formatCurrency(hourlyRate)}/hour</p>
                </div>
                <p className="text-4xl font-bold text-primary">{formatCurrency(data.summary.totalCost)}</p>
              </div>
            </div>
          </div>
        </>
      )}

      {selectedProjectId && (
        <>
          <div className="rounded-lg border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Save className="h-5 w-5 text-primary" />
                  Cost Analysis Workspace
                </h2>
                <p className="text-sm text-muted-foreground">
                  Save, edit, and reuse cost analysis snapshots for this project.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveCurrentAnalysis}
                  disabled={saveCurrentAnalysisMutation.isPending}
                  className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  {saveCurrentAnalysisMutation.isPending ? 'Saving...' : 'Save Current Snapshot'}
                </button>
                <button
                  onClick={handleUpdateSelectedAnalysis}
                  disabled={!selectedAnalysisId || updateAnalysisMutation.isPending}
                  className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  {updateAnalysisMutation.isPending ? 'Updating...' : 'Update Selected'}
                </button>
                <button
                  onClick={handleDeleteSelectedAnalysis}
                  disabled={!selectedAnalysisId || deleteAnalysisMutation.isPending}
                  className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-1">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </span>
                </button>
              </div>
            </div>

            {analysisNotice && (
              <p className="mt-3 rounded-md border bg-muted/40 px-3 py-2 text-sm">{analysisNotice}</p>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Analysis Name</label>
                <input
                  type="text"
                  value={analysisName}
                  onChange={(event) => setAnalysisName(event.target.value)}
                  placeholder="e.g. Q1 launch baseline"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                <input
                  type="text"
                  value={analysisDescription}
                  onChange={(event) => setAnalysisDescription(event.target.value)}
                  placeholder="Scope or scenario details"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Assumptions (one per line)</label>
                <textarea
                  value={analysisAssumptionsText}
                  onChange={(event) => setAnalysisAssumptionsText(event.target.value)}
                  placeholder={'Single squad, 8h/day\nNo major architecture rewrite\nProd monitoring included'}
                  className="h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Cost Analysis (OpenAI / Claude / Other)
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate a new analysis from document text using your configured provider keys.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Provider</label>
                <select
                  value={aiProvider}
                  onChange={(event) => setAiProvider(event.target.value as AIProviderOption)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  {AI_PROVIDER_OPTIONS.map((provider) => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Model (optional)</label>
                <input
                  type="text"
                  value={aiModel}
                  onChange={(event) => setAiModel(event.target.value)}
                  placeholder="gpt-5.2 / claude-sonnet-4-6"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Reasoning</label>
                <select
                  value={aiReasoningEffort}
                  onChange={(event) => setAiReasoningEffort(event.target.value as AIReasoningOption)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  {AI_REASONING_OPTIONS.map((effort) => (
                    <option key={effort} value={effort}>{effort}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleCreateAiAnalysis}
                  disabled={!aiInputText.trim() || createAiAnalysisMutation.isPending}
                  className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {createAiAnalysisMutation.isPending ? 'Analyzing...' : 'Create AI Analysis'}
                </button>
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="block text-xs font-medium text-muted-foreground mb-1">AI Project Context (optional)</label>
                <input
                  type="text"
                  value={aiProjectContext}
                  onChange={(event) => setAiProjectContext(event.target.value)}
                  placeholder="Tech stack, team composition, release constraints"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Requirements / Scope Text</label>
                <textarea
                  value={aiInputText}
                  onChange={(event) => setAiInputText(event.target.value)}
                  placeholder="Paste PRD, scope notes, or analysis text..."
                  className="h-40 w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold">Editable Operational Cost Sections</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Maintain alternative infra/domain/maintenance cost items in saved analyses.
            </p>

            <div className="mt-4 space-y-3">
              {additionalCosts.map((item, index) => (
                <div key={item.id ?? `extra-${index}`} className="grid gap-2 rounded-md border p-3 sm:grid-cols-12">
                  <input
                    value={item.label}
                    onChange={(event) => updateAdditionalCost(index, { label: event.target.value })}
                    placeholder="Additional cost label"
                    className="rounded-md border bg-background px-3 py-2 text-sm sm:col-span-4"
                  />
                  <input
                    type="number"
                    value={item.amount}
                    onChange={(event) => updateAdditionalCost(index, { amount: Number(event.target.value) })}
                    min={0}
                    className="rounded-md border bg-background px-3 py-2 text-sm sm:col-span-2"
                  />
                  <select
                    value={item.frequency}
                    onChange={(event) => updateAdditionalCost(index, { frequency: event.target.value as AdditionalCostFrequency })}
                    className="rounded-md border bg-background px-3 py-2 text-sm sm:col-span-2"
                  >
                    {ADDITIONAL_COST_FREQUENCIES.map((frequency) => (
                      <option key={frequency} value={frequency}>{frequency}</option>
                    ))}
                  </select>
                  <input
                    value={item.note}
                    onChange={(event) => updateAdditionalCost(index, { note: event.target.value })}
                    placeholder="Notes"
                    className="rounded-md border bg-background px-3 py-2 text-sm sm:col-span-3"
                  />
                  <button
                    onClick={() => removeAdditionalCost(index)}
                    className="rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 sm:col-span-1"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={addAdditionalCost}
                className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Add Cost Item
              </button>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold">Saved Analyses</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select one record to edit/export. Select multiple records to compare.
            </p>

            {analysesQuery.isLoading && (
              <p className="mt-3 text-sm text-muted-foreground">Loading analyses...</p>
            )}

            {!analysesQuery.isLoading && (analysesQuery.data?.length ?? 0) === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">No saved analysis yet for this project.</p>
            )}

            {(analysesQuery.data ?? []).length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 text-left">
                      <th className="p-2 font-medium">Edit</th>
                      <th className="p-2 font-medium">Compare</th>
                      <th className="p-2 font-medium">Name</th>
                      <th className="p-2 font-medium">Source</th>
                      <th className="p-2 font-medium text-right">Hours</th>
                      <th className="p-2 font-medium text-right">Cost</th>
                      <th className="p-2 font-medium text-right">Year-1 Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analysesQuery.data ?? []).map((analysis) => (
                      <tr key={analysis.id} className="border-t">
                        <td className="p-2">
                          <input
                            type="radio"
                            checked={selectedAnalysisId === analysis.id}
                            onChange={() => setSelectedAnalysisId(analysis.id)}
                            name="selected-analysis"
                            className="h-4 w-4"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={compareSelection.includes(analysis.id)}
                            onChange={() => toggleCompareSelection(analysis.id)}
                            className="h-4 w-4"
                          />
                        </td>
                        <td className="p-2">
                          <p className="font-medium">{analysis.name}</p>
                          <p className="text-xs text-muted-foreground">{new Date(analysis.createdAt).toLocaleString()}</p>
                        </td>
                        <td className="p-2 text-xs">{analysis.source.type}{analysis.source.provider ? `/${analysis.source.provider}` : ''}</td>
                        <td className="p-2 text-right">{analysis.summary.totalWithContingency}h</td>
                        <td className="p-2 text-right">{formatCurrency(analysis.summary.totalCost)}</td>
                        <td className="p-2 text-right">{formatCurrency(analysis.summary.firstYearTotalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-primary" />
              Compare Analyses
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose at least 2 analyses to compute deltas against baseline.
            </p>
            {compareSelection.length < 2 && (
              <p className="mt-3 text-sm text-muted-foreground">Select 2+ analyses in the table above.</p>
            )}
            {compareSelection.length >= 2 && compareAnalysesQuery.isLoading && (
              <p className="mt-3 text-sm text-muted-foreground">Comparing...</p>
            )}
            {compareAnalysesQuery.data && (
              <div className="mt-4 overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 text-left">
                      <th className="p-2 font-medium">Analysis</th>
                      <th className="p-2 font-medium text-right">Hours</th>
                      <th className="p-2 font-medium text-right">Cost</th>
                      <th className="p-2 font-medium text-right">Year-1 Total</th>
                      <th className="p-2 font-medium text-right">Delta Hours</th>
                      <th className="p-2 font-medium text-right">Delta Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareAnalysesQuery.data.analyses.map((item) => (
                      <tr key={item.analysisId} className="border-t">
                        <td className="p-2">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.sourceLabel}</p>
                        </td>
                        <td className="p-2 text-right">{item.totalHours}h</td>
                        <td className="p-2 text-right">{formatCurrency(item.totalCost)}</td>
                        <td className="p-2 text-right">{formatCurrency(item.firstYearTotalCost)}</td>
                        <td className={cn(
                          'p-2 text-right',
                          item.delta.hours > 0 ? 'text-red-600' : item.delta.hours < 0 ? 'text-green-600' : 'text-muted-foreground',
                        )}
                        >
                          {item.delta.hours > 0 ? '+' : ''}{item.delta.hours}h
                        </td>
                        <td className={cn(
                          'p-2 text-right',
                          item.delta.totalCost > 0 ? 'text-red-600' : item.delta.totalCost < 0 ? 'text-green-600' : 'text-muted-foreground',
                        )}
                        >
                          {item.delta.totalCost > 0 ? '+' : ''}{formatCurrency(item.delta.totalCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Github className="h-5 w-5 text-primary" />
              Export & GitHub Integration
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Export selected analysis or sync it as GitHub issue in linked repository.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <button
                onClick={() => { void handleExportAnalysis('json'); }}
                disabled={!selectedAnalysisId || Boolean(exportingFormat)}
                className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-1">
                  <Download className="h-4 w-4" />
                  {exportingFormat === 'json' ? 'Exporting...' : 'Export JSON'}
                </span>
              </button>
              <button
                onClick={() => { void handleExportAnalysis('csv'); }}
                disabled={!selectedAnalysisId || Boolean(exportingFormat)}
                className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-1">
                  <Download className="h-4 w-4" />
                  {exportingFormat === 'csv' ? 'Exporting...' : 'Export CSV'}
                </span>
              </button>
              <button
                onClick={() => { void handleExportAnalysis('md'); }}
                disabled={!selectedAnalysisId || Boolean(exportingFormat)}
                className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-1">
                  <Download className="h-4 w-4" />
                  {exportingFormat === 'md' ? 'Exporting...' : 'Export Markdown'}
                </span>
              </button>
              <button
                onClick={handleSyncSelectedAnalysisToGithub}
                disabled={!selectedAnalysisId || syncAnalysisToGithubMutation.isPending}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {syncAnalysisToGithubMutation.isPending ? 'Syncing...' : 'Sync to GitHub'}
              </button>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Repository Override (optional)</label>
                <input
                  type="text"
                  value={githubRepositoryOverride}
                  onChange={(event) => setGithubRepositoryOverride(event.target.value)}
                  placeholder="owner/repo or GitHub URL"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            {selectedAnalysisQuery.data?.github.issueUrl && (
              <a
                href={selectedAnalysisQuery.data.github.issueUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Open Synced GitHub Issue #{selectedAnalysisQuery.data.github.issueNumber}
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}
