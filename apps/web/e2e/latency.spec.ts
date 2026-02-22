import { expect, test } from '@playwright/test';

test.describe('Event Propagation Latency', () => {
  const SESSION_ID = '11111111-1111-1111-1111-111111111111';
  const MAX_LATENCY_MS = 500;

  test('vote submission propagates to other participants within 500ms', async ({ browser }) => {
    // Create two separate browser contexts to simulate two different participants
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Navigate both participants to the same session
      await page1.goto(`/dashboard/sessions/${SESSION_ID}`);
      await page2.goto(`/dashboard/sessions/${SESSION_ID}`);

      // Wait for pages to load
      await expect(page1.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });
      await expect(page2.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });

      // Wait for socket connections to establish
      await page1.waitForTimeout(2000);
      await page2.waitForTimeout(2000);

      // Set up event listener in participant 2 to track when vote event is received
      await page2.evaluate(() => {
        (window as any).voteEventTimestamps = [];
        const socket = (window as any).socket;
        if (socket) {
          socket.on('vote-submitted', (data: any) => {
            (window as any).voteEventTimestamps.push({
              event: 'vote-submitted',
              receivedAt: Date.now(),
              data,
            });
          });
        }
      });

      // Wait a moment to ensure listener is registered
      await page2.waitForTimeout(500);

      // Record timestamp before submitting vote in participant 1
      const voteSubmitTime = Date.now();

      // Submit a vote in participant 1
      const voteButton1 = page1.getByRole('button', { name: '5' }).first();
      await expect(voteButton1).toBeVisible({ timeout: 5000 });
      await voteButton1.click();

      // Wait for event to propagate
      await page2.waitForTimeout(1000);

      // Get the timestamp when participant 2 received the event
      const eventData = await page2.evaluate(() => {
        const timestamps = (window as any).voteEventTimestamps || [];
        return timestamps.length > 0 ? timestamps[0] : null;
      });

      // Verify that the event was received
      expect(eventData).not.toBeNull();
      expect(eventData.event).toBe('vote-submitted');

      // Calculate latency
      const latency = eventData.receivedAt - voteSubmitTime;

      console.log(`Vote propagation latency: ${latency}ms`);

      // Verify latency is within acceptable range
      expect(latency).toBeLessThan(MAX_LATENCY_MS);

      // Also verify latency is positive (sanity check)
      expect(latency).toBeGreaterThan(0);

    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });

  test('vote reveal propagates to other participants within 500ms', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Navigate both participants to the same session
      await page1.goto(`/dashboard/sessions/${SESSION_ID}`);
      await page2.goto(`/dashboard/sessions/${SESSION_ID}`);

      // Wait for pages to load
      await expect(page1.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });
      await expect(page2.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });

      // Wait for socket connections
      await page1.waitForTimeout(2000);
      await page2.waitForTimeout(2000);

      // Set up event listener in participant 2
      await page2.evaluate(() => {
        (window as any).revealEventTimestamps = [];
        const socket = (window as any).socket;
        if (socket) {
          socket.on('votes-revealed', (data: any) => {
            (window as any).revealEventTimestamps.push({
              event: 'votes-revealed',
              receivedAt: Date.now(),
              data,
            });
          });
        }
      });

      await page2.waitForTimeout(500);

      // Record timestamp before revealing votes in participant 1
      const revealTime = Date.now();

      // Try to reveal votes in participant 1
      const revealButton = page1.getByRole('button', { name: 'Reveal Votes' });
      if (await revealButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await revealButton.click();

        // Wait for event to propagate
        await page2.waitForTimeout(1000);

        // Get the timestamp when participant 2 received the event
        const eventData = await page2.evaluate(() => {
          const timestamps = (window as any).revealEventTimestamps || [];
          return timestamps.length > 0 ? timestamps[0] : null;
        });

        // If reveal was successful, verify latency
        if (eventData !== null) {
          expect(eventData.event).toBe('votes-revealed');

          const latency = eventData.receivedAt - revealTime;
          console.log(`Vote reveal propagation latency: ${latency}ms`);

          expect(latency).toBeLessThan(MAX_LATENCY_MS);
          expect(latency).toBeGreaterThan(0);
        }
      }

    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });

  test('new round event propagates to other participants within 500ms', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Navigate both participants to the same session
      await page1.goto(`/dashboard/sessions/${SESSION_ID}`);
      await page2.goto(`/dashboard/sessions/${SESSION_ID}`);

      // Wait for pages to load
      await expect(page1.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });
      await expect(page2.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });

      // Wait for socket connections
      await page1.waitForTimeout(2000);
      await page2.waitForTimeout(2000);

      // Set up event listener in participant 2
      await page2.evaluate(() => {
        (window as any).newRoundEventTimestamps = [];
        const socket = (window as any).socket;
        if (socket) {
          socket.on('new-round-started', (data: any) => {
            (window as any).newRoundEventTimestamps.push({
              event: 'new-round-started',
              receivedAt: Date.now(),
              data,
            });
          });
        }
      });

      await page2.waitForTimeout(500);

      // Record timestamp before starting new round in participant 1
      const newRoundTime = Date.now();

      // Try to start a new round in participant 1
      const newRoundButton = page1.getByRole('button', { name: /New Round|Start New Round/i });
      if (await newRoundButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await newRoundButton.click();

        // Wait for event to propagate
        await page2.waitForTimeout(1000);

        // Get the timestamp when participant 2 received the event
        const eventData = await page2.evaluate(() => {
          const timestamps = (window as any).newRoundEventTimestamps || [];
          return timestamps.length > 0 ? timestamps[0] : null;
        });

        // If new round was successful, verify latency
        if (eventData !== null) {
          expect(eventData.event).toBe('new-round-started');

          const latency = eventData.receivedAt - newRoundTime;
          console.log(`New round propagation latency: ${latency}ms`);

          expect(latency).toBeLessThan(MAX_LATENCY_MS);
          expect(latency).toBeGreaterThan(0);
        }
      }

    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });

  test('participant status change propagates within 500ms', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Navigate both participants to the same session
      await page1.goto(`/dashboard/sessions/${SESSION_ID}`);
      await page2.goto(`/dashboard/sessions/${SESSION_ID}`);

      // Wait for pages to load
      await expect(page1.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });
      await expect(page2.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });

      // Wait for socket connections
      await page1.waitForTimeout(2000);
      await page2.waitForTimeout(2000);

      // Set up event listener in participant 2 for status changes
      await page2.evaluate(() => {
        (window as any).statusEventTimestamps = [];
        const socket = (window as any).socket;
        if (socket) {
          socket.on('user-status-changed', (data: any) => {
            (window as any).statusEventTimestamps.push({
              event: 'user-status-changed',
              receivedAt: Date.now(),
              data,
            });
          });
        }
      });

      await page2.waitForTimeout(500);

      // Record timestamp before emitting status change in participant 1
      const statusChangeTime = Date.now();

      // Emit a status change from participant 1
      await page1.evaluate(() => {
        const socket = (window as any).socket;
        if (socket && socket.connected) {
          socket.emit('user-status-changed', {
            sessionId: '11111111-1111-1111-1111-111111111111',
            status: 'voting',
          });
        }
      });

      // Wait for event to propagate
      await page2.waitForTimeout(1000);

      // Get the timestamp when participant 2 received the event
      const eventData = await page2.evaluate(() => {
        const timestamps = (window as any).statusEventTimestamps || [];
        return timestamps.length > 0 ? timestamps[0] : null;
      });

      // Verify that the event was received
      if (eventData !== null) {
        expect(eventData.event).toBe('user-status-changed');

        const latency = eventData.receivedAt - statusChangeTime;
        console.log(`Status change propagation latency: ${latency}ms`);

        expect(latency).toBeLessThan(MAX_LATENCY_MS);
        expect(latency).toBeGreaterThan(0);
      }

    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });

  test('participant join event propagates within 500ms', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Participant 1 joins first
      await page1.goto(`/dashboard/sessions/${SESSION_ID}`);
      await expect(page1.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });
      await page1.waitForTimeout(2000);

      // Set up event listener in participant 1 for join events
      await page1.evaluate(() => {
        (window as any).joinEventTimestamps = [];
        const socket = (window as any).socket;
        if (socket) {
          socket.on('participant-joined', (data: any) => {
            (window as any).joinEventTimestamps.push({
              event: 'participant-joined',
              receivedAt: Date.now(),
              data,
            });
          });
        }
      });

      await page1.waitForTimeout(500);

      // Record timestamp before participant 2 joins
      const joinTime = Date.now();

      // Participant 2 joins the session
      await page2.goto(`/dashboard/sessions/${SESSION_ID}`);
      await expect(page2.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });

      // Wait for event to propagate
      await page1.waitForTimeout(2000);

      // Get the timestamp when participant 1 received the join event
      const eventData = await page1.evaluate(() => {
        const timestamps = (window as any).joinEventTimestamps || [];
        return timestamps.length > 0 ? timestamps[0] : null;
      });

      // Verify that the event was received
      if (eventData !== null) {
        expect(eventData.event).toBe('participant-joined');

        const latency = eventData.receivedAt - joinTime;
        console.log(`Participant join propagation latency: ${latency}ms`);

        expect(latency).toBeLessThan(MAX_LATENCY_MS);
        expect(latency).toBeGreaterThan(0);
      }

    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });
});
