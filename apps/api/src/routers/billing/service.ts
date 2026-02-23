import { and, eq, desc } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { subscriptions, invoices, usageTracking, organizations } from '@estimate-pro/db/schema';

import { stripeService } from '../../services/stripe/stripe-client';

// Plan configuration with Stripe Price IDs
// TODO: Move these to environment variables in production
const PLAN_CONFIG = {
  free: {
    priceId: process.env.STRIPE_PRICE_FREE ?? '',
    limits: {
      projects: 2,
      teamMembers: 5,
      estimationSessions: 10,
      aiAnalysesPerMonth: 10,
      exportFormats: ['json'],
    },
  },
  pro: {
    priceId: process.env.STRIPE_PRICE_PRO ?? 'price_pro_monthly',
    limits: {
      projects: 50,
      teamMembers: 50,
      estimationSessions: 500,
      aiAnalysesPerMonth: 500,
      exportFormats: ['json', 'csv', 'pdf'],
    },
  },
  enterprise: {
    priceId: process.env.STRIPE_PRICE_ENTERPRISE ?? 'price_enterprise_monthly',
    limits: {
      projects: -1, // unlimited
      teamMembers: -1, // unlimited
      estimationSessions: -1, // unlimited
      aiAnalysesPerMonth: -1, // unlimited
      exportFormats: ['json', 'csv', 'pdf', 'excel'],
    },
  },
} as const;

type SubscriptionPlan = 'free' | 'pro' | 'enterprise';
type LimitType = 'projects' | 'teamMembers' | 'estimationSessions' | 'aiAnalyses';

