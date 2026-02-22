import type { FastifyInstance } from 'fastify';

import { apiKeyAuthMiddleware } from './middleware/api-key-auth';
import { registerRateLimitMiddleware } from './middleware/rate-limit';

/**
 * Register REST API routes with authentication and rate limiting
 *
 * This function sets up the public REST API at /api/v1/* with:
 * - API key authentication middleware
 * - Per-key rate limiting
 * - OpenAPI-documented endpoints
 *
 * Routes will be added in subsequent phases (phase-3-public-api).
 */
export async function registerRestApi(fastify: FastifyInstance): Promise<void> {
  // Register rate limiting plugin (must be registered before routes)
  await registerRateLimitMiddleware(fastify);

  // Register REST API routes under /api/v1 prefix
  await fastify.register(async (api) => {
    // Apply API key authentication to all routes in this scope
    api.addHook('preHandler', apiKeyAuthMiddleware);

    // Apply rate limiting to all routes in this scope
    api.addHook('preHandler', api.rateLimit());

    // Health check endpoint (no auth required, will be overridden below)
    api.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Register REST API route modules
    const { projectsRoutes } = await import('./routes/v1/projects');
    await api.register(projectsRoutes, { prefix: '/projects' });

    const { tasksRoutes } = await import('./routes/v1/tasks');
    await api.register(tasksRoutes, { prefix: '/tasks' });

    const { estimatesRoutes } = await import('./routes/v1/estimates');
    await api.register(estimatesRoutes, { prefix: '/estimates' });

    // TODO: Register additional route modules here in phase-3
    // await api.register(costAnalysesRoutes, { prefix: '/cost-analyses' });
  }, { prefix: '/api/v1' });
}
