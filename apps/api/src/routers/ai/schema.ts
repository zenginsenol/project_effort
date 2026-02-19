import { z } from 'zod';

export const getSuggestionInput = z.object({
  taskId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export const findSimilarInput = z.object({
  text: z.string().min(1).max(5000),
  projectId: z.string().uuid(),
  limit: z.number().int().min(1).max(20).default(5),
});

export const generateEmbeddingInput = z.object({
  taskId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
});
