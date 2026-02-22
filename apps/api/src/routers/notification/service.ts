import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@estimate-pro/db';
import { notificationPreferences, notifications } from '@estimate-pro/db/schema';

import { hasNotificationAccess } from '../../services/security/tenant-access';
import { emitNotificationToUser } from '../../websocket';
import { createNotificationInput, updatePreferenceInput } from './schema';

export class NotificationService {
  async create(orgId: string, data: z.infer<typeof createNotificationInput>) {
    const [notification] = await db.insert(notifications).values({
      organizationId: orgId,
      ...data,
    }).returning();
    return notification;
  }

  /**
   * Create a notification and emit it via WebSocket to the user in real-time
   */
  async createAndEmit(orgId: string, data: z.infer<typeof createNotificationInput>) {
    const notification = await this.create(orgId, data);

    // Emit notification to user via WebSocket
    emitNotificationToUser(data.userId, {
      notificationId: notification.id,
      userId: notification.userId,
      type: notification.type,
      data: {
        title: notification.title,
        message: notification.message,
        link: notification.link,
        metadata: notification.metadata,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      },
    });

    return notification;
  }

  async getById(id: string, orgId: string) {
    const allowed = await hasNotificationAccess(id, orgId);
    if (!allowed) {
      return null;
    }
    return db.query.notifications.findFirst({
      where: eq(notifications.id, id),
    }) ?? null;
  }

  async update(id: string, orgId: string, data: Record<string, unknown>) {
    const allowed = await hasNotificationAccess(id, orgId);
    if (!allowed) {
      return null;
    }
    const [notification] = await db
      .update(notifications)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(notifications.id, id))
      .returning();
    return notification;
  }

  async list(orgId: string, userId: string, filters?: {
    limit?: number;
    offset?: number;
    isRead?: boolean;
    type?: string;
  }) {
    const conditions = [
      eq(notifications.organizationId, orgId),
      eq(notifications.userId, userId),
    ];

    if (filters?.isRead !== undefined) {
      conditions.push(eq(notifications.isRead, filters.isRead));
    }
    if (filters?.type) {
      conditions.push(eq(notifications.type, filters.type as typeof notifications.type.enumValues[number]));
    }

    return db.query.notifications.findMany({
      where: and(...conditions),
      orderBy: desc(notifications.createdAt),
      limit: filters?.limit ?? 20,
      offset: filters?.offset ?? 0,
    });
  }

  async delete(id: string, orgId: string) {
    const allowed = await hasNotificationAccess(id, orgId);
    if (!allowed) {
      return null;
    }
    const [notification] = await db.delete(notifications).where(eq(notifications.id, id)).returning();
    return notification;
  }

  async markAsRead(id: string, orgId: string) {
    const allowed = await hasNotificationAccess(id, orgId);
    if (!allowed) {
      return null;
    }
    const [notification] = await db
      .update(notifications)
      .set({ isRead: true, updatedAt: new Date() })
      .where(eq(notifications.id, id))
      .returning();
    return notification;
  }

  async markAllAsRead(orgId: string, userId: string) {
    const result = await db
      .update(notifications)
      .set({ isRead: true, updatedAt: new Date() })
      .where(and(
        eq(notifications.organizationId, orgId),
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ))
      .returning();
    return result;
  }

  async getPreferences(orgId: string, userId: string) {
    return db.query.notificationPreferences.findMany({
      where: and(
        eq(notificationPreferences.organizationId, orgId),
        eq(notificationPreferences.userId, userId)
      ),
    });
  }

  async updatePreference(orgId: string, userId: string, data: z.infer<typeof updatePreferenceInput>) {
    const existing = await db.query.notificationPreferences.findFirst({
      where: and(
        eq(notificationPreferences.organizationId, orgId),
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.notificationType, data.notificationType)
      ),
    });

    if (existing) {
      const [preference] = await db
        .update(notificationPreferences)
        .set({ enabled: data.enabled, updatedAt: new Date() })
        .where(eq(notificationPreferences.id, existing.id))
        .returning();
      return preference;
    }

    const [preference] = await db.insert(notificationPreferences).values({
      organizationId: orgId,
      userId,
      notificationType: data.notificationType,
      enabled: data.enabled,
    }).returning();
    return preference;
  }
}

export const notificationService = new NotificationService();
