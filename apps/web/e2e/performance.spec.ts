import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';

test.describe('Performance with 20 Concurrent Participants', () => {
  const SESSION_ID = '11111111-1111-1111-1111-111111111111';
  const NUM_PARTICIPANTS = 20;
  const MAX_LATENCY_MS = 500;

  test('20 concurrent participants can submit votes without degradation', async ({ browser }) => {
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];

    try {
      // Create 20 concurrent participants
      console.log(`Creating ${NUM_PARTICIPANTS} concurrent participants...`);
      for (let i = 0; i < NUM_PARTICIPANTS; i++) {
        const context = await browser.newContext();
        contexts.push(context);

        const page = await context.newPage();
        pages.push(page);

        // Navigate to the session
        await page.goto(`/dashboard/sessions/${SESSION_ID}`);
      }

      // Wait for all pages to load
      console.log('Waiting for all pages to load...');
      await Promise.all(
        pages.map(page =>
          expect(page.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 15000 })
        )
      );

      // Wait for all socket connections to establish
      console.log('Waiting for socket connections to establish...');
      await Promise.all(pages.map(page => page.waitForTimeout(3000)));

      // Set up event listeners on all participants to track vote submissions
      console.log('Setting up event listeners on all participants...');
      await Promise.all(
        pages.map((page, index) =>
          page.evaluate((participantIndex) => {
            (window as any).voteEvents = [];
            (window as any).participantIndex = participantIndex;
            const socket = (window as any).socket;
            if (socket) {
              socket.on('vote-submitted', (data: any) => {
                (window as any).voteEvents.push({
                  event: 'vote-submitted',
                  receivedAt: Date.now(),
                  data,
                });
              });
            }
          }, index)
        )
      );

      // Wait for listeners to be registered
      await Promise.all(pages.map(page => page.waitForTimeout(500)));

      // Record timestamp before first vote
      const voteStartTime = Date.now();

      // Submit votes from all participants in parallel
      console.log('Submitting votes from all participants...');
      const voteValues = ['1', '2', '3', '5', '8'];
      await Promise.all(
        pages.map(async (page, index) => {
          const voteValue = voteValues[index % voteValues.length];
          const voteButton = page.getByRole('button', { name: voteValue }).first();
          if (await voteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await voteButton.click();
          }
        })
      );

      // Wait for all events to propagate
      console.log('Waiting for events to propagate...');
      await Promise.all(pages.map(page => page.waitForTimeout(2000)));

      const voteEndTime = Date.now();
      const totalVoteTime = voteEndTime - voteStartTime;

      console.log(`Total time for all votes to propagate: ${totalVoteTime}ms`);

      // Collect event data from all participants
      const allEventData = await Promise.all(
        pages.map(page =>
          page.evaluate(() => {
            return {
              participantIndex: (window as any).participantIndex,
              events: (window as any).voteEvents || [],
            };
          })
        )
      );

      // Verify that each participant received vote events
      let totalEventsReceived = 0;
      let maxLatency = 0;
      let minLatency = Infinity;
      let totalLatency = 0;
      let latencyMeasurements = 0;

      allEventData.forEach((participantData, index) => {
        const eventsReceived = participantData.events.length;
        totalEventsReceived += eventsReceived;

        console.log(`Participant ${index} received ${eventsReceived} vote events`);

        // Calculate latencies for this participant
        participantData.events.forEach((event: any) => {
          const latency = event.receivedAt - voteStartTime;
          if (latency > 0) {
            maxLatency = Math.max(maxLatency, latency);
            minLatency = Math.min(minLatency, latency);
            totalLatency += latency;
            latencyMeasurements++;
          }
        });
      });

      const avgLatency = latencyMeasurements > 0 ? totalLatency / latencyMeasurements : 0;

      console.log(`\nPerformance metrics:`);
      console.log(`- Total events received across all participants: ${totalEventsReceived}`);
      console.log(`- Min latency: ${minLatency}ms`);
      console.log(`- Avg latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`- Max latency: ${maxLatency}ms`);

      // Verify performance criteria
      // Each participant should receive events from other participants
      // Expect at least some vote events to be received by each participant
      const participantsWithEvents = allEventData.filter(p => p.events.length > 0).length;
      console.log(`Participants that received at least one event: ${participantsWithEvents}/${NUM_PARTICIPANTS}`);

      // Verify that events were received
      expect(totalEventsReceived).toBeGreaterThan(0);

      // Verify max latency is within acceptable range
      expect(maxLatency).toBeLessThan(MAX_LATENCY_MS);

      // Verify that most participants received events (at least 80%)
      expect(participantsWithEvents).toBeGreaterThan(NUM_PARTICIPANTS * 0.8);

    } finally {
      // Clean up all contexts and pages
      console.log('Cleaning up...');
      await Promise.all(pages.map(page => page.close()));
      await Promise.all(contexts.map(context => context.close()));
    }
  });

  test('20 concurrent participants can reveal votes without degradation', async ({ browser }) => {
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];

    try {
      // Create 20 concurrent participants
      console.log(`Creating ${NUM_PARTICIPANTS} concurrent participants for reveal test...`);
      for (let i = 0; i < NUM_PARTICIPANTS; i++) {
        const context = await browser.newContext();
        contexts.push(context);

        const page = await context.newPage();
        pages.push(page);

        await page.goto(`/dashboard/sessions/${SESSION_ID}`);
      }

      // Wait for all pages to load
      console.log('Waiting for all pages to load...');
      await Promise.all(
        pages.map(page =>
          expect(page.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 15000 })
        )
      );

      // Wait for socket connections
      await Promise.all(pages.map(page => page.waitForTimeout(3000)));

      // Set up event listeners for votes-revealed
      await Promise.all(
        pages.map((page, index) =>
          page.evaluate((participantIndex) => {
            (window as any).revealEvents = [];
            (window as any).participantIndex = participantIndex;
            const socket = (window as any).socket;
            if (socket) {
              socket.on('votes-revealed', (data: any) => {
                (window as any).revealEvents.push({
                  event: 'votes-revealed',
                  receivedAt: Date.now(),
                  data,
                });
              });
            }
          }, index)
        )
      );

      await Promise.all(pages.map(page => page.waitForTimeout(500)));

      // Try to reveal votes from one participant
      const revealTime = Date.now();
      const revealButton = pages[0].getByRole('button', { name: 'Reveal Votes' });
      if (await revealButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('Revealing votes...');
        await revealButton.click();

        // Wait for event propagation
        await Promise.all(pages.map(page => page.waitForTimeout(2000)));

        // Collect reveal event data
        const allRevealData = await Promise.all(
          pages.map(page =>
            page.evaluate(() => {
              return {
                participantIndex: (window as any).participantIndex,
                events: (window as any).revealEvents || [],
              };
            })
          )
        );

        let participantsWithReveal = 0;
        let maxRevealLatency = 0;

        allRevealData.forEach((participantData, index) => {
          if (participantData.events.length > 0) {
            participantsWithReveal++;
            const latency = participantData.events[0].receivedAt - revealTime;
            maxRevealLatency = Math.max(maxRevealLatency, latency);
            console.log(`Participant ${index} received reveal event with latency: ${latency}ms`);
          }
        });

        console.log(`\nReveal performance:`);
        console.log(`- Participants that received reveal event: ${participantsWithReveal}/${NUM_PARTICIPANTS}`);
        console.log(`- Max reveal latency: ${maxRevealLatency}ms`);

        // Verify that reveal was received by most participants
        expect(participantsWithReveal).toBeGreaterThan(NUM_PARTICIPANTS * 0.8);
        expect(maxRevealLatency).toBeLessThan(MAX_LATENCY_MS);
      }

    } finally {
      console.log('Cleaning up...');
      await Promise.all(pages.map(page => page.close()));
      await Promise.all(contexts.map(context => context.close()));
    }
  });

  test('20 concurrent participants maintain stable connections', async ({ browser }) => {
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];

    try {
      // Create 20 concurrent participants
      console.log(`Creating ${NUM_PARTICIPANTS} concurrent participants for connection stability test...`);
      for (let i = 0; i < NUM_PARTICIPANTS; i++) {
        const context = await browser.newContext();
        contexts.push(context);

        const page = await context.newPage();
        pages.push(page);

        await page.goto(`/dashboard/sessions/${SESSION_ID}`);
      }

      // Wait for all pages to load
      await Promise.all(
        pages.map(page =>
          expect(page.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 15000 })
        )
      );

      // Wait for socket connections
      await Promise.all(pages.map(page => page.waitForTimeout(3000)));

      // Check connection status for all participants
      const connectionStatuses = await Promise.all(
        pages.map(page =>
          page.evaluate(() => {
            const socket = (window as any).socket;
            return {
              connected: socket?.connected || false,
              id: socket?.id || null,
            };
          })
        )
      );

      const connectedCount = connectionStatuses.filter(status => status.connected).length;
      console.log(`Connected participants: ${connectedCount}/${NUM_PARTICIPANTS}`);

      // Verify that all or most participants are connected
      expect(connectedCount).toBeGreaterThan(NUM_PARTICIPANTS * 0.9);

      // Wait for 5 seconds to ensure connections remain stable
      console.log('Testing connection stability over 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Re-check connection status
      const finalConnectionStatuses = await Promise.all(
        pages.map(page =>
          page.evaluate(() => {
            const socket = (window as any).socket;
            return {
              connected: socket?.connected || false,
              id: socket?.id || null,
            };
          })
        )
      );

      const finalConnectedCount = finalConnectionStatuses.filter(status => status.connected).length;
      console.log(`Still connected participants after 5s: ${finalConnectedCount}/${NUM_PARTICIPANTS}`);

      // Verify connections remained stable
      expect(finalConnectedCount).toBeGreaterThan(NUM_PARTICIPANTS * 0.9);

    } finally {
      console.log('Cleaning up...');
      await Promise.all(pages.map(page => page.close()));
      await Promise.all(contexts.map(context => context.close()));
    }
  });

  test('20 concurrent participants can all join and receive participant-joined events', async ({ browser }) => {
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];

    try {
      // Create first participant to listen for join events
      console.log('Creating first participant to monitor join events...');
      const firstContext = await browser.newContext();
      contexts.push(firstContext);
      const firstPage = await firstContext.newPage();
      pages.push(firstPage);

      await firstPage.goto(`/dashboard/sessions/${SESSION_ID}`);
      await expect(firstPage.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 15000 });
      await firstPage.waitForTimeout(2000);

      // Set up listener on first participant
      await firstPage.evaluate(() => {
        (window as any).joinEvents = [];
        const socket = (window as any).socket;
        if (socket) {
          socket.on('participant-joined', (data: any) => {
            (window as any).joinEvents.push({
              event: 'participant-joined',
              receivedAt: Date.now(),
              data,
            });
          });
        }
      });

      await firstPage.waitForTimeout(500);

      // Record start time
      const joinStartTime = Date.now();

      // Create remaining 19 participants
      console.log(`Creating ${NUM_PARTICIPANTS - 1} additional participants...`);
      for (let i = 1; i < NUM_PARTICIPANTS; i++) {
        const context = await browser.newContext();
        contexts.push(context);

        const page = await context.newPage();
        pages.push(page);

        await page.goto(`/dashboard/sessions/${SESSION_ID}`);
      }

      // Wait for all new pages to load
      await Promise.all(
        pages.slice(1).map(page =>
          expect(page.getByRole('heading', { name: 'Session' })).toBeVisible({ timeout: 15000 })
        )
      );

      // Wait for join events to propagate
      await firstPage.waitForTimeout(3000);

      const joinEndTime = Date.now();
      const totalJoinTime = joinEndTime - joinStartTime;

      // Get join events from first participant
      const joinEventData = await firstPage.evaluate(() => {
        return (window as any).joinEvents || [];
      });

      console.log(`\nJoin event performance:`);
      console.log(`- Total time for all joins: ${totalJoinTime}ms`);
      console.log(`- Join events received by first participant: ${joinEventData.length}`);

      // Calculate latencies
      if (joinEventData.length > 0) {
        const latencies = joinEventData.map((event: any) => event.receivedAt - joinStartTime);
        const maxJoinLatency = Math.max(...latencies);
        const avgJoinLatency = latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length;

        console.log(`- Max join latency: ${maxJoinLatency}ms`);
        console.log(`- Avg join latency: ${avgJoinLatency.toFixed(2)}ms`);

        // Verify join latencies are acceptable
        expect(maxJoinLatency).toBeLessThan(MAX_LATENCY_MS * 2); // Allow 2x for joins due to volume
      }

      // Verify that at least some join events were received
      expect(joinEventData.length).toBeGreaterThan(0);

    } finally {
      console.log('Cleaning up...');
      await Promise.all(pages.map(page => page.close()));
      await Promise.all(contexts.map(context => context.close()));
    }
  });
});
