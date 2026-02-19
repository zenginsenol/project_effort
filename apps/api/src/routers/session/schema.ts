import { z } from 'zod';

export const createSessionInput = z.object({
  projectId: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  method: z.enum(['planning_poker', 'tshirt_sizing', 'pert', 'wideband_delphi']),
  moderatorId: z.string().uuid(),
});

export const getSessionInput = z.object({
  id: z.string().uuid(),
});

export const listSessionsInput = z.object({
  projectId: z.string().uuid(),
});

export const joinSessionInput = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const submitVoteInput = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  round: z.number().int().min(1),
  value: z.string().min(1),
});

export const revealVotesInput = z.object({
  sessionId: z.string().uuid(),
});

export const completeSessionInput = z.object({
  sessionId: z.string().uuid(),
  finalEstimate: z.number().min(0),
});

export const newRoundInput = z.object({
  sessionId: z.string().uuid(),
});
