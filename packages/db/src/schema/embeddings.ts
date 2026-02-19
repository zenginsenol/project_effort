import { index, pgTable, text, timestamp, uuid, vector } from 'drizzle-orm/pg-core';

import { tasks } from './tasks';

export const taskEmbeddings = pgTable('task_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }).unique(),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  textContent: text('text_content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
