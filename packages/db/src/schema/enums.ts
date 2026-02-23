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
export const onboardingStepEnum = pgEnum('onboarding_step', ['organization_created', 'project_setup', 'tasks_created', 'first_estimation']);
export const notificationTypeEnum = pgEnum('notification_type', ['session_invitation', 'vote_reminder', 'session_complete', 'task_assigned', 'task_status_change', 'sync_complete', 'mention_in_comment']);
export const invitationStatusEnum = pgEnum('invitation_status', ['pending', 'accepted', 'expired', 'cancelled']);
export const activityTypeEnum = pgEnum('activity_type', [
  'task_created',
  'task_updated',
  'task_status_changed',
  'session_created',
  'session_completed',
  'cost_analysis_created',
  'cost_analysis_exported',
  'integration_sync_completed',
  'member_joined',
  'member_left',
  'project_created',
  'project_updated',
  'project_deleted',
]);
export const subscriptionPlanEnum = pgEnum('subscription_plan', ['free', 'pro', 'enterprise']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'cancelled', 'past_due', 'trialing']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'open', 'paid', 'void', 'uncollectible']);

export const auditEventTypeEnum = pgEnum('audit_event_type', [
  'auth.sign_in',
  'auth.sign_out',
  'auth.failed_attempt',
  'project.created',
  'project.updated',
  'project.deleted',
  'task.created',
  'task.updated',
  'task.deleted',
  'analysis.created',
  'analysis.updated',
  'analysis.deleted',
  'session.created',
  'session.updated',
  'session.completed',
  'integration.sync_initiated',
  'integration.sync_completed',
  'api_key.created',
  'api_key.revoked',
  'organization.settings_changed',
  'organization.member_added',
  'organization.member_removed',
  'organization.member_role_changed'
]);

export const auditEntityTypeEnum = pgEnum('audit_entity_type', [
  'project',
  'task',
  'analysis',
  'session',
  'integration',
  'api_key',
  'organization',
  'user'
]);

export const auditActionEnum = pgEnum('audit_action', [
  'create',
  'update',
  'delete',
  'access',
  'sign_in',
  'sign_out',
  'revoke',
  'sync_initiated',
  'sync_completed'
]);
