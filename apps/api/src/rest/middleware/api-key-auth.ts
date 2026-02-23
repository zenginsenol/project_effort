import type { FastifyRequest, FastifyReply } from 'fastify';
import { createHmac } from 'node:crypto';
import { eq, and } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { publicApiKeys } from '@estimate-pro/db/schema';

/**
 * Extended request interface with public API authentication context
 */
export interface PublicApiRequest extends FastifyRequest {
  apiKey?: {
    id: string;
    organizationId: string;
    rateLimit: number;
  };
}

/**
 * Hash an API key using HMAC-SHA256 for secure comparison
 * Uses server-side secret to prevent rainbow table attacks
 */
function hashApiKey(apiKey: string): string {
  const secret = process.env.API_KEY_SECRET || 'estimatepro-api-key-secret-change-in-production-2024';
  return createHmac('sha256', secret)
    .update(apiKey)
    .digest('hex');
}

/**
 * Extract API key from Authorization header
 * Expected format: "Bearer <api-key>"
 */
function extractApiKey(authHeader: string | string[] | undefined): string | null {
  if (!authHeader || Array.isArray(authHeader)) return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  const key = authHeader.slice('Bearer '.length).trim();
  return key.length > 0 ? key : null;
}

/**
 * Fastify preHandler hook for public API key authentication
 * Validates API key, checks if active, and attaches organization context to request
 */
export async function apiKeyAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const apiKey = extractApiKey(request.headers.authorization);

  if (!apiKey) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'API key required. Provide via Authorization: Bearer <api-key> header.',
    });
  }

  const keyHash = hashApiKey(apiKey);

  try {
    const apiKeyRecord = await db.query.publicApiKeys.findFirst({
      columns: {
        id: true,
        organizationId: true,
        rateLimit: true,
        isActive: true,
      },
      where: eq(publicApiKeys.keyHash, keyHash),
    });

    if (!apiKeyRecord) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid API key.',
      });
    }

    if (!apiKeyRecord.isActive) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'API key has been revoked.',
      });
    }

    // Attach API key context to request
    (request as PublicApiRequest).apiKey = {
      id: apiKeyRecord.id,
      organizationId: apiKeyRecord.organizationId,
      rateLimit: apiKeyRecord.rateLimit,
    };

    // Update lastUsedAt timestamp (non-blocking, fire-and-forget)
    void db.update(publicApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(publicApiKeys.id, apiKeyRecord.id))
      .catch(() => {
        // Silently fail - don't block request if timestamp update fails
      });
  } catch (error) {
    request.log.error({ error }, 'API key authentication failed');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Authentication service temporarily unavailable.',
    });
  }
}

/**
 * Helper to get organization ID from authenticated request
 */
export function getOrgIdFromApiKey(request: FastifyRequest): string | null {
  const apiRequest = request as PublicApiRequest;
  return apiRequest.apiKey?.organizationId ?? null;
}

/**
 * Helper to get rate limit from authenticated request
 */
export function getRateLimitFromApiKey(request: FastifyRequest): number {
  const apiRequest = request as PublicApiRequest;
  return apiRequest.apiKey?.rateLimit ?? 1000; // Default to 1000 req/min
}
