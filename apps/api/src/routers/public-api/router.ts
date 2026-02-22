import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';
import { randomBytes, createHmac } from 'node:crypto';

import { db } from '@estimate-pro/db';
import { publicApiKeys } from '@estimate-pro/db/schema';

import { orgProcedure, router } from '../../trpc/trpc';
import { getKeyHint } from '../../services/crypto';
import {
  createPublicApiKeyInput,
  updatePublicApiKeyInput,
  deletePublicApiKeyInput,
  rotatePublicApiKeyInput,
} from './schema';

/**
 * Hash an API key using HMAC-SHA256 for secure storage
 * Uses server-side secret to prevent rainbow table attacks
 */
function hashApiKey(apiKey: string): string {
  const secret = process.env.API_KEY_SECRET || 'estimatepro-api-key-secret-change-in-production-2024';
  return createHmac('sha256', secret)
    .update(apiKey)
    .digest('hex');
}

/**
 * Generate a secure random API key
 * Format: ep_<random_base64_string>
 */
function generateApiKey(): string {
  const randomData = randomBytes(32); // 256 bits of entropy
  const base64 = randomData.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `ep_${base64}`;
}

export const publicApiRouter = router({
  /**
   * List all public API keys for the organization
   * Returns key metadata without raw API keys
   */
  list: orgProcedure.query(async ({ ctx }) => {
    const keys = await db.query.publicApiKeys.findMany({
      columns: {
        id: true,
        name: true,
        keyHint: true,
        rateLimit: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      where: eq(publicApiKeys.organizationId, ctx.organizationId),
      orderBy: (keys, { desc }) => [desc(keys.createdAt)],
    });

    return keys;
  }),

  /**
   * Create a new public API key
   * Returns the raw API key ONCE - it cannot be retrieved later
   */
  create: orgProcedure
    .input(createPublicApiKeyInput)
    .mutation(async ({ ctx, input }) => {
      const rawApiKey = generateApiKey();
      const keyHash = hashApiKey(rawApiKey);
      const keyHintValue = getKeyHint(rawApiKey);

      const [newKey] = await db.insert(publicApiKeys).values({
        organizationId: ctx.organizationId,
        name: input.name,
        keyHash,
        keyHint: keyHintValue,
        rateLimit: input.rateLimit ?? 1000,
        isActive: true,
      }).returning({
        id: publicApiKeys.id,
        name: publicApiKeys.name,
        keyHint: publicApiKeys.keyHint,
        rateLimit: publicApiKeys.rateLimit,
        isActive: publicApiKeys.isActive,
        createdAt: publicApiKeys.createdAt,
      });

      if (!newKey) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create API key',
        });
      }

      return {
        ...newKey,
        apiKey: rawApiKey, // Only returned once during creation
      };
    }),

  /**
   * Update an existing public API key
   * Can update name, rate limit, and active status
   */
  update: orgProcedure
    .input(updatePublicApiKeyInput)
    .mutation(async ({ ctx, input }) => {
      const existingKey = await db.query.publicApiKeys.findFirst({
        columns: { id: true },
        where: and(
          eq(publicApiKeys.id, input.id),
          eq(publicApiKeys.organizationId, ctx.organizationId),
        ),
      });

      if (!existingKey) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'API key not found',
        });
      }

      const updateData: {
        name?: string;
        rateLimit?: number;
        isActive?: boolean;
      } = {};

      if (input.name !== undefined) {
        updateData.name = input.name;
      }
      if (input.rateLimit !== undefined) {
        updateData.rateLimit = input.rateLimit;
      }
      if (input.isActive !== undefined) {
        updateData.isActive = input.isActive;
      }

      const [updatedKey] = await db.update(publicApiKeys)
        .set(updateData)
        .where(eq(publicApiKeys.id, input.id))
        .returning({
          id: publicApiKeys.id,
          name: publicApiKeys.name,
          keyHint: publicApiKeys.keyHint,
          rateLimit: publicApiKeys.rateLimit,
          isActive: publicApiKeys.isActive,
          lastUsedAt: publicApiKeys.lastUsedAt,
          createdAt: publicApiKeys.createdAt,
          updatedAt: publicApiKeys.updatedAt,
        });

      if (!updatedKey) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update API key',
        });
      }

      return updatedKey;
    }),

  /**
   * Delete a public API key
   * This is a hard delete - the key will be permanently removed
   */
  delete: orgProcedure
    .input(deletePublicApiKeyInput)
    .mutation(async ({ ctx, input }) => {
      const existingKey = await db.query.publicApiKeys.findFirst({
        columns: { id: true },
        where: and(
          eq(publicApiKeys.id, input.id),
          eq(publicApiKeys.organizationId, ctx.organizationId),
        ),
      });

      if (!existingKey) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'API key not found',
        });
      }

      await db.delete(publicApiKeys)
        .where(eq(publicApiKeys.id, input.id));

      return { success: true };
    }),

  /**
   * Rotate a public API key
   * Generates a new key and updates the hash while keeping the same ID
   * Returns the new raw API key ONCE
   */
  rotate: orgProcedure
    .input(rotatePublicApiKeyInput)
    .mutation(async ({ ctx, input }) => {
      const existingKey = await db.query.publicApiKeys.findFirst({
        columns: { id: true, name: true },
        where: and(
          eq(publicApiKeys.id, input.id),
          eq(publicApiKeys.organizationId, ctx.organizationId),
        ),
      });

      if (!existingKey) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'API key not found',
        });
      }

      const newRawApiKey = generateApiKey();
      const newKeyHash = hashApiKey(newRawApiKey);
      const newKeyHint = getKeyHint(newRawApiKey);

      const [rotatedKey] = await db.update(publicApiKeys)
        .set({
          keyHash: newKeyHash,
          keyHint: newKeyHint,
        })
        .where(eq(publicApiKeys.id, input.id))
        .returning({
          id: publicApiKeys.id,
          name: publicApiKeys.name,
          keyHint: publicApiKeys.keyHint,
          rateLimit: publicApiKeys.rateLimit,
          isActive: publicApiKeys.isActive,
          createdAt: publicApiKeys.createdAt,
          updatedAt: publicApiKeys.updatedAt,
        });

      if (!rotatedKey) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to rotate API key',
        });
      }

      return {
        ...rotatedKey,
        apiKey: newRawApiKey, // Only returned once during rotation
      };
    }),
});
