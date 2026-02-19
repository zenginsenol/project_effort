import { TRPCError } from '@trpc/server';

import { orgProcedure, router } from '../../trpc/trpc';

import { effortCalculateInput, effortByTaskInput } from './schema';
import { effortService } from './service';

export const effortRouter = router({
  calculate: orgProcedure
    .input(effortCalculateInput)
    .query(async ({ ctx, input }) => {
      try {
        return await effortService.calculateProjectEffort(
          input.projectId,
          ctx.orgId,
          input.hourlyRate,
          input.currency,
          input.contingencyPercent,
          input.workHoursPerDay,
        );
      } catch (err) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
    }),
});
