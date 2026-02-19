export const ErrorCode = {
  // Auth
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Organization
  ORG_NOT_FOUND: 'ORG_NOT_FOUND',
  ORG_SLUG_TAKEN: 'ORG_SLUG_TAKEN',
  ORG_MEMBER_EXISTS: 'ORG_MEMBER_EXISTS',
  ORG_LIMIT_REACHED: 'ORG_LIMIT_REACHED',

  // Project
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  PROJECT_KEY_TAKEN: 'PROJECT_KEY_TAKEN',
  PROJECT_ARCHIVED: 'PROJECT_ARCHIVED',

  // Task
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TASK_CIRCULAR_DEPENDENCY: 'TASK_CIRCULAR_DEPENDENCY',
  TASK_INVALID_PARENT: 'TASK_INVALID_PARENT',

  // Estimation
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_ALREADY_COMPLETED: 'SESSION_ALREADY_COMPLETED',
  SESSION_NOT_STARTED: 'SESSION_NOT_STARTED',
  INVALID_VOTE: 'INVALID_VOTE',

  // AI
  AI_SERVICE_UNAVAILABLE: 'AI_SERVICE_UNAVAILABLE',
  AI_RATE_LIMITED: 'AI_RATE_LIMITED',
  AI_PROMPT_INJECTION: 'AI_PROMPT_INJECTION',

  // Integration
  INTEGRATION_NOT_FOUND: 'INTEGRATION_NOT_FOUND',
  INTEGRATION_AUTH_FAILED: 'INTEGRATION_AUTH_FAILED',
  INTEGRATION_SYNC_FAILED: 'INTEGRATION_SYNC_FAILED',

  // General
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ERROR_MESSAGES: Record<ErrorCodeType, string> = {
  [ErrorCode.UNAUTHORIZED]: 'Authentication required',
  [ErrorCode.FORBIDDEN]: 'Insufficient permissions',
  [ErrorCode.INVALID_TOKEN]: 'Invalid or expired token',
  [ErrorCode.ORG_NOT_FOUND]: 'Organization not found',
  [ErrorCode.ORG_SLUG_TAKEN]: 'Organization slug already taken',
  [ErrorCode.ORG_MEMBER_EXISTS]: 'Member already exists in organization',
  [ErrorCode.ORG_LIMIT_REACHED]: 'Organization limit reached',
  [ErrorCode.PROJECT_NOT_FOUND]: 'Project not found',
  [ErrorCode.PROJECT_KEY_TAKEN]: 'Project key already taken',
  [ErrorCode.PROJECT_ARCHIVED]: 'Project is archived',
  [ErrorCode.TASK_NOT_FOUND]: 'Task not found',
  [ErrorCode.TASK_CIRCULAR_DEPENDENCY]: 'Circular task dependency detected',
  [ErrorCode.TASK_INVALID_PARENT]: 'Invalid parent task',
  [ErrorCode.SESSION_NOT_FOUND]: 'Estimation session not found',
  [ErrorCode.SESSION_ALREADY_COMPLETED]: 'Session already completed',
  [ErrorCode.SESSION_NOT_STARTED]: 'Session has not started',
  [ErrorCode.INVALID_VOTE]: 'Invalid vote value',
  [ErrorCode.AI_SERVICE_UNAVAILABLE]: 'AI service temporarily unavailable',
  [ErrorCode.AI_RATE_LIMITED]: 'AI service rate limited',
  [ErrorCode.AI_PROMPT_INJECTION]: 'Potential prompt injection detected',
  [ErrorCode.INTEGRATION_NOT_FOUND]: 'Integration not found',
  [ErrorCode.INTEGRATION_AUTH_FAILED]: 'Integration authentication failed',
  [ErrorCode.INTEGRATION_SYNC_FAILED]: 'Integration sync failed',
  [ErrorCode.VALIDATION_ERROR]: 'Validation error',
  [ErrorCode.NOT_FOUND]: 'Resource not found',
  [ErrorCode.INTERNAL_ERROR]: 'Internal server error',
  [ErrorCode.RATE_LIMITED]: 'Too many requests',
};
