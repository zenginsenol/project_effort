import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { projectService } from '../../../routers/project/service';
import { getOrgIdFromApiKey } from '../../middleware/api-key-auth';

/**
 * Input validation schemas for projects API
 */
const createProjectSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  key: z.string().min(2).max(10).regex(/^[A-Z]+$/),
  defaultEstimationMethod: z.enum(['planning_poker', 'tshirt_sizing', 'pert', 'wideband_delphi']).default('planning_poker'),
});

const updateProjectSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['active', 'archived', 'completed']).optional(),
  defaultEstimationMethod: z.enum(['planning_poker', 'tshirt_sizing', 'pert', 'wideband_delphi']).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Register projects REST API routes
 *
 * @description Provides CRUD operations for projects via REST API
 * @tag Projects
 */
export async function projectsRoutes(fastify: FastifyInstance): Promise<void> {
  // List all projects for the authenticated organization
  fastify.get('/', {
    schema: {
      tags: ['Projects'],
      summary: 'List all projects',
      description: 'Returns all projects for the authenticated organization',
      response: {
        200: {
          description: 'List of projects',
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
      const projects = await projectService.listByOrganization(organizationId);
      return reply.status(200).send(projects);
    } catch (error) {
      request.log.error({ error }, 'Failed to list projects');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve projects',
      });
    }
  });

  // Get a single project by ID
  fastify.get('/:id', {
    schema: {
      tags: ['Projects'],
      summary: 'Get project by ID',
      description: 'Returns a single project by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      response: {
        200: {
          description: 'Project details',
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
          description: 'Project not found',
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
      const project = await projectService.getById(params.id, organizationId);

      if (!project) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      return reply.status(200).send(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid project ID',
        });
      }

      request.log.error({ error }, 'Failed to get project');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve project',
      });
    }
  });

  // Create a new project
  fastify.post('/', {
    schema: {
      tags: ['Projects'],
      summary: 'Create a new project',
      description: 'Creates a new project for the authenticated organization',
      body: {
        type: 'object',
        required: ['name', 'key'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 200 },
          description: { type: 'string', maxLength: 2000 },
          key: { type: 'string', minLength: 2, maxLength: 10, pattern: '^[A-Z]+$' },
          defaultEstimationMethod: {
            type: 'string',
            enum: ['planning_poker', 'tshirt_sizing', 'pert', 'wideband_delphi'],
            default: 'planning_poker',
          },
        },
      },
      response: {
        201: {
          description: 'Project created successfully',
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
      const data = createProjectSchema.parse(request.body);
      const project = await projectService.create(organizationId, data);

      if (!project) {
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to create project',
        });
      }

      return reply.status(201).send(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: error.errors[0]?.message || 'Invalid input',
        });
      }

      request.log.error({ error }, 'Failed to create project');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create project',
      });
    }
  });

  // Update an existing project
  fastify.put('/:id', {
    schema: {
      tags: ['Projects'],
      summary: 'Update a project',
      description: 'Updates an existing project',
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
          name: { type: 'string', minLength: 2, maxLength: 200 },
          description: { type: 'string', maxLength: 2000 },
          status: { type: 'string', enum: ['active', 'archived', 'completed'] },
          defaultEstimationMethod: {
            type: 'string',
            enum: ['planning_poker', 'tshirt_sizing', 'pert', 'wideband_delphi'],
          },
        },
      },
      response: {
        200: {
          description: 'Project updated successfully',
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
          description: 'Project not found',
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
      const data = updateProjectSchema.parse(request.body);

      const project = await projectService.update(params.id, organizationId, data);

      if (!project) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      return reply.status(200).send(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: error.errors[0]?.message || 'Invalid input',
        });
      }

      request.log.error({ error }, 'Failed to update project');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update project',
      });
    }
  });

  // Delete a project
  fastify.delete('/:id', {
    schema: {
      tags: ['Projects'],
      summary: 'Delete a project',
      description: 'Deletes a project by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      response: {
        200: {
          description: 'Project deleted successfully',
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
          description: 'Project not found',
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
      const project = await projectService.delete(params.id, organizationId);

      if (!project) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      return reply.status(200).send(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid project ID',
        });
      }

      request.log.error({ error }, 'Failed to delete project');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete project',
      });
    }
  });
}
