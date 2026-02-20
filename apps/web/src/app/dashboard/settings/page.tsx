'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

type Provider = 'openai' | 'anthropic' | 'openrouter';
type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

// ─── Model Definitions (Feb 2026 Latest) ────────────────────
interface ModelDef {
  id: string;
  name: string;
  description: string;
  category: 'reasoning' | 'standard';
  supportsReasoning: boolean;
  contextWindow?: string;
}

const OPENAI_MODELS: ModelDef[] = [
  // GPT-5 Reasoning Series
  { id: 'gpt-5.2', name: 'GPT-5.2', description: 'Flagship thinking model, 400K ctx', category: 'reasoning', supportsReasoning: true, contextWindow: '400K' },
  { id: 'gpt-5.2-pro', name: 'GPT-5.2 Pro', description: 'Enhanced reasoning, highest accuracy', category: 'reasoning', supportsReasoning: true, contextWindow: '400K' },
  { id: 'gpt-5.1', name: 'GPT-5.1', description: 'Previous flagship with reasoning', category: 'reasoning', supportsReasoning: true, contextWindow: '400K' },
  { id: 'gpt-5', name: 'GPT-5', description: 'Advanced reasoning model', category: 'reasoning', supportsReasoning: true, contextWindow: '400K' },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'Lightweight reasoning', category: 'reasoning', supportsReasoning: true, contextWindow: '400K' },
  // O-Series Reasoning
  { id: 'o3', name: 'o3', description: 'Dedicated reasoning, 200K ctx', category: 'reasoning', supportsReasoning: true, contextWindow: '200K' },
  { id: 'o3-pro', name: 'o3-pro', description: 'Extended thinking, highest accuracy', category: 'reasoning', supportsReasoning: true, contextWindow: '200K' },
  { id: 'o4-mini', name: 'o4-mini', description: 'Fast reasoning, cost-efficient', category: 'reasoning', supportsReasoning: true, contextWindow: '200K' },
  // Standard models
  { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Smartest standard model, 1M ctx', category: 'standard', supportsReasoning: false, contextWindow: '1M' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Fast, cost-effective, 1M ctx', category: 'standard', supportsReasoning: false, contextWindow: '1M' },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', description: 'Ultra-fast, cheapest', category: 'standard', supportsReasoning: false, contextWindow: '1M' },
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Multimodal, 128K ctx', category: 'standard', supportsReasoning: false, contextWindow: '128K' },
];

