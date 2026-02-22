import { and, eq, isNull, lt, gt } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { tasks } from '@estimate-pro/db/schema';

import { cacheHelpers, withCache } from '../../middleware/cache-middleware';
import { createPaginatedResponse, parseCursor, type PaginatedResponse, type PaginationInput } from '../../lib/pagination';
import { hasProjectAccess, hasTaskAccess } from '../../services/security/tenant-access';

export class TaskService {
  async create(orgId: string, data: {
    projectId: string;
    title: string;
    description?: string;
    type?: 'epic' | 'feature' | 'story' | 'task' | 'subtask' | 'bug';
    status?: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
    priority?: 'critical' | 'high' | 'medium' | 'low' | 'none';
    parentId?: string;
    assigneeId?: string;
    estimatedPoints?: number;
    estimatedHours?: number;
  }) {
    const allowed = await hasProjectAccess(data.projectId, orgId);
    if (!allowed) {
      return null;
    }
    const [task] = await db.insert(tasks).values(data).returning();
    // Invalidate task list cache for this project
    await cacheHelpers.invalidateByTag(`project:${data.projectId}`);
    return task;
  }

  async getById(id: string, orgId: string) {
    const allowed = await hasTaskAccess(id, orgId);
    if (!allowed) {
      return null;
    }
    return db.query.tasks.findFirst({
      where: eq(tasks.id, id),
      with: { children: true, parent: true, assignee: true, estimates: true },
    }) ?? null;
  }

  async update(id: string, orgId: string, data: Record<string, unknown>) {
    const allowed = await hasTaskAccess(id, orgId);
    if (!allowed) {
      return null;
    }
    const [task] = await db
      .update(tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    // Invalidate task list cache for this project
    if (task) {
      await cacheHelpers.invalidateByTag(`project:${task.projectId}`);
    }
    return task;
  }

  async listByProject(
    projectId: string,
    orgId: string,
    filters: {
      status?: string;
      type?: string;
      parentId?: string | null;
    } = {},
    pagination: PaginationInput,
  ): Promise<PaginatedResponse<typeof tasks.$inferSelect & { children?: unknown[]; assignee?: unknown }>> {
    const allowed = await hasProjectAccess(projectId, orgId);
    if (!allowed) {
      return {
        data: [],
        pagination: {
          nextCursor: null,
          hasMore: false,
          limit: pagination.limit,
        },
      };
    }

    return withCache({
      key: 'task:list',
      input: { projectId, orgId, filters, pagination },
      ttl: 300, // 5 minutes
      tags: ['tasks', `project:${projectId}`],
      fn: async () => {
        const cursorDate = parseCursor(pagination.cursor);
        const limit = pagination.limit;

        // Build where conditions
        const conditions = [eq(tasks.projectId, projectId)];

        if (filters.status) {
          conditions.push(eq(tasks.status, filters.status as typeof tasks.status.enumValues[number]));
        }
        if (filters.type) {
          conditions.push(eq(tasks.type, filters.type as typeof tasks.type.enumValues[number]));
        }
        if (filters.parentId === null) {
          conditions.push(isNull(tasks.parentId));
        } else if (filters.parentId) {
          conditions.push(eq(tasks.parentId, filters.parentId));
        }

        if (cursorDate) {
          if (pagination.direction === 'desc') {
            conditions.push(lt(tasks.createdAt, cursorDate));
          } else {
            conditions.push(gt(tasks.createdAt, cursorDate));
          }
        }

        // Fetch limit + 1 to determine if there are more items
        const items = await db.query.tasks.findMany({
          where: and(...conditions),
          with: { children: true, assignee: true },
          orderBy: (t, { desc, asc }) => [
            asc(t.sortOrder),
            pagination.direction === 'desc' ? desc(t.createdAt) : asc(t.createdAt),
          ],
          limit: limit + 1,
        });

        return createPaginatedResponse(items, limit);
      },
    });
  }

  async delete(id: string, orgId: string) {
    const allowed = await hasTaskAccess(id, orgId);
    if (!allowed) {
      return null;
    }
    const [task] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    // Invalidate task list cache for this project
    if (task) {
      await cacheHelpers.invalidateByTag(`project:${task.projectId}`);
    }
    return task;
  }

  async reorder(id: string, orgId: string, newOrder: number) {
    const allowed = await hasTaskAccess(id, orgId);
    if (!allowed) {
      return null;
    }
    const [task] = await db
      .update(tasks)
      .set({ sortOrder: newOrder, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    // Invalidate task list cache for this project
    if (task) {
      await cacheHelpers.invalidateByTag(`project:${task.projectId}`);
    }
    return task;
  }
}

export const taskService = new TaskService();
