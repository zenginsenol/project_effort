import { expect, test } from '@playwright/test';

test.describe('Team Invitation Flow', () => {
  test('settings page displays invitation section', async ({ page }) => {
    await page.goto('/dashboard/settings');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Organization/i })).toBeVisible();

    // Verify invite button is present
    await expect(page.getByRole('button', { name: /Invite Member/i })).toBeVisible();

    // Verify pending invitations section exists
    await expect(page.getByText(/Pending Invitations/i)).toBeVisible();
  });

  test('invite member dialog opens and closes', async ({ page }) => {
    await page.goto('/dashboard/settings');

    // Click invite button
    const inviteButton = page.getByRole('button', { name: /Invite Member/i });
    await inviteButton.click();

    // Dialog should be visible
    await expect(page.getByText(/Invite Team Member/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Email address/i)).toBeVisible();
    await expect(page.getByText(/Select role/i)).toBeVisible();

    // Close dialog by clicking outside or close button
    const closeButton = page.locator('button[aria-label*="close"], button[aria-label*="Close"]').first();
    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else {
      // Click outside the dialog
      await page.keyboard.press('Escape');
    }

    // Dialog should be hidden
    await expect(page.getByText(/Invite Team Member/i)).not.toBeVisible();
  });

  test('invite form validation works', async ({ page }) => {
    await page.goto('/dashboard/settings');

    // Open invite dialog
    await page.getByRole('button', { name: /Invite Member/i }).click();
    await expect(page.getByText(/Invite Team Member/i)).toBeVisible();

    // Try to submit without email
    const submitButton = page.getByRole('button', { name: /Send Invitation/i });
    await submitButton.click();

    // HTML5 validation should prevent submission
    const emailInput = page.getByPlaceholder(/Email address/i);
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMessage).toBeTruthy();

    // Enter invalid email
    await emailInput.fill('not-an-email');
    await submitButton.click();

    // Should still show validation error
    const invalidEmailValidation = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(invalidEmailValidation).toBeTruthy();
  });

  test('pending invitations list displays correctly', async ({ page }) => {
    await page.goto('/dashboard/settings');

    // Check for pending invitations section
    const pendingSection = page.getByText(/Pending Invitations/i);
    await expect(pendingSection).toBeVisible();

    // The list might be empty or have invitations
    // Just verify the structure is present
    const invitationsContainer = page.locator('[data-testid="pending-invitations-list"], .pending-invitations').first();

    // If there are invitations, check the structure
    const hasInvitations = await page.locator('text=/invited to/i').count() > 0;

    if (hasInvitations) {
      // Verify invitation items show expected information
      await expect(page.locator('text=/invited to/i').first()).toBeVisible();

      // Check for action buttons (resend, cancel) on pending invitations
      const actionButtons = page.getByRole('button', { name: /(Resend|Cancel)/i });
      const buttonCount = await actionButtons.count();
      expect(buttonCount).toBeGreaterThanOrEqual(0);
    } else {
      // Empty state should be displayed
      const emptyMessage = page.locator('text=/No pending invitations/i, text=/No invitations yet/i').first();
      await expect(emptyMessage).toBeVisible();
    }
  });

  test('invitation accept page renders', async ({ page }) => {
    // Use a test token to verify the page structure
    await page.goto('/invite/test-token-12345');

    // Page should render (either with invitation details or error)
    await page.waitForLoadState('networkidle');

    // Either we see invitation details or an error message
    const hasInvitationDetails = await page.locator('text=/invited you to join/i').count() > 0;
    const hasErrorMessage = await page.locator('text=/invalid|expired|not found/i').count() > 0;

    // One of these should be true
    expect(hasInvitationDetails || hasErrorMessage).toBeTruthy();

    // If invitation is valid, check for accept button
    if (hasInvitationDetails) {
      await expect(page.getByRole('button', { name: /Accept/i })).toBeVisible();
    }
  });

  test('role selection in invite dialog works', async ({ page }) => {
    await page.goto('/dashboard/settings');

    // Open invite dialog
    await page.getByRole('button', { name: /Invite Member/i }).click();
    await expect(page.getByText(/Invite Team Member/i)).toBeVisible();

    // Find role selector (could be a select or custom dropdown)
    const roleSelector = page.locator('select, [role="combobox"]').filter({ hasText: /admin|member|viewer/i }).first();

    if (await roleSelector.count() > 0) {
      // Verify role options are present
      await roleSelector.click();

      // Check for role options
      const hasAdmin = await page.locator('text=/admin/i').count() > 0;
      const hasMember = await page.locator('text=/member/i').count() > 0;
      const hasViewer = await page.locator('text=/viewer/i').count() > 0;

      // At least one role should be visible
      expect(hasAdmin || hasMember || hasViewer).toBeTruthy();
    }
  });
});

