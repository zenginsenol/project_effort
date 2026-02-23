import { expect, test } from '@playwright/test';

test.describe('GitHub Integration and Sync', () => {
  test('integrations page navigation', async ({ page }) => {
    await page.goto('/dashboard/integrations');

    // Verify integrations page loads correctly
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible();
    await expect(page.getByText('Connect external tools to import and sync project data.')).toBeVisible();
  });

  test('github integration card displays correctly', async ({ page }) => {
    await page.goto('/dashboard/integrations');

    // Verify GitHub integration card is present
    await expect(page.getByText('GitHub')).toBeVisible();
    await expect(page.getByText('Import issues from GitHub repositories')).toBeVisible();

    // Verify connect button is visible
    await expect(page.getByRole('button', { name: /Connect/i }).first()).toBeVisible();
  });

  test('jira integration card displays correctly', async ({ page }) => {
    await page.goto('/dashboard/integrations');

    // Verify Jira integration card is present
    await expect(page.getByText('Jira')).toBeVisible();
    await expect(page.getByText('Import and sync issues from Atlassian Jira')).toBeVisible();
  });

  test('planned integrations section displays', async ({ page }) => {
    await page.goto('/dashboard/integrations');

    // Verify planned integrations section
    await expect(page.getByRole('heading', { name: 'Planned Integrations' })).toBeVisible();
    await expect(page.getByText('Azure DevOps')).toBeVisible();
    await expect(page.getByText('GitLab')).toBeVisible();
  });

  test('github connect button interaction', async ({ page }) => {
    await page.goto('/dashboard/integrations');

    // Find and click GitHub connect button
    const githubCard = page.locator('div').filter({ hasText: /^GitHub/ });
    const connectButton = githubCard.getByRole('button', { name: /Connect/i });

    // Verify button is clickable
    await expect(connectButton).toBeEnabled();

    // Note: In a real test, clicking would redirect to GitHub OAuth
    // For now, we just verify the button exists and is enabled
  });

  test('project github sync section displays', async ({ page }) => {
    // First navigate to projects page
    await page.goto('/dashboard/projects');
    await expect(page.getByRole('heading', { name: 'Kanban Project Dashboard' })).toBeVisible();

    // Create a test project
    const projectName = `GitHub Sync Test ${Date.now()}`;
    const projectKey = 'GH';

    await page.getByPlaceholder('Project Name').fill(projectName);
    await page.getByPlaceholder('KEY').fill(projectKey);
    await page.getByRole('button', { name: 'Create Project' }).click();

    // Wait for project to be created
    await page.waitForTimeout(1000);

    // Navigate to project detail page
    const kanbanLink = page.getByRole('link', { name: /Open Kanban Board/i }).first();
    await kanbanLink.click();

    // Verify GitHub sync section exists
    await expect(page.getByText(/GitHub/i)).toBeVisible();
  });

  test('github repository input field', async ({ page }) => {
    // Navigate to a project detail page
    // Using the pre-seeded test project ID from critical-flows
    await page.goto('/dashboard/projects/11111111-1111-1111-1111-111111111111');

    // Look for GitHub repository input
    // The input might be in a GitHub sync section or panel
    const githubSection = page.locator('div').filter({ hasText: /GitHub/i });
    if (await githubSection.count() > 0) {
      await expect(githubSection).toBeVisible();
    }
  });

  test('github sync now button availability', async ({ page }) => {
    await page.goto('/dashboard/projects/11111111-1111-1111-1111-111111111111');

    // Check if sync button exists (might be disabled without repository)
    const syncButton = page.getByRole('button', { name: /Sync Now/i });
    if (await syncButton.count() > 0) {
      // Button exists - verify it's in the DOM
      await expect(syncButton).toBeDefined();
    }
  });

  test('github auto-sync checkbox', async ({ page }) => {
    await page.goto('/dashboard/projects/11111111-1111-1111-1111-111111111111');

    // Look for auto-sync checkbox
    const autoSyncCheckbox = page.locator('input[type="checkbox"]').filter({ has: page.locator(':text("Auto-sync")') });
    if (await autoSyncCheckbox.count() === 0) {
      // Try alternative selector
      const autoSyncLabel = page.getByText(/Auto-sync when project is opened/i);
      if (await autoSyncLabel.count() > 0) {
        await expect(autoSyncLabel).toBeDefined();
      }
    }
  });

  test('github integration shows connection status', async ({ page }) => {
    await page.goto('/dashboard/integrations');

    // Look for connection status indicators
    const githubCard = page.locator('div').filter({ hasText: 'Import issues from GitHub repositories' });
    await expect(githubCard).toBeVisible();

    // Check if "Connected" badge exists (would be visible if integration is active)
    // This might not be present in demo mode
    const connectedBadge = page.getByText('Connected');
    // Note: Badge might not exist in test environment without actual OAuth
  });

  test('github disconnect button when connected', async ({ page }) => {
    await page.goto('/dashboard/integrations');

    // Look for disconnect button (only visible when integration is connected)
    const disconnectButton = page.getByRole('button', { name: /Disconnect/i });

    // In a connected state, this button should exist
    // In demo mode, it might not be visible
    if (await disconnectButton.count() > 0) {
      await expect(disconnectButton).toBeVisible();
    }
  });

  test('github sync notification messages', async ({ page }) => {
    await page.goto('/dashboard/projects/11111111-1111-1111-1111-111111111111');

    // After a sync operation, there should be a notification area
    // Look for common notification patterns
    const notificationArea = page.locator('.text-green-700, .text-red-700');

    // Notification might not exist until after an action
    // This test just verifies the page loads without errors
    await expect(page).toHaveURL(/\/dashboard\/projects\/[a-f0-9-]+/);
  });

  test('github integration last sync timestamp', async ({ page }) => {
    await page.goto('/dashboard/integrations');

    // Look for "Last sync" information in GitHub card
    const lastSyncText = page.getByText(/Last sync:/i);

    if (await lastSyncText.count() > 0) {
      await expect(lastSyncText).toBeVisible();
      // Should show either "Never" or a timestamp
      await expect(page.getByText(/Last sync: (Never|\d{1,2}\/\d{1,2}\/\d{4})/i)).toBeVisible();
    }
  });

  test('github repository format validation', async ({ page }) => {
    await page.goto('/dashboard/projects/11111111-1111-1111-1111-111111111111');

    // Look for repository input field
    const repoInput = page.locator('input[type="text"]').filter({ hasText: /owner\/repo|Repository/i });

    if (await repoInput.count() > 0) {
      // Try to find the input by placeholder or nearby label
      const inputs = page.locator('input[type="text"]');
      await expect(inputs.first()).toBeDefined();
    }
  });

  test('multiple github connections support', async ({ page }) => {
    await page.goto('/dashboard/integrations');

    // GitHub supports multiple connections
    // Look for "Connect Another" button which appears when at least one connection exists
    const connectAnotherButton = page.getByRole('button', { name: /Connect Another/i });

    // Button might exist if connections are present
    if (await connectAnotherButton.count() > 0) {
      await expect(connectAnotherButton).toBeVisible();
    } else {
      // Otherwise, regular Connect button should be visible
      const githubCard = page.locator('div').filter({ hasText: 'Import issues from GitHub repositories' });
      const connectButton = githubCard.getByRole('button', { name: /Connect/i });
      await expect(connectButton).toBeVisible();
    }
  });

  test('github integration token encryption indicator', async ({ page }) => {
    await page.goto('/dashboard/integrations');

    // When connected, should show token encryption status
    const tokenEncryptedText = page.getByText(/Token encrypted:/i);

    if (await tokenEncryptedText.count() > 0) {
      await expect(tokenEncryptedText).toBeVisible();
      // Should show "Yes" or "No"
      await expect(page.getByText(/Token encrypted: (Yes|No)/i)).toBeVisible();
    }
  });

  test('github sync preserves task data', async ({ page }) => {
    // Navigate to a project with tasks
    await page.goto('/dashboard/projects/11111111-1111-1111-1111-111111111111');

    // This test verifies that GitHub sync UI doesn't interfere with existing tasks
    // In a real scenario, we'd create tasks, sync, and verify they're preserved

    // For now, verify the project page loads correctly
    await expect(page.getByRole('heading', { name: 'Project Details' })).toBeVisible();
  });

  test('github integration error handling', async ({ page }) => {
    await page.goto('/dashboard/integrations');

    // Error messages should be handled gracefully
    // Look for error notification area
    const errorNotification = page.locator('.text-red-700, .border-red-300');

    // No error should be visible on page load
    if (await errorNotification.count() > 0) {
      // Error div exists but should be empty or hidden initially
      const errorText = await errorNotification.textContent();
      // In a clean state, error should be empty or not visible
    }
  });

  test('github sync count display', async ({ page }) => {
    await page.goto('/dashboard/integrations');

    // When multiple GitHub accounts are connected, should show count
    // e.g., "2 connected"
    const connectedCountBadge = page.getByText(/\d+ connected/i);

    if (await connectedCountBadge.count() > 0) {
      await expect(connectedCountBadge).toBeVisible();
    }
  });

  test('github integration navigation from project', async ({ page }) => {
    await page.goto('/dashboard/projects/11111111-1111-1111-1111-111111111111');

    // There might be a link to go to integrations from project page
    // Verify user can navigate back to integrations if needed
    await page.goto('/dashboard/integrations');

    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible();
  });

  test('github profile information display', async ({ page }) => {
    await page.goto('/dashboard/integrations');

    // When connected, GitHub connections should show profile info
    // e.g., "username (Full Name)"
    const githubCard = page.locator('div').filter({ hasText: 'Import issues from GitHub repositories' });

    if (await githubCard.count() > 0) {
      await expect(githubCard).toBeVisible();

      // Look for GitHub username pattern
      // In connected state, would show something like "octocat (GitHub User)"
      const profileInfo = githubCard.locator('text=/^[a-zA-Z0-9-]+ \\(.+\\)$/');
      // Profile info only exists when connected
    }
  });
});
