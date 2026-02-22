import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { verifyToken } from '@clerk/backend';
import type Redis from 'ioredis';

import { db } from '@estimate-pro/db';
import { getRedis } from '../lib/cache';

export interface Context {
  req: CreateFastifyContextOptions['req'];
  res: CreateFastifyContextOptions['res'];
  userId: string | null;
  orgId: string | null;
  redis: Redis;
}

function getBearerToken(authHeader: string | string[] | undefined): string | null {
  if (!authHeader || Array.isArray(authHeader)) return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

function getOrgIdFromHeaders(headers: CreateFastifyContextOptions['req']['headers']): string | null {
  const orgHeader = headers['x-org-id'] ?? headers['x-organization-id'];
  if (Array.isArray(orgHeader)) return orgHeader[0] ?? null;
  if (typeof orgHeader === 'string' && orgHeader.length > 0) return orgHeader;
  return null;
}

function getOrgIdFromPayload(payload: Record<string, unknown>): string | null {
  const candidates = [payload.org_id, payload.orgId, payload.organization_id];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) return candidate;
  }
  return null;
}

function hasValidClerkSecret(secret?: string): boolean {
  if (!secret) return false;
  const trimmed = secret.trim();
  if (!trimmed) return false;
  return !trimmed.includes('xxxxx');
}

/**
 * Demo auth mode is useful in local/dev bootstrap, but must never be auto-enabled
 * in production.
 */
export function isDemoModeEnabled(
  env: {
    NODE_ENV?: string;
    CLERK_SECRET_KEY?: string;
    ENABLE_DEMO_AUTH?: string;
  } = process.env,
): boolean {
  const nodeEnv = (env.NODE_ENV ?? 'development').toLowerCase();
  const demoOverride = (env.ENABLE_DEMO_AUTH ?? '').toLowerCase();
  const clerkOk = hasValidClerkSecret(env.CLERK_SECRET_KEY);

  if (nodeEnv === 'production') {
    return false;
  }

  if (demoOverride === 'true' || demoOverride === '1') {
    return true;
  }
  if (demoOverride === 'false' || demoOverride === '0') {
    return false;
  }

  return !clerkOk;
}

export function validateAuthRuntimeConfig(
  env: {
    NODE_ENV?: string;
    CLERK_SECRET_KEY?: string;
  } = process.env,
): void {
  const nodeEnv = (env.NODE_ENV ?? 'development').toLowerCase();
  if (nodeEnv !== 'production') {
    return;
  }

  if (!hasValidClerkSecret(env.CLERK_SECRET_KEY)) {
    throw new Error('CLERK_SECRET_KEY must be configured with a valid production key when NODE_ENV=production.');
  }
}

// Demo mode: use fixed user/org when Clerk is not configured
const DEMO_MODE = isDemoModeEnabled();
const DEMO_USER_ID = 'user_demo_001';
const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000000';
let demoIdentityCache: { userId: string | null; orgId: string | null } | null = null;

async function getDemoIdentity(): Promise<{ userId: string | null; orgId: string | null }> {
  if (demoIdentityCache) {
    return demoIdentityCache;
  }

  try {
    const org = await db.query.organizations.findFirst({
      columns: { id: true },
      orderBy: (orgs, { asc }) => [asc(orgs.createdAt)],
    });
    const user = await db.query.users.findFirst({
      columns: { clerkId: true },
      orderBy: (users, { asc }) => [asc(users.createdAt)],
    });

    demoIdentityCache = {
      userId: user?.clerkId ?? DEMO_USER_ID,
      orgId: org?.id ?? DEMO_ORG_ID,
    };
    return demoIdentityCache;
  } catch {
    demoIdentityCache = { userId: DEMO_USER_ID, orgId: DEMO_ORG_ID };
    return demoIdentityCache;
  }
}

async function resolveAuth(
  req: CreateFastifyContextOptions['req'],
): Promise<{ userId: string | null; orgId: string | null }> {
  // In demo mode, always return a valid user context
  if (DEMO_MODE) {
    const demoIdentity = await getDemoIdentity();
    const orgIdFromHeader = getOrgIdFromHeaders(req.headers);
    return {
      userId: demoIdentity.userId,
      orgId: orgIdFromHeader || demoIdentity.orgId || DEMO_ORG_ID,
    };
  }

  const token = getBearerToken(req.headers.authorization);
  const orgIdFromHeader = getOrgIdFromHeaders(req.headers);

  if (!token) {
    return { userId: null, orgId: orgIdFromHeader };
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return { userId: null, orgId: orgIdFromHeader };
  }

  try {
    const payload = await verifyToken(token, {
      secretKey,
    });

    const userId = typeof payload.sub === 'string' ? payload.sub : null;
    const orgId = getOrgIdFromPayload(payload as Record<string, unknown>) ?? orgIdFromHeader;

    return { userId, orgId };
  } catch {
    return { userId: null, orgId: orgIdFromHeader };
  }
}

export async function createContext({ req, res }: CreateFastifyContextOptions): Promise<Context> {
  const { userId, orgId } = await resolveAuth(req);

  return {
    req,
    res,
    userId,
    orgId,
    redis: getRedis(),
  };
}

export type { CreateFastifyContextOptions };
