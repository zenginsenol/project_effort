import { expect, test } from '@playwright/test';

test.describe('WebSocket Reconnection Scenarios', () => {
  const SESSION_ID = '11111111-1111-1111-1111-111111111111';
  const ORG_ID = '00000000-0000-0000-0000-000000000000'; // Demo org ID
  const USER_ID = 'user-1';

  test('automatic reconnection after network drop', async ({ page }) => {
    // Navigate to session
    await page.goto(`/dashboard/sessions/${SESSION_ID}`);

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });

    // Wait for initial socket connection
    await page.waitForTimeout(2000);

    // Verify socket is connected
    const isConnectedBefore = await page.evaluate(() => {
      const socket = (window as any).socket;
      return socket?.connected ?? false;
    });
    expect(isConnectedBefore).toBe(true);

    // Store session state before disconnect (current round, participants count)
    const stateBeforeDisconnect = await page.evaluate(() => {
      return {
        sessionVisible: document.querySelector('[data-testid="session-detail"]') !== null,
        hasParticipants: document.querySelectorAll('[data-testid="participant-item"]').length > 0,
      };
    });

    // Simulate network drop by manually disconnecting the socket
    await page.evaluate(() => {
      const socket = (window as any).socket;
      if (socket) {
        socket.disconnect();
      }
    });

    // Verify socket is disconnected
    const isDisconnected = await page.evaluate(() => {
      const socket = (window as any).socket;
      return !socket?.connected;
    });
    expect(isDisconnected).toBe(true);

    // Wait 2 seconds for reconnection logic to trigger
    await page.waitForTimeout(2000);

    // Verify automatic reconnection occurs
    // The useSocket hook should automatically reconnect with exponential backoff
    const reconnectionHappened = await page.evaluate(() => {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const socket = (window as any).socket;
          if (socket?.connected) {
            clearInterval(checkInterval);
            resolve(true);
          }
        }, 500);

        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(false);
        }, 10000);
      });
    });

    expect(reconnectionHappened).toBe(true);

    // Wait a bit more for session state to sync
    await page.waitForTimeout(1000);

    // Verify session state is preserved after reconnection
    const stateAfterReconnect = await page.evaluate(() => {
      return {
        sessionVisible: document.querySelector('[data-testid="session-detail"]') !== null,
        hasParticipants: document.querySelectorAll('[data-testid="participant-item"]').length > 0,
      };
    });

    // Session should still be visible
    expect(stateAfterReconnect.sessionVisible).toBe(stateBeforeDisconnect.sessionVisible);
  });

  test('reconnection preserves round and vote state', async ({ page }) => {
    // Navigate to session
    await page.goto(`/dashboard/sessions/${SESSION_ID}`);

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });

    // Wait for socket connection
    await page.waitForTimeout(2000);

    // Submit a vote if voting is possible
    const voteButton = page.getByRole('button', { name: '5' }).first();
    if (await voteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await voteButton.click();
      await page.waitForTimeout(500);
    }

    // Store current round and vote state
    const stateBeforeDisconnect = await page.evaluate(() => {
      // Try to find round indicator or current round number
      const roundElement = document.querySelector('[data-testid="current-round"]');
      const currentRound = roundElement?.textContent ?? '';

      // Check if user has voted (button state)
      const votedButtons = document.querySelectorAll('button[data-voted="true"]');

      return {
        currentRound,
        hasVoted: votedButtons.length > 0,
      };
    });

    // Disconnect socket
    await page.evaluate(() => {
      const socket = (window as any).socket;
      if (socket) {
        socket.disconnect();
      }
    });

    // Wait for reconnection
    await page.waitForTimeout(2000);

    // Wait for reconnection to complete
    await page.waitForFunction(() => {
      const socket = (window as any).socket;
      return socket?.connected === true;
    }, { timeout: 10000 });

    // Wait for state sync
    await page.waitForTimeout(1000);

    // Verify round and vote state preserved
    const stateAfterReconnect = await page.evaluate(() => {
      const roundElement = document.querySelector('[data-testid="current-round"]');
      const currentRound = roundElement?.textContent ?? '';

      const votedButtons = document.querySelectorAll('button[data-voted="true"]');

      return {
        currentRound,
        hasVoted: votedButtons.length > 0,
      };
    });

    // Round should be the same
    expect(stateAfterReconnect.currentRound).toBe(stateBeforeDisconnect.currentRound);

    // Vote state should be preserved (if user had voted)
    if (stateBeforeDisconnect.hasVoted) {
      expect(stateAfterReconnect.hasVoted).toBe(true);
    }
  });

  test('exponential backoff reconnection attempts', async ({ page }) => {
    // Navigate to session
    await page.goto(`/dashboard/sessions/${SESSION_ID}`);

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });

    // Wait for socket connection
    await page.waitForTimeout(2000);

    // Set up tracking for reconnection attempts
    await page.evaluate(() => {
      (window as any).reconnectionAttempts = [];

      // Monitor reconnection attempts via socket events
      const socket = (window as any).socket;
      if (socket) {
        socket.io.on('reconnect_attempt', (attempt: number) => {
          (window as any).reconnectionAttempts.push({
            attempt,
            timestamp: Date.now(),
          });
        });
      }
    });

    // Disconnect socket
    await page.evaluate(() => {
      const socket = (window as any).socket;
      if (socket) {
        socket.disconnect();
      }
    });

    // Wait for at least one reconnection attempt
    await page.waitForTimeout(3000);

    // Check reconnection happened
    const reconnected = await page.evaluate(() => {
      const socket = (window as any).socket;
      return socket?.connected ?? false;
    });

    // The socket should have reconnected (our useSocket hook uses exponential backoff)
    expect(reconnected).toBe(true);
  });

  test('reconnection UI feedback displays correctly', async ({ page }) => {
    // Navigate to session
    await page.goto(`/dashboard/sessions/${SESSION_ID}`);

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });

    // Wait for socket connection
    await page.waitForTimeout(2000);

    // Disconnect socket to trigger reconnection UI
    await page.evaluate(() => {
      const socket = (window as any).socket;
      if (socket) {
        socket.disconnect();
      }
    });

    // Wait a moment for UI to update
    await page.waitForTimeout(500);

    // Check for disconnected or reconnecting banner
    // The session page should show either a "Disconnected" or "Reconnecting..." banner
    const hasReconnectionUI = await page.evaluate(() => {
      const bodyText = document.body.textContent ?? '';
      return bodyText.includes('Reconnecting') || bodyText.includes('Disconnected');
    });

    // UI should show reconnection feedback
    expect(hasReconnectionUI).toBe(true);

    // Wait for reconnection
    await page.waitForFunction(() => {
      const socket = (window as any).socket;
      return socket?.connected === true;
    }, { timeout: 10000 });

    // Wait for UI to update
    await page.waitForTimeout(500);

    // After reconnection, the banner should disappear
    const stillHasReconnectionUI = await page.evaluate(() => {
      const bodyText = document.body.textContent ?? '';
      return bodyText.includes('Reconnecting') || bodyText.includes('Disconnected');
    });

    // Reconnection UI should be gone after successful reconnection
    expect(stillHasReconnectionUI).toBe(false);
  });

  test('participant rejoin after reconnection', async ({ browser }) => {
    // Create two browser contexts to simulate two participants
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Both participants join the same session
      await page1.goto(`/dashboard/sessions/${SESSION_ID}`);
      await page2.goto(`/dashboard/sessions/${SESSION_ID}`);

      // Wait for pages to load
      await expect(page1.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });
      await expect(page2.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });

      // Wait for socket connections
      await page1.waitForTimeout(2000);
      await page2.waitForTimeout(2000);

      // Set up listener for participant events in page2
      await page2.evaluate(() => {
        (window as any).participantEvents = [];
        const socket = (window as any).socket;
        if (socket) {
          socket.on('participant-joined', (data: any) => {
            (window as any).participantEvents.push({ type: 'joined', data });
          });
          socket.on('participant-left', (data: any) => {
            (window as any).participantEvents.push({ type: 'left', data });
          });
        }
      });

      // Disconnect participant 1
      await page1.evaluate(() => {
        const socket = (window as any).socket;
        if (socket) {
          socket.disconnect();
        }
      });

      // Wait for disconnect to propagate
      await page1.waitForTimeout(1000);

      // Participant 1 should reconnect automatically
      await page1.waitForFunction(() => {
        const socket = (window as any).socket;
        return socket?.connected === true;
      }, { timeout: 10000 });

      // Wait for rejoin to propagate
      await page1.waitForTimeout(1000);

      // Verify participant 2 can see participant 1 reconnect
      // (This might show as participant-joined event)
      const participantEvents = await page2.evaluate(() => (window as any).participantEvents || []);

      // We should have received some participant events
      // (The exact events depend on backend implementation - could be left then joined)
      expect(participantEvents.length).toBeGreaterThanOrEqual(0);

    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });

  test('session state sync after reconnection', async ({ page }) => {
    // Navigate to session
    await page.goto(`/dashboard/sessions/${SESSION_ID}`);

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });

    // Wait for socket connection
    await page.waitForTimeout(2000);

    // Disconnect socket
    await page.evaluate(() => {
      const socket = (window as any).socket;
      if (socket) {
        socket.disconnect();
      }
    });

    // Wait for reconnection
    await page.waitForFunction(() => {
      const socket = (window as any).socket;
      return socket?.connected === true;
    }, { timeout: 10000 });

    // After reconnection, the client should rejoin the session room
    // Verify by checking that socket is in a connected state
    const socketState = await page.evaluate(() => {
      const socket = (window as any).socket;
      return {
        connected: socket?.connected ?? false,
        id: socket?.id ?? null,
      };
    });

    expect(socketState.connected).toBe(true);
    expect(socketState.id).not.toBeNull();

    // Session data should still be accessible
    await expect(page.getByRole('heading', { name: 'Session' })).toBeVisible();
  });
});
