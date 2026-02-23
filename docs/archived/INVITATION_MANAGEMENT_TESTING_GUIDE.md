# Invitation Management E2E Testing Guide

## Overview
This guide covers manual E2E testing for invitation management operations (resend, cancel). The automated tests in `apps/web/e2e/invitation-management.spec.ts` cover UI validation, but manual testing is required to verify email delivery, token regeneration, and end-to-end invitation invalidation.

## Prerequisites
- Running development environment (API + Web + DB)
- Resend API key configured in `.env`
- At least one organization with admin access
- Email client access to verify email delivery

## Test Scenarios

### Scenario 1: View Pending Invitations
**Objective**: Verify that admins can view all pending invitations with complete information

**Steps**:
1. Sign in as organization admin
2. Navigate to Settings (`/dashboard/settings`)
3. Scroll to "Pending Invitations" section
4. Verify the following information is displayed for each invitation:
   - Email address
   - Role (admin/member/viewer badge)
   - Status (pending badge)
   - Inviter name ("Invited by: [name]")
   - Sent date/time (e.g., "Sent 2 days ago")
   - Expiration info (e.g., "Expires in 5 days")
   - Resend button (enabled)
   - Cancel button (enabled)

**Expected Result**:
- All pending invitations are visible
- All fields display correct information
- Action buttons are present and enabled for pending invitations only
- Accepted/expired/cancelled invitations do not have action buttons

**Database Verification**:
```sql
-- Check invitation records
SELECT id, email, role, status, invited_by, expires_at, created_at, updated_at
FROM organization_invitations
WHERE organization_id = 'your-org-id'
ORDER BY created_at DESC;
```

---

### Scenario 2: Resend Invitation
**Objective**: Verify that resending an invitation generates a new token and sends a new email

**Steps**:
1. In Settings, find a pending invitation
2. Note the current "Sent" timestamp
3. Click the "Resend" button
4. Verify loading state appears
5. Wait for success message
6. Check email inbox for new invitation email
7. Verify "Sent" timestamp updated to "just now" or similar
8. Inspect database to verify new token was generated

**Expected Result**:
- Success toast/message appears: "Invitation resent successfully"
- New email arrives at recipient's inbox
- Email contains organization name, role, and invitation link
- Database shows updated `updated_at` timestamp
- Database shows new `token` value (different from before)
- Database shows updated `expires_at` (7 days from resend time)
- Status remains "pending"

**Database Verification**:
```sql
-- Before resend: Note the token and updated_at
SELECT id, email, token, status, expires_at, updated_at
FROM organization_invitations
WHERE email = 'test@example.com';

-- After resend: Verify token changed and timestamps updated
SELECT id, email, token, status, expires_at, updated_at
FROM organization_invitations
WHERE email = 'test@example.com';

-- Token should be different, updated_at should be recent, expires_at should be ~7 days from now
```

**Email Verification**:
- Subject: "You're invited to join [Organization Name] on EstimatePro"
- From: EstimatePro (via Resend)
- Body contains:
  - Organization name
  - Inviter name
  - Role assignment (e.g., "You've been invited as a Member")
  - "Accept Invitation" button with new invitation link
  - Expiration notice (7 days)

**API Verification**:
```bash
# Call resend endpoint (you need actual invitation ID)
curl -X POST http://localhost:4000/trpc/invitation.resend \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "invitationId": "invitation-uuid-here"
  }'

# Expected response:
# { "status": "success", "message": "Invitation resent" }
```

---

### Scenario 3: Cancel Invitation
**Objective**: Verify that canceling an invitation updates status and invalidates the invitation link

**Steps**:
1. In Settings, find a pending invitation
2. Copy the invitation link from the most recent email (or from database)
3. Click the "Cancel" button
4. Verify confirmation dialog appears (if implemented)
5. Confirm cancellation
6. Verify loading state appears
7. Wait for success message
8. Verify invitation status changes to "cancelled"
9. Verify action buttons disappear for this invitation
10. Try to access the copied invitation link
11. Verify invitation link shows error message

**Expected Result**:
- Confirmation dialog appears (optional, but recommended for destructive action)
- Success message appears: "Invitation cancelled successfully"
- Status badge changes from "pending" to "cancelled"
- Resend and Cancel buttons disappear
- Invitation remains in list (not deleted)
- Database shows `status = 'cancelled'`
- Accessing invitation link shows error: "This invitation has been cancelled" or "Invitation not found"
- Accept button is not present on cancelled invitation page

**Database Verification**:
```sql
-- Before cancel
SELECT id, email, token, status
FROM organization_invitations
WHERE email = 'test@example.com';

-- After cancel
SELECT id, email, token, status, updated_at
FROM organization_invitations
WHERE email = 'test@example.com';

-- status should be 'cancelled', updated_at should be recent
```

**Cancelled Link Test**:
1. Copy invitation link before canceling (from email or database)
2. Cancel the invitation via UI
3. Open invitation link in new browser tab/incognito
4. Expected: Error page showing "This invitation has been cancelled" or similar
5. Expected: No "Accept Invitation" button present
6. Expected: Page suggests contacting organization admin for new invitation

---

### Scenario 4: Verify Cancelled Invitation Cannot Be Accepted
**Objective**: Ensure cancelled invitations are fully invalidated and cannot be used

