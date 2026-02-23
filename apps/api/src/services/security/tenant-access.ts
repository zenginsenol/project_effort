import { and, eq } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { integrations, notifications, projects, sessions, sprints, tasks } from '@estimate-pro/db/schema';

export async function hasProjectAccess(projectId: string, orgId: string): Promise<boolean> {
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.organizationId, orgId)),
    columns: { id: true },
  });
  return Boolean(project);
}

export async function hasTaskAccess(taskId: string, orgId: string): Promise<boolean> {
  const row = await db
    .select({ taskId: tasks.id })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(eq(tasks.id, taskId), eq(projects.organizationId, orgId)))
    .limit(1);
  return row.length > 0;
}

export async function hasSprintAccess(sprintId: string, orgId: string): Promise<boolean> {
  const row = await db
    .select({ sprintId: sprints.id })
    .from(sprints)
    .innerJoin(projects, eq(sprints.projectId, projects.id))
    .where(and(eq(sprints.id, sprintId), eq(projects.organizationId, orgId)))
    .limit(1);
  return row.length > 0;
}

export async function hasSessionAccess(sessionId: string, orgId: string): Promise<boolean> {
  const row = await db
    .select({ sessionId: sessions.id })
    .from(sessions)
    .innerJoin(projects, eq(sessions.projectId, projects.id))
    .where(and(eq(sessions.id, sessionId), eq(projects.organizationId, orgId)))
    .limit(1);
  return row.length > 0;
}

export async function hasIntegrationAccess(integrationId: string, orgId: string): Promise<boolean> {
  const integration = await db.query.integrations.findFirst({
    where: and(eq(integrations.id, integrationId), eq(integrations.organizationId, orgId)),
    columns: { id: true },
  });
  return Boolean(integration);
}

export async function hasNotificationAccess(notificationId: string, orgId: string): Promise<boolean> {
  const notification = await db.query.notifications.findFirst({
    where: and(eq(notifications.id, notificationId), eq(notifications.organizationId, orgId)),
    columns: { id: true },
  });
  return Boolean(notification);
}
