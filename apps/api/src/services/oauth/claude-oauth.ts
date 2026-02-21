import { randomBytes, createHash } from 'node:crypto';

/**
 * Anthropic Claude OAuth 2.0 PKCE Flow
 *
 * Uses the same OAuth client ID that Claude Code CLI uses.
 * Two modes:
 *   - "max" mode: Auth via claude.ai — uses Pro/Max subscription quota directly.
 *     Token used as Bearer, requires `anthropic-beta: oauth-2025-04-20` header.
 *   - "console" mode: Auth via console.anthropic.com — creates a permanent API key.
 *
 * Default: "max" mode (subscription login, like Claude Code / AutoClaude).
 *
 * Flow (Max mode):
 * 1. Build authorization URL → claude.ai/oauth/authorize
 * 2. User logs in with their Claude Pro/Max/Team account
 * 3. Anthropic redirects to console.anthropic.com/oauth/code/callback
 *    which shows the auth code on screen
 * 4. User pastes code back into our UI
 * 5. Exchange code for tokens (access_token + refresh_token)
 * 6. Store tokens — access_token used as Bearer for API calls
 * 7. Auto-refresh when token expires (8 hours)
 */

const CLAUDE_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const CLAUDE_AUTH_URL_MAX = 'https://claude.ai/oauth/authorize';
const CLAUDE_AUTH_URL_CONSOLE = 'https://console.anthropic.com/oauth/authorize';
const CLAUDE_TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
const CLAUDE_CREATE_API_KEY_URL = 'https://api.anthropic.com/api/oauth/claude_cli/create_api_key';
const CLAUDE_SCOPES = 'org:create_api_key user:profile user:inference';

// Anthropic's static callback that shows the code on screen
const CLAUDE_REDIRECT_URI = 'https://console.anthropic.com/oauth/code/callback';

/** Required beta header for OAuth-based API calls (Max mode) */
export const CLAUDE_OAUTH_BETA_HEADER = 'oauth-2025-04-20';

export type ClaudeOAuthMode = 'max' | 'console';

export interface ClaudeTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface ClaudeApiKeyResponse {
  api_key: string;
  name: string;
}

// ─── PKCE helpers ─────────────────────────────────────────────

export function generateClaudePKCE(): { codeVerifier: string; codeChallenge: string } {
  const bytes = randomBytes(32);
  const codeVerifier = bytes.toString('base64url');
  const hash = createHash('sha256').update(codeVerifier).digest();
  const codeChallenge = hash.toString('base64url');
  return { codeVerifier, codeChallenge };
}

export function generateClaudeState(): string {
  return randomBytes(16).toString('base64url');
}

/**
 * Build the authorization URL.
 *   - "max" mode  → claude.ai/oauth/authorize  (subscription login)
 *   - "console" mode → console.anthropic.com/oauth/authorize (API key creation)
 */
