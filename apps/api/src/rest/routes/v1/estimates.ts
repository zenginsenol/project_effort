import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { db } from '@estimate-pro/db';
import { estimates, tasks } from '@estimate-pro/db/schema';
import { and, eq } from 'drizzle-orm';

import { hasTaskAccess } from '../../../services/security/tenant-access';
import { getOrgIdFromApiKey } from '../../middleware/api-key-auth';

/**
 * Input validation schemas for estimates API
 */
const createEstimateSchema = z.object({
  taskId: z.string().uuid(),
  userId: z.string().uuid(),
  method: z.enum(['planning_poker', 'tshirt_sizing', 'pert', 'wideband_delphi']),
  value: z.number().positive(),
  unit: z.string().default('points'),
  confidence: z.number().min(0).max(1).optional(),
  notes: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateEstimateSchema = z.object({
  value: z.number().positive().optional(),
  unit: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  notes: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const listEstimatesQuerySchema = z.object({
  taskId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});

/**
 * Register estimates REST API routes
 *
 * @description Provides CRUD operations for task estimates via REST API
 * @tag Estimates
 */
export async function estimatesRoutes(fastify: FastifyInstance): Promise<void> {
  // List all estimates for the authenticated organization
  fastify.get('/', {
    schema: {
      tags: ['Estimates'],
      summary: 'List all estimates',
      description: 'Returns all estimates for the authenticated organization, optionally filtered by taskId or userId',
      querystring: {
        type: 'object',
        properties: {
          taskId: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          description: 'List of estimates',
          type: 'array',
          items: { type: 'object' },
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
      const query = listEstimatesQuerySchema.parse(request.query);

      // Get all estimates for tasks in the organization
      const estimatesList = await db.query.estimates.findMany({
        with: {
          task: {
            columns: {
              id: true,
              title: true,
              projectId: true,
            },
            with: {
              project: {
                columns: {
                  organizationId: true,
                },
              },
            },
          },
          user: {
            columns: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      // Filter by organization and optional query params
      const filtered = estimatesList.filter((estimate) => {
        if (estimate.task.project?.organizationId !== organizationId) {
          return false;
        }
        if (query.taskId && estimate.taskId !== query.taskId) {
          return false;
        }
        if (query.userId && estimate.userId !== query.userId) {
          return false;
        }
        return true;
      });

      // Remove nested project data from response
      const results = filtered.map((estimate) => {
        const { task, ...rest } = estimate;
        const { project, ...taskData } = task;
        return {
          ...rest,
          task: taskData,
        };
      });

      return reply.status(200).send(results);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid query parameters',
        });
      }

      request.log.error({ error }, 'Failed to list estimates');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve estimates',
      });
    }
  });

  // Get a single estimate by ID
  fastify.get('/:id', {
    schema: {
      tags: ['Estimates'],
      summary: 'Get estimate by ID',
      description: 'Returns a single estimate by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      response: {
        200: {
          description: 'Estimate details',
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
          description: 'Estimate not found',
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

      const estimate = await db.query.estimates.findFirst({
        where: eq(estimates.id, params.id),
        with: {
          task: {
            columns: {
              id: true,
              title: true,
              projectId: true,
            },
            with: {
              project: {
                columns: {
                  organizationId: true,
                },
              },
            },
          },
          user: {
            columns: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      if (!estimate) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Estimate not found',
        });
      }

      // Verify organization access
      if (estimate.task.project?.organizationId !== organizationId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Estimate not found',
        });
      }

      // Remove nested project data from response
      const { task, ...rest } = estimate;
      const { project, ...taskData } = task;
      const result = {
        ...rest,
        task: taskData,
      };

      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid estimate ID',
        });
      }

      request.log.error({ error }, 'Failed to get estimate');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve estimate',
      });
    }
  });

  // Create a new estimate
  fastify.post('/', {
    schema: {
      tags: ['Estimates'],
      summary: 'Create a new estimate',
      description: 'Creates a new estimate for a task',
      body: {
        type: 'object',
        required: ['taskId', 'userId', 'method', 'value'],
        properties: {
          taskId: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          method: {
            type: 'string',
            enum: ['planning_poker', 'tshirt_sizing', 'pert', 'wideband_delphi'],
          },
          value: { type: 'number', minimum: 0 },
          unit: { type: 'string', default: 'points' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          notes: { type: 'string', maxLength: 2000 },
          metadata: { type: 'object' },
        },
      },
      response: {
        201: {
          description: 'Estimate created successfully',
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
        403: {
          description: 'Forbidden - No access to task',
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
      const body = createEstimateSchema.parse(request.body);

      // Verify task access
      const hasAccess = await hasTaskAccess(body.taskId, organizationId);
      if (!hasAccess) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'No access to the specified task',
        });
      }

      const [newEstimate] = await db
        .insert(estimates)
        .values(body)
        .returning();

      return reply.status(201).send(newEstimate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: error.errors[0]?.message ?? 'Invalid input',
        });
      }

      request.log.error({ error }, 'Failed to create estimate');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create estimate',
      });
    }
  });

  // Update an existing estimate
  fastify.put('/:id', {
    schema: {
      tags: ['Estimates'],
      summary: 'Update an estimate',
      description: 'Updates an existing estimate by ID',
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
          value: { type: 'number', minimum: 0 },
          unit: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          notes: { type: 'string', maxLength: 2000 },
          metadata: { type: 'object' },
        },
      },
      response: {
        200: {
          description: 'Estimate updated successfully',
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
          description: 'Estimate not found',
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
      const body = updateEstimateSchema.parse(request.body);

      // First, get the estimate to verify access
      const existingEstimate = await db.query.estimates.findFirst({
        where: eq(estimates.id, params.id),
        with: {
          task: {
            with: {
              project: {
                columns: {
                  organizationId: true,
                },
              },
            },
          },
        },
      });

      if (!existingEstimate) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Estimate not found',
        });
      }

      // Verify organization access
      if (existingEstimate.task.project?.organizationId !== organizationId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Estimate not found',
        });
      }

      // Update the estimate
      const [updatedEstimate] = await db
        .update(estimates)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(estimates.id, params.id))
        .returning();

      return reply.status(200).send(updatedEstimate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: error.errors[0]?.message ?? 'Invalid input',
        });
      }

      request.log.error({ error }, 'Failed to update estimate');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update estimate',
      });
    }
  });

  // Delete an estimate
  fastify.delete('/:id', {
    schema: {
      tags: ['Estimates'],
      summary: 'Delete an estimate',
      description: 'Deletes an existing estimate by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      response: {
        200: {
          description: 'Estimate deleted successfully',
          type: 'object',
          properties: {
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
          description: 'Estimate not found',
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

      // First, get the estimate to verify access
      const existingEstimate = await db.query.estimates.findFirst({
        where: eq(estimates.id, params.id),
        with: {
          task: {
            with: {
              project: {
                columns: {
                  organizationId: true,
                },
              },
            },
          },
        },
      });

      if (!existingEstimate) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Estimate not found',
        });
      }

      // Verify organization access
      if (existingEstimate.task.project?.organizationId !== organizationId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Estimate not found',
        });
      }

      // Delete the estimate
      await db.delete(estimates).where(eq(estimates.id, params.id));

      return reply.status(200).send({
        message: 'Estimate deleted successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid estimate ID',
        });
      }

      request.log.error({ error }, 'Failed to delete estimate');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete estimate',
      });
    }
  });
}
