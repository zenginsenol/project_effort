import { z } from 'zod';

const githubRepositorySchema = z
  .string()
  .trim()
  .min(3)
  .regex(/^[^/\s]+\/[^/\s]+$/, 'Repository must be in owner/repo format');

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

export const linkGithubProjectInput = z.object({
  projectId: z.string().uuid(),
  integrationId: z.string().uuid().optional(),
  repository: githubRepositorySchema,
  autoSync: z.boolean().default(true),
});

export const getGithubProjectLinkInput = z.object({
  projectId: z.string().uuid(),
  integrationId: z.string().uuid().optional(),
});

export const syncGithubProjectInput = z.object({
  projectId: z.string().uuid(),
  integrationId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});
