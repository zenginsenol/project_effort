import { and, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { apiKeys, costAnalyses, integrations, projects, tasks, users } from '@estimate-pro/db/schema';

import type { AIProvider, AIProviderConfig, ReasoningEffort } from '../../services/document/task-extractor';
import { extractTasksFromText } from '../../services/document/task-extractor';
import { decrypt, encrypt } from '../../services/crypto';
import { isTokenExpired, refreshAccessToken } from '../../services/oauth/openai-oauth';
import { refreshClaudeAccessToken, CLAUDE_OAUTH_BETA_HEADER } from '../../services/oauth/claude-oauth';
import { decryptToken } from '../../services/security/token-crypto';
import { activityService } from '../activity/service';

type TaskType = typeof tasks.type.enumValues[number];
type TaskPriority = typeof tasks.priority.enumValues[number];
type TaskStatus = typeof tasks.status.enumValues[number];
const ANTHROPIC_OAUTH_BETA_HEADER = CLAUDE_OAUTH_BETA_HEADER;

type ProjectRow = {
  id: string;
  name: string;
  key: string;
};

type TaskSnapshot = {
  id: string | null;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  estimatedHours: number | null;
  estimatedPoints: number | null;
  actualHours: number | null;
};

type AdditionalCostFrequency = 'one_time' | 'monthly' | 'annual';

type AdditionalCostItem = {
  id?: string;
  label: string;
  amount: number;
  frequency: AdditionalCostFrequency;
  note?: string;
};

type CostAnalysisParameters = {
  hourlyRate: number;
  currency: string;
  contingencyPercent: number;
  workHoursPerDay: number;
};

type CostAnalysisEditableSections = {
  monthlyInfraOpsCost: number;
  annualDomainCost: number;
  monthlyMaintenanceHours: number;
  additionalCosts: AdditionalCostItem[];
};

type CostBreakdownByType = Record<string, { count: number; hours: number; points: number; cost: number }>;
type CostBreakdownByPriority = Record<string, { count: number; hours: number; cost: number }>;
type CostBreakdownByStatus = Record<string, { count: number; hours: number; cost: number }>;

type CostSummary = {
  totalTasks: number;
  estimatedTasks: number;
  unestimatedTasks: number;
  totalEstimatedHours: number;
  totalActualHours: number;
  totalEstimatedPoints: number;
  contingencyPercent: number;
  contingencyHours: number;
  totalWithContingency: number;
  totalDays: number;
  totalWeeks: number;
  hourlyRate: number;
  currency: string;
  baseCost: number;
  contingencyCost: number;
  totalCost: number;
  workHoursPerDay: number;
  annualInfraOpsCost: number;
  annualMaintenanceCost: number;
  annualDomainCost: number;
  additionalOpsAnnualCost: number;
  firstYearOpsCost: number;
  firstYearTotalCost: number;
};

type CostBreakdown = {
  byType: CostBreakdownByType;
  byPriority: CostBreakdownByPriority;
  byStatus: CostBreakdownByStatus;
};

type CalculatedTask = TaskSnapshot & {
  cost: number;
};

type CalculatedPayload = {
  project: ProjectRow;
  parameters: CostAnalysisParameters;
  editableSections: CostAnalysisEditableSections;
  assumptions: string[];
  summary: CostSummary;
  breakdown: CostBreakdown;
  tasks: CalculatedTask[];
  unestimatedTasks: Array<{
    id: string | null;
    title: string;
    type: TaskType;
    priority: TaskPriority;
  }>;
};

type AnalysisSourceType = 'project_tasks' | 'ai_text' | 'manual';

type AnalysisSourceMeta = {
  type: AnalysisSourceType;
  provider: string | null;
  model: string | null;
  reasoningEffort: string | null;
  input: string | null;
  context: string | null;
};

type SaveCurrentAnalysisInput = {
  name?: string;
  description?: string;
  assumptions: string[];
  parameters: CostAnalysisParameters;
  editableSections: CostAnalysisEditableSections;
};

type CreateAiAnalysisInput = SaveCurrentAnalysisInput & {
  text: string;
  projectContext?: string;
  provider: AIProvider;
  model?: string;
  reasoningEffort?: ReasoningEffort | null;
};

type UpdateAnalysisInput = {
  analysisId: string;
  name?: string;
  description?: string | null;
  assumptions?: string[];
  parameters?: Partial<CostAnalysisParameters>;
  editableSections?: Partial<CostAnalysisEditableSections>;
  tasks?: unknown[];
};

type AnalysisExportFormat = 'json' | 'csv' | 'md';

type GithubProjectLink = {
  externalProjectId: string;
  autoSync: boolean;
  updatedAt: string;
  integrationId?: string | null;
};

type IntegrationSettings = {
  projectLinks: Record<string, GithubProjectLink>;
};

const DEFAULT_PARAMETERS: CostAnalysisParameters = {
  hourlyRate: 150,
  currency: 'TRY',
  contingencyPercent: 20,
  workHoursPerDay: 8,
};

const DEFAULT_EDITABLE_SECTIONS: CostAnalysisEditableSections = {
  monthlyInfraOpsCost: 15_000,
  annualDomainCost: 1_200,
  monthlyMaintenanceHours: 80,
  additionalCosts: [],
};

const VALID_PROVIDERS: AIProvider[] = ['openai', 'anthropic', 'openrouter'];
const VALID_REASONING_EFFORT: Array<ReasoningEffort> = ['low', 'medium', 'high', 'xhigh'];
const VALID_TASK_TYPES = new Set<TaskType>(tasks.type.enumValues);
const VALID_TASK_PRIORITIES = new Set<TaskPriority>(tasks.priority.enumValues);
const VALID_TASK_STATUSES = new Set<TaskStatus>(tasks.status.enumValues);
const VALID_ADDITIONAL_COST_FREQUENCY = new Set<AdditionalCostFrequency>(['one_time', 'monthly', 'annual']);

function roundHours(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundCurrency(value: number): number {
  return Math.round(value);
}

function toFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

function toNonNegativeNumber(value: unknown, fallback: number): number {
  return Math.max(0, toFiniteNumber(value, fallback));
}

function toBoundedNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const numeric = toFiniteNumber(value, fallback);
  return Math.max(min, Math.min(max, numeric));
}

function toStringValue(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  return value;
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeAssumptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function csvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  return `"${String(value).replace(/"/g, '""')}"`;
}

function formatDateForFilename(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toIntegrationSettings(raw: unknown): IntegrationSettings {
  const result: IntegrationSettings = { projectLinks: {} };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return result;
  }

  const rawRecord = raw as Record<string, unknown>;
  const rawLinks = rawRecord.projectLinks;
  if (!rawLinks || typeof rawLinks !== 'object' || Array.isArray(rawLinks)) {
    return result;
  }

  for (const [projectId, value] of Object.entries(rawLinks as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    const candidate = value as Record<string, unknown>;
    const externalProjectId = typeof candidate.externalProjectId === 'string'
      ? candidate.externalProjectId.trim()
      : '';
    if (!externalProjectId) {
      continue;
    }
    result.projectLinks[projectId] = {
      externalProjectId,
      autoSync: candidate.autoSync !== false,
      updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
      integrationId: typeof candidate.integrationId === 'string' ? candidate.integrationId : null,
    };
  }

  return result;
}

function normalizeRepositoryInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  const normalizedGitSuffix = trimmed.endsWith('.git') ? trimmed.slice(0, -4) : trimmed;

  try {
    if (normalizedGitSuffix.startsWith('http://') || normalizedGitSuffix.startsWith('https://')) {
      const url = new URL(normalizedGitSuffix);
      if (!url.hostname.toLowerCase().includes('github.com')) {
        return normalizedGitSuffix;
      }
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
      }
      return normalizedGitSuffix;
    }
  } catch {
    // ignore parse errors and continue with plain parsing
  }

  return normalizedGitSuffix.replace(/^github\.com\//i, '');
}

function parseRepositoryContext(value: string): { owner: string; repo: string } {
  const normalized = normalizeRepositoryInput(value);
  const segments = normalized.split('/');
  if (segments.length !== 2 || !segments[0] || !segments[1]) {
    throw new Error('GitHub repository context must be owner/repo');
  }

  return { owner: segments[0], repo: segments[1] };
}

function summarizeSourceLabel(source: AnalysisSourceMeta): string {
  if (source.type === 'ai_text') {
    const providerLabel = source.provider ?? 'ai';
    const modelLabel = source.model ? `/${source.model}` : '';
    return `ai_text (${providerLabel}${modelLabel})`;
  }
  return source.type;
}

function safeSourceType(value: unknown): AnalysisSourceType {
  if (value === 'project_tasks' || value === 'ai_text' || value === 'manual') {
    return value;
  }
  return 'project_tasks';
}

type CostAnalysisRow = typeof costAnalyses.$inferSelect;

export class CostAnalysisService {
  private normalizeParameters(raw: unknown): CostAnalysisParameters {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw)
      ? raw as Record<string, unknown>
      : {};

    return {
      hourlyRate: toNonNegativeNumber(source.hourlyRate, DEFAULT_PARAMETERS.hourlyRate),
      currency: toStringValue(source.currency, DEFAULT_PARAMETERS.currency) || DEFAULT_PARAMETERS.currency,
      contingencyPercent: toBoundedNumber(
        source.contingencyPercent,
        DEFAULT_PARAMETERS.contingencyPercent,
        0,
        100,
      ),
      workHoursPerDay: toBoundedNumber(
        source.workHoursPerDay,
        DEFAULT_PARAMETERS.workHoursPerDay,
        1,
        24,
      ),
    };
  }

  private normalizeAdditionalCosts(raw: unknown): AdditionalCostItem[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    const result: AdditionalCostItem[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        continue;
      }
      const candidate = item as Record<string, unknown>;
      const label = toStringValue(candidate.label).trim();
      if (!label) {
        continue;
      }
      const frequencyCandidate = toStringValue(candidate.frequency, 'one_time');
      const frequency = VALID_ADDITIONAL_COST_FREQUENCY.has(frequencyCandidate as AdditionalCostFrequency)
        ? frequencyCandidate as AdditionalCostFrequency
        : 'one_time';
      const id = toNullableString(candidate.id) ?? undefined;
      const note = toStringValue(candidate.note).trim() || undefined;
      result.push({
        id,
        label,
        amount: toNonNegativeNumber(candidate.amount, 0),
        frequency,
        note,
      });
    }

    return result;
  }

  private normalizeEditableSections(raw: unknown): CostAnalysisEditableSections {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw)
      ? raw as Record<string, unknown>
      : {};

    return {
      monthlyInfraOpsCost: toNonNegativeNumber(
        source.monthlyInfraOpsCost,
        DEFAULT_EDITABLE_SECTIONS.monthlyInfraOpsCost,
      ),
      annualDomainCost: toNonNegativeNumber(
        source.annualDomainCost,
        DEFAULT_EDITABLE_SECTIONS.annualDomainCost,
      ),
      monthlyMaintenanceHours: toNonNegativeNumber(
        source.monthlyMaintenanceHours,
        DEFAULT_EDITABLE_SECTIONS.monthlyMaintenanceHours,
      ),
      additionalCosts: this.normalizeAdditionalCosts(source.additionalCosts),
    };
  }

  private normalizeTask(raw: unknown): TaskSnapshot | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }

    const source = raw as Record<string, unknown>;
    const title = toStringValue(source.title).trim();
    if (!title) {
      return null;
    }

    const typeCandidate = toStringValue(source.type, 'task');
    const priorityCandidate = toStringValue(source.priority, 'medium');
    const statusCandidate = toStringValue(source.status, 'backlog');

    const type: TaskType = VALID_TASK_TYPES.has(typeCandidate as TaskType)
      ? typeCandidate as TaskType
      : 'task';
    const priority: TaskPriority = VALID_TASK_PRIORITIES.has(priorityCandidate as TaskPriority)
      ? priorityCandidate as TaskPriority
      : 'medium';
    const status: TaskStatus = VALID_TASK_STATUSES.has(statusCandidate as TaskStatus)
      ? statusCandidate as TaskStatus
      : 'backlog';

    const estimatedHoursRaw = source.estimatedHours;
    const estimatedPointsRaw = source.estimatedPoints;
    const actualHoursRaw = source.actualHours;

    const estimatedHours = estimatedHoursRaw === null || estimatedHoursRaw === undefined
      ? null
      : toNonNegativeNumber(estimatedHoursRaw, 0);
    const estimatedPoints = estimatedPointsRaw === null || estimatedPointsRaw === undefined
      ? null
      : toNonNegativeNumber(estimatedPointsRaw, 0);
    const actualHours = actualHoursRaw === null || actualHoursRaw === undefined
      ? null
      : toNonNegativeNumber(actualHoursRaw, 0);

    const id = toNullableString(source.id);
    const description = toStringValue(source.description);

    return {
      id,
      title,
      description,
      type,
      priority,
      status,
      estimatedHours,
      estimatedPoints,
      actualHours,
    };
  }

  private normalizeTaskSnapshot(raw: unknown): TaskSnapshot[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .map((item) => this.normalizeTask(item))
      .filter((item): item is TaskSnapshot => item !== null);
  }

  private mergeParameters(
    base: CostAnalysisParameters,
    patch?: Partial<CostAnalysisParameters>,
  ): CostAnalysisParameters {
    if (!patch) {
      return base;
    }
    return this.normalizeParameters({
      ...base,
      ...patch,
    });
  }

  private mergeEditableSections(
    base: CostAnalysisEditableSections,
    patch?: Partial<CostAnalysisEditableSections>,
  ): CostAnalysisEditableSections {
    if (!patch) {
      return base;
    }
    const additionalCosts = patch.additionalCosts ?? base.additionalCosts;
    return this.normalizeEditableSections({
      ...base,
      ...patch,
      additionalCosts,
    });
  }

  private calculateAdditionalAnnualCost(additionalCosts: AdditionalCostItem[]): number {
    return additionalCosts.reduce((sum, item) => {
      if (item.frequency === 'monthly') {
        return sum + (item.amount * 12);
      }
      return sum + item.amount;
    }, 0);
  }

  private buildCalculatedPayload(
    project: ProjectRow,
    taskSnapshot: TaskSnapshot[],
    parameters: CostAnalysisParameters,
    editableSections: CostAnalysisEditableSections,
    assumptions: string[],
  ): CalculatedPayload {
    const normalizedTasks = taskSnapshot.map((item) => this.normalizeTask(item)).filter((item): item is TaskSnapshot => item !== null);

    const totalEstimatedHours = normalizedTasks.reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0);
    const totalActualHours = normalizedTasks.reduce((sum, task) => sum + (task.actualHours ?? 0), 0);
    const totalEstimatedPoints = normalizedTasks.reduce((sum, task) => sum + (task.estimatedPoints ?? 0), 0);

    const contingencyHours = totalEstimatedHours * (parameters.contingencyPercent / 100);
    const totalWithContingency = totalEstimatedHours + contingencyHours;

    const baseCost = totalEstimatedHours * parameters.hourlyRate;
    const contingencyCost = contingencyHours * parameters.hourlyRate;
    const totalCost = totalWithContingency * parameters.hourlyRate;

    const annualInfraOpsCost = editableSections.monthlyInfraOpsCost * 12;
    const annualMaintenanceCost = editableSections.monthlyMaintenanceHours * parameters.hourlyRate * 12;
    const additionalOpsAnnualCost = this.calculateAdditionalAnnualCost(editableSections.additionalCosts);
    const firstYearOpsCost = annualInfraOpsCost + annualMaintenanceCost + editableSections.annualDomainCost + additionalOpsAnnualCost;
    const firstYearTotalCost = totalCost + firstYearOpsCost;

    const totalDays = totalWithContingency > 0
      ? Math.ceil(totalWithContingency / parameters.workHoursPerDay)
      : 0;
    const totalWeeks = totalDays > 0 ? Math.ceil(totalDays / 5) : 0;

    const breakdownByType: CostBreakdownByType = {};
    const breakdownByPriority: CostBreakdownByPriority = {};
    const breakdownByStatus: CostBreakdownByStatus = {};

    const calculatedTasks: CalculatedTask[] = normalizedTasks.map((task) => {
      const taskCost = roundCurrency((task.estimatedHours ?? 0) * parameters.hourlyRate);

      const byType = breakdownByType[task.type] ?? { count: 0, hours: 0, points: 0, cost: 0 };
      breakdownByType[task.type] = byType;
      byType.count += 1;
      byType.hours += task.estimatedHours ?? 0;
      byType.points += task.estimatedPoints ?? 0;
      byType.cost += taskCost;

      const byPriority = breakdownByPriority[task.priority] ?? { count: 0, hours: 0, cost: 0 };
      breakdownByPriority[task.priority] = byPriority;
      byPriority.count += 1;
      byPriority.hours += task.estimatedHours ?? 0;
      byPriority.cost += taskCost;

      const byStatus = breakdownByStatus[task.status] ?? { count: 0, hours: 0, cost: 0 };
      breakdownByStatus[task.status] = byStatus;
      byStatus.count += 1;
      byStatus.hours += task.estimatedHours ?? 0;
      byStatus.cost += taskCost;

      return {
        ...task,
        cost: taskCost,
      };
    });

    const unestimatedTasks = normalizedTasks
      .filter((task) => task.estimatedHours === null)
      .map((task) => ({
        id: task.id,
        title: task.title,
        type: task.type,
        priority: task.priority,
      }));

    return {
      project,
      parameters,
      editableSections,
      assumptions,
      summary: {
        totalTasks: normalizedTasks.length,
        estimatedTasks: normalizedTasks.length - unestimatedTasks.length,
        unestimatedTasks: unestimatedTasks.length,
        totalEstimatedHours: roundHours(totalEstimatedHours),
        totalActualHours: roundHours(totalActualHours),
        totalEstimatedPoints: roundHours(totalEstimatedPoints),
        contingencyPercent: parameters.contingencyPercent,
        contingencyHours: roundHours(contingencyHours),
        totalWithContingency: roundHours(totalWithContingency),
        totalDays,
        totalWeeks,
        hourlyRate: parameters.hourlyRate,
        currency: parameters.currency,
        baseCost: roundCurrency(baseCost),
        contingencyCost: roundCurrency(contingencyCost),
        totalCost: roundCurrency(totalCost),
        workHoursPerDay: parameters.workHoursPerDay,
        annualInfraOpsCost: roundCurrency(annualInfraOpsCost),
        annualMaintenanceCost: roundCurrency(annualMaintenanceCost),
        annualDomainCost: roundCurrency(editableSections.annualDomainCost),
        additionalOpsAnnualCost: roundCurrency(additionalOpsAnnualCost),
        firstYearOpsCost: roundCurrency(firstYearOpsCost),
        firstYearTotalCost: roundCurrency(firstYearTotalCost),
      },
      breakdown: {
        byType: breakdownByType,
        byPriority: breakdownByPriority,
        byStatus: breakdownByStatus,
      },
      tasks: calculatedTasks,
      unestimatedTasks,
    };
  }

  private parseSource(row: CostAnalysisRow): AnalysisSourceMeta {
    return {
      type: safeSourceType(row.sourceType),
      provider: toNullableString(row.sourceProvider),
      model: toNullableString(row.sourceModel),
      reasoningEffort: toNullableString(row.sourceReasoningEffort),
      input: toNullableString(row.sourceInput),
      context: toNullableString(row.sourceContext),
    };
  }

  private parseGithub(row: CostAnalysisRow) {
    return {
      integrationId: row.githubIntegrationId,
      repository: row.githubRepository,
      issueNumber: row.githubIssueNumber,
      issueUrl: row.githubIssueUrl,
      syncedAt: row.githubSyncedAt?.toISOString() ?? null,
    };
  }

  private buildAnalysisOutput(
    row: CostAnalysisRow,
    project: ProjectRow,
  ) {
    const parameters = this.normalizeParameters(row.parameters);
    const editableSections = this.normalizeEditableSections(row.editableSections);
    const assumptions = normalizeAssumptions(row.assumptions);
    const taskSnapshot = this.normalizeTaskSnapshot(row.taskSnapshot);
    const calculated = this.buildCalculatedPayload(
      project,
      taskSnapshot,
      parameters,
      editableSections,
      assumptions,
    );

    return {
      id: row.id,
      organizationId: row.organizationId,
      projectId: row.projectId,
      createdByUserId: row.createdByUserId,
      name: row.name,
      description: row.description,
      source: this.parseSource(row),
      github: this.parseGithub(row),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      ...calculated,
    };
  }

  private buildListItem(
    row: CostAnalysisRow,
    project: ProjectRow,
  ) {
    const output = this.buildAnalysisOutput(row, project);
    return {
      id: output.id,
      name: output.name,
      description: output.description,
      source: output.source,
      github: output.github,
      summary: output.summary,
      parameters: output.parameters,
      editableSections: output.editableSections,
      createdAt: output.createdAt,
      updatedAt: output.updatedAt,
    };
  }

  private async resolveProject(projectId: string, orgId: string): Promise<ProjectRow> {
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.organizationId, orgId)),
      columns: {
        id: true,
        name: true,
        key: true,
      },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    return project;
  }

  private async getTaskSnapshotFromProject(projectId: string): Promise<TaskSnapshot[]> {
    const rows = await db.query.tasks.findMany({
      where: eq(tasks.projectId, projectId),
      columns: {
        id: true,
        title: true,
        description: true,
        type: true,
        priority: true,
        status: true,
        estimatedHours: true,
        estimatedPoints: true,
        actualHours: true,
      },
      orderBy: (task, { asc }) => [asc(task.sortOrder), asc(task.createdAt)],
    });

    return rows.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description ?? '',
      type: task.type,
      priority: task.priority,
      status: task.status,
      estimatedHours: task.estimatedHours,
      estimatedPoints: task.estimatedPoints,
      actualHours: task.actualHours,
    }));
  }

  private async resolveCreatedByUserId(clerkId: string): Promise<string | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
      columns: { id: true },
    });

    return user?.id ?? null;
  }

  private async resolveUserAIConfig(
    clerkId: string,
    provider: AIProvider,
    overrideModel?: string,
    overrideReasoningEffort?: ReasoningEffort | null,
  ): Promise<AIProviderConfig | null> {
    const user = await db.query.users.findFirst({
      columns: { id: true },
      where: eq(users.clerkId, clerkId),
    });

    if (!user) {
      return null;
    }

    const key = await db.query.apiKeys.findFirst({
      where: and(
        eq(apiKeys.userId, user.id),
        eq(apiKeys.provider, provider),
        eq(apiKeys.isActive, true),
      ),
      orderBy: (keyTable, { desc: descFn }) => [descFn(keyTable.updatedAt)],
    });

    if (!key) {
      return null;
    }

    try {
      if (key.authMethod === 'oauth' && key.encryptedAccessToken) {
        let accessToken = decrypt(key.encryptedAccessToken);
        const isAnthropicOAuth = provider === 'anthropic';

        if (key.tokenExpiresAt && isTokenExpired(key.tokenExpiresAt) && key.encryptedRefreshToken) {
          const refreshToken = decrypt(key.encryptedRefreshToken);
          const tokens = isAnthropicOAuth
            ? await refreshClaudeAccessToken(refreshToken)
            : await refreshAccessToken(refreshToken);

          const nextRefreshToken = 'refresh_token' in tokens && tokens.refresh_token
            ? tokens.refresh_token
            : refreshToken;

          await db
            .update(apiKeys)
            .set({
              encryptedAccessToken: encrypt(tokens.access_token),
              encryptedRefreshToken: encrypt(nextRefreshToken),
              tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
              updatedAt: new Date(),
            })
            .where(eq(apiKeys.id, key.id));

          accessToken = tokens.access_token;
        }

        const finalEffort = overrideReasoningEffort !== undefined
          ? overrideReasoningEffort
          : (VALID_REASONING_EFFORT.includes((key.reasoningEffort ?? '') as ReasoningEffort)
            ? key.reasoningEffort as ReasoningEffort
            : undefined);

        // For OpenAI OAuth (ChatGPT subscription), extract account ID from JWT
        let chatgptAccountId: string | null = null;
        if (!isAnthropicOAuth) {
          try {
            const parts = accessToken.split('.');
            if (parts.length === 3 && parts[1]) {
              const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
              chatgptAccountId = payload.chatgpt_account_id
                ?? payload.account_id
                ?? payload['https://api.openai.com/auth']?.account_id
                ?? null;
            }
          } catch {
            // Ignore JWT decode failures
          }
        }

        return {
          provider,
          apiKey: accessToken,
          model: overrideModel ?? key.model ?? undefined,
          reasoningEffort: finalEffort,
          authMethod: 'oauth',
          oauthBetaHeader: isAnthropicOAuth ? ANTHROPIC_OAUTH_BETA_HEADER : undefined,
          chatgptAccountId: !isAnthropicOAuth ? chatgptAccountId : undefined,
        };
      }

      if (key.encryptedKey) {
        const finalEffort = overrideReasoningEffort !== undefined
          ? overrideReasoningEffort
          : (VALID_REASONING_EFFORT.includes((key.reasoningEffort ?? '') as ReasoningEffort)
            ? key.reasoningEffort as ReasoningEffort
            : undefined);

        return {
          provider,
          apiKey: decrypt(key.encryptedKey),
          model: overrideModel ?? key.model ?? undefined,
          reasoningEffort: finalEffort,
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  private defaultAnalysisName(projectName: string, sourceType: AnalysisSourceType): string {
    const label = sourceType === 'ai_text'
      ? 'AI Cost Analysis'
      : sourceType === 'manual'
        ? 'Manual Cost Analysis'
        : 'Project Snapshot';

    return `${projectName} - ${label}`;
  }

  async listAnalyses(projectId: string, orgId: string) {
    const project = await this.resolveProject(projectId, orgId);
    const rows = await db
      .select()
      .from(costAnalyses)
      .where(and(eq(costAnalyses.organizationId, orgId), eq(costAnalyses.projectId, projectId)))
      .orderBy(desc(costAnalyses.createdAt));

    return rows.map((row) => this.buildListItem(row, project));
  }

  async getAnalysisById(analysisId: string, orgId: string) {
    const [row] = await db
      .select()
      .from(costAnalyses)
      .where(and(eq(costAnalyses.id, analysisId), eq(costAnalyses.organizationId, orgId)))
      .limit(1);
    if (!row) {
      throw new Error('Analysis not found');
    }

    const project = await this.resolveProject(row.projectId, orgId);
    return this.buildAnalysisOutput(row, project);
  }

  async saveCurrentProjectAnalysis(
    projectId: string,
    orgId: string,
    userClerkId: string,
    input: SaveCurrentAnalysisInput,
  ) {
    const project = await this.resolveProject(projectId, orgId);
    const taskSnapshot = await this.getTaskSnapshotFromProject(projectId);
    const parameters = this.normalizeParameters(input.parameters);
    const editableSections = this.normalizeEditableSections(input.editableSections);
    const assumptions = normalizeAssumptions(input.assumptions);
    const calculated = this.buildCalculatedPayload(project, taskSnapshot, parameters, editableSections, assumptions);

    const name = input.name?.trim() || this.defaultAnalysisName(project.name, 'project_tasks');
    const createdByUserId = await this.resolveCreatedByUserId(userClerkId);

    const [created] = await db
      .insert(costAnalyses)
      .values({
        organizationId: orgId,
        projectId,
        createdByUserId,
        name,
        description: input.description?.trim() || null,
        sourceType: 'project_tasks',
        sourceProvider: null,
        sourceModel: null,
        sourceReasoningEffort: null,
        sourceInput: null,
        sourceContext: null,
        parameters,
        editableSections,
        assumptions,
        taskSnapshot,
        summarySnapshot: calculated.summary,
        breakdownSnapshot: calculated.breakdown,
      })
      .returning();

    if (!created) {
      throw new Error('Failed to save analysis');
    }

    // Record activity
    await activityService.recordActivity({
      organizationId: orgId,
      activityType: 'cost_analysis_created',
      entityType: 'cost_analysis',
      entityId: created.id,
      actorId: createdByUserId ?? undefined,
      projectId,
      metadata: {
        analysisName: created.name,
        sourceType: created.sourceType,
        totalCost: calculated.summary.totalCost,
        totalHours: calculated.summary.totalWithContingency,
        currency: calculated.summary.currency,
      },
    });

    return this.buildAnalysisOutput(created, project);
  }

  async createAiCostAnalysis(
    projectId: string,
    orgId: string,
    userClerkId: string,
    input: CreateAiAnalysisInput,
  ) {
    if (!VALID_PROVIDERS.includes(input.provider)) {
      throw new Error('Unsupported AI provider');
    }

    const project = await this.resolveProject(projectId, orgId);
    const aiConfig = await this.resolveUserAIConfig(
      userClerkId,
      input.provider,
      input.model,
      input.reasoningEffort,
    );

    if (!aiConfig) {
      throw new Error(`No active API key found for ${input.provider}. Please configure it in Settings.`);
    }

    const extraction = await extractTasksFromText(
      input.text,
      input.projectContext,
      input.parameters.hourlyRate,
      aiConfig,
    );

    const taskSnapshot: TaskSnapshot[] = extraction.tasks.map((task) => ({
      id: null,
      title: task.title,
      description: task.description,
      type: task.type,
      priority: task.priority,
      status: 'backlog',
      estimatedHours: task.estimatedHours,
      estimatedPoints: task.estimatedPoints,
      actualHours: null,
    }));

    const parameters = this.normalizeParameters(input.parameters);
    const editableSections = this.normalizeEditableSections(input.editableSections);
    const assumptions = normalizeAssumptions([
      ...(extraction.assumptions ?? []),
      ...input.assumptions,
    ]);
    const calculated = this.buildCalculatedPayload(project, taskSnapshot, parameters, editableSections, assumptions);

    const createdByUserId = await this.resolveCreatedByUserId(userClerkId);
    const name = input.name?.trim() || this.defaultAnalysisName(project.name, 'ai_text');
    const [created] = await db
      .insert(costAnalyses)
      .values({
        organizationId: orgId,
        projectId,
        createdByUserId,
        name,
        description: input.description?.trim() || null,
        sourceType: 'ai_text',
        sourceProvider: extraction.provider ?? input.provider,
        sourceModel: extraction.model ?? input.model ?? null,
        sourceReasoningEffort: input.reasoningEffort ?? null,
        sourceInput: input.text,
        sourceContext: input.projectContext ?? null,
        parameters,
        editableSections,
        assumptions,
        taskSnapshot,
        summarySnapshot: calculated.summary,
        breakdownSnapshot: calculated.breakdown,
      })
      .returning();

    if (!created) {
      throw new Error('Failed to save AI analysis');
    }

    // Record activity
    await activityService.recordActivity({
      organizationId: orgId,
      activityType: 'cost_analysis_created',
      entityType: 'cost_analysis',
      entityId: created.id,
      actorId: createdByUserId ?? undefined,
      projectId,
      metadata: {
        analysisName: created.name,
        sourceType: created.sourceType,
        sourceProvider: created.sourceProvider,
        sourceModel: created.sourceModel,
        totalCost: calculated.summary.totalCost,
        totalHours: calculated.summary.totalWithContingency,
        currency: calculated.summary.currency,
      },
    });

    return this.buildAnalysisOutput(created, project);
  }

  async updateAnalysis(orgId: string, input: UpdateAnalysisInput) {
    const [row] = await db
      .select()
      .from(costAnalyses)
      .where(and(eq(costAnalyses.id, input.analysisId), eq(costAnalyses.organizationId, orgId)))
      .limit(1);
    if (!row) {
      throw new Error('Analysis not found');
    }

    const project = await this.resolveProject(row.projectId, orgId);
    const existingParameters = this.normalizeParameters(row.parameters);
    const existingEditableSections = this.normalizeEditableSections(row.editableSections);
    const existingAssumptions = normalizeAssumptions(row.assumptions);
    const existingTasks = this.normalizeTaskSnapshot(row.taskSnapshot);

    const nextParameters = this.mergeParameters(existingParameters, input.parameters);
    const nextEditableSections = this.mergeEditableSections(existingEditableSections, input.editableSections);
    const nextAssumptions = input.assumptions ? normalizeAssumptions(input.assumptions) : existingAssumptions;
    const nextTasks = input.tasks ? this.normalizeTaskSnapshot(input.tasks) : existingTasks;

    const calculated = this.buildCalculatedPayload(
      project,
      nextTasks,
      nextParameters,
      nextEditableSections,
      nextAssumptions,
    );

    const [updated] = await db
      .update(costAnalyses)
      .set({
        name: input.name?.trim() || row.name,
        description: input.description === undefined ? row.description : (input.description?.trim() || null),
        parameters: nextParameters,
        editableSections: nextEditableSections,
        assumptions: nextAssumptions,
        taskSnapshot: nextTasks,
        summarySnapshot: calculated.summary,
        breakdownSnapshot: calculated.breakdown,
        updatedAt: new Date(),
      })
      .where(eq(costAnalyses.id, row.id))
      .returning();

    if (!updated) {
      throw new Error('Failed to update analysis');
    }

    return this.buildAnalysisOutput(updated, project);
  }

  async deleteAnalysis(analysisId: string, orgId: string) {
    const [deleted] = await db
      .delete(costAnalyses)
      .where(and(eq(costAnalyses.id, analysisId), eq(costAnalyses.organizationId, orgId)))
      .returning({ id: costAnalyses.id });

    if (!deleted) {
      throw new Error('Analysis not found');
    }

    return { id: deleted.id };
  }

  async compareAnalyses(projectId: string, analysisIds: string[], orgId: string) {
    const uniqueIds = Array.from(new Set(analysisIds));
    if (uniqueIds.length < 2) {
      throw new Error('At least two analyses are required for comparison');
    }

    const project = await this.resolveProject(projectId, orgId);
    const rows = await db
      .select()
      .from(costAnalyses)
      .where(and(
        eq(costAnalyses.organizationId, orgId),
        eq(costAnalyses.projectId, projectId),
        inArray(costAnalyses.id, uniqueIds),
      ));

    if (rows.length !== uniqueIds.length) {
      throw new Error('One or more analyses were not found');
    }

    const outputById = new Map(rows.map((row) => [row.id, this.buildAnalysisOutput(row, project)]));
    const ordered = uniqueIds
      .map((id) => outputById.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const baseline = ordered[0];
    if (!baseline) {
      throw new Error('Unable to build comparison baseline');
    }

    const comparison = ordered.map((analysis) => ({
      analysisId: analysis.id,
      name: analysis.name,
      sourceLabel: summarizeSourceLabel(analysis.source),
      totalTasks: analysis.summary.totalTasks,
      totalHours: analysis.summary.totalWithContingency,
      totalCost: analysis.summary.totalCost,
      firstYearTotalCost: analysis.summary.firstYearTotalCost,
      totalWeeks: analysis.summary.totalWeeks,
      delta: {
        hours: roundHours(analysis.summary.totalWithContingency - baseline.summary.totalWithContingency),
        totalCost: roundCurrency(analysis.summary.totalCost - baseline.summary.totalCost),
        firstYearTotalCost: roundCurrency(analysis.summary.firstYearTotalCost - baseline.summary.firstYearTotalCost),
        totalWeeks: analysis.summary.totalWeeks - baseline.summary.totalWeeks,
      },
      createdAt: analysis.createdAt,
    }));

    const cheapest = comparison.reduce((current, candidate) => (
      candidate.totalCost < current.totalCost ? candidate : current
    ));
    const fastest = comparison.reduce((current, candidate) => (
      candidate.totalWeeks < current.totalWeeks ? candidate : current
    ));
    const lowestFirstYear = comparison.reduce((current, candidate) => (
      candidate.firstYearTotalCost < current.firstYearTotalCost ? candidate : current
    ));

    return {
      project,
      baselineAnalysisId: baseline.id,
      baselineName: baseline.name,
      analyses: comparison,
      winners: {
        cheapestAnalysisId: cheapest.analysisId,
        fastestAnalysisId: fastest.analysisId,
        lowestFirstYearAnalysisId: lowestFirstYear.analysisId,
      },
    };
  }

  private buildMarkdownExport(analysis: Awaited<ReturnType<CostAnalysisService['getAnalysisById']>>): string {
    const lines: string[] = [];
    lines.push(`# ${analysis.name}`);
    lines.push('');
    lines.push(`- Project: ${analysis.project.name} (${analysis.project.key})`);
    lines.push(`- Source: ${summarizeSourceLabel(analysis.source)}`);
    lines.push(`- Generated: ${analysis.createdAt}`);
    lines.push('');
    lines.push('## Cost Summary');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('| --- | --- |');
    lines.push(`| Total Tasks | ${analysis.summary.totalTasks} |`);
    lines.push(`| Total Hours (with contingency) | ${analysis.summary.totalWithContingency} |`);
    lines.push(`| Delivery Duration (weeks) | ${analysis.summary.totalWeeks} |`);
    lines.push(`| Development Cost | ${analysis.summary.totalCost} ${analysis.summary.currency} |`);
    lines.push(`| Year-1 Ops Cost | ${analysis.summary.firstYearOpsCost} ${analysis.summary.currency} |`);
    lines.push(`| Year-1 Total Cost | ${analysis.summary.firstYearTotalCost} ${analysis.summary.currency} |`);
    lines.push('');
    lines.push('## Assumptions');
    lines.push('');
    if (analysis.assumptions.length === 0) {
      lines.push('- None');
    } else {
      for (const assumption of analysis.assumptions) {
        lines.push(`- ${assumption}`);
      }
    }
    lines.push('');
    lines.push('## Task Snapshot');
    lines.push('');
    lines.push('| Task | Type | Priority | Status | Hours | Cost |');
    lines.push('| --- | --- | --- | --- | ---: | ---: |');
    for (const task of analysis.tasks) {
      lines.push(`| ${task.title.replace(/\|/g, '\\|')} | ${task.type} | ${task.priority} | ${task.status} | ${task.estimatedHours ?? '-'} | ${task.cost} |`);
    }
    return lines.join('\n');
  }

  private buildCsvExport(analysis: Awaited<ReturnType<CostAnalysisService['getAnalysisById']>>): string {
    const summaryRows = [
      ['metric', 'value'],
      ['analysis_name', analysis.name],
      ['project_name', analysis.project.name],
      ['project_key', analysis.project.key],
      ['source', summarizeSourceLabel(analysis.source)],
      ['generated_at', analysis.createdAt],
      ['total_tasks', analysis.summary.totalTasks],
      ['total_hours_with_contingency', analysis.summary.totalWithContingency],
      ['total_weeks', analysis.summary.totalWeeks],
      ['development_cost', analysis.summary.totalCost],
      ['first_year_ops_cost', analysis.summary.firstYearOpsCost],
      ['first_year_total_cost', analysis.summary.firstYearTotalCost],
      ['currency', analysis.summary.currency],
    ];

    const taskHeader = ['task_title', 'type', 'priority', 'status', 'estimated_hours', 'estimated_points', 'cost'];
    const taskRows = analysis.tasks.map((task) => [
      task.title,
      task.type,
      task.priority,
      task.status,
      task.estimatedHours ?? '',
      task.estimatedPoints ?? '',
      task.cost,
    ]);

    const summaryCsv = summaryRows.map((row) => row.map((col) => csvValue(col)).join(',')).join('\n');
    const tasksCsv = [taskHeader, ...taskRows].map((row) => row.map((col) => csvValue(col)).join(',')).join('\n');

    return `${summaryCsv}\n\n${tasksCsv}`;
  }

  async exportAnalysis(analysisId: string, orgId: string, format: AnalysisExportFormat, actorClerkId?: string) {
    const analysis = await this.getAnalysisById(analysisId, orgId);
    const safeProjectKey = analysis.project.key.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    const safeAnalysisName = slugify(analysis.name) || 'analysis';
    const dateStamp = formatDateForFilename(new Date());

    let result;
    if (format === 'json') {
      result = {
        filename: `${safeProjectKey}-${safeAnalysisName}-${dateStamp}.json`,
        format,
        mimeType: 'application/json',
        content: JSON.stringify(analysis, null, 2),
      };
    } else if (format === 'md') {
      result = {
        filename: `${safeProjectKey}-${safeAnalysisName}-${dateStamp}.md`,
        format,
        mimeType: 'text/markdown',
        content: this.buildMarkdownExport(analysis),
      };
    } else {
      result = {
        filename: `${safeProjectKey}-${safeAnalysisName}-${dateStamp}.csv`,
        format: 'csv' as const,
        mimeType: 'text/csv;charset=utf-8',
        content: this.buildCsvExport(analysis),
      };
    }

    // Record activity
    const actorId = actorClerkId ? await this.resolveCreatedByUserId(actorClerkId) : null;
    await activityService.recordActivity({
      organizationId: orgId,
      activityType: 'cost_analysis_exported',
      entityType: 'cost_analysis',
      entityId: analysisId,
      actorId: actorId ?? undefined,
      projectId: analysis.projectId,
      metadata: {
        analysisName: analysis.name,
        exportFormat: format,
        fileName: result.filename,
      },
    });

    return result;
  }

  private async listActiveGithubIntegrations(orgId: string) {
    return db.query.integrations.findMany({
      where: and(
        eq(integrations.organizationId, orgId),
        eq(integrations.type, 'github'),
        eq(integrations.isActive, true),
      ),
      orderBy: (table, { desc: descFn }) => [descFn(table.updatedAt)],
    });
  }

  private resolveProjectLinkFromIntegration(
    integration: typeof integrations.$inferSelect,
    projectId: string,
  ): GithubProjectLink | null {
    const settings = toIntegrationSettings(integration.settings);
    const explicitLink = settings.projectLinks[projectId];
    if (explicitLink?.externalProjectId) {
      return {
        ...explicitLink,
        integrationId: integration.id,
      };
    }
    const fallbackExternalProjectId = integration.externalProjectId?.trim() || null;
    if (!fallbackExternalProjectId) {
      return null;
    }
    return {
      externalProjectId: fallbackExternalProjectId,
      autoSync: false,
      updatedAt: integration.updatedAt.toISOString(),
      integrationId: integration.id,
    };
  }

  private async resolveGithubProjectLink(
    orgId: string,
    projectId: string,
  ): Promise<{ integrationId: string; repository: string } | null> {
    const connections = await this.listActiveGithubIntegrations(orgId);
    if (connections.length === 0) {
      return null;
    }

    for (const connection of connections) {
      const settings = toIntegrationSettings(connection.settings);
      const explicitLink = settings.projectLinks[projectId];
      if (!explicitLink?.externalProjectId) {
        continue;
      }
      return {
        integrationId: connection.id,
        repository: explicitLink.externalProjectId,
      };
    }

    const fallback = connections[0];
    const fallbackRepository = fallback?.externalProjectId?.trim();
    if (fallback && fallbackRepository) {
      return {
        integrationId: fallback.id,
        repository: fallbackRepository,
      };
    }

    return null;
  }

  private async resolveGithubIntegration(
    orgId: string,
    integrationId?: string,
  ) {
    if (integrationId) {
      const row = await db.query.integrations.findFirst({
        where: and(
          eq(integrations.id, integrationId),
          eq(integrations.organizationId, orgId),
          eq(integrations.type, 'github'),
          eq(integrations.isActive, true),
        ),
      });
      if (!row) {
        throw new Error('GitHub integration not found or inactive');
      }
      return row;
    }

    const connections = await this.listActiveGithubIntegrations(orgId);
    const row = connections[0];
    if (!row) {
      throw new Error('GitHub integration is not connected');
    }
    return row;
  }

  private buildGithubIssueBody(analysis: Awaited<ReturnType<CostAnalysisService['getAnalysisById']>>): string {
    const lines: string[] = [];
    lines.push('## EstimatePro Cost Analysis');
    lines.push('');
    lines.push(`- Project: **${analysis.project.name}** (\`${analysis.project.key}\`)`);
    lines.push(`- Analysis: **${analysis.name}**`);
    lines.push(`- Source: **${summarizeSourceLabel(analysis.source)}**`);
    lines.push(`- Updated At: ${analysis.updatedAt}`);
    lines.push('');
    lines.push('### Financial Summary');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('| --- | ---: |');
    lines.push(`| Total Tasks | ${analysis.summary.totalTasks} |`);
    lines.push(`| Total Hours (with contingency) | ${analysis.summary.totalWithContingency}h |`);
    lines.push(`| Development Cost | ${analysis.summary.totalCost} ${analysis.summary.currency} |`);
    lines.push(`| Year-1 Ops Cost | ${analysis.summary.firstYearOpsCost} ${analysis.summary.currency} |`);
    lines.push(`| Year-1 Total Cost | ${analysis.summary.firstYearTotalCost} ${analysis.summary.currency} |`);
    lines.push('');
    lines.push('### Operational Cost Inputs');
    lines.push('');
    lines.push(`- Infra/Ops Monthly: ${analysis.editableSections.monthlyInfraOpsCost} ${analysis.summary.currency}`);
    lines.push(`- Domain/SSL Annual: ${analysis.editableSections.annualDomainCost} ${analysis.summary.currency}`);
    lines.push(`- Maintenance Hours/Month: ${analysis.editableSections.monthlyMaintenanceHours}h`);
    if (analysis.editableSections.additionalCosts.length > 0) {
      lines.push('- Additional Cost Items:');
      for (const item of analysis.editableSections.additionalCosts) {
        lines.push(`  - ${item.label}: ${item.amount} ${analysis.summary.currency} (${item.frequency})`);
      }
    }
    lines.push('');
    lines.push('### Assumptions');
    lines.push('');
    if (analysis.assumptions.length === 0) {
      lines.push('- None');
    } else {
      for (const assumption of analysis.assumptions) {
        lines.push(`- ${assumption}`);
      }
    }
    lines.push('');
    lines.push('### Top Tasks');
    lines.push('');
    lines.push('| Task | Hours | Cost |');
    lines.push('| --- | ---: | ---: |');
    for (const task of analysis.tasks.slice(0, 20)) {
      lines.push(`| ${task.title.replace(/\|/g, '\\|')} | ${task.estimatedHours ?? '-'} | ${task.cost} |`);
    }
    if (analysis.tasks.length > 20) {
      lines.push('');
      lines.push(`_...and ${analysis.tasks.length - 20} more tasks in EstimatePro analysis snapshot._`);
    }

    return lines.join('\n');
  }

  private async upsertGithubIssue(params: {
    accessToken: string;
    repository: string;
    title: string;
    body: string;
    issueNumber?: number | null;
  }): Promise<{ issueNumber: number; issueUrl: string }> {
    const { owner, repo } = parseRepositoryContext(params.repository);
    const headers = {
      Authorization: `Bearer ${params.accessToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'EstimatePro',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (params.issueNumber && Number.isInteger(params.issueNumber)) {
      const updateResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues/${params.issueNumber}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            title: params.title,
            body: params.body,
            state: 'open',
          }),
        },
      );

      if (updateResponse.ok) {
        const payload = await updateResponse.json() as { number?: number; html_url?: string };
        if (payload.number && payload.html_url) {
          return {
            issueNumber: payload.number,
            issueUrl: payload.html_url,
          };
        }
      } else if (updateResponse.status !== 404) {
        const errorText = await updateResponse.text();
        throw new Error(`GitHub issue update failed (${updateResponse.status}): ${errorText}`);
      }
    }

    const createResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: params.title,
          body: params.body,
          labels: ['estimatepro', 'cost-analysis'],
        }),
      },
    );

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`GitHub issue create failed (${createResponse.status}): ${errorText}`);
    }

    const payload = await createResponse.json() as { number?: number; html_url?: string };
    if (!payload.number || !payload.html_url) {
      throw new Error('GitHub issue response did not include number/url');
    }

    return {
      issueNumber: payload.number,
      issueUrl: payload.html_url,
    };
  }

  async syncAnalysisToGithub(
    analysisId: string,
    orgId: string,
    integrationId?: string,
    repositoryOverride?: string,
  ) {
    const [row] = await db
      .select()
      .from(costAnalyses)
      .where(and(eq(costAnalyses.id, analysisId), eq(costAnalyses.organizationId, orgId)))
      .limit(1);
    if (!row) {
      throw new Error('Analysis not found');
    }

    const linkedProjectContext = await this.resolveGithubProjectLink(orgId, row.projectId);
    const resolvedIntegrationId = integrationId
      || linkedProjectContext?.integrationId
      || row.githubIntegrationId
      || undefined;
    const integration = await this.resolveGithubIntegration(orgId, resolvedIntegrationId);
    const accessToken = decryptToken(integration.accessToken);
    if (!accessToken) {
      throw new Error('GitHub integration token is missing');
    }

    const linkedRepository = linkedProjectContext?.integrationId === integration.id
      ? linkedProjectContext.repository
      : null;
    const analysisRepository = row.githubIntegrationId === integration.id ? row.githubRepository : null;
    const repository = normalizeRepositoryInput(
      repositoryOverride?.trim()
      || linkedRepository
      || analysisRepository
      || row.githubRepository
      || integration.externalProjectId
      || '',
    );

    if (!repository) {
      throw new Error('GitHub repository is not linked. Provide repository override or link project in Integrations.');
    }

    const analysis = await this.getAnalysisById(analysisId, orgId);
    const issueTitle = `[EstimatePro] ${analysis.project.key} Cost Analysis - ${analysis.name}`;
    const issueBody = this.buildGithubIssueBody(analysis);

    const issue = await this.upsertGithubIssue({
      accessToken,
      repository,
      title: issueTitle,
      body: issueBody,
      issueNumber: row.githubIssueNumber,
    });

    const syncedAt = new Date();
    await db
      .update(costAnalyses)
      .set({
        githubIntegrationId: integration.id,
        githubRepository: repository,
        githubIssueNumber: issue.issueNumber,
        githubIssueUrl: issue.issueUrl,
        githubSyncedAt: syncedAt,
        updatedAt: syncedAt,
      })
      .where(eq(costAnalyses.id, row.id));

    return {
      analysisId: row.id,
      integrationId: integration.id,
      repository,
      issueNumber: issue.issueNumber,
      issueUrl: issue.issueUrl,
      syncedAt: syncedAt.toISOString(),
    };
  }
}

export const costAnalysisService = new CostAnalysisService();
