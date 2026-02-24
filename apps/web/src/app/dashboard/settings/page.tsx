'use client';

import { useState, useEffect, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { InviteMemberDialog } from '@/components/invitations/invite-member-dialog';
import { PendingInvitationsList } from '@/components/invitations/pending-invitations-list';
import { useIsAdmin } from '@/hooks/use-is-admin';
import {
  type AIProvider as Provider,
  type AIReasoningEffort as ReasoningEffort,
  getDefaultModel,
  getModelsForProvider,
} from '@/lib/ai-model-catalog';

const REASONING_EFFORT_OPTIONS: { value: ReasoningEffort; label: string; description: string; color: string }[] = [
  { value: 'low', label: 'Low', description: 'Fast, less tokens', color: 'bg-blue-500' },
  { value: 'medium', label: 'Medium', description: 'Balanced (default)', color: 'bg-yellow-500' },
  { value: 'high', label: 'High', description: 'Thorough analysis', color: 'bg-orange-500' },
  { value: 'xhigh', label: 'Extra High', description: 'Maximum reasoning', color: 'bg-red-500' },
];

interface ExistingKeyData {
  id: string;
  provider: string;
  keyHint: string | null;
  label: string | null;
  model: string | null;
  reasoningEffort: string | null;
  isActive: boolean;
  authMethod: string;
  oauthEmail: string | null;
  tokenExpiresAt: Date | null;
  lastUsedAt: Date | null;
}

interface ProviderQuotaSnapshot {
  status: 'available' | 'unavailable' | 'error';
  remainingUsd: number | null;
  limitUsd: number | null;
  usageUsd: number | null;
  totalCreditsUsd: number | null;
  totalUsageUsd: number | null;
  note: string | null;
}

interface ProviderDiagnostic {
  provider: Provider;
  configured: boolean;
  active: boolean;
  status: 'ok' | 'error' | 'inactive' | 'not_configured';
  model: string | null;
  authMethod: 'api_key' | 'oauth' | null;
  latencyMs: number | null;
  message: string;
  lastUsedAt: Date | null;
  quota: ProviderQuotaSnapshot | null;
}

function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '-';
  }
  return `$${value.toFixed(2)}`;
}

function getDiagnosticBadgeClasses(status: ProviderDiagnostic['status']): string {
  switch (status) {
    case 'ok':
      return 'bg-green-100 text-green-700';
    case 'error':
      return 'bg-red-100 text-red-700';
    case 'inactive':
      return 'bg-yellow-100 text-yellow-800';
    case 'not_configured':
      return 'bg-gray-100 text-gray-600';
  }
}

function getProviderIcon(provider: Provider): string {
  switch (provider) {
    case 'openai': return '🤖';
    case 'anthropic': return '🧠';
    case 'openrouter': return '🌐';
  }
}

function getProviderLabel(provider: Provider): string {
  switch (provider) {
    case 'openai': return 'OpenAI';
    case 'anthropic': return 'Anthropic Claude';
    case 'openrouter': return 'OpenRouter';
  }
}

function getProviderColor(provider: Provider): string {
  switch (provider) {
    case 'openai': return 'green';
    case 'anthropic': return 'purple';
    case 'openrouter': return 'cyan';
  }
}

function getKeyPlaceholder(provider: Provider): string {
  switch (provider) {
    case 'openai': return 'sk-...';
    case 'anthropic': return 'sk-ant-...';
    case 'openrouter': return 'sk-or-...';
  }
}

