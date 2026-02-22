import { TRPCError } from '@trpc/server';
import { and, eq, type InferSelectModel } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { integrations, tasks } from '@estimate-pro/db/schema';

import { githubIntegration } from '../../services/integrations/github';
import { IntegrationHttpError } from '../../services/integrations/base';
import { jiraIntegration } from '../../services/integrations/jira';
import { hasProjectAccess } from '../../services/security/tenant-access';
import { decryptToken, describeStoredToken, encryptToken } from '../../services/security/token-crypto';
import { orgProcedure, router } from '../../trpc/trpc';
import type { BaseIntegration } from '../../services/integrations/base';
import { activityService } from '../activity/service';

import {
  callbackInput,
  connectIntegrationInput,
  disconnectInput,
  exportEstimateInput,
  getGithubProjectLinkInput,
  importItemsInput,
  linkGithubProjectInput,
  listIntegrationsInput,
  syncGithubProjectInput,
  syncItemsInput,
} from './schema';

type IntegrationRecord = InferSelectModel<typeof integrations>;

type GithubProfile = {
  login: string;
  id: number | null;
  htmlUrl: string | null;
  name: string | null;
};

type GithubProjectLink = {
  externalProjectId: string;
  autoSync: boolean;
  updatedAt: string;
  integrationId?: string | null;
};

type IntegrationSettings = {
  projectLinks: Record<string, GithubProjectLink>;
  profile: GithubProfile | null;
};

function toIntegrationSettings(raw: unknown): IntegrationSettings {
  const result: IntegrationSettings = { projectLinks: {}, profile: null };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return result;
  }

  const rawRecord = raw as Record<string, unknown>;
  const rawProfile = rawRecord.profile;
  if (rawProfile && typeof rawProfile === 'object' && !Array.isArray(rawProfile)) {
    const profileCandidate = rawProfile as Record<string, unknown>;
    const login = typeof profileCandidate.login === 'string' ? profileCandidate.login.trim() : '';
    if (login) {
      result.profile = {
        login,
        id: typeof profileCandidate.id === 'number' && Number.isFinite(profileCandidate.id)
          ? profileCandidate.id
          : null,
        htmlUrl: typeof profileCandidate.htmlUrl === 'string'
          ? profileCandidate.htmlUrl
          : typeof profileCandidate.html_url === 'string'
            ? profileCandidate.html_url
            : null,
        name: typeof profileCandidate.name === 'string' ? profileCandidate.name : null,
      };
    }
  }

  const rawLinks = rawRecord.projectLinks;
  if (!rawLinks || typeof rawLinks !== 'object' || Array.isArray(rawLinks)) {
    return result;
  }

  for (const [projectId, value] of Object.entries(rawLinks as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }

    const candidate = value as Record<string, unknown>;
    const externalProjectId = typeof candidate.externalProjectId === 'string'
      ? candidate.externalProjectId.trim()
      : '';

    if (!externalProjectId) {
      continue;
    }

    result.projectLinks[projectId] = {
      externalProjectId,
      autoSync: candidate.autoSync !== false,
      updatedAt: typeof candidate.updatedAt === 'string'
        ? candidate.updatedAt
        : new Date().toISOString(),
      integrationId: typeof candidate.integrationId === 'string' ? candidate.integrationId : null,
    };
  }

  return result;
}

function buildSettingsWithProjectLink(
  currentSettings: unknown,
  projectId: string,
  link: GithubProjectLink,
): IntegrationSettings {
  const parsed = toIntegrationSettings(currentSettings);
  return {
    profile: parsed.profile,
    projectLinks: {
      ...parsed.projectLinks,
      [projectId]: link,
    },
  };
}

function removeProjectLinkFromSettings(
  currentSettings: unknown,
  projectId: string,
): IntegrationSettings {
  const parsed = toIntegrationSettings(currentSettings);
  const nextLinks = { ...parsed.projectLinks };
  delete nextLinks[projectId];
  return {
    profile: parsed.profile,
    projectLinks: nextLinks,
  };
}

