import { describe, expect, it } from 'vitest';

import {
  buildAuthorizationUrl,
  decodeJwtPayload,
  getCallbackUrl,
  isTokenExpired,
  resolveOAuthMode,
} from '../openai-oauth';

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

  it('defaults to API callback mode and local API origin when env is not set', () => {
    const previousMode = process.env.OPENAI_OAUTH_MODE;
    const previousBase = process.env.OAUTH_CALLBACK_BASE_URL;
    const previousApiPublic = process.env.API_PUBLIC_URL;
    const previousNextApi = process.env.NEXT_PUBLIC_API_URL;

    process.env.OPENAI_OAUTH_MODE = '';
    process.env.OAUTH_CALLBACK_BASE_URL = '';
    process.env.API_PUBLIC_URL = '';
    process.env.NEXT_PUBLIC_API_URL = '';

    expect(resolveOAuthMode()).toBe('api_server_callback');
    expect(getCallbackUrl()).toBe('http://127.0.0.1:4000/auth/openai/callback');

    process.env.OPENAI_OAUTH_MODE = previousMode;
    process.env.OAUTH_CALLBACK_BASE_URL = previousBase;
    process.env.API_PUBLIC_URL = previousApiPublic;
    process.env.NEXT_PUBLIC_API_URL = previousNextApi;
  });

  it('resolves API callback mode from env and builds API callback URL', () => {
    const previousMode = process.env.OPENAI_OAUTH_MODE;
    const previousBase = process.env.OAUTH_CALLBACK_BASE_URL;

    process.env.OPENAI_OAUTH_MODE = 'api_server_callback';
    process.env.OAUTH_CALLBACK_BASE_URL = 'https://api.example.com';

    expect(resolveOAuthMode()).toBe('api_server_callback');
    expect(getCallbackUrl()).toBe('https://api.example.com/auth/openai/callback');

    process.env.OPENAI_OAUTH_MODE = previousMode;
    process.env.OAUTH_CALLBACK_BASE_URL = previousBase;
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
