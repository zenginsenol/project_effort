import { afterEach, describe, expect, it, vi } from 'vitest';

import { GitHubIntegration } from '../github';

const integration = new GitHubIntegration();

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchWithJson(data: unknown) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
}

describe('GitHubIntegration.importItems', () => {
  it('accepts full GitHub URL and normalizes repository context', async () => {
    const fetchSpy = mockFetchWithJson([]);

    await integration.importItems('token', 'https://github.com/acme/platform.git');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://api.github.com/repos/acme/platform/issues?state=all&per_page=50');
  });

  it('filters pull requests and maps type/priority/points from labels', async () => {
    mockFetchWithJson([
      {
        id: 1,
        number: 101,
        title: 'Feature task',
        body: 'Build feature',
        state: 'open',
        labels: [{ name: 'Feature' }, { name: 'P1' }, { name: 'sp:8' }],
      },
      {
        id: 2,
        number: 102,
        title: 'Critical bug',
        body: 'Fix asap',
        state: 'closed',
        labels: [{ name: 'bug' }, { name: 'priority-0' }, { name: 'estimate:3' }],
      },
      {
        id: 3,
        number: 103,
        title: 'PR shadow',
        body: null,
        state: 'open',
        labels: [],
        pull_request: {},
      },
    ]);

    const items = await integration.importItems('token', 'acme/platform');

    expect(items).toHaveLength(2);

    expect(items[0]).toMatchObject({
      externalId: 'acme/platform#101',
      type: 'feature',
      status: 'todo',
      priority: 'high',
      estimatedPoints: 8,
    });

    expect(items[1]).toMatchObject({
      externalId: 'acme/platform#102',
      type: 'bug',
      status: 'done',
      priority: 'critical',
      estimatedPoints: 3,
    });
  });

  it('rejects invalid repository format', async () => {
    const fetchSpy = mockFetchWithJson([]);

    await expect(integration.importItems('token', 'invalid-repo')).rejects.toThrow(
      'GitHub repository context must be owner/repo',
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
