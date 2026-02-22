'use client';

import { useState } from 'react';

import { PlanCard } from '@/components/billing/plan-card';
import { UsageChart } from '@/components/billing/usage-chart';
import { PaymentMethod } from '@/components/billing/payment-method';
import { InvoiceList } from '@/components/billing/invoice-list';
import { UpgradePrompt } from '@/components/billing/upgrade-prompt';

// Plan limits from billing service
const PLAN_DATA = {
  free: {
    limits: {
      projects: 2,
      teamMembers: 5,
      estimationSessions: 10,
      aiAnalysesPerMonth: 10,
      exportFormats: ['json'],
    },
  },
  pro: {
    limits: {
      projects: 50,
      teamMembers: 50,
      estimationSessions: 500,
      aiAnalysesPerMonth: 500,
      exportFormats: ['json', 'csv', 'pdf'],
    },
  },
  enterprise: {
    limits: {
      projects: -1,
      teamMembers: -1,
      estimationSessions: -1,
      aiAnalysesPerMonth: -1,
      exportFormats: ['json', 'csv', 'pdf', 'excel'],
    },
  },
} as const;

export default function BillingPage(): React.ReactElement {
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  return (
    <div className="container mx-auto max-w-7xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing & Subscription</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your subscription, view usage, and upgrade your plan
          </p>
        </div>
        {/* Test button for upgrade modal */}
        <button
          onClick={() => setIsUpgradeModalOpen(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Test Upgrade Modal
        </button>
      </div>

      {/* Usage Statistics */}
      <section className="mb-12">
        <UsageChart
          aiAnalyses={{ current: 3, limit: PLAN_DATA.free.limits.aiAnalysesPerMonth }}
          projects={{ current: 1, limit: PLAN_DATA.free.limits.projects }}
          teamMembers={{ current: 2, limit: PLAN_DATA.free.limits.teamMembers }}
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
          <PlanCard
            tier="free"
            limits={PLAN_DATA.free.limits}
            currentPlan="free"
          />
          <PlanCard
            tier="pro"
            limits={PLAN_DATA.pro.limits}
            popular
          />
          <PlanCard
            tier="enterprise"
            limits={PLAN_DATA.enterprise.limits}
          />
        </div>
      </section>

      {/* Upgrade Prompt Modal */}
      <UpgradePrompt
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        limitType="aiAnalyses"
        currentUsage={10}
        limitValue={10}
      />
    </div>
  );
}
