import { and, eq } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { projects } from '@estimate-pro/db/schema';

import { cacheHelpers, withCache } from '../../middleware/cache-middleware';

export class ProjectService {
  async create(organizationId: string, data: {
    name: string;
    key: string;
    description?: string;
    defaultEstimationMethod?: 'planning_poker' | 'tshirt_sizing' | 'pert' | 'wideband_delphi';
  }) {
    const [project] = await db.insert(projects).values({ ...data, organizationId }).returning();
    // Invalidate project list cache for this organization
    await cacheHelpers.invalidateByTag(`org:${organizationId}`);
    return project;
  }

  async getById(id: string, organizationId: string) {
    return db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.organizationId, organizationId)),
      with: { tasks: true, sessions: true, sprints: true },
    }) ?? null;
  }

  async update(id: string, organizationId: string, data: {
    name?: string;
    description?: string;
    status?: 'active' | 'archived' | 'completed';
    defaultEstimationMethod?: 'planning_poker' | 'tshirt_sizing' | 'pert' | 'wideband_delphi';
  }) {
    const [project] = await db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))
      .returning();
    // Invalidate project list cache for this organization
    await cacheHelpers.invalidateByTag(`org:${organizationId}`);
    return project;
  }

  async listByOrganization(organizationId: string) {
    return withCache({
      key: 'project:list',
      input: { organizationId },
      ttl: 300, // 5 minutes
      tags: ['projects', `org:${organizationId}`],
      fn: async () => {
        return db.query.projects.findMany({
          where: eq(projects.organizationId, organizationId),
          with: { tasks: true },
          orderBy: (p, { desc }) => [desc(p.createdAt)],
        });
      },
    });
  }

  async delete(id: string, organizationId: string) {
    const [project] = await db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))
      .returning();
    // Invalidate project list cache for this organization
    await cacheHelpers.invalidateByTag(`org:${organizationId}`);
    return project;
  }
}

export const projectService = new ProjectService();