// ─── Model & Effort Selector ─────────────────────────────────
function ModelSelector({
  provider,
  selectedModel,
  selectedEffort,
  onModelChange,
  onEffortChange,
  saving,
}: {
  provider: Provider;
  selectedModel: string;
  selectedEffort: ReasoningEffort | null;
  onModelChange: (model: string) => void;
  onEffortChange: (effort: ReasoningEffort | null) => void;
  saving: boolean;
}) {
  const models = getModelsForProvider(provider);
  const currentModel = models.find(m => m.id === selectedModel);
  const showReasoningEffort = currentModel?.supportsReasoning ?? false;

  const reasoningModels = models.filter(m => m.category === 'reasoning');
  const standardModels = models.filter(m => m.category === 'standard');

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground">AI Model</label>
        <div className="mt-2 space-y-2">
          {reasoningModels.length > 0 && (
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-orange-400">
                {provider === 'anthropic' ? '🧪 Thinking Models' : '🧠 Reasoning Models'}
              </span>
              <div className="mt-1 grid gap-1.5">
                {reasoningModels.map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onModelChange(m.id);
                      if (m.supportsReasoning && !selectedEffort) onEffortChange('medium');
                    }}
                    disabled={saving}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-all',
                      selectedModel === m.id
                        ? 'border-orange-500/50 bg-orange-500/10 ring-1 ring-orange-500/30'
                        : 'border-border hover:border-orange-500/30 hover:bg-muted/50',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{m.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{m.description}</span>
                    </div>
                    {m.contextWindow && (
                      <span className="shrink-0 text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{m.contextWindow}</span>
                    )}
                    {selectedModel === m.id && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {standardModels.length > 0 && (
            <div className={reasoningModels.length > 0 ? 'mt-3' : ''}>
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Standard Models</span>
              <div className="mt-1 grid gap-1.5">
                {standardModels.map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onModelChange(m.id);
                      if (!m.supportsReasoning) onEffortChange(null);
                    }}
                    disabled={saving}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-all',
                      selectedModel === m.id
                        ? 'border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/30'
                        : 'border-border hover:border-blue-500/30 hover:bg-muted/50',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{m.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{m.description}</span>
                    </div>
                    {m.contextWindow && (
                      <span className="shrink-0 text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{m.contextWindow}</span>
                    )}
                    {selectedModel === m.id && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showReasoningEffort && (
        <div>
          <label className="text-sm font-medium text-foreground">
            {provider === 'anthropic' ? 'Thinking Effort' : 'Reasoning Effort'}
          </label>
          <p className="text-xs text-muted-foreground">
            {provider === 'anthropic'
              ? 'Higher effort = deeper thinking, uses more budget tokens'
              : 'Higher effort = more thorough analysis, but slower and uses more tokens'}
          </p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {REASONING_EFFORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => onEffortChange(opt.value)}
                disabled={saving}
                className={cn(
                  'group flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all',
                  selectedEffort === opt.value
                    ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                    : 'border-border hover:border-primary/30 hover:bg-muted/50',
                )}
              >
                <div className={cn('h-2.5 w-2.5 rounded-full transition-all', opt.color, selectedEffort === opt.value ? 'scale-125' : 'scale-100 opacity-60')} />
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="text-[10px] leading-tight text-muted-foreground">{opt.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── OpenAI OAuth Card ───────────────────────────────────────
function OpenAIOAuthCard({
  existingKey,
  onDisconnect,
  onStartOAuth,
  onUpdateModel,
  connecting,
  saving,
}: {
  existingKey?: ExistingKeyData;
  onDisconnect: (id: string) => void;
  onStartOAuth: () => void;
  onUpdateModel: (id: string, model: string, effort: ReasoningEffort | null) => void;
  connecting: boolean;
  saving: boolean;
}) {
  const isOAuth = existingKey?.authMethod === 'oauth';
  const defaultOpenAIModel = getDefaultModel('openai');
  const [selectedModel, setSelectedModel] = useState(existingKey?.model || defaultOpenAIModel);
  const [selectedEffort, setSelectedEffort] = useState<ReasoningEffort | null>(
    (existingKey?.reasoningEffort as ReasoningEffort) || 'medium'
  );
  const [showModelSelector, setShowModelSelector] = useState(false);

  const hasChanges = isOAuth && existingKey && (
    selectedModel !== (existingKey.model || defaultOpenAIModel) ||
    selectedEffort !== ((existingKey.reasoningEffort as ReasoningEffort) || 'medium')
  );

  if (isOAuth && existingKey) {
    return (
      <div className="rounded-xl border-2 border-green-500/30 bg-green-500/5 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 text-lg">🤖</div>
            <div>
              <h3 className="font-semibold text-green-400">ChatGPT Subscription Connected</h3>
              {existingKey.oauthEmail && (
                <p className="text-sm text-blue-400">{existingKey.oauthEmail}</p>
              )}
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Connected
          </span>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Model:</span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono font-semibold">{existingKey.model || defaultOpenAIModel}</code>
          </div>
          {existingKey.reasoningEffort && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Effort:</span>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                existingKey.reasoningEffort === 'xhigh' ? 'bg-red-100 text-red-700' :
                existingKey.reasoningEffort === 'high' ? 'bg-orange-100 text-orange-700' :
                existingKey.reasoningEffort === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                'bg-blue-100 text-blue-700',
              )}>
                {existingKey.reasoningEffort === 'xhigh' ? 'Extra High' :
                 existingKey.reasoningEffort.charAt(0).toUpperCase() + existingKey.reasoningEffort.slice(1)}
              </span>
            </div>
          )}
        </div>

        <div className="mt-3">
          <button onClick={() => setShowModelSelector(!showModelSelector)} className="text-sm font-medium text-primary hover:underline">
            {showModelSelector ? 'Hide model settings' : 'Change model & reasoning effort'}
          </button>
        </div>

        {showModelSelector && (
          <div className="mt-4 rounded-lg border border-border bg-background p-4">
            <ModelSelector
              provider="openai"
              selectedModel={selectedModel}
              selectedEffort={selectedEffort}
              onModelChange={setSelectedModel}
              onEffortChange={setSelectedEffort}
              saving={saving}
            />
            {hasChanges && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => onUpdateModel(existingKey.id, selectedModel, selectedEffort)}
                  disabled={saving}
                  className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setSelectedModel(existingKey.model || defaultOpenAIModel);
                    setSelectedEffort((existingKey.reasoningEffort as ReasoningEffort) || 'medium');
                  }}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex justify-end">
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

  return (
    <div className="rounded-xl border-2 border-dashed border-border p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">🤖</div>
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
            'Sign in with ChatGPT'
          )}
        </button>
      </div>
    </div>
  );
}

// ─── API Key Card (for any provider) ─────────────────────────
function ApiKeyCard({
  provider,
  existingKey,
  onSave,
  onDelete,
  onUpdateModel,
  saving,
}: {
  provider: Provider;
  existingKey?: ExistingKeyData;
  onSave: (data: { provider: Provider; apiKey: string; model?: string }) => void;
  onDelete: (id: string) => void;
  onUpdateModel: (id: string, model: string, effort: ReasoningEffort | null) => void;
  saving: boolean;
}) {
  const isOAuth = existingKey?.authMethod === 'oauth';
  const isSubscriptionManaged = isOAuth || !!existingKey?.oauthEmail || !!existingKey?.keyHint?.startsWith('OAuth:');
  const [isEditing, setIsEditing] = useState(!existingKey || isSubscriptionManaged);
  const [apiKey, setApiKey] = useState('');
  const defaultModel = getDefaultModel(provider);
  const [model, setModel] = useState(existingKey?.model || defaultModel);
  const [effort, setEffort] = useState<ReasoningEffort | null>(
    (existingKey?.reasoningEffort as ReasoningEffort) || 'medium'
  );
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [openRouterSearch, setOpenRouterSearch] = useState('');
  const [openRouterLookupKey, setOpenRouterLookupKey] = useState<string | null>(null);

  useEffect(() => {
    if (provider !== 'openrouter') {
      return;
    }

    if (!isEditing && !showModelSettings) {
      setOpenRouterLookupKey(null);
      return;
    }

    const timer = window.setTimeout(() => {
      const typed = apiKey.trim();
      if (typed.length >= 10) {
        setOpenRouterLookupKey(typed);
        return;
      }
      if (existingKey?.isActive) {
        setOpenRouterLookupKey('__stored__');
        return;
      }
      setOpenRouterLookupKey(null);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [apiKey, existingKey?.isActive, isEditing, provider, showModelSettings]);

  const providerColor = getProviderColor(provider);
  const models = getModelsForProvider(provider);
  const openRouterModelsQuery = trpc.apiKeys.listOpenRouterModels.useQuery(
    openRouterLookupKey && openRouterLookupKey !== '__stored__'
      ? { apiKey: openRouterLookupKey }
      : {},
    {
      enabled: provider === 'openrouter' && openRouterLookupKey !== null,
      retry: false,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  );

  const openRouterModels = openRouterModelsQuery.data?.models ?? [];
  const filteredOpenRouterModels = useMemo(() => {
    const q = openRouterSearch.trim().toLowerCase();
    if (!q) {
      return openRouterModels;
    }
    return openRouterModels.filter((item) => (
      item.id.toLowerCase().includes(q)
      || item.name.toLowerCase().includes(q)
      || (item.description?.toLowerCase().includes(q) ?? false)
    ));
  }, [openRouterModels, openRouterSearch]);
  const openRouterReasoningModels = filteredOpenRouterModels.filter((item) => item.supportsReasoning);
  const openRouterStandardModels = filteredOpenRouterModels.filter((item) => !item.supportsReasoning);
  const openRouterModelPresent = filteredOpenRouterModels.some((item) => item.id === model);

  const handleSave = () => {
    if (!apiKey.trim()) return;
    onSave({ provider, apiKey: apiKey.trim(), model });
    setApiKey('');
    setIsEditing(false);
  };

  const hasModelChanges = existingKey && (
    model !== (existingKey.model || defaultModel) ||
    effort !== ((existingKey.reasoningEffort as ReasoningEffort) || 'medium')
  );

  // If this key is managed via subscription (OAuth or setup key), don't show manual card.
  // Keep this check after all hooks to avoid hook order mismatches between renders.
  if (isSubscriptionManaged) {
    return null;
  }

  return (
    <div className={cn(
      'rounded-xl border-2 p-5 transition-all',
      existingKey?.isActive
        ? `border-${providerColor}-500/30 bg-${providerColor}-500/5`
        : 'border-border',
      existingKey?.isActive && provider === 'openai' && 'border-green-500/30 bg-green-500/5',
      existingKey?.isActive && provider === 'anthropic' && 'border-purple-500/30 bg-purple-500/5',
      existingKey?.isActive && provider === 'openrouter' && 'border-cyan-500/30 bg-cyan-500/5',
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getProviderIcon(provider)}</span>
          <div>
            <h3 className="font-semibold">{getProviderLabel(provider)} API Key</h3>
            {existingKey ? (
              <p className="text-sm text-muted-foreground">
                Key: <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{existingKey.keyHint}</code>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {provider === 'openrouter'
                  ? 'Access 500+ models through a single API key'
                  : `Enter your ${getProviderLabel(provider)} API key`}
              </p>
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
              placeholder={getKeyPlaceholder(provider)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {provider === 'openrouter' && (
              <p className="mt-1 text-xs text-muted-foreground">
                Get your key at{' '}
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  openrouter.ai/keys
                </a>
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Model</label>
            {provider === 'openrouter' ? (
              <div className="mt-1 space-y-2">
                <input
                  type="text"
                  value={openRouterSearch}
                  onChange={(event) => setOpenRouterSearch(event.target.value)}
                  placeholder="Search model (provider/model, name...)"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <select
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {!openRouterModelPresent && model && (
                    <option value={model}>Current: {model}</option>
                  )}
                  {openRouterReasoningModels.length > 0 && (
                    <optgroup label="Reasoning / Thinking Models">
                      {openRouterReasoningModels.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.id}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {openRouterStandardModels.length > 0 && (
                    <optgroup label="Standard Models">
                      {openRouterStandardModels.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.id}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {filteredOpenRouterModels.length === 0 && (
                    <option value="" disabled>
                      No model found for search
                    </option>
                  )}
                </select>
                <div className="text-xs text-muted-foreground">
                  {openRouterModelsQuery.isFetching
                    ? 'Loading OpenRouter models...'
                    : openRouterModelsQuery.error
                      ? `Model list unavailable: ${openRouterModelsQuery.error.message}`
                      : `Models: ${openRouterModelsQuery.data?.total ?? 0} total, ${filteredOpenRouterModels.length} shown`}
                </div>
              </div>
            ) : (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <optgroup label="Reasoning / Thinking Models">
                  {models.filter(m => m.category === 'reasoning').map((m) => (
                    <option key={m.id} value={m.id}>{m.name} - {m.description}</option>
                  ))}
                </optgroup>
                <optgroup label="Standard Models">
                  {models.filter(m => m.category === 'standard').map((m) => (
                    <option key={m.id} value={m.id}>{m.name} - {m.description}</option>
                  ))}
                </optgroup>
              </select>
            )}
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
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Model:</span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{existingKey.model || defaultModel}</code>
            </div>
            {existingKey.reasoningEffort && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Effort:</span>
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  existingKey.reasoningEffort === 'xhigh' ? 'bg-red-100 text-red-700' :
                  existingKey.reasoningEffort === 'high' ? 'bg-orange-100 text-orange-700' :
                  existingKey.reasoningEffort === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-100 text-blue-700',
                )}>
                  {existingKey.reasoningEffort === 'xhigh' ? 'Extra High' :
                   existingKey.reasoningEffort.charAt(0).toUpperCase() + existingKey.reasoningEffort.slice(1)}
                </span>
              </div>
            )}
          </div>

          {/* Toggle model settings */}
          <button
            onClick={() => setShowModelSettings(!showModelSettings)}
            className="text-sm font-medium text-primary hover:underline"
          >
            {showModelSettings ? 'Hide model settings' : 'Change model & effort'}
          </button>

          {showModelSettings && (
            <div className="rounded-lg border border-border bg-background p-4">
              {provider === 'openrouter' ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">OpenRouter Model</label>
                    <input
                      type="text"
                      value={openRouterSearch}
                      onChange={(event) => setOpenRouterSearch(event.target.value)}
                      placeholder="Search model (provider/model, name...)"
                      className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <select
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {!openRouterModelPresent && model && (
                        <option value={model}>Current: {model}</option>
                      )}
                      {openRouterReasoningModels.length > 0 && (
                        <optgroup label="Reasoning / Thinking Models">
                          {openRouterReasoningModels.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.id}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {openRouterStandardModels.length > 0 && (
                        <optgroup label="Standard Models">
                          {openRouterStandardModels.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.id}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {filteredOpenRouterModels.length === 0 && (
                        <option value="" disabled>
                          No model found for search
                        </option>
                      )}
                    </select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {openRouterModelsQuery.isFetching
                        ? 'Loading OpenRouter models...'
                        : openRouterModelsQuery.error
                          ? `Model list unavailable: ${openRouterModelsQuery.error.message}`
                          : `Models: ${openRouterModelsQuery.data?.total ?? 0} total, ${filteredOpenRouterModels.length} shown`}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground">Reasoning Effort</label>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {REASONING_EFFORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setEffort(opt.value)}
                          disabled={saving}
                          className={cn(
                            'group flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all',
                            effort === opt.value
                              ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                              : 'border-border hover:border-primary/30 hover:bg-muted/50',
                          )}
                        >
                          <span className={cn('h-2 w-2 rounded-full', opt.color)} />
                          <span className="text-xs font-medium">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <ModelSelector
                  provider={provider}
                  selectedModel={model}
                  selectedEffort={effort}
                  onModelChange={setModel}
                  onEffortChange={setEffort}
                  saving={saving}
                />
              )}
              {hasModelChanges && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => onUpdateModel(existingKey.id, model, effort)}
                    disabled={saving}
                    className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => {
                      setModel(existingKey.model || defaultModel);
                      setEffort((existingKey.reasoningEffort as ReasoningEffort) || 'medium');
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
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
        </div>
      )}
    </div>
  );
}

// ─── Main Settings Page ──────────────────────────────────────
export default function SettingsPage(): React.ReactElement {
  const [savingProvider, setSavingProvider] = useState<Provider | null>(null);
  const [connectingOAuth, setConnectingOAuth] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [claudeSetupKey, setClaudeSetupKey] = useState('');
  const [showClaudeSetupKey, setShowClaudeSetupKey] = useState(false);
  const [showClaudeModelSelector, setShowClaudeModelSelector] = useState(false);
  const [claudeOAuthPending, setClaudeOAuthPending] = useState(false);
  const [claudeOAuthState, setClaudeOAuthState] = useState('');
  const [claudeManualCode, setClaudeManualCode] = useState('');
  const [claudeSubmitting, setClaudeSubmitting] = useState(false);

  const isAdmin = useIsAdmin();
  const apiKeysQuery = trpc.apiKeys.list.useQuery();
  const diagnosticsQuery = trpc.apiKeys.diagnostics.useQuery(undefined, {
    enabled: false,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Derive provider keys early so state initializers can use them
  const keys = apiKeysQuery.data ?? [];
  const openaiKey = keys.find((k) => k.provider === 'openai');
  const anthropicKey = keys.find((k) => k.provider === 'anthropic');
  const openrouterKey = keys.find((k) => k.provider === 'openrouter');

  const defaultAnthropicModel = getDefaultModel('anthropic');
  const [claudeModel, setClaudeModel] = useState(anthropicKey?.model || defaultAnthropicModel);
  const [claudeEffort, setClaudeEffort] = useState<ReasoningEffort | null>(
    (anthropicKey?.reasoningEffort as ReasoningEffort) || 'medium'
  );

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
      // Reset Claude subscription state on disconnect
      setShowClaudeModelSelector(false);
      setClaudeOAuthPending(false);
      setClaudeManualCode('');
      setClaudeModel(defaultAnthropicModel);
      setClaudeEffort('medium');
      setSuccessMsg('Disconnected successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (err) => {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(null), 5000);
    },
  });
  const updateKeyMutation = trpc.apiKeys.update.useMutation({
    onSuccess: () => {
      void apiKeysQuery.refetch();
      setSavingModel(false);
      setSuccessMsg('Model settings updated!');
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (err) => {
      setSavingModel(false);
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(null), 5000);
    },
  });
  const startOAuthMutation = trpc.apiKeys.startOAuthLogin.useMutation({
    onSuccess: (data) => {
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
  const startClaudeOAuthMutation = trpc.apiKeys.startClaudeOAuth.useMutation({
    onSuccess: (data) => {
      // Open the Anthropic auth page in a new window
      window.open(data.authUrl, '_blank', 'width=600,height=700');
      setConnectingOAuth(false);
      setClaudeOAuthPending(true);
      setClaudeOAuthState(data.state);
      setSuccessMsg('Claude login window opened. Sign in with your Claude account, then paste the authorization code shown on screen below.');
      setTimeout(() => setSuccessMsg(null), 15000);
    },
    onError: (err) => {
      setConnectingOAuth(false);
      setClaudeOAuthPending(false);
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(null), 5000);
    },
  });
  const completeClaudeOAuthMutation = trpc.apiKeys.completeClaudeOAuth.useMutation({
    onSuccess: (data) => {
      void apiKeysQuery.refetch();
      setClaudeOAuthPending(false);
      setClaudeManualCode('');
      setClaudeOAuthState('');
      setClaudeSubmitting(false);
      setSuccessMsg(data.message || 'Claude connected successfully!');
      setTimeout(() => setSuccessMsg(null), 5000);
    },
    onError: (err) => {
      setClaudeSubmitting(false);
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(null), 5000);
    },
  });
  const useClaudeSetupKeyMutation = trpc.apiKeys.useClaudeSetupKey.useMutation({
    onSuccess: (data) => {
      void apiKeysQuery.refetch();
      setSuccessMsg(data.message || 'Claude setup key connected!');
      setTimeout(() => setSuccessMsg(null), 5000);
    },
    onError: (err) => {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(null), 5000);
    },
  });

  // Auto-refresh when returning from OAuth
  useEffect(() => {
    const handleFocus = () => { void apiKeysQuery.refetch(); };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [apiKeysQuery]);

  // Sync Claude model/effort state when data changes (e.g. after refetch)
  useEffect(() => {
    if (anthropicKey?.model) setClaudeModel(anthropicKey.model);
    if (anthropicKey?.reasoningEffort) setClaudeEffort(anthropicKey.reasoningEffort as ReasoningEffort);
  }, [anthropicKey?.model, anthropicKey?.reasoningEffort]);

  const handleSave = (data: { provider: Provider; apiKey: string; model?: string }) => {
    setSavingProvider(data.provider);
    addKeyMutation.mutate({ provider: data.provider, apiKey: data.apiKey, model: data.model });
  };

  const handleDelete = (id: string) => {
    deleteKeyMutation.mutate({ id });
  };

  const handleStartOAuth = () => {
    setConnectingOAuth(true);
    startOAuthMutation.mutate({ provider: 'openai' });
  };

  const handleStartClaudeOAuth = () => {
    setConnectingOAuth(true);
    startClaudeOAuthMutation.mutate({ provider: 'anthropic' });
  };

  const handleClaudeSetupKey = () => {
    if (!claudeSetupKey.trim()) return;
    useClaudeSetupKeyMutation.mutate({ setupKey: claudeSetupKey.trim() });
    setClaudeSetupKey('');
    setShowClaudeSetupKey(false);
  };

  const handleUpdateModel = (id: string, model: string, effort: ReasoningEffort | null) => {
    setSavingModel(true);
    updateKeyMutation.mutate({ id, model, reasoningEffort: effort });
  };

  const connectedCount = keys.filter(k => k.isActive).length;
  const diagnostics = diagnosticsQuery.data?.providers as ProviderDiagnostic[] | undefined;
  const diagnosticsCheckedAt = diagnosticsQuery.data?.checkedAt;
  const isDiagnosticsFetching = diagnosticsQuery.isFetching;
  const refetchDiagnostics = diagnosticsQuery.refetch;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-muted-foreground">
        Connect AI providers to power task extraction and comparative analysis.
      </p>

      {/* Connected providers summary */}
      <div className="mt-4 flex items-center gap-3">
        <span className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
          connectedCount > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
        )}>
          <span className={cn('h-2 w-2 rounded-full', connectedCount > 0 ? 'bg-green-500' : 'bg-gray-400')} />
          {connectedCount} provider{connectedCount !== 1 ? 's' : ''} connected
        </span>
        {connectedCount >= 2 && (
          <span className="text-xs text-muted-foreground">
            ✨ Comparative analysis available!
          </span>
        )}
      </div>

      <div className="mt-4 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Model Health & Quota</h2>
            <p className="text-xs text-muted-foreground">
              Run provider checks to verify active model connectivity and visible quota information.
            </p>
          </div>
          <button
            onClick={() => void refetchDiagnostics()}
            disabled={connectedCount === 0 || isDiagnosticsFetching}
            className="inline-flex h-8 items-center justify-center rounded-md border border-input px-3 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDiagnosticsFetching ? 'Checking...' : 'Run checks'}
          </button>
        </div>

        {diagnosticsQuery.error && (
          <p className="mt-3 text-xs text-red-600">Diagnostics failed: {diagnosticsQuery.error.message}</p>
        )}

        {diagnostics && diagnostics.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {diagnostics.map((item) => (
              <div key={item.provider} className="rounded-lg border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span>{getProviderIcon(item.provider)}</span>
                    <span className="text-sm font-medium">{getProviderLabel(item.provider)}</span>
                  </div>
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', getDiagnosticBadgeClasses(item.status))}>
                    {item.status === 'ok'
                      ? 'Working'
                      : item.status === 'error'
                        ? 'Error'
                        : item.status === 'inactive'
                          ? 'Inactive'
                          : 'Not configured'}
                  </span>
                </div>

                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p>
                    Model:{' '}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground">
                      {item.model || '-'}
                    </code>
                  </p>
                  <p>Auth: {item.authMethod ?? '-'}</p>
                  <p>Latency: {item.latencyMs ? `${item.latencyMs}ms` : '-'}</p>
                  <p className={item.status === 'error' ? 'text-red-600' : ''}>{item.message}</p>
                  {item.quota && (
                    item.quota.status === 'available' ? (
                      <p className="text-foreground">
                        Quota: {formatUsd(item.quota.remainingUsd)} remaining / {formatUsd(item.quota.limitUsd)} limit
                      </p>
                    ) : (
                      <p>{item.quota.note || 'Quota details unavailable.'}</p>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            {connectedCount === 0
              ? 'Connect at least one provider to run diagnostics.'
              : 'No diagnostics run yet.'}
          </p>
        )}

        {diagnosticsCheckedAt && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Last check: {new Date(diagnosticsCheckedAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{successMsg}</div>
      )}
      {errorMsg && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMsg}</div>
      )}

      <div className="mt-6 space-y-6">
        {/* ── Sign in with Subscription ── */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <h2 className="text-lg font-semibold">Sign in with AI Subscription</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your ChatGPT or Claude subscription directly. No API key needed.
          </p>

          <div className="mt-5 space-y-4">
            {/* OpenAI OAuth */}
            <OpenAIOAuthCard
              existingKey={openaiKey as ExistingKeyData | undefined}
              onDisconnect={handleDelete}
              onStartOAuth={handleStartOAuth}
              onUpdateModel={handleUpdateModel}
              connecting={connectingOAuth}
              saving={savingModel}
            />

            {/* Claude Subscription */}
            {(anthropicKey?.authMethod === 'oauth' || anthropicKey?.oauthEmail || anthropicKey?.keyHint?.startsWith('OAuth:')) ? (
              <div className="rounded-xl border-2 border-purple-500/30 bg-purple-500/5 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10 text-lg">🧠</div>
                    <div>
                      <h3 className="font-semibold text-purple-400">Claude Max Subscription Connected</h3>
                      {anthropicKey.oauthEmail ? (
                        <p className="text-sm text-blue-400">{anthropicKey.oauthEmail}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {anthropicKey.authMethod === 'oauth' ? 'Using subscription quota (auto-refreshing)' : anthropicKey.keyHint}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500" /> Connected
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Model:</span>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono font-semibold">{anthropicKey.model || defaultAnthropicModel}</code>
                  </div>
                  {anthropicKey.reasoningEffort && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Effort:</span>
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        anthropicKey.reasoningEffort === 'xhigh' ? 'bg-red-100 text-red-700' :
                        anthropicKey.reasoningEffort === 'high' ? 'bg-orange-100 text-orange-700' :
                        anthropicKey.reasoningEffort === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700',
                      )}>
                        {anthropicKey.reasoningEffort === 'xhigh' ? 'Extra High' :
                         anthropicKey.reasoningEffort.charAt(0).toUpperCase() + anthropicKey.reasoningEffort.slice(1)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <button onClick={() => setShowClaudeModelSelector(!showClaudeModelSelector)} className="text-sm font-medium text-primary hover:underline">
                    {showClaudeModelSelector ? 'Hide model settings' : 'Change model & thinking effort'}
                  </button>
                </div>

                {showClaudeModelSelector && (
                  <div className="mt-4 rounded-lg border border-border bg-background p-4">
                    <ModelSelector
                      provider="anthropic"
                      selectedModel={claudeModel}
                      selectedEffort={claudeEffort}
                      onModelChange={setClaudeModel}
                      onEffortChange={setClaudeEffort}
                      saving={savingModel}
                    />
                    {(claudeModel !== (anthropicKey.model || defaultAnthropicModel) ||
                      claudeEffort !== ((anthropicKey.reasoningEffort as ReasoningEffort) || 'medium')) && (
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => handleUpdateModel(anthropicKey.id, claudeModel, claudeEffort)}
                          disabled={savingModel}
                          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          {savingModel ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          onClick={() => {
                            setClaudeModel(anthropicKey.model || defaultAnthropicModel);
                            setClaudeEffort((anthropicKey.reasoningEffort as ReasoningEffort) || 'medium');
                          }}
                          className="inline-flex h-9 items-center justify-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => handleDelete(anthropicKey.id)}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-destructive/30 px-3 text-sm font-medium text-destructive hover:bg-destructive/10"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-border p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">🧠</div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Anthropic Claude</h3>
                    <p className="text-sm text-muted-foreground">Sign in with your Claude Pro/Max subscription — uses your subscription quota directly</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {/* OAuth Login */}
                  {!claudeOAuthPending ? (
                    <button
                      onClick={handleStartClaudeOAuth}
                      disabled={connectingOAuth}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#6d28d9] disabled:opacity-50"
                    >
                      {connectingOAuth ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" /></svg>
                          Connecting...
                        </>
                      ) : 'Sign in with Claude'}
                    </button>
                  ) : (
                    <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🧠</span>
                        <span className="text-sm font-medium text-purple-400">Paste your authorization code</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        After logging in at Anthropic, you&apos;ll see an authorization code on screen. Copy and paste it below:
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={claudeManualCode}
                          onChange={(e) => setClaudeManualCode(e.target.value)}
                          placeholder="Paste authorization code here..."
                          className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-mono"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && claudeManualCode.trim() && !claudeSubmitting) {
                              setClaudeSubmitting(true);
                              completeClaudeOAuthMutation.mutate({
                                code: claudeManualCode.trim(),
                                state: claudeOAuthState,
                              });
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            if (!claudeManualCode.trim() || claudeSubmitting) return;
                            setClaudeSubmitting(true);
                            completeClaudeOAuthMutation.mutate({
                              code: claudeManualCode.trim(),
                              state: claudeOAuthState,
                            });
                          }}
                          disabled={!claudeManualCode.trim() || claudeSubmitting}
                          className="inline-flex h-9 items-center justify-center rounded-md bg-purple-600 px-4 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                        >
                          {claudeSubmitting ? 'Connecting...' : 'Connect'}
                        </button>
                      </div>
                      <button
                        onClick={() => { setClaudeOAuthPending(false); setClaudeManualCode(''); setClaudeOAuthState(''); }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Setup Key option */}
                  {!claudeOAuthPending && (
                    <>
                      <div className="text-center">
                        <button
                          onClick={() => setShowClaudeSetupKey(!showClaudeSetupKey)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          {showClaudeSetupKey ? 'Hide' : 'Or use a setup key from `claude setup-token`'}
                        </button>
                      </div>

                      {showClaudeSetupKey && (
                        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Run <code className="rounded bg-muted px-1 font-mono text-[11px]">claude setup-token</code> in your terminal to get a long-lived token.
                          </p>
                          <input
                            type="password"
                            value={claudeSetupKey}
                            onChange={(e) => setClaudeSetupKey(e.target.value)}
                            placeholder="sk-ant-oat01-..."
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm font-mono"
                          />
                          <button
                            onClick={handleClaudeSetupKey}
                            disabled={!claudeSetupKey.trim() || useClaudeSetupKeyMutation.isPending}
                            className="inline-flex h-8 w-full items-center justify-center rounded-md bg-purple-600 px-4 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                          >
                            {useClaudeSetupKeyMutation.isPending ? 'Validating...' : 'Connect with Setup Key'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-blue-200/50 bg-blue-50/50 p-3 text-xs text-blue-600">
            <strong>How it works:</strong> Sign in with your ChatGPT/Claude subscription → Choose your model → AI analysis uses your subscription quota. Tokens auto-refresh every 8 hours.
          </div>
        </div>

        {/* ── API Keys ── */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔑</span>
            <h2 className="text-lg font-semibold">API Keys</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Add API keys for direct provider access. Configure multiple providers for comparative analysis.
          </p>

          <div className="mt-5 space-y-4">
            {/* OpenAI API Key */}
            <ApiKeyCard
              provider="openai"
              existingKey={openaiKey as ExistingKeyData | undefined}
              onSave={handleSave}
              onDelete={handleDelete}
              onUpdateModel={handleUpdateModel}
              saving={savingProvider === 'openai'}
            />

            {/* Anthropic Claude API Key */}
            <ApiKeyCard
              provider="anthropic"
              existingKey={anthropicKey as ExistingKeyData | undefined}
              onSave={handleSave}
              onDelete={handleDelete}
              onUpdateModel={handleUpdateModel}
              saving={savingProvider === 'anthropic'}
            />

            {/* OpenRouter API Key */}
            <ApiKeyCard
              provider="openrouter"
              existingKey={openrouterKey as ExistingKeyData | undefined}
              onSave={handleSave}
              onDelete={handleDelete}
              onUpdateModel={handleUpdateModel}
              saving={savingProvider === 'openrouter'}
            />
          </div>

          {/* OpenRouter info box */}
          <div className="mt-4 rounded-lg border border-cyan-200/50 bg-cyan-50/50 p-3 text-xs text-cyan-700">
            <strong>OpenRouter</strong> gives you access to 500+ AI models through a single API key — including OpenAI, Claude, Gemini, DeepSeek, Llama, and more.
            Perfect for comparing models without separate API keys for each provider.{' '}
            <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-cyan-600 underline hover:text-cyan-800">
              Learn more →
            </a>
          </div>
        </div>

        {/* Organization Settings — admin only */}
        {isAdmin && (
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Organization</h2>
                <p className="mt-1 text-sm text-muted-foreground">Manage your organization details and preferences.</p>
              </div>
              <InviteMemberDialog />
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium">Organization Name</label>
                <input
                  type="text"
                  placeholder="Your organization"
                  className="mt-1 flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Pending Invitations — admin only */}
        {isAdmin && <PendingInvitationsList />}

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
