import { TRPCError } from '@trpc/server';

import { orgProcedure, router } from '../../trpc/trpc';

import { accuracyTrendsInput, burndownInput, enhancedTeamBiasInput, projectAnalyticsInput, velocityInput } from './schema';
import { analyticsService } from './service';

export const analyticsRouter = router({
  overview: orgProcedure
    .input(projectAnalyticsInput)
    .query(async ({ ctx, input }) => {
      return analyticsService.getProjectOverview(input.projectId, ctx.orgId);
    }),

  velocity: orgProcedure
    .input(velocityInput)
    .query(async ({ ctx, input }) => {
      return analyticsService.getVelocityData(input.projectId, input.sprintCount, ctx.orgId);
    }),

  burndown: orgProcedure
    .input(burndownInput)
    .query(async ({ ctx, input }) => {
      return analyticsService.getBurndownData(input.projectId, input.days, ctx.orgId);
    }),

  accuracy: orgProcedure
    .input(projectAnalyticsInput)
    .query(async ({ ctx, input }) => {
      return analyticsService.getEstimationAccuracy(input.projectId, ctx.orgId);
    }),

  teamBias: orgProcedure
    .input(projectAnalyticsInput)
    .query(async ({ ctx, input }) => {
      return analyticsService.getTeamBias(input.projectId, ctx.orgId);
    }),

  accuracyTrends: orgProcedure
    .input(accuracyTrendsInput)
    .query(async ({ ctx, input }) => {
      return analyticsService.getAccuracyTrends(input.projectId, ctx.orgId);
    }),

  enhancedTeamBias: orgProcedure
    .input(enhancedTeamBiasInput)
    .query(async ({ ctx, input }) => {
      return analyticsService.getEnhancedTeamBias(
        input.projectId,
        input.groupBy,
        ctx.orgId,
        input.dateFrom,
        input.dateTo,
      );
    }),

  exportCsv: orgProcedure
    .input(projectAnalyticsInput)
    .query(async ({ ctx, input }) => {
      const payload = await analyticsService.exportCsv(input.projectId, ctx.orgId);
      if (!payload) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found or access denied' });
      }
      return payload;
    }),

  exportXlsx: orgProcedure
    .input(projectAnalyticsInput)
    .query(async ({ ctx, input }) => {
      const payload = await analyticsService.exportXlsx(input.projectId, ctx.orgId);
      if (!payload) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found or access denied' });
      }
      return payload;
    }),

  exportPdf: orgProcedure
    .input(projectAnalyticsInput)
    .query(async ({ ctx, input }) => {
      const payload = await analyticsService.exportPdf(input.projectId, ctx.orgId);
      if (!payload) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found or access denied' });
      }
      return payload;
    }),
});
