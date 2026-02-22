'use client';

import { Bell } from 'lucide-react';

import { cn } from '@/lib/utils';

interface NotificationBellProps {
  unreadCount?: number;
  onClick?: () => void;
}

export function NotificationBell({ unreadCount = 0, onClick }: NotificationBellProps): React.ReactElement {
  const hasUnread = unreadCount > 0;
  const displayCount = unreadCount > 99 ? '99+' : unreadCount.toString();

  return (
    <button
      onClick={onClick}
      className="relative rounded-md border bg-background/80 p-2 hover:bg-muted"
      aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ''}`}
    >
      <Bell className="h-5 w-5" />
      {hasUnread && (
        <span
          className={cn(
            'absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground',
          )}
        >
          {displayCount}
        </span>
      )}
    </button>
  );
}
