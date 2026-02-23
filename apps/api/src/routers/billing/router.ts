import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { orgProcedure, publicProcedure, router } from '../../trpc/trpc';

import {
  createCheckoutSessionInput,
  updateSubscriptionInput,
  cancelSubscriptionInput,
  getUsageInput,
  getPlanLimitsOutput,
} from './schema';
import { billingService } from './service';

export const billingRouter = router({
  getCurrentSubscription: orgProcedure.query(async ({ ctx }) => {
    const subscription = await billingService.getCurrentSubscription(ctx.orgId);
    return subscription;
  }),

  createCheckoutSession: orgProcedure
    .input(createCheckoutSessionInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const session = await billingService.createCheckoutSession(
          ctx.orgId,
          input.plan,
          input.successUrl,
          input.cancelUrl,
        );
        return session;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create checkout session',
        });
      }
    }),

  createPortalSession: orgProcedure
    .input(z.object({ returnUrl: z.string().url().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      try {
        const session = await billingService.createPortalSession(ctx.orgId, input?.returnUrl);
        return session;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create portal session',
        });
      }
    }),

  updateSubscription: orgProcedure
    .input(updateSubscriptionInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const subscription = await billingService.updateSubscription(ctx.orgId, input.newPlan);
        if (!subscription) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Subscription not found' });
        }
        return subscription;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update subscription',
        });
      }
    }),

  cancelSubscription: orgProcedure
    .input(cancelSubscriptionInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const subscription = await billingService.cancelSubscription(
          ctx.orgId,
          input.cancelImmediately,
        );
        if (!subscription) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Subscription not found' });
        }
        return subscription;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to cancel subscription',
        });
      }
    }),

  getUsage: orgProcedure.input(getUsageInput).query(async ({ ctx, input }) => {
    const usage = await billingService.getUsageStats(ctx.orgId, input.month);
    return usage;
  }),

  checkPlanLimit: orgProcedure
    .input(
      z.object({
        limitType: z.enum(['projects', 'teamMembers', 'estimationSessions', 'aiAnalyses']),
      }),
    )
    .query(async ({ ctx, input }) => {
      const limitCheck = await billingService.checkPlanLimit(ctx.orgId, input.limitType);
      return limitCheck;
    }),

  listInvoices: orgProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(10) }).optional())
    .query(async ({ ctx, input }) => {
      const invoices = await billingService.listInvoices(ctx.orgId, input?.limit ?? 10);
      return invoices;
    }),

  getPlanLimits: publicProcedure
    .input(z.object({ plan: z.enum(['free', 'pro', 'enterprise']) }))
    .output(getPlanLimitsOutput)
    .query(({ input }) => {
      return billingService.getPlanLimits(input.plan);
    }),

  getAllPlans: publicProcedure.query(() => {
    return billingService.getAllPlans();
  }),
});
