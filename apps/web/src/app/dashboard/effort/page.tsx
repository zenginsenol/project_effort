'use client';

import { Calculator, Clock, DollarSign, AlertTriangle, ChevronDown, ChevronUp, TrendingUp, Users, FileText } from 'lucide-react';
import { useState } from 'react';

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

export default function EffortPage(): React.ReactElement {
  const [hourlyRate, setHourlyRate] = useState(150);
  const [currency, setCurrency] = useState('TRY');
  const [contingency, setContingency] = useState(20);
  const [workHoursPerDay, setWorkHoursPerDay] = useState(8);
  const [showTasks, setShowTasks] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('summary');

  // Get projects list
  const projectsQuery = trpc.project.list.useQuery({
    organizationId: '',  // will fetch all
  }, { retry: false, enabled: false });

  // Use direct effort query with hardcoded project for now
  // We'll get project ID from the list
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

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

  // Also fetch project list to allow selection
  const allProjectsQuery = trpc.project.list.useQuery({
    organizationId: '',
  }, { retry: false });

  const data = effortQuery.data;

  const formatCurrency = (amount: number) => {
    if (currency === 'TRY') return `${amount.toLocaleString('tr-TR')} TL`;
    if (currency === 'USD') return `$${amount.toLocaleString('en-US')}`;
    if (currency === 'EUR') return `${amount.toLocaleString('de-DE')} EUR`;
    return `${amount.toLocaleString()} ${currency}`;
  };

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
              onClick={() => effortQuery.refetch()}
              disabled={!selectedProjectId}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Calculate
            </button>
          </div>
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
    </div>
  );
}
