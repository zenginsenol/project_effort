import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { searchRouter } from '../router';
import type { EntityType } from '../schema';

const ORG_A_ID = '11111111-1111-1111-1111-111111111111';
const ORG_B_ID = '22222222-2222-2222-2222-222222222222';
const USER_A_ID = 'user_a_clerk_id';
const USER_B_ID = 'user_b_clerk_id';

// Hoisted mocks
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
  },
}));

// Mock database module
vi.mock('@estimate-pro/db', () => ({
  db: mockDb,
}));

// Mock schema exports
vi.mock('@estimate-pro/db/schema', () => ({
  projects: {
    id: 'id',
    name: 'name',
    description: 'description',
    status: 'status',
    organizationId: 'organizationId',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
  tasks: {
    id: 'id',
    title: 'title',
    description: 'description',
    projectId: 'projectId',
    status: 'status',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
  costAnalyses: {
    id: 'id',
    name: 'name',
    description: 'description',
    projectId: 'projectId',
    organizationId: 'organizationId',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
  sessions: {
    id: 'id',
    name: 'name',
    projectId: 'projectId',
    status: 'status',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}));

function createCaller(orgId: string, userId: string) {
  return searchRouter.createCaller({
    req: {} as never,
    res: {} as never,
    userId,
    orgId,
  });
}

describe('Recent Searches Persistence', () => {
  beforeEach(() => {
    // Setup mock for database queries to return empty results
    const mockChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    mockDb.select.mockReturnValue(mockChain);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('saveSearch functionality', () => {
    it('should save a search after executing query', async () => {
      const caller = createCaller(ORG_A_ID, USER_A_ID);

      // Perform a search
      await caller.query({ query: 'test search' });

      // Get recent searches
      const recentSearches = await caller.getRecent();

      // Verify search was saved
      expect(recentSearches.searches).toHaveLength(1);
      expect(recentSearches.searches[0].query).toBe('test search');
      expect(recentSearches.searches[0].timestamp).toBeDefined();
    });

    it('should save multiple searches in order (most recent first)', async () => {
      const caller = createCaller(ORG_A_ID, USER_A_ID);

      // Perform 5 searches
      await caller.query({ query: 'first search' });
      await caller.query({ query: 'second search' });
      await caller.query({ query: 'third search' });
      await caller.query({ query: 'fourth search' });
      await caller.query({ query: 'fifth search' });

      // Get recent searches
      const recentSearches = await caller.getRecent();

      // Verify all searches were saved in correct order
      expect(recentSearches.searches).toHaveLength(5);
      expect(recentSearches.searches[0].query).toBe('fifth search');
      expect(recentSearches.searches[1].query).toBe('fourth search');
      expect(recentSearches.searches[2].query).toBe('third search');
      expect(recentSearches.searches[3].query).toBe('second search');
      expect(recentSearches.searches[4].query).toBe('first search');
    });

    it('should deduplicate searches with same query', async () => {
      const caller = createCaller(ORG_A_ID, USER_A_ID);

      // Perform same search multiple times
      await caller.query({ query: 'duplicate search' });
      await caller.query({ query: 'unique search' });
      await caller.query({ query: 'duplicate search' });

      // Get recent searches
      const recentSearches = await caller.getRecent();

      // Verify only unique searches are saved (most recent first)
      expect(recentSearches.searches).toHaveLength(2);
      expect(recentSearches.searches[0].query).toBe('duplicate search');
      expect(recentSearches.searches[1].query).toBe('unique search');
    });

    it('should limit to maximum 10 recent searches', async () => {
      const caller = createCaller(ORG_A_ID, USER_A_ID);

      // Perform 15 searches
      for (let i = 1; i <= 15; i++) {
        await caller.query({ query: `search ${i}` });
      }

      // Get recent searches
      const recentSearches = await caller.getRecent();

      // Verify only last 10 searches are saved
      expect(recentSearches.searches).toHaveLength(10);
      expect(recentSearches.searches[0].query).toBe('search 15');
      expect(recentSearches.searches[9].query).toBe('search 6');
    });

    it('should save entity type filters with the search', async () => {
      const caller = createCaller(ORG_A_ID, USER_A_ID);

      const entityTypes: EntityType[] = ['projects', 'tasks'];

      // Perform search with filters
      await caller.query({ query: 'filtered search', entityTypes });

      // Get recent searches
      const recentSearches = await caller.getRecent();

      // Verify entity types were saved
      expect(recentSearches.searches).toHaveLength(1);
      expect(recentSearches.searches[0].query).toBe('filtered search');
      expect(recentSearches.searches[0].entityTypes).toEqual(['projects', 'tasks']);
    });

    it('should treat same query with different entity types as different searches', async () => {
      const caller = createCaller(ORG_A_ID, USER_A_ID);

      // Perform same query with different filters
      await caller.query({ query: 'same query', entityTypes: ['projects'] });
      await caller.query({ query: 'same query', entityTypes: ['tasks'] });
      await caller.query({ query: 'same query' }); // No filters

      // Get recent searches
      const recentSearches = await caller.getRecent();

      // Verify all three searches are saved
      expect(recentSearches.searches).toHaveLength(3);
      expect(recentSearches.searches[0].query).toBe('same query');
      expect(recentSearches.searches[0].entityTypes).toBeUndefined();
      expect(recentSearches.searches[1].query).toBe('same query');
      expect(recentSearches.searches[1].entityTypes).toEqual(['tasks']);
      expect(recentSearches.searches[2].query).toBe('same query');
      expect(recentSearches.searches[2].entityTypes).toEqual(['projects']);
    });
  });

  describe('multi-tenant isolation', () => {
    it('should isolate recent searches between users in same organization', async () => {
      const callerUserA = createCaller(ORG_A_ID, USER_A_ID);
      const callerUserB = createCaller(ORG_A_ID, USER_B_ID);

      // User A performs searches
      await callerUserA.query({ query: 'user a search 1' });
      await callerUserA.query({ query: 'user a search 2' });

      // User B performs searches
      await callerUserB.query({ query: 'user b search 1' });
      await callerUserB.query({ query: 'user b search 2' });

      // Get recent searches for each user
      const recentSearchesUserA = await callerUserA.getRecent();
      const recentSearchesUserB = await callerUserB.getRecent();

      // Verify each user only sees their own searches
      expect(recentSearchesUserA.searches).toHaveLength(2);
      expect(recentSearchesUserA.searches[0].query).toBe('user a search 2');
      expect(recentSearchesUserA.searches[1].query).toBe('user a search 1');

      expect(recentSearchesUserB.searches).toHaveLength(2);
      expect(recentSearchesUserB.searches[0].query).toBe('user b search 2');
      expect(recentSearchesUserB.searches[1].query).toBe('user b search 1');
    });

    it('should isolate recent searches between users in different organizations', async () => {
      const callerOrgA = createCaller(ORG_A_ID, USER_A_ID);
      const callerOrgB = createCaller(ORG_B_ID, USER_B_ID);

      // User A in Org A performs searches
      await callerOrgA.query({ query: 'org a search' });

      // User B in Org B performs searches
      await callerOrgB.query({ query: 'org b search' });

      // Get recent searches for each user
      const recentSearchesOrgA = await callerOrgA.getRecent();
      const recentSearchesOrgB = await callerOrgB.getRecent();

      // Verify complete isolation
      expect(recentSearchesOrgA.searches).toHaveLength(1);
      expect(recentSearchesOrgA.searches[0].query).toBe('org a search');

      expect(recentSearchesOrgB.searches).toHaveLength(1);
      expect(recentSearchesOrgB.searches[0].query).toBe('org b search');
    });

    it('should isolate recent searches for same user in different organizations', async () => {
      const callerOrgA = createCaller(ORG_A_ID, USER_A_ID);
      const callerOrgB = createCaller(ORG_B_ID, USER_A_ID);

      // Same user in Org A performs searches
      await callerOrgA.query({ query: 'search in org a' });
      await callerOrgA.query({ query: 'another search in org a' });

      // Same user in Org B performs searches
      await callerOrgB.query({ query: 'search in org b' });

      // Get recent searches for each context
      const recentSearchesOrgA = await callerOrgA.getRecent();
      const recentSearchesOrgB = await callerOrgB.getRecent();

      // Verify searches are isolated by organization even for same user
      expect(recentSearchesOrgA.searches).toHaveLength(2);
      expect(recentSearchesOrgA.searches[0].query).toBe('another search in org a');
      expect(recentSearchesOrgA.searches[1].query).toBe('search in org a');

      expect(recentSearchesOrgB.searches).toHaveLength(1);
      expect(recentSearchesOrgB.searches[0].query).toBe('search in org b');
    });
  });

  describe('getRecent functionality', () => {
    it('should return empty array when no searches have been performed', async () => {
      const caller = createCaller(ORG_A_ID, USER_A_ID);

      // Get recent searches without performing any
      const recentSearches = await caller.getRecent();

      // Verify empty array
      expect(recentSearches.searches).toHaveLength(0);
      expect(recentSearches.searches).toEqual([]);
    });

    it('should return searches with all required fields', async () => {
      const caller = createCaller(ORG_A_ID, USER_A_ID);

      // Perform a search with filters
      await caller.query({ query: 'detailed search', entityTypes: ['projects', 'tasks'] });

      // Get recent searches
      const recentSearches = await caller.getRecent();

      // Verify all required fields are present
      expect(recentSearches.searches).toHaveLength(1);
      const search = recentSearches.searches[0];
      expect(search).toHaveProperty('query');
      expect(search).toHaveProperty('entityTypes');
      expect(search).toHaveProperty('timestamp');
      expect(search.query).toBe('detailed search');
      expect(search.entityTypes).toEqual(['projects', 'tasks']);
      expect(typeof search.timestamp).toBe('string');
      expect(new Date(search.timestamp).toString()).not.toBe('Invalid Date');
    });
  });

  describe('persistence across sessions', () => {
    it('should persist searches when creating new caller instances', async () => {
      // First session - create caller and perform searches
      const caller1 = createCaller(ORG_A_ID, USER_A_ID);
      await caller1.query({ query: 'persistent search 1' });
      await caller1.query({ query: 'persistent search 2' });

      // Second session - create new caller for same user+org
      const caller2 = createCaller(ORG_A_ID, USER_A_ID);

      // Get recent searches from new caller
      const recentSearches = await caller2.getRecent();

      // Verify searches persisted across sessions
      expect(recentSearches.searches).toHaveLength(2);
      expect(recentSearches.searches[0].query).toBe('persistent search 2');
      expect(recentSearches.searches[1].query).toBe('persistent search 1');
    });

    it('should maintain search order across multiple sessions', async () => {
      // Session 1
      const caller1 = createCaller(ORG_A_ID, USER_A_ID);
      await caller1.query({ query: 'search 1' });
      await caller1.query({ query: 'search 2' });

      // Session 2
      const caller2 = createCaller(ORG_A_ID, USER_A_ID);
      await caller2.query({ query: 'search 3' });

      // Session 3
      const caller3 = createCaller(ORG_A_ID, USER_A_ID);
      const recentSearches = await caller3.getRecent();

      // Verify correct order (most recent first)
      expect(recentSearches.searches).toHaveLength(3);
      expect(recentSearches.searches[0].query).toBe('search 3');
      expect(recentSearches.searches[1].query).toBe('search 2');
      expect(recentSearches.searches[2].query).toBe('search 1');
    });
  });
});
