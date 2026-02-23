'use client';

import { useState } from 'react';
import { Bell, CheckCircle2, Clock, Mail, MessageSquare, Users, X, Zap } from 'lucide-react';

import { cn } from '@/lib/utils';

type NotificationType =
  | 'session_invitation'
  | 'vote_reminder'
  | 'session_complete'
  | 'task_assigned'
  | 'task_status_change'
  | 'sync_complete'
  | 'mention_in_comment';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date | string;
  metadata?: Record<string, unknown> | null;
}

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (notificationId: string) => void;
  onDismiss?: (notificationId: string) => void;
  onClick?: (notificationId: string, link: string | null) => void;
}

const NOTIFICATION_ICONS: Record<NotificationType, React.ElementType> = {
  session_invitation: Users,
  vote_reminder: Clock,
  session_complete: CheckCircle2,
  task_assigned: Bell,
  task_status_change: Zap,
  sync_complete: CheckCircle2,
  mention_in_comment: MessageSquare,
};

const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  session_invitation: 'text-blue-600 bg-blue-50',
  vote_reminder: 'text-orange-600 bg-orange-50',
  session_complete: 'text-green-600 bg-green-50',
  task_assigned: 'text-purple-600 bg-purple-50',
  task_status_change: 'text-yellow-600 bg-yellow-50',
  sync_complete: 'text-green-600 bg-green-50',
  mention_in_comment: 'text-indigo-600 bg-indigo-50',
};

function getRelativeTime(date: Date | string): string {
  const now = new Date();
  const notificationDate = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - notificationDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return notificationDate.toLocaleDateString();
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDismiss,
  onClick
}: NotificationItemProps): React.ReactElement {
  const [isHovered, setIsHovered] = useState(false);

  const Icon = NOTIFICATION_ICONS[notification.type];
  const iconColor = NOTIFICATION_COLORS[notification.type];

  const handleClick = (): void => {
    if (onClick) {
      onClick(notification.id, notification.link);
    }
    if (!notification.isRead && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
  };

  const handleDismiss = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (onDismiss) {
      onDismiss(notification.id);
    }
  };

  const handleMarkAsRead = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
  };

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 rounded-lg border p-3 transition-colors',
        notification.isRead ? 'bg-background border-border' : 'bg-primary/5 border-primary/20',
        notification.link && 'cursor-pointer hover:bg-muted',
      )}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid="notification-item"
    >
      {/* Unread indicator dot */}
      {!notification.isRead && (
        <div className="absolute left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary" />
      )}

      {/* Icon */}
      <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full', iconColor)}>
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground">{notification.title}</h4>
          <span className="flex-shrink-0 text-xs text-muted-foreground">
            {getRelativeTime(notification.createdAt)}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
      </div>

      {/* Actions (shown on hover or when unread) */}
      {(isHovered || !notification.isRead) && (
        <div className="flex items-center gap-1">
          {!notification.isRead && onMarkAsRead && (
            <button
              onClick={handleMarkAsRead}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Mark as read"
              data-testid="mark-as-read-button"
            >
              <Mail className="h-4 w-4" />
            </button>
          )}
          {onDismiss && (
            <button
              onClick={handleDismiss}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
