import { z } from 'zod';

export const connectIntegrationInput = z.object({
  organizationId: z.string().uuid(),
  type: z.enum(['jira', 'github']),
  redirectUri: z.string().url(),
});

export const callbackInput = z.object({
  organizationId: z.string().uuid(),
  type: z.enum(['jira', 'github']),
  code: z.string(),
  redirectUri: z.string().url(),
});

export const disconnectInput = z.object({
  integrationId: z.string().uuid(),
});

export const listIntegrationsInput = z.object({
  organizationId: z.string().uuid(),
});

export const importItemsInput = z.object({
  integrationId: z.string().uuid(),
  externalProjectId: z.string(),
  projectId: z.string().uuid(),
  syncToProject: z.boolean().default(false),
});

export const exportEstimateInput = z.object({
  integrationId: z.string().uuid(),
  externalItemId: z.string().min(1),
  points: z.number().min(0),
  hours: z.number().min(0),
});

export const syncItemsInput = z.object({
  integrationId: z.string().uuid(),
  externalProjectId: z.string().min(1),
  projectId: z.string().uuid(),
  limit: z.number().int().min(1).max(200).default(50),
});
