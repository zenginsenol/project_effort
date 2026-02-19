'use client';

import { createTRPCReact, httpBatchLink } from '@trpc/react-query';
import superjson from 'superjson';

import type { AppRouter } from '@estimate-pro/api/routers';

export const trpc = createTRPCReact<AppRouter>();

export function getTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: 'http://localhost:4000/trpc',
        transformer: superjson,
      }),
    ],
  });
}
