'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

type Provider = 'openai' | 'anthropic';

const PROVIDER_INFO: Record<Provider, { name: string; placeholder: string; defaultModel: string; models: string[]; color: string; icon: string }> = {
  openai: {
    name: 'OpenAI',
    placeholder: 'sk-...',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    icon: '🤖',
  },
  anthropic: {
    name: 'Anthropic Claude',
    placeholder: 'sk-ant-...',
    defaultModel: 'claude-sonnet-4-20250514',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
    color: 'bg-orange-500/10 text-orange-600 border-orange-200',
    icon: '🧠',
  },
};

function ApiKeyCard({
  provider,
  existingKey,
  onSave,
  onDelete,
  saving,
}: {
  provider: Provider;
  existingKey?: {
    id: string;
    keyHint: string;
    label: string | null;
    model: string | null;
    isActive: boolean;
    lastUsedAt: Date | null;
  };
  onSave: (data: { provider: Provider; apiKey: string; model?: string }) => void;
  onDelete: (id: string) => void;
  saving: boolean;
}) {
  const info = PROVIDER_INFO[provider];
  const [isEditing, setIsEditing] = useState(!existingKey);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(existingKey?.model || info.defaultModel);

  const handleSave = () => {
    if (!apiKey.trim() && !existingKey) return;
    onSave({
      provider,
      apiKey: apiKey.trim(),
      model,
    });
    setApiKey('');
    setIsEditing(false);
  };

  return (
    <div className={cn('rounded-xl border-2 p-5 transition-all', existingKey?.isActive ? 'border-primary/30 bg-primary/5' : 'border-border')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{info.icon}</span>
          <div>
            <h3 className="font-semibold">{info.name}</h3>
            {existingKey ? (
              <p className="text-sm text-muted-foreground">
                Key: <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{existingKey.keyHint}</code>
                {existingKey.lastUsedAt && (
                  <span className="ml-2 text-xs">
                    Last used: {new Date(existingKey.lastUsedAt).toLocaleDateString()}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No key configured</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {existingKey && (
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
              existingKey.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
            )}>
              <span className={cn('h-1.5 w-1.5 rounded-full', existingKey.isActive ? 'bg-green-500' : 'bg-gray-400')} />
              {existingKey.isActive ? 'Active' : 'Inactive'}
            </span>
          )}
        </div>
      </div>

      {isEditing || !existingKey ? (
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={info.placeholder}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {info.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || (!apiKey.trim() && !existingKey)}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : existingKey ? 'Update Key' : 'Save Key'}
            </button>
            {existingKey && (
              <button
                onClick={() => setIsEditing(false)}
                className="inline-flex h-9 items-center justify-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Model:</span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{existingKey.model || info.defaultModel}</code>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex h-8 items-center justify-center rounded-md border border-input px-3 text-sm font-medium hover:bg-accent"
          >
            Change Key
          </button>
          <button
            onClick={() => onDelete(existingKey.id)}
            className="inline-flex h-8 items-center justify-center rounded-md border border-destructive/30 px-3 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage(): React.ReactElement {
  const [savingProvider, setSavingProvider] = useState<Provider | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const apiKeysQuery = trpc.apiKeys.list.useQuery();
  const addKeyMutation = trpc.apiKeys.add.useMutation({
    onSuccess: (data) => {
      void apiKeysQuery.refetch();
      setSavingProvider(null);
      setSuccessMsg(data.updated ? 'API key updated successfully!' : 'API key saved successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (err) => {
      setSavingProvider(null);
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(null), 5000);
    },
  });
  const deleteKeyMutation = trpc.apiKeys.delete.useMutation({
    onSuccess: () => {
      void apiKeysQuery.refetch();
      setSuccessMsg('API key removed successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (err) => {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(null), 5000);
    },
  });

  const keys = apiKeysQuery.data ?? [];
  const openaiKey = keys.find((k) => k.provider === 'openai');
  const anthropicKey = keys.find((k) => k.provider === 'anthropic');

  const handleSave = (data: { provider: Provider; apiKey: string; model?: string }) => {
    setSavingProvider(data.provider);
    addKeyMutation.mutate({
      provider: data.provider,
      apiKey: data.apiKey,
      model: data.model,
    });
  };

  const handleDelete = (id: string) => {
    deleteKeyMutation.mutate({ id });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-muted-foreground">Manage your AI provider keys and organization preferences.</p>

      {/* Notifications */}
      {successMsg && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="mt-6 space-y-6">
        {/* AI Provider Keys */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔑</span>
            <h2 className="text-lg font-semibold">AI Provider API Keys</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your OpenAI or Anthropic Claude API key to enable real AI-powered task extraction.
            Your keys are encrypted and stored securely. You only need one provider.
          </p>

          <div className="mt-5 space-y-4">
            <ApiKeyCard
              provider="openai"
              existingKey={openaiKey as Parameters<typeof ApiKeyCard>[0]['existingKey']}
              onSave={handleSave}
              onDelete={handleDelete}
              saving={savingProvider === 'openai'}
            />

            <ApiKeyCard
              provider="anthropic"
              existingKey={anthropicKey as Parameters<typeof ApiKeyCard>[0]['existingKey']}
              onSave={handleSave}
              onDelete={handleDelete}
              saving={savingProvider === 'anthropic'}
            />
          </div>

          {/* Info box */}
          <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
            <p className="font-medium">How it works</p>
            <ul className="mt-1.5 list-disc pl-5 space-y-1 text-blue-600">
              <li>Add your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline font-medium">OpenAI</a> or <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="underline font-medium">Anthropic</a></li>
              <li>When you run AI Task Analysis, your key will be used automatically</li>
              <li>Keys are encrypted at rest with AES-256-GCM</li>
              <li>Without a key, the system uses demo mock extraction</li>
            </ul>
          </div>
        </div>

        {/* Organization Settings */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">Organization</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manage your organization details and preferences.</p>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium">Organization Name</label>
              <input
                type="text"
                placeholder="Your organization"
                className="mt-1 flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                placeholder="Describe your organization..."
                rows={3}
                className="mt-1 flex w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Default Estimation Method */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">Default Estimation Method</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose the default estimation method for new projects.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {['Planning Poker', 'T-Shirt Sizing', 'PERT', 'Wideband Delphi'].map((method) => (
              <button
                key={method}
                className="rounded-lg border p-4 text-left hover:border-primary hover:bg-primary/5"
              >
                <span className="text-sm font-medium">{method}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
