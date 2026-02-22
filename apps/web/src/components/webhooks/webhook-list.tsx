'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Loader2, MoreVertical, RefreshCw, Trash2, Webhook, XCircle } from 'lucide-react';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

interface WebhookListProps {
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

const EVENT_LABELS: Record<string, string> = {
  'estimation.completed': 'Estimation Completed',
  'task.created': 'Task Created',
  'task.updated': 'Task Updated',
  'analysis.exported': 'Analysis Exported',
  'sync.completed': 'Sync Completed',
};

export function WebhookList({ onSuccess, onError }: WebhookListProps): React.ReactElement {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [editingWebhook, setEditingWebhook] = useState<string | null>(null);
  const [viewingDeliveries, setViewingDeliveries] = useState<string | null>(null);

  const webhooksQuery = trpc.webhooks.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const deleteMutation = trpc.webhooks.delete.useMutation({
    onSuccess: async () => {
      await webhooksQuery.refetch();
      setActiveDropdown(null);
      onSuccess('Webhook deleted successfully');
    },
    onError: (mutationError) => {
      onError(mutationError.message);
    },
  });

  const updateMutation = trpc.webhooks.update.useMutation({
    onSuccess: async () => {
      await webhooksQuery.refetch();
      setActiveDropdown(null);
      onSuccess('Webhook updated successfully');
    },
    onError: (mutationError) => {
      onError(mutationError.message);
    },
  });

  function handleDelete(id: string): void {
    if (window.confirm('Are you sure you want to delete this webhook? This action cannot be undone.')) {
      deleteMutation.mutate({ webhookId: id });
    }
  }

  function handleToggleActive(id: string, currentActive: boolean): void {
    updateMutation.mutate({ webhookId: id, isActive: !currentActive });
  }

  function handleViewDeliveries(id: string): void {
    setViewingDeliveries(id);
    setActiveDropdown(null);
  }

  if (viewingDeliveries) {
    return (
      <DeliveryLog
        webhookId={viewingDeliveries}
        onClose={() => setViewingDeliveries(null)}
        onSuccess={onSuccess}
        onError={onError}
      />
    );
  }

  if (webhooksQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (webhooksQuery.isError) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
        Failed to load webhooks: {webhooksQuery.error.message}
      </div>
    );
  }

  const webhooks = webhooksQuery.data ?? [];

  if (webhooks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center">
        <Webhook className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-sm font-medium">No webhooks yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your first webhook to start receiving event notifications
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {webhooks.map((webhook) => {
        const isDropdownOpen = activeDropdown === webhook.id;

        return (
          <div
            key={webhook.id}
            className={cn(
              'rounded-lg border bg-card p-4 transition-all',
              !webhook.isActive && 'opacity-60',
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{webhook.url}</h3>
                  {!webhook.isActive && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      Disabled
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(webhook.events as string[]).map((event) => (
                    <span
                      key={event}
                      className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                    >
                      {EVENT_LABELS[event] ?? event}
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Created: {new Date(webhook.createdAt).toLocaleDateString()}</span>
                  {webhook.lastTriggeredAt && (
                    <>
                      <span>•</span>
                      <span>Last triggered: {new Date(webhook.lastTriggeredAt).toLocaleString()}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="relative">
                <button
                  onClick={() => setActiveDropdown(isDropdownOpen ? null : webhook.id)}
                  className="rounded-md p-2 hover:bg-muted"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>

                {isDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setActiveDropdown(null)}
                    />
                    <div className="absolute right-0 top-10 z-20 min-w-[180px] rounded-md border bg-card shadow-lg">
                      <button
                        onClick={() => handleViewDeliveries(webhook.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                      >
                        View Deliveries
                      </button>
                      <button
                        onClick={() => handleToggleActive(webhook.id, webhook.isActive)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                      >
                        {webhook.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <div className="border-t" />
                      <button
                        onClick={() => handleDelete(webhook.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface DeliveryLogProps {
  webhookId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

function DeliveryLog({ webhookId, onClose, onSuccess, onError }: DeliveryLogProps): React.ReactElement {
  const deliveriesQuery = trpc.webhooks.getDeliveries.useQuery(
    { webhookId, limit: 50, offset: 0 },
    { refetchOnWindowFocus: false }
  );

  const retryMutation = trpc.webhooks.retryDelivery.useMutation({
    onSuccess: async () => {
      await deliveriesQuery.refetch();
      onSuccess('Delivery retried successfully');
    },
    onError: (mutationError) => {
      onError(mutationError.message);
    },
  });

  function handleRetry(deliveryId: string): void {
    retryMutation.mutate({ deliveryId });
  }

  function getStatusIcon(status: string): React.ReactNode {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Webhook Delivery Log</h3>
        <button
          onClick={onClose}
          className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Back to Webhooks
        </button>
      </div>

      {deliveriesQuery.isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {deliveriesQuery.isError && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          Failed to load deliveries: {deliveriesQuery.error.message}
        </div>
      )}

      {deliveriesQuery.data && deliveriesQuery.data.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed bg-muted/30 p-8 text-center">
          <p className="text-sm font-medium">No deliveries yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Deliveries will appear here when events are triggered
          </p>
        </div>
      )}

      {deliveriesQuery.data && deliveriesQuery.data.length > 0 && (
        <div className="mt-4 space-y-2">
          {deliveriesQuery.data.map((delivery) => (
            <div
              key={delivery.id}
              className="rounded-lg border bg-background p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(delivery.status)}
                    <span className="font-medium capitalize">{delivery.status}</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(delivery.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 text-sm">
                    <div>
                      <span className="font-medium">Event:</span>{' '}
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{delivery.event}</code>
                    </div>
                    <div className="mt-1">
                      <span className="font-medium">Attempts:</span> {delivery.attempts} / 3
                    </div>
                    {delivery.responseStatus && (
                      <div className="mt-1">
                        <span className="font-medium">Response:</span>{' '}
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {delivery.responseStatus}
                        </code>
                      </div>
                    )}
                    {delivery.error && (
                      <div className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                        {delivery.error}
                      </div>
                    )}
                  </div>
                </div>
                {delivery.status === 'failed' && (
                  <button
                    onClick={() => handleRetry(delivery.id)}
                    disabled={retryMutation.isPending}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
