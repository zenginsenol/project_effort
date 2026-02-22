import { pgTable, timestamp, uuid, boolean, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';

import { onboardingStepEnum } from './enums';
import { users } from './users';
import { organizations } from './organizations';

export const onboardingState = pgTable('onboarding_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  currentStep: onboardingStepEnum('current_step'),
  completedSteps: jsonb('completed_steps').$type<string[]>().notNull().default([]),
  isCompleted: boolean('is_completed').notNull().default(false),
  isSkipped: boolean('is_skipped').notNull().default(false),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('idx_onboarding_state_user_id').on(table.userId),
  index('idx_onboarding_state_org_id').on(table.organizationId),
  index('idx_onboarding_state_completed').on(table.isCompleted),
]);
