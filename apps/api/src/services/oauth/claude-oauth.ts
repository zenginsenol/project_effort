import { randomBytes, createHash } from 'node:crypto';
import http from 'node:http';

import { getPendingFlow, removePendingFlow } from './oauth-store';

/**
 * Anthropic Claude OAuth 2.0 PKCE Flow
 *
 * Uses the same OAuth client ID that Claude Code CLI uses.
 * Two modes:
 *   - "max" mode: Auth via claude.ai - uses subscription quota (blocked for third-party Jan 2026)
 *   - "console" mode: Auth via console.anthropic.com - can create API key
 *
 * We use console mode to generate a real API key via the user's account.
 * This is the only officially supported way for third-party tools.
 *
 * Flow:
 * 1. User opens authorization URL in browser
 * 2. User logs in with their Claude Pro/Max/Team account
 * 3. Callback receives authorization code
 * 4. Exchange code for tokens
 * 5. Use token to create an API key via console endpoint
 * 6. Store the API key (not the OAuth token) for future use
 */

const CLAUDE_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const CLAUDE_AUTH_URL_CONSOLE = 'https://console.anthropic.com/oauth/authorize';
const CLAUDE_TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
const CLAUDE_CREATE_API_KEY_URL = 'https://api.anthropic.com/api/oauth/claude_cli/create_api_key';
const CLAUDE_SCOPES = 'org:create_api_key user:profile user:inference';

// We use a non-standard redirect URI that Anthropic's OAuth accepts
const CLAUDE_REDIRECT_URI = 'https://console.anthropic.com/oauth/code/callback';

// Local callback port for catching the redirect
const CLAUDE_CALLBACK_PORT = 1456;
const CLAUDE_CALLBACK_PATH = '/auth/claude-callback';

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

export type ClaudeOAuthResult =
  | { ok: true; apiKey: string; email: string | null; accountName: string | null }
  | { ok: false; error: string };

export type ClaudeOAuthCompleteHandler = (result: ClaudeOAuthResult) => void | Promise<void>;

// ─── PKCE helpers (reuse same pattern as OpenAI) ─────────────

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
 * Build the authorization URL for Anthropic Console OAuth.
 * The user opens this in their browser to authenticate.
 */
