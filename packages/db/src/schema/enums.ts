import { pgEnum } from 'drizzle-orm/pg-core';

export const organizationRoleEnum = pgEnum('organization_role', ['owner', 'admin', 'member', 'viewer']);
export const projectStatusEnum = pgEnum('project_status', ['active', 'archived', 'completed']);
export const estimationMethodEnum = pgEnum('estimation_method', ['planning_poker', 'tshirt_sizing', 'pert', 'wideband_delphi']);
export const taskTypeEnum = pgEnum('task_type', ['epic', 'feature', 'story', 'task', 'subtask', 'bug']);
export const taskStatusEnum = pgEnum('task_status', ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled']);
export const taskPriorityEnum = pgEnum('task_priority', ['critical', 'high', 'medium', 'low', 'none']);
export const sessionStatusEnum = pgEnum('session_status', ['waiting', 'voting', 'revealed', 'completed']);
export const sprintStatusEnum = pgEnum('sprint_status', ['planning', 'active', 'completed', 'cancelled']);
export const integrationTypeEnum = pgEnum('integration_type', ['jira', 'azure_devops', 'github', 'gitlab']);
export const aiProviderEnum = pgEnum('ai_provider', ['openai', 'anthropic', 'openrouter']);
export const subscriptionPlanEnum = pgEnum('subscription_plan', ['free', 'pro', 'enterprise']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'cancelled', 'past_due', 'trialing']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'open', 'paid', 'void', 'uncollectible']);
