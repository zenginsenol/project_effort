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
