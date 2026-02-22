import { boolean, integer, pgTable, text, timestamp, uuid, index, real, jsonb } from 'drizzle-orm/pg-core';

import { estimationMethodEnum, sessionStatusEnum } from './enums';
import { projects } from './projects';
import { tasks } from './tasks';
import { users } from './users';

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  method: estimationMethodEnum('method').notNull(),
  status: sessionStatusEnum('status').notNull().default('waiting'),
  moderatorId: uuid('moderator_id').notNull().references(() => users.id),
  currentRound: integer('current_round').notNull().default(1),
  finalEstimate: real('final_estimate'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_sessions_project_id').on(table.projectId),
  index('idx_sessions_status').on(table.status),
]);

export const sessionParticipants = pgTable('session_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  isOnline: boolean('is_online').notNull().default(false),
  status: text('status').notNull().default('active'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
}, (table) => [
  index('idx_session_participants_session_id').on(table.sessionId),
]);

export const sessionVotes = pgTable('session_votes', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  round: integer('round').notNull(),
  value: text('value').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_session_votes_session_id').on(table.sessionId),
  index('idx_session_votes_round').on(table.sessionId, table.round),
]);
