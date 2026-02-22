import { pgTable, text, timestamp, uuid, index, boolean, integer } from 'drizzle-orm/pg-core';

import { organizations } from './organizations';

export const publicApiKeys = pgTable('public_api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  /** User-friendly label, e.g. "Production API Key" */
  name: text('name').notNull(),
  /** Hashed API key for secure storage */
  keyHash: text('key_hash').notNull(),
  /** Last 4-8 characters of the key for display (e.g. "...ab1c2d3e") */
  keyHint: text('key_hint').notNull(),
  /** Rate limit in requests per minute */
  rateLimit: integer('rate_limit').notNull().default(1000),
  /** Whether this API key is currently active */
  isActive: boolean('is_active').notNull().default(true),
  /** Last time this API key was used */
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_public_api_keys_organization_id').on(table.organizationId),
  index('idx_public_api_keys_org_active').on(table.organizationId, table.isActive),
]);
