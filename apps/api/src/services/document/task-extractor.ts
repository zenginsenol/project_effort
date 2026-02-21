import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { ChatCompletionReasoningEffort } from 'openai/resources/chat/completions/completions';

/**
 * AI Task Extractor
 * Supports OpenAI, Anthropic Claude (with extended thinking), and OpenRouter.
 * Users can provide their own API keys for any provider.
 * Supports comparative analysis across multiple providers.
 */

interface ExtractedTask {
  title: string;
  description: string;
  type: 'epic' | 'feature' | 'story' | 'task' | 'subtask' | 'bug';
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedHours: number;
  estimatedPoints: number;
}

export interface ExtractionResult {
  projectSummary: string;
  totalEstimatedHours: number;
  totalEstimatedCost: number;
  tasks: ExtractedTask[];
  assumptions: string[];
  provider?: string;
  model?: string;
  thinkingUsed?: boolean;
  durationMs?: number;
}

export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';
export type AIProvider = 'openai' | 'anthropic' | 'openrouter';

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
  reasoningEffort?: ReasoningEffort | null;
  authMethod?: 'api_key' | 'oauth';
  oauthBetaHeader?: string | null;
  /** ChatGPT account ID extracted from OpenAI OAuth JWT (needed for subscription mode) */
  chatgptAccountId?: string | null;
}

// ─── Model Capability Maps ──────────────────────────────────

/**
 * OpenAI models that support the reasoning_effort parameter (o-series + GPT-5 series).
 */
const OPENAI_REASONING_MODELS = new Set([
  'o3', 'o3-pro', 'o3-mini', 'o4-mini',
  'o1', 'o1-mini', 'o1-pro',
  'gpt-5.2', 'gpt-5.2-pro', 'gpt-5.1', 'gpt-5', 'gpt-5-mini',
]);

/**
 * Anthropic models that support extended thinking / adaptive thinking.
 */
const CLAUDE_THINKING_MODELS = new Set([
  'claude-opus-4-6', 'claude-sonnet-4-6',
  'claude-opus-4-5-20251101', 'claude-sonnet-4-5-20250929',
  'claude-opus-4-1-20250805', 'claude-sonnet-4-20250514',
  'claude-3-7-sonnet-20250219',
]);

/**
 * OpenRouter models that natively support reasoning.
 * OpenRouter's unified `reasoning` param handles the mapping automatically.
 */
const OPENROUTER_REASONING_MODELS = new Set([
  'openai/gpt-5.2', 'openai/gpt-5.2-pro', 'openai/gpt-5', 'openai/gpt-5-mini',
  'openai/o3', 'openai/o3-pro', 'openai/o4-mini',
  'anthropic/claude-opus-4-6', 'anthropic/claude-sonnet-4-6',
  'anthropic/claude-opus-4-5', 'anthropic/claude-sonnet-4-5',
  'google/gemini-2.5-pro-preview',
  'deepseek/deepseek-r1',
]);

const SYSTEM_PROMPT = `You are an expert software project manager and technical architect.
Analyze the following project requirements document and extract a detailed task breakdown.

RULES:
- Break down into hierarchical tasks: epics > features > stories > tasks
- Each task must have realistic effort estimates
- Use Fibonacci scale for story points: 1, 2, 3, 5, 8, 13, 21, 34
- Estimate hours based on a mid-level developer
- Include infrastructure, testing, deployment tasks
- Add bug-prevention tasks (code review, testing)
- Be thorough - don't miss any requirement mentioned
- Priority: critical (blocking/core), high (important), medium (nice-to-have), low (future)

Respond ONLY with valid JSON in this exact format:
{
  "projectSummary": "Brief 1-2 sentence project description",
  "tasks": [
    {
      "title": "Task title (concise, actionable)",
      "description": "Detailed description of what needs to be done",
      "type": "epic|feature|story|task|subtask|bug",
      "priority": "critical|high|medium|low",
      "estimatedHours": 8,
      "estimatedPoints": 5
    }
  ],
  "assumptions": ["List of assumptions made during estimation"]
}`;

