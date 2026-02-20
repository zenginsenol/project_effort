import { pgTable, text, timestamp, uuid, index, boolean } from 'drizzle-orm/pg-core';

import { aiProviderEnum } from './enums';
import { users } from './users';

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: aiProviderEnum('provider').notNull(),
  /** Encrypted API key - for manual key entry */
  encryptedKey: text('encrypted_key'),
  /** Last 4 characters of the key for display (e.g. "...ab1c") */
  keyHint: text('key_hint'),
  /** User-friendly label, e.g. "My OpenAI Key" */
  label: text('label'),
  isActive: boolean('is_active').notNull().default(true),
  /** Preferred model for this provider */
  model: text('model'),
  /** Auth method: 'api_key' or 'oauth' */
  authMethod: text('auth_method').notNull().default('api_key'),
  /** Encrypted OAuth access token */
  encryptedAccessToken: text('encrypted_access_token'),
  /** Encrypted OAuth refresh token */
  encryptedRefreshToken: text('encrypted_refresh_token'),
  /** OAuth access token expiry */
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  /** OpenAI account email from OAuth */
  oauthEmail: text('oauth_email'),
  /** Reasoning effort level: low, medium, high, xhigh */
  reasoningEffort: text('reasoning_effort'),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_api_keys_user_id').on(table.userId),
  index('idx_api_keys_user_provider').on(table.userId, table.provider),
]);