const ANTHROPIC_MODELS: ModelDef[] = [
  // Thinking-capable models
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', description: 'Most powerful, adaptive thinking', category: 'reasoning', supportsReasoning: true, contextWindow: '200K' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: 'Balanced, adaptive thinking', category: 'reasoning', supportsReasoning: true, contextWindow: '200K' },
  { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', description: 'Extended thinking, deep analysis', category: 'reasoning', supportsReasoning: true, contextWindow: '200K' },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', description: 'Extended thinking, balanced', category: 'reasoning', supportsReasoning: true, contextWindow: '200K' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Extended thinking capable', category: 'reasoning', supportsReasoning: true, contextWindow: '200K' },
  { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', description: 'First thinking model', category: 'reasoning', supportsReasoning: true, contextWindow: '200K' },
  // Standard models
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast, affordable, 200K ctx', category: 'standard', supportsReasoning: false, contextWindow: '200K' },
];

const OPENROUTER_MODELS: ModelDef[] = [
  // OpenAI via OpenRouter
  { id: 'openai/gpt-5.2', name: 'OpenAI GPT-5.2', description: 'Flagship via OpenRouter', category: 'reasoning', supportsReasoning: true },
  { id: 'openai/gpt-5', name: 'OpenAI GPT-5', description: 'Advanced reasoning', category: 'reasoning', supportsReasoning: true },
  { id: 'openai/o3', name: 'OpenAI o3', description: 'Dedicated reasoning', category: 'reasoning', supportsReasoning: true },
  { id: 'openai/o4-mini', name: 'OpenAI o4-mini', description: 'Fast reasoning', category: 'reasoning', supportsReasoning: true },
  // Anthropic via OpenRouter
  { id: 'anthropic/claude-opus-4-6', name: 'Claude Opus 4.6', description: 'Most powerful Claude', category: 'reasoning', supportsReasoning: true },
  { id: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: 'Balanced Claude', category: 'reasoning', supportsReasoning: true },
  { id: 'anthropic/claude-sonnet-4-5', name: 'Claude Sonnet 4.5', description: 'Previous best Claude', category: 'reasoning', supportsReasoning: true },
  // Google via OpenRouter
  { id: 'google/gemini-2.5-pro-preview', name: 'Google Gemini 2.5 Pro', description: 'Google flagship', category: 'reasoning', supportsReasoning: true },
  // DeepSeek via OpenRouter
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', description: 'Reasoning model', category: 'reasoning', supportsReasoning: true },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', description: 'General purpose', category: 'standard', supportsReasoning: false },
  // Meta via OpenRouter
  { id: 'meta-llama/llama-3.3-70b', name: 'Llama 3.3 70B', description: 'Open source (free)', category: 'standard', supportsReasoning: false },
];

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

function getModelsForProvider(provider: Provider): ModelDef[] {
  switch (provider) {
    case 'openai': return OPENAI_MODELS;
    case 'anthropic': return ANTHROPIC_MODELS;
    case 'openrouter': return OPENROUTER_MODELS;
  }
}

function getDefaultModel(provider: Provider): string {
  switch (provider) {
    case 'openai': return 'gpt-5.2';
    case 'anthropic': return 'claude-sonnet-4-6';
    case 'openrouter': return 'openai/gpt-5.2';
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
  const [selectedModel, setSelectedModel] = useState(existingKey?.model || 'gpt-5.2');
  const [selectedEffort, setSelectedEffort] = useState<ReasoningEffort | null>(
    (existingKey?.reasoningEffort as ReasoningEffort) || 'medium'
  );
  const [showModelSelector, setShowModelSelector] = useState(false);

  const hasChanges = isOAuth && existingKey && (
    selectedModel !== (existingKey.model || 'gpt-5.2') ||
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
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono font-semibold">{existingKey.model || 'gpt-5.2'}</code>
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
                    setSelectedModel(existingKey.model || 'gpt-5.2');
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

  // If this key is managed via subscription (OAuth or setup key), don't show manual card
  // It's already shown in the "Sign in with Subscription" section above
  if (isSubscriptionManaged) return null;

  const providerColor = getProviderColor(provider);
  const models = getModelsForProvider(provider);

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
              <ModelSelector
                provider={provider}
                selectedModel={model}
                selectedEffort={effort}
                onModelChange={setModel}
                onEffortChange={setEffort}
                saving={saving}
              />
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

  const apiKeysQuery = trpc.apiKeys.list.useQuery();

  // Derive provider keys early so state initializers can use them
  const keys = apiKeysQuery.data ?? [];
  const openaiKey = keys.find((k) => k.provider === 'openai');
  const anthropicKey = keys.find((k) => k.provider === 'anthropic');
  const openrouterKey = keys.find((k) => k.provider === 'openrouter');

  const [claudeModel, setClaudeModel] = useState(anthropicKey?.model || 'claude-sonnet-4-6');
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
      setClaudeModel('claude-sonnet-4-6');
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
      setSuccessMsg('Claude login window opened. After login, paste the authorization code shown on screen below.');
      setTimeout(() => setSuccessMsg(null), 10000);
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
                      <h3 className="font-semibold text-purple-400">Claude Subscription Connected</h3>
                      {anthropicKey.oauthEmail ? (
                        <p className="text-sm text-blue-400">{anthropicKey.oauthEmail}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">{anthropicKey.keyHint}</p>
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
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono font-semibold">{anthropicKey.model || 'claude-sonnet-4-6'}</code>
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
                    {(claudeModel !== (anthropicKey.model || 'claude-sonnet-4-6') ||
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
                            setClaudeModel(anthropicKey.model || 'claude-sonnet-4-6');
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
                    <p className="text-sm text-muted-foreground">Connect with Claude Pro/Max subscription or setup key</p>
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
            <strong>How it works:</strong> Sign in with your ChatGPT/Claude subscription → Choose your model → AI analysis uses your subscription quota.
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
