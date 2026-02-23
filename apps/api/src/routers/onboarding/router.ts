import { TRPCError } from '@trpc/server';

import { resolveDbUserId } from '../../lib/user-resolver';
import { orgProcedure, router } from '../../trpc/trpc';

import {
  loadSampleDataInput,
  updateOnboardingProgressInput,
} from './schema';
import { onboardingService } from './service';

export const onboardingRouter = router({
  getState: orgProcedure.query(async ({ ctx }) => {
    const dbUserId = await resolveDbUserId(ctx.userId);
    const state = await onboardingService.getByUserId(dbUserId);
    if (!state) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Onboarding state not found' });
    }
    return state;
  }),

  initialize: orgProcedure.mutation(async ({ ctx }) => {
    const dbUserId = await resolveDbUserId(ctx.userId);
    const state = await onboardingService.initialize({
      userId: dbUserId,
      organizationId: ctx.orgId,
    });
    if (!state) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to initialize onboarding state' });
    }
    return state;
  }),

  updateProgress: orgProcedure.input(updateOnboardingProgressInput).mutation(async ({ ctx, input }) => {
    const dbUserId = await resolveDbUserId(ctx.userId);
    const state = await onboardingService.updateProgress({
      userId: dbUserId,
      step: input.step,
      organizationId: ctx.orgId,
      metadata: input.metadata,
    });
    if (!state) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update onboarding progress' });
    }
    return state;
  }),

  skip: orgProcedure.mutation(async ({ ctx }) => {
    const dbUserId = await resolveDbUserId(ctx.userId);
    const state = await onboardingService.skip(dbUserId);
    if (!state) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to skip onboarding' });
    }
    return state;
  }),

  reset: orgProcedure.mutation(async ({ ctx }) => {
    const dbUserId = await resolveDbUserId(ctx.userId);
    const state = await onboardingService.reset(dbUserId);
    if (!state) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to reset onboarding' });
    }
    return state;
  }),

  loadSampleData: orgProcedure.input(loadSampleDataInput).mutation(async ({ ctx, input }) => {
    const dbUserId = await resolveDbUserId(ctx.userId);
    const result = await onboardingService.loadSampleData({
      userId: dbUserId,
      organizationId: input.organizationId,
    });
    if (!result) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to load sample data' });
    }
    return result;
  }),
});
