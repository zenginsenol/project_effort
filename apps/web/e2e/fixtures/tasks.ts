import type { CreateTask } from '@estimate-pro/types';

/**
 * Predefined task fixtures for E2E testing
 *
 * These fixtures provide consistent, reusable test data across E2E tests.
 * Use these when you need predictable task data rather than random values.
 *
 * Note: projectId is set to a placeholder UUID. Override with actual project ID when using.
 */

const PLACEHOLDER_PROJECT_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Default task fixture for general testing
 *
 * @example
 * ```ts
 * const task = { ...taskFixture, projectId: actualProjectId };
 * await api.createTask(task);
 * ```
 */
export const taskFixture: CreateTask = {
  title: 'E2E Test Task',
  description: 'A standard task for E2E testing',
  type: 'task',
  status: 'backlog',
  priority: 'medium',
  projectId: PLACEHOLDER_PROJECT_ID,
};

/**
 * User story task fixture
 *
 * Use this when testing user story workflows
 */
export const userStoryTask: CreateTask = {
  title: 'As a user, I want to view my dashboard',
  description: 'User story: Dashboard view with key metrics and recent activity',
  type: 'story',
  status: 'todo',
  priority: 'high',
  projectId: PLACEHOLDER_PROJECT_ID,
  estimatedPoints: 5,
};

/**
 * Bug task fixture
 *
 * Use this when testing bug tracking workflows
 */
export const bugTask: CreateTask = {
  title: 'Fix login redirect loop',
  description: 'Users are experiencing an infinite redirect loop after login on Safari',
  type: 'bug',
  status: 'todo',
  priority: 'critical',
  projectId: PLACEHOLDER_PROJECT_ID,
  estimatedHours: 4,
};

/**
 * Epic task fixture
 *
 * Use this when testing epic/parent task workflows
 */
export const epicTask: CreateTask = {
  title: 'User Authentication System',
  description: 'Complete user authentication system with OAuth, 2FA, and password reset',
  type: 'epic',
  status: 'in_progress',
  priority: 'high',
  projectId: PLACEHOLDER_PROJECT_ID,
  estimatedPoints: 34,
};

/**
 * Feature task fixture
 *
 * Use this when testing feature development workflows
 */
export const featureTask: CreateTask = {
  title: 'Implement Planning Poker estimation',
  description: 'Add Planning Poker estimation method with real-time voting and reveal',
  type: 'feature',
  status: 'in_progress',
  priority: 'high',
  projectId: PLACEHOLDER_PROJECT_ID,
  estimatedPoints: 13,
  estimatedHours: 24,
};

/**
 * Subtask fixture
 *
 * Use this when testing subtask/child task workflows.
 * Note: parentId should be set to an actual parent task ID when using.
 */
export const subtaskFixture: CreateTask = {
  title: 'Write unit tests for authentication',
  description: 'Add comprehensive unit test coverage for auth module',
  type: 'subtask',
  status: 'todo',
  priority: 'medium',
  projectId: PLACEHOLDER_PROJECT_ID,
  estimatedHours: 6,
};

/**
 * Task in review status
 *
 * Use this when testing review workflows
 */
export const taskInReview: CreateTask = {
  title: 'Implement dark mode toggle',
  description: 'Add dark mode support with user preference persistence',
  type: 'task',
  status: 'in_review',
  priority: 'medium',
  projectId: PLACEHOLDER_PROJECT_ID,
  estimatedPoints: 3,
};

/**
 * Completed task fixture
 *
 * Use this when testing completed task workflows
 */
export const completedTask: CreateTask = {
  title: 'Set up CI/CD pipeline',
  description: 'Configure GitHub Actions for automated testing and deployment',
  type: 'task',
  status: 'done',
  priority: 'high',
  projectId: PLACEHOLDER_PROJECT_ID,
  estimatedPoints: 8,
  estimatedHours: 16,
};

/**
 * Low priority task fixture
 *
 * Use this when testing priority-based workflows
 */
export const lowPriorityTask: CreateTask = {
  title: 'Update documentation',
  description: 'Refresh API documentation with recent changes',
  type: 'task',
  status: 'backlog',
  priority: 'low',
  projectId: PLACEHOLDER_PROJECT_ID,
  estimatedPoints: 2,
};

/**
 * Array of task fixtures covering different types
 *
 * @example
 * ```ts
 * for (const taskTemplate of tasksByType) {
 *   const task = { ...taskTemplate, projectId: actualProjectId };
 *   await api.createTask(task);
 * }
 * ```
 */
export const tasksByType: CreateTask[] = [
  epicTask,
  featureTask,
  userStoryTask,
  taskFixture,
  subtaskFixture,
  bugTask,
];

