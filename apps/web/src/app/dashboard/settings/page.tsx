'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

type Provider = 'openai' | 'anthropic';

const PROVIDER_INFO: Record<Provider, { name: string; placeholder: string; defaultModel: string; models: string[]; icon: string }> = {
  openai: {
    name: 'OpenAI',
    placeholder: 'sk-...',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    icon: '🤖',
  },
  anthropic: {
    name: 'Anthropic Claude',
    placeholder: 'sk-ant-...',
    defaultModel: 'claude-sonnet-4-20250514',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
    icon: '🧠',
  },
};

interface ExistingKeyData {
  id: string;
  keyHint: string | null;
  label: string | null;
  model: string | null;
  isActive: boolean;
  authMethod: string;
  oauthEmail: string | null;
  tokenExpiresAt: Date | null;
  lastUsedAt: Date | null;
}

// ─── OpenAI OAuth Card ───────────────────────────────────────
function OpenAIOAuthCard({
  existingKey,
  onDisconnect,
  onStartOAuth,
  connecting,
}: {
  existingKey?: ExistingKeyData;
  onDisconnect: (id: string) => void;
  onStartOAuth: () => void;
  connecting: boolean;
}) {
  const isOAuth = existingKey?.authMethod === 'oauth';

  if (isOAuth && existingKey) {
    return (
      <div className="rounded-xl border-2 border-green-500/30 bg-green-500/5 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-green-500" fill="currentColor">
                <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4092-.6813zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0974-2.3616l2.603-1.5018 2.6029 1.5018v3.0036l-2.6029 1.5018-2.603-1.5018z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-green-400">ChatGPT Subscription Connected</h3>
              <p className="text-sm text-muted-foreground">
                {existingKey.oauthEmail && (
                  <span className="text-blue-400">{existingKey.oauthEmail}</span>
                )}
                {existingKey.tokenExpiresAt && (
                  <span className="ml-2 text-xs">
                    Token expires: {new Date(existingKey.tokenExpiresAt).toLocaleString()}
                  </span>
                )}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Connected
          </span>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Model:</span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{existingKey.model || 'gpt-4o'}</code>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => onDisconnect(existingKey.id)}
            className="inline-flex h-8 items-center justify-center rounded-md border border-destructive/30 px-3 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  // Not connected - show sign in button
  return (
    <div className="rounded-xl border-2 border-dashed border-border p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-muted-foreground" fill="currentColor">
            <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4092-.6813zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0974-2.3616l2.603-1.5018 2.6029 1.5018v3.0036l-2.6029 1.5018-2.603-1.5018z"/>
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">OpenAI ChatGPT</h3>
          <p className="text-sm text-muted-foreground">Sign in with your ChatGPT Plus/Pro subscription - no API key needed</p>
        </div>
      </div>
      <div className="mt-4">
        <button
          onClick={onStartOAuth}
          disabled={connecting}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#10a37f] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#0d8c6d] disabled:opacity-50"
        >
          {connecting ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" /></svg>
              Connecting...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729z"/>
              </svg>
              Sign in with ChatGPT
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Manual API Key Card ─────────────────────────────────────
function ApiKeyCard({
  provider,
  existingKey,
  onSave,
  onDelete,
  saving,
}: {
  provider: Provider;
  existingKey?: ExistingKeyData;
  onSave: (data: { provider: Provider; apiKey: string; model?: string }) => void;
  onDelete: (id: string) => void;
  saving: boolean;
}) {
  const info = PROVIDER_INFO[provider];
  const isOAuth = existingKey?.authMethod === 'oauth';
  const [isEditing, setIsEditing] = useState(!existingKey || isOAuth);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(existingKey?.model || info.defaultModel);

  // If this key is OAuth-managed, don't show this card
  if (isOAuth) return null;

  const handleSave = () => {
    if (!apiKey.trim()) return;
    onSave({ provider, apiKey: apiKey.trim(), model });
    setApiKey('');
    setIsEditing(false);
  };

  return (
    <div className={cn('rounded-xl border-2 p-5 transition-all', existingKey?.isActive ? 'border-primary/30 bg-primary/5' : 'border-border')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{info.icon}</span>
          <div>
            <h3 className="font-semibold">{info.name} API Key</h3>
            {existingKey ? (
              <p className="text-sm text-muted-foreground">
                Key: <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{existingKey.keyHint}</code>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Enter your API key manually</p>
            )}
          </div>
        </div>
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
              disabled={saving || !apiKey.trim()}
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

// ─── Main Settings Page ──────────────────────────────────────
export default function SettingsPage(): React.ReactElement {
  const [savingProvider, setSavingProvider] = useState<Provider | null>(null);
  const [connectingOAuth, setConnectingOAuth] = useState(false);
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
      setSuccessMsg('Disconnected successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (err) => {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(null), 5000);
    },
  });
  const startOAuthMutation = trpc.apiKeys.startOAuthLogin.useMutation({
    onSuccess: (data) => {
      // Redirect to OpenAI login page
      window.open(data.authUrl, '_blank', 'width=600,height=700');
      setConnectingOAuth(false);
      setSuccessMsg('OpenAI login window opened. Complete the sign-in to connect your subscription.');
      setTimeout(() => setSuccessMsg(null), 8000);
    },
    onError: (err) => {
      setConnectingOAuth(false);
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(null), 5000);
    },
  });

  // Auto-refresh when returning from OAuth
  useEffect(() => {
    const handleFocus = () => {
      void apiKeysQuery.refetch();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [apiKeysQuery]);

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

  const handleStartOAuth = () => {
    setConnectingOAuth(true);
    startOAuthMutation.mutate({ provider: 'openai' });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-muted-foreground">Connect your AI subscription or enter API keys.</p>

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
        {/* ── Sign in with Subscription ── */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <h2 className="text-lg font-semibold">Sign in with AI Subscription</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your ChatGPT Plus/Pro subscription directly. No API key needed - use your existing plan.
          </p>

          <div className="mt-5">
            <OpenAIOAuthCard
              existingKey={openaiKey as ExistingKeyData | undefined}
              onDisconnect={handleDelete}
              onStartOAuth={handleStartOAuth}
              connecting={connectingOAuth}
            />
          </div>

          <div className="mt-4 rounded-lg border border-blue-200/50 bg-blue-50/50 p-3 text-xs text-blue-600">
            <strong>How it works:</strong> Click &quot;Sign in with ChatGPT&quot; → Login with your OpenAI account → Your subscription is used for AI analysis. Tokens auto-refresh.
          </div>
        </div>

        {/* ── Manual API Keys ── */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔑</span>
            <h2 className="text-lg font-semibold">Manual API Keys</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Alternatively, enter your API key directly from OpenAI or Anthropic.
          </p>

          <div className="mt-5 space-y-4">
            {/* Only show OpenAI API key card if not OAuth-connected */}
            <ApiKeyCard
              provider="openai"
              existingKey={openaiKey as ExistingKeyData | undefined}
              onSave={handleSave}
              onDelete={handleDelete}
              saving={savingProvider === 'openai'}
            />

            <ApiKeyCard
              provider="anthropic"
              existingKey={anthropicKey as ExistingKeyData | undefined}
              onSave={handleSave}
              onDelete={handleDelete}
              saving={savingProvider === 'anthropic'}
            />
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
