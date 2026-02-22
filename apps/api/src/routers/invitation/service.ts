import { and, eq } from 'drizzle-orm';
import crypto from 'node:crypto';

import { db } from '@estimate-pro/db';
import { organizationInvitations } from '@estimate-pro/db/schema';

export class InvitationService {
  async createInvitation(data: {
    organizationId: string;
    email: string;
    role: 'admin' | 'member' | 'viewer';
    invitedBy: string;
  }) {
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    const [invitation] = await db
      .insert(organizationInvitations)
      .values({
        ...data,
        token,
        expiresAt,
        status: 'pending',
      })
      .returning();
    return invitation;
  }

  async listInvitations(organizationId: string) {
    return db.query.organizationInvitations.findMany({
      where: eq(organizationInvitations.organizationId, organizationId),
      with: {
        organization: true,
        inviter: true,
      },
      orderBy: (i, { desc }) => [desc(i.createdAt)],
    });
  }

  async getInvitationById(invitationId: string) {
    return db.query.organizationInvitations.findFirst({
      where: eq(organizationInvitations.id, invitationId),
      with: {
        organization: true,
        inviter: true,
      },
    });
  }

  async getInvitationByToken(token: string) {
    return db.query.organizationInvitations.findFirst({
      where: eq(organizationInvitations.token, token),
      with: {
        organization: true,
        inviter: true,
      },
    });
  }

  async cancelInvitation(invitationId: string) {
    const [invitation] = await db
      .update(organizationInvitations)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(organizationInvitations.id, invitationId))
      .returning();
    return invitation;
  }

  async resendInvitation(invitationId: string) {
    const newToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    const [invitation] = await db
      .update(organizationInvitations)
      .set({
        token: newToken,
        expiresAt,
        status: 'pending',
        updatedAt: new Date(),
      })
      .where(eq(organizationInvitations.id, invitationId))
      .returning();
    return invitation;
  }

  async acceptInvitation(token: string) {
    const [invitation] = await db
      .update(organizationInvitations)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(eq(organizationInvitations.token, token))
      .returning();
    return invitation;
  }

  async markAsExpired(invitationId: string) {
    const [invitation] = await db
      .update(organizationInvitations)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(organizationInvitations.id, invitationId))
      .returning();
    return invitation;
  }
}

export const invitationService = new InvitationService();
