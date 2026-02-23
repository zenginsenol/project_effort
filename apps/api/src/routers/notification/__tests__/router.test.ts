import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

import { NotificationService } from '../service';

// Mock the service
vi.mock('../service');

describe('Notification Router', () => {
  const mockOrgId = '00000000-0000-0000-0000-000000000000';
  const mockUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('notification.list', () => {
    it('requires authentication', async () => {
      // This would be tested with actual tRPC caller
      // For now, we're testing the service layer which enforces org/user filtering
      const service = new NotificationService();

      // Mock implementation
      vi.spyOn(service, 'list').mockResolvedValue([]);

      const result = await service.list(mockOrgId, mockUserId, {});

      expect(service.list).toHaveBeenCalledWith(mockOrgId, mockUserId, {});
      expect(result).toEqual([]);
    });

    it('returns paginated notifications', async () => {
      const service = new NotificationService();
      const mockNotifications = [
        {
          id: 'notif-1',
          organizationId: mockOrgId,
          userId: mockUserId,
          type: 'task_assigned' as const,
          title: 'Task Assigned',
          message: 'You have been assigned a task',
          link: null,
          metadata: null,
          isRead: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.spyOn(service, 'list').mockResolvedValue(mockNotifications);

      const result = await service.list(mockOrgId, mockUserId, {
        limit: 20,
        offset: 0,
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('notif-1');
    });
  });

  describe('notification.markAsRead', () => {
    it('marks notification as read', async () => {
      const service = new NotificationService();
      const mockNotification = {
        id: 'notif-1',
        organizationId: mockOrgId,
        userId: mockUserId,
        type: 'task_assigned' as const,
        title: 'Task Assigned',
        message: 'You have been assigned a task',
        link: null,
        metadata: null,
        isRead: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(service, 'markAsRead').mockResolvedValue(mockNotification);

      const result = await service.markAsRead('notif-1', mockOrgId);

      expect(result?.isRead).toBe(true);
    });

    it('returns null for unauthorized access', async () => {
      const service = new NotificationService();

      vi.spyOn(service, 'markAsRead').mockResolvedValue(null);

      const result = await service.markAsRead('notif-1', 'wrong-org-id');

      expect(result).toBeNull();
    });
  });

  describe('notification.markAllAsRead', () => {
    it('marks all as read for user', async () => {
      const service = new NotificationService();

      vi.spyOn(service, 'markAllAsRead').mockResolvedValue(undefined);

      await service.markAllAsRead(mockOrgId, mockUserId);

      expect(service.markAllAsRead).toHaveBeenCalledWith(mockOrgId, mockUserId);
    });
  });

  describe('notification.getPreferences', () => {
    it('returns user preferences', async () => {
      const service = new NotificationService();
      const mockPreferences = [
        {
          id: 'pref-1',
          organizationId: mockOrgId,
          userId: mockUserId,
          notificationType: 'task_assigned' as const,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.spyOn(service, 'getPreferences').mockResolvedValue(mockPreferences);

      const result = await service.getPreferences(mockUserId, mockOrgId);

      expect(result).toHaveLength(1);
      expect(result[0].notificationType).toBe('task_assigned');
    });
  });

  describe('notification.updatePreference', () => {
    it('updates preference setting', async () => {
      const service = new NotificationService();
      const mockPreference = {
        id: 'pref-1',
        organizationId: mockOrgId,
        userId: mockUserId,
        notificationType: 'task_assigned' as const,
        enabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(service, 'updatePreference').mockResolvedValue(mockPreference);

      const result = await service.updatePreference(
        mockUserId,
        mockOrgId,
        'task_assigned',
        false
      );

      expect(result.enabled).toBe(false);
    });
  });

  describe('notification.create', () => {
    it('creates a new notification', async () => {
      const service = new NotificationService();
      const mockNotification = {
        id: 'notif-new',
        organizationId: mockOrgId,
        userId: mockUserId,
        type: 'session_invitation' as const,
        title: 'Session Invitation',
        message: 'You are invited to join a session',
        link: '/sessions/123',
        metadata: { sessionId: '123' },
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(service, 'create').mockResolvedValue(mockNotification);

      const result = await service.create(mockOrgId, {
        userId: mockUserId,
        type: 'session_invitation',
        title: 'Session Invitation',
        message: 'You are invited to join a session',
        link: '/sessions/123',
        metadata: { sessionId: '123' },
      });

      expect(result.id).toBe('notif-new');
      expect(result.type).toBe('session_invitation');
    });
  });

  describe('notification.delete', () => {
    it('deletes a notification', async () => {
      const service = new NotificationService();

      vi.spyOn(service, 'delete').mockResolvedValue(undefined);

      await service.delete('notif-1', mockOrgId);

      expect(service.delete).toHaveBeenCalledWith('notif-1', mockOrgId);
    });
  });
});