function toIntegrationDisplayName(integration: IntegrationRecord): string {
  const settings = toIntegrationSettings(integration.settings);
  const profile = settings.profile;
  if (profile?.login) {
    return profile.name && profile.name.trim().length > 0
      ? `${profile.login} (${profile.name.trim()})`
      : profile.login;
  }
  return `github-${integration.id.slice(0, 8)}`;
}

function getIntegrationClient(type: string): BaseIntegration {
  switch (type) {
    case 'jira':
      return jiraIntegration;
    case 'github':
      return githubIntegration;
    default:
      throw new TRPCError({ code: 'BAD_REQUEST', message: `Unsupported integration: ${type}` });
  }
}

function toSafeIntegrationResponse(
  integration: IntegrationRecord,
): Omit<IntegrationRecord, 'accessToken' | 'refreshToken'> & {
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  accessTokenEncrypted: boolean;
  refreshTokenEncrypted: boolean;
} {
  const { accessToken, refreshToken, ...rest } = integration;
  const access = describeStoredToken(accessToken);
  const refresh = describeStoredToken(refreshToken);

  return {
    ...rest,
    hasAccessToken: access.hasToken,
    hasRefreshToken: refresh.hasToken,
    accessTokenEncrypted: access.encrypted,
    refreshTokenEncrypted: refresh.encrypted,
  };
}

function mapTaskType(type: string): typeof tasks.type.enumValues[number] {
  const normalized = type.toLowerCase();
  if (normalized.includes('epic')) return 'epic';
  if (normalized.includes('feature')) return 'feature';
  if (normalized.includes('story')) return 'story';
  if (normalized.includes('sub')) return 'subtask';
  if (normalized.includes('bug')) return 'bug';
  return 'task';
}

function mapTaskStatus(status: string): typeof tasks.status.enumValues[number] {
  const normalized = status.toLowerCase();
  if (normalized.includes('done') || normalized.includes('closed')) return 'done';
  if (normalized.includes('review')) return 'in_review';
  if (normalized.includes('progress')) return 'in_progress';
  if (normalized.includes('todo') || normalized.includes('open')) return 'todo';
  if (normalized.includes('cancel')) return 'cancelled';
  return 'backlog';
}

function mapTaskPriority(priority: string | null): typeof tasks.priority.enumValues[number] {
  const normalized = priority?.toLowerCase() ?? 'none';
  if (normalized.includes('critical') || normalized.includes('blocker')) return 'critical';
  if (normalized.includes('high')) return 'high';
  if (normalized.includes('medium') || normalized.includes('normal')) return 'medium';
  if (normalized.includes('low')) return 'low';
  return 'none';
}

function mapIntegrationError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }

  if (error instanceof IntegrationHttpError) {
    if (error.status === 401) {
      return new TRPCError({ code: 'UNAUTHORIZED', message: 'Integration token is invalid or expired' });
    }
    if (error.status === 403) {
      return new TRPCError({ code: 'FORBIDDEN', message: 'Integration access is forbidden' });
    }
    return new TRPCError({
      code: 'BAD_GATEWAY',
      message: `Integration provider request failed (${error.status})`,
    });
  }

  if (error instanceof Error) {
    return new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
  }

  return new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Unknown integration error' });
}

async function getOwnedIntegration(integrationId: string, orgId: string): Promise<IntegrationRecord> {
  const integration = await db.query.integrations.findFirst({
    where: and(eq(integrations.id, integrationId), eq(integrations.organizationId, orgId)),
  });

  if (!integration) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Integration not found' });
  }

  return integration;
}