/**
 * Array of task fixtures covering different statuses
 *
 * @example
 * ```ts
 * for (const taskTemplate of tasksByStatus) {
 *   const task = { ...taskTemplate, projectId: actualProjectId };
 *   await api.createTask(task);
 * }
 * ```
 */
export const tasksByStatus: CreateTask[] = [
  { ...taskFixture, status: 'backlog', title: 'Backlog Task' },
  { ...taskFixture, status: 'todo', title: 'Todo Task' },
  { ...taskFixture, status: 'in_progress', title: 'In Progress Task' },
  { ...taskFixture, status: 'in_review', title: 'In Review Task' },
  { ...taskFixture, status: 'done', title: 'Done Task' },
  { ...taskFixture, status: 'cancelled', title: 'Cancelled Task' },
];

/**
 * Array of task fixtures covering different priorities
 *
 * @example
 * ```ts
 * for (const taskTemplate of tasksByPriority) {
 *   const task = { ...taskTemplate, projectId: actualProjectId };
 *   await api.createTask(task);
 * }
 * ```
 */
export const tasksByPriority: CreateTask[] = [
  { ...bugTask, priority: 'critical', title: 'Critical Priority Task' },
  { ...featureTask, priority: 'high', title: 'High Priority Task' },
  { ...taskFixture, priority: 'medium', title: 'Medium Priority Task' },
  { ...lowPriorityTask, priority: 'low', title: 'Low Priority Task' },
  { ...taskFixture, priority: 'none', title: 'No Priority Task' },
];

/**
 * Array of all unique task fixtures
 *
 * @example
 * ```ts
 * const tasks = allTasks.map(t => ({ ...t, projectId: actualProjectId }));
 * ```
 */
export const allTasks: CreateTask[] = [
  taskFixture,
  userStoryTask,
  bugTask,
  epicTask,
  featureTask,
  subtaskFixture,
  taskInReview,
  completedTask,
  lowPriorityTask,
];

/**
 * Get a task fixture by type
 *
 * @param type - The task type to get a fixture for
 * @returns CreateTask object configured for the specified type
 *
 * @example
 * ```ts
 * const task = { ...getTaskByType('bug'), projectId: actualProjectId };
 * await api.createTask(task);
 * ```
 */
export function getTaskByType(
  type: 'epic' | 'feature' | 'story' | 'task' | 'subtask' | 'bug'
): CreateTask {
  const taskMap = {
    epic: epicTask,
    feature: featureTask,
    story: userStoryTask,
    task: taskFixture,
    subtask: subtaskFixture,
    bug: bugTask,
  };

  return taskMap[type];
}

/**
 * Get a task fixture by status
 *
 * @param status - The task status to get a fixture for
 * @returns CreateTask object configured for the specified status
 *
 * @example
 * ```ts
 * const task = { ...getTaskByStatus('in_progress'), projectId: actualProjectId };
 * await api.createTask(task);
 * ```
 */
export function getTaskByStatus(
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled'
): CreateTask {
  return tasksByStatus.find(t => t.status === status) ?? taskFixture;
}

/**
 * Get a task fixture by priority
 *
 * @param priority - The task priority to get a fixture for
 * @returns CreateTask object configured for the specified priority
 *
 * @example
 * ```ts
 * const task = { ...getTaskByPriority('critical'), projectId: actualProjectId };
 * await api.createTask(task);
 * ```
 */
export function getTaskByPriority(
  priority: 'critical' | 'high' | 'medium' | 'low' | 'none'
): CreateTask {
  return tasksByPriority.find(t => t.priority === priority) ?? taskFixture;
}

/**
 * Helper to bind a task fixture to a specific project ID
 *
 * @param task - The task fixture to bind
 * @param projectId - The actual project ID to use
 * @returns CreateTask object with the specified project ID
 *
 * @example
 * ```ts
 * const task = bindTaskToProject(userStoryTask, project.id);
 * await api.createTask(task);
 * ```
 */
export function bindTaskToProject(task: CreateTask, projectId: string): CreateTask {
  return { ...task, projectId };
}

/**
 * Helper to bind multiple task fixtures to a specific project ID
 *
 * @param tasks - Array of task fixtures to bind
 * @param projectId - The actual project ID to use
 * @returns Array of CreateTask objects with the specified project ID
 *
 * @example
 * ```ts
 * const tasks = bindTasksToProject(allTasks, project.id);
 * await Promise.all(tasks.map(task => api.createTask(task)));
 * ```
 */
export function bindTasksToProject(tasks: CreateTask[], projectId: string): CreateTask[] {
  return tasks.map(task => bindTaskToProject(task, projectId));
}
