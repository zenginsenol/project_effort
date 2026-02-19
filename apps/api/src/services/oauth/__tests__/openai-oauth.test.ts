import { describe, expect, it } from 'vitest';

import {
  buildAuthorizationUrl,
  decodeJwtPayload,
  getCallbackUrl,
  isTokenExpired,
} from '../openai-oauth';

describe('openai-oauth helpers', () => {
  it('builds authorization URL with required codex flags', () => {
    const url = buildAuthorizationUrl({
      codeChallenge: 'challenge123',
      state: 'state123',
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

  it('returns codex callback URL on localhost:1455', () => {
    const callbackUrl = getCallbackUrl();
    expect(callbackUrl).toBe('http://localhost:1455/auth/callback');
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
