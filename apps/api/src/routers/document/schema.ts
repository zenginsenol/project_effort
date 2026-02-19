import { z } from 'zod';

export const analyzeTextInput = z.object({
  text: z.string().min(10).max(50000),
  projectId: z.string().uuid().optional(),
  projectContext: z.string().max(2000).optional(),
  hourlyRate: z.number().min(0).default(150),
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
