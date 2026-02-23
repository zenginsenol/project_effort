import { and, eq, gte, lte, sql } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { costAnalyses, projects, sessions, tasks } from '@estimate-pro/db/schema';

import type { EntityType, RecentSearchOutput, SearchInput, SearchOutput, SearchResultItem } from './schema';

interface RecentSearch {
  query: string;
  entityTypes?: EntityType[];
  timestamp: string;
}

export class SearchService {
  // In-memory storage for recent searches (TODO: Replace with Redis or PostgreSQL)
  private recentSearchesCache = new Map<string, RecentSearch[]>();
  private readonly MAX_RECENT_SEARCHES = 10;
  /**
   * Search across projects using PostgreSQL full-text search
   */
  private async searchProjects(
    query: string,
    organizationId: string,
    filters: Pick<SearchInput, 'projectId' | 'status' | 'dateRange'>,
  ): Promise<SearchResultItem[]> {
    const tsQuery = this.formatTsQuery(query);
    const conditions = [
      eq(projects.organizationId, organizationId),
      sql`search_vector @@ to_tsquery('english', ${tsQuery})`,
    ];

    if (filters.status) {
      conditions.push(sql`status = ${filters.status}`);
    }

    if (filters.dateRange?.start) {
      conditions.push(gte(projects.createdAt, new Date(filters.dateRange.start)));
    }

    if (filters.dateRange?.end) {
      conditions.push(lte(projects.createdAt, new Date(filters.dateRange.end)));
    }

    const results = await db
      .select({
        id: projects.id,
        title: projects.name,
        description: projects.description,
        status: projects.status,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        relevanceScore: sql<number>`ts_rank(search_vector, to_tsquery('english', ${tsQuery}))`,
      })
      .from(projects)
      .where(and(...conditions))
      .orderBy(sql`ts_rank(search_vector, to_tsquery('english', ${tsQuery})) DESC`)
      .limit(50);

    return results.map((result) => ({
      id: result.id,
      entityType: 'projects' as EntityType,
      title: result.title,
      description: result.description,
      status: result.status,
      relevanceScore: result.relevanceScore,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    }));
  }

