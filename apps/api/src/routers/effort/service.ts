import { eq, sql, and, count, sum, avg } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { tasks, projects } from '@estimate-pro/db/schema';

export class EffortService {
  async calculateProjectEffort(
    projectId: string,
    orgId: string,
    hourlyRate: number,
    currency: string,
    contingencyPercent: number,
    workHoursPerDay: number,
  ) {
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.organizationId, orgId)),
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const taskList = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        type: tasks.type,
        status: tasks.status,
        priority: tasks.priority,
        estimatedHours: tasks.estimatedHours,
        estimatedPoints: tasks.estimatedPoints,
        actualHours: tasks.actualHours,
      })
      .from(tasks)
      .where(eq(tasks.projectId, projectId));

    const totalEstimatedHours = taskList.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0);
    const totalActualHours = taskList.reduce((sum, t) => sum + (t.actualHours ?? 0), 0);
    const totalEstimatedPoints = taskList.reduce((sum, t) => sum + (t.estimatedPoints ?? 0), 0);

    const contingencyHours = totalEstimatedHours * (contingencyPercent / 100);
    const totalWithContingency = totalEstimatedHours + contingencyHours;

    const baseCost = totalEstimatedHours * hourlyRate;
    const contingencyCost = contingencyHours * hourlyRate;
    const totalCost = totalWithContingency * hourlyRate;

    const totalDays = Math.ceil(totalWithContingency / workHoursPerDay);
    const totalWeeks = Math.ceil(totalDays / 5);

    const byType = taskList.reduce((acc, t) => {
      const key = t.type;
      if (!acc[key]) acc[key] = { count: 0, hours: 0, points: 0, cost: 0 };
      acc[key].count++;
      acc[key].hours += t.estimatedHours ?? 0;
      acc[key].points += t.estimatedPoints ?? 0;
      acc[key].cost += (t.estimatedHours ?? 0) * hourlyRate;
      return acc;
    }, {} as Record<string, { count: number; hours: number; points: number; cost: number }>);

    const byPriority = taskList.reduce((acc, t) => {
      const key = t.priority;
      if (!acc[key]) acc[key] = { count: 0, hours: 0, cost: 0 };
      acc[key].count++;
      acc[key].hours += t.estimatedHours ?? 0;
      acc[key].cost += (t.estimatedHours ?? 0) * hourlyRate;
      return acc;
    }, {} as Record<string, { count: number; hours: number; cost: number }>);

    const byStatus = taskList.reduce((acc, t) => {
      const key = t.status;
      if (!acc[key]) acc[key] = { count: 0, hours: 0, cost: 0 };
      acc[key].count++;
      acc[key].hours += t.estimatedHours ?? 0;
      acc[key].cost += (t.estimatedHours ?? 0) * hourlyRate;
      return acc;
    }, {} as Record<string, { count: number; hours: number; cost: number }>);

    const tasksWithEstimate = taskList.filter(t => t.estimatedHours !== null);
    const tasksWithoutEstimate = taskList.filter(t => t.estimatedHours === null);

    return {
      project: {
        id: project.id,
        name: project.name,
        key: project.key,
      },
      summary: {
        totalTasks: taskList.length,
        estimatedTasks: tasksWithEstimate.length,
        unestimatedTasks: tasksWithoutEstimate.length,
        totalEstimatedHours: Math.round(totalEstimatedHours * 10) / 10,
        totalActualHours: Math.round(totalActualHours * 10) / 10,
        totalEstimatedPoints: Math.round(totalEstimatedPoints * 10) / 10,
        contingencyPercent,
        contingencyHours: Math.round(contingencyHours * 10) / 10,
        totalWithContingency: Math.round(totalWithContingency * 10) / 10,
        totalDays,
        totalWeeks,
        hourlyRate,
        currency,
        baseCost: Math.round(baseCost),
        contingencyCost: Math.round(contingencyCost),
        totalCost: Math.round(totalCost),
        workHoursPerDay,
      },
      breakdown: {
        byType,
        byPriority,
        byStatus,
      },
      tasks: taskList.map(t => ({
        ...t,
        cost: Math.round((t.estimatedHours ?? 0) * hourlyRate),
      })),
      unestimatedTasks: tasksWithoutEstimate.map(t => ({
        id: t.id,
        title: t.title,
        type: t.type,
        priority: t.priority,
      })),
    };
  }
}

export const effortService = new EffortService();
