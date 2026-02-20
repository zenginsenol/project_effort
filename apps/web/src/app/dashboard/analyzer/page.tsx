'use client';

import {
  Brain, Upload, FileText, Plus, Trash2, Check,
  AlertCircle, DollarSign, Loader2, Sparkles, Table, ClipboardPaste
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

const TYPE_OPTIONS = ['epic', 'feature', 'story', 'task', 'subtask', 'bug'] as const;
const PRIORITY_OPTIONS = ['critical', 'high', 'medium', 'low'] as const;

const TYPE_COLORS: Record<string, string> = {
  epic: 'bg-purple-100 text-purple-700',
  feature: 'bg-blue-100 text-blue-700',
  story: 'bg-green-100 text-green-700',
  task: 'bg-gray-100 text-gray-700',
  subtask: 'bg-gray-50 text-gray-600',
  bug: 'bg-red-100 text-red-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

interface TaskItem {
  id: string;
  title: string;
  description: string;
  type: typeof TYPE_OPTIONS[number];
  priority: typeof PRIORITY_OPTIONS[number];
  estimatedHours: number;
  estimatedPoints: number;
  selected: boolean;
}

type TabType = 'ai-text' | 'file-upload' | 'manual';

export default function AnalyzerPage(): React.ReactElement {
  const searchParams = useSearchParams();
  const projectIdFromQuery = searchParams.get('projectId') ?? '';
  const [activeTab, setActiveTab] = useState<TabType>('ai-text');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [projectSummary, setProjectSummary] = useState('');
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(150);
  const [savedSuccess, setSavedSuccess] = useState('');

  // AI Text Analysis
  const [inputText, setInputText] = useState('');
  const [projectContext, setProjectContext] = useState('');

  // File Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');

  // Manual Entry
  const [manualTasks, setManualTasks] = useState<TaskItem[]>([
    createEmptyTask(),
  ]);

  // Project selection for saving
  const [selectedProjectId, setSelectedProjectId] = useState(projectIdFromQuery);
  const allProjectsQuery = trpc.project.list.useQuery({ organizationId: '' }, { retry: false });

  const analyzeTextMutation = trpc.document.analyzeText.useMutation();
  const bulkCreateMutation = trpc.document.bulkCreateTasks.useMutation();

  useEffect(() => {
    if (projectIdFromQuery && projectIdFromQuery !== selectedProjectId) {
      setSelectedProjectId(projectIdFromQuery);
    }
  }, [projectIdFromQuery, selectedProjectId]);

  function createEmptyTask(): TaskItem {
    return {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      type: 'task',
      priority: 'medium',
      estimatedHours: 4,
      estimatedPoints: 3,
      selected: true,
    };
  }

  // === AI TEXT ANALYSIS ===
  async function handleAnalyzeText() {
    if (!inputText.trim()) return;
    setIsAnalyzing(true);
    setError('');
    setShowReview(false);

    try {
      const result = await analyzeTextMutation.mutateAsync({
        text: inputText,
        projectContext: projectContext || undefined,
        hourlyRate,
      });

      const extractedTasks: TaskItem[] = result.tasks.map((t) => ({
        id: crypto.randomUUID(),
        title: t.title,
        description: t.description,
        type: t.type as TaskItem['type'],
        priority: t.priority as TaskItem['priority'],
        estimatedHours: t.estimatedHours,
        estimatedPoints: t.estimatedPoints,
        selected: true,
      }));

      setTasks(extractedTasks);
      setProjectSummary(result.projectSummary);
      setAssumptions(result.assumptions);
      setShowReview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Check your OpenAI API key.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  // === FILE UPLOAD ===
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsAnalyzing(true);
    setError('');
    setShowReview(false);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const url = new URL('http://localhost:4000/api/analyze-document');
      url.searchParams.set('hourlyRate', String(hourlyRate));
      if (projectContext) url.searchParams.set('projectContext', projectContext);

      const response = await fetch(url.toString(), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || 'Upload failed');
      }

      const result = await response.json() as {
        projectSummary: string;
        tasks: Array<{ title: string; description: string; type: string; priority: string; estimatedHours: number; estimatedPoints: number }>;
        assumptions: string[];
      };

      const extractedTasks: TaskItem[] = result.tasks.map((t) => ({
        id: crypto.randomUUID(),
        title: t.title,
        description: t.description,
        type: t.type as TaskItem['type'],
        priority: t.priority as TaskItem['priority'],
        estimatedHours: t.estimatedHours,
        estimatedPoints: t.estimatedPoints,
        selected: true,
      }));

      setTasks(extractedTasks);
      setProjectSummary(result.projectSummary);
      setAssumptions(result.assumptions);
      setShowReview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File upload failed');
    } finally {
      setIsAnalyzing(false);
    }
  }

  // === MANUAL ENTRY ===
  function handleManualSubmit() {
    const validTasks = manualTasks.filter(t => t.title.trim());
    if (validTasks.length === 0) return;

    setTasks(validTasks.map(t => ({ ...t, selected: true })));
    setProjectSummary('Manually entered tasks');
    setAssumptions([]);
    setShowReview(true);
  }

  function addManualRow() {
    setManualTasks([...manualTasks, createEmptyTask()]);
  }

  function removeManualRow(id: string) {
    if (manualTasks.length <= 1) return;
    setManualTasks(manualTasks.filter(t => t.id !== id));
  }

  function updateManualTask(id: string, field: keyof TaskItem, value: string | number) {
    setManualTasks(manualTasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  }

  // === SAVE TO PROJECT ===
  async function handleSaveToProject() {
    if (!selectedProjectId) return;
    const selectedTasks = tasks.filter(t => t.selected);
    if (selectedTasks.length === 0) return;

    try {
      const result = await bulkCreateMutation.mutateAsync({
        projectId: selectedProjectId,
        tasks: selectedTasks.map(t => ({
          title: t.title,
          description: t.description || undefined,
          type: t.type,
          priority: t.priority,
          estimatedHours: t.estimatedHours,
          estimatedPoints: t.estimatedPoints,
          status: 'backlog' as const,
        })),
      });

      setSavedSuccess(`${result.created} tasks saved to project!`);
      setTimeout(() => setSavedSuccess(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tasks');
    }
  }

  // Task editing in review
  function toggleTask(id: string) {
    setTasks(tasks.map(t => t.id === id ? { ...t, selected: !t.selected } : t));
  }

  function updateTask(id: string, field: keyof TaskItem, value: string | number) {
    setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  }

  function selectAll() {
    setTasks(tasks.map(t => ({ ...t, selected: true })));
  }

  function deselectAll() {
    setTasks(tasks.map(t => ({ ...t, selected: false })));
  }

  const selectedTasks = tasks.filter(t => t.selected);
  const totalHours = selectedTasks.reduce((s, t) => s + t.estimatedHours, 0);
  const totalPoints = selectedTasks.reduce((s, t) => s + t.estimatedPoints, 0);
  const totalCost = totalHours * hourlyRate;

  const formatCurrency = (amount: number) => `${amount.toLocaleString('tr-TR')} TL`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          Task Analyzer
        </h1>
        <p className="mt-1 text-muted-foreground">
          Analyze requirements, upload documents, or manually enter tasks - then calculate effort & cost.
        </p>
      </div>

      {/* Config Bar */}
      <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <label className="text-sm font-medium">Hourly Rate:</label>
          <input
            type="number"
            value={hourlyRate}
            onChange={e => setHourlyRate(Number(e.target.value))}
            className="w-20 rounded-md border bg-background px-2 py-1 text-sm"
          />
          <span className="text-sm text-muted-foreground">TL</span>
        </div>
        <div className="flex-1">
          <input
            type="text"
            value={projectContext}
            onChange={e => setProjectContext(e.target.value)}
            placeholder="Project context (e.g., 'E-commerce platform with React + Node.js')"
            className="w-full rounded-md border bg-background px-3 py-1 text-sm"
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex rounded-lg border bg-card">
        {[
          { key: 'ai-text' as TabType, label: 'AI Text Analysis', icon: Sparkles, desc: 'Paste requirements' },
          { key: 'file-upload' as TabType, label: 'File Upload', icon: Upload, desc: 'PDF, DOCX, MD, TXT' },
          { key: 'manual' as TabType, label: 'Manual Entry', icon: Table, desc: 'Bulk task entry' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setShowReview(false); setError(''); }}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 p-4 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.key
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            <tab.icon className="h-4 w-4" />
            <div className="text-left">
              <div>{tab.label}</div>
              <div className="text-xs text-muted-foreground">{tab.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-700 font-medium">Error</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Success */}
      {savedSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-center gap-3">
          <Check className="h-5 w-5 text-green-600" />
          <p className="text-green-700 font-medium">{savedSuccess}</p>
        </div>
      )}

      {/* Tab Content */}
      {!showReview && (
        <>
          {/* AI Text Analysis Tab */}
          {activeTab === 'ai-text' && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-6">
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <ClipboardPaste className="h-5 w-5" />
                  Paste Your Requirements Document
                </h2>
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder={`Paste your PRD, requirements doc, or project description here...\n\nExample:\n# E-Commerce Platform\n\n## User Stories\n- As a user, I want to register and login with email/password\n- As a user, I want to browse products by category\n- As a user, I want to add items to cart and checkout\n- As an admin, I want to manage products and orders\n\n## Technical Requirements\n- React frontend with Next.js\n- Node.js backend with PostgreSQL\n- Stripe payment integration\n- Real-time order tracking with WebSocket`}
                  className="w-full h-72 rounded-md border bg-background px-4 py-3 text-sm font-mono resize-y"
                />
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {inputText.length.toLocaleString()} / 50,000 characters
                  </span>
                  <button
                    onClick={handleAnalyzeText}
                    disabled={!inputText.trim() || isAnalyzing}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing with AI...</>
                    ) : (
                      <><Sparkles className="h-4 w-4" /> Analyze & Extract Tasks</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* File Upload Tab */}
          {activeTab === 'file-upload' && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <Upload className="h-5 w-5" />
                Upload Document
              </h2>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    <p className="mt-4 text-lg font-medium">Analyzing {fileName}...</p>
                    <p className="text-sm text-muted-foreground">GPT-4o is extracting tasks</p>
                  </>
                ) : (
                  <>
                    <FileText className="h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-lg font-medium">{fileName || 'Click to upload a document'}</p>
                    <p className="text-sm text-muted-foreground">PDF, DOCX, Markdown, or Text file (max 10MB)</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.md,.txt,.markdown"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}

          {/* Manual Entry Tab */}
          {activeTab === 'manual' && (
            <div className="rounded-lg border bg-card">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Table className="h-5 w-5" />
                  Bulk Task Entry
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left text-muted-foreground">
                      <th className="p-3 font-medium w-1/3">Title</th>
                      <th className="p-3 font-medium">Type</th>
                      <th className="p-3 font-medium">Priority</th>
                      <th className="p-3 font-medium w-20">Hours</th>
                      <th className="p-3 font-medium w-20">Points</th>
                      <th className="p-3 font-medium w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualTasks.map(task => (
                      <tr key={task.id} className="border-t">
                        <td className="p-2">
                          <input
                            value={task.title}
                            onChange={e => updateManualTask(task.id, 'title', e.target.value)}
                            placeholder="Task title..."
                            className="w-full rounded border bg-background px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={task.type}
                            onChange={e => updateManualTask(task.id, 'type', e.target.value)}
                            className="rounded border bg-background px-2 py-1 text-sm"
                          >
                            {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="p-2">
                          <select
                            value={task.priority}
                            onChange={e => updateManualTask(task.id, 'priority', e.target.value)}
                            className="rounded border bg-background px-2 py-1 text-sm"
                          >
                            {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={task.estimatedHours}
                            onChange={e => updateManualTask(task.id, 'estimatedHours', Number(e.target.value))}
                            className="w-full rounded border bg-background px-2 py-1 text-sm"
                            min={0}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={task.estimatedPoints}
                            onChange={e => updateManualTask(task.id, 'estimatedPoints', Number(e.target.value))}
                            className="w-full rounded border bg-background px-2 py-1 text-sm"
                            min={0}
                          />
                        </td>
                        <td className="p-2">
                          <button
                            onClick={() => removeManualRow(task.id)}
                            className="p-1 text-muted-foreground hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t flex items-center justify-between">
                <button
                  onClick={addManualRow}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Plus className="h-4 w-4" /> Add Row
                </button>
                <button
                  onClick={handleManualSubmit}
                  disabled={!manualTasks.some(t => t.title.trim())}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" /> Review Tasks
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* === REVIEW & APPROVE SECTION === */}
      {showReview && tasks.length > 0 && (
        <div className="space-y-4">
          {/* Summary */}
          {projectSummary && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">AI Analysis Summary</h3>
              <p className="mt-1 text-sm text-muted-foreground">{projectSummary}</p>
              {assumptions.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground">Assumptions:</p>
                  <ul className="mt-1 text-xs text-muted-foreground list-disc pl-4">
                    {assumptions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Selected Tasks</p>
              <p className="text-2xl font-bold">{selectedTasks.length} / {tasks.length}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Man-Hours</p>
              <p className="text-2xl font-bold">{totalHours}h</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Story Points</p>
              <p className="text-2xl font-bold">{totalPoints}pts</p>
            </div>
            <div className="rounded-lg border bg-gradient-to-br from-primary/10 to-primary/5 p-4">
              <p className="text-sm text-muted-foreground">Estimated Cost</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(totalCost)}</p>
            </div>
          </div>

          {/* Task Review Table */}
          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Review & Edit Tasks</h2>
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className="text-xs text-primary hover:underline">Select All</button>
                <span className="text-muted-foreground">|</span>
                <button onClick={deselectAll} className="text-xs text-muted-foreground hover:underline">Deselect All</button>
                <button
                  onClick={() => { setShowReview(false); setTasks([]); }}
                  className="ml-4 text-xs text-red-500 hover:underline"
                >
                  Start Over
                </button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-left text-muted-foreground bg-muted/50">
                    <th className="p-3 w-8"></th>
                    <th className="p-3 font-medium">Title</th>
                    <th className="p-3 font-medium">Type</th>
                    <th className="p-3 font-medium">Priority</th>
                    <th className="p-3 font-medium w-20">Hours</th>
                    <th className="p-3 font-medium w-20">Points</th>
                    <th className="p-3 font-medium w-24">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(task => (
                    <tr key={task.id} className={cn('border-t', !task.selected && 'opacity-40')}>
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={task.selected}
                          onChange={() => toggleTask(task.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          value={task.title}
                          onChange={e => updateTask(task.id, 'title', e.target.value)}
                          className="w-full bg-transparent border-b border-transparent hover:border-muted-foreground focus:border-primary focus:outline-none px-0 py-0.5 text-sm"
                        />
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">{task.description}</p>
                        )}
                      </td>
                      <td className="p-3">
                        <select
                          value={task.type}
                          onChange={e => updateTask(task.id, 'type', e.target.value)}
                          className={cn('rounded-full px-2 py-0.5 text-xs font-medium border-0', TYPE_COLORS[task.type])}
                        >
                          {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="p-3">
                        <select
                          value={task.priority}
                          onChange={e => updateTask(task.id, 'priority', e.target.value)}
                          className={cn('rounded-full px-2 py-0.5 text-xs font-medium border-0', PRIORITY_COLORS[task.priority])}
                        >
                          {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          value={task.estimatedHours}
                          onChange={e => updateTask(task.id, 'estimatedHours', Number(e.target.value))}
                          className="w-16 rounded border bg-background px-2 py-0.5 text-sm text-right"
                          min={0}
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          value={task.estimatedPoints}
                          onChange={e => updateTask(task.id, 'estimatedPoints', Number(e.target.value))}
                          className="w-16 rounded border bg-background px-2 py-0.5 text-sm text-right"
                          min={0}
                        />
                      </td>
                      <td className="p-3 text-right font-medium text-xs">
                        {formatCurrency(task.estimatedHours * hourlyRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/50 font-bold">
                    <td className="p-3"></td>
                    <td className="p-3">TOTAL ({selectedTasks.length} selected)</td>
                    <td className="p-3"></td>
                    <td className="p-3"></td>
                    <td className="p-3 text-right">{totalHours}h</td>
                    <td className="p-3 text-right">{totalPoints}</td>
                    <td className="p-3 text-right">{formatCurrency(totalCost)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Save to Project */}
          <div className="rounded-lg border-2 border-primary bg-gradient-to-r from-primary/5 to-primary/10 p-6">
            <h2 className="text-xl font-bold mb-4">Save to Project</h2>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Select Project</label>
                <select
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Choose a project...</option>
                  {(allProjectsQuery.data ?? []).map((p: { id: string; name: string }) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground mb-1">
                  {selectedTasks.length} tasks | {totalHours}h | {formatCurrency(totalCost)}
                </p>
                <button
                  onClick={handleSaveToProject}
                  disabled={!selectedProjectId || selectedTasks.length === 0 || bulkCreateMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {bulkCreateMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                  ) : (
                    <><Check className="h-4 w-4" /> Save {selectedTasks.length} Tasks to Project</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isAnalyzing && activeTab === 'ai-text' && (
        <div className="rounded-lg border bg-card p-12 text-center">
          <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto" />
          <p className="mt-4 text-lg font-medium">AI is analyzing your document...</p>
          <p className="text-sm text-muted-foreground">GPT-4o is extracting tasks, estimating effort, and creating a breakdown</p>
        </div>
      )}
    </div>
  );
}
