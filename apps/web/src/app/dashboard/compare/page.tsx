'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

type Provider = 'openai' | 'anthropic' | 'openrouter';
type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

interface ProviderSelection {
  id: string;
  provider: Provider;
  model: string;
  reasoningEffort: ReasoningEffort | null;
  enabled: boolean;
}

interface CompareResult {
  projectSummary: string;
  totalEstimatedHours: number;
  totalEstimatedCost: number;
  tasks: Array<{
    title: string;
    description: string;
    type: string;
    priority: string;
    estimatedHours: number;
    estimatedPoints: number;
  }>;
  assumptions: string[];
  provider?: string;
  model?: string;
  thinkingUsed?: boolean;
  durationMs?: number;
}

const PROVIDER_MODELS: Record<Provider, Array<{ id: string; name: string; reasoning: boolean }>> = {
  openai: [
    { id: 'gpt-5.2', name: 'GPT-5.2', reasoning: true },
    { id: 'gpt-5.2-pro', name: 'GPT-5.2 Pro', reasoning: true },
    { id: 'gpt-5', name: 'GPT-5', reasoning: true },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', reasoning: true },
    { id: 'o3', name: 'o3', reasoning: true },
    { id: 'o4-mini', name: 'o4-mini', reasoning: true },
    { id: 'gpt-4.1', name: 'GPT-4.1', reasoning: false },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', reasoning: false },
    { id: 'gpt-4o', name: 'GPT-4o', reasoning: false },
  ],
  anthropic: [
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', reasoning: true },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', reasoning: true },
    { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', reasoning: true },
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', reasoning: true },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', reasoning: true },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', reasoning: false },
  ],
  openrouter: [
    { id: 'openai/gpt-5.2', name: 'OpenAI GPT-5.2', reasoning: true },
    { id: 'openai/o3', name: 'OpenAI o3', reasoning: true },
    { id: 'openai/o4-mini', name: 'OpenAI o4-mini', reasoning: true },
    { id: 'anthropic/claude-opus-4-6', name: 'Claude Opus 4.6', reasoning: true },
    { id: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet 4.6', reasoning: true },
    { id: 'google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro', reasoning: true },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', reasoning: true },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', reasoning: false },
    { id: 'meta-llama/llama-3.3-70b', name: 'Llama 3.3 70B', reasoning: false },
  ],
};

const PROVIDER_INFO: Record<Provider, { label: string; icon: string }> = {
  openai: { label: 'OpenAI', icon: '🤖' },
  anthropic: { label: 'Anthropic', icon: '🧠' },
  openrouter: { label: 'OpenRouter', icon: '🌐' },
};

