import type { CreateProject } from '@estimate-pro/types';

/**
 * Predefined project fixtures for E2E testing
 *
 * These fixtures provide consistent, reusable test data across E2E tests.
 * Use these when you need predictable project data rather than random values.
 */

/**
 * Default project fixture using Planning Poker estimation method
 *
 * @example
 * ```ts
 * await api.createProject(projectFixture);
 * ```
 */
export const projectFixture: CreateProject = {
  name: 'E2E Test Project',
  description: 'A standard project for E2E testing',
  key: 'E2E',
  defaultEstimationMethod: 'planning_poker',
};

/**
 * Planning Poker project fixture
 *
 * Use this when testing Planning Poker specific features
 */
export const planningPokerProject: CreateProject = {
  name: 'Planning Poker Project',
  description: 'Project configured for Planning Poker estimation sessions',
  key: 'PPP',
  defaultEstimationMethod: 'planning_poker',
};

/**
 * T-Shirt Sizing project fixture
 *
 * Use this when testing T-Shirt Sizing specific features
 */
export const tshirtSizingProject: CreateProject = {
  name: 'T-Shirt Sizing Project',
  description: 'Project configured for T-Shirt Sizing estimation sessions',
  key: 'TSP',
  defaultEstimationMethod: 'tshirt_sizing',
};

/**
 * PERT project fixture
 *
 * Use this when testing PERT estimation specific features
 */
export const pertProject: CreateProject = {
  name: 'PERT Estimation Project',
  description: 'Project configured for PERT (Program Evaluation and Review Technique) estimation',
  key: 'PRT',
  defaultEstimationMethod: 'pert',
};

/**
 * Wideband Delphi project fixture
 *
 * Use this when testing Wideband Delphi specific features
 */
export const widebandDelphiProject: CreateProject = {
  name: 'Wideband Delphi Project',
  description: 'Project configured for Wideband Delphi estimation sessions',
  key: 'WDP',
  defaultEstimationMethod: 'wideband_delphi',
};

/**
 * Array of all project fixtures for testing different estimation methods
 *
 * @example
 * ```ts
 * for (const project of sampleProjects) {
 *   await api.createProject(project);
 * }
 * ```
 */
export const sampleProjects: CreateProject[] = [
  planningPokerProject,
  tshirtSizingProject,
  pertProject,
  widebandDelphiProject,
];

/**
 * Array of all project fixtures including the default fixture
 *
 * @example
 * ```ts
 * const [defaultProject, ...otherProjects] = allProjects;
 * ```
 */
export const allProjects: CreateProject[] = [
  projectFixture,
  ...sampleProjects,
];

/**
 * Get a project fixture by estimation method
 *
 * @param method - The estimation method to get a fixture for
 * @returns CreateProject object configured for the specified method
 *
 * @example
 * ```ts
 * const project = getProjectByMethod('planning_poker');
 * await api.createProject(project);
 * ```
 */
export function getProjectByMethod(
  method: 'planning_poker' | 'tshirt_sizing' | 'pert' | 'wideband_delphi'
): CreateProject {
  const projectMap = {
    planning_poker: planningPokerProject,
    tshirt_sizing: tshirtSizingProject,
    pert: pertProject,
    wideband_delphi: widebandDelphiProject,
  };

  return projectMap[method];
}