function isEnvApiKeyValid(): boolean {
  const key = process.env.OPENAI_API_KEY || '';
  return key.length > 10 && !key.includes('xxxxx');
}

/**
 * Check if a model supports reasoning for a specific provider
 */
function isReasoningModel(model: string, provider: AIProvider): boolean {
  if (provider === 'openai') {
    for (const rm of OPENAI_REASONING_MODELS) {
      if (model === rm || model.startsWith(`${rm}-`)) return true;
    }
    return false;
  }
  if (provider === 'anthropic') {
    for (const rm of CLAUDE_THINKING_MODELS) {
      if (model === rm || model.startsWith(`${rm}-`)) return true;
    }
    return false;
  }
  if (provider === 'openrouter') {
    return OPENROUTER_REASONING_MODELS.has(model);
  }
  return false;
}

/**
 * Parse JSON from AI response (handles markdown code blocks)
 */
function parseJsonResponse(content: string): unknown {
  let jsonText = content.trim();
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch?.[1]) {
    jsonText = jsonMatch[1].trim();
  }
  return JSON.parse(jsonText);
}

/**
 * Map our reasoning effort to OpenAI's chat-completions supported values.
 */
function mapOpenAIReasoningEffort(effort: ReasoningEffort): ChatCompletionReasoningEffort {
  switch (effort) {
    case 'low':
      return 'low';
    case 'medium':
      return 'medium';
    case 'high':
    case 'xhigh':
      return 'high';
    default:
      return 'medium';
  }
}

/**
 * Map reasoning effort to Claude thinking budget tokens
 */
function getClaudeThinkingBudget(effort: ReasoningEffort): number {
  switch (effort) {
    case 'low': return 4000;
    case 'medium': return 10000;
    case 'high': return 20000;
    case 'xhigh': return 40000;
    default: return 10000;
  }
}

// ─── Provider-specific extraction functions ──────────────────

/**
 * Extract tasks using OpenAI API
 * Supports reasoning_effort for o-series and GPT-5 models
 */
async function extractWithOpenAI(
  apiKey: string,
  model: string,
  userPrompt: string,
  reasoningEffort?: ReasoningEffort | null,
): Promise<ExtractionResult & { raw: true }> {
  const client = new OpenAI({ apiKey });
  const isReasoning = isReasoningModel(model, 'openai');
  const response = isReasoning
    ? await client.chat.completions.create({
      model,
      messages: [
        { role: 'developer', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_completion_tokens: 25000,
      ...(reasoningEffort
        ? { reasoning_effort: mapOpenAIReasoningEffort(reasoningEffort) }
        : {}),
    })
    : await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 16000,
      response_format: { type: 'json_object' },
    });

  console.log(`[task-extractor] OpenAI request: model=${model}, reasoning=${isReasoning}${reasoningEffort ? `, effort=${reasoningEffort}` : ''}`);
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('OpenAI did not return a response');

  return { ...parseJsonResponse(content) as ExtractionResult, raw: true };
}

/**
 * Extract the chatgpt_account_id from an OpenAI OAuth access token JWT.
 * The access token is a JWT whose payload contains account/user claims.
 */
function extractChatGPTAccountId(accessToken: string): string | null {
  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    // Try multiple claim names used by OpenAI
    return payload.chatgpt_account_id
      ?? payload.account_id
      ?? payload['https://api.openai.com/auth']?.account_id
      ?? null;
  } catch {
    return null;
  }
}

/**
 * Extract tasks using ChatGPT Backend API (Responses API).
 * Used when the user authenticated via ChatGPT subscription OAuth.
 * The ChatGPT subscription token cannot be used with api.openai.com;
 * it must use https://chatgpt.com/backend-api/codex/responses instead,
 * mirroring how the official Codex CLI works.
 */
