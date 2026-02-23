import type { FastifyInstance } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';

import type { PublicApiRequest } from './api-key-auth';

/**
 * Redis client for distributed rate limiting
 * Only initialized if REDIS_URL is configured
 */
let redisClient: Redis | null = null;

/**
 * Initialize Redis client for rate limiting
 * Falls back to in-memory storage if Redis is unavailable
 */
function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('[rate-limit] REDIS_URL not configured, using in-memory rate limiting');
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    redisClient.on('error', (err) => {
      console.error('[rate-limit] Redis connection error:', err);
    });

    redisClient.on('connect', () => {
      console.log('[rate-limit] Redis connected for distributed rate limiting');
    });

    return redisClient;
  } catch (error) {
    console.error('[rate-limit] Failed to initialize Redis client:', error);
    return null;
  }
}

/**
 * Register rate limiting plugin for REST API endpoints
 * Uses per-API-key rate limits from database, defaults to 1000 requests/minute
 *
 * Rate limiting strategy:
 * - Key: API key ID (ensures per-key isolation)
 * - Max: From publicApiKeys.rateLimit column (default 1000)
 * - Window: 60 seconds (1 minute)
 * - Storage: Redis if available, otherwise in-memory
 */
export async function registerRateLimitMiddleware(
  fastify: FastifyInstance,
): Promise<void> {
  const redis = getRedisClient();

  await fastify.register(fastifyRateLimit, {
    global: false, // Apply selectively to REST API routes only
    max: async (request) => {
      // Extract rate limit from authenticated API key context
      const apiRequest = request as PublicApiRequest;
      return apiRequest.apiKey?.rateLimit ?? 1000; // Default to 1000 req/min
    },
    timeWindow: 60 * 1000, // 60 seconds = 1 minute
    keyGenerator: (request) => {
      // Use API key ID as the rate limit key
      const apiRequest = request as PublicApiRequest;
      return apiRequest.apiKey?.id ?? 'anonymous';
    },
    // Use Redis for distributed rate limiting if available
    redis: redis ?? undefined,
    // Add rate limit headers to response
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    // Custom error response
    errorResponseBuilder: (request, context) => {
      return {
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${context.max} requests per minute allowed.`,
        retryAfter: context.ttl ? Math.ceil(context.ttl / 1000) : 60,
      };
    },
    // Skip failed requests (don't count them against rate limit)
    skipOnError: true,
  });
}

/**
 * Cleanup Redis connection on server shutdown
 */
export function closeRateLimitRedis(): Promise<void> {
  if (redisClient) {
    return redisClient.quit().then(() => {
      redisClient = null;
    });
  }
  return Promise.resolve();
}
