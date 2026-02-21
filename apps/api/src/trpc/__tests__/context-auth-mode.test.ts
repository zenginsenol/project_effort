import { describe, expect, it } from 'vitest';

import { isDemoModeEnabled, validateAuthRuntimeConfig } from '../context';

describe('context auth runtime guard', () => {
  it('enables demo mode in non-production when Clerk key is missing', () => {
    expect(isDemoModeEnabled({
      NODE_ENV: 'development',
      CLERK_SECRET_KEY: '',
    })).toBe(true);
  });

  it('disables demo mode in production even when key is missing', () => {
    expect(isDemoModeEnabled({
      NODE_ENV: 'production',
      CLERK_SECRET_KEY: '',
    })).toBe(false);
  });

  it('throws on production when Clerk key is invalid', () => {
    expect(() => validateAuthRuntimeConfig({
      NODE_ENV: 'production',
      CLERK_SECRET_KEY: 'sk_test_xxxxx',
    })).toThrow('CLERK_SECRET_KEY must be configured');
  });

  it('does not throw on production when Clerk key is valid', () => {
    expect(() => validateAuthRuntimeConfig({
      NODE_ENV: 'production',
      CLERK_SECRET_KEY: 'sk_live_valid_example',
    })).not.toThrow();
  });
});
