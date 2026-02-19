import { z } from 'zod';

export const effortCalculateInput = z.object({
  projectId: z.string().uuid(),
  hourlyRate: z.number().min(0).default(100),
  currency: z.string().default('TRY'),
  contingencyPercent: z.number().min(0).max(100).default(20),
  workHoursPerDay: z.number().min(1).max(24).default(8),
});

export const effortByTaskInput = z.object({
  projectId: z.string().uuid(),
});

export const effortRoadmapInput = z.object({
  projectId: z.string().uuid(),
  contingencyPercent: z.number().min(0).max(100).default(20),
  workHoursPerDay: z.number().min(1).max(24).default(8),
  includeCompleted: z.boolean().default(false),
});

export const effortApplyRoadmapInput = effortRoadmapInput.extend({
  autoMoveFirstWeekToTodo: z.boolean().default(true),
});

const taskTypeEnum = z.enum(['epic', 'feature', 'story', 'task', 'subtask', 'bug']);
const taskPriorityEnum = z.enum(['critical', 'high', 'medium', 'low', 'none']);
const taskStatusEnum = z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled']);
const providerEnum = z.enum(['openai', 'anthropic', 'openrouter']);
const reasoningEffortEnum = z.enum(['low', 'medium', 'high', 'xhigh']);
const additionalCostFrequencyEnum = z.enum(['one_time', 'monthly', 'annual']);

const effortCostParametersInput = z.object({
  hourlyRate: z.number().min(0).default(150),
  currency: z.string().min(1).max(10).default('TRY'),
  contingencyPercent: z.number().min(0).max(100).default(20),
  workHoursPerDay: z.number().min(1).max(24).default(8),
});

const effortAdditionalCostInput = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(200),
  amount: z.number().min(0),
  frequency: additionalCostFrequencyEnum.default('one_time'),
  note: z.string().max(1000).optional(),
});

const effortEditableSectionsInput = z.object({
  monthlyInfraOpsCost: z.number().min(0).default(15000),
  annualDomainCost: z.number().min(0).default(1200),
  monthlyMaintenanceHours: z.number().min(0).default(80),
  additionalCosts: z.array(effortAdditionalCostInput).max(100).default([]),
});

const effortTaskSnapshotInput = z.object({
  id: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  type: taskTypeEnum.default('task'),
  priority: taskPriorityEnum.default('medium'),
  status: taskStatusEnum.default('backlog'),
  estimatedHours: z.number().min(0).nullable().optional(),
  estimatedPoints: z.number().min(0).nullable().optional(),
  actualHours: z.number().min(0).nullable().optional(),
});

export const effortSaveCurrentAnalysisInput = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  assumptions: z.array(z.string().min(1).max(500)).max(200).default([]),
  parameters: effortCostParametersInput,
  editableSections: effortEditableSectionsInput,
});

export const effortCreateAiAnalysisInput = effortSaveCurrentAnalysisInput.extend({
  text: z.string().min(10).max(50000),
  projectContext: z.string().max(2000).optional(),
  provider: providerEnum,
  model: z.string().max(120).optional(),
  reasoningEffort: reasoningEffortEnum.nullable().optional(),
});

export const effortAnalysisByProjectInput = z.object({
  projectId: z.string().uuid(),
});

export const effortAnalysisByIdInput = z.object({
  analysisId: z.string().uuid(),
});

export const effortUpdateAnalysisInput = z.object({
  analysisId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  assumptions: z.array(z.string().min(1).max(500)).max(200).optional(),
  parameters: effortCostParametersInput.partial().optional(),
  editableSections: effortEditableSectionsInput.partial().optional(),
  tasks: z.array(effortTaskSnapshotInput).max(500).optional(),
});

export const effortCompareAnalysesInput = z.object({
  projectId: z.string().uuid(),
  analysisIds: z.array(z.string().uuid()).min(2).max(6),
});

export const effortExportAnalysisInput = z.object({
  analysisId: z.string().uuid(),
  format: z.enum(['json', 'csv', 'md']).default('json'),
});

export const effortSyncAnalysisToGithubInput = z.object({
  analysisId: z.string().uuid(),
  integrationId: z.string().uuid().optional(),
  repository: z.string().min(3).max(300).optional(),
});
