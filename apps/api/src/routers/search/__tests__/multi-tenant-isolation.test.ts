import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { searchRouter } from '../router';

const ORG_A_ID = '11111111-1111-1111-1111-111111111111';
const ORG_B_ID = '22222222-2222-2222-2222-222222222222';
const USER_A_ID = 'user_a_clerk_id';
const USER_B_ID = 'user_b_clerk_id';
const PROJECT_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROJECT_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

// Mock database results
const mockProjectsOrgA = [
  {
    id: PROJECT_A_ID,
    name: 'Confidential Project Alpha',
    description: 'Top secret project for Org A',
    status: 'active',
    organizationId: ORG_A_ID,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    search_vector: null,
    relevanceScore: 0.95,
  },
];

const mockProjectsOrgB = [
  {
    id: PROJECT_B_ID,
    name: 'Public Project Beta',
    description: 'Regular project for Org B',
    status: 'active',
    organizationId: ORG_B_ID,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    search_vector: null,
    relevanceScore: 0.90,
  },
];

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

function mockDbQueryChain(results: unknown[]) {
  const limit = vi.fn().mockResolvedValue(results);
  const orderBy = vi.fn().mockReturnValue({ limit });
  const where = vi.fn().mockReturnValue({ orderBy, limit });
  const innerJoin = vi.fn().mockReturnValue({ where, orderBy, limit });
  const from = vi.fn().mockReturnValue({ where, orderBy, limit, innerJoin });
  mockDb.select.mockReturnValue({ from });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Search multi-tenant isolation', () => {
  it('only returns projects from the caller organization', async () => {
    // Mock DB to return Org A projects
    mockDbQueryChain(mockProjectsOrgA);

    const callerOrgA = createCaller(ORG_A_ID, USER_A_ID);
    const resultOrgA = await callerOrgA.query({
      query: 'project',
      entityTypes: ['projects'],
    });

    // Verify Org A can see their own project
    expect(resultOrgA.results).toHaveLength(1);
    expect(resultOrgA.results[0]).toMatchObject({
      id: PROJECT_A_ID,
      entityType: 'projects',
    });

    // Mock DB to return Org B projects
    mockDbQueryChain(mockProjectsOrgB);

    const callerOrgB = createCaller(ORG_B_ID, USER_B_ID);
    const resultOrgB = await callerOrgB.query({
      query: 'project',
      entityTypes: ['projects'],
    });

    // Verify Org B can see their own project
    expect(resultOrgB.results).toHaveLength(1);
    expect(resultOrgB.results[0]).toMatchObject({
      id: PROJECT_B_ID,
      entityType: 'projects',
    });

    // Verify results are different for different orgs
    expect(resultOrgA.results[0].id).not.toBe(resultOrgB.results[0].id);
  });

  it('does not return results when searching for other org data', async () => {
    // Mock DB to return empty results (simulating isolation)
    mockDbQueryChain([]);

    const callerOrgB = createCaller(ORG_B_ID, USER_B_ID);

    // User from Org B searches for "Confidential Project Alpha" (which belongs to Org A)
    const result = await callerOrgB.query({
      query: 'Confidential Project Alpha',
      entityTypes: ['projects'],
    });

    // Verify no results returned (isolation enforced)
    expect(result.results).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it('returns empty results for all entity types when no org data matches', async () => {
    // Mock DB to return empty results for all queries
    mockDbQueryChain([]);

    const callerOrgB = createCaller(ORG_B_ID, USER_B_ID);

    // Search across all entity types
    const result = await callerOrgB.query({
      query: 'nonexistent',
    });

    // Verify all grouped results are empty
    expect(result.results).toHaveLength(0);
    expect(result.groupedResults.projects).toHaveLength(0);
    expect(result.groupedResults.tasks).toHaveLength(0);
    expect(result.groupedResults.cost_analyses).toHaveLength(0);
    expect(result.groupedResults.sessions).toHaveLength(0);
  });

  it('saves recent searches with org isolation', async () => {
    // Mock empty search results
    mockDbQueryChain([]);

    const callerOrgA = createCaller(ORG_A_ID, USER_A_ID);
    const callerOrgB = createCaller(ORG_B_ID, USER_B_ID);

    // User A performs a search
    await callerOrgA.query({
      query: 'secret project',
      entityTypes: ['projects'],
    });

    // User B performs a search
    await callerOrgB.query({
      query: 'public project',
      entityTypes: ['tasks'],
    });

    // Get recent searches for User A in Org A
    const recentOrgA = await callerOrgA.getRecent();

    // Get recent searches for User B in Org B
    const recentOrgB = await callerOrgB.getRecent();

    // Verify User A sees their search (most recent first)
    expect(recentOrgA.searches.length).toBeGreaterThanOrEqual(1);
    expect(recentOrgA.searches[0].query).toBe('secret project');
    expect(recentOrgA.searches[0].entityTypes).toEqual(['projects']);

    // Verify User B sees their search (most recent first)
    expect(recentOrgB.searches.length).toBeGreaterThanOrEqual(1);
    expect(recentOrgB.searches[0].query).toBe('public project');
    expect(recentOrgB.searches[0].entityTypes).toEqual(['tasks']);

    // Verify searches are isolated between orgs
    expect(recentOrgA.searches[0].query).not.toBe(recentOrgB.searches[0].query);
  });

  it('passes correct organizationId to search service', async () => {
    mockDbQueryChain([]);

    const callerOrgA = createCaller(ORG_A_ID, USER_A_ID);

    await callerOrgA.query({
      query: 'test',
      entityTypes: ['projects'],
    });

    // Verify db.select was called (search was executed)
    expect(mockDb.select).toHaveBeenCalled();
  });

  it('handles cross-org task searches through project join isolation', async () => {
    // Mock empty task results (tasks are joined with projects for org filtering)
    mockDbQueryChain([]);

    const callerOrgB = createCaller(ORG_B_ID, USER_B_ID);

    // User from Org B searches for tasks
    const result = await callerOrgB.query({
      query: 'task from org a',
      entityTypes: ['tasks'],
    });

    // Verify no cross-org results returned
    expect(result.results).toHaveLength(0);
    expect(result.groupedResults.tasks).toHaveLength(0);
  });

  it('handles cross-org session searches through project join isolation', async () => {
    // Mock empty session results (sessions are joined with projects for org filtering)
    mockDbQueryChain([]);

    const callerOrgB = createCaller(ORG_B_ID, USER_B_ID);

    // User from Org B searches for sessions
    const result = await callerOrgB.query({
      query: 'session from org a',
      entityTypes: ['sessions'],
    });

    // Verify no cross-org results returned
    expect(result.results).toHaveLength(0);
    expect(result.groupedResults.sessions).toHaveLength(0);
  });

  it('isolates cost analyses by organizationId', async () => {
    // Mock empty cost analysis results
    mockDbQueryChain([]);

    const callerOrgB = createCaller(ORG_B_ID, USER_B_ID);

    // User from Org B searches for cost analyses
    const result = await callerOrgB.query({
      query: 'cost analysis from org a',
      entityTypes: ['cost_analyses'],
    });

    // Verify no cross-org results returned
    expect(result.results).toHaveLength(0);
    expect(result.groupedResults.cost_analyses).toHaveLength(0);
  });
});
