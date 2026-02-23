import { pgTable, text, timestamp, uuid, index, jsonb } from 'drizzle-orm/pg-core';

import { auditEventTypeEnum, auditEntityTypeEnum, auditActionEnum } from './enums';
import { organizations } from './organizations';
import { users } from './users';

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  eventType: auditEventTypeEnum('event_type').notNull(),
  entityType: auditEntityTypeEnum('entity_type').notNull(),
  entityId: uuid('entity_id'),
  action: auditActionEnum('action').notNull(),
  metadata: jsonb('metadata'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_audit_logs_organization_id').on(table.organizationId),
  index('idx_audit_logs_user_id').on(table.userId),
  index('idx_audit_logs_created_at').on(table.createdAt),
  index('idx_audit_logs_event_type').on(table.eventType),
  index('idx_audit_logs_entity').on(table.entityType, table.entityId),
]);
