'use client';

import { useState } from 'react';
import { Loader2, Plus, RefreshCw } from 'lucide-react';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

interface WebhookFormProps {
  onSuccess: () => void;
  onError: (error: string) => void;
}

const EVENT_TYPES = [
  { id: 'estimation.completed', label: 'Estimation Completed', description: 'Triggered when an estimation session is finalized' },
  { id: 'task.created', label: 'Task Created', description: 'Triggered when a new task is created' },
  { id: 'task.updated', label: 'Task Updated', description: 'Triggered when a task is modified' },
  { id: 'analysis.exported', label: 'Analysis Exported', description: 'Triggered when a cost analysis is exported' },
  { id: 'sync.completed', label: 'Sync Completed', description: 'Triggered when an integration sync finishes' },
] as const;

function generateSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function WebhookForm({ onSuccess, onError }: WebhookFormProps): React.ReactElement {
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [secret, setSecret] = useState(generateSecret());

  const createMutation = trpc.webhooks.create.useMutation({
    onSuccess: () => {
      setUrl('');
      setEvents([]);
      setSecret(generateSecret());
      onSuccess();
    },
    onError: (mutationError) => {
      onError(mutationError.message);
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();

    if (!url.trim()) {
      onError('Webhook URL is required');
      return;
    }

    if (!url.startsWith('https://')) {
      onError('Webhook URL must use HTTPS');
      return;
    }

    if (events.length === 0) {
      onError('Select at least one event type');
      return;
    }

    if (secret.length < 16) {
      onError('Secret must be at least 16 characters');
      return;
    }

    createMutation.mutate({ url: url.trim(), events, secret });
  }

  function toggleEvent(eventId: string): void {
    setEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((e) => e !== eventId)
        : [...prev, eventId]
    );
  }

  function handleRegenerateSecret(): void {
    setSecret(generateSecret());
  }

  function handleCopySecret(): void {
    void navigator.clipboard.writeText(secret);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-6">
      <h3 className="text-lg font-semibold">Create New Webhook</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Configure a webhook to receive real-time event notifications.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="url" className="block text-sm font-medium">
            Webhook URL <span className="text-red-500">*</span>
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-domain.com/webhooks/estimatepro"
            disabled={createMutation.isPending}
            className={cn(
              'mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'placeholder:text-muted-foreground',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            HTTPS endpoint where webhook events will be delivered
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium">
            Event Types <span className="text-red-500">*</span>
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Select the events you want to receive
          </p>
          <div className="mt-2 space-y-2">
            {EVENT_TYPES.map((eventType) => (
              <label
                key={eventType.id}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                  events.includes(eventType.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-input hover:bg-muted/50',
                  createMutation.isPending && 'cursor-not-allowed opacity-50',
                )}
              >
                <input
                  type="checkbox"
                  checked={events.includes(eventType.id)}
                  onChange={() => toggleEvent(eventType.id)}
                  disabled={createMutation.isPending}
                  className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{eventType.label}</div>
                  <div className="text-xs text-muted-foreground">{eventType.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="secret" className="block text-sm font-medium">
            Webhook Secret <span className="text-red-500">*</span>
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="secret"
              type="text"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter a secret or generate one"
              disabled={createMutation.isPending}
              className={cn(
                'block flex-1 rounded-md border border-input bg-background px-3 py-2 font-mono text-sm',
                'placeholder:text-muted-foreground',
                'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            />
            <button
              type="button"
              onClick={handleRegenerateSecret}
              disabled={createMutation.isPending}
              className={cn(
                'rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
              title="Generate new secret"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleCopySecret}
              disabled={createMutation.isPending}
              className={cn(
                'rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              Copy
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Used to verify webhook signatures (minimum 16 characters)
          </p>
        </div>

        <button
          type="submit"
          disabled={createMutation.isPending || !url.trim() || events.length === 0}
          className={cn(
            'inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
            'hover:bg-primary/90',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {createMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Create Webhook
            </>
          )}
        </button>
      </div>
    </form>
  );
}
