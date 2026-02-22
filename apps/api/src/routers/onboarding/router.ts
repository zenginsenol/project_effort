import { TRPCError } from '@trpc/server';

import { authedProcedure, router } from '../../trpc/trpc';

import {
  getOnboardingStateInput,
  initializeOnboardingStateInput,
  resetOnboardingInput,
  skipOnboardingInput,
  updateOnboardingProgressInput,
} from './schema';
import { onboardingService } from './service';

export const onboardingRouter = router({
  getState: authedProcedure.input(getOnboardingStateInput).query(async ({ ctx, input }) => {
    if (input.userId !== ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'User ID mismatch' });
    }
    const state = await onboardingService.getByUserId(input.userId);
    if (!state) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Onboarding state not found' });
    }
    return state;
  }),

  initialize: authedProcedure.input(initializeOnboardingStateInput).mutation(async ({ ctx, input }) => {
    if (input.userId !== ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'User ID mismatch' });
    }
    const state = await onboardingService.initialize(input);
    if (!state) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to initialize onboarding state' });
    }
    return state;
  }),

  updateProgress: authedProcedure.input(updateOnboardingProgressInput).mutation(async ({ ctx, input }) => {
    if (input.userId !== ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'User ID mismatch' });
    }
    const state = await onboardingService.updateProgress(input);
    if (!state) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update onboarding progress' });
    }
    return state;
  }),

  skip: authedProcedure.input(skipOnboardingInput).mutation(async ({ ctx, input }) => {
    if (input.userId !== ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'User ID mismatch' });
    }
    const state = await onboardingService.skip(input.userId);
    if (!state) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to skip onboarding' });
    }
    return state;
  }),

  reset: authedProcedure.input(resetOnboardingInput).mutation(async ({ ctx, input }) => {
    if (input.userId !== ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'User ID mismatch' });
    }
    const state = await onboardingService.reset(input.userId);
    if (!state) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to reset onboarding' });
    }
    return state;
  }),
});
