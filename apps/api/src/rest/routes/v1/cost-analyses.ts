import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { costAnalysisService } from '../../../routers/effort/cost-analysis-service';
import { getOrgIdFromApiKey } from '../../middleware/api-key-auth';

/**
 * Input validation schemas for cost analyses API
 */
const listAnalysesQuerySchema = z.object({
  projectId: z.string().uuid(),
});

const createAnalysisSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  assumptions: z.array(z.string().min(1).max(500)).max(200).default([]),
  parameters: z.object({
    hourlyRate: z.number().min(0).default(150),
    currency: z.string().min(1).max(10).default('TRY'),
    contingencyPercent: z.number().min(0).max(100).default(20),
    workHoursPerDay: z.number().min(1).max(24).default(8),
  }),
  editableSections: z.object({
    monthlyInfraOpsCost: z.number().min(0).default(15000),
    annualDomainCost: z.number().min(0).default(1200),
    monthlyMaintenanceHours: z.number().min(0).default(80),
    additionalCosts: z.array(z.object({
      id: z.string().uuid().optional(),
      label: z.string().min(1).max(200),
      amount: z.number().min(0),
      frequency: z.enum(['one_time', 'monthly', 'annual']).default('one_time'),
      note: z.string().max(1000).optional(),
    })).max(100).default([]),
  }),
  // For AI-powered analysis
  sourceType: z.enum(['project_tasks', 'ai_text']).default('project_tasks'),
  text: z.string().min(10).max(50000).optional(),
  projectContext: z.string().max(2000).optional(),
  provider: z.enum(['openai', 'anthropic', 'openrouter']).optional(),
  model: z.string().max(120).optional(),
  reasoningEffort: z.enum(['low', 'medium', 'high', 'xhigh']).nullable().optional(),
});

const updateAnalysisSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  assumptions: z.array(z.string().min(1).max(500)).max(200).optional(),
  parameters: z.object({
    hourlyRate: z.number().min(0).optional(),
    currency: z.string().min(1).max(10).optional(),
    contingencyPercent: z.number().min(0).max(100).optional(),
    workHoursPerDay: z.number().min(1).max(24).optional(),
  }).optional(),
  editableSections: z.object({
    monthlyInfraOpsCost: z.number().min(0).optional(),
    annualDomainCost: z.number().min(0).optional(),
    monthlyMaintenanceHours: z.number().min(0).optional(),
    additionalCosts: z.array(z.object({
      id: z.string().uuid().optional(),
      label: z.string().min(1).max(200),
      amount: z.number().min(0),
      frequency: z.enum(['one_time', 'monthly', 'annual']).default('one_time'),
      note: z.string().max(1000).optional(),
    })).max(100).optional(),
  }).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const compareAnalysesQuerySchema = z.object({
  projectId: z.string().uuid(),
  analysisIds: z.array(z.string().uuid()).min(2).max(6),
});

const exportAnalysisQuerySchema = z.object({
  format: z.enum(['json', 'csv', 'md']).default('json'),
});

/**
 * Register cost analyses REST API routes
 *
 * @description Provides CRUD operations for cost analyses via REST API
 * @tag Cost Analyses
 */
