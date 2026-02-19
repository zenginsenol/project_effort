import { z } from 'zod';

export const createSprintInput = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(200),
  goal: z.string().max(1000).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const updateSprintInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  goal: z.string().max(1000).optional(),
  status: z.enum(['planning', 'active', 'completed', 'cancelled']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const getSprintInput = z.object({
  id: z.string().uuid(),
});

export const listSprintsInput = z.object({
  projectId: z.string().uuid(),
});
