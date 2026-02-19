/**
 * In-memory store for OAuth PKCE flow state
 * Maps state -> { codeVerifier, userId, createdAt }
 * Entries expire after 10 minutes
 */

interface OAuthPendingFlow {
  codeVerifier: string;
  userId: string; // clerkId or demo user
  redirectUri: string;
  createdAt: number;
}

const pendingFlows = new Map<string, OAuthPendingFlow>();

// Cleanup expired flows every 5 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  const tenMinutes = 10 * 60 * 1000;
  for (const [state, flow] of pendingFlows.entries()) {
    if (now - flow.createdAt > tenMinutes) {
      pendingFlows.delete(state);
    }
  }
}, 5 * 60 * 1000);
cleanupTimer.unref();

export function storePendingFlow(state: string, flow: Omit<OAuthPendingFlow, 'createdAt'>): void {
  pendingFlows.set(state, { ...flow, createdAt: Date.now() });
}

export function getPendingFlow(state: string): OAuthPendingFlow | undefined {
  return pendingFlows.get(state);
}

export function removePendingFlow(state: string): void {
  pendingFlows.delete(state);
}
