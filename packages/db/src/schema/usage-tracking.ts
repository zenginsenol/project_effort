import { pgTable, text, timestamp, uuid, integer, index } from 'drizzle-orm/pg-core';

import { organizations } from './organizations';

export const usageTracking = pgTable('usage_tracking', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  monthYear: text('month_year').notNull(), // Format: YYYY-MM
  aiAnalysesCount: integer('ai_analyses_count').notNull().default(0),
  projectsCount: integer('projects_count').notNull().default(0),
  teamMembersCount: integer('team_members_count').notNull().default(0),
  estimationSessionsCount: integer('estimation_sessions_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_usage_tracking_organization_id').on(table.organizationId),
  index('idx_usage_tracking_org_month').on(table.organizationId, table.monthYear),
]);
