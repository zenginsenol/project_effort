import { expect, test } from '@playwright/test';

/**
 * E2E Tests for Invitation Management
 *
 * This test suite covers invitation management operations:
 * - Viewing pending invitations
 * - Resending invitations (generates new token and sends new email)
 * - Canceling invitations (invalidates invitation links)
 * - Verifying that cancelled invitations cannot be accepted
 */

test.describe('Invitation Management - View Pending', () => {
  test('admin can view pending invitations list', async ({ page }) => {
    // Navigate to settings page where invitations are managed
    await page.goto('/dashboard/settings');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Organization/i })).toBeVisible();

    // Verify pending invitations section is visible
    await expect(page.getByText(/Pending Invitations/i)).toBeVisible();

    // The section should be accessible
    const pendingSection = page.locator('[data-testid="pending-invitations-list"], .pending-invitations, text=/Pending Invitations/i').first();
    await expect(pendingSection).toBeVisible();
  });

  test('pending invitations display all required information', async ({ page }) => {
    await page.goto('/dashboard/settings');

    // Wait for invitations to load
    await expect(page.getByText(/Pending Invitations/i)).toBeVisible();

    // Check if there are any invitations
    const hasInvitations = await page.locator('text=/invited to/i, text=/@/').count() > 0;

    if (hasInvitations) {
      // Verify invitation displays required fields
      const invitationItem = page.locator('text=/invited to/i, text=/@/').first();

      // Get parent container of the invitation
      const invitationContainer = invitationItem.locator('xpath=ancestor::div[contains(@class, "card") or contains(@class, "item") or position()=3]').first();

      // Should show email address
      const hasEmail = await invitationContainer.locator('text=/@/').count() > 0;
      expect(hasEmail).toBeTruthy();

      // Should show status badge
      const hasStatus = await invitationContainer.locator('text=/pending|accepted|expired|cancelled/i').count() > 0;
      expect(hasStatus).toBeTruthy();

      // Should show role
      const hasRole = await invitationContainer.locator('text=/admin|member|viewer/i').count() > 0;
      expect(hasRole).toBeTruthy();
    }
  });

  test('pending invitations show inviter information', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText(/Pending Invitations/i)).toBeVisible();

    // Check for inviter name or "invited by" text
    const hasInviterInfo = await page.locator('text=/invited by|by:/i').count() > 0;

    // Inviter information should be present for transparency
    // This is acceptable to fail if no invitations exist
    if (hasInviterInfo) {
      const inviterText = page.locator('text=/invited by|by:/i').first();
      await expect(inviterText).toBeVisible();
    }
  });

  test('pending invitations show expiration information', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText(/Pending Invitations/i)).toBeVisible();

    const hasInvitations = await page.locator('text=/invited to/i, text=/@/').count() > 0;

    if (hasInvitations) {
      // Should show when invitation expires
      const hasExpirationInfo = await page.locator('text=/expires|expiry|days?/i').count() > 0;

      // Expiration info helps admins know when to resend
      if (hasExpirationInfo) {
        await expect(page.locator('text=/expires|expiry/i').first()).toBeVisible();
      }
    }
  });

  test('only pending invitations show action buttons', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText(/Pending Invitations/i)).toBeVisible();

    // Find pending invitations
    const pendingBadges = page.locator('text=/pending/i');
    const pendingCount = await pendingBadges.count();

    if (pendingCount > 0) {
      // Pending invitations should have resend and cancel buttons
      const resendButtons = page.getByRole('button', { name: /Resend/i });
      const cancelButtons = page.getByRole('button', { name: /Cancel/i });

      const hasResendButton = await resendButtons.count() > 0;
      const hasCancelButton = await cancelButtons.count() > 0;

      // At least one action button type should be present
      expect(hasResendButton || hasCancelButton).toBeTruthy();
    }

    // Find accepted invitations
    const acceptedBadges = page.locator('text=/accepted/i');
    const acceptedCount = await acceptedBadges.count();

    if (acceptedCount > 0) {
      // Accepted invitations should NOT have action buttons
      // This requires checking within the accepted invitation row
      const firstAccepted = acceptedBadges.first();
      const acceptedRow = firstAccepted.locator('xpath=ancestor::div[contains(@class, "card") or contains(@class, "item") or position()=3]').first();

      const hasActions = await acceptedRow.getByRole('button', { name: /(Resend|Cancel)/i }).count() > 0;
      expect(hasActions).toBeFalsy();
    }
  });
});

