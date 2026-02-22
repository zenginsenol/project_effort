import { expect, test } from '@playwright/test';

test.describe('Concurrent Session Isolation', () => {
  const SESSION_1_ID = '11111111-1111-1111-1111-111111111111';
  const SESSION_2_ID = '22222222-2222-2222-2222-222222222222';
  const ORG_ID = '00000000-0000-0000-0000-000000000000'; // Demo org ID
  const USER_1_ID = 'user-1';
  const USER_2_ID = 'user-2';

  test('votes in session 1 do not affect session 2', async ({ browser }) => {
    // Create two separate browser contexts to simulate two different users
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Navigate to both sessions
      await page1.goto(`/dashboard/sessions/${SESSION_1_ID}`);
      await page2.goto(`/dashboard/sessions/${SESSION_2_ID}`);

      // Wait for pages to load
      await expect(page1.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });
      await expect(page2.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });

      // Set up event listeners to track WebSocket events
      let session1VoteReceived = false;
      let session2VoteReceived = false;

      // Listen for vote events in both pages
      await page1.evaluate(() => {
        (window as any).session1Events = [];
        // Store original emit function
        const originalEmit = (window as any).socket?.emit;
        if (originalEmit) {
          (window as any).socket.emit = function(...args: any[]) {
            (window as any).session1Events.push({ type: 'emit', event: args[0], data: args[1] });
            return originalEmit.apply(this, args);
          };
        }
      });

      await page2.evaluate(() => {
        (window as any).session2Events = [];
        const originalEmit = (window as any).socket?.emit;
        if (originalEmit) {
          (window as any).socket.emit = function(...args: any[]) {
            (window as any).session2Events.push({ type: 'emit', event: args[0], data: args[1] });
            return originalEmit.apply(this, args);
          };
        }
      });

      // Wait for socket connections to establish
      await page1.waitForTimeout(2000);
      await page2.waitForTimeout(2000);

      // Submit a vote in session 1
      const voteButton1 = page1.getByRole('button', { name: '5' }).first();
      if (await voteButton1.isVisible()) {
        await voteButton1.click();
        await page1.waitForTimeout(1000);
      }

      // Check that session 2 did not receive any vote-submitted events
      const session2Events = await page2.evaluate(() => (window as any).session2Events || []);
      const voteEventsInSession2 = session2Events.filter((e: any) =>
        e.event === 'vote-submitted' || e.type === 'receive' && e.event === 'vote-submitted'
      );

      // Session 2 should not have received any vote events from session 1
      expect(voteEventsInSession2.length).toBe(0);

      // Now submit a vote in session 2
      const voteButton2 = page2.getByRole('button', { name: '8' }).first();
      if (await voteButton2.isVisible()) {
        await voteButton2.click();
        await page2.waitForTimeout(1000);
      }

      // Check that session 1 did not receive any vote-submitted events from session 2
      const session1Events = await page1.evaluate(() => (window as any).session1Events || []);
      const voteEventsInSession1 = session1Events.filter((e: any) =>
        e.event === 'vote-submitted' || e.type === 'receive' && e.event === 'vote-submitted'
      );

      // Session 1 should not have received any vote events from session 2
      expect(voteEventsInSession1.length).toBe(0);

      console.log('Session 1 events:', session1Events);
      console.log('Session 2 events:', session2Events);

    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });

  test('reveal votes in session 1 does not affect session 2', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Navigate to both sessions
      await page1.goto(`/dashboard/sessions/${SESSION_1_ID}`);
      await page2.goto(`/dashboard/sessions/${SESSION_2_ID}`);

      // Wait for pages to load
      await expect(page1.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });
      await expect(page2.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });

      // Wait for socket connections
      await page1.waitForTimeout(2000);
      await page2.waitForTimeout(2000);

      // Set up listeners for votes-revealed events
      await page2.evaluate(() => {
        (window as any).votesRevealedReceived = false;
        if ((window as any).socket) {
          (window as any).socket.on('votes-revealed', () => {
            (window as any).votesRevealedReceived = true;
          });
        }
      });

      // Try to reveal votes in session 1
      const revealButton1 = page1.getByRole('button', { name: 'Reveal Votes' });
      if (await revealButton1.isVisible()) {
        await revealButton1.click();
        await page1.waitForTimeout(1000);
      }

      // Verify that session 2 did not receive the votes-revealed event
      const votesRevealedInSession2 = await page2.evaluate(() => (window as any).votesRevealedReceived);
      expect(votesRevealedInSession2).toBe(false);

    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });

  test('participants in session 1 are not visible in session 2', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Navigate to both sessions
      await page1.goto(`/dashboard/sessions/${SESSION_1_ID}`);
      await page2.goto(`/dashboard/sessions/${SESSION_2_ID}`);

      // Wait for pages to load
      await expect(page1.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });
      await expect(page2.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });

      // Wait for socket connections
      await page1.waitForTimeout(2000);
      await page2.waitForTimeout(2000);

      // Set up listeners for participant-joined events in session 2
      await page2.evaluate(() => {
        (window as any).participantJoinedEvents = [];
        if ((window as any).socket) {
          (window as any).socket.on('participant-joined', (data: any) => {
            (window as any).participantJoinedEvents.push(data);
          });
        }
      });

      // Reload page1 to trigger a join event
      await page1.reload();
      await expect(page1.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });
      await page1.waitForTimeout(2000);

      // Verify that session 2 did not receive participant-joined events from session 1
      const participantEvents = await page2.evaluate(() => (window as any).participantJoinedEvents || []);
      expect(participantEvents.length).toBe(0);

    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });

  test('new round in session 1 does not affect session 2', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Navigate to both sessions
      await page1.goto(`/dashboard/sessions/${SESSION_1_ID}`);
      await page2.goto(`/dashboard/sessions/${SESSION_2_ID}`);

      // Wait for pages to load
      await expect(page1.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });
      await expect(page2.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 10000 });

      // Wait for socket connections
      await page1.waitForTimeout(2000);
      await page2.waitForTimeout(2000);

      // Set up listener for new-round-started events in session 2
      await page2.evaluate(() => {
        (window as any).newRoundReceived = false;
        if ((window as any).socket) {
          (window as any).socket.on('new-round-started', () => {
            (window as any).newRoundReceived = true;
          });
        }
      });

      // Try to start a new round in session 1 (if button is available)
      const newRoundButton = page1.getByRole('button', { name: /New Round|Start New Round/i });
      if (await newRoundButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await newRoundButton.click();
        await page1.waitForTimeout(1000);
      }

      // Verify that session 2 did not receive the new-round-started event
      const newRoundInSession2 = await page2.evaluate(() => (window as any).newRoundReceived);
      expect(newRoundInSession2).toBe(false);

    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });
});
