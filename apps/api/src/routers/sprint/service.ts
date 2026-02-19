import { eq } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { sprints } from '@estimate-pro/db/schema';

import { hasProjectAccess, hasSprintAccess } from '../../services/security/tenant-access';

export class SprintService {
  async create(orgId: string, data: {
    projectId: string;
    name: string;
    goal?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const allowed = await hasProjectAccess(data.projectId, orgId);
    if (!allowed) {
      return null;
    }
    const [sprint] = await db.insert(sprints).values(data).returning();
    return sprint;
  }

  async getById(id: string, orgId: string) {
    const allowed = await hasSprintAccess(id, orgId);
    if (!allowed) {
      return null;
    }
    return db.query.sprints.findFirst({
      where: eq(sprints.id, id),
      with: { project: true },
    }) ?? null;
  }

  async update(id: string, orgId: string, data: {
    name?: string;
    goal?: string;
    status?: 'planning' | 'active' | 'completed' | 'cancelled';
    startDate?: string;
    endDate?: string;
  }) {
    const allowed = await hasSprintAccess(id, orgId);
    if (!allowed) {
      return null;
    }
    const [sprint] = await db
      .update(sprints)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sprints.id, id))
      .returning();
    return sprint;
  }

  async listByProject(projectId: string, orgId: string) {
    const allowed = await hasProjectAccess(projectId, orgId);
    if (!allowed) {
      return [];
    }
    return db.query.sprints.findMany({
      where: eq(sprints.projectId, projectId),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });
  }

  async delete(id: string, orgId: string) {
    const allowed = await hasSprintAccess(id, orgId);
    if (!allowed) {
      return null;
    }
    const [sprint] = await db.delete(sprints).where(eq(sprints.id, id)).returning();
    return sprint;
  }
}

export const sprintService = new SprintService();
