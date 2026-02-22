import { and, avg, count, eq, sql } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { estimates, projects, sessions, sprints, tasks } from '@estimate-pro/db/schema';

import { generateCSV, generatePDF, generateXLSX } from '../../services/export';
import { hasProjectAccess } from '../../services/security/tenant-access';
import type { ExportData } from '../../services/export';

function taskWeight(task: { estimatedPoints: number | null }): number {
  if (typeof task.estimatedPoints === 'number' && Number.isFinite(task.estimatedPoints) && task.estimatedPoints > 0) {
    return task.estimatedPoints;
  }
  return 1;
}

function parseDateOnly(raw: string | null): Date | null {
  if (!raw) {
    return null;
  }
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

export class AnalyticsService {
  async getProjectOverview(projectId: string, orgId: string) {
    const allowed = await hasProjectAccess(projectId, orgId);
    if (!allowed) {
      return {
        totalTasks: 0,
        completedTasks: 0,
        completionRate: 0,
        tasksByStatus: {},
        averagePoints: 0,
        averageHours: 0,
        totalEstimatedTasks: 0,
        totalSessions: 0,
      };
    }

    const taskStats = await db
      .select({
        status: tasks.status,
        count: count(),
      })
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .groupBy(tasks.status);

    const totalTasks = taskStats.reduce((sum, s) => sum + Number(s.count), 0);
    const completedTasks = taskStats.find((s) => s.status === 'done')?.count ?? 0;

    const estimationStats = await db
      .select({
        avgPoints: avg(tasks.estimatedPoints),
        avgHours: avg(tasks.estimatedHours),
        totalEstimated: count(),
      })
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), sql`${tasks.estimatedPoints} IS NOT NULL`));

    const sessionCount = await db
      .select({ count: count() })
      .from(sessions)
      .where(eq(sessions.projectId, projectId));

    return {
      totalTasks,
      completedTasks,
      completionRate: totalTasks > 0 ? Math.round((Number(completedTasks) / totalTasks) * 100) : 0,
      tasksByStatus: Object.fromEntries(taskStats.map((s) => [s.status, Number(s.count)])),
      averagePoints: Number(estimationStats[0]?.avgPoints ?? 0),
      averageHours: Number(estimationStats[0]?.avgHours ?? 0),
      totalEstimatedTasks: Number(estimationStats[0]?.totalEstimated ?? 0),
      totalSessions: Number(sessionCount[0]?.count ?? 0),
    };
  }

  async getVelocityData(projectId: string, sprintCount: number, orgId: string) {
    const allowed = await hasProjectAccess(projectId, orgId);
    if (!allowed) {
      return [];
    }

    const [recentSprints, projectTasks] = await Promise.all([
      db.query.sprints.findMany({
        where: eq(sprints.projectId, projectId),
        orderBy: (s, { desc }) => [desc(s.createdAt)],
        limit: sprintCount,
      }),
      db.query.tasks.findMany({
        where: eq(tasks.projectId, projectId),
        columns: {
          estimatedPoints: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return [...recentSprints]
      .reverse()
      .map((sprint) => {
        const startDate = parseDateOnly(sprint.startDate) ?? sprint.createdAt;
        const endDate = parseDateOnly(sprint.endDate) ?? new Date();
        const sprintEnd = new Date(endDate);
        sprintEnd.setUTCHours(23, 59, 59, 999);

        const plannedPoints = projectTasks
          .filter((task) => task.createdAt <= sprintEnd)
          .reduce((sum, task) => sum + taskWeight(task), 0);

        const completedPoints = projectTasks
          .filter((task) => task.status === 'done' && task.updatedAt >= startDate && task.updatedAt <= sprintEnd)
          .reduce((sum, task) => sum + taskWeight(task), 0);

        return {
          sprintId: sprint.id,
          sprintName: sprint.name,
          status: sprint.status,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          plannedPoints: roundTo2(plannedPoints),
          completedPoints: roundTo2(completedPoints),
        };
      });
  }

  async getBurndownData(projectId: string, days: number, orgId: string) {
    const allowed = await hasProjectAccess(projectId, orgId);
    if (!allowed) {
      return [];
    }

    const projectTasks = await db.query.tasks.findMany({
      where: eq(tasks.projectId, projectId),
      columns: {
        estimatedPoints: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (projectTasks.length === 0) {
      return [];
    }

    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

    const timeline: Array<{
      date: string;
      remaining: number;
      idealRemaining: number;
      completed: number;
      scope: number;
    }> = [];

    for (let index = 0; index < days; index += 1) {
      const day = new Date(startDate);
      day.setUTCDate(startDate.getUTCDate() + index);

      const dayEnd = new Date(day);
      dayEnd.setUTCHours(23, 59, 59, 999);

      const scope = projectTasks
        .filter((task) => task.createdAt <= dayEnd)
        .reduce((sum, task) => sum + taskWeight(task), 0);

      const completed = projectTasks
        .filter((task) => task.status === 'done' && task.updatedAt <= dayEnd)
        .reduce((sum, task) => sum + taskWeight(task), 0);

      const remaining = Math.max(scope - completed, 0);

      timeline.push({
        date: day.toISOString().slice(0, 10),
        remaining: roundTo2(remaining),
        idealRemaining: 0,
        completed: roundTo2(completed),
        scope: roundTo2(scope),
      });
    }

    const startRemaining = timeline[0]?.remaining ?? 0;
    const divisor = Math.max(timeline.length - 1, 1);

    return timeline.map((point, index) => ({
      ...point,
      idealRemaining: roundTo2(startRemaining * (1 - (index / divisor))),
    }));
  }

  async getEstimationAccuracy(projectId: string, orgId: string) {
    const allowed = await hasProjectAccess(projectId, orgId);
    if (!allowed) {
      return [];
    }

    const tasksWithBoth = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        estimatedHours: tasks.estimatedHours,
        actualHours: tasks.actualHours,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.projectId, projectId),
          sql`${tasks.estimatedHours} IS NOT NULL`,
          sql`${tasks.actualHours} IS NOT NULL`,
        ),
      );

    return tasksWithBoth.map((task) => ({
      taskId: task.id,
      title: task.title,
      estimated: task.estimatedHours,
      actual: task.actualHours,
      variance: task.actualHours && task.estimatedHours
        ? Math.round(((task.actualHours - task.estimatedHours) / task.estimatedHours) * 100)
        : null,
    }));
  }

  async getTeamBias(projectId: string, orgId: string) {
    const allowed = await hasProjectAccess(projectId, orgId);
    if (!allowed) {
      return [];
    }

    const userEstimates = await db
      .select({
        userId: estimates.userId,
        avgValue: avg(estimates.value),
        estimateCount: count(),
      })
      .from(estimates)
      .innerJoin(tasks, eq(estimates.taskId, tasks.id))
      .where(eq(tasks.projectId, projectId))
      .groupBy(estimates.userId);

    return userEstimates.map((ue) => ({
      userId: ue.userId,
      averageEstimate: Number(ue.avgValue ?? 0),
      totalEstimates: Number(ue.estimateCount),
    }));
  }

  async getAccuracyTrends(projectId: string, orgId: string) {
    const allowed = await hasProjectAccess(projectId, orgId);
    if (!allowed) {
      return [];
    }

    const tasksWithBoth = await db
      .select({
        estimatedHours: tasks.estimatedHours,
        actualHours: tasks.actualHours,
        updatedAt: tasks.updatedAt,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.projectId, projectId),
          sql`${tasks.estimatedHours} IS NOT NULL`,
          sql`${tasks.actualHours} IS NOT NULL`,
          sql`${tasks.estimatedHours} > 0`,
        ),
      )
      .orderBy(tasks.updatedAt);

    if (tasksWithBoth.length === 0) {
      return [];
    }

    const windows = [
      { weeks: 4, label: '4 weeks' },
      { weeks: 8, label: '8 weeks' },
      { weeks: 12, label: '12 weeks' },
    ];

    const now = new Date();

    return windows.map((window) => {
      const windowStart = new Date(now);
      windowStart.setUTCDate(windowStart.getUTCDate() - (window.weeks * 7));

      const windowTasks = tasksWithBoth.filter(
        (task) => task.updatedAt >= windowStart && task.updatedAt <= now,
      );

      if (windowTasks.length === 0) {
        return {
          window: window.label,
          weeks: window.weeks,
          accuracyScore: 0,
          taskCount: 0,
          averageVariance: 0,
        };
      }

      let totalAccuracy = 0;
      let totalVariance = 0;

      for (const task of windowTasks) {
        const estimated = task.estimatedHours ?? 0;
        const actual = task.actualHours ?? 0;

        if (estimated > 0 && actual > 0) {
          const accuracy = Math.min((estimated / actual) * 100, 200);
          totalAccuracy += accuracy;

          const variance = ((actual - estimated) / estimated) * 100;
          totalVariance += variance;
        }
      }

      const avgAccuracy = totalAccuracy / windowTasks.length;
      const avgVariance = totalVariance / windowTasks.length;

      return {
        window: window.label,
        weeks: window.weeks,
        accuracyScore: roundTo2(avgAccuracy),
        taskCount: windowTasks.length,
        averageVariance: roundTo2(avgVariance),
      };
    });
  }

  async getEnhancedTeamBias(
    projectId: string,
    groupBy: 'type' | 'priority' | 'method' | 'user' | 'all',
    orgId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const allowed = await hasProjectAccess(projectId, orgId);
    if (!allowed) {
      return [];
    }

    const dateConditions = [];
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      dateConditions.push(sql`${tasks.updatedAt} >= ${fromDate}`);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      dateConditions.push(sql`${tasks.updatedAt} <= ${toDate}`);
    }

    const baseConditions = [
      eq(tasks.projectId, projectId),
      sql`${tasks.estimatedHours} IS NOT NULL`,
      sql`${tasks.actualHours} IS NOT NULL`,
      sql`${tasks.estimatedHours} > 0`,
      sql`${tasks.actualHours} > 0`,
      ...dateConditions,
    ];

    if (groupBy === 'type' || groupBy === 'all') {
      const tasksByType = await db
        .select({
          type: tasks.type,
          estimatedHours: tasks.estimatedHours,
          actualHours: tasks.actualHours,
        })
        .from(tasks)
        .where(and(...baseConditions));

      const typeGroups = new Map<string, Array<{ estimated: number; actual: number }>>();

      for (const task of tasksByType) {
        const key = task.type;
        if (!typeGroups.has(key)) {
          typeGroups.set(key, []);
        }
        typeGroups.get(key)!.push({
          estimated: task.estimatedHours ?? 0,
          actual: task.actualHours ?? 0,
        });
      }

      const typeResults = Array.from(typeGroups.entries()).map(([type, taskList]) => {
        const { avgAccuracy, avgVariance, bias } = this.calculateGroupMetrics(taskList);
        return {
          dimension: 'type' as const,
          value: type,
          taskCount: taskList.length,
          averageAccuracy: avgAccuracy,
          averageVariance: avgVariance,
          bias,
        };
      });

      if (groupBy === 'type') {
        return typeResults;
      }
    }

    if (groupBy === 'priority' || groupBy === 'all') {
      const tasksByPriority = await db
        .select({
          priority: tasks.priority,
          estimatedHours: tasks.estimatedHours,
          actualHours: tasks.actualHours,
        })
        .from(tasks)
        .where(and(...baseConditions));

      const priorityGroups = new Map<string, Array<{ estimated: number; actual: number }>>();

      for (const task of tasksByPriority) {
        const key = task.priority;
        if (!priorityGroups.has(key)) {
          priorityGroups.set(key, []);
        }
        priorityGroups.get(key)!.push({
          estimated: task.estimatedHours ?? 0,
          actual: task.actualHours ?? 0,
        });
      }

      const priorityResults = Array.from(priorityGroups.entries()).map(([priority, taskList]) => {
        const { avgAccuracy, avgVariance, bias } = this.calculateGroupMetrics(taskList);
        return {
          dimension: 'priority' as const,
          value: priority,
          taskCount: taskList.length,
          averageAccuracy: avgAccuracy,
          averageVariance: avgVariance,
          bias,
        };
      });

      if (groupBy === 'priority') {
        return priorityResults;
      }
    }

    if (groupBy === 'method' || groupBy === 'all') {
      const tasksByMethod = await db
        .select({
          method: estimates.method,
          estimatedHours: tasks.estimatedHours,
          actualHours: tasks.actualHours,
        })
        .from(tasks)
        .innerJoin(estimates, eq(estimates.taskId, tasks.id))
        .where(and(...baseConditions));

      const methodGroups = new Map<string, Array<{ estimated: number; actual: number }>>();

      for (const task of tasksByMethod) {
        const key = task.method;
        if (!methodGroups.has(key)) {
          methodGroups.set(key, []);
        }
        methodGroups.get(key)!.push({
          estimated: task.estimatedHours ?? 0,
          actual: task.actualHours ?? 0,
        });
      }

      const methodResults = Array.from(methodGroups.entries()).map(([method, taskList]) => {
        const { avgAccuracy, avgVariance, bias } = this.calculateGroupMetrics(taskList);
        return {
          dimension: 'method' as const,
          value: method,
          taskCount: taskList.length,
          averageAccuracy: avgAccuracy,
          averageVariance: avgVariance,
          bias,
        };
      });

      if (groupBy === 'method') {
        return methodResults;
      }
    }

    if (groupBy === 'user' || groupBy === 'all') {
      const tasksByUser = await db
        .select({
          userId: estimates.userId,
          estimatedHours: tasks.estimatedHours,
          actualHours: tasks.actualHours,
        })
        .from(tasks)
        .innerJoin(estimates, eq(estimates.taskId, tasks.id))
        .where(and(...baseConditions));

      const userGroups = new Map<string, Array<{ estimated: number; actual: number }>>();

      for (const task of tasksByUser) {
        const key = task.userId;
        if (!userGroups.has(key)) {
          userGroups.set(key, []);
        }
        userGroups.get(key)!.push({
          estimated: task.estimatedHours ?? 0,
          actual: task.actualHours ?? 0,
        });
      }

      const userResults = Array.from(userGroups.entries()).map(([userId, taskList]) => {
        const { avgAccuracy, avgVariance, bias } = this.calculateGroupMetrics(taskList);
        return {
          dimension: 'user' as const,
          value: userId,
          taskCount: taskList.length,
          averageAccuracy: avgAccuracy,
          averageVariance: avgVariance,
          bias,
        };
      });

      if (groupBy === 'user') {
        return userResults;
      }
    }

    return [];
  }

  private calculateGroupMetrics(taskList: Array<{ estimated: number; actual: number }>) {
    let totalAccuracy = 0;
    let totalVariance = 0;

    for (const task of taskList) {
      if (task.estimated > 0 && task.actual > 0) {
        const accuracy = Math.min((task.estimated / task.actual) * 100, 200);
        totalAccuracy += accuracy;

        const variance = ((task.actual - task.estimated) / task.estimated) * 100;
        totalVariance += variance;
      }
    }

    const avgAccuracy = roundTo2(totalAccuracy / taskList.length);
    const avgVariance = roundTo2(totalVariance / taskList.length);

    let bias: 'over-estimating' | 'under-estimating' | 'neutral' = 'neutral';
    if (avgVariance > 10) {
      bias = 'under-estimating';
    } else if (avgVariance < -10) {
      bias = 'over-estimating';
    }

    return { avgAccuracy, avgVariance, bias };
  }

  private async buildExportData(projectId: string, orgId: string): Promise<{
    safeProjectKey: string;
    dateStamp: string;
    exportData: ExportData;
  } | null> {
    const allowed = await hasProjectAccess(projectId, orgId);
    if (!allowed) {
      return null;
    }

    const [project, projectTasks] = await Promise.all([
      db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.organizationId, orgId)),
      }),
      db.query.tasks.findMany({
        where: eq(tasks.projectId, projectId),
        with: { assignee: true },
        orderBy: (task, { asc }) => [asc(task.createdAt)],
      }),
    ]);

    if (!project) {
      return null;
    }

    const totalPoints = projectTasks.reduce((sum, task) => sum + (task.estimatedPoints ?? 0), 0);
    const totalHours = projectTasks.reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0);
    const completedTasks = projectTasks.filter((task) => task.status === 'done').length;

    const exportData: ExportData = {
      projectName: project.name,
      generatedAt: new Date().toISOString(),
      tasks: projectTasks.map((task) => ({
        title: task.title,
        type: task.type,
        status: task.status,
        priority: task.priority,
        estimatedPoints: task.estimatedPoints,
        estimatedHours: task.estimatedHours,
        actualHours: task.actualHours,
        assignee: task.assignee?.email ?? null,
      })),
      summary: {
        totalTasks: projectTasks.length,
        completedTasks,
        totalPoints: roundTo2(totalPoints),
        totalHours: roundTo2(totalHours),
      },
    };

    const safeProjectKey = project.key.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    const dateStamp = new Date().toISOString().slice(0, 10);

    return { safeProjectKey, dateStamp, exportData };
  }

  async exportCsv(projectId: string, orgId: string) {
    const payload = await this.buildExportData(projectId, orgId);
    if (!payload) {
      return null;
    }

    const csv = generateCSV(payload.exportData);

    return {
      filename: `${payload.safeProjectKey}-analytics-${payload.dateStamp}.csv`,
      content: csv,
    };
  }

  async exportXlsx(projectId: string, orgId: string) {
    const payload = await this.buildExportData(projectId, orgId);
    if (!payload) {
      return null;
    }

    const xlsx = generateXLSX(payload.exportData);

    return {
      filename: `${payload.safeProjectKey}-analytics-${payload.dateStamp}.xlsx`,
      contentBase64: xlsx.toString('base64'),
    };
  }

  async exportPdf(projectId: string, orgId: string) {
    const payload = await this.buildExportData(projectId, orgId);
    if (!payload) {
      return null;
    }

    const pdfBytes = await generatePDF(payload.exportData);
    const pdfBuffer = Buffer.from(pdfBytes);

    return {
      filename: `${payload.safeProjectKey}-analytics-${payload.dateStamp}.pdf`,
      contentBase64: pdfBuffer.toString('base64'),
    };
  }
}

export const analyticsService = new AnalyticsService();
