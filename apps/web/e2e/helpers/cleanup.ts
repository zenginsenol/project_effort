import type { Page, APIRequestContext } from '@playwright/test';

/**
 * Cleanup utilities for E2E test data teardown
 *
 * These helpers provide automated cleanup of test data created during E2E tests.
 * Use in test.afterEach() or test.afterAll() to ensure a clean slate between tests
 * and prevent test data accumulation.
 *
 * All cleanup functions are idempotent and safe to call multiple times.
 */

export interface CleanupOptions {
  /**
   * Organization ID to filter cleanup operations (optional)
   * If not provided, cleanup operations will use the current user's organization
   */
  organizationId?: string;

  /**
   * If true, cleanup will only delete items created in the last hour
   * This prevents accidental deletion of production-like data
   */
  recentOnly?: boolean;
}

export interface DeleteProjectsOptions extends CleanupOptions {
  /**
   * Project IDs to delete (optional)
   * If not provided, all test projects will be deleted
   */
  projectIds?: string[];

  /**
   * Name pattern to match for deletion (optional)
   * Only deletes projects matching this pattern (e.g., "Test Project")
   */
  namePattern?: string;
}

export interface DeleteTasksOptions extends CleanupOptions {
  /**
   * Task IDs to delete (optional)
   */
  taskIds?: string[];

  /**
   * Project ID to scope deletion (optional)
   * Only deletes tasks belonging to this project
   */
  projectId?: string;
}

export interface DeleteSessionsOptions extends CleanupOptions {
  /**
   * Session IDs to delete (optional)
   */
  sessionIds?: string[];

  /**
   * Project ID to scope deletion (optional)
   * Only deletes sessions belonging to this project
   */
  projectId?: string;
}

/**
 * Delete test projects and their associated data (cascades to tasks, sessions, etc.)
 *
 * @param request - Playwright request context
 * @param options - Deletion options
 * @returns Promise that resolves to the count of deleted projects
 *
 * @example
 * ```ts
 * test.afterEach(async ({ request }) => {
 *   await deleteTestProjects(request, {
 *     namePattern: 'Test Project'
 *   });
 * });
 * ```
 */
export async function deleteTestProjects(
  request: APIRequestContext,
  options: DeleteProjectsOptions = {}
): Promise<number> {
  // Demo mode: Simulate deletion by returning count
  // TODO: When API endpoints are available, implement actual deletion:
  // 1. Call tRPC procedure or REST endpoint to delete projects
  // 2. Filter by namePattern if provided
  // 3. Filter by projectIds if provided
  // 4. Return actual count of deleted projects
  //
  // Example implementation:
  // const response = await request.delete('/api/trpc/projects.deleteMany', {
  //   data: {
  //     projectIds: options.projectIds,
  //     namePattern: options.namePattern,
  //     organizationId: options.organizationId
  //   }
  // });
  // const result = await response.json();
  // return result.count;

  return 0;
}

/**
 * Delete test tasks
 *
 * @param request - Playwright request context
 * @param options - Deletion options
 * @returns Promise that resolves to the count of deleted tasks
 *
 * @example
 * ```ts
 * test.afterEach(async ({ request }) => {
 *   await deleteTestTasks(request, {
 *     projectId: testProject.id
 *   });
 * });
 * ```
 */
export async function deleteTestTasks(
  request: APIRequestContext,
  options: DeleteTasksOptions = {}
): Promise<number> {
  // Demo mode: Simulate deletion by returning count
  // TODO: When API endpoints are available, implement actual deletion:
  // 1. Call tRPC procedure or REST endpoint to delete tasks
  // 2. Filter by taskIds or projectId if provided
  // 3. Return actual count of deleted tasks
  //
  // Example implementation:
  // const response = await request.delete('/api/trpc/tasks.deleteMany', {
  //   data: {
  //     taskIds: options.taskIds,
  //     projectId: options.projectId,
  //     organizationId: options.organizationId
  //   }
  // });
  // const result = await response.json();
  // return result.count;

  return 0;
}

/**
 * Delete test estimation sessions
 *
 * @param request - Playwright request context
 * @param options - Deletion options
 * @returns Promise that resolves to the count of deleted sessions
 *
 * @example
 * ```ts
 * test.afterEach(async ({ request }) => {
 *   await deleteTestSessions(request, {
 *     projectId: testProject.id
 *   });
 * });
 * ```
 */
export async function deleteTestSessions(
  request: APIRequestContext,
  options: DeleteSessionsOptions = {}
): Promise<number> {
  // Demo mode: Simulate deletion by returning count
  // TODO: When API endpoints are available, implement actual deletion:
  // 1. Call tRPC procedure or REST endpoint to delete sessions
  // 2. Also delete associated session_participants and session_votes (should cascade)
  // 3. Filter by sessionIds or projectId if provided
  // 4. Return actual count of deleted sessions
  //
  // Example implementation:
  // const response = await request.delete('/api/trpc/sessions.deleteMany', {
  //   data: {
  //     sessionIds: options.sessionIds,
  //     projectId: options.projectId,
  //     organizationId: options.organizationId
  //   }
  // });
  // const result = await response.json();
  // return result.count;

  return 0;
}

/**
 * Delete test documents and analysis results
 *
 * @param request - Playwright request context
 * @param options - Deletion options
 * @returns Promise that resolves to the count of deleted documents
 *
 * @example
 * ```ts
 * test.afterEach(async ({ request }) => {
 *   await deleteTestDocuments(request);
 * });
 * ```
 */