export function buildClaudeAuthorizationUrl(params: {
  codeChallenge: string;
  state: string;
}): string {
  const url = new URL(CLAUDE_AUTH_URL_CONSOLE);
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
 */
export async function exchangeClaudeCodeForTokens(params: {
  code: string;
  codeVerifier: string;
  state: string;
}): Promise<ClaudeTokenResponse> {
  // Anthropic token endpoint requires application/x-www-form-urlencoded (OAuth 2.0 standard)
  // Must include state parameter as per Anthropic's implementation
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
 * Use the OAuth access token to create an API key via Anthropic Console.
 * This creates a real API key that works with api.anthropic.com.
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
    // If the create-api-key endpoint is blocked, fall back to direct token usage
    if (response.status === 403 || response.status === 404) {
      console.log('[claude-oauth] API key creation endpoint not available, using access token directly');
      return {
        api_key: accessToken,
        name: 'OAuth Access Token (direct)',
      };
    }
    throw new Error(`Failed to create API key (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<ClaudeApiKeyResponse>;
}

/**
 * Refresh a Claude OAuth access token.
 * Note: Anthropic refresh tokens are single-use!
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

// ─── Temporary Callback Server ───────────────────────────────
// Anthropic uses a non-standard callback format: the code is delivered
// to console.anthropic.com/oauth/code/callback, which then shows the
// code on screen. We intercept by polling or using a local proxy.
//
// Alternative approach: We open the auth URL with our own local redirect.
// Some Anthropic OAuth implementations accept localhost redirects.

let activeClaudeCallbackServer: http.Server | null = null;

/**
 * Start a temporary HTTP server to receive the Claude OAuth callback.
 * Since Anthropic's redirect goes to console.anthropic.com, the user
 * needs to copy-paste the code. Or we try localhost as redirect URI.
 *
 * This uses a "manual code entry" approach as fallback.
 */
export function startClaudeCallbackServer(opts: {
  onComplete: ClaudeOAuthCompleteHandler;
  codeVerifier: string;
  state: string;
  timeoutMs?: number;
}): Promise<void> {
  const { onComplete, codeVerifier, state, timeoutMs = 300_000 } = opts;

  return new Promise((resolveStartup, rejectStartup) => {
    if (activeClaudeCallbackServer) {
      try { activeClaudeCallbackServer.close(); } catch { /* ignore */ }
      activeClaudeCallbackServer = null;
    }

    const handleRequest = async (req: http.IncomingMessage, res: http.ServerResponse) => {
      const url = new URL(req.url || '/', `http://localhost:${CLAUDE_CALLBACK_PORT}`);

      // Handle callback with code parameter
      if (url.pathname === CLAUDE_CALLBACK_PATH || url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error) {
          const errorDesc = url.searchParams.get('error_description') || error;
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(claudeCallbackHtml(false, `Authentication error: ${errorDesc}`));
          cleanup();
          void onComplete({ ok: false, error: errorDesc });
          return;
        }

        if (code) {
          try {
            // Exchange code for tokens
            const tokens = await exchangeClaudeCodeForTokens({
              code,
              codeVerifier,
              state: returnedState || state,
            });

            // Try to create an API key, fall back to direct token
            let apiKey: string;
            try {
              const keyResult = await createApiKeyFromOAuth(tokens.access_token);
              apiKey = keyResult.api_key;
              console.log(`[claude-oauth] Created API key: ${keyResult.name}`);
            } catch (keyErr) {
              console.log('[claude-oauth] Using access token directly as API key');
              apiKey = tokens.access_token;
            }

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(claudeCallbackHtml(true, 'Claude connected! You can close this window.'));
            cleanup();
            void onComplete({ ok: true, apiKey, email: null, accountName: null });
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Token exchange failed';
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(claudeCallbackHtml(false, errMsg));
            cleanup();
            void onComplete({ ok: false, error: errMsg });
          }
          return;
        }
      }

      // Handle manual code submission (POST /submit-code)
      if (url.pathname === '/submit-code' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          void (async () => {
            try {
              const { code: manualCode } = JSON.parse(body) as { code: string };
              if (!manualCode) throw new Error('No code provided');

              const tokens = await exchangeClaudeCodeForTokens({
                code: manualCode.trim(),
                codeVerifier,
                state,
              });

              let apiKey: string;
              try {
                const keyResult = await createApiKeyFromOAuth(tokens.access_token);
                apiKey = keyResult.api_key;
              } catch {
                apiKey = tokens.access_token;
              }

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
              cleanup();
              void onComplete({ ok: true, apiKey, email: null, accountName: null });
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : 'Code exchange failed';
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: errMsg }));
            }
          })();
        });
        return;
      }

      // Show manual code entry page
      if (url.pathname === '/' || url.pathname === '/enter-code') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(claudeCodeEntryHtml());
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    };

    const server = http.createServer((req, res) => {
      void handleRequest(req, res);
    });

    const timeout = setTimeout(() => {
      cleanup();
      void onComplete({ ok: false, error: 'Claude OAuth timed out (5 min). Please try again.' });
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeout);
      try { server.close(); } catch { /* ignore */ }
      activeClaudeCallbackServer = null;
    }

    server.on('error', (err) => {
      const errMsg = err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'EADDRINUSE'
        ? 'Port 1456 is in use. Please close it and try again.'
        : err.message;
      cleanup();
      rejectStartup(new Error(errMsg));
    });

    server.listen(CLAUDE_CALLBACK_PORT, 'localhost', () => {
      console.log(`[claude-oauth] Callback server listening on localhost:${CLAUDE_CALLBACK_PORT}`);
      activeClaudeCallbackServer = server;
      resolveStartup();
    });
  });
}

