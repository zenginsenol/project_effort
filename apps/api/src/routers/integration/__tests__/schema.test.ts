import { describe, expect, it } from 'vitest';

import { linkGithubProjectInput } from '../schema';

const BASE_PAYLOAD = {
  projectId: '11111111-1111-4111-8111-111111111111',
  integrationId: '22222222-2222-4222-8222-222222222222',
};

describe('integration schema - linkGithubProjectInput', () => {
  it('accepts owner/repo format', () => {
    const result = linkGithubProjectInput.safeParse({
      ...BASE_PAYLOAD,
      repository: 'acme/platform',
      autoSync: true,
    });

    expect(result.success).toBe(true);
  });

  it('accepts GitHub domain and URL formats', () => {
    const domainResult = linkGithubProjectInput.safeParse({
      ...BASE_PAYLOAD,
      repository: 'github.com/acme/platform',
      autoSync: true,
    });

    const urlResult = linkGithubProjectInput.safeParse({
      ...BASE_PAYLOAD,
      repository: 'https://github.com/acme/platform.git',
      autoSync: false,
    });

    expect(domainResult.success).toBe(true);
    expect(urlResult.success).toBe(true);
  });

  it('rejects non-GitHub and malformed repository inputs', () => {
    const malformed = linkGithubProjectInput.safeParse({
      ...BASE_PAYLOAD,
      repository: 'invalid-repo',
      autoSync: true,
    });

    const nonGithub = linkGithubProjectInput.safeParse({
      ...BASE_PAYLOAD,
      repository: 'https://gitlab.com/acme/platform',
      autoSync: true,
    });

    const extraPath = linkGithubProjectInput.safeParse({
      ...BASE_PAYLOAD,
      repository: 'https://github.com/acme/platform/issues',
      autoSync: true,
    });

    expect(malformed.success).toBe(false);
    expect(nonGithub.success).toBe(false);
    expect(extraPath.success).toBe(false);
  });
});
