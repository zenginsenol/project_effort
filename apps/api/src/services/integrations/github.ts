import { createHmac, timingSafeEqual } from 'node:crypto';

import { BaseIntegration, fetchJsonWithRetry, IntegrationHttpError } from './base';

import type { ImportedItem, OAuthTokens } from './base';

type GitHubTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GitHubIssue = {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: Array<{ name: string }>;
  pull_request?: unknown;
};

export class GitHubIntegration extends BaseIntegration {
  readonly type = 'github' as const;

  private getClientId(): string {
    const clientId = process.env.GITHUB_CLIENT_ID?.trim();
    if (!clientId) {
      throw new Error('GITHUB_CLIENT_ID is required');
    }
    return clientId;
  }

  private getOAuthCredentials(): { clientId: string; clientSecret: string } {
    const clientId = this.getClientId();
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
    if (!clientSecret) {
      throw new Error('GITHUB_CLIENT_SECRET is required');
    }
    return { clientId, clientSecret };
  }

  private parseRepositoryContext(value: string): { owner: string; repo: string } {
    const trimmed = value.trim();
    const segments = trimmed.split('/');
    if (segments.length !== 2 || !segments[0] || !segments[1]) {
      throw new Error('GitHub repository context must be owner/repo');
    }
    return { owner: segments[0], repo: segments[1] };
  }

  private parseIssueContext(value: string): { owner: string; repo: string; issueNumber: number } {
    const [repoContext, issuePart] = value.split('#');
    if (!repoContext || !issuePart) {
      throw new Error('GitHub issue context must be owner/repo#issue_number');
    }

    const { owner, repo } = this.parseRepositoryContext(repoContext);
    const issueNumber = Number(issuePart);
    if (!Number.isInteger(issueNumber) || issueNumber < 1) {
      throw new Error('Invalid GitHub issue number');
    }

    return { owner, repo, issueNumber };
  }

  getAuthUrl(redirectUri: string, state: string): string {
    const clientId = this.getClientId();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'repo read:org',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const { clientId, clientSecret } = this.getOAuthCredentials();
    const data = await fetchJsonWithRetry<GitHubTokenResponse>(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      },
      { retries: 1 },
    );

    if (!data.access_token) {
      throw new Error(data.error_description ?? data.error ?? 'GitHub did not return an access token');
    }

    return {
      accessToken: data.access_token,
      refreshToken: null,
      expiresAt: null,
    };
  }

  async refreshTokens(): Promise<OAuthTokens> {
    throw new Error('GitHub OAuth tokens do not expire and cannot be refreshed');
  }

  async importItems(accessToken: string, repo: string): Promise<ImportedItem[]> {
    const context = this.parseRepositoryContext(repo);

    const issues = await fetchJsonWithRetry<GitHubIssue[]>(
      `https://api.github.com/repos/${context.owner}/${context.repo}/issues?state=all&per_page=50`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'EstimatePro',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
      { retries: 2 },
    );

    return issues
      .filter((issue) => !issue.pull_request)
      .map((issue) => ({
        externalId: `${context.owner}/${context.repo}#${issue.number}`,
        title: issue.title,
        description: issue.body,
        type: issue.labels.some((l) => l.name === 'bug') ? 'bug' : 'task',
        status: issue.state === 'open' ? 'todo' : 'done',
        priority: null,
        estimatedPoints: null,
      }));
  }

  async exportEstimate(
    accessToken: string,
    externalItemId: string,
    estimate: { points: number; hours: number },
  ): Promise<boolean> {
    const context = this.parseIssueContext(externalItemId);

    try {
      await fetchJsonWithRetry(
        `https://api.github.com/repos/${context.owner}/${context.repo}/issues/${context.issueNumber}/comments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github+json',
            'User-Agent': 'EstimatePro',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({
            body: `**EstimatePro Estimation**: ${estimate.points} story points (${estimate.hours}h)`,
          }),
        },
        { retries: 1 },
      );
      return true;
    } catch (error) {
      if (error instanceof IntegrationHttpError) {
        return false;
      }
      return false;
    }
  }

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!payload || !signature || !secret) {
      return false;
    }
    const provided = signature.replace(/^sha256=/i, '').trim();
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    if (provided.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  }
}

export const githubIntegration = new GitHubIntegration();
