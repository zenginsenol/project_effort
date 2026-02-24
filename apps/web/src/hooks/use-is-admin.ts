'use client';

import { useCurrentRole } from './use-current-role';

export function useIsAdmin(): boolean {
  const role = useCurrentRole();
  return role === 'owner' || role === 'admin';
}
