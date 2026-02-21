import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { apiKeys, users } from '@estimate-pro/db/schema';

import { authedProcedure, orgProcedure, router } from '../../trpc/trpc';
import { extractTasksFromText, extractWithMultipleProviders } from '../../services/document/task-extractor';
import type {
  AIProviderConfig,
  AIProvider,
  ReasoningEffort,
  ExtractionResult,
} from '../../services/document/task-extractor';
import { encrypt, decrypt } from '../../services/crypto';
import { refreshAccessToken, isTokenExpired } from '../../services/oauth/openai-oauth';
import { refreshClaudeAccessToken, CLAUDE_OAUTH_BETA_HEADER } from '../../services/oauth/claude-oauth';

import { analyzeTextInput, comparativeAnalyzeInput, bulkCreateTasksInput } from './schema';
import { documentService } from './service';

const ANTHROPIC_OAUTH_BETA_HEADER = CLAUDE_OAUTH_BETA_HEADER;

export type ComparativeAnalyzeStatus = 'success' | 'partial_success' | 'failed';
export type ComparativeAnalyzeErrorCode = 'missing_config' | 'provider_error' | 'internal_error';

export interface ComparativeAnalyzeError {
  provider: string;
  model: string;
  error: string;
  code: ComparativeAnalyzeErrorCode;
}

export interface ComparativeAnalyzeSummary {
  requestedProviders: number;
  resolvedProviders: number;
  successfulProviders: number;
  failedProviders: number;
  missingConfigProviders: number;
  message: string;
}

export interface ComparativeAnalyzeResponse {
  status: ComparativeAnalyzeStatus;
  results: ExtractionResult[];
  errors: ComparativeAnalyzeError[];
  summary: ComparativeAnalyzeSummary;
}

function buildSummaryMessage(
  status: ComparativeAnalyzeStatus,
  summary: Omit<ComparativeAnalyzeSummary, 'message'>,
): string {
  if (status === 'success') {
    return `Comparative analysis completed successfully for ${summary.successfulProviders}/${summary.requestedProviders} providers.`;
  }
  if (status === 'partial_success') {
    return `Comparative analysis completed with partial success: ${summary.successfulProviders} succeeded, ${summary.failedProviders} failed, ${summary.missingConfigProviders} missing configuration.`;
  }
  return `Comparative analysis failed: no provider succeeded. ${summary.failedProviders} failed, ${summary.missingConfigProviders} missing configuration.`;
}

export function buildComparativeAnalyzeResponse(params: {
  requestedProviders: number;
  resolvedProviders: number;
  results: ExtractionResult[];
  errors: ComparativeAnalyzeError[];
}): ComparativeAnalyzeResponse {
  const errors = [...params.errors].sort((a, b) => {
    const providerCmp = a.provider.localeCompare(b.provider, 'en');
    if (providerCmp !== 0) return providerCmp;
    const modelCmp = a.model.localeCompare(b.model, 'en');
    if (modelCmp !== 0) return modelCmp;
    return a.code.localeCompare(b.code, 'en');
  });

  const successfulProviders = params.results.length;
  const missingConfigProviders = errors.filter((error) => error.code === 'missing_config').length;
  const failedProviders = errors.length - missingConfigProviders;

  const status: ComparativeAnalyzeStatus = successfulProviders === 0
    ? 'failed'
    : errors.length === 0
      ? 'success'
      : 'partial_success';

  const summaryBase = {
    requestedProviders: params.requestedProviders,
    resolvedProviders: params.resolvedProviders,
    successfulProviders,
    failedProviders,
    missingConfigProviders,
  };

  return {
    status,
    results: params.results,
    errors,
    summary: {
      ...summaryBase,
      message: buildSummaryMessage(status, summaryBase),
    },
  };
}

/**
 * Look up the user's active AI config - supports both API key and OAuth token.
 * Can optionally target a specific provider.
 */
