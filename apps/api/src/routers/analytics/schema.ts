import { z } from 'zod';

export const projectAnalyticsInput = z.object({
  projectId: z.string().uuid(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const velocityInput = z.object({
  projectId: z.string().uuid(),
  sprintCount: z.number().int().min(1).max(20).default(10),
});

export const burndownInput = z.object({
  projectId: z.string().uuid(),
  days: z.number().int().min(7).max(180).default(30),
});

export const exportInput = z.object({
  projectId: z.string().uuid(),
  format: z.enum(['csv', 'xlsx', 'pdf']),
});

export const methodComparisonInput = z.object({
  projectId: z.string().uuid(),
  taskIds: z.array(z.string().uuid()).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const methodStatsOutput = z.object({
  method: z.enum(['planning_poker', 'tshirt_sizing', 'pert', 'wideband_delphi']),
  mean: z.number(),
  median: z.number(),
  standardDeviation: z.number(),
  confidenceInterval: z.object({
    lower: z.number(),
    upper: z.number(),
  }),
  taskCount: z.number().int(),
});

export const taskMethodComparisonOutput = z.object({
  taskId: z.string().uuid(),
  taskName: z.string(),
  estimates: z.record(z.string(), z.number()),
});

export const methodComparisonOutput = z.object({
  methodStats: z.array(methodStatsOutput),
  agreementScore: z.number().min(0).max(100),
  taskComparisons: z.array(taskMethodComparisonOutput),
  recommendation: z.object({
    preferredMethod: z.enum(['planning_poker', 'tshirt_sizing', 'pert', 'wideband_delphi']).optional(),
    reason: z.string(),
    confidenceLevel: z.enum(['high', 'medium', 'low']),
  }),
});
