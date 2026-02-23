import { and, eq, lt } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { sessionParticipants } from '@estimate-pro/db/schema';

export type PresenceStatus = 'online' | 'idle' | 'voting';

export interface ParticipantPresence {
  sessionId: string;
  userId: string;
  status: PresenceStatus;
  isOnline: boolean;
  lastSeenAt: Date;
}

export class PresenceManager {
  private readonly IDLE_THRESHOLD_MS = 60000; // 1 minute
  private readonly DISCONNECT_THRESHOLD_MS = 300000; // 5 minutes

  /**
   * Update a participant's presence status in a session
   */
  async updatePresence(
    sessionId: string,
    userId: string,
    status: PresenceStatus,
  ): Promise<ParticipantPresence | null> {
    const now = new Date();

    // Find existing participant record
    const existing = await db.query.sessionParticipants.findFirst({
      where: and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.userId, userId),
      ),
    });

    if (!existing) {
      return null;
    }

    // Update presence fields
    const [updated] = await db
      .update(sessionParticipants)
      .set({
        status,
        isOnline: true,
        lastSeenAt: now,
      })
      .where(eq(sessionParticipants.id, existing.id))
      .returning();

    if (!updated) {
      return null;
    }

    return {
      sessionId: updated.sessionId,
      userId: updated.userId,
      status: status,
      isOnline: updated.isOnline,
      lastSeenAt: updated.lastSeenAt ?? now,
    };
  }

  /**
   * Mark a participant as online (when they join or reconnect)
   */
  async markOnline(sessionId: string, userId: string): Promise<ParticipantPresence | null> {
    return this.updatePresence(sessionId, userId, 'online');
  }

  /**
   * Mark a participant as idle (no activity for IDLE_THRESHOLD)
   */
  async markIdle(sessionId: string, userId: string): Promise<ParticipantPresence | null> {
    return this.updatePresence(sessionId, userId, 'idle');
  }

  /**
   * Mark a participant as voting (actively submitting a vote)
   */
  async markVoting(sessionId: string, userId: string): Promise<ParticipantPresence | null> {
    return this.updatePresence(sessionId, userId, 'voting');
  }

  /**
   * Mark a participant as offline (when they disconnect)
   */
  async markOffline(sessionId: string, userId: string): Promise<void> {
    const existing = await db.query.sessionParticipants.findFirst({
      where: and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.userId, userId),
      ),
    });

    if (!existing) {
      return;
    }

    await db
      .update(sessionParticipants)
      .set({
        isOnline: false,
        lastSeenAt: new Date(),
      })
      .where(eq(sessionParticipants.id, existing.id));
  }

  /**
   * Update heartbeat timestamp for a participant
   */
  async updateHeartbeat(sessionId: string, userId: string): Promise<void> {
    const existing = await db.query.sessionParticipants.findFirst({
      where: and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.userId, userId),
      ),
    });

    if (!existing) {
      return;
    }

    await db
      .update(sessionParticipants)
      .set({
        lastSeenAt: new Date(),
      })
      .where(eq(sessionParticipants.id, existing.id));
  }

  /**
   * Get all participants' presence for a session
   */
  async getSessionPresence(sessionId: string): Promise<ParticipantPresence[]> {
    const participants = await db.query.sessionParticipants.findMany({
      where: eq(sessionParticipants.sessionId, sessionId),
    });

    const now = Date.now();
    return participants.map((p) => {
      const lastSeen = p.lastSeenAt ? p.lastSeenAt.getTime() : now;
      const timeSinceLastSeen = now - lastSeen;

      // Determine actual presence status based on lastSeenAt
      let effectiveStatus: PresenceStatus = p.status as PresenceStatus;
      if (!p.isOnline) {
        effectiveStatus = 'idle';
      } else if (timeSinceLastSeen > this.IDLE_THRESHOLD_MS && p.status !== 'voting') {
        effectiveStatus = 'idle';
      }

      return {
        sessionId: p.sessionId,
        userId: p.userId,
        status: effectiveStatus,
        isOnline: p.isOnline,
        lastSeenAt: p.lastSeenAt ?? new Date(p.joinedAt),
      };
    });
  }

  /**
   * Clean up participants who have been disconnected for more than 5 minutes
   */
  async cleanupStaleParticipants(sessionId: string): Promise<number> {
    const threshold = new Date(Date.now() - this.DISCONNECT_THRESHOLD_MS);

    // Find participants who are offline and haven't been seen in 5 minutes
    const staleParticipants = await db.query.sessionParticipants.findMany({
      where: and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.isOnline, false),
        lt(sessionParticipants.lastSeenAt, threshold),
      ),
    });

    if (staleParticipants.length === 0) {
      return 0;
    }

    // Delete stale participants
    for (const participant of staleParticipants) {
      await db
        .delete(sessionParticipants)
        .where(eq(sessionParticipants.id, participant.id));
    }

    return staleParticipants.length;
  }

  /**
   * Check if a participant is still active (for reconnection within 5 minutes)
   */
  async canReconnect(sessionId: string, userId: string): Promise<boolean> {
    const participant = await db.query.sessionParticipants.findFirst({
      where: and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.userId, userId),
      ),
    });

    if (!participant) {
      return false;
    }

    const lastSeen = participant.lastSeenAt ?? participant.joinedAt;
    const timeSinceLastSeen = Date.now() - lastSeen.getTime();

    return timeSinceLastSeen < this.DISCONNECT_THRESHOLD_MS;
  }

  /**
   * Get idle threshold in milliseconds
   */
  getIdleThreshold(): number {
    return this.IDLE_THRESHOLD_MS;
  }

  /**
   * Get disconnect threshold in milliseconds
   */
  getDisconnectThreshold(): number {
    return this.DISCONNECT_THRESHOLD_MS;
  }
}

export const presenceManager = new PresenceManager();
