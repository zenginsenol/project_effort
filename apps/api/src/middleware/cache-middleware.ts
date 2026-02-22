import type { ProcedureType } from '@trpc/server';
import { redis } from '../lib/cache';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds (default: 300 = 5 minutes)
  keyPrefix?: string; // Prefix for cache keys (default: 'trpc')
  tags?: string[]; // Tags for cache invalidation
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  tags?: string[];
}

const DEFAULT_TTL = 300; // 5 minutes
const DEFAULT_KEY_PREFIX = 'trpc';

/**
 * Generates a cache key from procedure path and input parameters
 */
function generateCacheKey(path: string, input: unknown, prefix: string): string {
  const inputHash = input ? JSON.stringify(input) : 'no-input';
  return `${prefix}:${path}:${inputHash}`;
}

/**
 * Validates if a cached entry is still valid based on TTL
 */
function isEntryValid<T>(entry: CacheEntry<T>, ttl: number): boolean {
  const now = Date.now();
  const age = (now - entry.timestamp) / 1000; // Convert to seconds
  return age < ttl;
}

/**
 * Cache helper functions for manual cache operations
 */
export const cacheHelpers = {
  /**
   * Get cached value by key
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redis.get(key);
      if (!cached) return null;

      const entry: CacheEntry<T> = JSON.parse(cached);
      return entry.data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },

  /**
   * Set cache value with TTL
   */
  async set<T>(key: string, value: T, ttl: number = DEFAULT_TTL, tags?: string[]): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data: value,
        timestamp: Date.now(),
        tags,
      };
      await redis.setex(key, ttl, JSON.stringify(entry));

      // Store tag associations for invalidation
      if (tags && tags.length > 0) {
        for (const tag of tags) {
          const tagKey = `${DEFAULT_KEY_PREFIX}:tag:${tag}`;
          await redis.sadd(tagKey, key);
          await redis.expire(tagKey, ttl);
        }
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  },

  /**
   * Delete cached value by key
   */
  async delete(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  },

  /**
   * Delete all cached values matching a pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache delete pattern error:', error);
    }
  },

  /**
   * Invalidate cache by tag
   */
  async invalidateByTag(tag: string): Promise<void> {
    try {
      const tagKey = `${DEFAULT_KEY_PREFIX}:tag:${tag}`;
      const keys = await redis.smembers(tagKey);

      if (keys.length > 0) {
        await redis.del(...keys);
      }

      await redis.del(tagKey);
    } catch (error) {
      console.error('Cache invalidate by tag error:', error);
    }
  },

  /**
   * Clear all cache entries with the default prefix
   */
  async clearAll(): Promise<void> {
    try {
      await this.deletePattern(`${DEFAULT_KEY_PREFIX}:*`);
    } catch (error) {
      console.error('Cache clear all error:', error);
    }
  },
};

/**
 * Cache wrapper function for tRPC procedures
 *
 * Usage:
 * ```typescript
 * const cachedResult = await withCache({
 *   key: 'project:list',
 *   input: { organizationId: '123' },
 *   ttl: 300,
 *   tags: ['projects', 'org:123'],
 *   fn: async () => {
 *     return await projectService.list(organizationId);
 *   }
 * });
 * ```
 */
export async function withCache<T>(options: {
  key: string;
  input?: unknown;
  fn: () => Promise<T>;
  ttl?: number;
  tags?: string[];
  keyPrefix?: string;
}): Promise<T> {
  const { key, input, fn, ttl = DEFAULT_TTL, tags, keyPrefix = DEFAULT_KEY_PREFIX } = options;

  const cacheKey = generateCacheKey(key, input, keyPrefix);

  try {
    // Try to get from cache
    const cached = await redis.get(cacheKey);

    if (cached) {
      const entry: CacheEntry<T> = JSON.parse(cached);

      // Validate entry age
      if (isEntryValid(entry, ttl)) {
        return entry.data;
      }

      // Entry expired, delete it
      await redis.del(cacheKey);
    }
  } catch (error) {
    console.error('Cache read error:', error);
    // Continue to execute function on cache error
  }

  // Execute function and cache result
  const result = await fn();

  try {
    await cacheHelpers.set(cacheKey, result, ttl, tags);
  } catch (error) {
    console.error('Cache write error:', error);
    // Don't fail the request on cache error
  }

  return result;
}

/**
 * Create a cached version of a tRPC procedure
 * This is useful for applying caching to entire procedures
 */
export function createCachedProcedure<TInput = unknown, TOutput = unknown>(
  procedurePath: string,
  procedureFn: (input: TInput) => Promise<TOutput>,
  options?: CacheOptions,
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput): Promise<TOutput> => {
    return withCache({
      key: procedurePath,
      input,
      fn: () => procedureFn(input),
      ttl: options?.ttl,
      tags: options?.tags,
      keyPrefix: options?.keyPrefix,
    });
  };
}

/**
 * Utility to build cache tags from context
 */
export function buildCacheTags(params: {
  orgId?: string | null;
  userId?: string | null;
  resourceType?: string;
  resourceId?: string;
}): string[] {
  const tags: string[] = [];

  if (params.orgId) {
    tags.push(`org:${params.orgId}`);
  }

  if (params.userId) {
    tags.push(`user:${params.userId}`);
  }

  if (params.resourceType) {
    tags.push(`resource:${params.resourceType}`);
  }

  if (params.resourceId && params.resourceType) {
    tags.push(`${params.resourceType}:${params.resourceId}`);
  }

  return tags;
}
