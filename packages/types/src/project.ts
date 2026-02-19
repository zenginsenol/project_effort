import { z } from 'zod';

export const projectStatusSchema = z.enum(['active', 'archived', 'completed']);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const estimationMethodSchema = z.enum([
  'planning_poker',
  'tshirt_sizing',
  'pert',
  'wideband_delphi',
]);
export type EstimationMethod = z.infer<typeof estimationMethodSchema>;

export const createProjectSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  key: z.string().min(2).max(10).regex(/^[A-Z]+$/),
  defaultEstimationMethod: estimationMethodSchema.default('planning_poker'),
});

export const updateProjectSchema = createProjectSchema.partial();

export type CreateProject = z.infer<typeof createProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