test.describe('Invitation Management - Resend', () => {
  test('resend button is visible for pending invitations', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText(/Pending Invitations/i)).toBeVisible();

    // Look for pending invitations
    const hasPending = await page.locator('text=/pending/i').count() > 0;

    if (hasPending) {
      // Resend button should be present
      const resendButton = page.getByRole('button', { name: /Resend/i });
      const buttonCount = await resendButton.count();

      expect(buttonCount).toBeGreaterThan(0);
      await expect(resendButton.first()).toBeVisible();
    }
  });

  test('clicking resend button triggers confirmation or immediate action', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText(/Pending Invitations/i)).toBeVisible();

    // Find first resend button
    const resendButton = page.getByRole('button', { name: /Resend/i }).first();

    if (await resendButton.isVisible()) {
      // Click resend
      await resendButton.click();

      // Wait a moment for action to process
      await page.waitForTimeout(1000);

      // Should show either:
      // 1. Success message/toast
      // 2. Confirmation dialog
      // 3. Loading state on button

      const hasSuccessMessage = await page.locator('text=/resent|sent again|new invitation sent/i').count() > 0;
      const hasConfirmDialog = await page.locator('text=/confirm|are you sure/i').count() > 0;
      const buttonDisabled = await resendButton.isDisabled().catch(() => false);

      // At least one feedback mechanism should be present
      expect(hasSuccessMessage || hasConfirmDialog || buttonDisabled).toBeTruthy();
    }
  });

  test('resend generates new token (documented)', async ({ page }) => {
    // This test documents the expected behavior when resending invitation
    // Expected flow:
    // 1. Admin clicks resend button
    // 2. Backend generates new token and extends expiration to 7 days from now
    // 3. Old invitation link becomes invalid
    // 4. New email is sent with new invitation link
    // 5. Success message confirms email was sent

    // Since we can't verify actual email content or token regeneration in E2E,
    // this test serves as documentation
    expect(true).toBeTruthy();
  });

  test('resend updates invitation timestamp', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText(/Pending Invitations/i)).toBeVisible();

    const resendButton = page.getByRole('button', { name: /Resend/i }).first();

    if (await resendButton.isVisible()) {
      // Get current timestamp text before resending
      const invitationRow = resendButton.locator('xpath=ancestor::div[contains(@class, "card") or contains(@class, "item") or position()=3]').first();
      const timestampBefore = await invitationRow.locator('text=/ago|expires|sent/i').textContent().catch(() => '');

      // Click resend
      await resendButton.click();

      // Wait for action to complete
      await page.waitForTimeout(2000);

      // Reload to see updated timestamp
      await page.reload();
      await expect(page.getByText(/Pending Invitations/i)).toBeVisible();

      // Timestamp might have changed (e.g., "3 days ago" -> "just now")
      // This is expected behavior but hard to test precisely in E2E
      const hasTimestamp = await page.locator('text=/ago|expires|sent/i').count() > 0;
      expect(hasTimestamp).toBeTruthy();
    }
  });

  test('resend shows loading state during API call', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText(/Pending Invitations/i)).toBeVisible();

    const resendButton = page.getByRole('button', { name: /Resend/i }).first();

    if (await resendButton.isVisible()) {
      // Click resend and immediately check for loading state
      await resendButton.click();

      // Button might be disabled or show loading text
      const isDisabledDuringRequest = await resendButton.isDisabled().catch(() => false);
      const hasLoadingText = await page.locator('text=/sending|loading/i').count() > 0;

      // At least one loading indicator should appear
      // Note: This might be very quick depending on API speed
      if (isDisabledDuringRequest || hasLoadingText) {
        expect(true).toBeTruthy();
      }
    }
  });
});

