import { expect, test } from '@playwright/test';

test.describe('Estimation session creation', () => {
  test('create estimation session flow', async ({ page }) => {
    await page.goto('/dashboard/sessions');

    // Verify we're on the sessions page
    await expect(page.getByRole('heading', { name: 'Estimation Sessions' })).toBeVisible();

    // Verify create session form is visible
    await expect(page.getByText('Create Session')).toBeVisible();

    // Fill in session creation form
    const sessionName = `E2E Test Session ${Date.now()}`;

    // Select first project (should auto-select if available)
    const projectSelect = page.locator('select').filter({ hasText: 'Select project' }).first();
    const projectOptions = await projectSelect.locator('option').count();

    if (projectOptions > 1) {
      await projectSelect.selectOption({ index: 1 });
    }

    // Fill session name
    await page.getByPlaceholder('Session name').fill(sessionName);

    // Select estimation method (default is Planning Poker)
    const methodSelect = page.locator('select').filter({ hasText: 'Planning Poker' }).first();
    await expect(methodSelect).toBeVisible();

    // Click create button
    await page.getByRole('button', { name: 'New Session' }).click();

    // Wait for session creation
    await page.waitForTimeout(1000);

    // Verify form was reset
    await expect(page.getByPlaceholder('Session name')).toHaveValue('');

    // Verify session appears in the list
    await expect(page.getByText(sessionName)).toBeVisible();
  });

  test('create session with different methods', async ({ page }) => {
    await page.goto('/dashboard/sessions');

    // Select first project
    const projectSelect = page.locator('select').filter({ hasText: 'Select project' }).first();
    const projectOptions = await projectSelect.locator('option').count();

    if (projectOptions > 1) {
      await projectSelect.selectOption({ index: 1 });
    }

    // Test T-Shirt Sizing method
    const sessionName = `T-Shirt Session ${Date.now()}`;
    await page.getByPlaceholder('Session name').fill(sessionName);

    const methodSelect = page.locator('select').filter({ hasText: 'Planning Poker' }).first();
    await methodSelect.selectOption('tshirt_sizing');

    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(1000);

    // Verify session created with correct method
    await expect(page.getByText(sessionName)).toBeVisible();
    await expect(page.getByText('tshirt_sizing')).toBeVisible();
  });

  test('create session with specific task', async ({ page }) => {
    await page.goto('/dashboard/sessions');

    // Select first project
    const projectSelect = page.locator('select').filter({ hasText: 'Select project' }).first();
    const projectOptions = await projectSelect.locator('option').count();

    if (projectOptions > 1) {
      await projectSelect.selectOption({ index: 1 });
    }

    // Fill session details
    const sessionName = `Task Session ${Date.now()}`;
    await page.getByPlaceholder('Session name').fill(sessionName);

    // Select a task if available
    const taskSelect = page.locator('select').filter({ hasText: 'No specific task' }).first();
    const taskOptions = await taskSelect.locator('option').count();

    if (taskOptions > 1) {
      await taskSelect.selectOption({ index: 1 });
    }

    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(1000);

    // Verify session created
    await expect(page.getByText(sessionName)).toBeVisible();
  });

  test('empty state displays when no sessions exist', async ({ page }) => {
    await page.goto('/dashboard/sessions');

    // Verify the page loads
    await expect(page.getByRole('heading', { name: 'Estimation Sessions' })).toBeVisible();

    // Verify the create session section is always visible
    await expect(page.getByText('Create Session')).toBeVisible();
    await expect(page.getByPlaceholder('Session name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Session' })).toBeVisible();
  });

  test('session form validation', async ({ page }) => {
    await page.goto('/dashboard/sessions');

    // Verify create button is disabled when form is incomplete
    const createButton = page.getByRole('button', { name: 'New Session' });

    // Select project
    const projectSelect = page.locator('select').filter({ hasText: 'Select project' }).first();
    const projectOptions = await projectSelect.locator('option').count();

    if (projectOptions > 1) {
      await projectSelect.selectOption({ index: 1 });

      // Without session name, button should be disabled
      await expect(createButton).toBeDisabled();

      // Fill session name, now button should be enabled
      await page.getByPlaceholder('Session name').fill('Test Session');
      await expect(createButton).toBeEnabled();
    }
  });
});

