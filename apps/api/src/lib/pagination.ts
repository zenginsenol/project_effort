import { z } from 'zod';

/**
 * Pagination constants following project guidelines:
 * - Default page size: 20 items
 * - Maximum page size: 100 items (prevents excessive DB load)
 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Zod schema for cursor-based pagination input
 *
 * Cursor-based pagination is preferred over offset-based for:
 * - Better performance on large datasets (no OFFSET scan)
 * - Consistent results even when data changes (no missing/duplicate items)
 * - Scalability for real-time data
 */
export const paginationInputSchema = z.object({
  limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  cursor: z.string().optional(),
  direction: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationInput = z.infer<typeof paginationInputSchema>;

/**
 * Generic paginated response type
 *
 * @template T - Type of items in the data array
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

/**
 * Creates a validated pagination input with defaults
 *
 * @param input - Raw pagination input from user
 * @returns Validated pagination input with defaults applied
 *
 * @example
 * ```ts
 * const pagination = createPaginationInput({ limit: 50 });
 * // Returns: { limit: 50, cursor: undefined, direction: 'desc' }
 * ```
 */
export function createPaginationInput(input?: Partial<PaginationInput>): PaginationInput {
  return paginationInputSchema.parse(input ?? {});
}

/**
 * Creates a paginated response object
 *
 * @template T - Type of items in the data array
 * @param data - Array of items for current page
 * @param limit - Page size limit that was requested
 * @returns Paginated response with nextCursor and hasMore flag
 *
 * @example
 * ```ts
 * const items = await db.query.projects.findMany({ limit: limit + 1 });
 * const response = createPaginatedResponse(items, 20);
 * // Returns: { data: items.slice(0, 20), pagination: { nextCursor: ..., hasMore: true, limit: 20 } }
 * ```
 */
export function createPaginatedResponse<T extends { id: string; createdAt: Date }>(
  data: T[],
  limit: number,
): PaginatedResponse<T> {
  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

  return {
    data: items,
    pagination: {
      nextCursor,
      hasMore,
      limit,
    },
  };
}

/**
 * Parses a cursor into createdAt timestamp for date-based pagination
 *
 * For cursor-based pagination using timestamps, the cursor is typically
 * an ISO 8601 date string. This helper safely parses it.
 *
 * @param cursor - ISO 8601 date string or undefined
 * @returns Date object or undefined
 *
 * @example
 * ```ts
 * const cursorDate = parseCursor('2024-01-15T10:30:00.000Z');
 * // Use in query: where(lt(table.createdAt, cursorDate))
 * ```
 */
export function parseCursor(cursor: string | undefined): Date | undefined {
  if (!cursor) return undefined;

  try {
    const date = new Date(cursor);
    if (isNaN(date.getTime())) {
      return undefined;
    }
    return date;
  } catch {
    return undefined;
  }
}

/**
 * Helper type for cursor field selection
 * Supports common cursor fields: id, createdAt, updatedAt
 */
export type CursorField = 'id' | 'createdAt' | 'updatedAt';

/**
 * Creates a cursor string from a record
 *
 * @template T - Type of the record
 * @param record - Database record
 * @param field - Field to use as cursor (default: 'id')
 * @returns Cursor string or null
 */
export function createCursor<T extends Record<string, unknown>>(
  record: T | null | undefined,
  field: CursorField = 'id',
): string | null {
  if (!record) return null;

  const value = record[field];

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return null;
}