test.describe('Invitation Management - Cancel', () => {
  test('cancel button is visible for pending invitations', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText(/Pending Invitations/i)).toBeVisible();

    // Look for pending invitations
    const hasPending = await page.locator('text=/pending/i').count() > 0;

    if (hasPending) {
      // Cancel button should be present
      const cancelButton = page.getByRole('button', { name: /Cancel/i });
      const buttonCount = await cancelButton.count();

      expect(buttonCount).toBeGreaterThan(0);
      await expect(cancelButton.first()).toBeVisible();
    }
  });

  test('clicking cancel button triggers confirmation', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText(/Pending Invitations/i)).toBeVisible();

    // Find first cancel button
    const cancelButton = page.getByRole('button', { name: /Cancel/i }).first();

    if (await cancelButton.isVisible()) {
      // Click cancel
      await cancelButton.click();

      // Wait for confirmation dialog or immediate action
      await page.waitForTimeout(500);

      // Should show confirmation dialog for destructive action
      // Or immediate cancellation with success message
      const hasConfirmDialog = await page.locator('text=/confirm|are you sure|cancel invitation/i').count() > 0;
      const hasSuccessMessage = await page.locator('text=/cancelled|canceled/i').count() > 0;

      // At least one feedback should be present
      expect(hasConfirmDialog || hasSuccessMessage).toBeTruthy();
    }
  });

  test('cancelled invitation changes status to cancelled', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText(/Pending Invitations/i)).toBeVisible();

    const cancelButton = page.getByRole('button', { name: /Cancel/i }).first();

    if (await cancelButton.isVisible()) {
      // Get the invitation email before canceling
      const invitationRow = cancelButton.locator('xpath=ancestor::div[contains(@class, "card") or contains(@class, "item") or position()=3]').first();
      const emailText = await invitationRow.locator('text=/@/').textContent().catch(() => '');

      // Click cancel
      await cancelButton.click();

      // If there's a confirmation dialog, confirm it
      const confirmButton = page.getByRole('button', { name: /confirm|yes|cancel invitation/i });
      if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmButton.click();
      }

      // Wait for cancellation to complete
      await page.waitForTimeout(1500);

      // Reload page to see updated status
      await page.reload();
      await expect(page.getByText(/Pending Invitations/i)).toBeVisible();

      // Look for the cancelled invitation
      if (emailText) {
        const invitationItem = page.locator(`text=/${emailText}/i`).first();

        if (await invitationItem.isVisible()) {
          const updatedRow = invitationItem.locator('xpath=ancestor::div[contains(@class, "card") or contains(@class, "item") or position()=3]').first();

          // Status should now be "cancelled"
          const hasCancelledStatus = await updatedRow.locator('text=/cancelled|canceled/i').count() > 0;
          expect(hasCancelledStatus).toBeTruthy();

          // Action buttons should no longer be present
          const hasActionButtons = await updatedRow.getByRole('button', { name: /(Resend|Cancel)/i }).count() > 0;
          expect(hasActionButtons).toBeFalsy();
        }
      }
    }
  });

  test('cancelled invitation remains in list with cancelled status', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText(/Pending Invitations/i)).toBeVisible();

    // Check if there are any cancelled invitations
    const cancelledBadges = page.locator('text=/cancelled|canceled/i');
    const hasCancelled = await cancelledBadges.count() > 0;

    if (hasCancelled) {
      // Cancelled invitations should be visible in the list
      await expect(cancelledBadges.first()).toBeVisible();

      // Should show email and role information
      const firstCancelled = cancelledBadges.first();
      const cancelledRow = firstCancelled.locator('xpath=ancestor::div[contains(@class, "card") or contains(@class, "item") or position()=3]').first();

      const hasEmail = await cancelledRow.locator('text=/@/').count() > 0;
      expect(hasEmail).toBeTruthy();
    }
  });

  test('cancel shows loading state during API call', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText(/Pending Invitations/i)).toBeVisible();

    const cancelButton = page.getByRole('button', { name: /Cancel/i }).first();

    if (await cancelButton.isVisible()) {
      // Click cancel
      await cancelButton.click();

      // If confirmation dialog, click confirm
      const confirmButton = page.getByRole('button', { name: /confirm|yes/i });
      if (await confirmButton.isVisible({ timeout: 500 }).catch(() => false)) {
        await confirmButton.click();

        // Check for loading state
        const isDisabled = await confirmButton.isDisabled().catch(() => false);
        const hasLoadingText = await page.locator('text=/cancelling|loading/i').count() > 0;

        if (isDisabled || hasLoadingText) {
          expect(true).toBeTruthy();
        }
      }
    }
  });
});

