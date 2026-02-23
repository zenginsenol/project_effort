import { and, eq } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { projects } from '@estimate-pro/db/schema';

import { activityService } from '../activity/service';

export class ProjectService {
  async create(organizationId: string, data: {
    name: string;
    key: string;
    description?: string;
    defaultEstimationMethod?: 'planning_poker' | 'tshirt_sizing' | 'pert' | 'wideband_delphi';
  }, actorId?: string) {
    const [project] = await db.insert(projects).values({ ...data, organizationId }).returning();

    // Record activity
    await activityService.recordActivity({
      organizationId,
      activityType: 'project_created',
      entityType: 'project',
      entityId: project.id,
      actorId,
      projectId: project.id,
      metadata: {
        projectName: project.name,
        projectKey: project.key,
      },
    });

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
  }, actorId?: string) {
    // Get the project before update to track changes
    const beforeProject = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.organizationId, organizationId)),
    });

    const [project] = await db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))
      .returning();

    // Track which fields changed
    const changedFields: string[] = [];
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    if (beforeProject) {
      if (data.name && data.name !== beforeProject.name) {
        changedFields.push('name');
        before.name = beforeProject.name;
        after.name = data.name;
      }
      if (data.description !== undefined && data.description !== beforeProject.description) {
        changedFields.push('description');
        before.description = beforeProject.description;
        after.description = data.description;
      }
      if (data.status && data.status !== beforeProject.status) {
        changedFields.push('status');
        before.status = beforeProject.status;
        after.status = data.status;
      }
      if (data.defaultEstimationMethod && data.defaultEstimationMethod !== beforeProject.defaultEstimationMethod) {
        changedFields.push('defaultEstimationMethod');
        before.defaultEstimationMethod = beforeProject.defaultEstimationMethod;
        after.defaultEstimationMethod = data.defaultEstimationMethod;
      }
    }

    // Record activity
    await activityService.recordActivity({
      organizationId,
      activityType: 'project_updated',
      entityType: 'project',
      entityId: project.id,
      actorId,
      projectId: project.id,
      metadata: {
        projectName: project.name,
        projectKey: project.key,
      },
      changes: {
        before,
        after,
        fields: changedFields,
      },
    });

    return project;
  }

  async listByOrganization(organizationId: string) {
    return db.query.projects.findMany({
      where: eq(projects.organizationId, organizationId),
      with: { tasks: true },
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });
  }

  async delete(id: string, organizationId: string, actorId?: string) {
    const [project] = await db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))
      .returning();

    // Record activity
    if (project) {
      await activityService.recordActivity({
        organizationId,
        activityType: 'project_deleted',
        entityType: 'project',
        entityId: project.id,
        actorId,
        projectId: project.id,
        metadata: {
          projectName: project.name,
          projectKey: project.key,
        },
      });
    }

    return project;
  }
}

export const projectService = new ProjectService();
