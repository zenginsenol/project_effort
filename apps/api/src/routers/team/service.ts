import { and, eq } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { organizationMembers } from '@estimate-pro/db/schema';

export class TeamService {
  async addMember(data: {
    organizationId: string;
    userId: string;
    role: 'admin' | 'member' | 'viewer';
  }) {
    const [member] = await db
      .insert(organizationMembers)
      .values(data)
      .returning();
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

  async removeMember(organizationId: string, userId: string) {
    const [member] = await db
      .delete(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId),
        ),
      )
      .returning();
    return member;
  }

  async listMembers(organizationId: string) {
    return db.query.organizationMembers.findMany({
      where: eq(organizationMembers.organizationId, organizationId),
      with: { user: true },
      orderBy: (m, { asc }) => [asc(m.createdAt)],
    });
  }
}

export const teamService = new TeamService();
