import { createHmac, timingSafeEqual } from 'node:crypto';

import { BaseIntegration, fetchJsonWithRetry, IntegrationHttpError } from './base';

import type { ImportedItem, OAuthTokens } from './base';

type JiraTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

type JiraAccessibleResource = {
  id: string;
};

type JiraIssue = {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: unknown;
    issuetype: { name: string };
    status: { name: string };
    priority: { name: string } | null;
    customfield_10016?: unknown;
  };
};

export class JiraIntegration extends BaseIntegration {
  readonly type = 'jira' as const;

  private getCredentials(): { clientId: string; clientSecret: string } {
    const clientId = process.env.JIRA_CLIENT_ID?.trim();
    const clientSecret = process.env.JIRA_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      throw new Error('JIRA_CLIENT_ID and JIRA_CLIENT_SECRET are required');
    }
    return { clientId, clientSecret };
  }

  private normalizeType(issueType: string): string {
    const type = issueType.toLowerCase();
    if (type.includes('epic')) return 'epic';
    if (type.includes('story')) return 'story';
    if (type.includes('feature')) return 'feature';
    if (type.includes('sub')) return 'subtask';
    if (type.includes('bug')) return 'bug';
    return 'task';
  }

  private normalizeStatus(status: string): string {
    const normalized = status.toLowerCase();
    if (normalized.includes('done') || normalized.includes('closed') || normalized.includes('resolved')) {
      return 'done';
    }
    if (normalized.includes('review')) {
      return 'in_review';
    }
    if (normalized.includes('progress')) {
      return 'in_progress';
    }
    if (normalized.includes('todo') || normalized.includes('open')) {
      return 'todo';
    }
    return 'backlog';
  }

  private parseDescription(raw: unknown): string | null {
    if (typeof raw === 'string') {
      return raw;
    }

    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const maybeObject = raw as { content?: Array<{ content?: Array<{ text?: string }> }> };
    const texts = maybeObject.content
      ?.flatMap((item) => item.content ?? [])
      .map((item) => item.text)
      .filter((text): text is string => typeof text === 'string' && text.trim().length > 0);

    if (!texts || texts.length === 0) {
      return null;
    }

    return texts.join('\n');
  }

  private async resolveJiraContext(
    accessToken: string,
    externalProjectId: string,
  ): Promise<{ cloudId: string; projectKey: string | null }> {
    const explicit = externalProjectId.split(':');
    if (explicit.length === 2 && explicit[0] && explicit[1]) {
      return { cloudId: explicit[0], projectKey: explicit[1] };
    }

    const resources = await fetchJsonWithRetry<JiraAccessibleResource[]>(
      'https://api.atlassian.com/oauth/token/accessible-resources',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
      { retries: 2 },
    );

    const firstResource = resources[0];
    if (!firstResource?.id) {
      throw new Error('No Jira cloud resource available for current token');
    }

    return { cloudId: firstResource.id, projectKey: externalProjectId || null };
  }

  private async resolveJiraCloudId(accessToken: string): Promise<string> {
    const resources = await fetchJsonWithRetry<JiraAccessibleResource[]>(
      'https://api.atlassian.com/oauth/token/accessible-resources',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
      { retries: 2 },
    );
    const firstResource = resources[0];
    if (!firstResource?.id) {
      throw new Error('No Jira cloud resource available for current token');
    }
    return firstResource.id;
  }

  getAuthUrl(redirectUri: string, state: string): string {
    const { clientId } = this.getCredentials();
    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: clientId,
      scope: 'read:jira-work write:jira-work read:jira-user',
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      prompt: 'consent',
    });
    return `https://auth.atlassian.com/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const { clientId, clientSecret } = this.getCredentials();
    const data = await fetchJsonWithRetry<JiraTokenResponse>(
      'https://auth.atlassian.com/oauth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      },
      { retries: 2 },
    );

    if (!data.access_token) {
      throw new Error('Jira did not return an access token');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const { clientId, clientSecret } = this.getCredentials();
    const data = await fetchJsonWithRetry<JiraTokenResponse>(
      'https://auth.atlassian.com/oauth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }),
      },
      { retries: 2 },
    );

    if (!data.access_token) {
      throw new Error('Jira did not return a refreshed access token');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async importItems(accessToken: string, externalProjectId: string): Promise<ImportedItem[]> {
    const context = await this.resolveJiraContext(accessToken, externalProjectId);
    const jql = context.projectKey
      ? `project = ${context.projectKey} ORDER BY created DESC`
      : 'ORDER BY created DESC';

    const url = new URL(`https://api.atlassian.com/ex/jira/${context.cloudId}/rest/api/3/search`);
    url.searchParams.set('jql', jql);
    url.searchParams.set('maxResults', '50');
    url.searchParams.set(
      'fields',
      'summary,description,issuetype,status,priority,customfield_10016',
    );

    const data = await fetchJsonWithRetry<{ issues: JiraIssue[] }>(
      url.toString(),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
      { retries: 2 },
    );

    return (data.issues ?? []).map((issue) => ({
      externalId: `${context.cloudId}:${issue.key || issue.id}`,
      title: issue.fields.summary,
      description: this.parseDescription(issue.fields.description),
      type: this.normalizeType(issue.fields.issuetype.name),
      status: this.normalizeStatus(issue.fields.status.name),
      priority: issue.fields.priority?.name?.toLowerCase() ?? null,
      estimatedPoints: typeof issue.fields.customfield_10016 === 'number'
        ? issue.fields.customfield_10016
        : null,
    }));
  }

  async exportEstimate(
    accessToken: string,
    externalItemId: string,
    estimate: { points: number; hours: number },
  ): Promise<boolean> {
    let cloudId: string;
    let issueId: string;

    const explicit = externalItemId.split(':');
    if (explicit.length === 2 && explicit[0] && explicit[1]) {
      cloudId = explicit[0];
      issueId = explicit[1];
    } else {
      cloudId = await this.resolveJiraCloudId(accessToken);
      issueId = externalItemId;
    }

    try {
      await fetchJsonWithRetry(
        `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${issueId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            fields: { customfield_10016: estimate.points },
          }),
        },
        { retries: 1 },
      );
      return true;
    } catch (error) {
      if (!(error instanceof IntegrationHttpError) || (error.status !== 400 && error.status !== 404)) {
        return false;
      }
    }

    try {
      await fetchJsonWithRetry(
        `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${issueId}/comment`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            body: `EstimatePro: ${estimate.points} story points (${estimate.hours}h)`,
          }),
        },
        { retries: 1 },
      );
      return true;
    } catch {
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

export const jiraIntegration = new JiraIntegration();
