import { z } from 'zod';

export const paginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export const idSchema = z.object({
  id: z.string().uuid(),
});

export const timestampsSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Pagination = z.infer<typeof paginationSchema>;
export type Id = z.infer<typeof idSchema>;
export type Timestamps = z.infer<typeof timestampsSchema>;

export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');
export type SortOrder = z.infer<typeof sortOrderSchema>;
