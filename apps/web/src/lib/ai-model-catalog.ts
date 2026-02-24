export type AIProvider = 'openai' | 'anthropic' | 'openrouter';
export type AIReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

export interface AIModelDef {
  id: string;
  name: string;
  description: string;
  category: 'reasoning' | 'standard';
  supportsReasoning: boolean;
  contextWindow?: string;
}

export const AI_MODEL_CATALOG: Record<AIProvider, AIModelDef[]> = {
  openai: [
    { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex', description: 'Most capable agentic coding model', category: 'reasoning', supportsReasoning: true, contextWindow: '400K' },
    { id: 'gpt-5.3-codex-spark', name: 'GPT-5.3 Codex Spark', description: 'Fast real-time coding, 1000+ tok/s', category: 'standard', supportsReasoning: false, contextWindow: '400K' },
    { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex', description: 'Advanced agentic coding, strong reasoning', category: 'reasoning', supportsReasoning: true, contextWindow: '400K' },
    { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex', description: 'Previous codex flagship', category: 'reasoning', supportsReasoning: true, contextWindow: '400K' },
    { id: 'gpt-5.1-codex-max', name: 'GPT-5.1 Codex Max', description: 'Maximum capability codex', category: 'reasoning', supportsReasoning: true, contextWindow: '400K' },
    { id: 'gpt-5.1-codex-mini', name: 'GPT-5.1 Codex Mini', description: 'Cost-effective codex', category: 'standard', supportsReasoning: false, contextWindow: '400K' },
    { id: 'gpt-5-codex', name: 'GPT-5 Codex', description: 'Default cloud tasks & code review', category: 'reasoning', supportsReasoning: true, contextWindow: '400K' },
    { id: 'gpt-5-codex-mini', name: 'GPT-5 Codex Mini', description: 'Lightweight codex variant', category: 'standard', supportsReasoning: false, contextWindow: '400K' },
    { id: 'codex-mini-latest', name: 'Codex Mini', description: 'Default Codex CLI model', category: 'standard', supportsReasoning: false, contextWindow: '200K' },
    { id: 'gpt-5.2', name: 'GPT-5.2', description: 'Flagship thinking model, 400K ctx', category: 'reasoning', supportsReasoning: true, contextWindow: '400K' },
    { id: 'gpt-5.1', name: 'GPT-5.1', description: 'Previous flagship with reasoning', category: 'reasoning', supportsReasoning: true, contextWindow: '400K' },
    { id: 'gpt-5', name: 'GPT-5', description: 'Advanced reasoning model', category: 'reasoning', supportsReasoning: true, contextWindow: '400K' },
    { id: 'o3', name: 'o3', description: 'Dedicated reasoning, 200K ctx', category: 'reasoning', supportsReasoning: true, contextWindow: '200K' },
    { id: 'o3-pro', name: 'o3-pro', description: 'Extended thinking, highest accuracy', category: 'reasoning', supportsReasoning: true, contextWindow: '200K' },
    { id: 'o4-mini', name: 'o4-mini', description: 'Fast reasoning, cost-efficient', category: 'reasoning', supportsReasoning: true, contextWindow: '200K' },
    { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Smartest standard model, 1M ctx', category: 'standard', supportsReasoning: false, contextWindow: '1M' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Fast, cost-effective, 1M ctx', category: 'standard', supportsReasoning: false, contextWindow: '1M' },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', description: 'Ultra-fast, cheapest', category: 'standard', supportsReasoning: false, contextWindow: '1M' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Multimodal, 128K ctx', category: 'standard', supportsReasoning: false, contextWindow: '128K' },
  ],
  anthropic: [
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', description: 'Most powerful, adaptive thinking', category: 'reasoning', supportsReasoning: true, contextWindow: '200K' },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: 'Balanced, adaptive thinking', category: 'reasoning', supportsReasoning: true, contextWindow: '200K' },
    { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', description: 'Extended thinking, deep analysis', category: 'reasoning', supportsReasoning: true, contextWindow: '200K' },
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', description: 'Extended thinking, balanced', category: 'reasoning', supportsReasoning: true, contextWindow: '200K' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Extended thinking capable', category: 'reasoning', supportsReasoning: true, contextWindow: '200K' },
    { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', description: 'First thinking model', category: 'reasoning', supportsReasoning: true, contextWindow: '200K' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast, affordable, 200K ctx', category: 'standard', supportsReasoning: false, contextWindow: '200K' },
  ],
  openrouter: [
    { id: 'openai/gpt-5.2', name: 'OpenAI GPT-5.2', description: 'Flagship via OpenRouter', category: 'reasoning', supportsReasoning: true },
    { id: 'openai/gpt-5', name: 'OpenAI GPT-5', description: 'Advanced reasoning', category: 'reasoning', supportsReasoning: true },
    { id: 'openai/o3', name: 'OpenAI o3', description: 'Dedicated reasoning', category: 'reasoning', supportsReasoning: true },
    { id: 'openai/o4-mini', name: 'OpenAI o4-mini', description: 'Fast reasoning', category: 'reasoning', supportsReasoning: true },
    { id: 'anthropic/claude-opus-4-6', name: 'Claude Opus 4.6', description: 'Most powerful Claude', category: 'reasoning', supportsReasoning: true },
    { id: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: 'Balanced Claude', category: 'reasoning', supportsReasoning: true },
    { id: 'anthropic/claude-sonnet-4-5', name: 'Claude Sonnet 4.5', description: 'Previous best Claude', category: 'reasoning', supportsReasoning: true },
    { id: 'google/gemini-2.5-pro-preview', name: 'Google Gemini 2.5 Pro', description: 'Google flagship', category: 'reasoning', supportsReasoning: true },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', description: 'Reasoning model', category: 'reasoning', supportsReasoning: true },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', description: 'General purpose', category: 'standard', supportsReasoning: false },
    { id: 'meta-llama/llama-3.3-70b', name: 'Llama 3.3 70B', description: 'Open source (free)', category: 'standard', supportsReasoning: false },
  ],
};

export const DEFAULT_MODEL_BY_PROVIDER: Record<AIProvider, string> = {
  openai: 'gpt-5.2-codex',
  anthropic: 'claude-sonnet-4-6',
  openrouter: 'openai/gpt-5.2',
};

export function getModelsForProvider(provider: AIProvider): AIModelDef[] {
  return AI_MODEL_CATALOG[provider];
}

export function getDefaultModel(provider: AIProvider): string {
  return DEFAULT_MODEL_BY_PROVIDER[provider];
}