export class BillingService {
  async getCurrentSubscription(orgId: string) {
    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.organizationId, orgId),
      orderBy: desc(subscriptions.createdAt),
    });
    return subscription ?? null;
  }

  async createCheckoutSession(
    orgId: string,
    plan: SubscriptionPlan,
    successUrl?: string,
    cancelUrl?: string,
  ) {
    // Get organization details
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Get or create Stripe customer
    let stripeCustomerId = org.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripeService.createCustomer({
        email: org.slug + '@example.com', // TODO: Use actual org email
        name: org.name,
        metadata: {
          organizationId: orgId,
        },
      });
      stripeCustomerId = customer.id;

      // Update organization with Stripe customer ID
      await db
        .update(organizations)
        .set({ stripeCustomerId, updatedAt: new Date() })
        .where(eq(organizations.id, orgId));
    }

    // Get price ID for plan
    const priceId = PLAN_CONFIG[plan].priceId;
    if (!priceId) {
      throw new Error(`Price ID not configured for plan: ${plan}`);
    }

    // Create Stripe Checkout session
    const session = await stripeService.createCheckoutSession({
      customerId: stripeCustomerId,
      priceId,
      successUrl: successUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true`,
      cancelUrl: cancelUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?canceled=true`,
      metadata: {
        organizationId: orgId,
        plan,
      },
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  async createPortalSession(orgId: string, returnUrl?: string) {
    // Get organization with Stripe customer ID
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });

    if (!org?.stripeCustomerId) {
      throw new Error('No Stripe customer found for organization');
    }

    // Create Stripe Customer Portal session
    const session = await stripeService.createPortalSession({
      customerId: org.stripeCustomerId,
      returnUrl: returnUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
    });

    return {
      url: session.url,
    };
  }

  async updateSubscription(orgId: string, newPlan: SubscriptionPlan) {
    // Get current subscription
    const subscription = await this.getCurrentSubscription(orgId);
    if (!subscription?.stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    // Get new price ID
    const priceId = PLAN_CONFIG[newPlan].priceId;
    if (!priceId) {
      throw new Error(`Price ID not configured for plan: ${newPlan}`);
    }

    // Update Stripe subscription
    const updatedSubscription = await stripeService.updateSubscription(
      subscription.stripeSubscriptionId,
      {
        priceId,
        metadata: {
          organizationId: orgId,
          plan: newPlan,
        },
      },
    );

    // Update database subscription record
    const [updated] = await db
      .update(subscriptions)
      .set({
        plan: newPlan,
        status: updatedSubscription.status as 'active' | 'canceled' | 'past_due' | 'incomplete',
        currentPeriodStart: new Date(updatedSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id))
      .returning();

    // Update organization current plan
    await db
      .update(organizations)
      .set({ currentPlan: newPlan, updatedAt: new Date() })
      .where(eq(organizations.id, orgId));

    return updated;
  }

  async cancelSubscription(orgId: string, cancelImmediately = false) {
    // Get current subscription
    const subscription = await this.getCurrentSubscription(orgId);
    if (!subscription?.stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    // Cancel Stripe subscription
    const canceledSubscription = await stripeService.cancelSubscription(
      subscription.stripeSubscriptionId,
      cancelImmediately,
    );

    // Update database subscription record
    const [updated] = await db
      .update(subscriptions)
      .set({
        status: canceledSubscription.status as 'active' | 'canceled' | 'past_due' | 'incomplete',
        cancelAtPeriodEnd: canceledSubscription.cancel_at_period_end,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id))
      .returning();

    // If canceled immediately, update organization plan to free
    if (cancelImmediately) {
      await db
        .update(organizations)
        .set({ currentPlan: 'free', updatedAt: new Date() })
        .where(eq(organizations.id, orgId));
    }

    return updated;
  }

  async getUsageStats(orgId: string, month?: string) {
    // Use provided month or current month
    const targetMonth = month ?? new Date().toISOString().slice(0, 7); // YYYY-MM format

    // Get usage tracking record for the month
    const usage = await db.query.usageTracking.findFirst({
      where: and(
        eq(usageTracking.organizationId, orgId),
        eq(usageTracking.monthYear, targetMonth),
      ),
    });

    // Get current subscription to determine plan limits
    const subscription = await this.getCurrentSubscription(orgId);
    const currentPlan = subscription?.plan ?? 'free';
    const limits = PLAN_CONFIG[currentPlan].limits;

    return {
      month: targetMonth,
      usage: {
        projects: usage?.projectsCount ?? 0,
        teamMembers: usage?.teamMembersCount ?? 0,
        estimationSessions: usage?.estimationSessionsCount ?? 0,
        aiAnalyses: usage?.aiAnalysesCount ?? 0,
      },
      limits: {
        projects: limits.projects,
        teamMembers: limits.teamMembers,
        estimationSessions: limits.estimationSessions,
        aiAnalyses: limits.aiAnalysesPerMonth,
      },
      plan: currentPlan,
    };
  }

  async checkPlanLimit(orgId: string, limitType: LimitType): Promise<{ allowed: boolean; current: number; limit: number; plan: SubscriptionPlan }> {
    // Get current subscription
    const subscription = await this.getCurrentSubscription(orgId);
    const currentPlan = subscription?.plan ?? 'free';
    const planConfig = PLAN_CONFIG[currentPlan];

    // Get current usage for the month
    const currentMonth = new Date().toISOString().slice(0, 7);
    const usage = await db.query.usageTracking.findFirst({
      where: and(
        eq(usageTracking.organizationId, orgId),
        eq(usageTracking.monthYear, currentMonth),
      ),
    });

    // Map limit type to usage field and plan limit
    let currentCount = 0;
    let limit = 0;

    switch (limitType) {
      case 'projects':
        currentCount = usage?.projectsCount ?? 0;
        limit = planConfig.limits.projects;
        break;
      case 'teamMembers':
        currentCount = usage?.teamMembersCount ?? 0;
        limit = planConfig.limits.teamMembers;
        break;
      case 'estimationSessions':
        currentCount = usage?.estimationSessionsCount ?? 0;
        limit = planConfig.limits.estimationSessions;
        break;
      case 'aiAnalyses':
        currentCount = usage?.aiAnalysesCount ?? 0;
        limit = planConfig.limits.aiAnalysesPerMonth;
        break;
    }

    // Check if limit is exceeded
    // -1 means unlimited
    const allowed = limit === -1 || currentCount < limit;

    return {
      allowed,
      current: currentCount,
      limit,
      plan: currentPlan,
    };
  }

  async listInvoices(orgId: string, limit = 10) {
    // Get invoices from database
    const orgInvoices = await db.query.invoices.findMany({
      where: eq(invoices.organizationId, orgId),
      orderBy: desc(invoices.createdAt),
      limit,
    });

    return orgInvoices;
  }

  getPlanLimits(plan: SubscriptionPlan) {
    return {
      plan,
      limits: PLAN_CONFIG[plan].limits,
    };
  }

  getAllPlans() {
    return [
      { plan: 'free' as const, limits: PLAN_CONFIG.free.limits },
      { plan: 'pro' as const, limits: PLAN_CONFIG.pro.limits },
      { plan: 'enterprise' as const, limits: PLAN_CONFIG.enterprise.limits },
    ];
  }
}

export const billingService = new BillingService();
