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

export const accuracyTrendsInput = z.object({
  projectId: z.string().uuid(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  timeWindow: z.enum(['4', '8', '12']).default('8'),
});

export const enhancedTeamBiasInput = z.object({
  projectId: z.string().uuid(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  groupBy: z.enum(['type', 'priority', 'method', 'user', 'all']).default('all'),
});

export const calibrationRecommendationsInput = z.object({
  projectId: z.string().uuid(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const similarTasksWithOutcomesInput = z.object({
  taskId: z.string().uuid(),
  limit: z.number().int().min(1).max(50).default(10),
});
