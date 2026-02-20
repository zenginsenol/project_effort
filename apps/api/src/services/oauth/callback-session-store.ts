export type SessionTimeoutCallback<THandler> = (params: {
  state: string;
  handler: THandler;
}) => void;

interface SessionEntry<THandler> {
  handler: THandler;
  timeout: NodeJS.Timeout;
}

/**
 * State-scoped callback session store used by OAuth local callback flows.
 * Keeps each OAuth state isolated to avoid cross-request races.
 */
export class CallbackSessionStore<THandler> {
  private readonly sessions = new Map<string, SessionEntry<THandler>>();

  register(
    state: string,
    handler: THandler,
    timeoutMs: number,
    onTimeout: SessionTimeoutCallback<THandler>,
  ): void {
    this.remove(state);

    const timeout = setTimeout(() => {
      const entry = this.sessions.get(state);
      if (!entry) {
        return;
      }

      this.sessions.delete(state);
      onTimeout({ state, handler: entry.handler });
    }, timeoutMs);

    timeout.unref?.();

    this.sessions.set(state, {
      handler,
      timeout,
    });
  }

  take(state: string): THandler | null {
    const entry = this.sessions.get(state);
    if (!entry) {
      return null;
    }

    clearTimeout(entry.timeout);
    this.sessions.delete(state);
    return entry.handler;
  }

  remove(state: string): boolean {
    const entry = this.sessions.get(state);
    if (!entry) {
      return false;
    }

    clearTimeout(entry.timeout);
    this.sessions.delete(state);
    return true;
  }

  size(): number {
    return this.sessions.size;
  }

  clearAll(): void {
    for (const entry of this.sessions.values()) {
      clearTimeout(entry.timeout);
    }
    this.sessions.clear();
  }
}