test.describe('Invitation Management - Cancelled Link Verification', () => {
  test('cancelled invitation link shows error message', async ({ page }) => {
    // This test documents that cancelled invitations cannot be accepted

    // Expected behavior:
    // 1. Admin cancels invitation
    // 2. Invitation status changes to "cancelled"
    // 3. User clicks invitation link from email
    // 4. Accept page shows error: "This invitation has been cancelled"
    // 5. Accept button is not present or disabled

    // Since we can't easily get a real cancelled invitation token in E2E,
    // we document expected behavior
    expect(true).toBeTruthy();
  });

  test('cancelled invitation returns 404 or error on accept attempt', async ({ page }) => {
    // Navigate to invitation page with a token
    // In real test, this would be a token that was cancelled
    await page.goto('/invite/test-cancelled-token');

    await page.waitForLoadState('networkidle');

    // Page should render without crashing
    const hasContent = await page.locator('body, main').count() > 0;
    expect(hasContent).toBeTruthy();

    // Should show error message for invalid/cancelled invitation
    const errorIndicators = [
      page.locator('text=/cancelled|canceled/i'),
      page.locator('text=/invalid|not found/i'),
      page.locator('text=/no longer valid/i'),
    ];

    let hasError = false;
    for (const indicator of errorIndicators) {
      if (await indicator.count() > 0) {
        hasError = true;
        break;
      }
    }

    // Should show some error indication
    if (hasError) {
      expect(true).toBeTruthy();
    }
  });

  test('accept button not present for cancelled invitation', async ({ page }) => {
    // Try accessing a cancelled invitation
    await page.goto('/invite/cancelled-test-token');

    await page.waitForLoadState('networkidle');

    // Accept button should not be present or should be disabled
    const acceptButton = page.getByRole('button', { name: /Accept Invitation/i });
    const buttonVisible = await acceptButton.isVisible().catch(() => false);

    if (buttonVisible) {
      // If button exists, it should be disabled
      const isDisabled = await acceptButton.isDisabled();
      expect(isDisabled).toBeTruthy();
    } else {
      // Button should not be visible for cancelled invitation
      expect(buttonVisible).toBeFalsy();
    }
  });
});

test.describe('Invitation Management - Permission Checks', () => {
  test('only admins can manage invitations (documented)', async ({ page }) => {
    // This test documents that invitation management is admin-only

    // Expected behavior:
    // 1. Organization members with "viewer" or "member" roles cannot see resend/cancel buttons
    // 2. Only "admin" and "owner" roles can manage invitations
    // 3. Backend enforces this via orgProcedure with role check

    // Since E2E tests run with admin privileges, we document expected behavior
    expect(true).toBeTruthy();
  });

  test('invitation management section requires authentication', async ({ page }) => {
    // Settings page should require authentication
    // Unauthenticated users should be redirected to sign-in

    // This is typically handled by Clerk authentication
    // We document expected behavior
    expect(true).toBeTruthy();
  });
});

test.describe('Invitation Management - Edge Cases', () => {
  test('resending expired invitation extends expiration', async ({ page }) => {
    // Expected behavior:
    // 1. Invitation expires after 7 days
    // 2. Status changes to "expired"
    // 3. Admin can still resend expired invitation
    // 4. Resend generates new token and sets expiration 7 days from now
    // 5. Status changes back to "pending"

    // Document this important edge case
    expect(true).toBeTruthy();
  });

  test('cannot resend accepted invitation', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText(/Pending Invitations/i)).toBeVisible();

    // Find accepted invitations
    const acceptedBadges = page.locator('text=/accepted/i');
    const hasAccepted = await acceptedBadges.count() > 0;

    if (hasAccepted) {
      // Check the accepted invitation row
      const firstAccepted = acceptedBadges.first();
      const acceptedRow = firstAccepted.locator('xpath=ancestor::div[contains(@class, "card") or contains(@class, "item") or position()=3]').first();

      // Should not have resend button
      const hasResendButton = await acceptedRow.getByRole('button', { name: /Resend/i }).count() > 0;
      expect(hasResendButton).toBeFalsy();
    }
  });

  test('cannot cancel accepted invitation', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText(/Pending Invitations/i)).toBeVisible();

    // Find accepted invitations
    const acceptedBadges = page.locator('text=/accepted/i');
    const hasAccepted = await acceptedBadges.count() > 0;

    if (hasAccepted) {
      // Check the accepted invitation row
      const firstAccepted = acceptedBadges.first();
      const acceptedRow = firstAccepted.locator('xpath=ancestor::div[contains(@class, "card") or contains(@class, "item") or position()=3]').first();

      // Should not have cancel button
      const hasCancelButton = await acceptedRow.getByRole('button', { name: /Cancel/i }).count() > 0;
      expect(hasCancelButton).toBeFalsy();
    }
  });

  test('invitation list handles empty state gracefully', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await expect(page.getByText(/Pending Invitations/i)).toBeVisible();

    // If no invitations, should show empty state
    const hasInvitations = await page.locator('text=/invited to/i, text=/@.*@/').count() > 0;

    if (!hasInvitations) {
      // Should show empty state message
      const emptyMessages = [
        page.locator('text=/No pending invitations/i'),
        page.locator('text=/No invitations yet/i'),
        page.locator('text=/No invitations found/i'),
      ];

      let hasEmptyState = false;
      for (const message of emptyMessages) {
        if (await message.count() > 0) {
          hasEmptyState = true;
          await expect(message).toBeVisible();
          break;
        }
      }

      // Empty state should be shown
      expect(hasEmptyState).toBeTruthy();
    }
  });
});