async function getActiveGithubIntegration(
  orgId: string,
  integrationId?: string,
): Promise<IntegrationRecord> {
  if (integrationId) {
    const owned = await getOwnedIntegration(integrationId, orgId);
    if (owned.type !== 'github') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Integration must be GitHub' });
    }
    if (!owned.isActive) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'GitHub integration is not active' });
    }
    return owned;
  }

  const github = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.organizationId, orgId),
      eq(integrations.type, 'github'),
      eq(integrations.isActive, true),
    ),
    orderBy: (i, { desc }) => [desc(i.updatedAt)],
  });

  if (!github) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'GitHub integration is not connected' });
  }

  return github;
}

async function listActiveGithubIntegrations(orgId: string): Promise<IntegrationRecord[]> {
  return db.query.integrations.findMany({
    where: and(
      eq(integrations.organizationId, orgId),
      eq(integrations.type, 'github'),
      eq(integrations.isActive, true),
    ),
    orderBy: (i, { desc }) => [desc(i.updatedAt)],
  });
}

function resolveProjectLinkFromIntegration(
  integration: IntegrationRecord,
  projectId: string,
): GithubProjectLink | null {
  const parsedSettings = toIntegrationSettings(integration.settings);
  const projectLink = parsedSettings.projectLinks[projectId];
  if (projectLink?.externalProjectId) {
    return {
      ...projectLink,
      integrationId: integration.id,
    };
  }

  const fallbackExternalProjectId = integration.externalProjectId?.trim() || null;
  if (!fallbackExternalProjectId) {
    return null;
  }

  return {
    externalProjectId: fallbackExternalProjectId,
    autoSync: false,
    updatedAt: integration.updatedAt.toISOString(),
    integrationId: integration.id,
  };
}

async function resolveGithubProjectContext(
  orgId: string,
  projectId: string,
  integrationId?: string,
): Promise<{
  connections: IntegrationRecord[];
  integration: IntegrationRecord;
  link: GithubProjectLink | null;
} | null> {
  if (integrationId) {
    const selected = await getActiveGithubIntegration(orgId, integrationId);
    const allConnections = await listActiveGithubIntegrations(orgId);
    return {
      connections: allConnections.length > 0 ? allConnections : [selected],
      integration: selected,
      link: resolveProjectLinkFromIntegration(selected, projectId),
    };
  }

  const connections = await listActiveGithubIntegrations(orgId);
  if (connections.length === 0) {
    return null;
  }

  for (const candidate of connections) {
    const parsedSettings = toIntegrationSettings(candidate.settings);
    const explicitLink = parsedSettings.projectLinks[projectId];
    if (!explicitLink?.externalProjectId) {
      continue;
    }
    return {
      connections,
      integration: candidate,
      link: {
        ...explicitLink,
        integrationId: candidate.id,
      },
    };
  }

  const selected = connections[0];
  if (!selected) {
    return null;
  }
  return {
    connections,
    integration: selected,
    link: resolveProjectLinkFromIntegration(selected, projectId),
  };
}

async function fetchGithubProfile(accessToken: string): Promise<GithubProfile | null> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'EstimatePro',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as {
      login?: string;
      id?: number;
      html_url?: string;
      name?: string | null;
    };

    const login = typeof payload.login === 'string' ? payload.login.trim() : '';
    if (!login) {
      return null;
    }

    return {
      login,
      id: typeof payload.id === 'number' && Number.isFinite(payload.id) ? payload.id : null,
      htmlUrl: typeof payload.html_url === 'string' ? payload.html_url : null,
      name: typeof payload.name === 'string' ? payload.name : null,
    };
  } catch {
    return null;
  }
}

async function refreshIntegrationTokens(
  integration: IntegrationRecord,
  client: BaseIntegration,
  refreshToken: string,
): Promise<IntegrationRecord> {
  const refreshed = await client.refreshTokens(refreshToken);

  const [updated] = await db
    .update(integrations)
    .set({
      accessToken: encryptToken(refreshed.accessToken),
      refreshToken: encryptToken(refreshed.refreshToken ?? refreshToken),
      tokenExpiresAt: refreshed.expiresAt,
      isActive: true,
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, integration.id))
    .returning();

  if (!updated) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to refresh integration token' });
  }

  return updated;
}

