import { TRPCError } from '@trpc/server';

import { orgProcedure, router } from '../../trpc/trpc';

import {
  completeSessionInput,
  createSessionInput,
  getSessionInput,
  joinSessionInput,
  listSessionsInput,
  newRoundInput,
  revealVotesInput,
  submitVoteInput,
} from './schema';
import { sessionService } from './service';

export const sessionRouter = router({
  create: orgProcedure
    .input(createSessionInput)
    .mutation(async ({ ctx, input }) => {
      const session = await sessionService.create(ctx.orgId, input, ctx.userId ?? undefined);
      if (!session) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Project access denied' });
      }
      return session;
    }),

  getById: orgProcedure
    .input(getSessionInput)
    .query(async ({ ctx, input }) => {
      const session = await sessionService.getById(input.id, ctx.orgId);
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
      }
      return session;
    }),

  list: orgProcedure
    .input(listSessionsInput)
    .query(async ({ ctx, input }) => {
      return sessionService.listByProject(input.projectId, ctx.orgId);
    }),

  join: orgProcedure
    .input(joinSessionInput)
    .mutation(async ({ ctx, input }) => {
      const participant = await sessionService.joinSession(input.sessionId, input.userId, ctx.orgId);
      if (!participant) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
      }
      return participant;
    }),

  vote: orgProcedure
    .input(submitVoteInput)
    .mutation(async ({ ctx, input }) => {
      const vote = await sessionService.submitVote(
        input.sessionId,
        input.userId,
        input.round,
        input.value,
        ctx.orgId,
      );
      if (!vote) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
      }
      return vote;
    }),

  getVotes: orgProcedure
    .input(getSessionInput.extend({ round: submitVoteInput.shape.round }))
    .query(async ({ ctx, input }) => {
      return sessionService.getVotes(input.id, input.round, ctx.orgId);
    }),

  reveal: orgProcedure
    .input(revealVotesInput)
    .mutation(async ({ ctx, input }) => {
      const session = await sessionService.revealVotes(input.sessionId, ctx.orgId);
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
      }
      return session;
    }),

  newRound: orgProcedure
    .input(newRoundInput)
    .mutation(async ({ ctx, input }) => {
      const session = await sessionService.startNewRound(input.sessionId, ctx.orgId);
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
      }
      return session;
    }),

  complete: orgProcedure
    .input(completeSessionInput)
    .mutation(async ({ ctx, input }) => {
      const session = await sessionService.completeSession(
        input.sessionId,
        input.finalEstimate,
        ctx.orgId,
        ctx.userId ?? undefined,
      );
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
      }
      return session;
    }),
});
