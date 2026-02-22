# End-to-End Invitation Flow Testing Guide

This guide provides comprehensive manual testing steps for the complete team invitation flow, including parts that cannot be easily automated (email delivery, Clerk sign-up integration).

## Prerequisites

Before testing, ensure:
1. ✅ Database is running (PostgreSQL)
2. ✅ Redis is running
3. ✅ Backend API is running (`pnpm dev:api`)
4. ✅ Frontend web app is running (`pnpm dev:web`)
5. ✅ Resend API key is configured in `.env`
6. ✅ Clerk is configured with proper environment variables
7. ✅ You have access to a test email address

## Test Scenarios

### Scenario 1: New User Invitation Flow (Primary E2E Flow)

This is the complete end-to-end flow for inviting a new user who doesn't have an EstimatePro account.

#### Step 1: Admin Creates Invitation via UI

1. **Login** as an organization admin
   - Navigate to: `http://localhost:3000/dashboard`
   - Ensure you're authenticated via Clerk

2. **Navigate to Settings**
   - Go to: `http://localhost:3000/dashboard/settings`
   - Verify the page loads correctly

3. **Open Invite Dialog**
   - Click "Invite Member" button in the Organization section
   - Dialog should open with:
     - Email input field
     - Role dropdown (Admin, Member, Viewer)
     - Send Invitation button

4. **Fill Invitation Form**
   - Enter test email: `newuser@example.com` (use a real email you can access)
   - Select role: `Member`
   - Click "Send Invitation"

5. **Verify Success**
   - ✅ Success message appears
   - ✅ Dialog closes after 2 seconds
   - ✅ Invitation appears in "Pending Invitations" list
   - ✅ Status badge shows "Pending"

**Expected Database State:**
```sql
SELECT * FROM organization_invitations WHERE email = 'newuser@example.com';
-- Should show:
-- - status: 'pending'
-- - token: random UUID
-- - expires_at: 7 days from now
-- - organization_id: your org ID
-- - invited_by: your user ID
```

#### Step 2: Backend Creates Invitation Record

**Verification:**
1. Check API logs for invitation creation
2. Verify database record was created (see SQL above)
3. Check for any errors in backend console

**Expected Backend Logs:**
```
[INFO] Creating invitation for newuser@example.com
[INFO] Generated invitation token: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
[INFO] Invitation expires at: 2026-03-01T20:00:00.000Z
```

#### Step 3: Email Service Sends Invitation Email

**Verification:**
1. Check your test email inbox (newuser@example.com)
2. Email should arrive within 1-2 minutes
3. Verify email content:
   - ✅ Subject: "You're invited to join [Organization Name] on EstimatePro"
   - ✅ From: EstimatePro (via Resend)
   - ✅ Contains organization name
   - ✅ Contains inviter's name
   - ✅ Shows assigned role
   - ✅ Has prominent "Accept Invitation" button
   - ✅ Contains invitation link: `http://localhost:3000/invite/{token}`
   - ✅ Shows expiration date (7 days from now)

**Expected Email Template:**
```
EstimatePro

Hi there!

[Inviter Name] has invited you to join [Organization Name] on EstimatePro.

You've been invited as: Member

[Accept Invitation Button]

Or copy this link: http://localhost:3000/invite/{token}

This invitation expires on [Date]
```

**Troubleshooting:**
- If email doesn't arrive, check Resend dashboard for delivery status
- Check backend logs for email sending errors
- Verify RESEND_API_KEY is correct in .env
- Check spam/junk folder

#### Step 4: New User Clicks Invitation Link

1. **Open Invitation Email**
   - Access the email inbox for newuser@example.com
   - Open the invitation email

2. **Click Accept Button**
   - Click the "Accept Invitation" button
   - Browser should open to: `http://localhost:3000/invite/{token}`

3. **Verify Accept Page Renders**
   - ✅ Page loads without errors
   - ✅ Organization name is displayed
   - ✅ Inviter's name is shown
   - ✅ Role is displayed (Member)
   - ✅ "Accept Invitation" button is visible
   - ✅ "Decline" button is visible

**Expected Page Content:**
```
You've been invited!

[Inviter Name] has invited you to join [Organization Name] as a Member.

[Accept Invitation] [Decline]
```

#### Step 5: User Completes Clerk Sign-Up

1. **Click Accept Invitation**
   - Click the "Accept Invitation" button on the accept page

2. **Clerk Sign-Up Flow**
   - If not logged in, Clerk sign-up modal should appear
   - Enter email: newuser@example.com
   - Complete Clerk authentication flow:
     - Enter verification code sent to email
     - Set password
     - Complete profile (if required)

3. **Verify Sign-Up Success**
   - ✅ Clerk account created
   - ✅ User is authenticated
   - ✅ No errors during sign-up

**Note:** The email used for invitation (newuser@example.com) should match the Clerk sign-up email.

#### Step 6: Backend Auto-Adds User to Organization