function ProviderConfigCard({
  selection,
  onChange,
  isAvailable,
}: {
  selection: ProviderSelection;
  onChange: (updated: ProviderSelection) => void;
  isAvailable: boolean;
}) {
  const info = PROVIDER_INFO[selection.provider];
  const models = PROVIDER_MODELS[selection.provider];
  const currentModel = models.find(m => m.id === selection.model);
  const showEffort = currentModel?.reasoning ?? false;

  return (
    <div className={cn(
      'rounded-xl border-2 p-4 transition-all',
      selection.enabled && isAvailable ? 'border-primary/40 bg-primary/5' : 'border-border opacity-60',
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{info.icon}</span>
          <span className="font-semibold">{info.label}</span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={selection.enabled}
            onChange={(e) => onChange({ ...selection, enabled: e.target.checked })}
            disabled={!isAvailable}
            className="rounded"
          />
          <span className="text-xs text-muted-foreground">{isAvailable ? 'Include' : 'No key'}</span>
        </label>
      </div>
      {selection.enabled && isAvailable && (
        <div className="mt-3 space-y-2">
          <select
            value={selection.model}
            onChange={(e) => onChange({ ...selection, model: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
          >
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.name} {m.reasoning ? '🧠' : ''}</option>
            ))}
          </select>
          {showEffort && (
            <div className="flex gap-1">
              {(['low', 'medium', 'high', 'xhigh'] as ReasoningEffort[]).map(e => (
                <button
                  key={e}
                  onClick={() => onChange({ ...selection, reasoningEffort: e })}
                  className={cn(
                    'flex-1 rounded px-2 py-1 text-xs font-medium transition-all',
                    selection.reasoningEffort === e
                      ? e === 'xhigh' ? 'bg-red-500 text-white' :
                        e === 'high' ? 'bg-orange-500 text-white' :
                        e === 'medium' ? 'bg-yellow-500 text-black' :
                        'bg-blue-500 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  {e === 'xhigh' ? 'XHigh' : e.charAt(0).toUpperCase() + e.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultCard({
  result,
  hourlyRate,
  isWinner,
}: {
  result: CompareResult;
  hourlyRate: number;
  isWinner: { fastest: boolean; cheapest: boolean; mostTasks: boolean };
}) {
  const [expanded, setExpanded] = useState(false);
  const info = result.provider ? PROVIDER_INFO[result.provider as Provider] : null;

  return (
    <div className={cn(
      'rounded-xl border-2 transition-all',
      (isWinner.fastest || isWinner.cheapest) ? 'border-primary/50 bg-primary/5' : 'border-border',
    )}>
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{info?.icon || '🤖'}</span>
            <div>
              <span className="font-semibold">{info?.label || result.provider}</span>
              <span className="ml-2 text-xs text-muted-foreground font-mono">{result.model}</span>
            </div>
          </div>
          <div className="flex gap-1 flex-wrap justify-end">
            {isWinner.fastest && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                ⚡ Fastest
              </span>
            )}
            {isWinner.cheapest && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                💰 Lowest Cost
              </span>
            )}
            {isWinner.mostTasks && (
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                📋 Most Detail
              </span>
            )}
            {result.thinkingUsed && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
                🧪 Thinking
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-px bg-border">
        <div className="bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Tasks</p>
          <p className="text-lg font-bold">{result.tasks.length}</p>
        </div>
        <div className="bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Hours</p>
          <p className="text-lg font-bold">{result.totalEstimatedHours}h</p>
        </div>
        <div className="bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Cost</p>
          <p className="text-lg font-bold text-primary">{(result.totalEstimatedHours * hourlyRate).toLocaleString('tr-TR')} TL</p>
        </div>
        <div className="bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Duration</p>
          <p className="text-lg font-bold">{result.durationMs ? `${(result.durationMs / 1000).toFixed(1)}s` : '-'}</p>
        </div>
      </div>

      <div className="p-4">
        <p className="text-sm text-muted-foreground">{result.projectSummary}</p>
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-sm font-medium text-primary hover:underline"
        >
          {expanded ? '▲ Hide tasks' : `▼ View ${result.tasks.length} tasks`}
        </button>

        {expanded && (
          <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="p-2 text-left font-medium">Task</th>
                  <th className="p-2 text-left font-medium w-16">Type</th>
                  <th className="p-2 text-left font-medium w-16">Priority</th>
                  <th className="p-2 text-right font-medium w-14">Hours</th>
                  <th className="p-2 text-right font-medium w-14">Points</th>
                </tr>
              </thead>
              <tbody>
                {result.tasks.map((t, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">
                      <span className="font-medium">{t.title}</span>
                    </td>
                    <td className="p-2">
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                        t.type === 'epic' ? 'bg-purple-100 text-purple-700' :
                        t.type === 'feature' ? 'bg-blue-100 text-blue-700' :
                        t.type === 'story' ? 'bg-green-100 text-green-700' :
                        t.type === 'bug' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      )}>{t.type}</span>
                    </td>
                    <td className="p-2">
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                        t.priority === 'critical' ? 'bg-red-100 text-red-700' :
                        t.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                        t.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      )}>{t.priority}</span>
                    </td>
                    <td className="p-2 text-right font-mono">{t.estimatedHours}h</td>
                    <td className="p-2 text-right font-mono">{t.estimatedPoints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result.assumptions.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-muted-foreground">Assumptions ({result.assumptions.length}):</p>
            <ul className="mt-1 text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              {result.assumptions.slice(0, 4).map((a, i) => <li key={i}>{a}</li>)}
              {result.assumptions.length > 4 && (
                <li className="text-primary">...and {result.assumptions.length - 4} more</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ComparePage(): React.ReactElement {
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('projectId') ?? '';

  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [inputText, setInputText] = useState('');
  const [projectContext, setProjectContext] = useState('');
  const [hourlyRate, setHourlyRate] = useState(150);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<CompareResult[]>([]);
  const [providerErrors, setProviderErrors] = useState<Array<{ provider: string; model: string; error: string }>>([]);
  const [hasResults, setHasResults] = useState(false);

  const apiKeysQuery = trpc.apiKeys.list.useQuery();
  const allProjectsQuery = trpc.project.list.useQuery({ organizationId: '' }, { retry: false });
  const configuredProviders = new Set(
    (apiKeysQuery.data ?? []).filter(k => k.isActive).map(k => k.provider)
  );
  const compareMutation = trpc.document.comparativeAnalyze.useMutation();
  const selectedProject = useMemo(
    () => (allProjectsQuery.data ?? []).find((project) => project.id === selectedProjectId) ?? null,
    [allProjectsQuery.data, selectedProjectId],
  );

  const [selections, setSelections] = useState<ProviderSelection[]>([
    { id: '1', provider: 'openai', model: 'gpt-5.2', reasoningEffort: 'medium', enabled: true },
    { id: '2', provider: 'anthropic', model: 'claude-sonnet-4-6', reasoningEffort: 'medium', enabled: true },
    { id: '3', provider: 'openrouter', model: 'openai/gpt-5.2', reasoningEffort: 'medium', enabled: false },
  ]);

  useEffect(() => {
    if (initialProjectId) {
      setSelectedProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  useEffect(() => {
    if (!selectedProject || projectContext.trim()) {
      return;
    }
    setProjectContext(`${selectedProject.name} (${selectedProject.key})`);
  }, [projectContext, selectedProject]);

  const updateSelection = (id: string, updated: ProviderSelection) => {
    setSelections(prev => prev.map(s => s.id === id ? updated : s));
  };

  const enabledSelections = selections.filter(s => s.enabled && configuredProviders.has(s.provider));

  async function handleCompare() {
    if (!inputText.trim() || enabledSelections.length === 0) return;
    setIsAnalyzing(true);
    setError('');
    setResults([]);
    setProviderErrors([]);
    setHasResults(false);

    try {
      const result = await compareMutation.mutateAsync({
        text: inputText,
        projectContext: projectContext || undefined,
        hourlyRate,
        providers: enabledSelections.map(s => ({
          provider: s.provider,
          model: s.model,
          reasoningEffort: s.reasoningEffort,
        })),
      });
      setResults(result.results);
      setProviderErrors(result.errors);
      setHasResults(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparative analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }

  const fastest = results.length > 1
    ? results.reduce((a, b) => (a.durationMs ?? Infinity) < (b.durationMs ?? Infinity) ? a : b)
    : null;
  const cheapest = results.length > 1
    ? results.reduce((a, b) => a.totalEstimatedHours < b.totalEstimatedHours ? a : b)
    : null;
  const mostTasks = results.length > 1
    ? results.reduce((a, b) => a.tasks.length > b.tasks.length ? a : b)
    : null;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-gradient-to-r from-primary/10 via-primary/5 to-background p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Compare AI Providers</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ayni kapsam metnini birden fazla provider/model ile calistir, efor ve maliyet farkini yan yana gor.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={selectedProjectId ? `/dashboard/effort?projectId=${selectedProjectId}` : '/dashboard/effort'}
              className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Go to effort workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Provider settings
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-md border bg-card/70 p-3">
            <p className="text-xs text-muted-foreground">Step 1</p>
            <p className="text-sm font-medium">Provider + model secimi</p>
          </div>
          <div className="rounded-md border bg-card/70 p-3">
            <p className="text-xs text-muted-foreground">Step 2</p>
            <p className="text-sm font-medium">Scope metnini ve proje baglamini gir</p>
          </div>
          <div className="rounded-md border bg-card/70 p-3">
            <p className="text-xs text-muted-foreground">Step 3</p>
            <p className="text-sm font-medium">Sonuclari sec ve cost kararina aktar</p>
          </div>
        </div>
      </section>

      {!hasResults && (
        <>
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-1">Step 1: Select Providers</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Enable providers and choose models.
              {configuredProviders.size === 0 && (
                <span className="text-red-500 ml-1">Configure API keys in Settings first.</span>
              )}
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {selections.map(sel => (
                <ProviderConfigCard
                  key={sel.id}
                  selection={sel}
                  onChange={(updated) => updateSelection(sel.id, updated)}
                  isAvailable={configuredProviders.has(sel.provider)}
                />
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Step 2: Requirements Document</h2>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Project (optional)</label>
                <select
                  value={selectedProjectId}
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                >
                  <option value="">No project selected</option>
                  {(allProjectsQuery.data ?? []).map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.key} - {project.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Rate:</label>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={e => setHourlyRate(Number(e.target.value))}
                  className="w-20 rounded-md border bg-background px-2 py-1 text-sm"
                />
                <span className="text-sm text-muted-foreground">TL/hr</span>
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={projectContext}
                  onChange={e => setProjectContext(e.target.value)}
                  placeholder="Project context (optional)"
                  className="w-full rounded-md border bg-background px-3 py-1 text-sm"
                />
              </div>
            </div>
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Paste your requirements document, PRD, or project description here..."
              className="w-full h-52 rounded-md border bg-background px-4 py-3 text-sm font-mono resize-y"
            />
            {selectedProject && (
              <p className="mt-2 text-xs text-muted-foreground">
                Selected project: {selectedProject.key} / {selectedProject.name}
              </p>
            )}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {enabledSelections.length} provider{enabledSelections.length !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={handleCompare}
                disabled={!inputText.trim() || enabledSelections.length === 0 || isAnalyzing}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Running...</>
                ) : (
                  <>Run Comparison ({enabledSelections.length})</>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-700 font-medium">Error</p>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {isAnalyzing && (
        <div className="rounded-lg border bg-card p-12 text-center">
          <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto" />
          <p className="mt-4 text-lg font-medium">Running comparative analysis...</p>
          <p className="text-sm text-muted-foreground">
            Sending to {enabledSelections.length} AI providers in parallel
          </p>
          <div className="mt-4 flex justify-center gap-3">
            {enabledSelections.map(s => (
              <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
                {PROVIDER_INFO[s.provider].icon} {PROVIDER_INFO[s.provider].label}
                <Loader2 className="h-3 w-3 animate-spin" />
              </span>
            ))}
          </div>
        </div>
      )}

      {hasResults && (
        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-medium">Step 3: Evaluate and move forward</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sonuctan secilen senaryoyu Effort Workspace&apos;te snapshot olarak kaydet ve GitHub/kanban akisina aktar.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href={selectedProjectId ? `/dashboard/effort?projectId=${selectedProjectId}` : '/dashboard/effort'}
                className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Open Effort Workspace
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/dashboard/projects"
                className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Back to Kanban
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {results.length > 1 && (
            <div className="rounded-lg border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 p-6">
              <h2 className="text-lg font-bold">Comparison Summary</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Hours Range</p>
                  <p className="text-xl font-bold">
                    {Math.min(...results.map(r => r.totalEstimatedHours))}h - {Math.max(...results.map(r => r.totalEstimatedHours))}h
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Cost Range</p>
                  <p className="text-xl font-bold text-primary">
                    {(Math.min(...results.map(r => r.totalEstimatedHours)) * hourlyRate).toLocaleString('tr-TR')} - {(Math.max(...results.map(r => r.totalEstimatedHours)) * hourlyRate).toLocaleString('tr-TR')} TL
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Task Count</p>
                  <p className="text-xl font-bold">
                    {Math.min(...results.map(r => r.tasks.length))} - {Math.max(...results.map(r => r.tasks.length))} tasks
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className={cn('grid gap-6', results.length > 1 ? 'lg:grid-cols-2' : '')}>
            {results.map((result, i) => (
              <ResultCard
                key={i}
                result={result}
                hourlyRate={hourlyRate}
                isWinner={{
                  fastest: results.length > 1 && fastest === result,
                  cheapest: results.length > 1 && cheapest === result,
                  mostTasks: results.length > 1 && mostTasks === result,
                }}
              />
            ))}
          </div>

          {providerErrors.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <p className="font-medium text-yellow-800">Some providers failed:</p>
              <ul className="mt-2 space-y-1">
                {providerErrors.map((e, i) => (
                  <li key={i} className="text-sm text-yellow-700">
                    <strong>{e.provider}</strong> ({e.model}): {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={() => { setHasResults(false); setResults([]); setProviderErrors([]); }}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              🔀 Run New Comparison
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
