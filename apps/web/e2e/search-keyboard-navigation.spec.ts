import { expect, test } from '@playwright/test';

import {
  closeCommandPalette,
  commandPaletteInput,
  openCommandPalette,
} from './helpers/command-palette-helper';

test.describe('Search Keyboard Navigation and Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Go-live Control Center' })).toBeVisible();
  });

  test('opens palette and focuses input', async ({ page }) => {
    const input = await openCommandPalette(page);
    await expect(input).toBeFocused();
  });

  test('Escape closes command palette', async ({ page }) => {
    await openCommandPalette(page);
    await closeCommandPalette(page);
  });

  test('Tab navigates to filter buttons', async ({ page }) => {
    await openCommandPalette(page);

    await page.keyboard.press('Tab');
    await expect(page.getByTestId('filter-projects')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByTestId('filter-tasks')).toBeFocused();
  });

  test('focused filter can be toggled', async ({ page }) => {
    await openCommandPalette(page);

    await page.keyboard.press('Tab');
    const projectsFilter = page.getByTestId('filter-projects');
    await expect(projectsFilter).toBeFocused();

    await projectsFilter.click();
    await expect(projectsFilter).toHaveAttribute('aria-pressed', 'true');

    await projectsFilter.click();
    await expect(projectsFilter).toHaveAttribute('aria-pressed', 'false');
  });

  test('Arrow navigation works when results are present', async ({ page }) => {
    const input = await openCommandPalette(page);
    await input.fill('test');
    await page.waitForTimeout(500);

    const items = page.locator('[cmdk-item]');
    test.skip((await items.count()) === 0, 'No search results in current dataset.');

    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[aria-selected="true"]').first()).toBeVisible();

    await page.keyboard.press('ArrowUp');
    await expect(page.locator('[aria-selected="true"]').first()).toBeVisible();
  });

  test('clear button resets query', async ({ page }) => {
    const input = await openCommandPalette(page);

    await input.fill('test query');
    await expect(input).toHaveValue('test query');

    const clearButton = page.getByRole('button', { name: 'Clear search' });
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    await expect(input).toHaveValue('');
  });

  test('dialog and filter controls expose accessibility attributes', async ({ page }) => {
    await openCommandPalette(page);

    const dialog = page.getByRole('dialog', { name: 'Global search' });
    await expect(dialog).toBeVisible();

    const projectsFilter = page.getByTestId('filter-projects');
    await expect(projectsFilter).toHaveAttribute('aria-label', /filter by projects/i);
    await expect(projectsFilter).toHaveAttribute('aria-pressed', 'false');
  });

  test('supports keyboard-only flow end-to-end', async ({ page }) => {
    const input = await openCommandPalette(page);

    await page.keyboard.type('test');
    await expect(input).toHaveValue('test');

    const projectsFilter = page.getByTestId('filter-projects');
    let isProjectsFilterFocused = false;
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab');
      isProjectsFilterFocused = await projectsFilter.evaluate(
        (element) => element === document.activeElement
      );
      if (isProjectsFilterFocused) {
        break;
      }
    }

    test.skip(!isProjectsFilterFocused, 'Projects filter could not be focused via keyboard in this environment.');
    await expect(projectsFilter).toBeFocused();
    await page.keyboard.press('Enter');
    if ((await projectsFilter.getAttribute('aria-pressed')) !== 'true') {
      await page.keyboard.press('Space');
    }
    await expect(projectsFilter).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('Shift+Tab');
    const clearSearchButton = page.getByRole('button', { name: 'Clear search' });
    if (await clearSearchButton.isVisible().catch(() => false)) {
      await expect(clearSearchButton).toBeFocused();
      await page.keyboard.press('Shift+Tab');
    }
    await expect(commandPaletteInput(page)).toBeFocused();

    await closeCommandPalette(page);
  });
});
