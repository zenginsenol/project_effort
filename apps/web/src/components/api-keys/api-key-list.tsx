'use client';

import { useState } from 'react';
import { Copy, Key, Loader2, MoreVertical, RotateCw, Trash2 } from 'lucide-react';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

interface ApiKeyListProps {
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

export function ApiKeyList({ onSuccess, onError }: ApiKeyListProps): React.ReactElement {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRateLimit, setEditRateLimit] = useState(1000);
  const [rotatedKey, setRotatedKey] = useState<{ id: string; apiKey: string } | null>(null);

  const keysQuery = trpc.publicApi.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const updateMutation = trpc.publicApi.update.useMutation({
    onSuccess: async () => {
      await keysQuery.refetch();
      setEditingKey(null);
      onSuccess('API key updated successfully');
    },
    onError: (mutationError) => {
      onError(mutationError.message);
    },
  });

  const deleteMutation = trpc.publicApi.delete.useMutation({
    onSuccess: async () => {
      await keysQuery.refetch();
      setActiveDropdown(null);
      onSuccess('API key deleted successfully');
    },
    onError: (mutationError) => {
      onError(mutationError.message);
    },
  });

  const rotateMutation = trpc.publicApi.rotate.useMutation({
    onSuccess: async (data) => {
      await keysQuery.refetch();
      setActiveDropdown(null);
      setRotatedKey({ id: data.id, apiKey: data.apiKey });
    },
    onError: (mutationError) => {
      onError(mutationError.message);
    },
  });

  function handleDelete(id: string): void {
    if (window.confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      deleteMutation.mutate({ id });
    }
  }

  function handleRotate(id: string): void {
    if (window.confirm('Rotating this key will invalidate the current key. Are you sure?')) {
      rotateMutation.mutate({ id });
    }
  }

  function handleToggleActive(id: string, currentActive: boolean): void {
    updateMutation.mutate({ id, isActive: !currentActive });
  }

  function handleEditStart(key: { id: string; name: string; rateLimit: number }): void {
    setEditingKey(key.id);
    setEditName(key.name);
    setEditRateLimit(key.rateLimit);
    setActiveDropdown(null);
  }

  function handleEditSave(id: string): void {
    updateMutation.mutate({ id, name: editName, rateLimit: editRateLimit });
  }

  function handleCopyHint(hint: string | null): void {
    if (hint) {
      void navigator.clipboard.writeText(hint);
      onSuccess('Key hint copied to clipboard');
    }
  }

  function handleCopyRotatedKey(): void {
    if (rotatedKey) {
      void navigator.clipboard.writeText(rotatedKey.apiKey);
    }
  }

  if (rotatedKey) {
    return (
      <div className="rounded-lg border border-yellow-500/50 bg-yellow-50 p-6 dark:bg-yellow-950/20">
        <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100">
          ⚠️ New API Key Generated
        </h3>
        <p className="mt-2 text-sm text-yellow-800 dark:text-yellow-200">
          Your API key has been rotated. The old key is now invalid. Copy the new key now.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <code className="flex-1 rounded-md border border-yellow-300 bg-yellow-100 px-3 py-2 font-mono text-sm text-yellow-900 dark:border-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-100">
            {rotatedKey.apiKey}
          </code>
          <button
            onClick={handleCopyRotatedKey}
            className="rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
          >
            Copy
          </button>
        </div>
        <button
          onClick={() => setRotatedKey(null)}
          className="mt-4 rounded-md border border-yellow-300 px-4 py-2 text-sm font-medium text-yellow-900 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-100 dark:hover:bg-yellow-900/30"
        >
          I've saved the key
        </button>
      </div>
    );
  }

  if (keysQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (keysQuery.isError) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
        Failed to load API keys: {keysQuery.error.message}
      </div>
    );
  }

  const keys = keysQuery.data ?? [];

  if (keys.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center">
        <Key className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-sm font-medium">No API keys yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your first API key to start using the REST API
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {keys.map((key) => {
        const isEditing = editingKey === key.id;
        const isDropdownOpen = activeDropdown === key.id;

        return (
          <div
            key={key.id}
            className={cn(
              'rounded-lg border bg-card p-4 transition-all',
              !key.isActive && 'opacity-60',
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor={`edit-name-${key.id}`} className="block text-sm font-medium">
                        Name
                      </label>
                      <input
                        id={`edit-name-${key.id}`}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label htmlFor={`edit-rate-${key.id}`} className="block text-sm font-medium">
                        Rate Limit
                      </label>
                      <input
                        id={`edit-rate-${key.id}`}
                        type="number"
                        value={editRateLimit}
                        onChange={(e) => setEditRateLimit(Number(e.target.value))}
                        min={1}
                        max={10000}
                        className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditSave(key.id)}
                        disabled={updateMutation.isPending}
                        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {updateMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingKey(null)}
                        disabled={updateMutation.isPending}
                        className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{key.name}</h3>
                      {!key.isActive && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          Disabled
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{key.keyHint}</code>
                      <button
                        onClick={() => handleCopyHint(key.keyHint)}
                        className="hover:text-foreground"
                        title="Copy key hint"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Rate limit: {key.rateLimit} req/min</span>
                      <span>•</span>
                      <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                      {key.lastUsedAt && (
                        <>
                          <span>•</span>
                          <span>Last used: {new Date(key.lastUsedAt).toLocaleString()}</span>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>

              {!isEditing && (
                <div className="relative">
                  <button
                    onClick={() => setActiveDropdown(isDropdownOpen ? null : key.id)}
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
                      <div className="absolute right-0 top-10 z-20 min-w-[160px] rounded-md border bg-card shadow-lg">
                        <button
                          onClick={() => handleEditStart({ id: key.id, name: key.name, rateLimit: key.rateLimit })}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(key.id, key.isActive)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                        >
                          {key.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleRotate(key.id)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                        >
                          <RotateCw className="h-4 w-4" />
                          Rotate Key
                        </button>
                        <div className="border-t" />
                        <button
                          onClick={() => handleDelete(key.id)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
