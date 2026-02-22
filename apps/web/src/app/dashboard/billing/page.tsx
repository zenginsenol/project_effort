'use client';

import { useState, useMemo } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

import { trpc } from '@/lib/trpc';
import { PlanCard } from '@/components/billing/plan-card';
import { UsageChart } from '@/components/billing/usage-chart';
import { PaymentMethod } from '@/components/billing/payment-method';
import { InvoiceList } from '@/components/billing/invoice-list';
import { UpgradePrompt } from '@/components/billing/upgrade-prompt';

export default function BillingPage(): React.ReactElement {
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Fetch current subscription
  const {
    data: subscription,
    isLoading: subscriptionLoading,
    error: subscriptionError,
  } = trpc.billing.getCurrentSubscription.useQuery();

  // Fetch usage stats for current month
  const currentMonth = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, []);

  const {
    data: usageStats,
    isLoading: usageLoading,
    error: usageError,
  } = trpc.billing.getUsage.useQuery({ month: currentMonth });

  // Fetch all plan limits
  const {
    data: allPlans,
    isLoading: plansLoading,
    error: plansError,
  } = trpc.billing.getAllPlans.useQuery();

  // Loading state
  if (subscriptionLoading || usageLoading || plansLoading) {
    return (
      <div className="container mx-auto max-w-7xl p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Billing & Subscription</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your subscription, view usage, and upgrade your plan
          </p>
        </div>
        <div className="space-y-12">
          {/* Loading skeletons */}
          <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
          <div className="h-48 w-full animate-pulse rounded-lg bg-muted" />
          <div className="grid gap-6 md:grid-cols-3">
            <div className="h-96 w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-96 w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-96 w-full animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (subscriptionError || usageError || plansError) {
    const error = subscriptionError ?? usageError ?? plansError;
    return (
      <div className="container mx-auto max-w-7xl p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Billing & Subscription</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your subscription, view usage, and upgrade your plan
          </p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-red-900">
                Failed to load billing information
              </h2>
              <p className="mt-2 text-sm text-red-700">
                {error?.message ?? 'An unexpected error occurred. Please try again later.'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                <Loader2 className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentPlan = subscription?.plan ?? 'free';
  const plans = allPlans ?? [];

  // Find plan limits for each tier
  const freePlan = plans.find((p) => p.plan === 'free');
  const proPlan = plans.find((p) => p.plan === 'pro');
  const enterprisePlan = plans.find((p) => p.plan === 'enterprise');

  // Get current plan's limits for usage display
  const currentPlanLimits =
    plans.find((p) => p.plan === currentPlan)?.limits ??
    freePlan?.limits ?? {
      projects: 2,
      teamMembers: 5,
      aiAnalysesPerMonth: 10,
    };

  return (
    <div className="container mx-auto max-w-7xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing & Subscription</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your subscription, view usage, and upgrade your plan
          </p>
        </div>
      </div>

      {/* Usage Statistics */}
      <section className="mb-12">
        <UsageChart
          aiAnalyses={{
            current: usageStats?.aiAnalysesCount ?? 0,
            limit: currentPlanLimits.aiAnalysesPerMonth,
          }}
          projects={{
            current: usageStats?.projectsCount ?? 0,
            limit: currentPlanLimits.projects,
          }}
          teamMembers={{
            current: usageStats?.teamMembersCount ?? 0,
            limit: currentPlanLimits.teamMembers,
          }}
        />
      </section>

      {/* Payment Method */}
      <section className="mb-12">
        <PaymentMethod />
      </section>

      {/* Invoice History */}
      <section className="mb-12">
        <InvoiceList />
      </section>

      {/* Plan Comparison Cards */}
      <section className="mb-12">
        <h2 className="mb-6 text-xl font-semibold">Choose Your Plan</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {freePlan && (
            <PlanCard
              tier="free"
              limits={freePlan.limits}
              currentPlan={currentPlan as 'free' | 'pro' | 'enterprise'}
            />
          )}
          {proPlan && (
            <PlanCard
              tier="pro"
              limits={proPlan.limits}
              currentPlan={currentPlan as 'free' | 'pro' | 'enterprise'}
              popular
            />
          )}
          {enterprisePlan && (
            <PlanCard
              tier="enterprise"
              limits={enterprisePlan.limits}
              currentPlan={currentPlan as 'free' | 'pro' | 'enterprise'}
            />
          )}
        </div>
      </section>

      {/* Upgrade Prompt Modal (hidden by default) */}
      <UpgradePrompt
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        limitType="aiAnalyses"
        currentUsage={usageStats?.aiAnalysesCount ?? 0}
        limitValue={currentPlanLimits.aiAnalysesPerMonth}
      />
    </div>
  );
}
