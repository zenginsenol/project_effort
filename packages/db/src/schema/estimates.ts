import { pgTable, text, timestamp, uuid, index, real, jsonb } from 'drizzle-orm/pg-core';

import { estimationMethodEnum } from './enums';
import { tasks } from './tasks';
import { users } from './users';

export const estimates = pgTable('estimates', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  method: estimationMethodEnum('method').notNull(),
  value: real('value').notNull(),
  unit: text('unit').notNull().default('points'),
  confidence: real('confidence'),
  notes: text('notes'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_estimates_task_id').on(table.taskId),
  index('idx_estimates_user_id').on(table.userId),
]);
