import { z } from 'zod';

const webhookEventTypeSchema = z.enum([
  'estimation.completed',
  'task.created',
  'task.updated',
  'analysis.exported',
  'sync.completed',
]);

export const listWebhooksInput = z.object({
  organizationId: z.string().uuid(),
});

export const createWebhookInput = z.object({
  organizationId: z.string().uuid(),
  url: z.string().url(),
  events: z.array(webhookEventTypeSchema).min(1, 'At least one event type is required'),
  secret: z.string().min(16, 'Secret must be at least 16 characters'),
});

export const updateWebhookInput = z.object({
  webhookId: z.string().uuid(),
  url: z.string().url().optional(),
  events: z.array(webhookEventTypeSchema).min(1).optional(),
  isActive: z.boolean().optional(),
});

export const deleteWebhookInput = z.object({
  webhookId: z.string().uuid(),
});

export const getDeliveriesInput = z.object({
  webhookId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const retryDeliveryInput = z.object({
  deliveryId: z.string().uuid(),
});
