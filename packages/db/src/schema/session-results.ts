import { index, integer, jsonb, pgTable, real, timestamp, uuid } from 'drizzle-orm/pg-core';

import { estimationMethodEnum } from './enums';
import { sessions } from './sessions';

export const sessionResults = pgTable('session_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  method: estimationMethodEnum('method').notNull(),
  finalEstimate: real('final_estimate').notNull(),
  participantCount: integer('participant_count').notNull(),
  totalRounds: integer('total_rounds').notNull().default(1),
  methodSpecificResults: jsonb('method_specific_results').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_session_results_session_id').on(table.sessionId),
  index('idx_session_results_method').on(table.method),
]);