export async function costAnalysesRoutes(fastify: FastifyInstance): Promise<void> {
  // List all cost analyses for a project
  fastify.get('/', {
    schema: {
      tags: ['Cost Analyses'],
      summary: 'List cost analyses for a project',
      description: 'Returns all cost analyses for the specified project',
      querystring: {
        type: 'object',
        properties: {
          projectId: { type: 'string', format: 'uuid' },
        },
        required: ['projectId'],
      },
      response: {
        200: {
          description: 'List of cost analyses',
          type: 'array',
          items: { type: 'object' },
        },
        400: {
          description: 'Bad Request',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const organizationId = getOrgIdFromApiKey(request);

    if (!organizationId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Valid API key required',
      });
    }

    try {
      const query = listAnalysesQuerySchema.parse(request.query);
      const analyses = await costAnalysisService.listAnalyses(query.projectId, organizationId);
      return reply.status(200).send(analyses);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid query parameters',
        });
      }

      if (error instanceof Error && error.message.includes('Project not found')) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      request.log.error({ error }, 'Failed to list cost analyses');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve cost analyses',
      });
    }
  });

  // Get a single cost analysis by ID
  fastify.get('/:id', {
    schema: {
      tags: ['Cost Analyses'],
      summary: 'Get cost analysis by ID',
      description: 'Returns a single cost analysis with full details',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      response: {
        200: {
          description: 'Cost analysis details',
          type: 'object',
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        404: {
          description: 'Analysis not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const organizationId = getOrgIdFromApiKey(request);

    if (!organizationId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Valid API key required',
      });
    }

    try {
      const params = idParamSchema.parse(request.params);
      const analysis = await costAnalysisService.getAnalysisById(params.id, organizationId);
      return reply.status(200).send(analysis);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid analysis ID',
        });
      }

      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Analysis not found',
        });
      }

      request.log.error({ error }, 'Failed to get cost analysis');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve cost analysis',
      });
    }
  });

  // Create a new cost analysis
  fastify.post('/', {
    schema: {
      tags: ['Cost Analyses'],
      summary: 'Create a new cost analysis',
      description: 'Creates a new cost analysis from project tasks or AI-generated estimates',
      body: {
        type: 'object',
        required: ['projectId', 'parameters', 'editableSections'],
        properties: {
          projectId: { type: 'string', format: 'uuid' },
          name: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string', maxLength: 2000 },
          assumptions: { type: 'array', items: { type: 'string' } },
          parameters: {
            type: 'object',
            required: ['hourlyRate', 'currency', 'contingencyPercent', 'workHoursPerDay'],
            properties: {
              hourlyRate: { type: 'number', minimum: 0 },
              currency: { type: 'string', minLength: 1, maxLength: 10 },
              contingencyPercent: { type: 'number', minimum: 0, maximum: 100 },
              workHoursPerDay: { type: 'number', minimum: 1, maximum: 24 },
            },
          },
          editableSections: { type: 'object' },
          sourceType: { type: 'string', enum: ['project_tasks', 'ai_text'] },
          text: { type: 'string' },
          projectContext: { type: 'string' },
          provider: { type: 'string', enum: ['openai', 'anthropic', 'openrouter'] },
          model: { type: 'string' },
          reasoningEffort: { type: 'string', enum: ['low', 'medium', 'high', 'xhigh'], nullable: true },
        },
      },
      response: {
        201: {
          description: 'Cost analysis created successfully',
          type: 'object',
        },
        400: {
          description: 'Invalid input',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const organizationId = getOrgIdFromApiKey(request);

    if (!organizationId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Valid API key required',
      });
    }

    try {
      const input = createAnalysisSchema.parse(request.body);

      // For AI-powered analysis, we need to call createAiCostAnalysis
      if (input.sourceType === 'ai_text') {
        if (!input.text || !input.provider) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'AI analysis requires text and provider fields',
          });
        }

        // Note: REST API doesn't have user context, so we'll use a system user ID
        // This is a limitation - in production, you'd need to implement user authentication
        const analysis = await costAnalysisService.createAiCostAnalysis(
          input.projectId,
          organizationId,
          'system', // Placeholder - REST API doesn't have Clerk user context
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

        return reply.status(201).send(analysis);
      }

      // For project_tasks analysis
      const analysis = await costAnalysisService.saveCurrentProjectAnalysis(
        input.projectId,
        organizationId,
        'system', // Placeholder - REST API doesn't have Clerk user context
        {
          name: input.name,
          description: input.description,
          assumptions: input.assumptions,
          parameters: input.parameters,
          editableSections: input.editableSections,
        },
      );

      return reply.status(201).send(analysis);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid input data',
        });
      }

      if (error instanceof Error) {
        if (error.message.includes('Project not found')) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Project not found',
          });
        }

        if (error.message.includes('No active API key')) {
          return reply.status(412).send({
            error: 'Precondition Failed',
            message: error.message,
          });
        }
      }

      request.log.error({ error }, 'Failed to create cost analysis');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create cost analysis',
      });
    }
  });

  // Update a cost analysis
  fastify.patch('/:id', {
    schema: {
      tags: ['Cost Analyses'],
      summary: 'Update a cost analysis',
      description: 'Updates an existing cost analysis',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string', maxLength: 2000, nullable: true },
          assumptions: { type: 'array', items: { type: 'string' } },
          parameters: { type: 'object' },
          editableSections: { type: 'object' },
        },
      },
      response: {
        200: {
          description: 'Cost analysis updated successfully',
          type: 'object',
        },
        400: {
          description: 'Invalid input',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        404: {
          description: 'Analysis not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const organizationId = getOrgIdFromApiKey(request);

    if (!organizationId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Valid API key required',
      });
    }

    try {
      const params = idParamSchema.parse(request.params);
      const updateData = updateAnalysisSchema.parse(request.body);

      const analysis = await costAnalysisService.updateAnalysis(organizationId, {
        analysisId: params.id,
        ...updateData,
      });

      return reply.status(200).send(analysis);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid input data',
        });
      }

      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Analysis not found',
        });
      }

      request.log.error({ error }, 'Failed to update cost analysis');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update cost analysis',
      });
    }
  });

  // Delete a cost analysis
  fastify.delete('/:id', {
    schema: {
      tags: ['Cost Analyses'],
      summary: 'Delete a cost analysis',
      description: 'Deletes an existing cost analysis',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      response: {
        200: {
          description: 'Cost analysis deleted successfully',
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        404: {
          description: 'Analysis not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const organizationId = getOrgIdFromApiKey(request);

    if (!organizationId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Valid API key required',
      });
    }

    try {
      const params = idParamSchema.parse(request.params);
      const result = await costAnalysisService.deleteAnalysis(params.id, organizationId);
      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid analysis ID',
        });
      }

      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Analysis not found',
        });
      }

      request.log.error({ error }, 'Failed to delete cost analysis');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete cost analysis',
      });
    }
  });

  // Compare multiple cost analyses
  fastify.get('/compare', {
    schema: {
      tags: ['Cost Analyses'],
      summary: 'Compare multiple cost analyses',
      description: 'Compares 2-6 cost analyses for the same project',
      querystring: {
        type: 'object',
        properties: {
          projectId: { type: 'string', format: 'uuid' },
          analysisIds: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            minItems: 2,
            maxItems: 6,
          },
        },
        required: ['projectId', 'analysisIds'],
      },
      response: {
        200: {
          description: 'Cost analyses comparison',
          type: 'object',
        },
        400: {
          description: 'Bad Request',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        404: {
          description: 'Not Found',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const organizationId = getOrgIdFromApiKey(request);

    if (!organizationId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Valid API key required',
      });
    }

    try {
      const query = compareAnalysesQuerySchema.parse(request.query);
      const comparison = await costAnalysisService.compareAnalyses(
        query.projectId,
        query.analysisIds,
        organizationId,
      );
      return reply.status(200).send(comparison);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid query parameters',
        });
      }

      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({
          error: 'Not Found',
          message: error.message,
        });
      }

      request.log.error({ error }, 'Failed to compare cost analyses');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to compare cost analyses',
      });
    }
  });

  // Export a cost analysis
  fastify.get('/:id/export', {
    schema: {
      tags: ['Cost Analyses'],
      summary: 'Export a cost analysis',
      description: 'Exports a cost analysis in JSON, CSV, or Markdown format',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['json', 'csv', 'md'], default: 'json' },
        },
      },
      response: {
        200: {
          description: 'Exported cost analysis',
          type: 'object',
          properties: {
            filename: { type: 'string' },
            format: { type: 'string' },
            mimeType: { type: 'string' },
            content: { type: 'string' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        404: {
          description: 'Analysis not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const organizationId = getOrgIdFromApiKey(request);

    if (!organizationId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Valid API key required',
      });
    }

    try {
      const params = idParamSchema.parse(request.params);
      const query = exportAnalysisQuerySchema.parse(request.query);

      const exportData = await costAnalysisService.exportAnalysis(
        params.id,
        organizationId,
        query.format,
      );

      return reply.status(200).send(exportData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid parameters',
        });
      }

      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Analysis not found',
        });
      }

      request.log.error({ error }, 'Failed to export cost analysis');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to export cost analysis',
      });
    }
  });
}
