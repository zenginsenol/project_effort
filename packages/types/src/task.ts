import { z } from 'zod';

export const taskTypeSchema = z.enum(['epic', 'feature', 'story', 'task', 'subtask', 'bug']);
export type TaskType = z.infer<typeof taskTypeSchema>;

export const taskStatusSchema = z.enum([
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'cancelled',
]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskPrioritySchema = z.enum(['critical', 'high', 'medium', 'low', 'none']);
export type TaskPriority = z.infer<typeof taskPrioritySchema>;

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  type: taskTypeSchema.default('task'),
  status: taskStatusSchema.default('backlog'),
  priority: taskPrioritySchema.default('medium'),
  parentId: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  assigneeId: z.string().uuid().optional(),
  estimatedPoints: z.number().min(0).optional(),
  estimatedHours: z.number().min(0).optional(),
  sprintId: z.string().uuid().optional(),
});

export const updateTaskSchema = createTaskSchema.partial().omit({ projectId: true });

export type CreateTask = z.infer<typeof createTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
