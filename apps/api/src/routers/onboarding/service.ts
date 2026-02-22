import { and, eq } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { onboardingState } from '@estimate-pro/db/schema';

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
}

export const onboardingService = new OnboardingService();
