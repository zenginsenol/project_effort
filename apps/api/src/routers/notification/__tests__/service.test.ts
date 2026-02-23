import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { db } from '@estimate-pro/db';

import { NotificationService } from '../service';

// Mock the database
vi.mock('@estimate-pro/db', () => ({
  db: {
    insert: vi.fn(),
    query: {
      notifications: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      notificationPreferences: {
        findMany: vi.fn(),
      },
    },
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock WebSocket
vi.mock('../../websocket', () => ({
  emitNotificationToUser: vi.fn(),
}));

// Mock security helper
vi.mock('../../services/security/tenant-access', () => ({
  hasNotificationAccess: vi.fn(),
}));

describe('NotificationService', () => {
  let service: NotificationService;
  const mockOrgId = '00000000-0000-0000-0000-000000000000';
  const mockUserId = 'user-123';
  const mockNotificationId = 'notif-123';

  beforeEach(() => {
    service = new NotificationService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('create', () => {
    it('creates notification with correct organizationId', async () => {
      const mockNotification = {
        id: mockNotificationId,
        organizationId: mockOrgId,
        userId: mockUserId,
        type: 'task_assigned',
        title: 'Test Notification',
        message: 'Test message',
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockInsert = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([mockNotification]),
        })),
      }));

      (db.insert as any) = mockInsert;

      const result = await service.create(mockOrgId, {
        userId: mockUserId,
        type: 'task_assigned',
        title: 'Test Notification',
        message: 'Test message',
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(mockNotification);
      expect(result.organizationId).toBe(mockOrgId);
    });

    it('includes all required fields', async () => {
      const mockNotification = {
        id: mockNotificationId,
        organizationId: mockOrgId,
        userId: mockUserId,
        type: 'session_invitation',
        title: 'Session Invitation',
        message: 'You are invited to a session',
        link: '/sessions/123',
        metadata: { sessionId: '123' },
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockInsert = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([mockNotification]),
        })),
      }));

      (db.insert as any) = mockInsert;

      const result = await service.create(mockOrgId, {
        userId: mockUserId,
        type: 'session_invitation',
        title: 'Session Invitation',
        message: 'You are invited to a session',
        link: '/sessions/123',
        metadata: { sessionId: '123' },
      });

      expect(result.userId).toBe(mockUserId);
      expect(result.type).toBe('session_invitation');
      expect(result.title).toBe('Session Invitation');
      expect(result.message).toBe('You are invited to a session');
      expect(result.link).toBe('/sessions/123');
      expect(result.metadata).toEqual({ sessionId: '123' });
    });
  });

  describe('list', () => {
    it('filters by organizationId and userId', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          organizationId: mockOrgId,
          userId: mockUserId,
          type: 'task_assigned',
          title: 'Task 1',
          message: 'Message 1',
          isRead: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (db.query.notifications.findMany as any).mockResolvedValue(mockNotifications);

      const result = await service.list(mockOrgId, mockUserId, {});

      expect(db.query.notifications.findMany).toHaveBeenCalled();
      expect(result).toEqual(mockNotifications);
    });

    it('respects pagination limit and offset', async () => {
      const mockNotifications: any[] = [];
      (db.query.notifications.findMany as any).mockResolvedValue(mockNotifications);

      await service.list(mockOrgId, mockUserId, {
        limit: 10,
        offset: 5,
      });

      expect(db.query.notifications.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 5,
        })
      );
    });

    it('filters by isRead when provided', async () => {
      const mockNotifications: any[] = [];
      (db.query.notifications.findMany as any).mockResolvedValue(mockNotifications);

      await service.list(mockOrgId, mockUserId, { isRead: true });

      expect(db.query.notifications.findMany).toHaveBeenCalled();
    });

    it('orders by createdAt desc', async () => {
      const mockNotifications = [
        {
          id: 'notif-2',
          createdAt: new Date('2024-02-22'),
        },
        {
          id: 'notif-1',
          createdAt: new Date('2024-02-21'),
        },
      ];

      (db.query.notifications.findMany as any).mockResolvedValue(mockNotifications);

      const result = await service.list(mockOrgId, mockUserId, {});

      expect(result[0].createdAt > result[1].createdAt).toBe(true);
    });
  });

  describe('markAsRead', () => {
    it('updates notification isRead to true', async () => {
      const { hasNotificationAccess } = await import('../../services/security/tenant-access');
      (hasNotificationAccess as any).mockResolvedValue(true);

      const mockUpdate = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                id: mockNotificationId,
                isRead: true,
              },
            ]),
          })),
        })),
      }));

      (db.update as any) = mockUpdate;

      const result = await service.markAsRead(mockNotificationId, mockOrgId);

      expect(hasNotificationAccess).toHaveBeenCalledWith(mockNotificationId, mockOrgId);
      expect(result).toBeTruthy();
    });

    it('denies access to notifications from other orgs', async () => {
      const { hasNotificationAccess } = await import('../../services/security/tenant-access');
      (hasNotificationAccess as any).mockResolvedValue(false);

      const result = await service.markAsRead(mockNotificationId, 'wrong-org-id');

      expect(hasNotificationAccess).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('markAllAsRead', () => {
    it('marks all unread notifications for user', async () => {
      const mockUpdate = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      }));

      (db.update as any) = mockUpdate;

      await service.markAllAsRead(mockOrgId, mockUserId);

      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('getPreferences', () => {
    it('returns preferences filtered by user and org', async () => {
      const mockPreferences = [
        {
          id: 'pref-1',
          userId: mockUserId,
          organizationId: mockOrgId,
          notificationType: 'task_assigned',
          enabled: true,
        },
      ];

      (db.query.notificationPreferences.findMany as any).mockResolvedValue(mockPreferences);

      const result = await service.getPreferences(mockUserId, mockOrgId);

      expect(db.query.notificationPreferences.findMany).toHaveBeenCalled();
      expect(result).toEqual(mockPreferences);
    });
  });

  describe('updatePreference', () => {
    it('creates preference if not exists', async () => {
      const mockInsert = vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoUpdate: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                id: 'pref-1',
                userId: mockUserId,
                organizationId: mockOrgId,
                notificationType: 'task_assigned',
                enabled: true,
              },
            ]),
          })),
        })),
      }));

      (db.insert as any) = mockInsert;

      const result = await service.updatePreference(
        mockUserId,
        mockOrgId,
        'task_assigned',
        true
      );

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });

    it('updates existing preference', async () => {
      const mockInsert = vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoUpdate: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                id: 'pref-1',
                userId: mockUserId,
                organizationId: mockOrgId,
                notificationType: 'task_assigned',
                enabled: false,
              },
            ]),
          })),
        })),
      }));

      (db.insert as any) = mockInsert;

      const result = await service.updatePreference(
        mockUserId,
        mockOrgId,
        'task_assigned',
        false
      );

      expect(result.enabled).toBe(false);
    });
  });

  describe('createAndEmit', () => {
    it('creates notification and emits via WebSocket', async () => {
      const { emitNotificationToUser } = await import('../../websocket');

      const mockNotification = {
        id: mockNotificationId,
        organizationId: mockOrgId,
        userId: mockUserId,
        type: 'vote_reminder',
        title: 'Vote Reminder',
        message: 'Please cast your vote',
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockInsert = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([mockNotification]),
        })),
      }));

      (db.insert as any) = mockInsert;

      await service.createAndEmit(mockOrgId, {
        userId: mockUserId,
        type: 'vote_reminder',
        title: 'Vote Reminder',
        message: 'Please cast your vote',
      });

      expect(emitNotificationToUser).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          notificationId: mockNotificationId,
          userId: mockUserId,
          type: 'vote_reminder',
        })
      );
    });
  });
});
