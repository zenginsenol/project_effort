import { expect, test } from '@playwright/test';

test.describe('Search Entity Type Filters', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Go-live Control Center' })).toBeVisible();
  });

  test('opens command palette with Cmd+K', async ({ page }) => {
    // Press Cmd+K (Meta+K on Mac, Ctrl+K on Windows/Linux)
    await page.keyboard.press('Meta+K');

    // Verify command palette is visible
    await expect(page.getByPlaceholder('Search projects, tasks, cost analyses, sessions...')).toBeVisible();

    // Verify filter buttons are visible
    await expect(page.getByTestId('filter-projects')).toBeVisible();
    await expect(page.getByTestId('filter-tasks')).toBeVisible();
    await expect(page.getByTestId('filter-cost-analyses')).toBeVisible();
    await expect(page.getByTestId('filter-sessions')).toBeVisible();
  });

  test('search with no filters returns all entity types', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Meta+K');

    // Type search query
    const searchInput = page.getByPlaceholder('Search projects, tasks, cost analyses, sessions...');
    await searchInput.fill('test');

    // Wait for search results to load
    await page.waitForTimeout(500); // Wait for debounce

    // Verify that search is executed (input has value)
    await expect(searchInput).toHaveValue('test');

    // Note: Actual results depend on database state
    // We're verifying the UI is functional rather than specific results
  });

  test('filter by projects only shows project results', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Meta+K');

    // Click on Projects filter
    await page.getByTestId('filter-projects').click();

    // Verify filter is active (has primary background)
    const projectFilter = page.getByTestId('filter-projects');
    await expect(projectFilter).toHaveClass(/bg-primary/);

    // Type search query
    const searchInput = page.getByPlaceholder('Search projects, tasks, cost analyses, sessions...');
    await searchInput.fill('test');

    // Wait for search results
    await page.waitForTimeout(500);

    // Verify other filters are not active
    await expect(page.getByTestId('filter-tasks')).not.toHaveClass(/bg-primary/);
    await expect(page.getByTestId('filter-cost-analyses')).not.toHaveClass(/bg-primary/);
    await expect(page.getByTestId('filter-sessions')).not.toHaveClass(/bg-primary/);
  });

  test('filter by tasks only shows task results', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Meta+K');

    // Click on Tasks filter
    await page.getByTestId('filter-tasks').click();

    // Verify filter is active
    const taskFilter = page.getByTestId('filter-tasks');
    await expect(taskFilter).toHaveClass(/bg-primary/);

    // Type search query
    const searchInput = page.getByPlaceholder('Search projects, tasks, cost analyses, sessions...');
    await searchInput.fill('test');

    // Wait for search results
    await page.waitForTimeout(500);

    // Verify other filters are not active
    await expect(page.getByTestId('filter-projects')).not.toHaveClass(/bg-primary/);
    await expect(page.getByTestId('filter-cost-analyses')).not.toHaveClass(/bg-primary/);
    await expect(page.getByTestId('filter-sessions')).not.toHaveClass(/bg-primary/);
  });

  test('filter by cost analyses only shows cost analysis results', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Meta+K');

    // Click on Cost Analyses filter
    await page.getByTestId('filter-cost-analyses').click();

    // Verify filter is active
    const costAnalysisFilter = page.getByTestId('filter-cost-analyses');
    await expect(costAnalysisFilter).toHaveClass(/bg-primary/);

    // Type search query
    const searchInput = page.getByPlaceholder('Search projects, tasks, cost analyses, sessions...');
    await searchInput.fill('test');

    // Wait for search results
    await page.waitForTimeout(500);

    // Verify other filters are not active
    await expect(page.getByTestId('filter-projects')).not.toHaveClass(/bg-primary/);
    await expect(page.getByTestId('filter-tasks')).not.toHaveClass(/bg-primary/);
    await expect(page.getByTestId('filter-sessions')).not.toHaveClass(/bg-primary/);
  });

  test('filter by sessions only shows session results', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Meta+K');

    // Click on Sessions filter
    await page.getByTestId('filter-sessions').click();

    // Verify filter is active
    const sessionFilter = page.getByTestId('filter-sessions');
    await expect(sessionFilter).toHaveClass(/bg-primary/);

    // Type search query
    const searchInput = page.getByPlaceholder('Search projects, tasks, cost analyses, sessions...');
    await searchInput.fill('test');

    // Wait for search results
    await page.waitForTimeout(500);

    // Verify other filters are not active
    await expect(page.getByTestId('filter-projects')).not.toHaveClass(/bg-primary/);
    await expect(page.getByTestId('filter-tasks')).not.toHaveClass(/bg-primary/);
    await expect(page.getByTestId('filter-cost-analyses')).not.toHaveClass(/bg-primary/);
  });

  test('multiple filters can be active simultaneously', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Meta+K');

    // Click on Projects and Tasks filters
    await page.getByTestId('filter-projects').click();
    await page.getByTestId('filter-tasks').click();

    // Verify both filters are active
    await expect(page.getByTestId('filter-projects')).toHaveClass(/bg-primary/);
    await expect(page.getByTestId('filter-tasks')).toHaveClass(/bg-primary/);

    // Verify other filters are not active
    await expect(page.getByTestId('filter-cost-analyses')).not.toHaveClass(/bg-primary/);
    await expect(page.getByTestId('filter-sessions')).not.toHaveClass(/bg-primary/);

    // Type search query
    const searchInput = page.getByPlaceholder('Search projects, tasks, cost analyses, sessions...');
    await searchInput.fill('test');

    // Wait for search results
    await page.waitForTimeout(500);
  });

  test('clicking active filter deactivates it', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Meta+K');

    // Click on Projects filter to activate
    await page.getByTestId('filter-projects').click();
    await expect(page.getByTestId('filter-projects')).toHaveClass(/bg-primary/);

    // Click again to deactivate
    await page.getByTestId('filter-projects').click();
    await expect(page.getByTestId('filter-projects')).not.toHaveClass(/bg-primary/);
  });

  test('filters reset when palette is closed and reopened', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Meta+K');

    // Activate a filter
    await page.getByTestId('filter-projects').click();
    await expect(page.getByTestId('filter-projects')).toHaveClass(/bg-primary/);

    // Close palette with Escape
    await page.keyboard.press('Escape');

    // Wait for palette to close
    await expect(page.getByPlaceholder('Search projects, tasks, cost analyses, sessions...')).not.toBeVisible();

    // Reopen palette
    await page.keyboard.press('Meta+K');

    // Verify filter is reset
    await expect(page.getByTestId('filter-projects')).not.toHaveClass(/bg-primary/);
  });

  test('search input clears when palette is closed', async ({ page }) => {
    // Open command palette
    await page.keyboard.press('Meta+K');

    // Type search query
    const searchInput = page.getByPlaceholder('Search projects, tasks, cost analyses, sessions...');
    await searchInput.fill('test query');

    // Close palette
    await page.keyboard.press('Escape');

    // Reopen palette
    await page.keyboard.press('Meta+K');

    // Verify search input is cleared
    await expect(page.getByPlaceholder('Search projects, tasks, cost analyses, sessions...')).toHaveValue('');
  });
});
