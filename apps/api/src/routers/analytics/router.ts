import { TRPCError } from '@trpc/server';

import { orgProcedure, router } from '../../trpc/trpc';

import { burndownInput, methodComparisonInput, projectAnalyticsInput, velocityInput } from './schema';
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

  methodComparison: orgProcedure
    .input(methodComparisonInput)
    .query(async ({ ctx, input }) => {
      return analyticsService.getMethodComparison(
        input.projectId,
        input.taskIds,
        input.dateFrom,
        input.dateTo,
        ctx.orgId,
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

  exportMethodComparisonCsv: orgProcedure
    .input(methodComparisonInput)
    .query(async ({ ctx, input }) => {
      const payload = await analyticsService.exportCsv(input.projectId, ctx.orgId);
      if (!payload) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found or access denied' });
      }
      return payload;
    }),

  exportMethodComparisonXlsx: orgProcedure
    .input(methodComparisonInput)
    .query(async ({ ctx, input }) => {
      const payload = await analyticsService.exportXlsx(input.projectId, ctx.orgId);
      if (!payload) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found or access denied' });
      }
      return payload;
    }),
});
