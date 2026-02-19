import { randomBytes, createHash } from 'node:crypto';

/**
 * OpenAI Codex OAuth 2.0 PKCE Flow
 * Allows users to sign in with their ChatGPT subscription (Plus/Pro)
 * and use their subscription quota for AI task extraction.
 *
 * Uses the same OAuth flow as Codex CLI - public client, PKCE, localhost callback.
 */

// OpenAI Codex public OAuth client
const OPENAI_CLIENT_ID = process.env.OPENAI_OAUTH_CLIENT_ID?.trim() || 'app_EMoamEEZ73f0CkXaXp7hrann';
const OPENAI_AUTH_URL = 'https://auth.openai.com/oauth/authorize';
const OPENAI_TOKEN_URL = 'https://auth.openai.com/oauth/token';
const OPENAI_SCOPES = 'openid profile email offline_access';

// Our callback - the API server handles it
const CALLBACK_PORT = 4000;
const CALLBACK_PATH = '/auth/openai/callback';
const CALLBACK_BASE_URL = process.env.OAUTH_CALLBACK_BASE_URL?.trim()
  || process.env.API_PUBLIC_URL?.trim()
  || process.env.NEXT_PUBLIC_API_URL?.trim();

export function getCallbackUrl(host?: string): string {
  const baseHost = host || CALLBACK_BASE_URL || `http://127.0.0.1:${CALLBACK_PORT}`;
  return `${baseHost}${CALLBACK_PATH}`;
}

/**
 * Generate PKCE code verifier and challenge
 */
export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const bytes = randomBytes(32);
  const codeVerifier = bytes.toString('base64url');

  const hash = createHash('sha256').update(codeVerifier).digest();
  const codeChallenge = hash.toString('base64url');

  return { codeVerifier, codeChallenge };
}

/**
 * Generate a random state parameter
 */
export function generateState(): string {
  return randomBytes(16).toString('base64url');
}

/**
 * Build the OpenAI OAuth authorization URL
 */
export function buildAuthorizationUrl(params: {
  codeChallenge: string;
  state: string;
  redirectUri: string;
}): string {
  const url = new URL(OPENAI_AUTH_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', OPENAI_CLIENT_ID);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', OPENAI_SCOPES);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', params.state);
  // Codex-specific flags
  url.searchParams.set('id_token_add_organizations', 'true');
  url.searchParams.set('codex_cli_simplified_flow', 'true');
  return url.toString();
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: OPENAI_CLIENT_ID,
    code_verifier: params.codeVerifier,
  });

  const response = await fetch(OPENAI_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<TokenResponse>;
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: OPENAI_CLIENT_ID,
  });

  const response = await fetch(OPENAI_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<TokenResponse>;
}

/**
 * Decode JWT payload (no verification - just for reading claims)
 */
export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) {
    throw new Error('Invalid JWT format');
  }
  const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
  return JSON.parse(payload) as Record<string, unknown>;
}

/**
 * Check if token is expired or about to expire (within 5 min)
 */
export function isTokenExpired(expiresAt: Date): boolean {
  const bufferMs = 5 * 60 * 1000; // 5 minutes
  return new Date().getTime() > expiresAt.getTime() - bufferMs;
}
