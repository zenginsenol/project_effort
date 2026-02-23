import { z } from 'zod';

import { paginationInputSchema } from '../../lib/pagination';

export const createTaskInput = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  type: z.enum(['epic', 'feature', 'story', 'task', 'subtask', 'bug']).default('task'),
  status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled']).default('backlog'),
  priority: z.enum(['critical', 'high', 'medium', 'low', 'none']).default('medium'),
  parentId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  estimatedPoints: z.number().min(0).optional(),
  estimatedHours: z.number().min(0).optional(),
});

export const updateTaskInput = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  type: z.enum(['epic', 'feature', 'story', 'task', 'subtask', 'bug']).optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled']).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low', 'none']).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  estimatedPoints: z.number().min(0).nullable().optional(),
  estimatedHours: z.number().min(0).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const getTaskInput = z.object({
  id: z.string().uuid(),
});

export const listTasksInput = z.object({
  projectId: z.string().uuid(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled']).optional(),
  type: z.enum(['epic', 'feature', 'story', 'task', 'subtask', 'bug']).optional(),
  parentId: z.string().uuid().nullable().optional(),
}).merge(paginationInputSchema);
