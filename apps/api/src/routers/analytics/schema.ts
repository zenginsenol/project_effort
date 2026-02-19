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
