import type { CreateSession } from '@estimate-pro/types';

/**
 * Predefined estimation session fixtures for E2E testing
 *
 * These fixtures provide consistent, reusable test data across E2E tests.
 * Use these when you need predictable session data rather than random values.
 *
 * Note: projectId and taskId are set to placeholder UUIDs. Override with actual IDs when using.
 */

const PLACEHOLDER_PROJECT_ID = '00000000-0000-0000-0000-000000000001';
const PLACEHOLDER_TASK_ID = '00000000-0000-0000-0000-000000000002';

/**
 * Default session fixture using Planning Poker
 *
 * @example
 * ```ts
 * const session = { ...sessionFixture, projectId: actualProjectId };
 * await api.createSession(session);
 * ```
 */
export const sessionFixture: CreateSession = {
  projectId: PLACEHOLDER_PROJECT_ID,
  name: 'E2E Test Session',
  method: 'planning_poker',
};

/**
 * Planning Poker session fixture
 *
 * Use this when testing Planning Poker specific features
 */
export const planningPokerSession: CreateSession = {
  projectId: PLACEHOLDER_PROJECT_ID,
  taskId: PLACEHOLDER_TASK_ID,
  name: 'Sprint Planning - Planning Poker',
  method: 'planning_poker',
};

/**
 * T-Shirt Sizing session fixture
 *
 * Use this when testing T-Shirt Sizing specific features
 */
export const tshirtSizingSession: CreateSession = {
  projectId: PLACEHOLDER_PROJECT_ID,
  taskId: PLACEHOLDER_TASK_ID,
  name: 'Quick Estimate - T-Shirt Sizing',
  method: 'tshirt_sizing',
};

/**
 * PERT session fixture
 *
 * Use this when testing PERT estimation specific features
 */
export const pertSession: CreateSession = {
  projectId: PLACEHOLDER_PROJECT_ID,
  taskId: PLACEHOLDER_TASK_ID,
  name: 'Risk Analysis - PERT Estimation',
  method: 'pert',
};

/**
 * Wideband Delphi session fixture
 *
 * Use this when testing Wideband Delphi specific features
 */
export const widebandDelphiSession: CreateSession = {
  projectId: PLACEHOLDER_PROJECT_ID,
  taskId: PLACEHOLDER_TASK_ID,
  name: 'Expert Consensus - Wideband Delphi',
  method: 'wideband_delphi',
};

/**
 * Session without a linked task
 *
 * Use this when testing general estimation sessions not tied to a specific task
 */
export const generalSession: CreateSession = {
  projectId: PLACEHOLDER_PROJECT_ID,
  name: 'General Estimation Session',
  method: 'planning_poker',
};

/**
 * Sprint planning session fixture
 *
 * Use this when testing sprint planning workflows
 */
export const sprintPlanningSession: CreateSession = {
  projectId: PLACEHOLDER_PROJECT_ID,
  name: 'Sprint 5 Planning',
  method: 'planning_poker',
};

/**
 * Backlog refinement session fixture
 *
 * Use this when testing backlog refinement workflows
 */
export const backlogRefinementSession: CreateSession = {
  projectId: PLACEHOLDER_PROJECT_ID,
  name: 'Backlog Refinement Session',
  method: 'tshirt_sizing',
};

/**
 * Technical spike estimation session
 *
 * Use this when testing technical spike or research task estimation
 */
export const technicalSpikeSession: CreateSession = {
  projectId: PLACEHOLDER_PROJECT_ID,
  taskId: PLACEHOLDER_TASK_ID,
  name: 'Technical Spike - API Performance',
  method: 'pert',
};

/**
 * Array of session fixtures for all estimation methods
 *
 * @example
 * ```ts
 * for (const sessionTemplate of sessionsByMethod) {
 *   const session = { ...sessionTemplate, projectId: actualProjectId };
 *   await api.createSession(session);
 * }
 * ```
 */
export const sessionsByMethod: CreateSession[] = [
  planningPokerSession,
  tshirtSizingSession,
  pertSession,
  widebandDelphiSession,
];

/**
 * Array of all unique session fixtures
 *
 * @example
 * ```ts
 * const sessions = allSessions.map(s => ({ ...s, projectId: actualProjectId }));
 * ```
 */
export const allSessions: CreateSession[] = [
  sessionFixture,
  planningPokerSession,
  tshirtSizingSession,
  pertSession,
  widebandDelphiSession,
  generalSession,
  sprintPlanningSession,
  backlogRefinementSession,
  technicalSpikeSession,
];

/**
 * Get a session fixture by estimation method
 *
 * @param method - The estimation method to get a fixture for
 * @returns CreateSession object configured for the specified method
 *
 * @example
 * ```ts
 * const session = { ...getSessionByMethod('planning_poker'), projectId: actualProjectId };
 * await api.createSession(session);
 * ```
 */
export function getSessionByMethod(
  method: 'planning_poker' | 'tshirt_sizing' | 'pert' | 'wideband_delphi'
): CreateSession {
  const sessionMap = {
    planning_poker: planningPokerSession,
    tshirt_sizing: tshirtSizingSession,
    pert: pertSession,
    wideband_delphi: widebandDelphiSession,
  };

  return sessionMap[method];
}

/**
 * Helper to bind a session fixture to a specific project ID
 *
 * @param session - The session fixture to bind
 * @param projectId - The actual project ID to use
 * @returns CreateSession object with the specified project ID
 *
 * @example
 * ```ts
 * const session = bindSessionToProject(planningPokerSession, project.id);
 * await api.createSession(session);
 * ```
 */
export function bindSessionToProject(session: CreateSession, projectId: string): CreateSession {
  return { ...session, projectId };
}

/**
 * Helper to bind a session fixture to a specific project and task
 *
 * @param session - The session fixture to bind
 * @param projectId - The actual project ID to use
 * @param taskId - The actual task ID to use
 * @returns CreateSession object with the specified project and task IDs
 *
 * @example
 * ```ts
 * const session = bindSessionToTask(planningPokerSession, project.id, task.id);
 * await api.createSession(session);
 * ```
 */
export function bindSessionToTask(
  session: CreateSession,
  projectId: string,
  taskId: string
): CreateSession {
  return { ...session, projectId, taskId };
}

/**
 * Helper to bind multiple session fixtures to a specific project ID
 *
 * @param sessions - Array of session fixtures to bind
 * @param projectId - The actual project ID to use
 * @returns Array of CreateSession objects with the specified project ID
 *
 * @example
 * ```ts
 * const sessions = bindSessionsToProject(allSessions, project.id);
 * await Promise.all(sessions.map(session => api.createSession(session)));
 * ```
 */
export function bindSessionsToProject(
  sessions: CreateSession[],
  projectId: string
): CreateSession[] {
  return sessions.map(session => bindSessionToProject(session, projectId));
}
