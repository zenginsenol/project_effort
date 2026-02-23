import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { activityTypeEnum } from './enums';
import { organizations } from './organizations';
import { projects } from './projects';
import { users } from './users';

export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  activityType: activityTypeEnum('activity_type').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_activities_organization_id').on(table.organizationId),
  index('idx_activities_project_id').on(table.projectId),
  index('idx_activities_actor_id').on(table.actorId),
  index('idx_activities_activity_type').on(table.activityType),
  index('idx_activities_created_at').on(table.createdAt),
]);
