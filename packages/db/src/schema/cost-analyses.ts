import { customType, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { integrations } from './integrations';
import { organizations } from './organizations';
import { projects } from './projects';
import { users } from './users';

// Custom type for PostgreSQL tsvector (full-text search)
const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

export const costAnalyses = pgTable('cost_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  description: text('description'),
  sourceType: text('source_type').notNull().default('project_tasks'),
  sourceProvider: text('source_provider'),
  sourceModel: text('source_model'),
  sourceReasoningEffort: text('source_reasoning_effort'),
  sourceInput: text('source_input'),
  sourceContext: text('source_context'),
  parameters: jsonb('parameters').notNull(),
  editableSections: jsonb('editable_sections').notNull(),
  assumptions: jsonb('assumptions').notNull(),
  taskSnapshot: jsonb('task_snapshot').notNull(),
  summarySnapshot: jsonb('summary_snapshot').notNull(),
  breakdownSnapshot: jsonb('breakdown_snapshot').notNull(),
  githubIntegrationId: uuid('github_integration_id').references(() => integrations.id, { onDelete: 'set null' }),
  githubRepository: text('github_repository'),
  githubIssueNumber: integer('github_issue_number'),
  githubIssueUrl: text('github_issue_url'),
  githubSyncedAt: timestamp('github_synced_at', { withTimezone: true }),
  searchVector: tsvector('search_vector'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_cost_analyses_organization_id').on(table.organizationId),
  index('idx_cost_analyses_project_id').on(table.projectId),
  index('idx_cost_analyses_created_by').on(table.createdByUserId),
  index('idx_cost_analyses_github_integration').on(table.githubIntegrationId),
  index('idx_cost_analyses_search_vector').on(table.searchVector),
]);
