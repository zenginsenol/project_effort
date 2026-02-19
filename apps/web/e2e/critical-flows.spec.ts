import { expect, test } from '@playwright/test';

test.describe('Critical flows', () => {
  test('auth/demo entry reaches dashboard route', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('project CRUD entry screen is available', async ({ page }) => {
    await page.goto('/dashboard/projects');
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Project Name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Project' })).toBeVisible();
  });

  test('session vote screen is available', async ({ page }) => {
    await page.goto('/dashboard/sessions/44444444-4444-4444-8444-444444444444');
    await expect(page.getByRole('heading', { name: 'Session' })).toBeVisible();
    await expect(page.getByText('Your Vote')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reveal Votes' })).toBeVisible();
  });

  test('analyzer workflow screen is available', async ({ page }) => {
    await page.goto('/dashboard/analyzer');
    await expect(page.getByRole('heading', { name: 'Task Analyzer' })).toBeVisible();
    await expect(page.getByText('AI Text Analysis')).toBeVisible();
    await expect(page.getByRole('button', { name: /Analyze .* Extract Tasks/ })).toBeVisible();
  });
});
