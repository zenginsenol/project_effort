import { TRPCError } from '@trpc/server';
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

  async getMethodComparison(
    projectId: string,
    taskIds: string[] | undefined,
    dateFrom: string | undefined,
    dateTo: string | undefined,
    orgId: string,
  ) {
    const allowed = await hasProjectAccess(projectId, orgId);
    if (!allowed) {
      return {
        methodStats: [],
        agreementScore: 0,
        taskComparisons: [],
        recommendation: {
          reason: 'No access to project',
          confidenceLevel: 'low' as const,
        },
      };
    }

    // Build task filter conditions
    const taskConditions = [eq(tasks.projectId, projectId)];
    if (taskIds && taskIds.length > 0) {
      taskConditions.push(sql`${tasks.id} = ANY(${taskIds})`);
    }

    // Get all estimates for the project's tasks
    const projectEstimates = await db
      .select({
        taskId: estimates.taskId,
        taskTitle: tasks.title,
        method: estimates.method,
        value: estimates.value,
        createdAt: estimates.createdAt,
      })
      .from(estimates)
      .innerJoin(tasks, eq(estimates.taskId, tasks.id))
      .where(and(...taskConditions));

    // Apply date filters in memory (more flexible than SQL for optional dates)
    let filteredEstimates = projectEstimates;
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filteredEstimates = filteredEstimates.filter((est) => est.createdAt >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setUTCHours(23, 59, 59, 999);
      filteredEstimates = filteredEstimates.filter((est) => est.createdAt <= toDate);
    }

    if (filteredEstimates.length === 0) {
      return {
        methodStats: [],
        agreementScore: 0,
        taskComparisons: [],
        recommendation: {
          reason: 'No estimation data available for the selected filters',
          confidenceLevel: 'low' as const,
        },
      };
    }

    // Group estimates by method
    type EstimationMethod = 'planning_poker' | 'tshirt_sizing' | 'pert' | 'wideband_delphi';
    const estimatesByMethod = new Map<EstimationMethod, number[]>();
    const estimatesByTask = new Map<string, Map<EstimationMethod, number[]>>();
    const taskTitles = new Map<string, string>();

    for (const est of filteredEstimates) {
      const method = est.method as EstimationMethod;

      // Track by method
      if (!estimatesByMethod.has(method)) {
        estimatesByMethod.set(method, []);
      }
      const methodArray = estimatesByMethod.get(method);
      if (methodArray) {
        methodArray.push(est.value);
      }

      // Track by task and method
      if (!estimatesByTask.has(est.taskId)) {
        estimatesByTask.set(est.taskId, new Map());
        taskTitles.set(est.taskId, est.taskTitle);
      }
      const taskMethods = estimatesByTask.get(est.taskId);
      if (taskMethods) {
        if (!taskMethods.has(method)) {
          taskMethods.set(method, []);
        }
        const methodArray = taskMethods.get(method);
        if (methodArray) {
          methodArray.push(est.value);
        }
      }
    }

    // Calculate statistics for each method
    const methodStats = Array.from(estimatesByMethod.entries()).map(([method, values]) => {
      const stats = this.calculateStats(values);
      return {
        method,
        mean: roundTo2(stats.mean),
        median: roundTo2(stats.median),
        standardDeviation: roundTo2(stats.stdDev),
        confidenceInterval: {
          lower: roundTo2(stats.ci.lower),
          upper: roundTo2(stats.ci.upper),
        },
        taskCount: values.length,
      };
    });

    // Calculate per-task comparisons (average estimate per method per task)
    const taskComparisons = Array.from(estimatesByTask.entries()).map(([taskId, methods]) => {
      const estimates: Record<string, number> = {};
      const methodEntries = Array.from(methods.entries());
      for (const [method, values] of methodEntries) {
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        estimates[method] = roundTo2(avg);
      }
      return {
        taskId,
        taskName: taskTitles.get(taskId) ?? 'Unknown Task',
        estimates,
      };
    });

    // Calculate agreement score (0-100)
    const agreementScore = this.calculateAgreementScore(taskComparisons);

    // Generate recommendation
    const recommendation = this.generateMethodRecommendation(methodStats, agreementScore);

    return {
      methodStats,
      agreementScore: roundTo2(agreementScore),
      taskComparisons,
      recommendation,
    };
  }

  private calculateStats(values: number[]): {
    mean: number;
    median: number;
    stdDev: number;
    ci: { lower: number; upper: number };
  } {
    if (values.length === 0) {
      return {
        mean: 0,
        median: 0,
        stdDev: 0,
        ci: { lower: 0, upper: 0 },
      };
    }

    // Mean
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;

    // Median
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0
      ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
      : (sorted[mid] ?? 0);

    // Standard deviation
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // 95% Confidence interval (using z-score of 1.96 for 95% CI)
    const standardError = stdDev / Math.sqrt(values.length);
    const marginOfError = 1.96 * standardError;

    return {
      mean,
      median,
      stdDev,
      ci: {
        lower: Math.max(0, mean - marginOfError),
        upper: mean + marginOfError,
      },
    };
  }

  private calculateAgreementScore(
    taskComparisons: Array<{ taskId: string; taskName: string; estimates: Record<string, number> }>,
  ): number {
    if (taskComparisons.length === 0) {
      return 0;
    }

    // Calculate coefficient of variation (CV) for each task, then average
    let totalCv = 0;
    let validTaskCount = 0;

    for (const task of taskComparisons) {
      const estimates = Object.values(task.estimates);

      if (estimates.length < 2) {
        continue;
      }

      const mean = estimates.reduce((sum, v) => sum + v, 0) / estimates.length;

      if (mean === 0) {
        continue;
      }

      const variance = estimates.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / estimates.length;
      const stdDev = Math.sqrt(variance);
      const cv = (stdDev / mean) * 100;

      totalCv += cv;
      validTaskCount += 1;
    }

    if (validTaskCount === 0) {
      return 0;
    }

    const avgCv = totalCv / validTaskCount;

    // Convert CV to agreement score (0-100)
    // CV of 0% = 100% agreement, CV of 100%+ = 0% agreement
    const agreementScore = Math.max(0, Math.min(100, 100 - avgCv));

    return agreementScore;
  }

  private generateMethodRecommendation(
    methodStats: Array<{
      method: string;
      mean: number;
      median: number;
      standardDeviation: number;
      confidenceInterval: { lower: number; upper: number };
      taskCount: number;
    }>,
    agreementScore: number,
  ): {
    preferredMethod?: 'planning_poker' | 'tshirt_sizing' | 'pert' | 'wideband_delphi';
    reason: string;
    confidenceLevel: 'high' | 'medium' | 'low';
  } {
    if (methodStats.length === 0) {
      return {
        reason: 'No estimation data available',
        confidenceLevel: 'low',
      };
    }

    if (methodStats.length === 1) {
      const firstMethod = methodStats[0];
      if (!firstMethod) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Unexpected empty methodStats',
        });
      }

      return {
        preferredMethod: firstMethod.method as 'planning_poker' | 'tshirt_sizing' | 'pert' | 'wideband_delphi',
        reason: `Only one estimation method (${firstMethod.method}) has been used`,
        confidenceLevel: 'low',
      };
    }

    // Find method with lowest coefficient of variation (stdDev / mean)
    const methodReliability = methodStats.map((stat) => ({
      method: stat.method,
      cv: stat.mean > 0 ? (stat.standardDeviation / stat.mean) * 100 : Number.POSITIVE_INFINITY,
      taskCount: stat.taskCount,
    }));

    const mostReliable = methodReliability.reduce((best, current) =>
      current.cv < best.cv ? current : best
    );

    // Determine confidence level based on agreement score and sample size
    let confidenceLevel: 'high' | 'medium' | 'low';
    const minTaskCount = Math.min(...methodStats.map((s) => s.taskCount));

    if (agreementScore >= 70 && minTaskCount >= 10) {
      confidenceLevel = 'high';
    } else if (agreementScore >= 50 && minTaskCount >= 5) {
      confidenceLevel = 'medium';
    } else {
      confidenceLevel = 'low';
    }

    const preferredMethod = mostReliable.method as 'planning_poker' | 'tshirt_sizing' | 'pert' | 'wideband_delphi';
    const cvPercentage = Math.round(mostReliable.cv);

    return {
      preferredMethod,
      reason: `${preferredMethod} shows the most consistent estimates with ${cvPercentage}% variance. Overall method agreement: ${Math.round(agreementScore)}%`,
      confidenceLevel,
    };
  }
}

export const analyticsService = new AnalyticsService();
