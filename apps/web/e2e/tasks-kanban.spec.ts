import { expect, test, type Page } from '@playwright/test';

async function openExistingProjectBoard(page: Page): Promise<boolean> {
  await page.goto('/dashboard/projects');
  await expect(page.getByRole('heading', { name: 'Kanban Project Dashboard' })).toBeVisible();

  const boardLink = page.getByRole('link', { name: /Open Kanban Board/i }).first();
  const hasBoard = (await boardLink.count()) > 0 && await boardLink.isVisible().catch(() => false);
  if (!hasBoard) {
    return false;
  }

  await boardLink.click();
  await page.waitForURL('**/dashboard/projects/**');
  await expect(page.getByRole('heading', { name: 'Create Task' })).toBeVisible();

  return true;
}

test.describe('Task workspace smoke checks', () => {
  test('task workspace panels are visible', async ({ page }) => {
    const opened = await openExistingProjectBoard(page);
    test.skip(!opened, 'No existing project board is available in this environment.');

    await expect(page.getByRole('heading', { name: 'Create Task' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Task Detail' })).toBeVisible();
    await expect(page.getByPlaceholder('Task title')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Task' })).toBeVisible();
  });

  test('list and board view toggles work', async ({ page }) => {
    const opened = await openExistingProjectBoard(page);
    test.skip(!opened, 'No existing project board is available in this environment.');

    const listButton = page.getByRole('button', { name: /^List$/ });
    const boardButton = page.getByRole('button', { name: /^Board$/ });

    await listButton.click();
    await expect(listButton).toHaveClass(/indigo/);

    await boardButton.click();
    await expect(boardButton).toHaveClass(/emerald/);
    await expect(page.getByRole('heading', { name: 'Backlog', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'To Do', exact: true })).toBeVisible();
  });

  test('status/type/sort filters update URL query params', async ({ page }) => {
    const opened = await openExistingProjectBoard(page);
    test.skip(!opened, 'No existing project board is available in this environment.');

    const statusFilter = page.locator('select').filter({ hasText: 'All Statuses' }).first();
    const typeFilter = page.locator('select').filter({ hasText: 'All Types' }).first();
    const sortFilter = page.locator('select').filter({ hasText: 'Newest First' }).first();

    await statusFilter.selectOption('backlog');
    await typeFilter.selectOption('task');
    await sortFilter.selectOption('title_asc');

    await expect.poll(() => page.url()).toContain('status=backlog');
    await expect.poll(() => page.url()).toContain('type=task');
    await expect.poll(() => page.url()).toContain('sort=title_asc');
  });

  test('board columns render empty state or cards', async ({ page }) => {
    const opened = await openExistingProjectBoard(page);
    test.skip(!opened, 'No existing project board is available in this environment.');

    await page.getByRole('button', { name: /^Board$/ }).click();

    const columns = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done', 'Cancelled'];
    for (const title of columns) {
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    }

    const hasNoTasksPlaceholder = await page.getByText('No tasks').first().isVisible().catch(() => false);
    const hasTaskCard = (await page.locator('div.cursor-move').count()) > 0;
    expect(hasNoTasksPlaceholder || hasTaskCard).toBeTruthy();
  });

  test('board view preference persists after reload', async ({ page }) => {
    const opened = await openExistingProjectBoard(page);
    test.skip(!opened, 'No existing project board is available in this environment.');

    const boardButton = page.getByRole('button', { name: /^Board$/ });
    await boardButton.click();

    await expect(boardButton).toHaveClass(/emerald/);
    await expect.poll(() => page.url()).toContain('view=board');

    await page.reload();
    await expect(page.getByRole('button', { name: /^Board$/ })).toHaveClass(/emerald/);
    await expect(page.getByRole('heading', { name: 'Backlog', exact: true })).toBeVisible();
  });
});
