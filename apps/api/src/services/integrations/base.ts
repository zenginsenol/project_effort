export interface IntegrationConfig {
  clientId: string;
  clientSecret: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

export interface ImportedItem {
  externalId: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string | null;
  estimatedPoints: number | null;
}

export class IntegrationHttpError extends Error {
  readonly status: number;
  readonly responseBody: string;

  constructor(status: number, message: string, responseBody: string) {
    super(message);
    this.name = 'IntegrationHttpError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeRetryDelay(
  attempt: number,
  retryAfterHeader: string | null,
  baseDelayMs: number,
): number {
  const retryAfterSeconds = Number(retryAfterHeader);
  if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }
  return baseDelayMs * (attempt + 1);
}

export async function fetchJsonWithRetry<T>(
  url: string,
  init: RequestInit,
  options?: {
    retries?: number;
    retryStatuses?: number[];
    baseDelayMs?: number;
  },
): Promise<T> {
  const retries = options?.retries ?? 2;
  const retryStatuses = options?.retryStatuses ?? [429, 500, 502, 503, 504];
  const baseDelayMs = options?.baseDelayMs ?? 300;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, init);
      const body = await response.text();

      if (!response.ok) {
        if (attempt < retries && retryStatuses.includes(response.status)) {
          const delay = computeRetryDelay(attempt, response.headers.get('retry-after'), baseDelayMs);
          await sleep(delay);
          continue;
        }
        throw new IntegrationHttpError(
          response.status,
          `Integration request failed with status ${response.status}`,
          body,
        );
      }

      if (!body.trim()) {
        return {} as T;
      }

      return JSON.parse(body) as T;
    } catch (error) {
      lastError = error;
      if (error instanceof IntegrationHttpError) {
        throw error;
      }
      if (attempt < retries) {
        await sleep(baseDelayMs * (attempt + 1));
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Integration request failed');
}

export abstract class BaseIntegration {
  abstract readonly type: 'jira' | 'azure_devops' | 'github' | 'gitlab';

  abstract getAuthUrl(redirectUri: string, state: string): string;

  abstract exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;

  abstract refreshTokens(refreshToken: string): Promise<OAuthTokens>;

  abstract importItems(accessToken: string, externalProjectId: string): Promise<ImportedItem[]>;

  abstract exportEstimate(
    accessToken: string,
    externalItemId: string,
    estimate: { points: number; hours: number },
  ): Promise<boolean>;

  abstract verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
}
