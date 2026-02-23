import { integer, pgTable, text, timestamp, uuid, index, real, customType } from 'drizzle-orm/pg-core';

import { taskPriorityEnum, taskStatusEnum, taskTypeEnum } from './enums';
import { projects } from './projects';
import { users } from './users';

// Custom type for PostgreSQL tsvector (full-text search)
const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'),
  title: text('title').notNull(),
  description: text('description'),
  type: taskTypeEnum('type').notNull().default('task'),
  status: taskStatusEnum('status').notNull().default('backlog'),
  priority: taskPriorityEnum('priority').notNull().default('medium'),
  assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  estimatedPoints: real('estimated_points'),
  estimatedHours: real('estimated_hours'),
  actualHours: real('actual_hours'),
  sortOrder: integer('sort_order').notNull().default(0),
  searchVector: tsvector('search_vector'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_tasks_project_id').on(table.projectId),
  index('idx_tasks_parent_id').on(table.parentId),
  index('idx_tasks_assignee_id').on(table.assigneeId),
  index('idx_tasks_status').on(table.status),
  index('idx_tasks_project_status').on(table.projectId, table.status),
  index('idx_tasks_project_created').on(table.projectId, table.createdAt),
  index('idx_tasks_search_vector').on(table.searchVector),
]);
