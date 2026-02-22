import { TRPCError } from '@trpc/server';
import { eq, and, desc } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { webhooks, webhookDeliveries } from '@estimate-pro/db/schema';

import { webhookDeliveryService } from '../../services/webhooks/delivery';
import { orgProcedure, router } from '../../trpc/trpc';

import {
  listWebhooksInput,
  createWebhookInput,
  updateWebhookInput,
  deleteWebhookInput,
  getDeliveriesInput,
  retryDeliveryInput,
} from './schema';

export const webhooksRouter = router({
  /**
   * List all webhooks for an organization
   */
  list: orgProcedure.input(listWebhooksInput).query(async ({ input }) => {
    const { organizationId } = input;

    const result = await db.query.webhooks.findMany({
      where: eq(webhooks.organizationId, organizationId),
      orderBy: [desc(webhooks.createdAt)],
    });

    return result;
  }),

  /**
   * Create a new webhook
   */
  create: orgProcedure.input(createWebhookInput).mutation(async ({ input }) => {
    const { organizationId, url, events, secret } = input;

    const [webhook] = await db
      .insert(webhooks)
      .values({
        organizationId,
        url,
        events: events as unknown as Record<string, unknown>,
        secret,
        isActive: true,
      })
      .returning();

    if (!webhook) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create webhook',
      });
    }

    return webhook;
  }),

  /**
   * Update an existing webhook
   */
  update: orgProcedure.input(updateWebhookInput).mutation(async ({ input, ctx }) => {
    const { webhookId, url, events, isActive } = input;

    // Verify webhook exists and belongs to organization
    const existing = await db.query.webhooks.findFirst({
      where: eq(webhooks.id, webhookId),
    });

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Webhook not found',
      });
    }

    if (existing.organizationId !== ctx.organization?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    }

    // Build update object with only provided fields
    const updateData: {
      url?: string;
      events?: Record<string, unknown>;
      isActive?: boolean;
    } = {};

    if (url !== undefined) updateData.url = url;
    if (events !== undefined) updateData.events = events as unknown as Record<string, unknown>;
    if (isActive !== undefined) updateData.isActive = isActive;

    const [updated] = await db
      .update(webhooks)
      .set(updateData)
      .where(eq(webhooks.id, webhookId))
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update webhook',
      });
    }

    return updated;
  }),

  /**
   * Delete a webhook
   */
  delete: orgProcedure.input(deleteWebhookInput).mutation(async ({ input, ctx }) => {
    const { webhookId } = input;

    // Verify webhook exists and belongs to organization
    const existing = await db.query.webhooks.findFirst({
      where: eq(webhooks.id, webhookId),
    });

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Webhook not found',
      });
    }

    if (existing.organizationId !== ctx.organization?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    }

    await db.delete(webhooks).where(eq(webhooks.id, webhookId));

    return { success: true };
  }),

  /**
   * Get delivery history for a webhook
   */
  getDeliveries: orgProcedure.input(getDeliveriesInput).query(async ({ input, ctx }) => {
    const { webhookId, limit, offset } = input;

    // Verify webhook exists and belongs to organization
    const webhook = await db.query.webhooks.findFirst({
      where: eq(webhooks.id, webhookId),
    });

    if (!webhook) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Webhook not found',
      });
    }

    if (webhook.organizationId !== ctx.organization?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    }

    const deliveries = await db.query.webhookDeliveries.findMany({
      where: eq(webhookDeliveries.webhookId, webhookId),
      orderBy: [desc(webhookDeliveries.createdAt)],
      limit,
      offset,
    });

    return deliveries;
  }),

  /**
   * Manually retry a failed delivery
   */
  retryDelivery: orgProcedure.input(retryDeliveryInput).mutation(async ({ input, ctx }) => {
    const { deliveryId } = input;

    // Fetch delivery with webhook to verify access
    const delivery = await db.query.webhookDeliveries.findFirst({
      where: eq(webhookDeliveries.id, deliveryId),
    });

    if (!delivery) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Delivery not found',
      });
    }

    // Verify webhook belongs to organization
    const webhook = await db.query.webhooks.findFirst({
      where: eq(webhooks.id, delivery.webhookId),
    });

    if (!webhook) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Webhook not found',
      });
    }

    if (webhook.organizationId !== ctx.organization?.id) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    }

    // Check if delivery was already successful
    if (delivery.deliveredAt) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Delivery already succeeded',
      });
    }

    // Retry the delivery
    await webhookDeliveryService.retryDelivery(deliveryId);

    return { success: true };
  }),
});
