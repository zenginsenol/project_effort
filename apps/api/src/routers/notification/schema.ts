import { z } from 'zod';

export const notificationTypeEnum = z.enum([
  'session_invitation',
  'vote_reminder',
  'session_complete',
  'task_assigned',
  'task_status_change',
  'sync_complete',
  'mention_in_comment',
]);

export const createNotificationInput = z.object({
  userId: z.string().uuid(),
  type: notificationTypeEnum,
  title: z.string().min(1).max(500),
  message: z.string().min(1).max(2000),
  link: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const getNotificationInput = z.object({
  id: z.string().uuid(),
});

export const listNotificationsInput = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  isRead: z.boolean().optional(),
  type: notificationTypeEnum.optional(),
});

export const markAsReadInput = z.object({
  id: z.string().uuid(),
});

export const markAllAsReadInput = z.object({
  userId: z.string().uuid(),
});

export const getPreferencesInput = z.object({
  userId: z.string().uuid(),
});

export const updatePreferenceInput = z.object({
  notificationType: notificationTypeEnum,
  enabled: z.boolean(),
});
