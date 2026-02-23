import { expect, test } from '@playwright/test';

/**
 * E2E Test: Invoice Generation and PDF Download
 *
 * This test suite verifies the complete invoice lifecycle:
 * 1. Subscription checkout triggers invoice generation
 * 2. invoice.payment_succeeded webhook creates invoice record
 * 3. Invoice appears in billing dashboard invoice list
 * 4. Invoice PDF can be downloaded from Stripe
 * 5. Invoice details are correctly displayed
 *
 * Prerequisites:
 * - STRIPE_SECRET_KEY configured in .env (test mode)
 * - STRIPE_WEBHOOK_SECRET configured in .env
 * - Stripe webhook endpoint running: POST /api/webhooks/stripe
 * - Database running and migrated (invoices table exists)
 * - API server running on port 4000
 * - Web server running on port 3000
 * - User authenticated as organization owner
 *
 * Test Mode:
 * - Uses Stripe test mode only
 * - Test card: 4242 4242 4242 4242
 * - No real charges are made
 * - Invoice PDFs are Stripe-hosted test documents
 *
 * Manual Testing:
 * - Most tests require completing actual Stripe checkout
 * - See detailed manual verification guides below
 * - Automated tests verify UI rendering and accessibility
 */

test.describe('Invoice generation and download', () => {
  test.describe('Automated tests - Invoice list UI verification', () => {
    test('invoice list section renders on billing page', async ({ page }) => {
      await page.goto('/dashboard/billing');

      // Invoice section should be visible
      const invoiceSection = page.locator('section').filter({ hasText: /Invoice History|Billing History/i });
      await expect(invoiceSection).toBeVisible();

      // Section should have heading
      await expect(page.getByRole('heading', { name: /Invoice History/i })).toBeVisible();

      // Section should have description
      await expect(page.getByText(/View and download your past invoices/i)).toBeVisible();
    });

    test('empty state displays when no invoices exist', async ({ page }) => {
      await page.goto('/dashboard/billing');

      // Look for empty state message (might be visible if no subscriptions)
      const emptyStateText = page.getByText(/No invoices yet|Your invoice history will appear here/i);

      // Either empty state or actual invoices should be present
      const hasEmptyState = await emptyStateText.isVisible().catch(() => false);
      const hasInvoiceItems = await page.locator('[data-testid="invoice-item"]').count() > 0;

      // One of these should be true
      expect(hasEmptyState || hasInvoiceItems).toBeTruthy();
    });

    test('invoice items display required information', async ({ page }) => {
      await page.goto('/dashboard/billing');

      // Check if any invoices are present
      const invoiceItems = page.locator('.rounded-lg.border.bg-muted\\/30');
      const invoiceCount = await invoiceItems.count();

      if (invoiceCount > 0) {
        // First invoice should have all required elements
        const firstInvoice = invoiceItems.first();

        // Should have file icon
        await expect(firstInvoice.locator('svg[class*="lucide"]').first()).toBeVisible();

        // Should have date (in various possible formats)
        await expect(firstInvoice.locator('text=/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i')).toBeVisible();

        // Should have status badge
        await expect(firstInvoice.locator('text=/Paid|Open|Draft|Void/i')).toBeVisible();

        // Should have amount
        await expect(firstInvoice.locator('text=/Amount:|\\$/i')).toBeVisible();
      }
    });

    test('invoice status badges have correct styling', async ({ page }) => {
      await page.goto('/dashboard/billing');

      // Status badges should have proper styling
      const statusBadges = page.locator('.rounded-full.border.px-2\\.5.py-0\\.5');
      const badgeCount = await statusBadges.count();

      if (badgeCount > 0) {
        // First badge should have status text
        const firstBadge = statusBadges.first();
        await expect(firstBadge).toBeVisible();

        // Badge should have one of the expected statuses
        const badgeText = await firstBadge.textContent();
        expect(badgeText?.toLowerCase()).toMatch(/paid|open|draft|void|uncollectible/);
      }
    });

    test('invoice download links are accessible', async ({ page }) => {
      await page.goto('/dashboard/billing');

      // Check for PDF download or View links
      const invoiceItems = page.locator('.rounded-lg.border.bg-muted\\/30');
      const invoiceCount = await invoiceItems.count();

      if (invoiceCount > 0) {
        const firstInvoice = invoiceItems.first();

        // Should have either PDF link, View link, or "No links available" message
        const hasPdfLink = await firstInvoice.getByText('PDF').isVisible().catch(() => false);
        const hasViewLink = await firstInvoice.getByText('View').isVisible().catch(() => false);
        const hasNoLinks = await firstInvoice.getByText('No links available').isVisible().catch(() => false);

        // At least one should be true
        expect(hasPdfLink || hasViewLink || hasNoLinks).toBeTruthy();
      }
    });

    test('invoice links open in new tab', async ({ page }) => {
      await page.goto('/dashboard/billing');

      // Check that invoice links have target="_blank"
      const pdfLinks = page.locator('a:has-text("PDF")');
      const viewLinks = page.locator('a:has-text("View")');

      if (await pdfLinks.count() > 0) {
        await expect(pdfLinks.first()).toHaveAttribute('target', '_blank');
        await expect(pdfLinks.first()).toHaveAttribute('rel', 'noopener noreferrer');
      }

      if (await viewLinks.count() > 0) {
        await expect(viewLinks.first()).toHaveAttribute('target', '_blank');
        await expect(viewLinks.first()).toHaveAttribute('rel', 'noopener noreferrer');
      }
    });

    test('invoice dates are formatted correctly', async ({ page }) => {
      await page.goto('/dashboard/billing');

      const invoiceItems = page.locator('.rounded-lg.border.bg-muted\\/30');
      const invoiceCount = await invoiceItems.count();

      if (invoiceCount > 0) {
        const firstInvoice = invoiceItems.first();

        // Should have date in format like "Jan 15, 2024" or "Feb 23, 2026"
        const datePattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/i;
        await expect(firstInvoice.locator(`text=${datePattern}`)).toBeVisible();
      }
    });

    test('invoice amounts are formatted as currency', async ({ page }) => {
      await page.goto('/dashboard/billing');

      const invoiceItems = page.locator('.rounded-lg.border.bg-muted\\/30');
      const invoiceCount = await invoiceItems.count();

      if (invoiceCount > 0) {
        const firstInvoice = invoiceItems.first();

        // Should have currency symbol ($ or other) followed by amount
        // Pattern matches: $29.00, $0.00, USD 29.00, etc.
        await expect(firstInvoice.locator('text=/Amount:/i')).toBeVisible();
        await expect(firstInvoice.locator('text=/\\$|USD|EUR|GBP/i')).toBeVisible();
      }
    });
  });

  test.describe('Manual verification - Complete invoice generation flow', () => {
    test.skip('MANUAL: Complete subscription checkout and verify invoice generation', async () => {
      /**
       * Manual Test Procedure: Invoice Generation via Subscription Checkout
       *
       * This test verifies the complete flow from subscription creation to invoice generation.
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * PREREQUISITES
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * 1. Environment Setup:
       *    - API server running: pnpm dev:api (port 4000)
       *    - Web server running: pnpm dev:web (port 3000)
       *    - PostgreSQL database running and migrated
       *    - Redis running (for usage tracking)
       *
       * 2. Stripe Configuration:
       *    - STRIPE_SECRET_KEY=sk_test_... (in .env)
       *    - STRIPE_WEBHOOK_SECRET=whsec_... (in .env)
       *    - Ensure these are TEST mode keys, not live keys
       *
       * 3. Stripe CLI Setup:
       *    - Install: brew install stripe/stripe-cli/stripe
       *    - Authenticate: stripe login
       *    - Forward webhooks: stripe listen --forward-to http://localhost:4000/webhooks/stripe
       *    - Copy webhook signing secret from CLI output to .env as STRIPE_WEBHOOK_SECRET
       *    - Restart API server after updating .env
       *
       * 4. Browser Setup:
       *    - Open http://localhost:3000 in browser
       *    - Sign in as organization owner
       *    - Ensure organization is on Free plan
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * STEP 1: VERIFY INITIAL STATE (NO INVOICES)
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * 1.1. Navigate to billing page:
       *      http://localhost:3000/dashboard/billing
       *
       * 1.2. Verify invoice list shows empty state:
       *      ✓ "No invoices yet" message visible
       *      ✓ "Your invoice history will appear here once you have an active subscription"
       *
       * 1.3. Query database to confirm no invoices:
       *      psql $DATABASE_URL -c "SELECT COUNT(*) as invoice_count FROM invoices;"
       *
       *      Expected output:
       *      ┌───────────────┐
       *      │ invoice_count │
       *      ├───────────────┤
       *      │             0 │
       *      └───────────────┘
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * STEP 2: COMPLETE STRIPE CHECKOUT
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * 2.1. On billing page, find Pro plan card
       *
       * 2.2. Click "Upgrade to Pro" button
       *
       * 2.3. Verify redirect to Stripe Checkout page:
       *      ✓ URL contains: checkout.stripe.com
       *      ✓ Page shows "Pro Plan" or similar subscription title
       *      ✓ Amount shows correct price (e.g., $29.00/month)
       *
       * 2.4. Fill in Stripe test card details:
       *      Card number:  4242 4242 4242 4242
       *      Expiry:       12/34 (any future date)
       *      CVC:          123 (any 3 digits)
       *      Name:         Test User
       *      Email:        test@example.com (or your test email)
       *      ZIP:          12345 (any 5 digits)
       *
       * 2.5. Click "Subscribe" button
       *
       * 2.6. Wait for processing (usually 2-5 seconds)
       *
       * 2.7. Verify redirect back to:
       *      http://localhost:3000/dashboard/billing
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * STEP 3: VERIFY WEBHOOK PROCESSING
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * 3.1. Check Stripe CLI terminal output:
       *      Look for TWO webhook events (in order):
       *
       *      Event 1: checkout.session.completed
       *      ✓ Status: 200 OK
       *      ✓ Event ID: evt_... (note this for debugging)
       *
       *      Event 2: invoice.payment_succeeded
       *      ✓ Status: 200 OK
       *      ✓ Event ID: evt_... (this creates the invoice record)
       *
       * 3.2. Check API server logs:
       *      Look for webhook processing logs:
       *      ✓ "Handling webhook event: checkout.session.completed"
       *      ✓ "Handling webhook event: invoice.payment_succeeded"
       *      ✓ No error messages
       *
       * 3.3. Verify database subscription created:
       *      psql $DATABASE_URL -c "SELECT stripe_subscription_id, plan, status FROM subscriptions ORDER BY created_at DESC LIMIT 1;"
       *
       *      Expected output:
       *      ┌─────────────────────────┬──────┬────────┐
       *      │ stripe_subscription_id  │ plan │ status │
       *      ├─────────────────────────┼──────┼────────┤
       *      │ sub_1234567890abcdef    │ pro  │ active │
       *      └─────────────────────────┴──────┴────────┘
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * STEP 4: VERIFY INVOICE RECORD CREATED
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * 4.1. Query invoices table:
       *      psql $DATABASE_URL -c "SELECT stripe_invoice_id, amount_paid, currency, status, invoice_pdf IS NOT NULL as has_pdf, hosted_invoice_url IS NOT NULL as has_url FROM invoices ORDER BY created_at DESC LIMIT 1;"
       *
       *      Expected output:
       *      ┌──────────────────────┬─────────────┬──────────┬────────┬─────────┬─────────┐
       *      │ stripe_invoice_id    │ amount_paid │ currency │ status │ has_pdf │ has_url │
       *      ├──────────────────────┼─────────────┼──────────┼────────┼─────────┼─────────┤
       *      │ in_1234567890abcdef  │ 29.00       │ usd      │ paid   │ t       │ t       │
       *      └──────────────────────┴─────────────┴──────────┴────────┴─────────┴─────────┘
       *
       * 4.2. Get full invoice details:
       *      psql $DATABASE_URL -c "SELECT * FROM invoices ORDER BY created_at DESC LIMIT 1;"
       *
       *      Verify all fields populated:
       *      ✓ organization_id: (UUID)
       *      ✓ stripe_invoice_id: in_...
       *      ✓ amount_paid: 29.00 (or subscription price)
       *      ✓ amount_due: 29.00 (or subscription price)
       *      ✓ currency: usd
       *      ✓ status: paid
       *      ✓ invoice_pdf: https://pay.stripe.com/invoice/... (Stripe-hosted PDF URL)
       *      ✓ hosted_invoice_url: https://invoice.stripe.com/... (Stripe-hosted invoice page)
       *      ✓ billing_period_start: (timestamp)
       *      ✓ billing_period_end: (timestamp)
       *      ✓ created_at: (recent timestamp)
       *      ✓ updated_at: (recent timestamp)
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * STEP 5: VERIFY INVOICE APPEARS IN UI
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * 5.1. Refresh billing page:
       *      http://localhost:3000/dashboard/billing
       *      (If page already open, just refresh with F5 or Cmd+R)
       *
       * 5.2. Scroll down to "Invoice History" section
       *
       * 5.3. Verify invoice appears in list:
       *      ✓ Invoice date visible (e.g., "Feb 23, 2026")
       *      ✓ Status badge shows "Paid" with green styling
       *      ✓ Amount displays correctly (e.g., "$29.00")
       *      ✓ Billing period shows (e.g., "Feb 23, 2026 - Mar 23, 2026")
       *      ✓ File icon visible next to invoice
       *
       * 5.4. Verify invoice action buttons present:
       *      ✓ "PDF" button visible with download icon
       *      ✓ "View" button visible with external link icon
       *      ✓ Both buttons have hover effect (background changes)
       *
       * 5.5. Take screenshot for documentation:
       *      Invoice should look similar to:
       *      ┌─────────────────────────────────────────────────────────────────┐
       *      │ Invoice History                                           📄    │
       *      │ View and download your past invoices                            │
       *      ├─────────────────────────────────────────────────────────────────┤
       *      │ 📄  Feb 23, 2026  [Paid]                          [PDF] [View]  │
       *      │     Amount: $29.00 • Feb 23, 2026 - Mar 23, 2026                │
       *      └─────────────────────────────────────────────────────────────────┘
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * STEP 6: TEST PDF DOWNLOAD
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * 6.1. Click the "PDF" button on the invoice
       *
       * 6.2. Verify new tab opens with Stripe PDF URL:
       *      ✓ URL starts with: https://pay.stripe.com/invoice/
       *      ✓ URL contains: /pdf or similar parameter
       *
       * 6.3. Verify PDF loads in browser or downloads:
       *      ✓ PDF renders in browser (or download dialog appears)
       *      ✓ PDF is a valid document (not corrupted)
       *
       * 6.4. Verify PDF content includes:
       *      ✓ Invoice number (e.g., "XXXXXXXX-0001")
       *      ✓ Date issued
       *      ✓ Amount due/paid
       *      ✓ Description (e.g., "Pro Plan subscription")
       *      ✓ Stripe branding/footer
       *      ✓ Organization/customer information
       *
       * 6.5. Download PDF to verify file:
       *      - File should download successfully
       *      - File size should be reasonable (typically 20-100 KB)
       *      - File should open in PDF viewer
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * STEP 7: TEST INVOICE VIEW PAGE
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * 7.1. Return to billing page (close PDF tab)
       *
       * 7.2. Click the "View" button on the invoice
       *
       * 7.3. Verify new tab opens with Stripe invoice page:
       *      ✓ URL starts with: https://invoice.stripe.com/i/
       *      ✓ Page shows Stripe-hosted invoice interface
       *
       * 7.4. Verify invoice details page includes:
       *      ✓ Invoice number prominently displayed
       *      ✓ Date issued and due date
       *      ✓ Payment status (Paid)
       *      ✓ Amount breakdown (subtotal, tax if any, total)
       *      ✓ Line items (Pro Plan subscription)
       *      ✓ Customer information
       *      ✓ Payment method (last 4 digits of card)
       *      ✓ "Download PDF" button on Stripe page
       *
       * 7.5. Optional: Download PDF from Stripe invoice page:
       *      Click "Download PDF" button
       *      Verify same PDF downloads as previous test
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * STEP 8: TEST INVOICE LIST REFRESH
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * 8.1. Return to billing page
       *
       * 8.2. Open browser DevTools (F12 or Cmd+Option+I)
       *
       * 8.3. Go to Network tab
       *
       * 8.4. Refresh the page (F5 or Cmd+R)
       *
       * 8.5. Verify API call to fetch invoices:
       *      ✓ Request to: /api/trpc/billing.listInvoices
       *      ✓ Status: 200 OK
       *      ✓ Response contains invoice data
       *
       * 8.6. Verify invoice still displays correctly after refresh:
       *      ✓ Same invoice visible
       *      ✓ All details unchanged
       *      ✓ Links still functional
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * STEP 9: TEST MULTIPLE INVOICES (OPTIONAL)
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * 9.1. Trigger another invoice.payment_succeeded webhook:
       *      stripe trigger invoice.payment_succeeded
       *
       * 9.2. Check API logs for webhook processing
       *
       * 9.3. Query database for multiple invoices:
       *      psql $DATABASE_URL -c "SELECT stripe_invoice_id, amount_paid, status, created_at FROM invoices ORDER BY created_at DESC LIMIT 5;"
       *
       * 9.4. Refresh billing page
       *
       * 9.5. Verify multiple invoices display:
       *      ✓ Invoices sorted by date (newest first)
       *      ✓ Each invoice has proper formatting
       *      ✓ Each invoice has download/view buttons
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * VERIFICATION CHECKLIST
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * Core Functionality:
       * ✅ Subscription checkout creates subscription record
       * ✅ invoice.payment_succeeded webhook received
       * ✅ Invoice record created in database with all fields
       * ✅ invoice_pdf URL populated from Stripe
       * ✅ hosted_invoice_url URL populated from Stripe
       * ✅ Invoice appears in billing dashboard list
       *
       * UI Display:
       * ✅ Invoice date formatted correctly (e.g., "Feb 23, 2026")
       * ✅ Invoice amount formatted as currency (e.g., "$29.00")
       * ✅ Invoice status badge shows "Paid" with green styling
       * ✅ Billing period displays correctly
       * ✅ File icon visible
       *
       * Download Functionality:
       * ✅ "PDF" button visible and clickable
       * ✅ PDF link opens in new tab
       * ✅ PDF URL points to Stripe-hosted document
       * ✅ PDF loads/downloads successfully
       * ✅ PDF content is valid and complete
       *
       * View Functionality:
       * ✅ "View" button visible and clickable
       * ✅ View link opens in new tab
       * ✅ View URL points to Stripe invoice page
       * ✅ Invoice details page loads correctly
       * ✅ All invoice information visible on Stripe page
       *
       * Data Integrity:
       * ✅ Database invoice matches Stripe invoice
       * ✅ Amount calculations correct (cents to dollars)
       * ✅ Currency stored correctly
       * ✅ Timestamps accurate
       * ✅ Organization ID linked correctly
       *
       * Error Handling:
       * ✅ No console errors in browser
       * ✅ No errors in API logs
       * ✅ No errors in Stripe webhook logs
       * ✅ All links working (no 404s)
       *
       * Security:
       * ✅ Using test mode Stripe keys (sk_test_, not sk_live_)
       * ✅ Webhook signature verified
       * ✅ PDF URLs are Stripe-hosted (not exposing internal data)
       * ✅ Links open in new tab with rel="noopener noreferrer"
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * TROUBLESHOOTING
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * Issue: Invoice doesn't appear after checkout
       * Solutions:
       * - Check Stripe CLI is running: stripe listen --forward-to http://localhost:4000/webhooks/stripe
       * - Verify STRIPE_WEBHOOK_SECRET in .env matches CLI output
       * - Check API logs for webhook processing errors
       * - Manually trigger webhook: stripe trigger invoice.payment_succeeded
       *
       * Issue: PDF link doesn't work
       * Solutions:
       * - Verify invoice_pdf field in database is not NULL
       * - Check if Stripe test mode PDFs are accessible
       * - Try View link instead (hosted_invoice_url)
       * - Check browser console for CORS errors
       *
       * Issue: Invoice shows wrong amount
       * Solutions:
       * - Verify Stripe subscription price configuration
       * - Check cents-to-dollars conversion in webhook handler
       * - Query database: SELECT amount_paid, amount_due FROM invoices;
       * - Compare with Stripe Dashboard invoice
       *
       * Issue: Database query returns no invoices
       * Solutions:
       * - Verify webhook was processed: Check API logs
       * - Check Stripe Dashboard for invoice creation
       * - Manually trigger webhook: stripe trigger invoice.payment_succeeded
       * - Verify organization has Stripe customer ID
       *
       * Issue: Multiple invoices not appearing
       * Solutions:
       * - Check invoice list limit (default: 10)
       * - Verify tRPC query parameters
       * - Check browser console for React errors
       * - Refresh page with cache disabled (Cmd+Shift+R)
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * SUCCESS CRITERIA
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * This test is SUCCESSFUL if:
       *
       * 1. ✅ Subscription checkout completed without errors
       * 2. ✅ invoice.payment_succeeded webhook processed successfully
       * 3. ✅ Invoice record created in database with all required fields
       * 4. ✅ Invoice appears in billing dashboard invoice list
       * 5. ✅ Invoice displays correct date, amount, status, and period
       * 6. ✅ PDF download button works and opens Stripe PDF
       * 7. ✅ View button works and opens Stripe invoice page
       * 8. ✅ PDF content is valid and complete
       * 9. ✅ Invoice page shows all details correctly
       * 10. ✅ No console errors or warnings
       *
       * If all criteria are met, the invoice generation and download feature is working correctly.
       */
    });

    test.skip('MANUAL: Test invoice status changes and updates', async () => {
      /**
       * Manual Test Procedure: Invoice Status Updates
       *
       * This test verifies that invoice status changes are reflected in the UI.
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * PREREQUISITES
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * - Complete previous test (invoice generation) first
       * - At least one invoice exists in database
       * - Stripe CLI running and forwarding webhooks
       * - API and web servers running
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * TEST 1: PAID INVOICE (Default from successful payment)
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * 1.1. Navigate to billing page:
       *      http://localhost:3000/dashboard/billing
       *
       * 1.2. Find invoice in list
       *
       * 1.3. Verify status badge:
       *      ✓ Shows "Paid"
       *      ✓ Green background color
       *      ✓ Green text color
       *
       * 1.4. Verify database status:
       *      psql $DATABASE_URL -c "SELECT stripe_invoice_id, status FROM invoices WHERE status = 'paid' LIMIT 1;"
       *
       *      Expected:
       *      ┌───────────────────────┬────────┐
       *      │ stripe_invoice_id     │ status │
       *      ├───────────────────────┼────────┤
       *      │ in_1234567890abcdef   │ paid   │
       *      └───────────────────────┴────────┘
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * TEST 2: OPEN INVOICE (From failed payment)
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * 2.1. Trigger failed payment webhook:
       *      stripe trigger invoice.payment_failed
       *
       * 2.2. Verify webhook processed:
       *      Check API logs for: "Handling webhook event: invoice.payment_failed"
       *
       * 2.3. Verify database record:
       *      psql $DATABASE_URL -c "SELECT stripe_invoice_id, status, amount_paid, amount_due FROM invoices WHERE status = 'open' LIMIT 1;"
       *
       *      Expected:
       *      ┌───────────────────────┬────────┬─────────────┬────────────┐
       *      │ stripe_invoice_id     │ status │ amount_paid │ amount_due │
       *      ├───────────────────────┼────────┼─────────────┼────────────┤
       *      │ in_9876543210fedcba   │ open   │ 0.00        │ 29.00      │
       *      └───────────────────────┴────────┴─────────────┴────────────┘
       *
       * 2.4. Refresh billing page
       *
       * 2.5. Find the failed invoice in list
       *
       * 2.6. Verify status badge:
       *      ✓ Shows "Open"
       *      ✓ Blue background color
       *      ✓ Blue text color
       *
       * 2.7. Verify amount shows as due:
       *      ✓ Amount displays (e.g., "$29.00")
       *      ✓ Status indicates payment is needed
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * TEST 3: INVOICE SORTING (Newest First)
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * 3.1. Ensure multiple invoices exist (from previous tests)
       *
       * 3.2. Query database to verify order:
       *      psql $DATABASE_URL -c "SELECT stripe_invoice_id, status, created_at FROM invoices ORDER BY created_at DESC LIMIT 5;"
       *
       * 3.3. Navigate to billing page
       *
       * 3.4. Verify invoices display in same order:
       *      ✓ Newest invoice at top
       *      ✓ Older invoices below
       *      ✓ Dates descending
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * TEST 4: INVOICE LIMIT (Default 10)
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * 4.1. If you have less than 10 invoices, generate more:
       *      for i in {1..12}; do stripe trigger invoice.payment_succeeded; sleep 2; done
       *
       * 4.2. Verify database has >10 invoices:
       *      psql $DATABASE_URL -c "SELECT COUNT(*) as total FROM invoices;"
       *
       * 4.3. Refresh billing page
       *
       * 4.4. Count visible invoices:
       *      Should show exactly 10 invoices (default limit)
       *
       * 4.5. Verify oldest invoice not visible (11th+ invoice hidden)
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * VERIFICATION CHECKLIST
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * Status Display:
       * ✅ "Paid" status shows green badge
       * ✅ "Open" status shows blue badge
       * ✅ Status badge text is capitalized
       * ✅ Badge styling matches design system
       *
       * Invoice Information:
       * ✅ Date formatted correctly for all invoices
       * ✅ Amount formatted as currency
       * ✅ Billing period displays for all invoices
       * ✅ Download/View links present where applicable
       *
       * Sorting and Pagination:
       * ✅ Invoices sorted by created_at DESC
       * ✅ Newest invoice appears first
       * ✅ Default limit of 10 enforced
       * ✅ No duplicate invoices
       *
       * Real-time Updates:
       * ✅ Page refresh shows new invoices
       * ✅ Webhook creates invoice immediately
       * ✅ Status updates reflect in UI
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * SUCCESS CRITERIA
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * This test is SUCCESSFUL if:
       *
       * 1. ✅ Paid invoices show green "Paid" badge
       * 2. ✅ Failed payment invoices show blue "Open" badge
       * 3. ✅ Invoices sorted newest first
       * 4. ✅ Invoice list respects 10-item limit
       * 5. ✅ All invoice details display correctly
       * 6. ✅ Status colors match design system
       */
    });

    test.skip('MANUAL: Test edge cases and error handling', async () => {
      /**
       * Manual Test Procedure: Invoice Edge Cases
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * EDGE CASE 1: INVOICE WITHOUT PDF OR HOSTED URL
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * 1.1. Manually insert invoice without PDF/URL:
       *      psql $DATABASE_URL <<SQL
       *      INSERT INTO invoices (
       *        organization_id,
       *        stripe_invoice_id,
       *        amount_paid,
       *        amount_due,
       *        currency,
       *        status,
       *        invoice_pdf,
       *        hosted_invoice_url
       *      ) VALUES (
       *        (SELECT id FROM organizations LIMIT 1),
       *        'in_test_no_links',
       *        29.00,
       *        29.00,
       *        'usd',
       *        'paid',
       *        NULL,
       *        NULL
       *      );
       *      SQL
       *
       * 1.2. Refresh billing page
       *
       * 1.3. Find the test invoice
       *
       * 1.4. Verify fallback text displays:
       *      ✓ "No links available" message shows
       *      ✓ No broken PDF or View buttons
       *      ✓ Invoice still displays other information correctly
       *
       * 1.5. Clean up test invoice:
       *      psql $DATABASE_URL -c "DELETE FROM invoices WHERE stripe_invoice_id = 'in_test_no_links';"
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * EDGE CASE 2: INVOICE WITH NON-USD CURRENCY
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * 2.1. Create test invoice with EUR:
       *      psql $DATABASE_URL <<SQL
       *      INSERT INTO invoices (
       *        organization_id,
       *        stripe_invoice_id,
       *        amount_paid,
       *        amount_due,
       *        currency,
       *        status
       *      ) VALUES (
       *        (SELECT id FROM organizations LIMIT 1),
       *        'in_test_eur',
       *        25.00,
       *        25.00,
       *        'eur',
       *        'paid'
       *      );
       *      SQL
       *
       * 2.2. Refresh billing page
       *
       * 2.3. Verify currency formatting:
       *      ✓ Amount shows with Euro symbol (€) or "EUR"
       *      ✓ Format: "€25.00" or "EUR 25.00"
       *      ✓ No JavaScript errors in console
       *
       * 2.4. Clean up:
       *      psql $DATABASE_URL -c "DELETE FROM invoices WHERE stripe_invoice_id = 'in_test_eur';"
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * EDGE CASE 3: INVOICE WITH NULL BILLING PERIOD
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * 3.1. Create test invoice without billing period:
       *      psql $DATABASE_URL <<SQL
       *      INSERT INTO invoices (
       *        organization_id,
       *        stripe_invoice_id,
       *        amount_paid,
       *        amount_due,
       *        currency,
       *        status,
       *        billing_period_start,
       *        billing_period_end
       *      ) VALUES (
       *        (SELECT id FROM organizations LIMIT 1),
       *        'in_test_no_period',
       *        29.00,
       *        29.00,
       *        'usd',
       *        'paid',
       *        NULL,
       *        NULL
       *      );
       *      SQL
       *
       * 3.2. Refresh billing page
       *
       * 3.3. Verify graceful handling:
       *      ✓ Invoice still displays
       *      ✓ No billing period text (or shows "N/A")
       *      ✓ No JavaScript errors
       *
       * 3.4. Clean up:
       *      psql $DATABASE_URL -c "DELETE FROM invoices WHERE stripe_invoice_id = 'in_test_no_period';"
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * EDGE CASE 4: VERY LARGE INVOICE AMOUNT
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * 4.1. Create test invoice with large amount:
       *      psql $DATABASE_URL <<SQL
       *      INSERT INTO invoices (
       *        organization_id,
       *        stripe_invoice_id,
       *        amount_paid,
       *        amount_due,
       *        currency,
       *        status
       *      ) VALUES (
       *        (SELECT id FROM organizations LIMIT 1),
       *        'in_test_large',
       *        9999999.99,
       *        9999999.99,
       *        'usd',
       *        'paid'
       *      );
       *      SQL
       *
       * 4.2. Refresh billing page
       *
       * 4.3. Verify formatting:
       *      ✓ Amount formatted with thousands separators: "$9,999,999.99"
       *      ✓ No layout overflow or breaking
       *      ✓ Decimal places preserved
       *
       * 4.4. Clean up:
       *      psql $DATABASE_URL -c "DELETE FROM invoices WHERE stripe_invoice_id = 'in_test_large';"
       *
       * ═══════════════════════════════════════════════════════════════════════════════
       * VERIFICATION CHECKLIST
       * ═══════════════════════════════════════════════════════════════════════════════
       *
       * ✅ Invoice without PDF/URL shows "No links available"
       * ✅ Non-USD currencies formatted correctly
       * ✅ NULL billing periods handled gracefully
       * ✅ Large amounts formatted with separators
       * ✅ No JavaScript errors for edge cases
       * ✅ UI doesn't break with unusual data
       * ✅ All test data cleaned up
       */
    });
  });
});