export function buildClaudeAuthorizationUrl(params: {
  codeChallenge: string;
  state: string;
  mode?: ClaudeOAuthMode;
}): string {
  const mode = params.mode ?? 'max';
  const baseUrl = mode === 'max' ? CLAUDE_AUTH_URL_MAX : CLAUDE_AUTH_URL_CONSOLE;

  const url = new URL(baseUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', CLAUDE_CLIENT_ID);
  url.searchParams.set('redirect_uri', CLAUDE_REDIRECT_URI);
  url.searchParams.set('scope', CLAUDE_SCOPES);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', params.state);
  return url.toString();
}

/**
 * Exchange authorization code for tokens.
 * Works the same for both max and console modes.
 */
export async function exchangeClaudeCodeForTokens(params: {
  code: string;
  codeVerifier: string;
  state: string;
}): Promise<ClaudeTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    state: params.state,
    client_id: CLAUDE_CLIENT_ID,
    code_verifier: params.codeVerifier,
    redirect_uri: CLAUDE_REDIRECT_URI,
  });

  console.log('[claude-oauth] Token exchange request:', {
    url: CLAUDE_TOKEN_URL,
    grant_type: 'authorization_code',
    client_id: CLAUDE_CLIENT_ID,
    redirect_uri: CLAUDE_REDIRECT_URI,
    code_length: params.code.length,
    verifier_length: params.codeVerifier.length,
    state: params.state,
  });

  const response = await fetch(CLAUDE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude token exchange failed (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<ClaudeTokenResponse>;
}

/**
 * Use the OAuth access token to create a permanent API key via Anthropic Console.
 * Used in "console" mode only.
 */
export async function createApiKeyFromOAuth(accessToken: string): Promise<ClaudeApiKeyResponse> {
  const response = await fetch(CLAUDE_CREATE_API_KEY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `EstimatePro (${new Date().toISOString().slice(0, 10)})`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.log(`[claude-oauth] Create API key failed (${response.status}):`, errorText);
    throw new Error(`Failed to create API key (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<ClaudeApiKeyResponse>;
}

/**
 * Refresh a Claude OAuth access token.
 * Note: Anthropic refresh tokens are single-use — each refresh returns
 * a new refresh_token that must be saved.
 */
export async function refreshClaudeAccessToken(refreshToken: string): Promise<ClaudeTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLAUDE_CLIENT_ID,
  });

  const response = await fetch(CLAUDE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude token refresh failed (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<ClaudeTokenResponse>;
}

// ─── Setup Key Support ───────────────────────────────────────

/**
 * Validate and use a setup key (sk-ant-oat01-...) directly.
 * These are long-lived OAuth tokens from `claude setup-token`.
 *
 * Strategy:
 * 1. Try using it directly as x-api-key (works for regular API keys)
 * 2. If invalid as API key, try to create a real API key via the OAuth endpoint
 * 3. If scope is insufficient, give a clear error message
 */
export async function validateSetupKey(setupKey: string): Promise<{
  valid: boolean;
  apiKey: string;
  method: 'direct' | 'created_key';
  error?: string;
}> {
  // Step 1: Try the key directly as a standard API key
  try {
    const testResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': setupKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });

    if (testResponse.ok) {
      return { valid: true, apiKey: setupKey, method: 'direct' };
    }

    const errorText = await testResponse.text();
    console.log(`[claude-oauth] Direct API key test failed (${testResponse.status}):`, errorText);

    // Step 2: If it's an OAuth token (sk-ant-oat*), try to create an API key
    if (setupKey.startsWith('sk-ant-oat')) {
      console.log('[claude-oauth] Token is an OAuth token, trying to create API key...');

      try {
        const keyResult = await createApiKeyFromOAuth(setupKey);
        return { valid: true, apiKey: keyResult.api_key, method: 'created_key' };
      } catch (keyErr) {
        const keyErrMsg = keyErr instanceof Error ? keyErr.message : '';
        console.log('[claude-oauth] Create API key failed:', keyErrMsg);

        // Check for specific scope error
        if (keyErrMsg.includes('scope') || keyErrMsg.includes('permission')) {
          return {
            valid: false,
            apiKey: setupKey,
            method: 'direct',
            error: 'This setup token does not have permission to create API keys. Please use "Sign in with Claude" instead, or create an API key at console.anthropic.com/settings/keys',
          };
        }

        // Check for Claude Code restriction
        if (keyErrMsg.includes('Claude Code') || (testResponse.status === 403 && errorText.includes('Claude Code'))) {
          return {
            valid: false,
            apiKey: setupKey,
            method: 'direct',
            error: 'This setup token is restricted to Claude Code only and cannot be used by third-party applications. Please create an API key at console.anthropic.com/settings/keys',
          };
        }

        return {
          valid: false,
          apiKey: setupKey,
          method: 'direct',
          error: 'This setup token cannot be used. Please create an API key at console.anthropic.com/settings/keys or use "Sign in with Claude".',
        };
      }
    }

    // Not an OAuth token — standard API key error handling
    if (testResponse.status === 401) {
      return { valid: false, apiKey: setupKey, method: 'direct', error: 'Invalid or expired API key.' };
    }

    return { valid: true, apiKey: setupKey, method: 'direct' };
  } catch (err) {
    return {
      valid: false,
      apiKey: setupKey,
      method: 'direct',
      error: err instanceof Error ? err.message : 'Failed to validate setup key',
    };
  }
}
