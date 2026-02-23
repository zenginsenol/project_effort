import { TRPCError } from '@trpc/server';

import { orgProcedure, router } from '../../trpc/trpc';

import { searchInput } from './schema';
import { searchService } from './service';

export const searchRouter = router({
  query: orgProcedure
    .input(searchInput)
    .query(async ({ ctx, input }) => {
      try {
        const results = await searchService.search(input, ctx.orgId, ctx.userId);
        return results;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to execute search',
        });
      }
    }),

  getRecent: orgProcedure
    .query(async ({ ctx }) => {
      try {
        const recentSearches = searchService.getRecentSearches(ctx.userId, ctx.orgId);
        return recentSearches;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to retrieve recent searches',
        });
      }
    }),
});
