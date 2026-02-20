import { z } from 'zod';

export const addApiKeyInput = z.object({
  provider: z.enum(['openai', 'anthropic', 'openrouter']),
  apiKey: z.string().min(10, 'API key is too short').max(500),
  label: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
});

export const updateApiKeyInput = z.object({
  id: z.string().uuid(),
  label: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  reasoningEffort: z.enum(['low', 'medium', 'high', 'xhigh']).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const deleteApiKeyInput = z.object({
  id: z.string().uuid(),
});

export const getApiKeyForProviderInput = z.object({
  provider: z.enum(['openai', 'anthropic', 'openrouter']),
});
