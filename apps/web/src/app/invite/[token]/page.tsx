'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckCircle, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@estimate-pro/ui';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

export default function InviteAcceptPage(): React.ReactElement {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Query to get invitation details
  const invitationQuery = trpc.invitation.getByToken.useQuery(
    { token },
    {
      retry: false,
      enabled: Boolean(token),
    }
  );

  // Mutation to accept invitation
  const acceptMutation = trpc.invitation.accept.useMutation({
    onSuccess: () => {
      setAccepted(true);
      setError(null);
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleAccept = () => {
    if (!token) return;
    setError(null);
    acceptMutation.mutate({ token });
  };

  // Loading state
  if (invitationQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-lg">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading invitation...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state - invalid or expired invitation
  if (invitationQuery.error || !invitationQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-card p-8 shadow-lg">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold">Invalid Invitation</h1>
            <p className="text-sm text-muted-foreground">
              {invitationQuery.error?.message || 'This invitation link is invalid or has expired.'}
            </p>
            <Button onClick={() => router.push('/')} variant="outline" className="mt-4">
              Go to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const invitation = invitationQuery.data;

  // Check if already accepted
  if (invitation.status === 'accepted') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <div className="w-full max-w-md rounded-xl border border-green-200 bg-card p-8 shadow-lg">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold">Already Accepted</h1>
            <p className="text-sm text-muted-foreground">
              This invitation has already been accepted.
            </p>
            <Button onClick={() => router.push('/dashboard')} className="mt-4">
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Success state - after accepting
  if (accepted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <div className="w-full max-w-md rounded-xl border border-green-200 bg-card p-8 shadow-lg">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold">Invitation Accepted!</h1>
            <p className="text-sm text-muted-foreground">
              You have successfully joined{' '}
              <span className="font-semibold text-foreground">
                {invitation.organization?.name || 'the organization'}
              </span>
              .
            </p>
            <p className="text-xs text-muted-foreground">Redirecting to dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // Main invitation accept screen
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-lg">
        {/* Header */}
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="rounded-full bg-primary/10 p-3">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Team Invitation</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;ve been invited to join a team on EstimatePro
            </p>
          </div>
        </div>

        {/* Invitation Details */}
        <div className="mt-6 space-y-4 rounded-lg border bg-muted/50 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Organization
            </p>
            <p className="mt-1 text-lg font-semibold">
              {invitation.organization?.name || 'Organization'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Role
            </p>
            <p className="mt-1 flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                  invitation.role === 'admin'
                    ? 'border-purple-300 bg-purple-100 text-purple-700'
                    : invitation.role === 'member'
                      ? 'border-blue-300 bg-blue-100 text-blue-700'
                      : 'border-gray-300 bg-gray-100 text-gray-700'
                )}
              >
                {invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)}
              </span>
            </p>
          </div>
          {invitation.inviter && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Invited By
              </p>
              <p className="mt-1 text-sm">
                {[invitation.inviter.firstName, invitation.inviter.lastName]
                  .filter(Boolean)
                  .join(' ') || invitation.inviter.email}
              </p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 space-y-3">
          <Button
            onClick={handleAccept}
            disabled={acceptMutation.isPending}
            className="w-full"
          >
            {acceptMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Accepting...
              </>
            ) : (
              'Accept Invitation'
            )}
          </Button>
          <Button onClick={() => router.push('/')} variant="outline" className="w-full">
            Decline
          </Button>
        </div>

        {/* Expiration Notice */}
        {invitation.expiresAt && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            This invitation expires on{' '}
            {new Date(invitation.expiresAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}