  /**
   * Search across tasks using PostgreSQL full-text search
   */
  private async searchTasks(
    query: string,
    organizationId: string,
    filters: Pick<SearchInput, 'projectId' | 'status' | 'dateRange'>,
  ): Promise<SearchResultItem[]> {
    const tsQuery = this.formatTsQuery(query);
    const conditions = [
      sql`tasks.search_vector @@ to_tsquery('english', ${tsQuery})`,
    ];

    if (filters.projectId) {
      conditions.push(eq(tasks.projectId, filters.projectId));
    }

    if (filters.status) {
      conditions.push(sql`tasks.status = ${filters.status}`);
    }

    if (filters.dateRange?.start) {
      conditions.push(gte(tasks.createdAt, new Date(filters.dateRange.start)));
    }

    if (filters.dateRange?.end) {
      conditions.push(lte(tasks.createdAt, new Date(filters.dateRange.end)));
    }

    const results = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        projectId: tasks.projectId,
        projectName: projects.name,
        status: tasks.status,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        relevanceScore: sql<number>`ts_rank(tasks.search_vector, to_tsquery('english', ${tsQuery}))`,
      })
      .from(tasks)
      .innerJoin(projects, and(
        eq(tasks.projectId, projects.id),
        eq(projects.organizationId, organizationId),
      ))
      .where(and(...conditions))
      .orderBy(sql`ts_rank(tasks.search_vector, to_tsquery('english', ${tsQuery})) DESC`)
      .limit(50);

    return results.map((result) => ({
      id: result.id,
      entityType: 'tasks' as EntityType,
      title: result.title,
      description: result.description,
      projectId: result.projectId,
      projectName: result.projectName,
      status: result.status,
      relevanceScore: result.relevanceScore,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    }));
  }

  /**
   * Search across cost analyses using PostgreSQL full-text search
   */
  private async searchCostAnalyses(
    query: string,
    organizationId: string,
    filters: Pick<SearchInput, 'projectId' | 'status' | 'dateRange'>,
  ): Promise<SearchResultItem[]> {
    const tsQuery = this.formatTsQuery(query);
    const conditions = [
      eq(costAnalyses.organizationId, organizationId),
      sql`cost_analyses.search_vector @@ to_tsquery('english', ${tsQuery})`,
    ];

    if (filters.projectId) {
      conditions.push(eq(costAnalyses.projectId, filters.projectId));
    }

    if (filters.dateRange?.start) {
      conditions.push(gte(costAnalyses.createdAt, new Date(filters.dateRange.start)));
    }

    if (filters.dateRange?.end) {
      conditions.push(lte(costAnalyses.createdAt, new Date(filters.dateRange.end)));
    }

    const results = await db
      .select({
        id: costAnalyses.id,
        title: costAnalyses.name,
        description: costAnalyses.description,
        projectId: costAnalyses.projectId,
        projectName: projects.name,
        createdAt: costAnalyses.createdAt,
        updatedAt: costAnalyses.updatedAt,
        relevanceScore: sql<number>`ts_rank(cost_analyses.search_vector, to_tsquery('english', ${tsQuery}))`,
      })
      .from(costAnalyses)
      .innerJoin(projects, eq(costAnalyses.projectId, projects.id))
      .where(and(...conditions))
      .orderBy(sql`ts_rank(cost_analyses.search_vector, to_tsquery('english', ${tsQuery})) DESC`)
      .limit(50);

    return results.map((result) => ({
      id: result.id,
      entityType: 'cost_analyses' as EntityType,
      title: result.title,
      description: result.description,
      projectId: result.projectId,
      projectName: result.projectName,
      status: undefined,
      relevanceScore: result.relevanceScore,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    }));
  }

  /**
   * Search across estimation sessions using PostgreSQL full-text search
   */
  private async searchSessions(
    query: string,
    organizationId: string,
    filters: Pick<SearchInput, 'projectId' | 'status' | 'dateRange'>,
  ): Promise<SearchResultItem[]> {
    const tsQuery = this.formatTsQuery(query);
    const conditions = [
      sql`sessions.search_vector @@ to_tsquery('english', ${tsQuery})`,
    ];

    if (filters.projectId) {
      conditions.push(eq(sessions.projectId, filters.projectId));
    }

    if (filters.status) {
      conditions.push(sql`sessions.status = ${filters.status}`);
    }

    if (filters.dateRange?.start) {
      conditions.push(gte(sessions.createdAt, new Date(filters.dateRange.start)));
    }

    if (filters.dateRange?.end) {
      conditions.push(lte(sessions.createdAt, new Date(filters.dateRange.end)));
    }

    const results = await db
      .select({
        id: sessions.id,
        title: sessions.name,
        projectId: sessions.projectId,
        projectName: projects.name,
        status: sessions.status,
        createdAt: sessions.createdAt,
        updatedAt: sessions.updatedAt,
        relevanceScore: sql<number>`ts_rank(sessions.search_vector, to_tsquery('english', ${tsQuery}))`,
      })
      .from(sessions)
      .innerJoin(projects, and(
        eq(sessions.projectId, projects.id),
        eq(projects.organizationId, organizationId),
      ))
      .where(and(...conditions))
      .orderBy(sql`ts_rank(sessions.search_vector, to_tsquery('english', ${tsQuery})) DESC`)
      .limit(50);

    return results.map((result) => ({
      id: result.id,
      entityType: 'sessions' as EntityType,
      title: result.title,
      description: null,
      projectId: result.projectId,
      projectName: result.projectName,
      status: result.status,
      relevanceScore: result.relevanceScore,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    }));
  }

  /**
   * Format query string for PostgreSQL tsquery
   * Converts user input to valid tsquery format with prefix matching
   */
  private formatTsQuery(query: string): string {
    // Split query into words, filter empty strings, and append :* for prefix matching
    const words = query
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .map((word) => `${word.replace(/[^\w]/g, '')}:*`)
      .filter((word) => word.length > 2); // Filter out single character with :*

    // Join with & (AND operator) for all words must match
    return words.join(' & ') || 'empty:*';
  }

  /**
   * Main search method that searches across all entity types
   */
  async search(input: SearchInput, organizationId: string, userId: string): Promise<SearchOutput> {
    const { query, entityTypes, projectId, status, dateRange } = input;
    const filters = { projectId, status, dateRange };

    // Determine which entity types to search
    const searchEntityTypes: EntityType[] = entityTypes && entityTypes.length > 0
      ? entityTypes
      : ['projects', 'tasks', 'cost_analyses', 'sessions'];

    // Execute searches in parallel for all requested entity types
    const [projectResults, taskResults, costAnalysisResults, sessionResults] = await Promise.all([
      searchEntityTypes.includes('projects')
        ? this.searchProjects(query, organizationId, filters)
        : Promise.resolve([]),
      searchEntityTypes.includes('tasks')
        ? this.searchTasks(query, organizationId, filters)
        : Promise.resolve([]),
      searchEntityTypes.includes('cost_analyses')
        ? this.searchCostAnalyses(query, organizationId, filters)
        : Promise.resolve([]),
      searchEntityTypes.includes('sessions')
        ? this.searchSessions(query, organizationId, filters)
        : Promise.resolve([]),
    ]);

    // Combine and sort all results by relevance score
    const allResults = [
      ...projectResults,
      ...taskResults,
      ...costAnalysisResults,
      ...sessionResults,
    ].sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Save this search to recent searches
    this.saveSearch(userId, organizationId, query, entityTypes);

    return {
      results: allResults,
      totalCount: allResults.length,
      groupedResults: {
        projects: projectResults,
        tasks: taskResults,
        cost_analyses: costAnalysisResults,
        sessions: sessionResults,
      },
    };
  }

  /**
   * Save a search to recent searches for a user
   */
  private saveSearch(
    userId: string,
    organizationId: string,
    query: string,
    entityTypes?: EntityType[],
  ): void {
    const cacheKey = `${userId}_${organizationId}`;
    const recentSearch: RecentSearch = {
      query,
      entityTypes,
      timestamp: new Date().toISOString(),
    };

    // Get existing searches for this user+org
    const existingSearches = this.recentSearchesCache.get(cacheKey) || [];

    // Remove duplicate searches with same query and entityTypes
    const filteredSearches = existingSearches.filter((search) => {
      if (search.query !== query) return true;
      // Check if entityTypes are the same
      const existingTypes = search.entityTypes?.sort().join(',') || '';
      const newTypes = entityTypes?.sort().join(',') || '';
      return existingTypes !== newTypes;
    });

    // Add new search at the beginning
    const updatedSearches = [recentSearch, ...filteredSearches];

    // Keep only the last MAX_RECENT_SEARCHES
    const trimmedSearches = updatedSearches.slice(0, this.MAX_RECENT_SEARCHES);

    // Save back to cache
    this.recentSearchesCache.set(cacheKey, trimmedSearches);
  }

  /**
   * Get recent searches for a user within an organization
   */
  getRecentSearches(userId: string, organizationId: string): RecentSearchOutput {
    const cacheKey = `${userId}_${organizationId}`;
    const searches = this.recentSearchesCache.get(cacheKey) || [];

    return {
      searches,
    };
  }
}

export const searchService = new SearchService();
