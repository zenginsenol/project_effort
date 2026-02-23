import { and, eq } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { organizationMembers, users } from '@estimate-pro/db/schema';

import { activityService } from '../activity/service';

export class TeamService {
  async addMember(data: {
    organizationId: string;
    userId: string;
    role: 'admin' | 'member' | 'viewer';
  }, actorId?: string) {
    const [member] = await db
      .insert(organizationMembers)
      .values(data)
      .returning();

    // Record activity
    await activityService.recordActivity({
      organizationId: data.organizationId,
      activityType: 'member_joined',
      entityType: 'member',
      entityId: member.userId,
      actorId,
      metadata: {
        memberUserId: member.userId,
        memberRole: member.role,
      },
    });

    return member;
  }

  async updateRole(organizationId: string, userId: string, role: 'owner' | 'admin' | 'member' | 'viewer') {
    const [member] = await db
      .update(organizationMembers)
      .set({ role, updatedAt: new Date() })
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId),
        ),
      )
      .returning();
    return member;
  }

  async removeMember(organizationId: string, userId: string, actorId?: string) {
    const [member] = await db
      .delete(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId),
        ),
      )
      .returning();

    // Record activity
    if (member) {
      await activityService.recordActivity({
        organizationId,
        activityType: 'member_left',
        entityType: 'member',
        entityId: member.userId,
        actorId,
        metadata: {
          memberUserId: member.userId,
          memberRole: member.role,
        },
      });
    }

    return member;
  }

  async listMembers(organizationId: string) {
    return db.query.organizationMembers.findMany({
      where: eq(organizationMembers.organizationId, organizationId),
      with: { user: true },
      orderBy: (m, { asc }) => [asc(m.createdAt)],
    });
  }

  async getCurrentMember(organizationId: string, clerkId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
      columns: { id: true },
    });

    if (!user) {
      return null;
    }

    return db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, user.id),
      ),
      with: { user: true },
    });
  }
}

export const teamService = new TeamService();