async function getUserAIConfig(
  clerkId: string,
  targetProvider?: AIProvider,
  overrideModel?: string,
  overrideEffort?: ReasoningEffort | null,
): Promise<AIProviderConfig | null> {
  const user = await db.query.users.findFirst({
    columns: { id: true },
    where: eq(users.clerkId, clerkId),
  });

  if (!user) return null;

  // Build query conditions
  const conditions = [eq(apiKeys.userId, user.id), eq(apiKeys.isActive, true)];
  if (targetProvider) {
    conditions.push(eq(apiKeys.provider, targetProvider));
  }

  const key = await db.query.apiKeys.findFirst({
    where: and(...conditions),
    orderBy: (table, { desc: descFn }) => [descFn(table.updatedAt)],
  });
  if (!key) return null;

  // Defensive guard: never allow provider override mismatches even if the query layer
  // returns an unexpected row.
  if (targetProvider && key.provider !== targetProvider) {
    console.warn(
      `[document-router] Provider mismatch detected for user ${clerkId}: requested=${targetProvider}, returned=${key.provider}`,
    );
    return null;
  }

  try {
    // OAuth flow - use access token (with auto-refresh)
    if (key.authMethod === 'oauth' && key.encryptedAccessToken) {
      let accessToken = decrypt(key.encryptedAccessToken);
      const isAnthropicOAuth = key.provider === 'anthropic';

      // Auto-refresh if token is expired or about to expire
      if (key.tokenExpiresAt && isTokenExpired(key.tokenExpiresAt) && key.encryptedRefreshToken) {
        console.log('[document-router] OAuth token expired, refreshing...');
        try {
          const refreshToken = decrypt(key.encryptedRefreshToken);
          const tokens = isAnthropicOAuth
            ? await refreshClaudeAccessToken(refreshToken)
            : await refreshAccessToken(refreshToken);

          const nextRefreshToken = 'refresh_token' in tokens && tokens.refresh_token
            ? tokens.refresh_token
            : refreshToken;

          await db.update(apiKeys).set({
            encryptedAccessToken: encrypt(tokens.access_token),
            encryptedRefreshToken: encrypt(nextRefreshToken),
            tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          }).where(eq(apiKeys.id, key.id));

          accessToken = tokens.access_token;
          console.log('[document-router] OAuth token refreshed successfully');
        } catch (refreshErr) {
          console.error('[document-router] Token refresh failed:', refreshErr);
          await db.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.id, key.id));
          return null;
        }
      }

      // For OpenAI OAuth (ChatGPT subscription), extract account ID from JWT
      let chatgptAccountId: string | null = null;
      if (!isAnthropicOAuth) {
        try {
          const parts = accessToken.split('.');
          if (parts.length === 3 && parts[1]) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
            chatgptAccountId = payload.chatgpt_account_id
              ?? payload.account_id
              ?? payload['https://api.openai.com/auth']?.account_id
              ?? null;
          }
        } catch {
          // Ignore JWT decode failures
        }
      }

      return {
        provider: key.provider as AIProvider,
        apiKey: accessToken,
        model: overrideModel ?? key.model ?? undefined,
        reasoningEffort: overrideEffort !== undefined ? overrideEffort : (key.reasoningEffort as ReasoningEffort) ?? undefined,
        authMethod: 'oauth',
        oauthBetaHeader: isAnthropicOAuth ? ANTHROPIC_OAUTH_BETA_HEADER : undefined,
        chatgptAccountId: !isAnthropicOAuth ? chatgptAccountId : undefined,
      };
    }

    // API key flow
    if (key.encryptedKey) {
      return {
        provider: key.provider as AIProvider,
        apiKey: decrypt(key.encryptedKey),
        model: overrideModel ?? key.model ?? undefined,
        reasoningEffort: overrideEffort !== undefined ? overrideEffort : (key.reasoningEffort as ReasoningEffort) ?? undefined,
      };
    }

    return null;
  } catch {
    console.error('[document-router] Failed to decrypt credentials');
    return null;
  }
}

export const documentRouter = router({
  /**
   * Analyze pasted text (PRD, requirements, etc.) and extract tasks via AI.
   * Supports provider/model override per-request.
   */
  analyzeText: authedProcedure
    .input(analyzeTextInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const aiConfig = await getUserAIConfig(
          ctx.userId,
          input.provider,
          input.model,
          input.reasoningEffort,
        );

        const result = await extractTasksFromText(
          input.text,
          input.projectContext,
          input.hourlyRate,
          aiConfig,
        );
        return result;
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Failed to analyze document',
        });
      }
    }),

  /**
   * Run comparative analysis across multiple providers.
   * Each provider runs independently - failures in one don't block others.
   */
  comparativeAnalyze: authedProcedure
    .input(comparativeAnalyzeInput)
    .mutation(async ({ ctx, input }) => {
      try {
        // Resolve configs for each requested provider
        const configs: AIProviderConfig[] = [];
        const configErrors: ComparativeAnalyzeError[] = [];

        for (const p of input.providers) {
          const config = await getUserAIConfig(
            ctx.userId,
            p.provider,
            p.model ?? undefined,
            p.reasoningEffort,
          );
          if (config) {
            configs.push(config);
          } else {
            configErrors.push({
              provider: p.provider,
              model: p.model ?? 'default',
              error: `No active API key found for ${p.provider}. Please add a key in Settings.`,
              code: 'missing_config',
            });
          }
        }

        const extraction = configs.length > 0
          ? await extractWithMultipleProviders(
            input.text,
            input.projectContext,
            input.hourlyRate,
            configs,
          )
          : { results: [], errors: [] };

        const providerErrors: ComparativeAnalyzeError[] = extraction.errors.map((error) => ({
          ...error,
          code: 'provider_error',
        }));

        return buildComparativeAnalyzeResponse({
          requestedProviders: input.providers.length,
          resolvedProviders: configs.length,
          results: extraction.results,
          errors: [...configErrors, ...providerErrors],
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to run comparative analysis';
        return buildComparativeAnalyzeResponse({
          requestedProviders: input.providers.length,
          resolvedProviders: 0,
          results: [],
          errors: [{
            provider: 'system',
            model: 'n/a',
            error: message,
            code: 'internal_error',
          }],
        });
      }
    }),

  /**
   * Bulk create tasks in a project (used after AI extraction or manual entry)
   */
  bulkCreateTasks: orgProcedure
    .input(bulkCreateTasksInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const created = await documentService.bulkCreateTasks(input.projectId, input.tasks, ctx.orgId);
        return {
          created: created.length,
          tasks: created,
        };
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Failed to create tasks',
        });
      }
    }),
});
