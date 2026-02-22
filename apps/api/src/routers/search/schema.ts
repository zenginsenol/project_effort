import { z } from 'zod';

export const entityTypeEnum = z.enum(['projects', 'tasks', 'cost_analyses', 'sessions']);

export const searchInput = z.object({
  query: z.string().min(1).max(500),
  entityTypes: z.array(entityTypeEnum).optional(),
  projectId: z.string().uuid().optional(),
  status: z.string().optional(),
  dateRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
  }).optional(),
});

export const searchResultItem = z.object({
  id: z.string().uuid(),
  entityType: entityTypeEnum,
  title: z.string(),
  description: z.string().nullable(),
  projectId: z.string().uuid().optional(),
  projectName: z.string().optional(),
  status: z.string().optional(),
  relevanceScore: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const searchOutput = z.object({
  results: z.array(searchResultItem),
  totalCount: z.number(),
  groupedResults: z.object({
    projects: z.array(searchResultItem),
    tasks: z.array(searchResultItem),
    cost_analyses: z.array(searchResultItem),
    sessions: z.array(searchResultItem),
  }),
});

export const recentSearchInput = z.object({
  organizationId: z.string().uuid(),
});

export const recentSearchOutput = z.object({
  searches: z.array(z.object({
    query: z.string(),
    entityTypes: z.array(entityTypeEnum).optional(),
    timestamp: z.string().datetime(),
  })),
});

export type SearchInput = z.infer<typeof searchInput>;
export type SearchResultItem = z.infer<typeof searchResultItem>;
export type SearchOutput = z.infer<typeof searchOutput>;
export type RecentSearchInput = z.infer<typeof recentSearchInput>;
export type RecentSearchOutput = z.infer<typeof recentSearchOutput>;
export type EntityType = z.infer<typeof entityTypeEnum>;
