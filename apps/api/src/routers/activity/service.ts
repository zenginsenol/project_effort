import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { activities } from '@estimate-pro/db/schema';

export class ActivityService {
  async create(data: {
    organizationId: string;
    projectId?: string;
    actorId?: string;
    activityType: 'task_created' | 'task_updated' | 'task_status_changed' | 'session_created' | 'session_completed' | 'cost_analysis_created' | 'cost_analysis_exported' | 'integration_sync_completed' | 'member_joined' | 'member_left' | 'project_created' | 'project_updated' | 'project_deleted';
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }) {
    const [activity] = await db.insert(activities).values(data).returning();
    return activity;
  }

  async getById(id: string, organizationId: string) {
    return db.query.activities.findFirst({
      where: and(eq(activities.id, id), eq(activities.organizationId, organizationId)),
    }) ?? null;
  }

  async list(params: {
    organizationId: string;
    projectId?: string;
    actorId?: string;
    activityType?: 'task_created' | 'task_updated' | 'task_status_changed' | 'session_created' | 'session_completed' | 'cost_analysis_created' | 'cost_analysis_exported' | 'integration_sync_completed' | 'member_joined' | 'member_left' | 'project_created' | 'project_updated' | 'project_deleted';
    entityType?: string;
    startDate?: string;
    endDate?: string;
    limit: number;
    offset: number;
  }) {
    const conditions = [eq(activities.organizationId, params.organizationId)];

    if (params.projectId) {
      conditions.push(eq(activities.projectId, params.projectId));
    }

    if (params.actorId) {
      conditions.push(eq(activities.actorId, params.actorId));
    }

    if (params.activityType) {
      conditions.push(eq(activities.activityType, params.activityType));
    }

    if (params.entityType) {
      conditions.push(eq(activities.entityType, params.entityType));
    }

    if (params.startDate) {
      conditions.push(gte(activities.createdAt, new Date(params.startDate)));
    }

    if (params.endDate) {
      conditions.push(lte(activities.createdAt, new Date(params.endDate)));
    }

    const items = await db.query.activities.findMany({
      where: and(...conditions),
      orderBy: [desc(activities.createdAt)],
      limit: params.limit,
      offset: params.offset,
    });

    // Get total count for pagination
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(activities)
      .where(and(...conditions));

    return {
      items,
      total: Number(count),
      limit: params.limit,
      offset: params.offset,
    };
  }
}

export const activityService = new ActivityService();