**Verification:**
1. Check backend logs for organization membership creation
2. Verify database state:

```sql
-- Check organization_members table
SELECT * FROM organization_members
WHERE user_id = '[new-user-clerk-id]'
AND organization_id = '[org-id]';

-- Should show:
-- - role: 'member' (or whatever was assigned)
-- - created_at: timestamp when invitation was accepted
```

3. Check invitation status:
```sql
SELECT status FROM organization_invitations
WHERE email = 'newuser@example.com';

-- Should show: 'accepted'
```

**Expected Backend Logs:**
```
[INFO] Invitation accepted: token={token}
[INFO] Creating organization membership for user={user-id}
[INFO] User added to organization: org={org-id}, role=member
[INFO] Invitation status updated to 'accepted'
```

#### Step 7: User Sees Organization Dashboard

**Verification:**
1. After acceptance, user should be redirected to: `http://localhost:3000/dashboard`
2. Verify dashboard loads:
   - ✅ Organization name in header/sidebar
   - ✅ User can see organization projects
   - ✅ User has appropriate permissions based on role
   - ✅ No access errors

3. **Test Organization Context:**
   - Navigate to various pages (projects, sessions, etc.)
   - Verify user has access to organization resources
   - Check that role permissions are enforced (member should not see admin-only features)

**Success Criteria:**
- ✅ New user successfully joined the organization
- ✅ User can access organization resources
- ✅ Role permissions are correctly applied
- ✅ No errors in browser console or backend logs

---

### Scenario 2: Existing User Invitation Flow

This tests inviting a user who already has an EstimatePro account.

#### Steps:

1. **Create Invitation for Existing User**
   - Login as admin
   - Go to Settings > Invite Member
   - Enter email of existing EstimatePro user
   - Send invitation

2. **Existing User Receives Email**
   - Check email inbox
   - Verify email content is correct

3. **Existing User Accepts (While Logged In)**
   - Login to EstimatePro as the existing user
   - Click invitation link from email
   - Should see accept page with organization details
   - Click "Accept Invitation"

4. **Verify Organization Added**
   - User should be added to new organization
   - Can switch organizations via organization selector
   - Has access to new organization's resources

**Expected Behavior:**
- No Clerk sign-up required (already has account)
- Direct addition to organization
- Immediate access to organization dashboard

---

### Scenario 3: Invitation Management (Resend, Cancel)

This tests the invitation management features for admins.

#### Test Resend Invitation:

1. **Create Invitation**
   - Invite a user via settings page
   - Note the invitation appears in pending list

2. **Resend Invitation**
   - In Pending Invitations list, find the invitation
   - Click "Resend" button
   - Verify:
     - ✅ Success message appears
     - ✅ New email is sent (check inbox)
     - ✅ Invitation still shows as "Pending"

3. **Verify New Token**
   - Check database:
   ```sql
   SELECT token, expires_at FROM organization_invitations
   WHERE email = 'test@example.com';
   ```
   - Token should be different (new UUID)
   - Expiration date should be extended (new 7-day period)

4. **Old Link Should Not Work**
   - Try to access invitation with old token
   - Should show "Invalid or expired invitation"

#### Test Cancel Invitation:

1. **Create Invitation**
   - Invite a user via settings page

2. **Cancel Invitation**
   - In Pending Invitations list, find the invitation
   - Click "Cancel" button
   - Confirm cancellation (if prompted)
   - Verify:
     - ✅ Success message appears
     - ✅ Invitation status changes to "Cancelled"
     - ✅ Resend/Cancel buttons disappear

3. **Verify Invitation Link No Longer Works**
   - Try to access invitation with the token
   - Should show "This invitation has been cancelled"
   - Accept button should not be available

4. **Database Verification:**
   ```sql
   SELECT status FROM organization_invitations
   WHERE email = 'test@example.com';
   ```
   - Status should be: 'cancelled'

---

### Scenario 4: Invitation Expiration

This tests the automatic expiration of invitations after 7 days.

#### Manual Expiration Test:

1. **Create Invitation**
   - Send invitation to test email

2. **Manually Expire in Database** (for testing):
   ```sql
   UPDATE organization_invitations
   SET expires_at = NOW() - INTERVAL '1 day'
   WHERE email = 'test@example.com';
   ```

3. **Verify Expired State**
   - Try to accept the invitation
   - Should show "This invitation has expired"
   - Accept button should not work

4. **Run Cleanup Cron**
   ```bash
   # The cron job runs hourly, or you can trigger manually via API
   curl -X POST http://localhost:4000/admin/run-invitation-cleanup
   ```

5. **Check Status Updated:**
   ```sql
   SELECT status FROM organization_invitations
   WHERE email = 'test@example.com';
   ```
   - Status should be: 'expired'

---

## Automated E2E Test

In addition to manual testing, run the automated Playwright E2E tests:

