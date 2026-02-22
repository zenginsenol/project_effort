'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';

import { useNotifications } from '@/providers/notification-provider';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

import { NotificationItem } from './notification-item';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificationClick?: (notificationId: string, link: string | null) => void;
}

export function NotificationCenter({
  isOpen,
  onClose,
  onNotificationClick,
}: NotificationCenterProps): React.ReactElement {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const utils = trpc.useUtils();
  const { socket, setUnreadCount } = useNotifications();

  // Fetch notifications with pagination
  // @ts-expect-error - notification router exists but types may not be synced yet
  const notificationsQuery = trpc.notification.list.useQuery(
    {
      page,
      limit: 20,
      unreadOnly: false,
    },
    {
      enabled: isOpen,
      retry: false,
    }
  );

  // Mark notification as read mutation
  // @ts-expect-error - notification router exists but types may not be synced yet
  const markAsReadMutation = trpc.notification.markAsRead.useMutation({
    onSuccess: async () => {
      // @ts-expect-error - notification router exists but types may not be synced yet
      await utils.notification.list.invalidate();
      // Decrement unread count
      setUnreadCount((prev) => Math.max(0, prev - 1));
    },
  });

  // Mark all notifications as read mutation
  // @ts-expect-error - notification router exists but types may not be synced yet
  const markAllAsReadMutation = trpc.notification.markAllAsRead.useMutation({
    onSuccess: async () => {
      // @ts-expect-error - notification router exists but types may not be synced yet
      await utils.notification.list.invalidate();
      // Update unread count to 0 after marking all as read
      setUnreadCount(0);
    },
  });

  // Sync unread count from API response
  useEffect(() => {
    if (notificationsQuery.data) {
      const notifications = (notificationsQuery.data as any)?.notifications ?? [];
      const count = notifications.filter((n: any) => !n.isRead).length;
      setUnreadCount(count);
    }
  }, [notificationsQuery.data, setUnreadCount]);

  // Listen for real-time notifications via WebSocket
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification: unknown): void => {
      console.log('Real-time notification received:', notification);
      // Invalidate queries to fetch fresh data
      // @ts-expect-error - notification router exists but types may not be synced yet
      void utils.notification.list.invalidate();
    };

    socket.on('notification', handleNewNotification);

    return () => {
      socket.off('notification', handleNewNotification);
    };
  }, [socket, utils]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleMarkAsRead = (notificationId: string): void => {
    markAsReadMutation.mutate({ notificationId });
  };

  const handleDismiss = (notificationId: string): void => {
    // For now, dismissing is the same as marking as read
    // In the future, this could delete the notification
    markAsReadMutation.mutate({ notificationId });
  };

  const handleNotificationClick = (notificationId: string, link: string | null): void => {
    if (onNotificationClick) {
      onNotificationClick(notificationId, link);
    }
    onClose();
  };

  const handleMarkAllAsRead = (): void => {
    markAllAsReadMutation.mutate();
  };

  const notifications = (notificationsQuery.data as any)?.notifications ?? [];
  const totalCount = (notificationsQuery.data as any)?.total ?? 0;
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;
  const hasMore = notifications.length < totalCount;

  if (!isOpen) {
    return <></>;
  }

  return (
    <div
      ref={dropdownRef}
      className={cn(
        'absolute right-0 top-full z-50 mt-2 w-96 rounded-lg border bg-card shadow-lg',
        'animate-in fade-in slide-in-from-top-2 duration-200'
      )}
      data-testid="notification-center"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={markAllAsReadMutation.isPending}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            data-testid="mark-all-read-button"
          >
            {markAllAsReadMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCheck className="h-3 w-3" />
            )}
            Mark all read
          </button>
        )}
      </div>

      {/* Notification List */}
      <div className="max-h-[32rem] overflow-y-auto">
        {notificationsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-2 text-sm font-medium text-muted-foreground">No notifications</p>
            <p className="text-xs text-muted-foreground">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-2 p-3">
            {notifications.map((notification: any) => (
              <NotificationItem
                key={notification.id}
                notification={{
                  id: notification.id,
                  type: notification.type as any,
                  title: notification.title,
                  message: notification.message,
                  link: notification.link,
                  isRead: notification.isRead,
                  createdAt: notification.createdAt,
                  metadata: notification.metadata,
                }}
                onMarkAsRead={handleMarkAsRead}
                onDismiss={handleDismiss}
                onClick={handleNotificationClick}
              />
            ))}

            {/* Load More Button */}
            {hasMore && (
              <button
                onClick={() => setPage((p) => p + 1)}
                className="w-full rounded-md border bg-background py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Load more
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="border-t px-4 py-2 text-center">
          <p className="text-xs text-muted-foreground">
            Showing {notifications.length} of {totalCount} notifications
          </p>
        </div>
      )}
    </div>
  );
}