async function extractWithOpenAIChatGPT(
  accessToken: string,
  model: string,
  userPrompt: string,
  reasoningEffort?: ReasoningEffort | null,
  chatgptAccountId?: string | null,
): Promise<ExtractionResult & { raw: true }> {
  const CHATGPT_RESPONSES_URL = 'https://chatgpt.com/backend-api/codex/responses';

  // Try to extract account ID from JWT if not provided
  const accountId = chatgptAccountId || extractChatGPTAccountId(accessToken);

  const isReasoning = isReasoningModel(model, 'openai');

  // Build Responses API request body
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestBody: Record<string, any> = {
    model,
    instructions: SYSTEM_PROMPT,
    input: [
      { role: 'user', content: [{ type: 'input_text', text: userPrompt }] },
    ],
    store: false,
    stream: false,
  };

  if (isReasoning && reasoningEffort) {
    requestBody.reasoning = {
      effort: reasoningEffort === 'xhigh' ? 'high' : reasoningEffort,
      summary: 'auto',
    };
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  if (accountId) {
    headers['chatgpt-account-id'] = accountId;
  }

  // ChatGPT backend requires streaming
  requestBody.stream = true;

  console.log(`[task-extractor] ChatGPT Backend API request: model=${model}, reasoning=${isReasoning}${reasoningEffort ? `, effort=${reasoningEffort}` : ''}, hasAccountId=${!!accountId}`);

  const response = await fetch(CHATGPT_RESPONSES_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ChatGPT API error (${response.status}): ${errorText}`);
  }

  // Parse SSE stream to collect text output
  const responseText = await response.text();
  let textContent = '';
  let responseId = '';

  for (const line of responseText.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const dataStr = line.slice(6).trim();
    if (dataStr === '[DONE]') break;

    try {
      const event = JSON.parse(dataStr);

      // Handle response.completed event which has the full output
      if (event.type === 'response.completed' && event.response) {
        responseId = event.response.id ?? responseId;
        const outputItems = event.response.output ?? [];
        for (const item of outputItems) {
          if (item.type === 'message' && Array.isArray(item.content)) {
            for (const block of item.content) {
              if (block.type === 'output_text' && typeof block.text === 'string') {
                textContent = block.text;
              }
            }
          }
        }
      }

      // Also collect text deltas for incremental output
      if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
        textContent += event.delta;
      }
    } catch {
      // Ignore unparseable SSE lines
    }
  }

  if (!textContent) {
    throw new Error('ChatGPT did not return a response');
  }

  console.log(`[task-extractor] ChatGPT response received (${textContent.length} chars)${responseId ? `, id=${responseId}` : ''}`);

  return { ...parseJsonResponse(textContent) as ExtractionResult, raw: true };
}

/**
 * Extract tasks using Anthropic Claude API
 * Supports extended thinking for Claude 3.7+ and adaptive thinking for 4.5+
 */
async function extractWithAnthropic(
  apiKey: string,
  model: string,
  userPrompt: string,
  reasoningEffort?: ReasoningEffort | null,
  authOptions?: {
    authMethod?: 'api_key' | 'oauth';
    oauthBetaHeader?: string | null;
  },
): Promise<ExtractionResult & { raw: true; thinkingUsed?: boolean }> {
  const supportsThinking = isReasoningModel(model, 'anthropic');
  const useThinking = supportsThinking && reasoningEffort && reasoningEffort !== 'low';
  const isOAuth = authOptions?.authMethod === 'oauth';
  const oauthBetaHeader = authOptions?.oauthBetaHeader ?? 'oauth-2025-04-20';

  // Check if model supports adaptive thinking (4.5+)
  const isAdaptive = model.includes('4-6') || model.includes('4-5');

  let thinkingUsed = false;

  if (isOAuth) {
    const budgetTokens = useThinking ? getClaudeThinkingBudget(reasoningEffort) : 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestBody: Record<string, any> = {
      model,
      max_tokens: useThinking ? budgetTokens + 16000 : 16000,
      messages: useThinking
        ? [
          { role: 'user', content: `${SYSTEM_PROMPT}\n\n${userPrompt}\n\nRespond ONLY with the JSON object, no other text.` },
        ]
        : [
          { role: 'user', content: `${userPrompt}\n\nRespond ONLY with the JSON object, no other text.` },
        ],
    };

    if (useThinking) {
      thinkingUsed = true;
      requestBody.thinking = { type: 'enabled', budget_tokens: budgetTokens };
    } else {
      requestBody.temperature = 0.2;
      requestBody.system = SYSTEM_PROMPT;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-beta': oauthBetaHeader,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic OAuth API error (${response.status}): ${errorText}`);
    }

    const payload = await response.json() as {
      content?: Array<{ type: string; text?: string }>;
    };

    const textBlock = payload.content?.find((block) => block.type === 'text' && typeof block.text === 'string');
    if (!textBlock || !textBlock.text) {
      throw new Error('Claude OAuth did not return a text response');
    }

    return { ...parseJsonResponse(textBlock.text) as ExtractionResult, raw: true, thinkingUsed };
  }

  const client = new Anthropic({ apiKey });

  if (useThinking) {
    thinkingUsed = true;
    const budgetTokens = getClaudeThinkingBudget(reasoningEffort);

    console.log(`[task-extractor] Anthropic request: model=${model}, thinking=${isAdaptive ? 'adaptive' : 'extended'}, budget=${budgetTokens}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const thinkingConfig: any = isAdaptive
      ? { type: 'enabled', budget_tokens: budgetTokens }
      : { type: 'enabled', budget_tokens: budgetTokens };

    const response = await client.messages.create({
      model,
      max_tokens: budgetTokens + 16000,
      thinking: thinkingConfig,
      messages: [
        { role: 'user', content: `${SYSTEM_PROMPT}\n\n${userPrompt}\n\nRespond ONLY with the JSON object, no other text.` },
      ],
    });

    // With thinking, response has thinking blocks + text blocks
    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude did not return a text response');
    }

    return { ...parseJsonResponse(textBlock.text) as ExtractionResult, raw: true, thinkingUsed };
  }

  // Standard mode (no thinking)
  console.log(`[task-extractor] Anthropic request: model=${model}, thinking=off`);

  const response = await client.messages.create({
    model,
    max_tokens: 16000,
    temperature: 0.2,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: userPrompt + '\n\nRespond ONLY with the JSON object, no other text.' },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude did not return a text response');
  }

  return { ...parseJsonResponse(textBlock.text) as ExtractionResult, raw: true, thinkingUsed };
}

/**
 * Extract tasks using OpenRouter API
 * OpenRouter provides a unified OpenAI-compatible API to access 500+ models.
 * Uses the unified `reasoning` parameter for reasoning models.
 */
async function extractWithOpenRouter(
  apiKey: string,
  model: string,
  userPrompt: string,
  reasoningEffort?: ReasoningEffort | null,
): Promise<ExtractionResult & { raw: true }> {
  const isReasoning = isReasoningModel(model, 'openrouter');
  type OpenRouterCompletionResponse = {
    choices?: Array<{ message?: { content?: string } }>;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 16000,
  };

  if (isReasoning && reasoningEffort) {
    body.reasoning = {
      effort: reasoningEffort,
      max_tokens: reasoningEffort === 'xhigh' ? 30000 : reasoningEffort === 'high' ? 20000 : 10000,
    };
    body.max_tokens = 25000;
  } else {
    body.temperature = 0.2;
  }

  console.log(`[task-extractor] OpenRouter request: model=${model}, reasoning=${isReasoning}${reasoningEffort ? `, effort=${reasoningEffort}` : ''}`);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://estimatepro.app',
      'X-Title': 'EstimatePro',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `OpenRouter API error: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorMessage;
    } catch { /* ignore */ }
    throw new Error(errorMessage);
  }

  const data = await response.json() as OpenRouterCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.length === 0) {
    throw new Error('OpenRouter did not return a response');
  }

  return { ...parseJsonResponse(content) as ExtractionResult, raw: true };
}