async function withIntegrationAccessToken<T>(
  integration: IntegrationRecord,
  client: BaseIntegration,
  operation: (accessToken: string) => Promise<T>,
): Promise<T> {
  let currentIntegration = integration;
  let accessToken = decryptToken(currentIntegration.accessToken);
  const refreshToken = decryptToken(currentIntegration.refreshToken);

  if (!accessToken) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Integration is not connected' });
  }

  const expiresSoon = Boolean(
    currentIntegration.tokenExpiresAt
      && currentIntegration.tokenExpiresAt.getTime() <= Date.now() + 60_000,
  );

  if (refreshToken && expiresSoon) {
    currentIntegration = await refreshIntegrationTokens(currentIntegration, client, refreshToken);
    accessToken = decryptToken(currentIntegration.accessToken);
    if (!accessToken) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Integration is not connected' });
    }
  }

  try {
    return await operation(accessToken);
  } catch (error) {
    if (!(error instanceof IntegrationHttpError) || error.status !== 401 || !refreshToken) {
      throw error;
    }

    currentIntegration = await refreshIntegrationTokens(currentIntegration, client, refreshToken);
    accessToken = decryptToken(currentIntegration.accessToken);
    if (!accessToken) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Integration is not connected' });
    }
    return operation(accessToken);
  }
}

async function syncImportedItemsToProject(
  projectId: string,
  importedItems: Array<{
    title: string;
    description: string | null;
    type: string;
    status: string;
    priority: string | null;
    estimatedPoints: number | null;
  }>,
): Promise<number> {
  if (importedItems.length === 0) {
    return 0;
  }

  const existingRows = await db.query.tasks.findMany({
    where: eq(tasks.projectId, projectId),
    columns: { title: true },
  });

  const existingTitles = new Set(existingRows.map((row) => row.title.trim().toLowerCase()));

  const recordsToInsert = importedItems
    .filter((item) => !existingTitles.has(item.title.trim().toLowerCase()))
    .map((item) => ({
      projectId,
      title: item.title,
      description: item.description ?? undefined,
      type: mapTaskType(item.type),
      status: mapTaskStatus(item.status),
      priority: mapTaskPriority(item.priority),
      estimatedPoints: item.estimatedPoints,
      estimatedHours: null,
    }));

  if (recordsToInsert.length === 0) {
    return 0;
  }

  const inserted = await db.insert(tasks).values(recordsToInsert).returning({ id: tasks.id });
  return inserted.length;
}

