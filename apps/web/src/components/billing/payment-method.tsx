'use client';

import { useState } from 'react';
import { CreditCard, ExternalLink, Loader2, AlertCircle } from 'lucide-react';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

interface PaymentMethodProps {
  className?: string;
}

export function PaymentMethod({ className }: PaymentMethodProps): React.ReactElement {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { data: subscription, isLoading } = trpc.billing.getCurrentSubscription.useQuery();
  const createPortalSession = trpc.billing.createPortalSession.useMutation({
    onSuccess: (data) => {
      // Redirect to Stripe Customer Portal
      window.location.href = data.url;
    },
    onError: (error) => {
      setIsRedirecting(false);
      console.error('Failed to open Customer Portal:', error);
    },
  });

  const handleManagePayment = (): void => {
    setIsRedirecting(true);
    createPortalSession.mutate({
      returnUrl: `${window.location.origin}/dashboard/billing`,
    });
  };

  if (isLoading) {
    return (
      <div className={cn('rounded-lg border bg-card p-6', className)}>
        <h2 className="mb-4 text-lg font-semibold">Payment Method</h2>
        <div className="space-y-4">
          <div className="h-16 w-full animate-pulse rounded bg-muted" />
          <div className="h-10 w-32 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  const hasActiveSubscription = subscription && subscription.plan !== 'free';
  const subscriptionStatus = subscription?.status ?? null;

  return (
    <div className={cn('rounded-lg border bg-card p-6', className)}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Payment Method</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your billing information and payment methods
          </p>
        </div>
        <CreditCard className="h-6 w-6 text-muted-foreground" />
      </div>

      {/* Payment Method Display */}
      {hasActiveSubscription ? (
        <div className="mb-6 rounded-md border bg-muted/50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Payment method configured</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Subscription status:{' '}
                <span className={cn(
                  'font-medium capitalize',
                  subscriptionStatus === 'active' && 'text-green-600',
                  subscriptionStatus === 'past_due' && 'text-red-600',
                  subscriptionStatus === 'canceled' && 'text-gray-600',
                )}>
                  {subscriptionStatus ?? 'Unknown'}
                </span>
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-md border bg-muted/50 p-4">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-blue-500/20 p-0.5">
              <div className="h-full w-full rounded-full bg-blue-500" />
            </div>
            <div className="flex-1 text-sm">
              <p className="font-medium">You're on the Free plan</p>
              <p className="mt-1 text-muted-foreground">
                No payment method required. Upgrade to Pro or Enterprise to unlock more features.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stripe Customer Portal Button */}
      <button
        onClick={handleManagePayment}
        disabled={isRedirecting || createPortalSession.isPending}
        className={cn(
          'inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors',
          'border-2 border-border bg-background hover:bg-muted',
          (isRedirecting || createPortalSession.isPending) && 'cursor-not-allowed opacity-50',
        )}
      >
        {isRedirecting || createPortalSession.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening Portal...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            Manage Payment Methods
            <ExternalLink className="h-3.5 w-3.5" />
          </>
        )}
      </button>

      {/* Info Text */}
      <div className="mt-6 rounded-md bg-muted/30 p-4">
        <p className="text-xs text-muted-foreground">
          The Customer Portal allows you to update payment methods, view billing history,
          download invoices, and manage your subscription. You'll be securely redirected to
          Stripe's portal.
        </p>
      </div>

      {/* Error Display */}
      {createPortalSession.isError && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="flex-1">
              <p className="font-medium text-red-900">Failed to open Customer Portal</p>
              <p className="mt-1 text-sm text-red-700">
                {createPortalSession.error.message ?? 'Please try again or contact support.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
