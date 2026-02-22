'use client';

import { Check, Sparkles, Building2, Zap } from 'lucide-react';

import { cn } from '@/lib/utils';

type PlanTier = 'free' | 'pro' | 'enterprise';

interface PlanLimits {
  projects: number;
  teamMembers: number;
  estimationSessions: number;
  aiAnalysesPerMonth: number;
  exportFormats: string[];
}

interface PlanCardProps {
  tier: PlanTier;
  limits: PlanLimits;
  currentPlan?: PlanTier;
  price?: string;
  onSelect?: () => void;
  loading?: boolean;
  popular?: boolean;
}

const PLAN_METADATA = {
  free: {
    name: 'Free',
    description: 'Perfect for individuals and small teams getting started',
    icon: Zap,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    price: '$0',
  },
  pro: {
    name: 'Pro',
    description: 'For growing teams with advanced estimation needs',
    icon: Sparkles,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    price: '$49',
  },
  enterprise: {
    name: 'Enterprise',
    description: 'Unlimited power for large organizations',
    icon: Building2,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    price: '$299',
  },
} as const;

export function PlanCard({
  tier,
  limits,
  currentPlan,
  price,
  onSelect,
  loading = false,
  popular = false,
}: PlanCardProps): React.ReactElement {
  const metadata = PLAN_METADATA[tier];
  const Icon = metadata.icon;
  const isCurrentPlan = currentPlan === tier;
  const displayPrice = price ?? metadata.price;

  const formatLimit = (value: number): string => {
    if (value === -1) return 'Unlimited';
    return value.toLocaleString();
  };

  const features = [
    { label: 'Projects', value: formatLimit(limits.projects) },
    { label: 'Team Members', value: formatLimit(limits.teamMembers) },
    { label: 'Estimation Sessions', value: formatLimit(limits.estimationSessions) },
    { label: 'AI Analyses/Month', value: formatLimit(limits.aiAnalysesPerMonth) },
    { label: 'Export Formats', value: limits.exportFormats.join(', ').toUpperCase() },
  ];

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-lg border-2 bg-card p-6 transition-all hover:shadow-lg',
        isCurrentPlan
          ? `${metadata.borderColor} ring-2 ring-offset-2 ${metadata.color.replace('text-', 'ring-')}`
          : 'border-border hover:border-primary/50',
        popular && !isCurrentPlan && 'border-primary',
      )}
    >
      {/* Popular Badge */}
      {popular && !isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
            Most Popular
          </span>
        </div>
      )}

      {/* Current Plan Badge */}
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className={cn('rounded-full px-3 py-1 text-xs font-semibold text-white', metadata.bgColor.replace('bg-', 'bg-').replace('-50', '-600'))}>
            Current Plan
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-lg', metadata.bgColor)}>
          <Icon className={cn('h-6 w-6', metadata.color)} />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold">{metadata.name}</h3>
          <p className="text-xs text-muted-foreground">{metadata.description}</p>
        </div>
      </div>

      {/* Pricing */}
      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold">{displayPrice}</span>
          {tier !== 'free' && <span className="text-muted-foreground">/month</span>}
        </div>
        {tier === 'free' && (
          <p className="mt-1 text-sm text-muted-foreground">Forever free</p>
        )}
      </div>

      {/* Features List */}
      <div className="mb-6 flex-1 space-y-3">
        {features.map((feature) => (
          <div key={feature.label} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            <div className="flex-1 text-sm">
              <span className="font-medium">{feature.label}:</span>{' '}
              <span className="text-muted-foreground">{feature.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Action Button */}
      {onSelect && (
        <button
          onClick={onSelect}
          disabled={isCurrentPlan || loading}
          className={cn(
            'w-full rounded-md px-4 py-2.5 text-sm font-semibold transition-colors',
            isCurrentPlan
              ? 'cursor-not-allowed bg-muted text-muted-foreground'
              : popular
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border-2 border-border bg-background hover:bg-muted',
            loading && 'opacity-50',
          )}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Loading...
            </span>
          ) : isCurrentPlan ? (
            'Current Plan'
          ) : tier === 'enterprise' ? (
            'Contact Sales'
          ) : (
            `Upgrade to ${metadata.name}`
          )}
        </button>
      )}
    </div>
  );
}
