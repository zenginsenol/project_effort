'use client';

import { useState } from 'react';
import { Clock, Mail, RotateCw, Trash2, User } from 'lucide-react';
import { Button } from '@estimate-pro/ui';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

export function PendingInvitationsList(): React.ReactElement {
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const orgsQuery = trpc.organization.list.useQuery(undefined, { retry: false });
  const organizationId = orgsQuery.data?.[0]?.id ?? '';

  const invitationsQuery = trpc.invitation.list.useQuery(
    { organizationId },
    {
      enabled: !!organizationId,
      retry: false,
    },
  );

  const resendMutation = trpc.invitation.resend.useMutation({
    onSuccess: () => {
      setSuccess('Invitation resent successfully!');
      setResendingId(null);
      setTimeout(() => setSuccess(null), 3000);
      void invitationsQuery.refetch();
    },
    onError: (err) => {
      setError(err.message);
      setResendingId(null);
      setTimeout(() => setError(null), 5000);
    },
  });

  const cancelMutation = trpc.invitation.cancel.useMutation({
    onSuccess: () => {
      setSuccess('Invitation cancelled successfully!');
      setCancellingId(null);
      setTimeout(() => setSuccess(null), 3000);
      void invitationsQuery.refetch();
    },
    onError: (err) => {
      setError(err.message);
      setCancellingId(null);
      setTimeout(() => setError(null), 5000);
    },
  });

  const handleResend = (invitationId: string) => {
    setError(null);
    setSuccess(null);
    setResendingId(invitationId);
    resendMutation.mutate({ invitationId });
  };

  const handleCancel = (invitationId: string) => {
    setError(null);
    setSuccess(null);
    setCancellingId(invitationId);
    cancelMutation.mutate({ invitationId });
  };

  const getStatusBadge = (status: InvitationStatus) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      accepted: 'bg-green-100 text-green-700 border-green-200',
      expired: 'bg-gray-100 text-gray-700 border-gray-200',
      cancelled: 'bg-red-100 text-red-700 border-red-200',
    };

    const labels = {
      pending: 'Pending',
      accepted: 'Accepted',
      expired: 'Expired',
      cancelled: 'Cancelled',
    };

    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
          badges[status],
        )}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', {
          'bg-yellow-500': status === 'pending',
          'bg-green-500': status === 'accepted',
          'bg-gray-400': status === 'expired',
          'bg-red-500': status === 'cancelled',
        })} />
        {labels[status]}
      </span>
    );
  };

  const getRoleBadge = (role: string) => {
    const roleLabels = {
      admin: 'Admin',
      member: 'Member',
      viewer: 'Viewer',
    };

    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium">
        <User className="h-3 w-3" />
        {roleLabels[role as keyof typeof roleLabels] || role}
      </span>
    );
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isExpired = (expiresAt: Date) => {
    return new Date(expiresAt) < new Date();
  };

  if (!organizationId) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold">Pending Invitations</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Organization context not available.
        </p>
      </div>
    );
  }

  if (invitationsQuery.isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold">Pending Invitations</h3>
        <div className="mt-4 flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  const invitations = invitationsQuery.data ?? [];
  const pendingInvitations = invitations.filter((inv) => inv.status === 'pending');

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Pending Invitations</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage pending team invitations
          </p>
        </div>
        {pendingInvitations.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700">
            {pendingInvitations.length} pending
          </span>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Invitations List */}
      <div className="mt-4 space-y-3">
        {invitations.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center">
            <Mail className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h4 className="mt-2 text-sm font-medium">No invitations yet</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Invite team members to get started
            </p>
          </div>
        ) : (
          invitations.map((invitation) => {
            const expired = isExpired(invitation.expiresAt);
            const isPending = invitation.status === 'pending';
            const isResending = resendingId === invitation.id;
            const isCancelling = cancellingId === invitation.id;

            return (
              <div
                key={invitation.id}
                className={cn(
                  'rounded-lg border p-4 transition-all',
                  isPending && !expired
                    ? 'border-yellow-200 bg-yellow-50/50'
                    : 'border-border bg-background',
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left Section: Email & Role */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium truncate">{invitation.email}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {getRoleBadge(invitation.role)}
                      {getStatusBadge(invitation.status as InvitationStatus)}
                      {expired && isPending && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                          <Clock className="h-3 w-3" />
                          Expired
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Invited {formatDate(invitation.createdAt)}</span>
                      {isPending && (
                        <span>
                          Expires {formatDate(invitation.expiresAt)}
                        </span>
                      )}
                      {invitation.inviter && (
                        <span>
                          by {invitation.inviter.firstName || invitation.inviter.email}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Section: Actions */}
                  {isPending && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResend(invitation.id)}
                        disabled={isResending || isCancelling}
                        className="gap-1"
                      >
                        <RotateCw className={cn('h-3 w-3', isResending && 'animate-spin')} />
                        {isResending ? 'Resending...' : 'Resend'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancel(invitation.id)}
                        disabled={isResending || isCancelling}
                        className="gap-1 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" />
                        {isCancelling ? 'Cancelling...' : 'Cancel'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
