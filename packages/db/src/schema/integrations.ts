import { boolean, pgTable, text, timestamp, uuid, index, jsonb } from 'drizzle-orm/pg-core';

import { integrationTypeEnum } from './enums';
import { organizations } from './organizations';

export const integrations = pgTable('integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  type: integrationTypeEnum('type').notNull(),
  isActive: boolean('is_active').notNull().default(false),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  externalProjectId: text('external_project_id'),
  settings: jsonb('settings'),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_integrations_organization_id').on(table.organizationId),
  index('idx_integrations_type').on(table.type),
]);
