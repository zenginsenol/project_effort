import { and, eq, lt } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { organizationInvitations } from '@estimate-pro/db/schema';
import { invitationService } from '../../routers/invitation/service';

/**
 * Cleanup expired invitations cron job
 * Runs every hour to mark pending invitations as expired if their expiresAt date has passed
 */

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
let cleanupTimer: NodeJS.Timeout | null = null;

/**
 * Find and mark all expired pending invitations
 * @returns Number of invitations marked as expired
 */
export async function cleanupExpiredInvitations(): Promise<number> {
  try {
    // Find all pending invitations that have expired
    const expiredInvitations = await db.query.organizationInvitations.findMany({
      where: and(
        eq(organizationInvitations.status, 'pending'),
        lt(organizationInvitations.expiresAt, new Date())
      ),
      columns: {
        id: true,
        email: true,
        expiresAt: true,
      },
    });

    if (expiredInvitations.length === 0) {
      return 0;
    }

    // Mark each expired invitation
    let markedCount = 0;
    for (const invitation of expiredInvitations) {
      try {
        await invitationService.markAsExpired(invitation.id);
        markedCount++;
      } catch (error) {
        console.error(
          `Failed to mark invitation ${invitation.id} (${invitation.email}) as expired:`,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }

    if (markedCount > 0) {
      console.log(
        `[invitation-cleanup] Marked ${markedCount} expired invitation${markedCount === 1 ? '' : 's'} as expired`
      );
    }

    return markedCount;
  } catch (error) {
    console.error(
      '[invitation-cleanup] Failed to cleanup expired invitations:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return 0;
  }
}

/**
 * Start the invitation cleanup cron job
 * Runs immediately on start, then every hour
 */
export function startInvitationCleanupCron(): void {
  if (cleanupTimer) {
    console.warn('[invitation-cleanup] Cron job already running');
    return;
  }

  console.log('[invitation-cleanup] Starting invitation cleanup cron job');

  // Run immediately on startup
  void cleanupExpiredInvitations();

  // Then run every hour
  cleanupTimer = setInterval(() => {
    void cleanupExpiredInvitations();
  }, CLEANUP_INTERVAL_MS);

  // Allow process to exit if this is the only timer running
  cleanupTimer.unref();
}

/**
 * Stop the invitation cleanup cron job
 */
export function stopInvitationCleanupCron(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    console.log('[invitation-cleanup] Stopped invitation cleanup cron job');
  }
}
