import { and, eq, lt, gt } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { projects } from '@estimate-pro/db/schema';

import { cacheHelpers, withCache } from '../../middleware/cache-middleware';
import { createPaginatedResponse, parseCursor, type PaginatedResponse, type PaginationInput } from '../../lib/pagination';

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

  async listByOrganization(
    organizationId: string,
    pagination: PaginationInput,
  ): Promise<PaginatedResponse<typeof projects.$inferSelect & { tasks?: unknown[] }>> {
    return withCache({
      key: 'project:list',
      input: { organizationId, pagination },
      ttl: 300, // 5 minutes
      tags: ['projects', `org:${organizationId}`],
      fn: async () => {
        const cursorDate = parseCursor(pagination.cursor);
        const limit = pagination.limit;

        // Build where conditions
        const whereConditions = [eq(projects.organizationId, organizationId)];

        if (cursorDate) {
          if (pagination.direction === 'desc') {
            whereConditions.push(lt(projects.createdAt, cursorDate));
          } else {
            whereConditions.push(gt(projects.createdAt, cursorDate));
          }
        }

        // Fetch limit + 1 to determine if there are more items
        const items = await db.query.projects.findMany({
          where: and(...whereConditions),
          with: { tasks: true },
          orderBy: (p, { desc, asc }) => [
            pagination.direction === 'desc' ? desc(p.createdAt) : asc(p.createdAt),
          ],
          limit: limit + 1,
        });

        return createPaginatedResponse(items, limit);
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
