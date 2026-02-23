import { TRPCError } from '@trpc/server';

import { orgProcedure, router } from '../../trpc/trpc';
import { webhookEventEmitter } from '../../services/webhooks/events';

import { costAnalysisService } from './cost-analysis-service';
import {
  effortAnalysisByIdInput,
  effortAnalysisByProjectInput,
  effortApplyRoadmapInput,
  effortCalculateInput,
  effortCompareAnalysesInput,
  effortCreateAiAnalysisInput,
  effortExportAnalysisInput,
  effortRoadmapInput,
  effortSaveCurrentAnalysisInput,
  effortSyncAnalysisToGithubInput,
  effortUpdateAnalysisInput,
} from './schema';
import { effortService } from './service';

function mapProjectNotFound(error: unknown, fallback: string): never {
  if (error instanceof Error && error.message.includes('Project not found')) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
  }

  if (error instanceof Error) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
  }

  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: fallback });
}

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
      } catch (error) {
        mapProjectNotFound(error, 'Failed to calculate effort');
      }
    }),

  roadmap: orgProcedure
    .input(effortRoadmapInput)
    .query(async ({ ctx, input }) => {
      try {
        return await effortService.generateRoadmap(
          input.projectId,
          ctx.orgId,
          input.contingencyPercent,
          input.workHoursPerDay,
          input.includeCompleted,
        );
      } catch (error) {
        mapProjectNotFound(error, 'Failed to generate roadmap');
      }
    }),

  applyRoadmap: orgProcedure
    .input(effortApplyRoadmapInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await effortService.applyRoadmapToKanban(
          input.projectId,
          ctx.orgId,
          input.contingencyPercent,
          input.workHoursPerDay,
          input.includeCompleted,
          input.autoMoveFirstWeekToTodo,
        );
      } catch (error) {
        mapProjectNotFound(error, 'Failed to apply roadmap');
      }
    }),

  listAnalyses: orgProcedure
    .input(effortAnalysisByProjectInput)
    .query(async ({ ctx, input }) => {
      try {
        return await costAnalysisService.listAnalyses(input.projectId, ctx.orgId);
      } catch (error) {
        mapProjectNotFound(error, 'Failed to list analyses');
      }
    }),

  getAnalysis: orgProcedure
    .input(effortAnalysisByIdInput)
    .query(async ({ ctx, input }) => {
      try {
        return await costAnalysisService.getAnalysisById(input.analysisId, ctx.orgId);
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Analysis not found' });
        }
        mapProjectNotFound(error, 'Failed to get analysis');
      }
    }),

  saveCurrentAnalysis: orgProcedure
    .input(effortSaveCurrentAnalysisInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await costAnalysisService.saveCurrentProjectAnalysis(
          input.projectId,
          ctx.orgId,
          ctx.userId,
          {
            name: input.name,
            description: input.description,
            assumptions: input.assumptions,
            parameters: input.parameters,
            editableSections: input.editableSections,
          },
        );
      } catch (error) {
        mapProjectNotFound(error, 'Failed to save analysis');
      }
    }),

  createAiAnalysis: orgProcedure
    .input(effortCreateAiAnalysisInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await costAnalysisService.createAiCostAnalysis(
          input.projectId,
          ctx.orgId,
          ctx.userId,
          {
            name: input.name,
            description: input.description,
            assumptions: input.assumptions,
            parameters: input.parameters,
            editableSections: input.editableSections,
            text: input.text,
            projectContext: input.projectContext,
            provider: input.provider,
            model: input.model,
            reasoningEffort: input.reasoningEffort,
          },
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes('No active API key')) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: error.message });
        }
        mapProjectNotFound(error, 'Failed to create AI analysis');
      }
    }),

  updateAnalysis: orgProcedure
    .input(effortUpdateAnalysisInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await costAnalysisService.updateAnalysis(ctx.orgId, input);
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Analysis not found' });
        }
        mapProjectNotFound(error, 'Failed to update analysis');
      }
    }),

  deleteAnalysis: orgProcedure
    .input(effortAnalysisByIdInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await costAnalysisService.deleteAnalysis(input.analysisId, ctx.orgId);
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Analysis not found' });
        }
        mapProjectNotFound(error, 'Failed to delete analysis');
      }
    }),

  compareAnalyses: orgProcedure
    .input(effortCompareAnalysesInput)
    .query(async ({ ctx, input }) => {
      try {
        return await costAnalysisService.compareAnalyses(
          input.projectId,
          input.analysisIds,
          ctx.orgId,
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
        }
        mapProjectNotFound(error, 'Failed to compare analyses');
      }
    }),

  exportAnalysis: orgProcedure
    .input(effortExportAnalysisInput)
    .query(async ({ ctx, input }) => {
      try {
        const result = await costAnalysisService.exportAnalysis(input.analysisId, ctx.orgId, input.format);

        // Get analysis metadata for webhook
        const analysis = await costAnalysisService.getAnalysisById(input.analysisId, ctx.orgId);

        // Emit webhook event (non-blocking)
        void webhookEventEmitter.emitAnalysisExported(ctx.orgId, {
          analysisId: input.analysisId,
          projectId: analysis.project?.id ?? null,
          type: analysis.source === 'ai_text' ? 'ai_text' : 'project_tasks',
          format: input.format as 'pdf' | 'csv' | 'json',
          exportedBy: ctx.userId,
        }).catch((error) => {
          console.error('Failed to emit analysis.exported webhook:', error);
        });

        return result;
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Analysis not found' });
        }
        mapProjectNotFound(error, 'Failed to export analysis');
      }
    }),

  syncAnalysisToGithub: orgProcedure
    .input(effortSyncAnalysisToGithubInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await costAnalysisService.syncAnalysisToGithub(
          input.analysisId,
          ctx.orgId,
          input.integrationId,
          input.repository,
        );
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
          }
          if (
            error.message.includes('not connected')
            || error.message.includes('token')
            || error.message.includes('not linked')
          ) {
            throw new TRPCError({ code: 'PRECONDITION_FAILED', message: error.message });
          }
        }
        mapProjectNotFound(error, 'Failed to sync analysis to GitHub');
      }
    }),
});