export async function deleteTestDocuments(
  request: APIRequestContext,
  options: CleanupOptions = {}
): Promise<number> {
  // Demo mode: Simulate deletion by returning count
  // TODO: When API endpoints are available, implement actual deletion:
  // 1. Call tRPC procedure or REST endpoint to delete documents
  // 2. Also delete associated analysis results and embeddings
  // 3. Return actual count of deleted documents

  return 0;
}

/**
 * Delete test cost analyses
 *
 * @param request - Playwright request context
 * @param options - Deletion options
 * @returns Promise that resolves to the count of deleted cost analyses
 *
 * @example
 * ```ts
 * test.afterEach(async ({ request }) => {
 *   await deleteTestCostAnalyses(request);
 * });
 * ```
 */
export async function deleteTestCostAnalyses(
  request: APIRequestContext,
  options: CleanupOptions = {}
): Promise<number> {
  // Demo mode: Simulate deletion by returning count
  // TODO: When API endpoints are available, implement actual deletion:
  // 1. Call tRPC procedure or REST endpoint to delete cost analyses
  // 2. Return actual count of deleted cost analyses

  return 0;
}

/**
 * Comprehensive cleanup of all test data
 *
 * Deletes projects (which cascades to tasks and sessions), documents, and cost analyses.
 * This is the recommended cleanup function to use in test.afterAll() to ensure
 * complete test data removal.
 *
 * @param request - Playwright request context
 * @param options - Cleanup options
 * @returns Promise that resolves to summary of deleted items
 *
 * @example
 * ```ts
 * test.afterAll(async ({ request }) => {
 *   const summary = await cleanupTestData(request, {
 *     recentOnly: true
 *   });
 *   console.log(`Cleaned up ${summary.totalDeleted} items`);
 * });
 * ```
 */
export async function cleanupTestData(
  request: APIRequestContext,
  options: CleanupOptions = {}
): Promise<{
  projects: number;
  tasks: number;
  sessions: number;
  documents: number;
  costAnalyses: number;
  totalDeleted: number;
}> {
  // Delete in proper order to respect foreign key constraints
  // (though cascade deletes should handle most of this automatically)

  // Delete projects first (cascades to tasks and sessions due to ON DELETE CASCADE)
  const projects = await deleteTestProjects(request, {
    ...options,
    namePattern: 'Test Project', // Only delete projects with "Test Project" in name
  });

  // Additional cleanup for orphaned data (shouldn't be needed with proper cascade)
  const tasks = await deleteTestTasks(request, options);
  const sessions = await deleteTestSessions(request, options);

  // Delete other test data
  const documents = await deleteTestDocuments(request, options);
  const costAnalyses = await deleteTestCostAnalyses(request, options);

  const totalDeleted = projects + tasks + sessions + documents + costAnalyses;

  return {
    projects,
    tasks,
    sessions,
    documents,
    costAnalyses,
    totalDeleted,
  };
}

/**
 * Cleanup helper to use with Page context (extracts request context)
 *
 * @param page - Playwright page object
 * @param options - Cleanup options
 * @returns Promise that resolves to cleanup summary
 *
 * @example
 * ```ts
 * test.afterEach(async ({ page }) => {
 *   await cleanupPageTestData(page);
 * });
 * ```
 */
export async function cleanupPageTestData(
  page: Page,
  options: CleanupOptions = {}
): Promise<ReturnType<typeof cleanupTestData>> {
  // Extract request context from page
  const request = page.context().request;
  return cleanupTestData(request, options);
}

/**
 * Delete specific projects by ID
 *
 * @param request - Playwright request context
 * @param projectIds - Array of project IDs to delete
 * @returns Promise that resolves to the count of deleted projects
 *
 * @example
 * ```ts
 * const createdProjects = ['id1', 'id2', 'id3'];
 * test.afterEach(async ({ request }) => {
 *   await deleteProjectsByIds(request, createdProjects);
 * });
 * ```
 */
export async function deleteProjectsByIds(
  request: APIRequestContext,
  projectIds: string[]
): Promise<number> {
  return deleteTestProjects(request, { projectIds });
}

/**
 * Delete specific tasks by ID
 *
 * @param request - Playwright request context
 * @param taskIds - Array of task IDs to delete
 * @returns Promise that resolves to the count of deleted tasks
 *
 * @example
 * ```ts
 * const createdTasks = ['id1', 'id2', 'id3'];
 * test.afterEach(async ({ request }) => {
 *   await deleteTasksByIds(request, createdTasks);
 * });
 * ```
 */
export async function deleteTasksByIds(
  request: APIRequestContext,
  taskIds: string[]
): Promise<number> {
  return deleteTestTasks(request, { taskIds });
}

/**
 * Delete specific sessions by ID
 *
 * @param request - Playwright request context
 * @param sessionIds - Array of session IDs to delete
 * @returns Promise that resolves to the count of deleted sessions
 *
 * @example
 * ```ts
 * const createdSessions = ['id1', 'id2', 'id3'];
 * test.afterEach(async ({ request }) => {
 *   await deleteSessionsByIds(request, createdSessions);
 * });
 * ```
 */
export async function deleteSessionsByIds(
  request: APIRequestContext,
  sessionIds: string[]
): Promise<number> {
  return deleteTestSessions(request, { sessionIds });
}