// ─── Main extraction function ────────────────────────────────

/**
 * Main extraction function - supports user API keys for OpenAI, Anthropic, or OpenRouter
 */
export async function extractTasksFromText(
  documentText: string,
  projectContext?: string,
  hourlyRate: number = 150,
  aiConfig?: AIProviderConfig | null,
): Promise<ExtractionResult> {
  const hasUserKey = Boolean(aiConfig?.apiKey && aiConfig.apiKey.length > 10);
  const hasEnvKey = isEnvApiKeyValid();

  if (!hasUserKey && !hasEnvKey) {
    throw new Error('No valid AI API key configured. Please add an active provider key in Settings or set OPENAI_API_KEY.');
  }

  const userPrompt = `${projectContext ? `Project Context: ${projectContext}\n\n` : ''}Requirements Document:\n\n${documentText.slice(0, 30000)}`;

  try {
    let rawResult: ExtractionResult & { raw: true; thinkingUsed?: boolean };
    let providerName: string;
    let modelName: string;
    let thinkingUsed = false;

    const startTime = Date.now();

    if (hasUserKey && aiConfig) {
      const provider = aiConfig.provider;
      providerName = provider;

      if (provider === 'anthropic') {
        modelName = aiConfig.model || 'claude-sonnet-4-6';
        console.log(`[task-extractor] Using Anthropic Claude (${modelName}) with user API key`);
        rawResult = await extractWithAnthropic(
          aiConfig.apiKey,
          modelName,
          userPrompt,
          aiConfig.reasoningEffort,
          {
            authMethod: aiConfig.authMethod,
            oauthBetaHeader: aiConfig.oauthBetaHeader,
          },
        );
        thinkingUsed = rawResult.thinkingUsed ?? false;
      } else if (provider === 'openrouter') {
        modelName = aiConfig.model || 'openai/gpt-5.2';
        console.log(`[task-extractor] Using OpenRouter (${modelName}) with user API key`);
        rawResult = await extractWithOpenRouter(aiConfig.apiKey, modelName, userPrompt, aiConfig.reasoningEffort);
      } else {
        modelName = aiConfig.model || 'gpt-5.2';

        // ChatGPT subscription OAuth tokens use a different backend API
        if (aiConfig.authMethod === 'oauth') {
          // ChatGPT Codex backend supports specific models only.
          // Reference: https://developers.openai.com/codex/models/
          const CHATGPT_SUPPORTED_MODELS = new Set([
            // Codex-optimized models (recommended)
            'gpt-5.3-codex', 'gpt-5.3-codex-spark',
            'gpt-5.2-codex',
            'gpt-5.1-codex', 'gpt-5.1-codex-max', 'gpt-5.1-codex-mini',
            'gpt-5-codex', 'gpt-5-codex-mini',
            // General GPT models that work with Codex
            'gpt-5.2', 'gpt-5.1', 'gpt-5',
            // Reasoning models
            'o3', 'o3-mini', 'o3-pro', 'o4-mini',
            // Codex-mini alias
            'codex-mini', 'codex-mini-latest',
          ]);
          if (!CHATGPT_SUPPORTED_MODELS.has(modelName)) {
            const fallback = 'gpt-5.2-codex';
            console.log(`[task-extractor] ChatGPT backend: model '${modelName}' not supported, falling back to '${fallback}'`);
            modelName = fallback;
          }

          console.log(`[task-extractor] Using ChatGPT Backend API (${modelName}) with OAuth subscription, effort=${aiConfig.reasoningEffort || 'default'}`);
          rawResult = await extractWithOpenAIChatGPT(
            aiConfig.apiKey,
            modelName,
            userPrompt,
            aiConfig.reasoningEffort,
            aiConfig.chatgptAccountId,
          );
        } else {
          console.log(`[task-extractor] Using OpenAI (${modelName}) with user key, effort=${aiConfig.reasoningEffort || 'default'}`);
          rawResult = await extractWithOpenAI(aiConfig.apiKey, modelName, userPrompt, aiConfig.reasoningEffort);
        }
      }
    } else {
      const envApiKey = process.env.OPENAI_API_KEY;
      if (!envApiKey) throw new Error('OPENAI_API_KEY is not configured');
      modelName = process.env.OPENAI_MODEL || 'gpt-4o';
      providerName = 'openai';
      console.log(`[task-extractor] Using OpenAI (${modelName}) with env API key`);
      rawResult = await extractWithOpenAI(envApiKey, modelName, userPrompt);
    }

    const durationMs = Date.now() - startTime;

    // Validate and normalize tasks
    const tasks = (rawResult.tasks ?? []).map((t: ExtractedTask) => ({
      title: t.title || 'Untitled Task',
      description: t.description || '',
      type: validateType(t.type),
      priority: validatePriority(t.priority),
      estimatedHours: Math.max(1, Math.round(t.estimatedHours || 4)),
      estimatedPoints: validateFibonacci(t.estimatedPoints),
    }));

    const totalHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);

    return {
      projectSummary: rawResult.projectSummary || 'Project tasks extracted from document',
      totalEstimatedHours: totalHours,
      totalEstimatedCost: totalHours * hourlyRate,
      tasks,
      assumptions: rawResult.assumptions ?? [],
      provider: providerName,
      model: modelName,
      thinkingUsed,
      durationMs,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[task-extractor] AI extraction failed: ${errMsg}`);

    if (errMsg.includes('401') || errMsg.includes('Unauthorized') || errMsg.includes('invalid_api_key') || errMsg.includes('authentication')) {
      throw new Error(`Invalid API key: The provided ${aiConfig?.provider || 'OpenAI'} API key is invalid or expired. Please check your key in Settings.`);
    }
    if (errMsg.includes('429') || errMsg.includes('rate_limit') || errMsg.includes('Rate limit')) {
      throw new Error(`Rate limit exceeded: Your ${aiConfig?.provider || 'OpenAI'} API key has hit its rate limit. Please try again later.`);
    }
    if (errMsg.includes('insufficient_quota') || errMsg.includes('billing')) {
      throw new Error(`Insufficient quota: Your ${aiConfig?.provider || 'OpenAI'} account has insufficient credits. Please check your billing.`);
    }

    throw new Error(`AI analysis failed: ${errMsg}`);
  }
}

// ─── Comparative Analysis ────────────────────────────────────

/**
 * Run extraction with multiple providers and return results for comparison.
 * Each provider runs independently - failures in one don't block others.
 */
export async function extractWithMultipleProviders(
  documentText: string,
  projectContext: string | undefined,
  hourlyRate: number,
  configs: AIProviderConfig[],
): Promise<{ results: ExtractionResult[]; errors: { provider: string; model: string; error: string }[] }> {
  const results: ExtractionResult[] = [];
  const errors: { provider: string; model: string; error: string }[] = [];

  // Run all providers in parallel
  const promises = configs.map(async (config) => {
    try {
      const result = await extractTasksFromText(documentText, projectContext, hourlyRate, config);
      return { success: true as const, result };
    } catch (err) {
      return {
        success: false as const,
        provider: config.provider,
        model: config.model || 'default',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  const settled = await Promise.all(promises);
  for (const s of settled) {
    if (s.success) {
      results.push(s.result);
    } else {
      errors.push({ provider: s.provider, model: s.model, error: s.error });
    }
  }

  return { results, errors };
}

function validateType(type: string): ExtractedTask['type'] {
  const valid = ['epic', 'feature', 'story', 'task', 'subtask', 'bug'];
  return valid.includes(type) ? (type as ExtractedTask['type']) : 'task';
}

function validatePriority(priority: string): ExtractedTask['priority'] {
  const valid = ['critical', 'high', 'medium', 'low'];
  return valid.includes(priority) ? (priority as ExtractedTask['priority']) : 'medium';
}

function validateFibonacci(points: number): number {
  const fib = [1, 2, 3, 5, 8, 13, 21, 34];
  if (fib.includes(points)) return points;
  return fib.reduce((prev, curr) =>
    Math.abs(curr - points) < Math.abs(prev - points) ? curr : prev
  );
}