```bash
# Run all E2E tests
pnpm test:e2e

# Run only invitation tests
pnpm test:e2e -- invitation-flow.spec.ts

# Run with UI mode for debugging
pnpm test:e2e:ui
```

**Automated Tests Cover:**
- ✅ Settings page renders invitation section
- ✅ Invite dialog opens and closes
- ✅ Form validation works
- ✅ Pending invitations list displays
- ✅ Accept page renders
- ✅ Role selection works
- ✅ Status badges display
- ✅ Invalid token handling
- ✅ Navigation to settings

**Automated Tests DO NOT Cover:**
- ❌ Email delivery (requires real Resend API)
- ❌ Clerk sign-up flow (requires real Clerk integration)
- ❌ Actual invitation acceptance with authentication
- ❌ Organization membership creation
- ❌ Real-time database state changes

These must be tested manually as described above.

---

## Verification Checklist

Use this checklist to ensure all E2E scenarios pass:

### Database Setup
- [ ] PostgreSQL is running
- [ ] Migrations are applied
- [ ] `organization_invitations` table exists
- [ ] `invitation_status` enum exists

### API Backend
- [ ] Backend server is running
- [ ] Invitation router is registered
- [ ] Email service is configured (Resend API key)
- [ ] Invitation endpoints respond correctly

### Frontend UI
- [ ] Web app is running
- [ ] Settings page renders invitation section
- [ ] Invite dialog works
- [ ] Pending invitations list works
- [ ] Accept page (`/invite/[token]`) works

### Email Integration
- [ ] Resend API key is valid
- [ ] Test invitation email sends successfully
- [ ] Email template renders correctly
- [ ] Invitation link in email is correct

### Complete Flow (New User)
- [ ] Admin creates invitation
- [ ] Invitation record created in database
- [ ] Email sent to invitee
- [ ] Invitee clicks link and sees accept page
- [ ] Invitee completes Clerk sign-up
- [ ] User added to organization
- [ ] User can access organization dashboard

### Complete Flow (Existing User)
- [ ] Admin invites existing user
- [ ] Existing user receives email
- [ ] User accepts while logged in
- [ ] User added to new organization
- [ ] User can switch to new organization

### Invitation Management
- [ ] Admin can view pending invitations
- [ ] Admin can resend invitation (new email sent, new token)
- [ ] Admin can cancel invitation (link stops working)
- [ ] Status badges display correctly (pending, accepted, expired, cancelled)

### Security & Error Handling
- [ ] Invalid tokens show appropriate error
- [ ] Expired invitations cannot be accepted
- [ ] Cancelled invitations cannot be accepted
- [ ] Only org admins can create invitations
- [ ] Email validation prevents invalid addresses

### Cleanup & Maintenance
- [ ] Cron job runs hourly to expire old invitations
- [ ] Expired invitations marked as 'expired' in database
- [ ] Expired invitations show appropriate message on accept page

---

## Common Issues & Troubleshooting

### Email Not Received
**Possible Causes:**
- Invalid Resend API key
- Email address typo
- Resend rate limiting
- Email in spam folder

**Solutions:**
- Check Resend dashboard for delivery logs
- Verify RESEND_API_KEY in .env
- Check backend logs for errors
- Use a different email provider for testing

### Clerk Sign-Up Fails
**Possible Causes:**
- Invalid Clerk configuration
- Email mismatch (invitation email != sign-up email)
- Clerk rate limiting

**Solutions:**
- Verify Clerk environment variables
- Ensure sign-up email matches invitation email
- Check Clerk dashboard for errors

### User Not Added to Organization
**Possible Causes:**
- Invitation acceptance failed
- Database error
- Missing organization membership creation logic

**Solutions:**
- Check backend logs for errors
- Verify database state (organization_invitations, organization_members)
- Check tRPC invitation.accept endpoint response

### Invitation Link Doesn't Work
**Possible Causes:**
- Invalid token format
- Invitation expired or cancelled
- Wrong environment URL

**Solutions:**
- Verify token in database matches URL
- Check invitation status (should be 'pending')
- Ensure NEXT_PUBLIC_APP_URL is correct

---

## Performance Testing

For production readiness, also test:
- [ ] Multiple simultaneous invitations (rate limiting)
- [ ] Large organization invitation list performance
- [ ] Email sending under load
- [ ] Database query performance with many invitations

---

## Success Metrics

The E2E invitation flow is considered successful when:
1. ✅ 100% of manual test scenarios pass
2. ✅ All automated E2E tests pass
3. ✅ No errors in browser console
4. ✅ No errors in backend logs
5. ✅ Database state is correct after each step
6. ✅ Email delivery is reliable (>95% success rate)
7. ✅ Invitation acceptance rate is high (good UX)

---

## Next Steps After E2E Verification

Once E2E testing is complete:
1. Document any issues found
2. Fix any bugs or UX problems
3. Update automated tests to cover more scenarios
4. Create monitoring/alerting for invitation flow
5. Add analytics to track invitation success rate
6. Consider adding webhook notifications for invitation events
