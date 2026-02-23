import { and, eq } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { tasks, projects } from '@estimate-pro/db/schema';

type TaskStatus = typeof tasks.status.enumValues[number];
type TaskPriority = typeof tasks.priority.enumValues[number];
type TaskType = typeof tasks.type.enumValues[number];

type TaskRow = {
  id: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedHours: number | null;
  estimatedPoints: number | null;
  actualHours: number | null;
  createdAt: Date;
  sortOrder: number;
};

type ProjectRow = {
  id: string;
  name: string;
  key: string;
};

type RoadmapTaskItem = {
  taskId: string | null;
  title: string;
  type: TaskType;
  priority: TaskPriority;
  currentStatus: TaskStatus;
  recommendedStatus: TaskStatus;
  estimatedHours: number;
  estimatedPoints: number | null;
  plannedWeek: number;
  plannedStartDay: number;
  plannedEndDay: number;
  isBuffer: boolean;
};

type RoadmapPhase = {
  week: number;
  startDay: number;
  endDay: number;
  totalHours: number;
  taskCount: number;
  tasks: RoadmapTaskItem[];
};

function roundHours(value: number): number {
  return Math.round(value * 10) / 10;
}

function getPriorityRank(priority: TaskPriority): number {
  const map: Record<TaskPriority, number> = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    none: 1,
  };
  return map[priority];
}

function getStatusRank(status: TaskStatus): number {
  const map: Record<TaskStatus, number> = {
    in_progress: 6,
    in_review: 5,
    todo: 4,
    backlog: 3,
    done: 2,
    cancelled: 1,
  };
  return map[status];
}

