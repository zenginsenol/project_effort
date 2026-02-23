import { z } from 'zod';

export const updateOnboardingProgressInput = z.object({
  step: z.enum(['organization_created', 'project_setup', 'tasks_created', 'first_estimation']),
  metadata: z.record(z.unknown()).optional(),
});

export const loadSampleDataInput = z.object({
  organizationId: z.string().uuid(),
});