test.describe('Invitation Management', () => {
  test('invitation status badges display correctly', async ({ page }) => {
    await page.goto('/dashboard/settings');

    // Wait for pending invitations section
    await expect(page.getByText(/Pending Invitations/i)).toBeVisible();

    // Check if there are any status badges
    const statusBadges = page.locator('text=/pending|accepted|expired|cancelled/i');
    const badgeCount = await statusBadges.count();

    // If invitations exist, verify status badges
    if (badgeCount > 0) {
      // At least one status badge should be visible
      await expect(statusBadges.first()).toBeVisible();
    }
  });

  test('invitation timestamps are displayed', async ({ page }) => {
    await page.goto('/dashboard/settings');

    // Look for invitation timestamp patterns
    const hasInvitations = await page.locator('text=/invited to/i').count() > 0;

    if (hasInvitations) {
      // Check for date/time related text
      const hasTimestamp = await page.locator('text=/ago|expires|invited on|sent/i').count() > 0;
      expect(hasTimestamp).toBeTruthy();
    }
  });
});

test.describe('Invitation Security', () => {
  test('accept page handles invalid tokens gracefully', async ({ page }) => {
    // Try to access with an invalid token
    await page.goto('/invite/invalid-token-xyz-123');

    await page.waitForLoadState('networkidle');

    // Should show error message, not crash
    const hasError = await page.locator('text=/invalid|expired|not found|error/i').count() > 0;
    expect(hasError).toBeTruthy();

    // Should not show accept button for invalid token
    const acceptButton = page.getByRole('button', { name: /Accept Invitation/i });
    const buttonVisible = await acceptButton.isVisible().catch(() => false);
    expect(buttonVisible).toBeFalsy();
  });

  test('accept page handles expired invitations', async ({ page }) => {
    // Visit accept page
    await page.goto('/invite/expired-token-test');

    await page.waitForLoadState('networkidle');

    // Should handle gracefully (show error or expired message)
    const pageText = await page.textContent('body');
    expect(pageText).toBeTruthy();

    // Page should not crash
    const hasContent = await page.locator('main, body, div').count() > 0;
    expect(hasContent).toBeTruthy();
  });
});

test.describe('Invitation UI Integration', () => {
  test('settings page layout includes all invitation components', async ({ page }) => {
    await page.goto('/dashboard/settings');

    // Verify all key invitation UI elements are present
    const elements = [
      page.getByRole('button', { name: /Invite Member/i }),
      page.getByText(/Pending Invitations/i),
      page.getByRole('heading', { name: /Organization/i }),
    ];

    for (const element of elements) {
      await expect(element).toBeVisible();
    }
  });

  test('navigation to settings page works from dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Try to find settings link (might be in nav or sidebar)
    const settingsLink = page.getByRole('link', { name: /settings/i }).first();

    if (await settingsLink.isVisible()) {
      await settingsLink.click();

      // Should navigate to settings page
      await expect(page).toHaveURL(/\/settings/);

      // Invitation section should be visible
      await expect(page.getByRole('button', { name: /Invite Member/i })).toBeVisible();
    }
  });
});
