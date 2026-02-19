import { randomBytes, createHash } from 'node:crypto';
import http from 'node:http';

import { getPendingFlow, removePendingFlow } from './oauth-store';

/**
 * OpenAI Codex OAuth 2.0 PKCE Flow
 *
 * Supports dual callback strategies:
 * - local temp callback server on localhost:1455/auth/callback
 * - API server callback route /auth/openai/callback (for deployed environments)
 */

const OPENAI_CLIENT_ID = process.env.OPENAI_OAUTH_CLIENT_ID?.trim() || 'app_EMoamEEZ73f0CkXaXp7hrann';
const OPENAI_AUTH_URL = 'https://auth.openai.com/oauth/authorize';
const OPENAI_TOKEN_URL = 'https://auth.openai.com/oauth/token';
const OPENAI_SCOPES = 'openid profile email offline_access';

// Must match what OpenAI expects - localhost:1455
const CODEX_CALLBACK_PORT = 1455;
const CODEX_CALLBACK_PATH = '/auth/callback';
const CODEX_REDIRECT_URI = `http://localhost:${CODEX_CALLBACK_PORT}${CODEX_CALLBACK_PATH}`;
const API_CALLBACK_PATH = '/auth/openai/callback';
const API_CALLBACK_DEFAULT_ORIGIN = 'http://127.0.0.1:4000';

export type OpenAIOAuthMode = 'local_temp_server' | 'api_server_callback';

function readCallbackBaseUrl(): string | null {
  const base = process.env.OAUTH_CALLBACK_BASE_URL?.trim()
    || process.env.API_PUBLIC_URL?.trim()
    || process.env.NEXT_PUBLIC_API_URL?.trim()
    || null;
  return base && base.length > 0 ? base : null;
}

export function resolveOAuthMode(): OpenAIOAuthMode {
  const configured = process.env.OPENAI_OAUTH_MODE?.trim();
  if (configured === 'local_temp_server' || configured === 'api_server_callback') {
    return configured;
  }

  // Backward-compatible default: keep API callback flow unless explicitly set.
  return 'api_server_callback';
}

export function getCallbackUrl(mode: OpenAIOAuthMode = resolveOAuthMode()): string {
  if (mode === 'local_temp_server') {
    return CODEX_REDIRECT_URI;
  }

  const baseUrl = readCallbackBaseUrl() || API_CALLBACK_DEFAULT_ORIGIN;

  return `${baseUrl.replace(/\/+$/, '')}${API_CALLBACK_PATH}`;
}

export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const bytes = randomBytes(32);
  const codeVerifier = bytes.toString('base64url');
  const hash = createHash('sha256').update(codeVerifier).digest();
  const codeChallenge = hash.toString('base64url');
  return { codeVerifier, codeChallenge };
}

export function generateState(): string {
  return randomBytes(16).toString('base64url');
}

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

export async function exchangeCodeForTokens(params: {
  code: string;
  codeVerifier: string;
  redirectUri?: string;
}): Promise<TokenResponse> {
  const redirectUri = params.redirectUri ?? getCallbackUrl('api_server_callback');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: redirectUri,
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

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) {
    throw new Error('Invalid JWT format');
  }
  const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
  return JSON.parse(payload) as Record<string, unknown>;
}

export function isTokenExpired(expiresAt: Date): boolean {
  const bufferMs = 5 * 60 * 1000;
  return new Date().getTime() > expiresAt.getTime() - bufferMs;
}

// ─── Temporary Callback Server ────────────────────────────────
// Spins up a one-shot HTTP server on port 1455 to catch OpenAI's redirect,
// then exchanges the code for tokens and shuts down.

export type OAuthResult =
  | { ok: true; tokens: TokenResponse; userId: string }
  | { ok: false; error: string };

export type OAuthCompleteHandler = (result: OAuthResult) => void | Promise<void>;

let activeCallbackServer: http.Server | null = null;

/**
 * Start a temporary HTTP server on localhost:1455 to receive the OAuth callback.
 * Calls `onComplete` with the result (tokens or error) when the callback arrives.
 * Throws if the port is already in use.
 */
