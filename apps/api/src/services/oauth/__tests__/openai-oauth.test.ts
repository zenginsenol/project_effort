import { describe, expect, it } from 'vitest';

import {
  buildAuthorizationUrl,
  decodeJwtPayload,
  getCallbackUrl,
  isTokenExpired,
  resolveOAuthMode,
} from '../openai-oauth';

const OAUTH_ENV_KEYS = [
  'OPENAI_OAUTH_MODE',
  'OAUTH_CALLBACK_BASE_URL',
  'API_PUBLIC_URL',
  'NEXT_PUBLIC_API_URL',
] as const;

type OAuthEnvKey = typeof OAUTH_ENV_KEYS[number];

function withOAuthEnv(
  values: Partial<Record<OAuthEnvKey, string>>,
  run: () => void,
): void {
  const previous = new Map<OAuthEnvKey, string | undefined>();
  for (const key of OAUTH_ENV_KEYS) {
    previous.set(key, process.env[key]);
  }

  for (const key of OAUTH_ENV_KEYS) {
    const next = values[key];
    if (next === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = next;
    }
  }

  try {
    run();
  } finally {
    for (const key of OAUTH_ENV_KEYS) {
      const prev = previous.get(key);
      if (prev === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = prev;
      }
    }
  }
}

describe('openai-oauth helpers', () => {
  it('builds authorization URL with required codex flags', () => {
    const redirectUri = 'http://localhost:1455/auth/callback';
    const url = buildAuthorizationUrl({
      codeChallenge: 'challenge123',
      state: 'state123',
      redirectUri,
    });

    const parsed = new URL(url);

    expect(parsed.origin).toBe('https://auth.openai.com');
    expect(parsed.pathname).toBe('/oauth/authorize');
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:1455/auth/callback');
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge123');
    expect(parsed.searchParams.get('state')).toBe('state123');
    expect(parsed.searchParams.get('id_token_add_organizations')).toBe('true');
    expect(parsed.searchParams.get('codex_cli_simplified_flow')).toBe('true');
  });

  it('returns codex callback URL on localhost:1455 in local mode', () => {
    const callbackUrl = getCallbackUrl('local_temp_server');
    expect(callbackUrl).toBe('http://localhost:1455/auth/callback');
  });

  it('defaults to local temp callback mode when env is not set', () => {
    withOAuthEnv({
      OPENAI_OAUTH_MODE: '',
      OAUTH_CALLBACK_BASE_URL: '',
      API_PUBLIC_URL: '',
      NEXT_PUBLIC_API_URL: '',
    }, () => {
      expect(resolveOAuthMode()).toBe('local_temp_server');
      expect(getCallbackUrl()).toBe('http://localhost:1455/auth/callback');
    });
  });

  it('resolves API callback mode from env and builds API callback URL', () => {
    withOAuthEnv({
      OPENAI_OAUTH_MODE: 'api_server_callback',
      OAUTH_CALLBACK_BASE_URL: 'https://api.example.com',
      API_PUBLIC_URL: '',
      NEXT_PUBLIC_API_URL: '',
    }, () => {
      expect(resolveOAuthMode()).toBe('api_server_callback');
      expect(getCallbackUrl()).toBe('https://api.example.com/auth/openai/callback');
    });
  });

  it('uses API_PUBLIC_URL when explicit callback base is not set', () => {
    withOAuthEnv({
      OPENAI_OAUTH_MODE: 'api_server_callback',
      OAUTH_CALLBACK_BASE_URL: '',
      API_PUBLIC_URL: 'https://api.internal.example.com/',
      NEXT_PUBLIC_API_URL: '',
    }, () => {
      expect(getCallbackUrl()).toBe('https://api.internal.example.com/auth/openai/callback');
    });
  });

  it('uses NEXT_PUBLIC_API_URL when API_PUBLIC_URL is not set', () => {
    withOAuthEnv({
      OPENAI_OAUTH_MODE: 'api_server_callback',
      OAUTH_CALLBACK_BASE_URL: '',
      API_PUBLIC_URL: '',
      NEXT_PUBLIC_API_URL: 'https://public-api.example.com',
    }, () => {
      expect(getCallbackUrl()).toBe('https://public-api.example.com/auth/openai/callback');
    });
  });

  it('falls back to local API default origin for api callback mode', () => {
    withOAuthEnv({
      OPENAI_OAUTH_MODE: 'api_server_callback',
      OAUTH_CALLBACK_BASE_URL: '',
      API_PUBLIC_URL: '',
      NEXT_PUBLIC_API_URL: '',
    }, () => {
      expect(getCallbackUrl()).toBe('http://127.0.0.1:4000/auth/openai/callback');
    });
  });

  it('decodes jwt payload and rejects malformed jwt', () => {
    const payload = Buffer.from(JSON.stringify({ email: 'user@example.com' })).toString('base64url');
    const token = `header.${payload}.signature`;

    expect(decodeJwtPayload(token)).toMatchObject({ email: 'user@example.com' });
    expect(() => decodeJwtPayload('not-a-jwt')).toThrow('Invalid JWT format');
  });

  it('treats tokens expiring in under 5 minutes as expired', () => {
    const nearExpiry = new Date(Date.now() + 4 * 60 * 1000);
    const safeExpiry = new Date(Date.now() + 10 * 60 * 1000);

    expect(isTokenExpired(nearExpiry)).toBe(true);
    expect(isTokenExpired(safeExpiry)).toBe(false);
  });
});