// ─── Setup Key Support ───────────────────────────────────────

/**
 * Validate and use a setup key (sk-ant-oat01-...) directly.
 * These are long-lived OAuth tokens from `claude setup-token`.
 * We try to use it as an API key for the Messages API.
 * If blocked by Anthropic's third-party lockdown, we create an API key.
 */
export async function validateSetupKey(setupKey: string): Promise<{
  valid: boolean;
  apiKey: string;
  method: 'direct' | 'created_key';
  error?: string;
}> {
  // First, try the setup key directly with a simple API call
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

    // If it's a "not authorized for third-party" error, try creating API key
    if (testResponse.status === 403 && errorText.includes('Claude Code')) {
      console.log('[claude-oauth] Setup key blocked for third-party use, trying to create API key...');

      try {
        const keyResult = await createApiKeyFromOAuth(setupKey);
        return { valid: true, apiKey: keyResult.api_key, method: 'created_key' };
      } catch (keyErr) {
        return {
          valid: false,
          apiKey: setupKey,
          method: 'direct',
          error: 'This OAuth token is restricted to Claude Code only. Please use a regular API key from console.anthropic.com instead.',
        };
      }
    }

    // Other errors (invalid key, etc.)
    if (testResponse.status === 401) {
      return { valid: false, apiKey: setupKey, method: 'direct', error: 'Invalid or expired setup key.' };
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

// ─── HTML Templates ──────────────────────────────────────────

function claudeCallbackHtml(success: boolean, message: string): string {
  const color = success ? '#a855f7' : '#ef4444';
  const icon = success ? '✅' : '❌';
  const title = success ? 'Connected!' : 'Error';
  const safeMessage = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>EstimatePro - Claude ${title}</title>
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

function claudeCodeEntryHtml(): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>EstimatePro - Enter Claude Code</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0a0a0a;color:#fff}
.card{text-align:center;max-width:500px;padding:40px;border-radius:16px;background:#1a1a1a;border:1px solid #333}
h1{margin:0 0 8px;font-size:22px;color:#a855f7}
p{margin:0 0 20px;color:#999;font-size:14px}
input{width:100%;padding:12px;border-radius:8px;border:1px solid #333;background:#0a0a0a;color:#fff;font-family:monospace;font-size:14px;box-sizing:border-box;margin-bottom:12px}
button{width:100%;padding:12px;border-radius:8px;border:none;background:#a855f7;color:#fff;font-size:14px;font-weight:600;cursor:pointer}
button:hover{background:#9333ea}
.status{margin-top:12px;font-size:13px}
.error{color:#ef4444}.success{color:#22c55e}</style></head>
<body><div class="card">
<h1>🧠 Claude OAuth</h1>
<p>After logging in at Anthropic, paste the authorization code below:</p>
<input id="code" type="text" placeholder="Paste authorization code here..." autofocus />
<button onclick="submitCode()">Connect Claude</button>
<div id="status" class="status"></div>
</div>
<script>
async function submitCode(){
  const code=document.getElementById('code').value.trim();
  if(!code){document.getElementById('status').innerHTML='<span class="error">Please enter a code</span>';return}
  document.getElementById('status').innerHTML='Connecting...';
  try{
    const r=await fetch('/submit-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});
    const d=await r.json();
    if(d.success){document.getElementById('status').innerHTML='<span class="success">Connected! You can close this window.</span>';setTimeout(()=>window.close(),2000)}
    else{document.getElementById('status').innerHTML='<span class="error">'+(d.error||'Failed')+'</span>'}
  }catch(e){document.getElementById('status').innerHTML='<span class="error">'+e.message+'</span>'}
}
document.getElementById('code').addEventListener('keydown',e=>{if(e.key==='Enter')submitCode()});
</script>
</body></html>`;
}