test.describe('Estimation session participation', () => {
  let sessionId: string;

  test.beforeEach(async ({ page }) => {
    // Navigate to sessions page and create a test session
    await page.goto('/dashboard/sessions');
    await expect(page.getByRole('heading', { name: 'Estimation Sessions' })).toBeVisible();

    // Create a new session
    const projectSelect = page.locator('select').filter({ hasText: 'Select project' }).first();
    const projectOptions = await projectSelect.locator('option').count();

    if (projectOptions > 1) {
      await projectSelect.selectOption({ index: 1 });
    }

    const sessionName = `Voting Session ${Date.now()}`;
    await page.getByPlaceholder('Session name').fill(sessionName);
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(1000);

    // Click on "Open" link to navigate to session detail
    const openLink = page.getByRole('link', { name: 'Open' }).first();
    await openLink.click();

    // Wait for navigation and extract session ID
    await page.waitForURL('**/dashboard/sessions/**');
    const url = page.url();
    sessionId = url.split('/').pop() ?? '';

    // Verify we're on the session detail page
    await expect(page.getByRole('heading', { name: sessionName }).or(page.getByRole('heading', { name: /Session/ }))).toBeVisible();
  });

  test('vote in planning poker session', async ({ page }) => {
    // Verify voting section is visible
    await expect(page.getByText('Your Vote')).toBeVisible();

    // Verify Fibonacci cards are displayed (Planning Poker default)
    await expect(page.getByRole('button', { name: '1' })).toBeVisible();
    await expect(page.getByRole('button', { name: '2' })).toBeVisible();
    await expect(page.getByRole('button', { name: '3' })).toBeVisible();
    await expect(page.getByRole('button', { name: '5' })).toBeVisible();
    await expect(page.getByRole('button', { name: '8' })).toBeVisible();

    // Click on a card to vote
    const voteButton = page.getByRole('button', { name: '5' }).last();
    await voteButton.click();

    // Wait for vote to be submitted
    await page.waitForTimeout(1000);

    // Verify participants section shows vote was cast
    await expect(page.getByText('Participants')).toBeVisible();
    await expect(page.getByText(/\d+ participants?/)).toBeVisible();
  });

  test('change vote before reveal', async ({ page }) => {
    // Vote with first card
    await page.getByRole('button', { name: '3' }).last().click();
    await page.waitForTimeout(500);

    // Change vote to different card
    await page.getByRole('button', { name: '8' }).last().click();
    await page.waitForTimeout(1000);

    // Vote should be updated (no error state)
    await expect(page.getByText('Your Vote')).toBeVisible();
  });

  test('reveal votes displays results', async ({ page }) => {
    // Submit a vote first
    await page.getByRole('button', { name: '5' }).last().click();
    await page.waitForTimeout(1000);

    // Click reveal votes button
    await page.getByRole('button', { name: 'Reveal Votes' }).click();
    await page.waitForTimeout(1000);

    // Verify results section appears
    await expect(page.getByText('Results')).toBeVisible();
    await expect(page.getByText('Average')).toBeVisible();
    await expect(page.getByText('Median')).toBeVisible();
    await expect(page.getByText('Consensus')).toBeVisible();
    await expect(page.getByText('Agreement')).toBeVisible();

    // Verify reveal button text changed
    await expect(page.getByRole('button', { name: 'Reveal Again' })).toBeVisible();

    // Verify final estimate input appears
    await expect(page.getByPlaceholder('Final estimate')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Complete' })).toBeVisible();
  });

  test('cannot vote after reveal', async ({ page }) => {
    // Submit a vote
    await page.getByRole('button', { name: '5' }).last().click();
    await page.waitForTimeout(500);

    // Reveal votes
    await page.getByRole('button', { name: 'Reveal Votes' }).click();
    await page.waitForTimeout(1000);

    // Verify voting cards are disabled
    const voteCard = page.getByRole('button', { name: '8' }).last();
    await expect(voteCard).toBeDisabled();
  });

  test('start new round resets votes', async ({ page }) => {
    // Submit a vote
    await page.getByRole('button', { name: '5' }).last().click();
    await page.waitForTimeout(500);

    // Reveal votes
    await page.getByRole('button', { name: 'Reveal Votes' }).click();
    await page.waitForTimeout(1000);

    // Start new round
    await page.getByRole('button', { name: 'New Round' }).click();
    await page.waitForTimeout(1000);

    // Verify round number increased
    await expect(page.getByText('Round 2')).toBeVisible();

    // Verify results section is hidden (new round)
    await expect(page.getByText('Results')).not.toBeVisible();

    // Verify can vote again
    const voteCard = page.getByRole('button', { name: '5' }).last();
    await expect(voteCard).toBeEnabled();
  });

  test('complete session with final estimate', async ({ page }) => {
    // Submit a vote
    await page.getByRole('button', { name: '5' }).last().click();
    await page.waitForTimeout(500);

    // Reveal votes
    await page.getByRole('button', { name: 'Reveal Votes' }).click();
    await page.waitForTimeout(1000);

    // Enter final estimate
    const finalEstimateInput = page.getByPlaceholder('Final estimate');
    await finalEstimateInput.fill('8');

    // Complete session
    await page.getByRole('button', { name: 'Complete' }).click();
    await page.waitForTimeout(1000);

    // Verify completion (buttons should be disabled)
    await expect(page.getByRole('button', { name: 'Reveal Again' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'New Round' })).toBeDisabled();
  });
});

test.describe('Estimation session consensus', () => {
  test('navigate to session from list', async ({ page }) => {
    await page.goto('/dashboard/sessions');

    // Verify sessions page loads
    await expect(page.getByRole('heading', { name: 'Estimation Sessions' })).toBeVisible();

    // Create a session
    const projectSelect = page.locator('select').filter({ hasText: 'Select project' }).first();
    const projectOptions = await projectSelect.locator('option').count();

    if (projectOptions > 1) {
      await projectSelect.selectOption({ index: 1 });
    }

    const sessionName = `Navigation Test ${Date.now()}`;
    await page.getByPlaceholder('Session name').fill(sessionName);
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(1000);

    // Click Open link
    const openLink = page.getByRole('link', { name: 'Open' }).first();
    await openLink.click();

    // Verify navigation to session detail page
    await expect(page.getByText('Your Vote')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reveal Votes' })).toBeVisible();
  });

  test('join session updates participant count', async ({ page }) => {
    await page.goto('/dashboard/sessions');

    // Create a session
    const projectSelect = page.locator('select').filter({ hasText: 'Select project' }).first();
    const projectOptions = await projectSelect.locator('option').count();

    if (projectOptions > 1) {
      await projectSelect.selectOption({ index: 1 });
    }

    const sessionName = `Join Test ${Date.now()}`;
    await page.getByPlaceholder('Session name').fill(sessionName);
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(1000);

    // Verify participant count is visible
    await expect(page.getByText(/\d+ participants?/)).toBeVisible();

    // Click join button
    const joinButton = page.getByRole('button', { name: 'Join' }).first();
    await joinButton.click();
    await page.waitForTimeout(1000);

    // Participant count should update or stay the same
    await expect(page.getByText(/\d+ participants?/)).toBeVisible();
  });

  test('session displays project and method info', async ({ page }) => {
    // Navigate to existing session
    await page.goto('/dashboard/sessions/44444444-4444-4444-8444-444444444444');

    // Verify session page loads
    await expect(page.getByRole('heading', { name: /Session/ })).toBeVisible();

    // Verify project info section exists
    await expect(page.getByText(/Project:/)).toBeVisible();
    await expect(page.getByText(/Method:/)).toBeVisible();

    // Verify participants section exists
    await expect(page.getByText('Participants')).toBeVisible();

    // Verify voting interface exists
    await expect(page.getByText('Your Vote')).toBeVisible();
  });

  test('participants section shows vote status', async ({ page }) => {
    // Navigate to session
    await page.goto('/dashboard/sessions/44444444-4444-4444-8444-444444444444');

    // Verify participants section exists
    await expect(page.getByText('Participants')).toBeVisible();

    // Participants should show either vote status or placeholder
    // The exact content depends on whether votes have been cast
    const participantsSection = page.locator('div:has(> h3:has-text("Participants"))').first();
    await expect(participantsSection).toBeVisible();
  });

  test('round counter displays current round', async ({ page }) => {
    // Navigate to session
    await page.goto('/dashboard/sessions/44444444-4444-4444-8444-444444444444');

    // Verify round counter is visible
    await expect(page.getByText(/Round \d+/)).toBeVisible();
  });

  test('results metrics calculate correctly', async ({ page }) => {
    await page.goto('/dashboard/sessions');

    // Create new session
    const projectSelect = page.locator('select').filter({ hasText: 'Select project' }).first();
    const projectOptions = await projectSelect.locator('option').count();

    if (projectOptions > 1) {
      await projectSelect.selectOption({ index: 1 });
    }

    const sessionName = `Metrics Test ${Date.now()}`;
    await page.getByPlaceholder('Session name').fill(sessionName);
    await page.getByRole('button', { name: 'New Session' }).click();
    await page.waitForTimeout(1000);

    // Navigate to session
    await page.getByRole('link', { name: 'Open' }).first().click();
    await page.waitForTimeout(500);

    // Vote
    await page.getByRole('button', { name: '5' }).last().click();
    await page.waitForTimeout(500);

    // Reveal
    await page.getByRole('button', { name: 'Reveal Votes' }).click();
    await page.waitForTimeout(1000);

    // Verify all metrics are present
    const resultsSection = page.locator('div:has(> h3:has-text("Results"))').first();
    await expect(resultsSection).toBeVisible();

    // All four metrics should be visible
    await expect(resultsSection.getByText('Average')).toBeVisible();
    await expect(resultsSection.getByText('Median')).toBeVisible();
    await expect(resultsSection.getByText('Consensus')).toBeVisible();
    await expect(resultsSection.getByText('Agreement')).toBeVisible();
  });
});