export function startCallbackServer(opts: {
  onComplete: OAuthCompleteHandler;
  timeoutMs?: number;
}): Promise<void> {
  const { onComplete, timeoutMs = 120_000 } = opts;

  return new Promise((resolveStartup, rejectStartup) => {
    // Kill any previous server
    if (activeCallbackServer) {
      try { activeCallbackServer.close(); } catch { /* ignore */ }
      activeCallbackServer = null;
    }

    const handleRequest = async (req: http.IncomingMessage, res: http.ServerResponse) => {
      const url = new URL(req.url || '/', `http://localhost:${CODEX_CALLBACK_PORT}`);

      if (url.pathname !== CODEX_CALLBACK_PATH) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        const errorDesc = url.searchParams.get('error_description') || error;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(callbackHtml(false, `Authentication error: ${errorDesc}`));
        cleanup();
        void onComplete({ ok: false, error: errorDesc });
        return;
      }

      if (!code || !state) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(callbackHtml(false, 'Missing code or state'));
        cleanup();
        void onComplete({ ok: false, error: 'Missing code or state' });
        return;
      }

      const pendingFlow = getPendingFlow(state);
      if (!pendingFlow) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(callbackHtml(false, 'Invalid or expired state. Please try again.'));
        cleanup();
        void onComplete({ ok: false, error: 'Invalid or expired state' });
        return;
      }

      try {
        const tokens = await exchangeCodeForTokens({
          code,
          codeVerifier: pendingFlow.codeVerifier,
          redirectUri: pendingFlow.redirectUri,
        });

        removePendingFlow(state);

        // Call onComplete BEFORE sending response so DB write completes
        try {
          await onComplete({ ok: true, tokens, userId: pendingFlow.userId });
        } catch (dbErr) {
          console.error('[oauth] onComplete handler failed:', dbErr);
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(callbackHtml(true, 'OpenAI connected! You can close this window.'));
        cleanup();
      } catch (err) {
        removePendingFlow(state);
        const errMsg = err instanceof Error ? err.message : 'Token exchange failed';
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(callbackHtml(false, errMsg));
        cleanup();
        void onComplete({ ok: false, error: errMsg });
      }
    };

    const server = http.createServer((req, res) => {
      void handleRequest(req, res);
    });

    const timeout = setTimeout(() => {
      cleanup();
      void onComplete({ ok: false, error: 'OAuth timed out. Please try again.' });
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeout);
      try {
        server.close();
      } catch { /* ignore */ }
      activeCallbackServer = null;
    }

    server.on('error', (err) => {
      const errMsg = err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'EADDRINUSE'
        ? 'Port 1455 is in use (maybe Codex CLI is running). Please close it and try again.'
        : err.message;
      cleanup();
      rejectStartup(new Error(errMsg));
    });

    server.listen(CODEX_CALLBACK_PORT, 'localhost', () => {
      console.log(`[oauth] Temporary callback server listening on localhost:${CODEX_CALLBACK_PORT}`);
      activeCallbackServer = server;
      resolveStartup();
    });
  });
}

function callbackHtml(success: boolean, message: string): string {
  const color = success ? '#22c55e' : '#ef4444';
  const icon = success ? '✅' : '❌';
  const title = success ? 'Connected!' : 'Error';
  const safeMessage = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>EstimatePro - ${title}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0a0a0a;color:#fff}
.card{text-align:center;max-width:400px;padding:40px;border-radius:16px;background:#1a1a1a;border:1px solid #333}
.icon{font-size:48px;margin-bottom:12px}h1{margin:0 0 8px;font-size:22px;color:${color}}
p{margin:0;color:#999;font-size:14px;line-height:1.5}
.note{margin-top:16px;font-size:12px;color:#666}</style></head>
<body><div class="card">
<div class="icon">${icon}</div>
<h1>${title}</h1>
<p>${safeMessage}</p>
<p class="note">${success ? 'Return to EstimatePro settings page.' : 'Please try again from the settings page.'}</p>
</div>
<script>${success ? 'setTimeout(()=>window.close(),3000)' : ''}</script>
</body></html>`;
}
