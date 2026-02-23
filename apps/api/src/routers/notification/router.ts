import { TRPCError } from '@trpc/server';

import { orgProcedure, router } from '../../trpc/trpc';

import {
  createNotificationInput,
  getNotificationInput,
  listNotificationsInput,
  markAsReadInput,
  markAllAsReadInput,
  getPreferencesInput,
  updatePreferenceInput,
} from './schema';
import { notificationService } from './service';

export const notificationRouter = router({
  create: orgProcedure
    .input(createNotificationInput)
    .mutation(async ({ ctx, input }) => {
      const notification = await notificationService.create(ctx.orgId, input);
      return notification;
    }),

  getById: orgProcedure
    .input(getNotificationInput)
    .query(async ({ ctx, input }) => {
      const notification = await notificationService.getById(input.id, ctx.orgId);
      if (!notification) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Notification not found' });
      }
      return notification;
    }),

  list: orgProcedure
    .input(listNotificationsInput)
    .query(async ({ ctx, input }) => {
      return notificationService.list(ctx.orgId, ctx.userId, input);
    }),

  markAsRead: orgProcedure
    .input(markAsReadInput)
    .mutation(async ({ ctx, input }) => {
      const notification = await notificationService.markAsRead(input.id, ctx.orgId);
      if (!notification) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Notification not found' });
      }
      return notification;
    }),

  markAllAsRead: orgProcedure
    .input(markAllAsReadInput)
    .mutation(async ({ ctx, input }) => {
      return notificationService.markAllAsRead(ctx.orgId, input.userId);
    }),

  getPreferences: orgProcedure
    .input(getPreferencesInput)
    .query(async ({ ctx, input }) => {
      return notificationService.getPreferences(ctx.orgId, input.userId);
    }),

  updatePreference: orgProcedure
    .input(updatePreferenceInput)
    .mutation(async ({ ctx, input }) => {
      return notificationService.updatePreference(ctx.orgId, ctx.userId, input);
    }),

  delete: orgProcedure
    .input(getNotificationInput)
    .mutation(async ({ ctx, input }) => {
      const notification = await notificationService.delete(input.id, ctx.orgId);
      if (!notification) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Notification not found' });
      }
      return notification;
    }),
});
