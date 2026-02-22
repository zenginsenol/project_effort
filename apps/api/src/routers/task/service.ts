import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { tasks } from '@estimate-pro/db/schema';

import { hasProjectAccess, hasTaskAccess } from '../../services/security/tenant-access';
import { activityService } from '../activity/service';

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
  }, actorId?: string) {
    const allowed = await hasProjectAccess(data.projectId, orgId);
    if (!allowed) {
      return null;
    }
    const [task] = await db.insert(tasks).values(data).returning();

    // Record activity
    await activityService.recordActivity({
      organizationId: orgId,
      activityType: 'task_created',
      entityType: 'task',
      entityId: task.id,
      actorId,
      projectId: data.projectId,
      metadata: {
        taskTitle: task.title,
        taskType: task.type,
        taskStatus: task.status,
      },
    });

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

  async update(id: string, orgId: string, data: Record<string, unknown>, actorId?: string) {
    const allowed = await hasTaskAccess(id, orgId);
    if (!allowed) {
      return null;
    }

    // Get the task before update to track changes
    const beforeTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
    });

    const [task] = await db
      .update(tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();

    // Track which fields changed
    const changedFields: string[] = [];
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    let statusChanged = false;

    if (beforeTask) {
      // Track specific field changes
      if (data.title !== undefined && data.title !== beforeTask.title) {
        changedFields.push('title');
        before.title = beforeTask.title;
        after.title = data.title;
      }
      if (data.description !== undefined && data.description !== beforeTask.description) {
        changedFields.push('description');
        before.description = beforeTask.description;
        after.description = data.description;
      }
      if (data.type !== undefined && data.type !== beforeTask.type) {
        changedFields.push('type');
        before.type = beforeTask.type;
        after.type = data.type;
      }
      if (data.status !== undefined && data.status !== beforeTask.status) {
        changedFields.push('status');
        before.status = beforeTask.status;
        after.status = data.status;
        statusChanged = true;
      }
      if (data.priority !== undefined && data.priority !== beforeTask.priority) {
        changedFields.push('priority');
        before.priority = beforeTask.priority;
        after.priority = data.priority;
      }
      if (data.assigneeId !== undefined && data.assigneeId !== beforeTask.assigneeId) {
        changedFields.push('assigneeId');
        before.assigneeId = beforeTask.assigneeId;
        after.assigneeId = data.assigneeId;
      }
      if (data.estimatedPoints !== undefined && data.estimatedPoints !== beforeTask.estimatedPoints) {
        changedFields.push('estimatedPoints');
        before.estimatedPoints = beforeTask.estimatedPoints;
        after.estimatedPoints = data.estimatedPoints;
      }
      if (data.estimatedHours !== undefined && data.estimatedHours !== beforeTask.estimatedHours) {
        changedFields.push('estimatedHours');
        before.estimatedHours = beforeTask.estimatedHours;
        after.estimatedHours = data.estimatedHours;
      }
    }

    // Record activity - use task_status_changed if status changed, otherwise task_updated
    const activityType = statusChanged ? 'task_status_changed' : 'task_updated';

    await activityService.recordActivity({
      organizationId: orgId,
      activityType,
      entityType: 'task',
      entityId: task.id,
      actorId,
      projectId: task.projectId,
      metadata: {
        taskTitle: task.title,
        taskType: task.type,
        taskStatus: task.status,
      },
      changes: {
        before,
        after,
        fields: changedFields,
      },
    });

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

  async delete(id: string, orgId: string, actorId?: string) {
    const allowed = await hasTaskAccess(id, orgId);
    if (!allowed) {
      return null;
    }
    const [task] = await db.delete(tasks).where(eq(tasks.id, id)).returning();

    // Record activity
    if (task) {
      await activityService.recordActivity({
        organizationId: orgId,
        activityType: 'task_updated', // Use task_updated for deletion (there's no task_deleted in the enum)
        entityType: 'task',
        entityId: task.id,
        actorId,
        projectId: task.projectId,
        metadata: {
          taskTitle: task.title,
          taskType: task.type,
          taskStatus: task.status,
          deleted: true,
        },
      });
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
    return task;
  }
}

export const taskService = new TaskService();
