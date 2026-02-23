import { and, eq } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { sessions, sessionParticipants, sessionVotes } from '@estimate-pro/db/schema';

import { hasProjectAccess, hasSessionAccess } from '../../services/security/tenant-access';
import { activityService } from '../activity/service';

export class SessionService {
  async create(orgId: string, data: {
    projectId: string;
    taskId?: string;
    name: string;
    method: 'planning_poker' | 'tshirt_sizing' | 'pert' | 'wideband_delphi';
    moderatorId: string;
  }, actorId?: string) {
    const allowed = await hasProjectAccess(data.projectId, orgId);
    if (!allowed) {
      return null;
    }
    const [session] = await db.insert(sessions).values(data).returning();

    // Record activity
    await activityService.recordActivity({
      organizationId: orgId,
      activityType: 'session_created',
      entityType: 'session',
      entityId: session.id,
      actorId,
      projectId: data.projectId,
      metadata: {
        sessionName: session.name,
        sessionMethod: session.method,
      },
    });

    return session;
  }

  async getById(id: string, orgId: string) {
    const allowed = await hasSessionAccess(id, orgId);
    if (!allowed) {
      return null;
    }
    return db.query.sessions.findFirst({
      where: eq(sessions.id, id),
      with: {
        participants: { with: { user: true } },
        votes: true,
        project: true,
        task: true,
        moderator: true,
      },
    }) ?? null;
  }

  async listByProject(projectId: string, orgId: string) {
    const allowed = await hasProjectAccess(projectId, orgId);
    if (!allowed) {
      return [];
    }
    return db.query.sessions.findMany({
      where: eq(sessions.projectId, projectId),
      with: { participants: true },
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });
  }

  async joinSession(sessionId: string, userId: string, orgId: string) {
    const allowed = await hasSessionAccess(sessionId, orgId);
    if (!allowed) {
      return null;
    }
    const existing = await db.query.sessionParticipants.findFirst({
      where: and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.userId, userId),
      ),
    });

    if (existing) {
      const [updated] = await db
        .update(sessionParticipants)
        .set({ isOnline: true })
        .where(eq(sessionParticipants.id, existing.id))
        .returning();
      return updated;
    }

    const [participant] = await db
      .insert(sessionParticipants)
      .values({ sessionId, userId, isOnline: true })
      .returning();
    return participant;
  }

  async submitVote(sessionId: string, userId: string, round: number, value: string, orgId: string) {
    const allowed = await hasSessionAccess(sessionId, orgId);
    if (!allowed) {
      return null;
    }
    const existing = await db.query.sessionVotes.findFirst({
      where: and(
        eq(sessionVotes.sessionId, sessionId),
        eq(sessionVotes.userId, userId),
        eq(sessionVotes.round, round),
      ),
    });

    if (existing) {
      const [updated] = await db
        .update(sessionVotes)
        .set({ value })
        .where(eq(sessionVotes.id, existing.id))
        .returning();
      return updated;
    }

    const [vote] = await db
      .insert(sessionVotes)
      .values({ sessionId, userId, round, value })
      .returning();
    return vote;
  }

  async getVotes(sessionId: string, round: number, orgId: string) {
    const allowed = await hasSessionAccess(sessionId, orgId);
    if (!allowed) {
      return [];
    }
    return db.query.sessionVotes.findMany({
      where: and(
        eq(sessionVotes.sessionId, sessionId),
        eq(sessionVotes.round, round),
      ),
      with: { user: true },
    });
  }

  async revealVotes(sessionId: string, orgId: string) {
    const allowed = await hasSessionAccess(sessionId, orgId);
    if (!allowed) {
      return null;
    }
    const [session] = await db
      .update(sessions)
      .set({ status: 'revealed', updatedAt: new Date() })
      .where(eq(sessions.id, sessionId))
      .returning();
    return session;
  }

  async startNewRound(sessionId: string, orgId: string) {
    const session = await this.getById(sessionId, orgId);
    if (!session) return null;

    const newRound = session.currentRound + 1;
    const [updated] = await db
      .update(sessions)
      .set({
        currentRound: newRound,
        status: 'voting',
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId))
      .returning();
    return updated;
  }

  async completeSession(sessionId: string, finalEstimate: number, orgId: string, actorId?: string) {
    const allowed = await hasSessionAccess(sessionId, orgId);
    if (!allowed) {
      return null;
    }
    const [session] = await db
      .update(sessions)
      .set({
        status: 'completed',
        finalEstimate,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId))
      .returning();

    // Record activity
    await activityService.recordActivity({
      organizationId: orgId,
      activityType: 'session_completed',
      entityType: 'session',
      entityId: session.id,
      actorId,
      projectId: session.projectId,
      metadata: {
        sessionName: session.name,
        sessionMethod: session.method,
        finalEstimate,
      },
    });

    return session;
  }

  async updateStatus(
    sessionId: string,
    status: 'waiting' | 'voting' | 'revealed' | 'completed',
    orgId: string,
  ) {
    const allowed = await hasSessionAccess(sessionId, orgId);
    if (!allowed) {
      return null;
    }
    const [session] = await db
      .update(sessions)
      .set({ status, updatedAt: new Date() })
      .where(eq(sessions.id, sessionId))
      .returning();
    return session;
  }

  async leaveSession(sessionId: string, userId: string, orgId: string) {
    const allowed = await hasSessionAccess(sessionId, orgId);
    if (!allowed) {
      return null;
    }
    const existing = await db.query.sessionParticipants.findFirst({
      where: and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.userId, userId),
      ),
    });

    if (!existing) {
      return null;
    }

    const [updated] = await db
      .update(sessionParticipants)
      .set({ isOnline: false })
      .where(eq(sessionParticipants.id, existing.id))
      .returning();
    return updated;
  }

  async updateParticipantPresence(sessionId: string, userId: string, isOnline: boolean, orgId: string) {
    const allowed = await hasSessionAccess(sessionId, orgId);
    if (!allowed) {
      return null;
    }
    const existing = await db.query.sessionParticipants.findFirst({
      where: and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.userId, userId),
      ),
    });

    if (!existing) {
      return null;
    }

    const [updated] = await db
      .update(sessionParticipants)
      .set({ isOnline })
      .where(eq(sessionParticipants.id, existing.id))
      .returning();
    return updated;
  }

  async getOnlineParticipants(sessionId: string, orgId: string) {
    const allowed = await hasSessionAccess(sessionId, orgId);
    if (!allowed) {
      return [];
    }
    return db.query.sessionParticipants.findMany({
      where: and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.isOnline, true),
      ),
      with: { user: true },
    });
  }

  async removeParticipant(sessionId: string, userId: string, orgId: string) {
    const allowed = await hasSessionAccess(sessionId, orgId);
    if (!allowed) {
      return null;
    }
    const existing = await db.query.sessionParticipants.findFirst({
      where: and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.userId, userId),
      ),
    });

    if (!existing) {
      return null;
    }

    await db
      .delete(sessionParticipants)
      .where(eq(sessionParticipants.id, existing.id));
    return existing;
  }
}

export const sessionService = new SessionService();
