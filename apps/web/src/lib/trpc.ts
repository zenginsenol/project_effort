'use client';

import { createTRPCReact, httpBatchLink } from '@trpc/react-query';
import superjson from 'superjson';

import { getApiUrl } from '@/lib/api-url';

import type { AppRouter } from '@estimate-pro/api/routers';

export const trpc = createTRPCReact<AppRouter>();

export function getTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: getApiUrl('/trpc'),
        transformer: superjson,
      }),
    ],
  });
}
