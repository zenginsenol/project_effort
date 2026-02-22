import { boolean, pgTable, text, timestamp, uuid, index, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';

import { notificationTypeEnum } from './enums';
import { organizations } from './organizations';
import { users } from './users';

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  link: text('link'),
  metadata: jsonb('metadata'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_notifications_user_id').on(table.userId),
  index('idx_notifications_organization_id').on(table.organizationId),
  index('idx_notifications_created_at').on(table.createdAt),
  index('idx_notifications_is_read').on(table.isRead),
]);

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  notificationType: notificationTypeEnum('notification_type').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('idx_notification_prefs_user_org_type').on(table.userId, table.organizationId, table.notificationType),
  index('idx_notification_prefs_user_id').on(table.userId),
]);