export const integrationRouter = router({
  getAuthUrl: orgProcedure
    .input(connectIntegrationInput)
    .query(({ ctx, input }) => {
      if (input.organizationId !== ctx.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization mismatch' });
      }
      const client = getIntegrationClient(input.type);
      const state = Buffer.from(JSON.stringify({ orgId: ctx.orgId, type: input.type })).toString('base64');
      return { url: client.getAuthUrl(input.redirectUri, state) };
    }),

  callback: orgProcedure
    .input(callbackInput)
    .mutation(async ({ ctx, input }) => {
      if (input.organizationId !== ctx.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization mismatch' });
      }

      try {
        const client = getIntegrationClient(input.type);
        const tokens = await client.exchangeCode(input.code, input.redirectUri);
        const encryptedAccessToken = encryptToken(tokens.accessToken);
        const encryptedRefreshToken = encryptToken(tokens.refreshToken);

        if (input.type === 'github') {
          const githubProfile = await fetchGithubProfile(tokens.accessToken);
          const existingConnections = await db.query.integrations.findMany({
            where: and(eq(integrations.organizationId, ctx.orgId), eq(integrations.type, 'github')),
            orderBy: (i, { desc }) => [desc(i.updatedAt)],
          });

          const matchedIntegration = githubProfile?.login
            ? existingConnections.find((candidate) => {
              const candidateProfile = toIntegrationSettings(candidate.settings).profile;
              return candidateProfile?.login?.toLowerCase() === githubProfile.login.toLowerCase();
            }) ?? null
            : null;

          if (matchedIntegration) {
            const currentSettings = toIntegrationSettings(matchedIntegration.settings);
            const [updated] = await db
              .update(integrations)
              .set({
                isActive: true,
                accessToken: encryptedAccessToken,
                refreshToken: encryptedRefreshToken,
                tokenExpiresAt: tokens.expiresAt,
                settings: {
                  profile: githubProfile ?? currentSettings.profile,
                  projectLinks: currentSettings.projectLinks,
                },
                updatedAt: new Date(),
              })
              .where(eq(integrations.id, matchedIntegration.id))
              .returning();

            if (!updated) {
              throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to persist integration' });
            }

            return toSafeIntegrationResponse(updated);
          }

          const [createdGithub] = await db
            .insert(integrations)
            .values({
              organizationId: ctx.orgId,
              type: 'github',
              isActive: true,
              accessToken: encryptedAccessToken,
              refreshToken: encryptedRefreshToken,
              tokenExpiresAt: tokens.expiresAt,
              settings: {
                profile: githubProfile,
                projectLinks: {},
              },
            })
            .returning();

          if (!createdGithub) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to persist integration' });
          }

          return toSafeIntegrationResponse(createdGithub);
        }

        const existing = await db.query.integrations.findFirst({
          where: and(eq(integrations.organizationId, ctx.orgId), eq(integrations.type, input.type)),
        });

        if (existing) {
          const [updated] = await db
            .update(integrations)
            .set({
              isActive: true,
              accessToken: encryptedAccessToken,
              refreshToken: encryptedRefreshToken,
              tokenExpiresAt: tokens.expiresAt,
              updatedAt: new Date(),
            })
            .where(eq(integrations.id, existing.id))
            .returning();

          if (!updated) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to persist integration' });
          }

          return toSafeIntegrationResponse(updated);
        }

        const [created] = await db
          .insert(integrations)
          .values({
            organizationId: ctx.orgId,
            type: input.type,
            isActive: true,
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            tokenExpiresAt: tokens.expiresAt,
          })
          .returning();

        if (!created) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to persist integration' });
        }

        return toSafeIntegrationResponse(created);
      } catch (error) {
        throw mapIntegrationError(error);
      }
    }),

  disconnect: orgProcedure
    .input(disconnectInput)
    .mutation(async ({ ctx, input }) => {
      const [integration] = await db
        .update(integrations)
        .set({ isActive: false, accessToken: null, refreshToken: null, updatedAt: new Date() })
        .where(and(eq(integrations.id, input.integrationId), eq(integrations.organizationId, ctx.orgId)))
        .returning();

      if (!integration) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Integration not found' });
      }
      return toSafeIntegrationResponse(integration);
    }),

  list: orgProcedure
    .input(listIntegrationsInput)
    .query(async ({ ctx, input }) => {
      if (input.organizationId !== ctx.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization mismatch' });
      }
      const records = await db.query.integrations.findMany({
        where: eq(integrations.organizationId, ctx.orgId),
        orderBy: (i, { desc }) => [desc(i.createdAt)],
      });
      return records.map(toSafeIntegrationResponse);
    }),

  getGithubProjectLink: orgProcedure
    .input(getGithubProjectLinkInput)
    .query(async ({ ctx, input }) => {
      if (!(await hasProjectAccess(input.projectId, ctx.orgId))) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Project access denied' });
      }

      const resolvedContext = await resolveGithubProjectContext(
        ctx.orgId,
        input.projectId,
        input.integrationId,
      );

      if (!resolvedContext) {
        return {
          connected: false,
          integrationId: null,
          link: null,
          availableConnections: [] as Array<{
            integrationId: string;
            displayName: string;
            updatedAt: string;
            lastSyncAt: string | null;
          }>,
        };
      }

      const availableConnections = resolvedContext.connections.map((connection) => ({
        integrationId: connection.id,
        displayName: toIntegrationDisplayName(connection),
        updatedAt: connection.updatedAt.toISOString(),
        lastSyncAt: connection.lastSyncAt ? connection.lastSyncAt.toISOString() : null,
      }));

      return {
        connected: true,
        integrationId: resolvedContext.integration.id,
        link: resolvedContext.link,
        availableConnections,
      };
    }),

  linkGithubProject: orgProcedure
    .input(linkGithubProjectInput)
    .mutation(async ({ ctx, input }) => {
      if (!(await hasProjectAccess(input.projectId, ctx.orgId))) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Project access denied' });
      }

      const integration = await getActiveGithubIntegration(ctx.orgId, input.integrationId);
      const activeConnections = await listActiveGithubIntegrations(ctx.orgId);
      const nextLink: GithubProjectLink = {
        externalProjectId: input.repository,
        autoSync: input.autoSync,
        updatedAt: new Date().toISOString(),
        integrationId: integration.id,
      };

      for (const connection of activeConnections) {
        if (connection.id === integration.id) {
          continue;
        }
        const parsed = toIntegrationSettings(connection.settings);
        if (!parsed.projectLinks[input.projectId]) {
          continue;
        }
        const cleanedSettings = removeProjectLinkFromSettings(connection.settings, input.projectId);
        await db
          .update(integrations)
          .set({
            settings: cleanedSettings,
            updatedAt: new Date(),
          })
          .where(eq(integrations.id, connection.id));
      }

      const nextSettings = buildSettingsWithProjectLink(
        integration.settings,
        input.projectId,
        nextLink,
      );

      const [updated] = await db
        .update(integrations)
        .set({
          settings: nextSettings,
          externalProjectId: nextLink.externalProjectId,
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, integration.id))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save GitHub project link' });
      }

      return {
        integrationId: updated.id,
        projectId: input.projectId,
        repository: nextLink.externalProjectId,
        autoSync: nextLink.autoSync,
        updatedAt: nextLink.updatedAt,
        integrationDisplayName: toIntegrationDisplayName(updated),
      };
    }),

  syncGithubProject: orgProcedure
    .input(syncGithubProjectInput)
    .mutation(async ({ ctx, input }) => {
      if (!(await hasProjectAccess(input.projectId, ctx.orgId))) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Project access denied' });
      }

      const resolvedContext = await resolveGithubProjectContext(
        ctx.orgId,
        input.projectId,
        input.integrationId,
      );
      if (!resolvedContext) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'GitHub integration is not connected',
        });
      }

      const integration = resolvedContext.integration;
      const projectLink = resolvedContext.link;

      if (!projectLink?.externalProjectId) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'GitHub repository is not linked for this project',
        });
      }

      const client = getIntegrationClient('github');

      try {
        const importedItems = await withIntegrationAccessToken(integration, client, (accessToken) => (
          client.importItems(accessToken, projectLink.externalProjectId)
        ));
        const scopedItems = importedItems.slice(0, input.limit);
        const syncedCount = await syncImportedItemsToProject(input.projectId, scopedItems);

        await db
          .update(integrations)
          .set({
            externalProjectId: projectLink.externalProjectId,
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(integrations.id, integration.id));

        // Record activity
        await activityService.recordActivity({
          organizationId: ctx.orgId,
          activityType: 'integration_sync_completed',
          entityType: 'integration',
          entityId: integration.id,
          actorId: ctx.userId,
          projectId: input.projectId,
          metadata: {
            integrationType: integration.type,
            repository: projectLink.externalProjectId,
            importedCount: scopedItems.length,
            syncedCount,
          },
        });

        return {
          integrationId: integration.id,
          projectId: input.projectId,
          repository: projectLink.externalProjectId,
          importedCount: scopedItems.length,
          syncedCount,
          autoSync: projectLink.autoSync,
        };
      } catch (error) {
        throw mapIntegrationError(error);
      }
    }),

  importItems: orgProcedure
    .input(importItemsInput)
    .mutation(async ({ ctx, input }) => {
      if (!(await hasProjectAccess(input.projectId, ctx.orgId))) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Project access denied' });
      }

      const integration = await getOwnedIntegration(input.integrationId, ctx.orgId);
      const client = getIntegrationClient(integration.type);

      try {
        const importedItems = await withIntegrationAccessToken(integration, client, (accessToken) => (
          client.importItems(accessToken, input.externalProjectId)
        ));

        const syncedCount = input.syncToProject
          ? await syncImportedItemsToProject(input.projectId, importedItems)
          : 0;

        await db
          .update(integrations)
          .set({
            externalProjectId: input.externalProjectId,
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(integrations.id, integration.id));

        // Record activity if items were synced to project
        if (input.syncToProject && syncedCount > 0) {
          await activityService.recordActivity({
            organizationId: ctx.orgId,
            activityType: 'integration_sync_completed',
            entityType: 'integration',
            entityId: integration.id,
            actorId: ctx.userId,
            projectId: input.projectId,
            metadata: {
              integrationType: integration.type,
              externalProjectId: input.externalProjectId,
              importedCount: importedItems.length,
              syncedCount,
            },
          });
        }

        return {
          importedCount: importedItems.length,
          syncedCount,
          items: importedItems,
        };
      } catch (error) {
        throw mapIntegrationError(error);
      }
    }),

  syncNow: orgProcedure
    .input(syncItemsInput)
    .mutation(async ({ ctx, input }) => {
      if (!(await hasProjectAccess(input.projectId, ctx.orgId))) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Project access denied' });
      }

      const integration = await getOwnedIntegration(input.integrationId, ctx.orgId);
      const client = getIntegrationClient(integration.type);

      try {
        const importedItems = await withIntegrationAccessToken(integration, client, (accessToken) => (
          client.importItems(accessToken, input.externalProjectId)
        ));

        const scopedItems = importedItems.slice(0, input.limit);
        const syncedCount = await syncImportedItemsToProject(input.projectId, scopedItems);

        await db
          .update(integrations)
          .set({
            externalProjectId: input.externalProjectId,
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(integrations.id, integration.id));

        // Record activity
        await activityService.recordActivity({
          organizationId: ctx.orgId,
          activityType: 'integration_sync_completed',
          entityType: 'integration',
          entityId: integration.id,
          actorId: ctx.userId,
          projectId: input.projectId,
          metadata: {
            integrationType: integration.type,
            externalProjectId: input.externalProjectId,
            importedCount: scopedItems.length,
            syncedCount,
          },
        });

        return {
          importedCount: scopedItems.length,
          syncedCount,
        };
      } catch (error) {
        throw mapIntegrationError(error);
      }
    }),

  exportEstimate: orgProcedure
    .input(exportEstimateInput)
    .mutation(async ({ ctx, input }) => {
      const integration = await getOwnedIntegration(input.integrationId, ctx.orgId);
      const client = getIntegrationClient(integration.type);

      try {
        const exported = await withIntegrationAccessToken(integration, client, (accessToken) => (
          client.exportEstimate(accessToken, input.externalItemId, {
            points: input.points,
            hours: input.hours,
          })
        ));

        if (!exported) {
          throw new TRPCError({ code: 'BAD_GATEWAY', message: 'Integration provider rejected export' });
        }

        await db
          .update(integrations)
          .set({ lastSyncAt: new Date(), updatedAt: new Date() })
          .where(eq(integrations.id, integration.id));

        return { success: true };
      } catch (error) {
        throw mapIntegrationError(error);
      }
    }),
});
