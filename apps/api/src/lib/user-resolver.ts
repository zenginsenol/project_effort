import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

import { db } from '@estimate-pro/db';
import { users } from '@estimate-pro/db/schema';

/**
 * Resolves a Clerk user ID to the internal DB user UUID.
 * Throws UNAUTHORIZED if the user is not found in the database.
 */
export async function resolveDbUserId(clerkId: string): Promise<string> {
  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
    columns: { id: true },
  });
  if (!user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User not found' });
  }
  return user.id;
}
