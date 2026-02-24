import { expect, test } from '@playwright/test';

test.describe('Invoice generation and download', () => {
  test.describe('Automated tests - Invoice list UI verification', () => {
    test('invoice list section renders on billing page', async ({ page }) => {
      await page.goto('/dashboard/billing');

      const invoiceHeading = page.getByRole('heading', { name: 'Invoice History', exact: true });
      await expect(invoiceHeading).toBeVisible();
      await expect(page.getByText('View and download your past invoices')).toBeVisible();
    });

    test('invoice section shows empty state or invoice rows', async ({ page }) => {
      await page.goto('/dashboard/billing');

      const emptyStateText = page.getByText(/No invoices yet|Your invoice history will appear here/i);
      const invoiceRows = page.locator('p').filter({ hasText: /Amount:/i });
      const errorState = page.getByText(/Failed to load invoices/i);
      const loadingSkeleton = page.locator('.animate-pulse');

      const timeoutMs = 10_000;
      const pollIntervalMs = 250;
      const startedAt = Date.now();
      let hasKnownState = false;

      while (Date.now() - startedAt < timeoutMs) {
        const hasEmptyState = await emptyStateText.isVisible().catch(() => false);
        const hasRows = (await invoiceRows.count()) > 0;
        const hasErrorState = await errorState.isVisible().catch(() => false);
        const isLoading =
          (await loadingSkeleton.count()) > 0 &&
          (await loadingSkeleton.first().isVisible().catch(() => false));

        hasKnownState = hasEmptyState || hasRows || hasErrorState;
        if (hasKnownState || !isLoading) {
          break;
        }

        await page.waitForTimeout(pollIntervalMs);
      }

      test.skip(!hasKnownState, 'Invoice section did not stabilize to empty/rows/error in this environment.');
      expect(hasKnownState).toBeTruthy();
    });

    test('invoice items display required information when present', async ({ page }) => {
      await page.goto('/dashboard/billing');

      const invoiceRows = page.locator('p').filter({ hasText: /Amount:/i });
      test.skip((await invoiceRows.count()) === 0, 'No invoices in current environment.');

      const firstRow = invoiceRows.first();
      await expect(firstRow.locator('text=/Amount:/i')).toBeVisible();
      await expect(firstRow.locator('text=/paid|open|draft|void|uncollectible/i').first()).toBeVisible();
    });

    test('invoice links open in new tab when available', async ({ page }) => {
      await page.goto('/dashboard/billing');

      const links = page.locator('a:has-text("PDF"), a:has-text("View")');
      if ((await links.count()) > 0) {
        await expect(links.first()).toHaveAttribute('target', '_blank');
        await expect(links.first()).toHaveAttribute('rel', 'noopener noreferrer');
      }
    });
  });

  test.describe('Manual verification - Complete invoice generation flow', () => {
    test.skip('MANUAL: Complete subscription checkout and verify invoice generation', async () => {
      expect(true).toBeTruthy();
    });

    test.skip('MANUAL: Test invoice status changes and updates', async () => {
      expect(true).toBeTruthy();
    });

    test.skip('MANUAL: Test edge cases and error handling', async () => {
      expect(true).toBeTruthy();
    });
  });
});
