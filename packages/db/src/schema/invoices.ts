import { pgTable, text, timestamp, uuid, numeric, index } from 'drizzle-orm/pg-core';

import { invoiceStatusEnum } from './enums';
import { organizations } from './organizations';

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  stripeInvoiceId: text('stripe_invoice_id'),
  amountPaid: numeric('amount_paid', { precision: 10, scale: 2 }),
  amountDue: numeric('amount_due', { precision: 10, scale: 2 }),
  currency: text('currency'),
  status: invoiceStatusEnum('status').notNull(),
  invoicePdf: text('invoice_pdf'),
  hostedInvoiceUrl: text('hosted_invoice_url'),
  billingPeriodStart: timestamp('billing_period_start', { withTimezone: true }),
  billingPeriodEnd: timestamp('billing_period_end', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_invoices_organization_id').on(table.organizationId),
]);
