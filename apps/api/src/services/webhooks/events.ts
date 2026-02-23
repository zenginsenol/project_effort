import { eq, and, sql } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { webhooks, webhookDeliveries } from '@estimate-pro/db/schema';

/**
 * Webhook event types supported by the system
 */
export type WebhookEventType =
  | 'estimation.completed'
  | 'task.created'
  | 'task.updated'
  | 'analysis.exported'
  | 'sync.completed';

/**
 * Base webhook event payload structure
 */
export interface WebhookEventPayload {
  event: WebhookEventType;
  timestamp: string;
  organizationId: string;
  data: unknown;
}

/**
 * Estimation completed event payload
 */
export interface EstimationCompletedPayload extends WebhookEventPayload {
  event: 'estimation.completed';
  data: {
    sessionId: string;
    projectId: string;
    taskId: string;
    estimate: {
      points: number | null;
      hours: number | null;
      optimistic: number | null;
      mostLikely: number | null;
      pessimistic: number | null;
    };
    completedBy: string;
  };
}

/**
 * Task created event payload
 */
export interface TaskCreatedPayload extends WebhookEventPayload {
  event: 'task.created';
  data: {
    taskId: string;
    projectId: string;
    title: string;
    description: string | null;
    type: string;
    status: string;
    priority: string | null;
    createdBy: string | null;
  };
}

/**
 * Task updated event payload
 */
export interface TaskUpdatedPayload extends WebhookEventPayload {
  event: 'task.updated';
  data: {
    taskId: string;
    projectId: string;
    title: string;
    description: string | null;
    type: string;
    status: string;
    priority: string | null;
    changes: Record<string, unknown>;
    updatedBy: string | null;
  };
}

/**
 * Analysis exported event payload
 */
export interface AnalysisExportedPayload extends WebhookEventPayload {
  event: 'analysis.exported';
  data: {
    analysisId: string;
    projectId: string | null;
    type: 'project_tasks' | 'ai_text';
    format: 'pdf' | 'csv' | 'json';
    exportedBy: string;
  };
}

/**
 * Sync completed event payload
 */
export interface SyncCompletedPayload extends WebhookEventPayload {
  event: 'sync.completed';
  data: {
    integrationId: string;
    projectId: string;
    provider: 'jira' | 'azure_devops' | 'github' | 'gitlab';
    itemsImported: number;
    itemsExported: number;
    errors: string[];
  };
}

/**
 * Union type for all event payloads
 */
export type WebhookPayload =
  | EstimationCompletedPayload
  | TaskCreatedPayload
  | TaskUpdatedPayload
  | AnalysisExportedPayload
  | SyncCompletedPayload;

/**
 * Webhook event emitter service
 * Responsible for queuing webhook deliveries when events occur
 */
export class WebhookEventEmitter {
  /**
   * Emit a webhook event to all subscribed webhooks
   * Creates delivery records that will be processed by the delivery service
   */
  async emit(payload: WebhookPayload): Promise<void> {
    const { event, organizationId } = payload;

    // Find all active webhooks for this organization that are subscribed to this event type
    const activeWebhooks = await db.query.webhooks.findMany({
      where: and(
        eq(webhooks.organizationId, organizationId),
        eq(webhooks.isActive, true),
        sql`${webhooks.events}::jsonb @> ${JSON.stringify([event])}::jsonb`,
      ),
    });

    if (activeWebhooks.length === 0) {
      return;
    }

    // Create delivery records for each subscribed webhook
    // These will be picked up by the delivery service for actual HTTP delivery
    const deliveries = activeWebhooks.map((webhook) => ({
      webhookId: webhook.id,
      eventType: event,
      payload: payload as unknown as Record<string, unknown>,
      attempt: 1,
    }));

    await db.insert(webhookDeliveries).values(deliveries);

    // Update last triggered timestamp for all webhooks
    const now = new Date();
    await Promise.all(
      activeWebhooks.map((webhook) =>
        db
          .update(webhooks)
          .set({ lastTriggeredAt: now })
          .where(eq(webhooks.id, webhook.id)),
      ),
    );
  }

  /**
   * Emit an estimation.completed event
   */
  async emitEstimationCompleted(
    organizationId: string,
    data: EstimationCompletedPayload['data'],
  ): Promise<void> {
    await this.emit({
      event: 'estimation.completed',
      timestamp: new Date().toISOString(),
      organizationId,
      data,
    });
  }

  /**
   * Emit a task.created event
   */
  async emitTaskCreated(organizationId: string, data: TaskCreatedPayload['data']): Promise<void> {
    await this.emit({
      event: 'task.created',
      timestamp: new Date().toISOString(),
      organizationId,
      data,
    });
  }

  /**
   * Emit a task.updated event
   */
  async emitTaskUpdated(organizationId: string, data: TaskUpdatedPayload['data']): Promise<void> {
    await this.emit({
      event: 'task.updated',
      timestamp: new Date().toISOString(),
      organizationId,
      data,
    });
  }

  /**
   * Emit an analysis.exported event
   */
  async emitAnalysisExported(
    organizationId: string,
    data: AnalysisExportedPayload['data'],
  ): Promise<void> {
    await this.emit({
      event: 'analysis.exported',
      timestamp: new Date().toISOString(),
      organizationId,
      data,
    });
  }

  /**
   * Emit a sync.completed event
   */
  async emitSyncCompleted(
    organizationId: string,
    data: SyncCompletedPayload['data'],
  ): Promise<void> {
    await this.emit({
      event: 'sync.completed',
      timestamp: new Date().toISOString(),
      organizationId,
      data,
    });
  }
}

/**
 * Singleton instance of the webhook event emitter
 */
export const webhookEventEmitter = new WebhookEventEmitter();
