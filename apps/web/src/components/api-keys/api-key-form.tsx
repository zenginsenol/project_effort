'use client';

import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

interface ApiKeyFormProps {
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function ApiKeyForm({ onSuccess, onError }: ApiKeyFormProps): React.ReactElement {
  const [name, setName] = useState('');
  const [rateLimit, setRateLimit] = useState(1000);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  const createMutation = trpc.publicApi.create.useMutation({
    onSuccess: (data) => {
      setNewApiKey(data.apiKey);
      setName('');
      setRateLimit(1000);
      setShowAdvanced(false);
      onSuccess();
    },
    onError: (mutationError) => {
      onError(mutationError.message);
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!name.trim()) {
      onError('API key name is required');
      return;
    }
    createMutation.mutate({ name: name.trim(), rateLimit });
  }

  function handleCopyKey(): void {
    if (newApiKey) {
      void navigator.clipboard.writeText(newApiKey);
    }
  }

  function handleCloseKeyDialog(): void {
    setNewApiKey(null);
  }

  if (newApiKey) {
    return (
      <div className="rounded-lg border border-yellow-500/50 bg-yellow-50 p-6 dark:bg-yellow-950/20">
        <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100">
          ⚠️ Save Your API Key
        </h3>
        <p className="mt-2 text-sm text-yellow-800 dark:text-yellow-200">
          This is the only time you will see this API key. Copy it now and store it securely.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <code className="flex-1 rounded-md border border-yellow-300 bg-yellow-100 px-3 py-2 font-mono text-sm text-yellow-900 dark:border-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-100">
            {newApiKey}
          </code>
          <button
            onClick={handleCopyKey}
            className="rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
          >
            Copy
          </button>
        </div>
        <button
          onClick={handleCloseKeyDialog}
          className="mt-4 rounded-md border border-yellow-300 px-4 py-2 text-sm font-medium text-yellow-900 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-100 dark:hover:bg-yellow-900/30"
        >
          I've saved the key
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-6">
      <h3 className="text-lg font-semibold">Create New API Key</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Generate a new API key to access the EstimatePro REST API.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium">
            Key Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Production Server, CI/CD Pipeline"
            maxLength={100}
            disabled={createMutation.isPending}
            className={cn(
              'mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'placeholder:text-muted-foreground',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            A descriptive name to identify where this key is used
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {showAdvanced ? '▼' : '▶'} Advanced Settings
          </button>
        </div>

        {showAdvanced && (
          <div>
            <label htmlFor="rateLimit" className="block text-sm font-medium">
              Rate Limit (requests/minute)
            </label>
            <input
              id="rateLimit"
              type="number"
              value={rateLimit}
              onChange={(e) => setRateLimit(Number(e.target.value))}
              min={1}
              max={10000}
              disabled={createMutation.isPending}
              className={cn(
                'mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Maximum API requests per minute (default: 1000, max: 10000)
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={createMutation.isPending || !name.trim()}
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
              Create API Key
            </>
          )}
        </button>
      </div>
    </form>
  );
}
