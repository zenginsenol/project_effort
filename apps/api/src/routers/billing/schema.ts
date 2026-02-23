import { z } from 'zod';

export const createCheckoutSessionInput = z.object({
  plan: z.enum(['free', 'pro', 'enterprise']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export const updateSubscriptionInput = z.object({
  subscriptionId: z.string(),
  newPlan: z.enum(['free', 'pro', 'enterprise']),
});

export const cancelSubscriptionInput = z.object({
  subscriptionId: z.string(),
  cancelImmediately: z.boolean().default(false),
});

export const getUsageInput = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(), // YYYY-MM format
});

export const getPlanLimitsOutput = z.object({
  plan: z.enum(['free', 'pro', 'enterprise']),
  limits: z.object({
    projects: z.number(),
    teamMembers: z.number(),
    estimationSessions: z.number(),
    aiAnalysesPerMonth: z.number(),
    exportFormats: z.array(z.string()),
  }),
});
