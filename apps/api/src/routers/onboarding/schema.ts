import { z } from 'zod';

export const getOnboardingStateInput = z.object({
  userId: z.string().uuid(),
});

export const initializeOnboardingStateInput = z.object({
  userId: z.string().uuid(),
  organizationId: z.string().uuid().optional(),
});

export const updateOnboardingProgressInput = z.object({
  userId: z.string().uuid(),
  step: z.enum(['organization_created', 'project_setup', 'tasks_created', 'first_estimation']),
  organizationId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const skipOnboardingInput = z.object({
  userId: z.string().uuid(),
});

export const resetOnboardingInput = z.object({
  userId: z.string().uuid(),
});
