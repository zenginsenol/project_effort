import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import {
  createNotificationInput,
  listNotificationsInput,
  markAsReadInput,
  updatePreferenceInput,
  notificationTypeEnum,
} from '../schema';

describe('Notification Schemas', () => {
  describe('notificationTypeEnum', () => {
    it('accepts valid notification types', () => {
      const validTypes = [
        'session_invitation',
        'vote_reminder',
        'session_complete',
        'task_assigned',
        'task_status_change',
        'sync_complete',
        'mention_in_comment',
      ];

      validTypes.forEach((type) => {
        expect(() => notificationTypeEnum.parse(type)).not.toThrow();
      });
    });

    it('rejects invalid notification type', () => {
      expect(() => notificationTypeEnum.parse('invalid_type')).toThrow(ZodError);
    });
  });

  describe('createNotificationInput', () => {
    it('validates required fields', () => {
      const validInput = {
        userId: 'user-123',
        type: 'task_assigned',
        title: 'Task Assigned',
        message: 'You have been assigned a task',
      };

      expect(() => createNotificationInput.parse(validInput)).not.toThrow();
    });

    it('rejects invalid notification type', () => {
      const invalidInput = {
        userId: 'user-123',
        type: 'invalid_type',
        title: 'Test',
        message: 'Test message',
      };

      expect(() => createNotificationInput.parse(invalidInput)).toThrow(ZodError);
    });

    it('accepts optional fields', () => {
      const validInput = {
        userId: 'user-123',
        type: 'task_assigned',
        title: 'Task Assigned',
        message: 'You have been assigned a task',
        link: '/tasks/123',
        metadata: { taskId: '123' },
      };

      const result = createNotificationInput.parse(validInput);

      expect(result.link).toBe('/tasks/123');
      expect(result.metadata).toEqual({ taskId: '123' });
    });

    it('requires userId', () => {
      const invalidInput = {
        type: 'task_assigned',
        title: 'Task Assigned',
        message: 'You have been assigned a task',
      };

      expect(() => createNotificationInput.parse(invalidInput)).toThrow(ZodError);
    });

    it('requires type', () => {
      const invalidInput = {
        userId: 'user-123',
        title: 'Task Assigned',
        message: 'You have been assigned a task',
      };

      expect(() => createNotificationInput.parse(invalidInput)).toThrow(ZodError);
    });

    it('requires title', () => {
      const invalidInput = {
        userId: 'user-123',
        type: 'task_assigned',
        message: 'You have been assigned a task',
      };

      expect(() => createNotificationInput.parse(invalidInput)).toThrow(ZodError);
    });

    it('requires message', () => {
      const invalidInput = {
        userId: 'user-123',
        type: 'task_assigned',
        title: 'Task Assigned',
      };

      expect(() => createNotificationInput.parse(invalidInput)).toThrow(ZodError);
    });
  });

  describe('listNotificationsInput', () => {
    it('validates pagination parameters', () => {
      const validInput = {
        limit: 20,
        offset: 0,
      };

      expect(() => listNotificationsInput.parse(validInput)).not.toThrow();
    });

    it('accepts default values', () => {
      const result = listNotificationsInput.parse({});

      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('enforces max limit', () => {
      const invalidInput = {
        limit: 150,
      };

      expect(() => listNotificationsInput.parse(invalidInput)).toThrow(ZodError);
    });

    it('accepts limit within range', () => {
      const validInput = {
        limit: 50,
      };

      expect(() => listNotificationsInput.parse(validInput)).not.toThrow();
    });

    it('accepts isRead filter', () => {
      const validInput = {
        isRead: true,
      };

      const result = listNotificationsInput.parse(validInput);

      expect(result.isRead).toBe(true);
    });

    it('accepts isRead false', () => {
      const validInput = {
        isRead: false,
      };

      const result = listNotificationsInput.parse(validInput);

      expect(result.isRead).toBe(false);
    });

    it('accepts undefined isRead', () => {
      const result = listNotificationsInput.parse({});

      expect(result.isRead).toBeUndefined();
    });
  });

  describe('markAsReadInput', () => {
    it('validates notification ID', () => {
      const validInput = {
        id: 'notif-123',
      };

      expect(() => markAsReadInput.parse(validInput)).not.toThrow();
    });

    it('requires id field', () => {
      expect(() => markAsReadInput.parse({})).toThrow(ZodError);
    });

    it('rejects empty string', () => {
      const invalidInput = {
        id: '',
      };

      expect(() => markAsReadInput.parse(invalidInput)).toThrow(ZodError);
    });
  });

  describe('updatePreferenceInput', () => {
    it('validates enabled boolean', () => {
      const validInput = {
        notificationType: 'task_assigned',
        enabled: true,
      };

      expect(() => updatePreferenceInput.parse(validInput)).not.toThrow();
    });

    it('validates enabled false', () => {
      const validInput = {
        notificationType: 'task_assigned',
        enabled: false,
      };

      const result = updatePreferenceInput.parse(validInput);

      expect(result.enabled).toBe(false);
    });

    it('validates notification type enum', () => {
      const validInput = {
        notificationType: 'session_invitation',
        enabled: true,
      };

      expect(() => updatePreferenceInput.parse(validInput)).not.toThrow();
    });

    it('rejects invalid notification type', () => {
      const invalidInput = {
        notificationType: 'invalid_type',
        enabled: true,
      };

      expect(() => updatePreferenceInput.parse(invalidInput)).toThrow(ZodError);
    });

    it('requires notificationType', () => {
      const invalidInput = {
        enabled: true,
      };

      expect(() => updatePreferenceInput.parse(invalidInput)).toThrow(ZodError);
    });

    it('requires enabled', () => {
      const invalidInput = {
        notificationType: 'task_assigned',
      };

      expect(() => updatePreferenceInput.parse(invalidInput)).toThrow(ZodError);
    });

    it('accepts all notification types', () => {
      const types = [
        'session_invitation',
        'vote_reminder',
        'session_complete',
        'task_assigned',
        'task_status_change',
        'sync_complete',
        'mention_in_comment',
      ];

      types.forEach((type) => {
        const input = {
          notificationType: type,
          enabled: true,
        };

        expect(() => updatePreferenceInput.parse(input)).not.toThrow();
      });
    });
  });
});
