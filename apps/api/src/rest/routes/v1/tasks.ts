import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { taskService } from '../../../routers/task/service';
import { getOrgIdFromApiKey } from '../../middleware/api-key-auth';

/**
 * Input validation schemas for tasks API
 */
const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  type: z.enum(['epic', 'feature', 'story', 'task', 'subtask', 'bug']).default('task'),
  status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled']).default('backlog'),
  priority: z.enum(['critical', 'high', 'medium', 'low', 'none']).default('medium'),
  parentId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  estimatedPoints: z.number().min(0).optional(),
  estimatedHours: z.number().min(0).optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  type: z.enum(['epic', 'feature', 'story', 'task', 'subtask', 'bug']).optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled']).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low', 'none']).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  estimatedPoints: z.number().min(0).nullable().optional(),
  estimatedHours: z.number().min(0).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const listTasksQuerySchema = z.object({
  projectId: z.string().uuid(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled']).optional(),
  type: z.enum(['epic', 'feature', 'story', 'task', 'subtask', 'bug']).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

/**
 * Register tasks REST API routes
 *
 * @description Provides CRUD operations for tasks via REST API
 * @tag Tasks
 */
export async function tasksRoutes(fastify: FastifyInstance): Promise<void> {
  // List tasks by project
  fastify.get('/', {
    schema: {
      tags: ['Tasks'],
      summary: 'List tasks',
      description: 'Returns tasks filtered by project ID and optional status/type filters',
      querystring: {
        type: 'object',
        required: ['projectId'],
        properties: {
          projectId: { type: 'string', format: 'uuid' },
          status: {
            type: 'string',
            enum: ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'],
          },
          type: {
            type: 'string',
            enum: ['epic', 'feature', 'story', 'task', 'subtask', 'bug'],
          },
          parentId: { type: 'string', format: 'uuid', nullable: true },
        },
      },
      response: {
        200: {
          description: 'List of tasks',
          type: 'array',
          items: { type: 'object' },
        },
        400: {
          description: 'Invalid query parameters',
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
      const query = listTasksQuerySchema.parse(request.query);
      const { projectId, ...filters } = query;
      const tasks = await taskService.listByProject(projectId, organizationId, filters);
      return reply.status(200).send(tasks);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid query parameters',
        });
      }

      request.log.error({ error }, 'Failed to list tasks');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve tasks',
      });
    }
  });

  // Get a single task by ID
  fastify.get('/:id', {
    schema: {
      tags: ['Tasks'],
      summary: 'Get task by ID',
      description: 'Returns a single task by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      response: {
        200: {
          description: 'Task details',
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
          description: 'Task not found',
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
      const task = await taskService.getById(params.id, organizationId);

      if (!task) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Task not found',
        });
      }

      return reply.status(200).send(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid task ID',
        });
      }

      request.log.error({ error }, 'Failed to get task');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve task',
      });
    }
  });

  // Create a new task
  fastify.post('/', {
    schema: {
      tags: ['Tasks'],
      summary: 'Create a new task',
      description: 'Creates a new task for the specified project',
      body: {
        type: 'object',
        required: ['projectId', 'title'],
        properties: {
          projectId: { type: 'string', format: 'uuid' },
          title: { type: 'string', minLength: 1, maxLength: 500 },
          description: { type: 'string', maxLength: 10000 },
          type: {
            type: 'string',
            enum: ['epic', 'feature', 'story', 'task', 'subtask', 'bug'],
            default: 'task',
          },
          status: {
            type: 'string',
            enum: ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'],
            default: 'backlog',
          },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low', 'none'],
            default: 'medium',
          },
          parentId: { type: 'string', format: 'uuid' },
          assigneeId: { type: 'string', format: 'uuid' },
          estimatedPoints: { type: 'number', minimum: 0 },
          estimatedHours: { type: 'number', minimum: 0 },
        },
      },
      response: {
        201: {
          description: 'Task created successfully',
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
          description: 'Project access denied',
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
      const body = createTaskSchema.parse(request.body);
      const task = await taskService.create(organizationId, body);

      if (!task) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Project access denied',
        });
      }

      return reply.status(201).send(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
        });
      }

      request.log.error({ error }, 'Failed to create task');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create task',
      });
    }
  });

  // Update a task
  fastify.patch('/:id', {
    schema: {
      tags: ['Tasks'],
      summary: 'Update a task',
      description: 'Updates an existing task',
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
          title: { type: 'string', minLength: 1, maxLength: 500 },
          description: { type: 'string', maxLength: 10000 },
          type: {
            type: 'string',
            enum: ['epic', 'feature', 'story', 'task', 'subtask', 'bug'],
          },
          status: {
            type: 'string',
            enum: ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'],
          },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low', 'none'],
          },
          assigneeId: { type: 'string', format: 'uuid', nullable: true },
          estimatedPoints: { type: 'number', minimum: 0, nullable: true },
          estimatedHours: { type: 'number', minimum: 0, nullable: true },
          sortOrder: { type: 'integer' },
        },
      },
      response: {
        200: {
          description: 'Task updated successfully',
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
          description: 'Task not found',
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
      const body = updateTaskSchema.parse(request.body);
      const task = await taskService.update(params.id, organizationId, body);

      if (!task) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Task not found',
        });
      }

      return reply.status(200).send(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
        });
      }

      request.log.error({ error }, 'Failed to update task');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update task',
      });
    }
  });

  // Delete a task
  fastify.delete('/:id', {
    schema: {
      tags: ['Tasks'],
      summary: 'Delete a task',
      description: 'Deletes a task by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      response: {
        200: {
          description: 'Task deleted successfully',
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
          description: 'Task not found',
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
      const task = await taskService.delete(params.id, organizationId);

      if (!task) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Task not found',
        });
      }

      return reply.status(200).send(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid task ID',
        });
      }

      request.log.error({ error }, 'Failed to delete task');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete task',
      });
    }
  });
}
