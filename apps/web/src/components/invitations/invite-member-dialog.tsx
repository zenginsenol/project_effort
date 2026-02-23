'use client';

import { useState } from 'react';
import { X, Mail, UserPlus } from 'lucide-react';
import { Button, Input, Label } from '@estimate-pro/ui';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

type Role = 'admin' | 'member' | 'viewer';

export function InviteMemberDialog(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const orgsQuery = trpc.organization.list.useQuery(undefined, { retry: false });
  const organizationId = orgsQuery.data?.[0]?.id ?? '';

  const createInvitationMutation = trpc.invitation.create.useMutation({
    onSuccess: () => {
      setSuccess('Invitation sent successfully!');
      setEmail('');
      setRole('member');
      setTimeout(() => {
        setSuccess(null);
        setIsOpen(false);
      }, 2000);
    },
    onError: (err) => {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!organizationId) {
      setError('Organization not found');
      return;
    }

    createInvitationMutation.mutate({
      organizationId,
      email: email.trim(),
      role,
    });
  };

  const handleClose = () => {
    if (!createInvitationMutation.isPending) {
      setIsOpen(false);
      setEmail('');
      setRole('member');
      setError(null);
      setSuccess(null);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <Button onClick={() => setIsOpen(true)} className="gap-2">
        <UserPlus className="h-4 w-4" />
        Invite Member
      </Button>

      {/* Dialog Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={handleClose}
        >
          {/* Dialog Content */}
          <div
            className="relative w-full max-w-md rounded-lg border bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Invite Team Member</h2>
              </div>
              <button
                onClick={handleClose}
                disabled={createInvitationMutation.isPending}
                className="rounded-md p-1 hover:bg-accent disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Input */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={createInvitationMutation.isPending}
                  required
                />
              </div>

              {/* Role Select */}
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  disabled={createInvitationMutation.isPending}
                  className={cn(
                    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  <option value="member">Member - Can participate in estimations</option>
                  <option value="admin">Admin - Can manage organization settings</option>
                  <option value="viewer">Viewer - Read-only access</option>
                </select>
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  {success}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={createInvitationMutation.isPending || !email.trim()}
                  className="flex-1"
                >
                  {createInvitationMutation.isPending ? 'Sending...' : 'Send Invitation'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={createInvitationMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
