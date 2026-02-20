import { afterEach, describe, expect, it, vi } from 'vitest';

import { CallbackSessionStore } from '../callback-session-store';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CallbackSessionStore', () => {
  it('keeps concurrent states isolated', () => {
    const store = new CallbackSessionStore<string>();
    const onTimeout = vi.fn();

    store.register('state-a', 'handler-a', 1000, onTimeout);
    store.register('state-b', 'handler-b', 1000, onTimeout);

    expect(store.size()).toBe(2);
    expect(store.take('state-a')).toBe('handler-a');
    expect(store.take('state-b')).toBe('handler-b');
    expect(store.size()).toBe(0);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('replaces previous handler when the same state is registered again', () => {
    const store = new CallbackSessionStore<string>();
    const onTimeout = vi.fn();

    store.register('state-a', 'first-handler', 1000, onTimeout);
    store.register('state-a', 'second-handler', 1000, onTimeout);

    expect(store.size()).toBe(1);
    expect(store.take('state-a')).toBe('second-handler');
    expect(store.size()).toBe(0);
  });

  it('fires timeout callback and removes abandoned sessions', async () => {
    const store = new CallbackSessionStore<string>();
    const onTimeout = vi.fn();

    store.register('state-timeout', 'handler-timeout', 20, onTimeout);
    await sleep(50);

    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(onTimeout).toHaveBeenCalledWith({
      state: 'state-timeout',
      handler: 'handler-timeout',
    });
    expect(store.size()).toBe(0);
    expect(store.take('state-timeout')).toBeNull();
  });

  it('clearAll cancels pending timeouts', async () => {
    const store = new CallbackSessionStore<string>();
    const onTimeout = vi.fn();

    store.register('state-a', 'handler-a', 20, onTimeout);
    store.register('state-b', 'handler-b', 20, onTimeout);
    store.clearAll();

    await sleep(50);
    expect(store.size()).toBe(0);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
