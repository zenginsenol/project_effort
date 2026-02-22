import { TRPCError } from '@trpc/server';

import { orgProcedure, router } from '../../trpc/trpc';

import { searchInput } from './schema';
import { searchService } from './service';

export const searchRouter = router({
  query: orgProcedure
    .input(searchInput)
    .query(async ({ ctx, input }) => {
      try {
        const results = await searchService.search(input, ctx.orgId);
        return results;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to execute search',
        });
      }
    }),
});
