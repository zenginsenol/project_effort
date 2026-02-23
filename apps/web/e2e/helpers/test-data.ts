import type { CreateProject, EstimationMethod, ProjectStatus } from '@estimate-pro/types';
import type { CreateTask, TaskType, TaskStatus, TaskPriority } from '@estimate-pro/types';
import type { CreateSession } from '@estimate-pro/types';
import { randomUUID } from 'node:crypto';

/**
 * Test data factory utilities for generating mock data in E2E tests
 *
 * These factories create valid test data that conforms to the application's
 * Zod schemas and business rules. Use these instead of hardcoding test data
 * to ensure consistency and validity.
 */

export interface CreateTestProjectOptions {
  name?: string;
  description?: string;
  key?: string;
  defaultEstimationMethod?: EstimationMethod;
}

export interface CreateTestTaskOptions {
  title?: string;
  description?: string;
  type?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
  parentId?: string;
  projectId?: string;
  assigneeId?: string;
  estimatedPoints?: number;
  estimatedHours?: number;
  sprintId?: string;
}

export interface CreateTestSessionOptions {
  projectId?: string;
  taskId?: string;
  method?: 'planning_poker' | 'tshirt_sizing' | 'pert' | 'wideband_delphi';
  name?: string;
}

/**
 * Create a test project with sensible defaults
 *
 * @param options - Partial project options to override defaults
 * @returns CreateProject object ready for use in tests
 *
 * @example
 * ```ts
 * const project = createTestProject({
 *   name: 'My Test Project',
 *   key: 'MTP'
 * });
 * ```
 */
export function createTestProject(options: CreateTestProjectOptions = {}): CreateProject {
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();

  return {
    name: options.name ?? `Test Project ${randomSuffix}`,
    description: options.description ?? 'A test project for E2E testing',
    key: options.key ?? `TP${randomSuffix.substring(0, 2)}`,
    defaultEstimationMethod: options.defaultEstimationMethod ?? 'planning_poker',
  };
}

/**
 * Create a test task with sensible defaults
 *
 * @param options - Partial task options to override defaults
 * @returns CreateTask object ready for use in tests
 *
 * @example
 * ```ts
 * const task = createTestTask({
 *   title: 'Implement user authentication',
 *   projectId: project.id,
 *   priority: 'high'
 * });
 * ```
 */
export function createTestTask(options: CreateTestTaskOptions = {}): CreateTask {
  const randomSuffix = Math.random().toString(36).substring(2, 6);

  return {
    title: options.title ?? `Test Task ${randomSuffix}`,
    description: options.description ?? 'A test task for E2E testing',
    type: options.type ?? 'task',
    status: options.status ?? 'backlog',
    priority: options.priority ?? 'medium',
    projectId: options.projectId ?? randomUUID(),
    ...(options.parentId && { parentId: options.parentId }),
    ...(options.assigneeId && { assigneeId: options.assigneeId }),
    ...(options.estimatedPoints !== undefined && { estimatedPoints: options.estimatedPoints }),
    ...(options.estimatedHours !== undefined && { estimatedHours: options.estimatedHours }),
    ...(options.sprintId && { sprintId: options.sprintId }),
  };
}

/**
 * Create a test estimation session with sensible defaults
 *
 * @param options - Partial session options to override defaults
 * @returns CreateSession object ready for use in tests
 *
 * @example
 * ```ts
 * const session = createTestSession({
 *   name: 'Sprint 5 Planning',
 *   projectId: project.id,
 *   taskId: task.id,
 *   method: 'planning_poker'
 * });
 * ```
 */
export function createTestSession(options: CreateTestSessionOptions = {}): CreateSession {
  const randomSuffix = Math.random().toString(36).substring(2, 6);

  return {
    projectId: options.projectId ?? randomUUID(),
    name: options.name ?? `Test Session ${randomSuffix}`,
    method: options.method ?? 'planning_poker',
    ...(options.taskId && { taskId: options.taskId }),
  };
}

/**
 * Create multiple test projects at once
 *
 * @param count - Number of projects to create
 * @param baseOptions - Base options to apply to all projects
 * @returns Array of CreateProject objects
 *
 * @example
 * ```ts
 * const projects = createTestProjects(5, {
 *   defaultEstimationMethod: 'pert'
 * });
 * ```
 */
export function createTestProjects(
  count: number,
  baseOptions: CreateTestProjectOptions = {}
): CreateProject[] {
  return Array.from({ length: count }, (_, index) =>
    createTestProject({
      ...baseOptions,
      name: baseOptions.name ? `${baseOptions.name} ${index + 1}` : undefined,
      key: baseOptions.key ? `${baseOptions.key}${index + 1}` : undefined,
    })
  );
}

/**
 * Create multiple test tasks at once
 *
 * @param count - Number of tasks to create
 * @param baseOptions - Base options to apply to all tasks
 * @returns Array of CreateTask objects
 *
 * @example
 * ```ts
 * const tasks = createTestTasks(10, {
 *   projectId: project.id,
 *   type: 'story'
 * });
 * ```
 */
export function createTestTasks(
  count: number,
  baseOptions: CreateTestTaskOptions = {}
): CreateTask[] {
  return Array.from({ length: count }, (_, index) =>
    createTestTask({
      ...baseOptions,
      title: baseOptions.title ? `${baseOptions.title} ${index + 1}` : undefined,
    })
  );
}

/**
 * Create multiple test estimation sessions at once
 *
 * @param count - Number of sessions to create
 * @param baseOptions - Base options to apply to all sessions
 * @returns Array of CreateSession objects
 *
 * @example
 * ```ts
 * const sessions = createTestSessions(3, {
 *   projectId: project.id,
 *   method: 'planning_poker'
 * });
 * ```
 */
export function createTestSessions(
  count: number,
  baseOptions: CreateTestSessionOptions = {}
): CreateSession[] {
  return Array.from({ length: count }, (_, index) =>
    createTestSession({
      ...baseOptions,
      name: baseOptions.name ? `${baseOptions.name} ${index + 1}` : undefined,
    })
  );
}

/**
 * Create a complete test hierarchy: project with tasks and sessions
 *
 * @param options - Configuration for the hierarchy
 * @returns Object containing project, tasks, and sessions
 *
 * @example
 * ```ts
 * const { project, tasks, sessions } = createTestHierarchy({
 *   projectOptions: { name: 'E-Commerce Platform' },
 *   taskCount: 5,
 *   sessionCount: 2
 * });
 * ```
 */
export function createTestHierarchy(options: {
  projectOptions?: CreateTestProjectOptions;
  taskCount?: number;
  sessionCount?: number;
} = {}): {
  project: CreateProject;
  tasks: CreateTask[];
  sessions: CreateSession[];
} {
  const project = createTestProject(options.projectOptions);
  const projectId = randomUUID(); // This would be the ID after creating the project

  const tasks = createTestTasks(options.taskCount ?? 3, { projectId });
  const sessions = createTestSessions(options.sessionCount ?? 1, { projectId });

  return {
    project,
    tasks,
    sessions,
  };
}
