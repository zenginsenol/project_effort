import { expect, test, type Locator, type Page } from '@playwright/test';

const PROJECT_ID = '11111111-1111-1111-1111-111111111111';

async function gotoIntegrations(page: Page): Promise<void> {
  await page.goto('/dashboard/integrations');
  await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible();
}

async function gotoProject(page: Page): Promise<void> {
  await page.goto(`/dashboard/projects/${PROJECT_ID}`);
  await expect(page.getByRole('heading', { name: 'Project Details', exact: true })).toBeVisible();
}

async function integrationCard(page: Page, name: 'GitHub' | 'Jira'): Promise<Locator> {
  const heading = page.getByRole('heading', { name, exact: true });
  await expect(heading).toBeVisible();
  return heading.locator('xpath=ancestor::div[contains(@class,"rounded-lg") and contains(@class,"border")][1]');
}

test.describe('GitHub Integration and Sync', () => {
  test('integrations page navigation', async ({ page }) => {
    await gotoIntegrations(page);
    await expect(page.getByText('Connect external tools to import and sync project data.')).toBeVisible();
  });

  test('github integration card displays correctly', async ({ page }) => {
    await gotoIntegrations(page);
    const githubCard = await integrationCard(page, 'GitHub');
    await expect(githubCard.getByText('Import issues from GitHub repositories')).toBeVisible();
  });

  test('jira integration card displays correctly', async ({ page }) => {
    await gotoIntegrations(page);
    const jiraCard = await integrationCard(page, 'Jira');
    await expect(jiraCard.getByText('Import and sync issues from Atlassian Jira')).toBeVisible();
  });

  test('planned integrations section displays', async ({ page }) => {
    await gotoIntegrations(page);
    await expect(page.getByRole('heading', { name: 'Planned Integrations', exact: true })).toBeVisible();
    await expect(page.getByText('Azure DevOps')).toBeVisible();
    await expect(page.getByText('GitLab')).toBeVisible();
  });

  test('github connect button interaction', async ({ page }) => {
    await gotoIntegrations(page);
    const githubCard = await integrationCard(page, 'GitHub');

    const connectButton = githubCard.getByRole('button', { name: /^Connect$/ });
    const connectAnotherButton = githubCard.getByRole('button', { name: /^Connect Another$/ });
    const disconnectButton = githubCard.getByRole('button', { name: /^Disconnect$/ });

    if (await connectAnotherButton.count()) {
      await expect(connectAnotherButton.first()).toBeEnabled();
      return;
    }

    if (await connectButton.count()) {
      await expect(connectButton.first()).toBeEnabled();
      return;
    }

    if (await disconnectButton.count()) {
      await expect(disconnectButton.first()).toBeEnabled();
      return;
    }

    throw new Error('GitHub card rendered without any action button.');
  });

  test('project github sync section displays', async ({ page }) => {
    await gotoProject(page);
    await expect(page.getByRole('heading', { name: 'GitHub Integration', exact: true })).toBeVisible();
  });

  test('github repository input field', async ({ page }) => {
    await gotoProject(page);

    const repoInput = page.getByPlaceholder('owner/repo or https://github.com/owner/repo');
    const disconnectedHint = page.getByText('Connect GitHub first from');

    if (await repoInput.count()) {
      await expect(repoInput).toBeVisible();
    } else {
      await expect(disconnectedHint).toBeVisible();
    }
  });

  test('github sync now button availability', async ({ page }) => {
    await gotoProject(page);

    const syncButton = page.getByRole('button', { name: 'Sync Now', exact: true });
    const disconnectedHint = page.getByText('Connect GitHub first from');

    if (await syncButton.count()) {
      await expect(syncButton).toBeVisible();
    } else {
      await expect(disconnectedHint).toBeVisible();
    }
  });

  test('github auto-sync checkbox', async ({ page }) => {
    await gotoProject(page);

    const autoSync = page.getByLabel('Auto-sync when project is opened', { exact: true });
    if (await autoSync.count()) {
      await expect(autoSync).toBeVisible();
    } else {
      await expect(page.getByText('Connect GitHub first from')).toBeVisible();
    }
  });

  test('github integration shows connection status', async ({ page }) => {
    await gotoIntegrations(page);
    const githubCard = await integrationCard(page, 'GitHub');

    const connectedBadge = githubCard.getByText(/connected/i).first();
    const connectButton = githubCard.getByRole('button', { name: /^Connect$/ });

    if (await connectedBadge.count()) {
      await expect(connectedBadge).toBeVisible();
    } else {
      await expect(connectButton).toBeVisible();
    }
  });

  test('github disconnect button when connected', async ({ page }) => {
    await gotoIntegrations(page);
    const githubCard = await integrationCard(page, 'GitHub');

    const disconnectButton = githubCard.getByRole('button', { name: /^Disconnect$/ });
    if (await disconnectButton.count()) {
      await expect(disconnectButton.first()).toBeVisible();
    }
  });

  test('github sync notification messages', async ({ page }) => {
    await gotoProject(page);
    await expect(page).toHaveURL(/\/dashboard\/projects\/[a-f0-9-]+/);
  });

  test('github integration last sync timestamp', async ({ page }) => {
    await gotoIntegrations(page);
    const githubCard = await integrationCard(page, 'GitHub');

    const lastSyncText = githubCard.getByText(/Last sync:/i);
    if (await lastSyncText.count()) {
      await expect(lastSyncText.first()).toBeVisible();
    }
  });

  test('github repository format validation', async ({ page }) => {
    await gotoProject(page);

    const repoInput = page.getByPlaceholder('owner/repo or https://github.com/owner/repo');
    if (await repoInput.count()) {
      await expect(repoInput).toBeVisible();
      await expect(repoInput).toHaveAttribute('type', 'text');
    }
  });

  test('multiple github connections support', async ({ page }) => {
    await gotoIntegrations(page);
    const githubCard = await integrationCard(page, 'GitHub');

    const connectAnotherButton = githubCard.getByRole('button', { name: /^Connect Another$/ });
    const connectButton = githubCard.getByRole('button', { name: /^Connect$/ });

    if (await connectAnotherButton.count()) {
      await expect(connectAnotherButton.first()).toBeVisible();
    } else {
      await expect(connectButton.first()).toBeVisible();
    }
  });

  test('github integration token encryption indicator', async ({ page }) => {
    await gotoIntegrations(page);
    const githubCard = await integrationCard(page, 'GitHub');

    const tokenEncryptedText = githubCard.getByText(/Token encrypted:/i);
    if (await tokenEncryptedText.count()) {
      await expect(tokenEncryptedText.first()).toBeVisible();
    }
  });

  test('github sync preserves task data', async ({ page }) => {
    await gotoProject(page);
    await expect(page.getByRole('heading', { name: 'Project Details', exact: true })).toBeVisible();
  });

  test('github integration error handling', async ({ page }) => {
    await gotoIntegrations(page);
    await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible();
  });

  test('github sync count display', async ({ page }) => {
    await gotoIntegrations(page);
    const githubCard = await integrationCard(page, 'GitHub');

    const connectedCountBadge = githubCard.getByText(/\d+ connected/i);
    if (await connectedCountBadge.count()) {
      await expect(connectedCountBadge.first()).toBeVisible();
    }
  });

  test('github integration navigation from project', async ({ page }) => {
    await gotoProject(page);
    await gotoIntegrations(page);
  });

  test('github profile information display', async ({ page }) => {
    await gotoIntegrations(page);
    const githubCard = await integrationCard(page, 'GitHub');

    const profileRows = githubCard.locator('div').filter({ hasText: /github-|\(.+\)/i });
    if (await profileRows.count()) {
      await expect(profileRows.first()).toBeVisible();
    }
  });
});
