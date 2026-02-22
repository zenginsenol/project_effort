import { pgTable, text, timestamp, uuid, index, customType } from 'drizzle-orm/pg-core';

import { estimationMethodEnum, projectStatusEnum } from './enums';
import { organizations } from './organizations';

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  key: text('key').notNull(),
  status: projectStatusEnum('status').notNull().default('active'),
  defaultEstimationMethod: estimationMethodEnum('default_estimation_method').notNull().default('planning_poker'),
  searchVector: tsvector('search_vector'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_projects_organization_id').on(table.organizationId),
  index('idx_projects_key').on(table.key),
  index('idx_projects_search_vector').on(table.searchVector),
]);
