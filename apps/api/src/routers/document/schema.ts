import { z } from 'zod';

export const analyzeTextInput = z.object({
  text: z.string().min(10).max(50000),
  projectId: z.string().uuid().optional(),
  projectContext: z.string().max(2000).optional(),
  hourlyRate: z.number().min(0).default(150),
  /** Override provider for this request (uses user's key for that provider) */
  provider: z.enum(['openai', 'anthropic', 'openrouter']).optional(),
  /** Override model for this request */
  model: z.string().max(100).optional(),
  /** Override reasoning effort for this request */
  reasoningEffort: z.enum(['low', 'medium', 'high', 'xhigh']).nullable().optional(),
});

export const comparativeAnalyzeInput = z.object({
  text: z.string().min(10).max(50000),
  projectContext: z.string().max(2000).optional(),
  hourlyRate: z.number().min(0).default(150),
  /** List of providers to compare - uses user's configured keys */
  providers: z.array(z.object({
    provider: z.enum(['openai', 'anthropic', 'openrouter']),
    model: z.string().max(100).optional(),
    reasoningEffort: z.enum(['low', 'medium', 'high', 'xhigh']).nullable().optional(),
  })).min(1).max(4),
});

export const bulkCreateTasksInput = z.object({
  projectId: z.string().uuid(),
  tasks: z.array(z.object({
    title: z.string().min(1).max(500),
    description: z.string().max(10000).optional(),
    type: z.enum(['epic', 'feature', 'story', 'task', 'subtask', 'bug']).default('task'),
    priority: z.enum(['critical', 'high', 'medium', 'low', 'none']).default('medium'),
    estimatedHours: z.number().min(0).optional(),
    estimatedPoints: z.number().min(0).optional(),
    status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled']).default('backlog'),
  })).min(1).max(200),
});
