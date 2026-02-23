# Stripe Webhook Testing Guide

This guide explains how to test Stripe webhook event handling in the billing system.

## Quick Start

### 1. Run Automated Tests

```bash
# Run all E2E tests including webhook tests
pnpm test:e2e

# Run only webhook tests
pnpm test:e2e stripe-webhook-handling
```

**What these tests verify:**
- ✓ Webhook endpoint exists and is accessible
- ✓ Webhook endpoint requires `stripe-signature` header
- ✓ Webhook endpoint rejects invalid signatures
- ✓ Billing page reflects subscription changes
- ✓ Invoice list updates after payment webhooks

### 2. Run Manual Webhook Tests with Stripe CLI

#### Prerequisites

1. **Install Stripe CLI:**
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. **Authenticate with Stripe:**
   ```bash
   stripe login
   ```

3. **Start your local services:**
   ```bash
   # Terminal 1: Start API server
   pnpm dev:api

   # Terminal 2: Start web app
   pnpm dev:web
   ```

4. **Forward webhooks to local server:**
   ```bash
   # Terminal 3: Start webhook forwarding
   stripe listen --forward-to http://localhost:4000/webhooks/stripe
   ```

5. **Update webhook secret:**
   - Copy the webhook signing secret from the CLI output (looks like `whsec_...`)
   - Add to `.env` file:
     ```
     STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef
     ```
   - Restart API server to load new secret

#### Test Individual Webhook Events

**Test 1: Subscription Updated**
```bash
stripe trigger customer.subscription.updated
```
Verifies: Subscription status and plan updates in database

**Test 2: Payment Succeeded**
```bash
stripe trigger invoice.payment_succeeded
```
Verifies: Invoice record created with status="paid"

**Test 3: Payment Failed**
```bash
stripe trigger invoice.payment_failed
```
Verifies: Failed invoice created with status="open" and warning logged

**Test 4: Checkout Completed**
```bash
# Use real checkout flow instead:
# 1. Go to http://localhost:3000/dashboard/billing
# 2. Click "Upgrade to Pro"
# 3. Complete checkout with test card: 4242 4242 4242 4242
```
Verifies: Subscription and invoice created after successful checkout

**Test 5: Subscription Deleted**
```bash
stripe trigger customer.subscription.deleted
```
Verifies: Subscription canceled and organization downgraded to free plan

## Verification Checklist

After triggering each webhook event:

### 1. Check Stripe CLI Output
```
✓ customer.subscription.updated [evt_...] → succeeded (200)
```
All events should show "succeeded" with 200 status code.

### 2. Check API Server Logs
```
✓ Handling webhook event: customer.subscription.updated
✓ Webhook processed successfully
✗ Should NOT see: "Subscription not found in database"
✗ Should NOT see: Error stack traces
```

### 3. Verify Database Changes

**For subscription events:**
```sql
-- Check subscription status
SELECT id, plan, status, cancel_at_period_end, updated_at
FROM subscriptions
ORDER BY updated_at DESC
LIMIT 1;

-- Check organization plan
SELECT id, name, current_plan, updated_at
FROM organizations
ORDER BY updated_at DESC
LIMIT 1;
```

**For invoice events:**
```sql
-- Check invoice created
SELECT stripe_invoice_id, amount_paid, amount_due, status, created_at
FROM invoices
ORDER BY created_at DESC
LIMIT 1;

-- Count invoices by status
SELECT status, COUNT(*)
FROM invoices
GROUP BY status;
```

### 4. Verify UI Updates

1. Go to: `http://localhost:3000/dashboard/billing`
2. Refresh page
3. Check:
   - ✓ Current plan displays correctly
   - ✓ Usage limits match plan
   - ✓ Invoices appear in history
   - ✓ Invoice status badges correct (Paid/Open)
   - ✓ No console errors

## Common Issues & Solutions

### Issue: "Missing stripe-signature header"
**Solution:** Ensure you're using Stripe CLI to trigger events, not curl or Postman

### Issue: "Webhook signature verification failed"
**Solution:**
1. Check `STRIPE_WEBHOOK_SECRET` is set in `.env`
2. Restart API server after changing `.env`
3. Use webhook secret from `stripe listen` output (not from Stripe Dashboard)

### Issue: "Subscription not found in database"
**Solution:**
1. Create a subscription first via checkout flow
2. Ensure organization has `stripe_customer_id` set
3. Check database for existing subscription record

### Issue: Webhook processed but UI not updating
**Solution:**
1. Hard refresh browser (Cmd/Ctrl + Shift + R)
2. Check browser console for errors
3. Verify tRPC queries are fetching latest data
4. Check database to confirm changes were saved

## Test Cards

Use these test cards for checkout flow:

| Card Number         | Scenario                    |
|---------------------|----------------------------|
| 4242 4242 4242 4242 | Successful payment         |
| 4000 0000 0000 0002 | Card declined              |
| 4000 0025 0000 3155 | Requires authentication    |
| 4000 0000 0000 9995 | Insufficient funds         |

**Card details for all test cards:**
- Expiry: Any future date (e.g., 12/34)
- CVC: Any 3 digits (e.g., 123)
- ZIP: Any 5 digits (e.g., 12345)

## Security Testing

**Test signature verification:**
```bash
# Should FAIL - missing signature
curl -X POST http://localhost:4000/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"type":"customer.subscription.updated","data":{"object":{}}}'

# Should FAIL - invalid signature
curl -X POST http://localhost:4000/webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "stripe-signature: invalid_sig_123" \
  -d '{"type":"customer.subscription.updated","data":{"object":{}}}'
```

Both should return 400 error with message about signature.

## Complete Lifecycle Test

Test the full subscription lifecycle:

```bash
# 1. Create subscription (use UI checkout)
# Go to /dashboard/billing → Upgrade to Pro → Complete checkout

# 2. Update subscription
stripe trigger customer.subscription.updated

# 3. Generate invoice
stripe trigger invoice.payment_succeeded

# 4. Fail payment
stripe trigger invoice.payment_failed

# 5. Cancel subscription
stripe trigger customer.subscription.deleted
```

After each step, verify database and UI updates.

## Additional Resources

- **Detailed test procedures:** See `apps/web/e2e/stripe-webhook-handling.spec.ts`
- **E2E test guide:** See `apps/web/e2e/E2E_TESTING_GUIDE.md`
- **Testing checklist:** See `apps/web/e2e/TESTING_CHECKLIST.md`
- **Stripe CLI docs:** https://stripe.com/docs/stripe-cli
- **Stripe test mode:** https://stripe.com/docs/testing

## Support

If tests fail or webhooks aren't processing:

1. Check all services are running (API, web, Stripe CLI)
2. Verify webhook secret matches in `.env` and Stripe CLI
3. Check database is accessible
4. Review API server logs for errors
5. Ensure test mode is enabled (not live mode)
6. Verify no hardcoded secrets in code

For detailed troubleshooting, see the manual test procedures in `stripe-webhook-handling.spec.ts`.
