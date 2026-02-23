import { pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { subscriptionPlanEnum } from './enums';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  logoUrl: text('logo_url'),
  stripeCustomerId: text('stripe_customer_id'),
  currentPlan: subscriptionPlanEnum('current_plan').notNull().default('free'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_organizations_slug').on(table.slug),
]);
