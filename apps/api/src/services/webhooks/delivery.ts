import { createHmac } from 'node:crypto';

import { eq, and, isNull, lt } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { webhooks, webhookDeliveries } from '@estimate-pro/db/schema';

/**
 * Maximum number of delivery attempts before giving up
 */
const MAX_ATTEMPTS = 3;

/**
 * Base delay for exponential backoff (in milliseconds)
 */
const BASE_DELAY_MS = 1000;

/**
 * HTTP timeout for webhook requests (10 seconds)
 */
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
function generateSignature(payload: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

/**
 * Calculate exponential backoff delay
 * Attempt 1: 1s, Attempt 2: 4s, Attempt 3: 16s
 */
function calculateBackoffDelay(attempt: number): number {
  return BASE_DELAY_MS * Math.pow(4, attempt - 1);
}

/**
 * Deliver a single webhook with timeout
 */
async function deliverWithTimeout(
  url: string,
  payload: string,
  signature: string,
  timeoutMs: number,
): Promise<{ status: number; body: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'User-Agent': 'EstimatePro-Webhooks/1.0',
      },
      body: payload,
      signal: controller.signal,
    });

    const body = await response.text();

    return {
      status: response.status,
      body: body.substring(0, 1000), // Limit response body to 1000 chars
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Webhook delivery service
 * Processes pending webhook deliveries with retry logic and exponential backoff
 */
export class WebhookDeliveryService {
  /**
   * Process a single webhook delivery
   */
  async processDelivery(deliveryId: string): Promise<void> {
    // Fetch delivery with associated webhook
    const delivery = await db.query.webhookDeliveries.findFirst({
      where: eq(webhookDeliveries.id, deliveryId),
      with: {
        webhook: true,
      },
    });

    if (!delivery) {
      throw new Error(`Delivery ${deliveryId} not found`);
    }

    const webhook = await db.query.webhooks.findFirst({
      where: eq(webhooks.id, delivery.webhookId),
    });

    if (!webhook) {
      throw new Error(`Webhook ${delivery.webhookId} not found`);
    }

    // Skip if webhook is inactive
    if (!webhook.isActive) {
      return;
    }

    // Skip if already delivered
    if (delivery.deliveredAt) {
      return;
    }

    // Skip if max attempts exceeded
    if (delivery.attempt > MAX_ATTEMPTS) {
      return;
    }

    const payloadString = JSON.stringify(delivery.payload);
    const signature = generateSignature(payloadString, webhook.secret);

    try {
      // Attempt delivery
      const { status, body } = await deliverWithTimeout(
        webhook.url,
        payloadString,
        signature,
        REQUEST_TIMEOUT_MS,
      );

      // Consider 2xx status codes as successful
      const isSuccess = status >= 200 && status < 300;

      if (isSuccess) {
        // Mark as delivered
        await db
          .update(webhookDeliveries)
          .set({
            deliveredAt: new Date(),
            responseStatus: status,
            responseBody: body,
          })
          .where(eq(webhookDeliveries.id, deliveryId));
      } else {
        // Delivery failed, increment attempt counter
        await db
          .update(webhookDeliveries)
          .set({
            attempt: delivery.attempt + 1,
            responseStatus: status,
            responseBody: body,
          })
          .where(eq(webhookDeliveries.id, deliveryId));

        // Schedule retry if not exceeded max attempts
        if (delivery.attempt < MAX_ATTEMPTS) {
          const delay = calculateBackoffDelay(delivery.attempt + 1);
          setTimeout(() => {
            this.processDelivery(deliveryId).catch((error) => {
              // Log error but don't throw to prevent crashing the process
              // In production, this should use a proper logging service
            });
          }, delay);
        }
      }
    } catch (error) {
      // Network error, timeout, or other failure
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Increment attempt counter
      await db
        .update(webhookDeliveries)
        .set({
          attempt: delivery.attempt + 1,
          responseStatus: 0, // 0 indicates network/timeout error
          responseBody: errorMessage.substring(0, 1000),
        })
        .where(eq(webhookDeliveries.id, deliveryId));

      // Schedule retry if not exceeded max attempts
      if (delivery.attempt < MAX_ATTEMPTS) {
        const delay = calculateBackoffDelay(delivery.attempt + 1);
        setTimeout(() => {
          this.processDelivery(deliveryId).catch((error) => {
            // Log error but don't throw
          });
        }, delay);
      }
    }
  }

  /**
   * Process all pending webhook deliveries
   * Should be called periodically (e.g., every minute) or triggered by a queue
   */
  async processPendingDeliveries(): Promise<void> {
    // Find all undelivered webhooks that haven't exceeded max attempts
    const pendingDeliveries = await db.query.webhookDeliveries.findMany({
      where: and(isNull(webhookDeliveries.deliveredAt), lt(webhookDeliveries.attempt, MAX_ATTEMPTS)),
      limit: 100, // Process in batches
    });

    // Process deliveries in parallel (with concurrency limit in production)
    await Promise.allSettled(
      pendingDeliveries.map((delivery) => this.processDelivery(delivery.id)),
    );
  }

  /**
   * Retry a failed delivery manually
   */
  async retryDelivery(deliveryId: string): Promise<void> {
    // Reset attempt counter to allow retry
    await db
      .update(webhookDeliveries)
      .set({
        attempt: 1,
        responseStatus: null,
        responseBody: null,
      })
      .where(eq(webhookDeliveries.id, deliveryId));

    await this.processDelivery(deliveryId);
  }
}

/**
 * Singleton instance of the webhook delivery service
 */
export const webhookDeliveryService = new WebhookDeliveryService();
