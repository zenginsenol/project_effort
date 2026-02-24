'use client';

import { trpc } from '@/lib/trpc';

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer';

export function useCurrentRole(): OrgRole {
  const meQuery = trpc.team.me.useQuery();
  return (meQuery.data?.role as OrgRole) ?? 'member';
}