export class EffortService {
  private async getProjectAndTasks(projectId: string, orgId: string): Promise<{
    project: ProjectRow;
    taskList: TaskRow[];
  }> {
    const result = await db.query.projects.findFirst({
      columns: {
        id: true,
        name: true,
        key: true,
      },
      where: and(eq(projects.id, projectId), eq(projects.organizationId, orgId)),
      with: {
        tasks: {
          columns: {
            id: true,
            title: true,
            type: true,
            status: true,
            priority: true,
            estimatedHours: true,
            estimatedPoints: true,
            actualHours: true,
            createdAt: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!result) {
      throw new Error('Project not found');
    }

    return {
      project: {
        id: result.id,
        name: result.name,
        key: result.key,
      },
      taskList: result.tasks,
    };
  }

  private buildRoadmapFromTasks(
    taskList: TaskRow[],
    workHoursPerDay: number,
    contingencyPercent: number,
    includeCompleted: boolean,
  ): {
    summary: {
      hoursPerWeek: number;
      totalPlannedHours: number;
      contingencyHours: number;
      totalWithContingency: number;
      totalDays: number;
      totalWeeks: number;
      includeCompleted: boolean;
      taskCount: number;
    };
    phases: RoadmapPhase[];
  } {
    const hoursPerWeek = workHoursPerDay * 5;

    const plannedTasks = taskList
      .filter((task) => {
        if (!task.estimatedHours || task.estimatedHours <= 0) {
          return false;
        }
        if (task.status === 'cancelled') {
          return false;
        }
        if (!includeCompleted && task.status === 'done') {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const priorityDiff = getPriorityRank(b.priority) - getPriorityRank(a.priority);
        if (priorityDiff !== 0) return priorityDiff;

        const statusDiff = getStatusRank(b.status) - getStatusRank(a.status);
        if (statusDiff !== 0) return statusDiff;

        const hoursDiff = (b.estimatedHours ?? 0) - (a.estimatedHours ?? 0);
        if (hoursDiff !== 0) return hoursDiff;

        const orderDiff = a.sortOrder - b.sortOrder;
        if (orderDiff !== 0) return orderDiff;

        return a.createdAt.getTime() - b.createdAt.getTime();
      });

    const phasesByWeek = new Map<number, RoadmapPhase>();
    let cursorHours = 0;

    for (const task of plannedTasks) {
      const estimatedHours = Math.max(0, task.estimatedHours ?? 0);
      if (estimatedHours <= 0) {
        continue;
      }

      const startHour = cursorHours;
      const endHour = cursorHours + estimatedHours;

      const plannedStartDay = Math.floor(startHour / workHoursPerDay) + 1;
      const plannedEndDay = Math.max(plannedStartDay, Math.ceil(endHour / workHoursPerDay));
      const plannedWeek = Math.max(1, Math.ceil(plannedEndDay / 5));

      let recommendedStatus: TaskStatus = task.status;
      if (!['done', 'cancelled', 'in_progress', 'in_review'].includes(task.status)) {
        recommendedStatus = plannedWeek === 1 ? 'todo' : 'backlog';
      }

      const item: RoadmapTaskItem = {
        taskId: task.id,
        title: task.title,
        type: task.type,
        priority: task.priority,
        currentStatus: task.status,
        recommendedStatus,
        estimatedHours: roundHours(estimatedHours),
        estimatedPoints: task.estimatedPoints,
        plannedWeek,
        plannedStartDay,
        plannedEndDay,
        isBuffer: false,
      };

      const existingPhase = phasesByWeek.get(plannedWeek);
      if (!existingPhase) {
        phasesByWeek.set(plannedWeek, {
          week: plannedWeek,
          startDay: plannedStartDay,
          endDay: plannedEndDay,
          totalHours: estimatedHours,
          taskCount: 1,
          tasks: [item],
        });
      } else {
        existingPhase.startDay = Math.min(existingPhase.startDay, plannedStartDay);
        existingPhase.endDay = Math.max(existingPhase.endDay, plannedEndDay);
        existingPhase.totalHours += estimatedHours;
        existingPhase.taskCount += 1;
        existingPhase.tasks.push(item);
      }

      cursorHours = endHour;
    }

    const contingencyHours = cursorHours * (contingencyPercent / 100);
    if (contingencyHours > 0) {
      const contingencyStartHour = cursorHours;
      const contingencyEndHour = cursorHours + contingencyHours;
      const plannedStartDay = Math.floor(contingencyStartHour / workHoursPerDay) + 1;
      const plannedEndDay = Math.max(plannedStartDay, Math.ceil(contingencyEndHour / workHoursPerDay));
      const plannedWeek = Math.max(1, Math.ceil(plannedEndDay / 5));

      const contingencyItem: RoadmapTaskItem = {
        taskId: null,
        title: 'Contingency Buffer',
        type: 'task',
        priority: 'none',
        currentStatus: 'backlog',
        recommendedStatus: 'backlog',
        estimatedHours: roundHours(contingencyHours),
        estimatedPoints: null,
        plannedWeek,
        plannedStartDay,
        plannedEndDay,
        isBuffer: true,
      };

      const existingPhase = phasesByWeek.get(plannedWeek);
      if (!existingPhase) {
        phasesByWeek.set(plannedWeek, {
          week: plannedWeek,
          startDay: plannedStartDay,
          endDay: plannedEndDay,
          totalHours: contingencyHours,
          taskCount: 1,
          tasks: [contingencyItem],
        });
      } else {
        existingPhase.startDay = Math.min(existingPhase.startDay, plannedStartDay);
        existingPhase.endDay = Math.max(existingPhase.endDay, plannedEndDay);
        existingPhase.totalHours += contingencyHours;
        existingPhase.taskCount += 1;
        existingPhase.tasks.push(contingencyItem);
      }
    }

    const phases = [...phasesByWeek.values()]
      .sort((a, b) => a.week - b.week)
      .map((phase) => ({
        ...phase,
        totalHours: roundHours(phase.totalHours),
      }));

    const totalWithContingency = cursorHours + contingencyHours;
    const totalDays = totalWithContingency > 0 ? Math.ceil(totalWithContingency / workHoursPerDay) : 0;
    const totalWeeks = totalDays > 0 ? Math.ceil(totalDays / 5) : 0;

    return {
      summary: {
        hoursPerWeek,
        totalPlannedHours: roundHours(cursorHours),
        contingencyHours: roundHours(contingencyHours),
        totalWithContingency: roundHours(totalWithContingency),
        totalDays,
        totalWeeks,
        includeCompleted,
        taskCount: plannedTasks.length,
      },
      phases,
    };
  }

  async calculateProjectEffort(
    projectId: string,
    orgId: string,
    hourlyRate: number,
    currency: string,
    contingencyPercent: number,
    workHoursPerDay: number,
  ) {
    const { project, taskList } = await this.getProjectAndTasks(projectId, orgId);

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

  async generateRoadmap(
    projectId: string,
    orgId: string,
    contingencyPercent: number,
    workHoursPerDay: number,
    includeCompleted: boolean,
  ) {
    const { project, taskList } = await this.getProjectAndTasks(projectId, orgId);
    const roadmap = this.buildRoadmapFromTasks(
      taskList,
      workHoursPerDay,
      contingencyPercent,
      includeCompleted,
    );

    return {
      project,
      ...roadmap,
    };
  }

  async applyRoadmapToKanban(
    projectId: string,
    orgId: string,
    contingencyPercent: number,
    workHoursPerDay: number,
    includeCompleted: boolean,
    autoMoveFirstWeekToTodo: boolean,
  ) {
    const { project, taskList } = await this.getProjectAndTasks(projectId, orgId);
    const roadmap = this.buildRoadmapFromTasks(
      taskList,
      workHoursPerDay,
      contingencyPercent,
      includeCompleted,
    );

    const taskMap = new Map(taskList.map((task) => [task.id, task]));
    const roadmapTasks = roadmap.phases
      .flatMap((phase) => phase.tasks)
      .filter((item) => item.taskId !== null && !item.isBuffer)
      .sort((a, b) => {
        if (a.plannedStartDay !== b.plannedStartDay) return a.plannedStartDay - b.plannedStartDay;
        if (a.plannedEndDay !== b.plannedEndDay) return a.plannedEndDay - b.plannedEndDay;
        return a.title.localeCompare(b.title);
      });

    let updatedCount = 0;
    let movedToTodo = 0;
    let movedToBacklog = 0;

    for (let index = 0; index < roadmapTasks.length; index += 1) {
      const roadmapTask = roadmapTasks[index];
      if (!roadmapTask) continue;
      const taskId = roadmapTask.taskId;
      if (!taskId) {
        continue;
      }

      const currentTask = taskMap.get(taskId);
      if (!currentTask) {
        continue;
      }

      let nextStatus = currentTask.status;
      if (
        autoMoveFirstWeekToTodo
        && !['done', 'cancelled', 'in_progress', 'in_review'].includes(currentTask.status)
      ) {
        nextStatus = roadmapTask.plannedWeek === 1 ? 'todo' : 'backlog';
      }

      const nextSortOrder = index + 1;
      const shouldUpdate = currentTask.sortOrder !== nextSortOrder || currentTask.status !== nextStatus;
      if (!shouldUpdate) {
        continue;
      }

      await db
        .update(tasks)
        .set({
          sortOrder: nextSortOrder,
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId));

      updatedCount += 1;
      if (nextStatus === 'todo') movedToTodo += 1;
      if (nextStatus === 'backlog') movedToBacklog += 1;
    }

    return {
      project,
      updatedCount,
      movedToTodo,
      movedToBacklog,
      roadmap,
    };
  }
}

export const effortService = new EffortService();
