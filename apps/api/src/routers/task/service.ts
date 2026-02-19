import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { tasks } from '@estimate-pro/db/schema';

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
    return task;
  }

  async listByProject(projectId: string, orgId: string, filters?: {
    status?: string;
    type?: string;
    parentId?: string | null;
  }) {
    const allowed = await hasProjectAccess(projectId, orgId);
    if (!allowed) {
      return [];
    }
    const conditions = [eq(tasks.projectId, projectId)];

    if (filters?.status) {
      conditions.push(eq(tasks.status, filters.status as typeof tasks.status.enumValues[number]));
    }
    if (filters?.type) {
      conditions.push(eq(tasks.type, filters.type as typeof tasks.type.enumValues[number]));
    }
    if (filters?.parentId === null) {
      conditions.push(isNull(tasks.parentId));
    } else if (filters?.parentId) {
      conditions.push(eq(tasks.parentId, filters.parentId));
    }

    return db.query.tasks.findMany({
      where: and(...conditions),
      with: { children: true, assignee: true },
      orderBy: (t, { asc }) => [asc(t.sortOrder), asc(t.createdAt)],
    });
  }

  async delete(id: string, orgId: string) {
    const allowed = await hasTaskAccess(id, orgId);
    if (!allowed) {
      return null;
    }
    const [task] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
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
    return task;
  }
}

export const taskService = new TaskService();
