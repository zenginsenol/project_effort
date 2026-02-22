import { z } from 'zod';

import { paginationInputSchema } from '../../lib/pagination';

export const createProjectInput = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  key: z.string().min(2).max(10).regex(/^[A-Z]+$/),
  defaultEstimationMethod: z.enum(['planning_poker', 'tshirt_sizing', 'pert', 'wideband_delphi']).default('planning_poker'),
});

export const updateProjectInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['active', 'archived', 'completed']).optional(),
  defaultEstimationMethod: z.enum(['planning_poker', 'tshirt_sizing', 'pert', 'wideband_delphi']).optional(),
});

export const getProjectInput = z.object({
  id: z.string().uuid(),
});

export const listProjectsInput = z.object({
  organizationId: z.string().default(''),
}).merge(paginationInputSchema);
