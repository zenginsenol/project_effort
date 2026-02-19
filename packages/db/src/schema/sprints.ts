import { pgTable, text, timestamp, uuid, index, date } from 'drizzle-orm/pg-core';

import { sprintStatusEnum } from './enums';
import { projects } from './projects';

export const sprints = pgTable('sprints', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  goal: text('goal'),
  status: sprintStatusEnum('status').notNull().default('planning'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_sprints_project_id').on(table.projectId),
  index('idx_sprints_status').on(table.status),
]);
