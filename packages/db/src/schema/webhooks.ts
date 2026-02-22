import { pgTable, text, timestamp, uuid, index, boolean, integer, jsonb } from 'drizzle-orm/pg-core';

import { organizations } from './organizations';

export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  /** Webhook endpoint URL */
  url: text('url').notNull(),
  /** Array of event types to subscribe to (e.g. ["estimation.completed", "task.created"]) */
  events: jsonb('events').notNull(),
  /** Secret for HMAC signature verification */
  secret: text('secret').notNull(),
  /** Whether this webhook is currently active */
  isActive: boolean('is_active').notNull().default(true),
  /** Last time this webhook was triggered */
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_webhooks_organization_id').on(table.organizationId),
  index('idx_webhooks_org_active').on(table.organizationId, table.isActive),
]);

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  webhookId: uuid('webhook_id').notNull().references(() => webhooks.id, { onDelete: 'cascade' }),
  /** Event type that triggered this delivery (e.g. "task.created") */
  eventType: text('event_type').notNull(),
  /** JSON payload sent to the webhook endpoint */
  payload: jsonb('payload').notNull(),
  /** Delivery attempt number (1, 2, or 3) */
  attempt: integer('attempt').notNull().default(1),
  /** HTTP response status code */
  responseStatus: integer('response_status'),
  /** HTTP response body */
  responseBody: text('response_body'),
  /** Timestamp when delivery was successful */
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_webhook_deliveries_webhook_id').on(table.webhookId),
  index('idx_webhook_deliveries_webhook_created').on(table.webhookId, table.createdAt),
]);
