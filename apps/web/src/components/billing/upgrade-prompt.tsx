'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Building2, AlertCircle, Loader2, Check } from 'lucide-react';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

type PlanTier = 'free' | 'pro' | 'enterprise';
type LimitType = 'projects' | 'teamMembers' | 'aiAnalyses' | 'estimationSessions';

interface UpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
  limitType?: LimitType;
  currentUsage?: number;
  limitValue?: number;
  title?: string;
  message?: string;
}

const LIMIT_LABELS: Record<LimitType, string> = {
  projects: 'Projects',
  teamMembers: 'Team Members',
  aiAnalyses: 'AI Analyses',
  estimationSessions: 'Estimation Sessions',
};

const PLAN_INFO = {
  pro: {
    name: 'Pro',
    icon: Sparkles,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    price: '$49',
    description: 'Perfect for growing teams',
  },
  enterprise: {
    name: 'Enterprise',
    icon: Building2,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    price: '$299',
    description: 'Unlimited power for large organizations',
  },
} as const;

export function UpgradePrompt({
  isOpen,
  onClose,
  limitType,
  currentUsage,
  limitValue,
  title = 'Upgrade Required',
  message,
}: UpgradePromptProps): React.ReactElement | null {
  const [mounted, setMounted] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>('pro');

  const { data: currentSubscription } = trpc.billing.getCurrentSubscription.useQuery();
  const { data: allPlans } = trpc.billing.getAllPlans.useQuery();
  const createCheckoutSession = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    },
    onError: (error) => {
      console.error('Failed to create checkout session:', error);
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleUpgrade = (): void => {
    if (selectedPlan === 'enterprise') {
      // For enterprise, open contact/sales page
      window.open('mailto:sales@estimatepro.com?subject=Enterprise Plan Inquiry', '_blank');
      return;
    }

    createCheckoutSession.mutate({
      plan: selectedPlan,
      successUrl: `${window.location.origin}/dashboard/billing?success=true`,
      cancelUrl: `${window.location.origin}/dashboard/billing?canceled=true`,
    });
  };

  if (!mounted || !isOpen) return null;

  const currentPlan = currentSubscription?.plan ?? 'free';
  const limitLabel = limitType ? LIMIT_LABELS[limitType] : '';

  const defaultMessage = limitType && currentUsage !== undefined && limitValue !== undefined
    ? `You've reached your ${limitLabel.toLowerCase()} limit (${currentUsage}/${limitValue}). Upgrade to continue.`
    : 'Unlock more features and higher limits by upgrading your plan.';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg border bg-card shadow-2xl m-4">
        {/* Header */}
        <div className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur-sm px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {message ?? defaultMessage}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-2 hover:bg-muted transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Current Usage Banner (if limit info provided) */}
        {limitType && currentUsage !== undefined && limitValue !== undefined && (
          <div className="mx-6 mt-4 rounded-md border border-orange-200 bg-orange-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
              <div className="flex-1">
                <p className="font-medium text-orange-900">Limit Reached</p>
                <p className="mt-1 text-sm text-orange-700">
                  You're currently using <strong>{currentUsage}</strong> out of{' '}
                  <strong>{limitValue}</strong> {limitLabel.toLowerCase()} on the{' '}
                  <strong className="capitalize">{currentPlan}</strong> plan.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Plan Comparison */}
        <div className="p-6">
          <h3 className="mb-4 text-lg font-semibold">Choose Your Plan</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Pro Plan */}
            <button
              onClick={() => setSelectedPlan('pro')}
              className={cn(
                'relative flex flex-col rounded-lg border-2 bg-card p-6 text-left transition-all hover:shadow-lg',
                selectedPlan === 'pro'
                  ? `${PLAN_INFO.pro.borderColor} ring-2 ring-purple-500 ring-offset-2`
                  : 'border-border hover:border-primary/50',
                currentPlan === 'pro' && 'opacity-60',
              )}
              disabled={currentPlan === 'pro'}
            >
              {selectedPlan === 'pro' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-purple-600 px-3 py-1 text-xs font-semibold text-white">
                    Selected
                  </span>
                </div>
              )}

              {currentPlan === 'pro' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                    Current Plan
                  </span>
                </div>
              )}

              <div className="mb-4 flex items-center gap-3">
                <div className={cn('flex h-12 w-12 items-center justify-center rounded-lg', PLAN_INFO.pro.bgColor)}>
                  <Sparkles className={cn('h-6 w-6', PLAN_INFO.pro.color)} />
                </div>
                <div className="flex-1">
                  <h4 className="text-xl font-bold">{PLAN_INFO.pro.name}</h4>
                  <p className="text-xs text-muted-foreground">{PLAN_INFO.pro.description}</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{PLAN_INFO.pro.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>

              {allPlans && allPlans[1] && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span className="text-sm">
                      <strong>{allPlans[1].limits.projects === -1 ? 'Unlimited' : allPlans[1].limits.projects}</strong> Projects
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span className="text-sm">
                      <strong>{allPlans[1].limits.teamMembers === -1 ? 'Unlimited' : allPlans[1].limits.teamMembers}</strong> Team Members
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span className="text-sm">
                      <strong>{allPlans[1].limits.aiAnalysesPerMonth === -1 ? 'Unlimited' : allPlans[1].limits.aiAnalysesPerMonth}</strong> AI Analyses/Month
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span className="text-sm">
                      All export formats
                    </span>
                  </div>
                </div>
              )}
            </button>

            {/* Enterprise Plan */}
            <button
              onClick={() => setSelectedPlan('enterprise')}
              className={cn(
                'relative flex flex-col rounded-lg border-2 bg-card p-6 text-left transition-all hover:shadow-lg',
                selectedPlan === 'enterprise'
                  ? `${PLAN_INFO.enterprise.borderColor} ring-2 ring-orange-500 ring-offset-2`
                  : 'border-border hover:border-primary/50',
                currentPlan === 'enterprise' && 'opacity-60',
              )}
              disabled={currentPlan === 'enterprise'}
            >
              {selectedPlan === 'enterprise' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-orange-600 px-3 py-1 text-xs font-semibold text-white">
                    Selected
                  </span>
                </div>
              )}

              {currentPlan === 'enterprise' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                    Current Plan
                  </span>
                </div>
              )}

              <div className="mb-4 flex items-center gap-3">
                <div className={cn('flex h-12 w-12 items-center justify-center rounded-lg', PLAN_INFO.enterprise.bgColor)}>
                  <Building2 className={cn('h-6 w-6', PLAN_INFO.enterprise.color)} />
                </div>
                <div className="flex-1">
                  <h4 className="text-xl font-bold">{PLAN_INFO.enterprise.name}</h4>
                  <p className="text-xs text-muted-foreground">{PLAN_INFO.enterprise.description}</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{PLAN_INFO.enterprise.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>

              {allPlans && allPlans[2] && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span className="text-sm">
                      <strong>Unlimited</strong> Projects
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span className="text-sm">
                      <strong>Unlimited</strong> Team Members
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span className="text-sm">
                      <strong>Unlimited</strong> AI Analyses
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span className="text-sm">
                      Priority support & dedicated account manager
                    </span>
                  </div>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-20 border-t bg-card/95 backdrop-blur-sm px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={onClose}
              className="rounded-md border-2 border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors"
            >
              Maybe Later
            </button>
            <button
              onClick={handleUpgrade}
              disabled={createCheckoutSession.isPending || currentPlan === selectedPlan}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-6 py-2.5 text-sm font-semibold transition-colors',
                selectedPlan === 'pro'
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-orange-600 text-white hover:bg-orange-700',
                (createCheckoutSession.isPending || currentPlan === selectedPlan) && 'cursor-not-allowed opacity-50',
              )}
            >
              {createCheckoutSession.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecting...
                </>
              ) : selectedPlan === 'enterprise' ? (
                'Contact Sales'
              ) : (
                `Upgrade to ${PLAN_INFO[selectedPlan].name}`
              )}
            </button>
          </div>

          {/* Error Display */}
          {createCheckoutSession.isError && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <p className="text-sm text-red-700">
                  {createCheckoutSession.error.message ?? 'Failed to start checkout. Please try again.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
