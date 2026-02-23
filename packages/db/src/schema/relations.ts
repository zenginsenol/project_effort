import { relations } from 'drizzle-orm';

import { apiKeys } from './api-keys';
import { costAnalyses } from './cost-analyses';
import { estimates } from './estimates';
import { integrations } from './integrations';
import { onboardingState } from './onboarding';
import { notificationPreferences, notifications } from './notifications';
import { organizationMembers, users } from './users';
import { organizations } from './organizations';
import { projects } from './projects';
import { sessionParticipants, sessionVotes, sessions } from './sessions';
import { sprints } from './sprints';
import { tasks } from './tasks';

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  projects: many(projects),
  integrations: many(integrations),
  costAnalyses: many(costAnalyses),
  notifications: many(notifications),
  notificationPreferences: many(notificationPreferences),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  memberships: many(organizationMembers),
  assignedTasks: many(tasks),
  estimates: many(estimates),
  apiKeys: many(apiKeys),
  createdCostAnalyses: many(costAnalyses),
  onboardingState: one(onboardingState),
  notifications: many(notifications),
  notificationPreferences: many(notificationPreferences),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}));

export const onboardingStateRelations = relations(onboardingState, ({ one }) => ({
  user: one(users, {
    fields: [onboardingState.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [onboardingState.organizationId],
    references: [organizations.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  tasks: many(tasks),
  sessions: many(sessions),
  sprints: many(sprints),
  costAnalyses: many(costAnalyses),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  parent: one(tasks, {
    fields: [tasks.parentId],
    references: [tasks.id],
    relationName: 'parentChild',
  }),
  children: many(tasks, { relationName: 'parentChild' }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
  }),
  estimates: many(estimates),
}));

export const estimatesRelations = relations(estimates, ({ one }) => ({
  task: one(tasks, {
    fields: [estimates.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [estimates.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  project: one(projects, {
    fields: [sessions.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [sessions.taskId],
    references: [tasks.id],
  }),
  moderator: one(users, {
    fields: [sessions.moderatorId],
    references: [users.id],
  }),
  participants: many(sessionParticipants),
  votes: many(sessionVotes),
}));

export const sessionParticipantsRelations = relations(sessionParticipants, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionParticipants.sessionId],
    references: [sessions.id],
  }),
  user: one(users, {
    fields: [sessionParticipants.userId],
    references: [users.id],
  }),
}));

export const sessionVotesRelations = relations(sessionVotes, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionVotes.sessionId],
    references: [sessions.id],
  }),
  user: one(users, {
    fields: [sessionVotes.userId],
    references: [users.id],
  }),
}));

export const sprintsRelations = relations(sprints, ({ one }) => ({
  project: one(projects, {
    fields: [sprints.projectId],
    references: [projects.id],
  }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  organization: one(organizations, {
    fields: [integrations.organizationId],
    references: [organizations.id],
  }),
}));

export const costAnalysesRelations = relations(costAnalyses, ({ one }) => ({
  organization: one(organizations, {
    fields: [costAnalyses.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [costAnalyses.projectId],
    references: [projects.id],
  }),
  createdByUser: one(users, {
    fields: [costAnalyses.createdByUserId],
    references: [users.id],
  }),
  githubIntegration: one(integrations, {
    fields: [costAnalyses.githubIntegrationId],
    references: [integrations.id],
  }),
}));

import { taskEmbeddings } from './embeddings';

export const taskEmbeddingsRelations = relations(taskEmbeddings, ({ one }) => ({
  task: one(tasks, {
    fields: [taskEmbeddings.taskId],
    references: [tasks.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  organization: one(organizations, {
    fields: [notifications.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  organization: one(organizations, {
    fields: [notificationPreferences.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
}));
