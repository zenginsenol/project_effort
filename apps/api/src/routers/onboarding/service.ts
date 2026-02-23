import { and, eq } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { onboardingState, projects, tasks } from '@estimate-pro/db/schema';

export class OnboardingService {
  async getByUserId(userId: string) {
    const state = await db.query.onboardingState.findFirst({
      where: eq(onboardingState.userId, userId),
    });
    return state ?? null;
  }

  async initialize(data: { userId: string; organizationId?: string }) {
    // Check if onboarding state already exists
    const existing = await this.getByUserId(data.userId);
    if (existing) {
      return existing;
    }

    const [state] = await db
      .insert(onboardingState)
      .values({
        userId: data.userId,
        organizationId: data.organizationId,
        currentStep: null,
        completedSteps: [],
        isCompleted: false,
        isSkipped: false,
        metadata: {},
      })
      .returning();
    return state;
  }

  async updateProgress(data: {
    userId: string;
    step: 'organization_created' | 'project_setup' | 'tasks_created' | 'first_estimation';
    organizationId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const state = await this.getByUserId(data.userId);
    if (!state) {
      // Initialize if not exists
      const newState = await this.initialize({ userId: data.userId, organizationId: data.organizationId });
      return this.updateProgress(data);
    }

    // Add step to completed steps if not already there
    const completedSteps = Array.isArray(state.completedSteps) ? state.completedSteps : [];
    const updatedSteps = completedSteps.includes(data.step) ? completedSteps : [...completedSteps, data.step];

    // Determine if all steps are completed
    const allSteps = ['organization_created', 'project_setup', 'tasks_created', 'first_estimation'];
    const isCompleted = allSteps.every((step) => updatedSteps.includes(step));

    // Update organization ID if provided
    const organizationId = data.organizationId ?? state.organizationId;

    // Merge metadata
    const existingMetadata = (state.metadata as Record<string, unknown>) ?? {};
    const metadata = data.metadata ? { ...existingMetadata, ...data.metadata } : existingMetadata;

    const [updated] = await db
      .update(onboardingState)
      .set({
        currentStep: data.step,
        completedSteps: updatedSteps,
        isCompleted,
        organizationId,
        metadata,
        updatedAt: new Date(),
      })
      .where(eq(onboardingState.userId, data.userId))
      .returning();

    return updated;
  }

  async skip(userId: string) {
    const state = await this.getByUserId(userId);
    if (!state) {
      // Initialize if not exists, then mark as skipped
      await this.initialize({ userId });
    }

    const [updated] = await db
      .update(onboardingState)
      .set({
        isSkipped: true,
        updatedAt: new Date(),
      })
      .where(eq(onboardingState.userId, userId))
      .returning();

    return updated;
  }

  async reset(userId: string) {
    const [updated] = await db
      .update(onboardingState)
      .set({
        currentStep: null,
        completedSteps: [],
        isCompleted: false,
        isSkipped: false,
        metadata: {},
        updatedAt: new Date(),
      })
      .where(eq(onboardingState.userId, userId))
      .returning();

    return updated;
  }

  async loadSampleData(data: { userId: string; organizationId: string }) {
    // Check for existing sample project
    const existingProject = await db.query.projects.findFirst({
      where: and(
        eq(projects.organizationId, data.organizationId),
        eq(projects.key, 'DEMO')
      ),
    });

    if (existingProject) {
      // Return existing project with task count
      const taskCount = await db.query.tasks.findMany({
        where: eq(tasks.projectId, existingProject.id),
      });
      return {
        project: existingProject,
        taskCount: taskCount.length,
      };
    }

    // Create a sample project
    const [project] = await db
      .insert(projects)
      .values({
        organizationId: data.organizationId,
        name: 'Demo Project - Getting Started',
        key: 'DEMO',
        description:
          'Welcome to EstimatePro! This is a sample project with realistic tasks to help you explore the platform.',
        defaultEstimationMethod: 'planning_poker',
      })
      .returning();

    if (!project) {
      return null;
    }

    // Sample task data for onboarding
    const taskData: Array<{
      title: string;
      description: string;
      type: 'epic' | 'feature' | 'story' | 'task' | 'subtask' | 'bug';
      status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
      priority: 'critical' | 'high' | 'medium' | 'low';
      estimatedHours: number;
      estimatedPoints: number;
      actualHours: number | null;
    }> = [
      {
        title: 'User Authentication System',
        description: 'Implement user login, registration, and password reset',
        type: 'epic',
        status: 'done',
        priority: 'critical',
        estimatedHours: 80,
        estimatedPoints: 34,
        actualHours: 85,
      },
      {
        title: 'OAuth Integration',
        description: 'Add Google and GitHub OAuth providers',
        type: 'feature',
        status: 'done',
        priority: 'high',
        estimatedHours: 16,
        estimatedPoints: 8,
        actualHours: 18,
      },
      {
        title: 'Dashboard Analytics',
        description: 'Create analytics dashboard with charts and KPIs',
        type: 'feature',
        status: 'in_progress',
        priority: 'high',
        estimatedHours: 32,
        estimatedPoints: 13,
        actualHours: null,
      },
      {
        title: 'API Rate Limiting',
        description: 'Implement rate limiting for all API endpoints',
        type: 'task',
        status: 'todo',
        priority: 'high',
        estimatedHours: 8,
        estimatedPoints: 5,
        actualHours: null,
      },
      {
        title: 'Email Notifications',
        description: 'Send email notifications for important events',
        type: 'feature',
        status: 'todo',
        priority: 'medium',
        estimatedHours: 16,
        estimatedPoints: 8,
        actualHours: null,
      },
      {
        title: 'Mobile Responsive Design',
        description: 'Make all pages responsive for mobile devices',
        type: 'task',
        status: 'backlog',
        priority: 'medium',
        estimatedHours: 24,
        estimatedPoints: 13,
        actualHours: null,
      },
      {
        title: 'Fix: Login redirect loop',
        description: 'Users getting stuck in redirect loop after login',
        type: 'bug',
        status: 'todo',
        priority: 'critical',
        estimatedHours: 4,
        estimatedPoints: 2,
        actualHours: null,
      },
      {
        title: 'Database Backup System',
        description: 'Automated daily backups with retention policy',
        type: 'task',
        status: 'backlog',
        priority: 'high',
        estimatedHours: 12,
        estimatedPoints: 5,
        actualHours: null,
      },
    ];

    // Insert all sample tasks
    for (const t of taskData) {
      await db.insert(tasks).values({
        projectId: project.id,
        title: t.title,
        description: t.description,
        type: t.type,
        status: t.status,
        priority: t.priority,
        estimatedHours: t.estimatedHours,
        estimatedPoints: t.estimatedPoints,
        actualHours: t.actualHours,
      });
    }

    return {
      project,
      taskCount: taskData.length,
    };
  }
}

export const onboardingService = new OnboardingService();
