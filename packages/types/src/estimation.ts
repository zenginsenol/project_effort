import { z } from 'zod';

export const fibonacciValues = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89] as const;
export const tshirtSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;

export const tshirtSizeSchema = z.enum(tshirtSizes);
export type TShirtSize = z.infer<typeof tshirtSizeSchema>;

export const pertInputSchema = z.object({
  optimistic: z.number().min(0),
  mostLikely: z.number().min(0),
  pessimistic: z.number().min(0),
});

export const pertResultSchema = z.object({
  expected: z.number(),
  standardDeviation: z.number(),
  variance: z.number(),
  confidenceRange: z.object({
    low: z.number(),
    high: z.number(),
  }),
});

export const sessionStatusSchema = z.enum([
  'waiting',
  'voting',
  'revealed',
  'completed',
]);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

export const createSessionSchema = z.object({
  projectId: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  method: z.enum(['planning_poker', 'tshirt_sizing', 'pert', 'wideband_delphi']),
  name: z.string().min(1).max(200),
});

export type PertInput = z.infer<typeof pertInputSchema>;
export type PertResult = z.infer<typeof pertResultSchema>;
export type CreateSession = z.infer<typeof createSessionSchema>;