**Steps**:
1. Create a new invitation for test email
2. Check email and copy the invitation link
3. Cancel the invitation via Settings
4. Open invitation link in incognito/private browser window
5. Attempt to click accept (if button exists)
6. Verify appropriate error is shown

**Expected Result**:
- Invitation page loads without crashing
- Error message displayed: "This invitation has been cancelled", "Invalid invitation", or "Invitation not found"
- Accept button is either:
  - Not present at all, OR
  - Present but disabled with tooltip explaining it's cancelled
- Page provides helpful message (e.g., "Contact the organization admin for a new invitation")
- No organization membership is created

**API Verification**:
```bash
# Try to accept cancelled invitation (use token from cancelled invitation)
curl -X POST http://localhost:4000/trpc/invitation.accept \
  -H "Content-Type: application/json" \
  -d '{
    "token": "cancelled-invitation-token-here"
  }'

# Expected response: 404 or 400 error
# { "error": { "message": "Invitation not found or is no longer valid" } }
```

**Database Verification**:
```sql
-- After attempting to accept cancelled invitation
SELECT id, email, status, updated_at
FROM organization_invitations
WHERE token = 'cancelled-token';

-- Status should still be 'cancelled', not 'accepted'

-- No new organization membership should be created
SELECT id, user_id, organization_id, role
FROM organization_members
WHERE user_id = 'test-user-id'
AND organization_id = 'test-org-id';

-- Should return no new rows
```

---

### Scenario 5: Resend Expired Invitation
**Objective**: Verify that admins can resend expired invitations to reactivate them

**Steps**:
1. Create an invitation (or use database to manually expire one)
2. Wait 7 days OR manually update database to expire it:
   ```sql
   UPDATE organization_invitations
   SET expires_at = NOW() - INTERVAL '1 day',
       status = 'expired'
   WHERE email = 'test@example.com';
   ```
3. Reload Settings page
4. Find the expired invitation
5. Verify status shows "expired"
6. Click "Resend" button (should be available for expired invitations)
7. Wait for success message
8. Verify status changes back to "pending"
9. Verify new email is sent
10. Verify new expiration is 7 days from now

**Expected Result**:
- Expired invitations can be resent
- Resending expired invitation generates new token
- Status changes from "expired" to "pending"
- New email is sent
- Expiration is extended to 7 days from resend time
- Old invitation link no longer works
- New invitation link works correctly

**Database Verification**:
```sql
-- Before resend (expired invitation)
SELECT id, email, token, status, expires_at, updated_at
FROM organization_invitations
WHERE email = 'test@example.com';
-- status = 'expired', expires_at < NOW()

-- After resend
SELECT id, email, token, status, expires_at, updated_at
FROM organization_invitations
WHERE email = 'test@example.com';
-- status = 'pending', expires_at > NOW(), token is new, updated_at is recent
```

---

### Scenario 6: Permission Checks
**Objective**: Verify that only admins can manage invitations

**Steps**:
1. Create a test user with "member" or "viewer" role
2. Sign in as that user
3. Navigate to Settings
4. Find invitations section
5. Verify no resend/cancel buttons are shown
6. Attempt to call resend/cancel API directly (via curl or browser console)

**Expected Result**:
- Non-admin users can view invitations list (or section is hidden entirely)
- Resend and Cancel buttons are not visible to non-admins
- Direct API calls return 403 Forbidden error
- Error message: "You do not have permission to manage invitations"

**API Permission Test**:
```bash
# Call with member/viewer auth token
curl -X POST http://localhost:4000/trpc/invitation.cancel \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer NON_ADMIN_TOKEN" \
  -d '{
    "invitationId": "some-invitation-id"
  }'

# Expected: 403 Forbidden
# { "error": { "message": "Insufficient permissions" } }
```

---

## Automated Test Execution

Run the automated E2E tests:

```bash
# Run all invitation management tests
pnpm test:e2e invitation-management.spec.ts

# Run with UI for debugging
pnpm test:e2e:ui invitation-management.spec.ts

# Run specific test
pnpm test:e2e invitation-management.spec.ts -g "resend button is visible"
```

## Common Issues

### Issue: Resend doesn't send email
**Check**:
- `RESEND_API_KEY` is set in `.env`
- Resend API key is valid (not expired or rate limited)
- Check API logs for Resend errors
- Verify email is not in spam folder

### Issue: Cancel doesn't update status
**Check**:
- Database connection is working
- Check API logs for errors
- Verify invitation ID is correct
- Refresh browser to see updated status

### Issue: Cancelled link still works
**Check**:
- Backend `accept` endpoint checks status before accepting
- Database query includes `status = 'pending'` filter
- Token lookup returns 404 for non-pending invitations

## Success Criteria

All tests pass when:
- [x] Admin can view pending invitations with complete information
- [x] Resend generates new token and sends new email
- [x] Resend extends expiration to 7 days from now
- [x] Cancel updates status to "cancelled"
- [x] Cancel removes action buttons
- [x] Cancelled invitation link shows error message
- [x] Cancelled invitation cannot be accepted
- [x] Expired invitations can be resent and reactivated
- [x] Non-admin users cannot manage invitations
- [x] All automated E2E tests pass

## Notes

- Invitation management is a critical security feature - ensure proper permissions
- Token regeneration on resend prevents replay attacks
- Cancelled invitations should remain in database for audit trail
- Consider implementing rate limiting on resend to prevent spam
