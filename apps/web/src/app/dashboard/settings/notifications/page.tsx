'use client';

import { useState } from 'react';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

type NotificationType =
  | 'session_invitation'
  | 'vote_reminder'
  | 'session_complete'
  | 'task_assigned'
  | 'task_status_change'
  | 'sync_complete'
  | 'mention_in_comment';

interface NotificationTypeConfig {
  type: NotificationType;
  icon: string;
  label: string;
  description: string;
}

const NOTIFICATION_TYPES: NotificationTypeConfig[] = [
  {
    type: 'session_invitation',
    icon: '📨',
    label: 'Session Invitations',
    description: 'Get notified when you\'re invited to an estimation session',
  },
  {
    type: 'vote_reminder',
    icon: '⏰',
    label: 'Vote Reminders',
    description: 'Receive reminders when your vote is needed in active sessions',
  },
  {
    type: 'session_complete',
    icon: '✅',
    label: 'Session Complete',
    description: 'Be notified when estimation sessions you\'re part of are completed',
  },
  {
    type: 'task_assigned',
    icon: '📝',
    label: 'Task Assignments',
    description: 'Get alerts when tasks are assigned to you',
  },
  {
    type: 'task_status_change',
    icon: '🔄',
    label: 'Task Status Changes',
    description: 'Track updates when task statuses change',
  },
  {
    type: 'sync_complete',
    icon: '🔄',
    label: 'Integration Sync',
    description: 'Get notified when external integrations sync successfully',
  },
  {
    type: 'mention_in_comment',
    icon: '💬',
    label: 'Mentions in Comments',
    description: 'Be alerted when someone mentions you in a comment',
  },
];

function ToggleSwitch({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <button
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        enabled ? 'bg-blue-600' : 'bg-gray-300',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'cursor-pointer',
      )}
      role="switch"
      aria-checked={enabled}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          enabled ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}

export default function NotificationSettingsPage(): React.ReactElement {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const orgsQuery = trpc.organization.list.useQuery(undefined, { retry: false });
  const orgId = orgsQuery.data?.[0]?.id ?? '';

  const meQuery = trpc.team.me.useQuery(undefined, { enabled: Boolean(orgId), retry: false });
  const currentUserId = meQuery.data?.userId ?? null;

  const preferencesQuery = trpc.notification.getPreferences.useQuery(
    { userId: currentUserId! },
    { enabled: Boolean(currentUserId), retry: false },
  );

  const updatePreferenceMutation = trpc.notification.updatePreference.useMutation({
    onSuccess: () => {
      void preferencesQuery.refetch();
      setSuccessMsg('Notification preference updated!');
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (err) => {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(null), 5000);
    },
  });

  const handleToggle = (notificationType: NotificationType, enabled: boolean) => {
    updatePreferenceMutation.mutate({
      notificationType,
      enabled,
    });
  };

  const preferences = preferencesQuery.data ?? [];
  const isLoading = preferencesQuery.isLoading || orgsQuery.isLoading || meQuery.isLoading;

  // Create a map of preferences for quick lookup
  const preferenceMap = new Map(
    preferences.map((pref: { notificationType: NotificationType; enabled: boolean }) => [
      pref.notificationType,
      pref.enabled,
    ])
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Notification Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Control which notifications you receive. Changes are saved automatically.
        </p>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        </div>
      )}

      {/* Notification preferences list */}
      {!isLoading && (
        <div className="rounded-lg border bg-card">
          <div className="divide-y">
            {NOTIFICATION_TYPES.map((config, index) => {
              const isEnabled = preferenceMap.get(config.type) ?? true; // Default to enabled if no preference set
              const isSaving = updatePreferenceMutation.isPending;

              return (
                <div
                  key={config.type}
                  className={cn(
                    'flex items-center justify-between p-6',
                    index === 0 && 'rounded-t-lg',
                    index === NOTIFICATION_TYPES.length - 1 && 'rounded-b-lg',
                  )}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-2xl" role="img" aria-label={config.label}>
                      {config.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-foreground">
                        {config.label}
                      </h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {config.description}
                      </p>
                    </div>
                  </div>
                  <div className="ml-4">
                    <ToggleSwitch
                      enabled={isEnabled}
                      onChange={(enabled) => handleToggle(config.type, enabled)}
                      disabled={isSaving}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="mt-6 rounded-lg border border-blue-200/50 bg-blue-50/50 p-4 text-sm text-blue-600">
        <strong>💡 Tip:</strong> Notifications are delivered in real-time via the notification bell icon in the header. You can also access your notification history from the notification center.
      </div>
    </div>
  );
}
