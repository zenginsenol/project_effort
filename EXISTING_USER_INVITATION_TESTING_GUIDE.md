# Existing User Invitation Flow Testing Guide

This guide provides step-by-step manual testing procedures for inviting existing EstimatePro users to join an organization. This flow differs from new user invitations because existing users already have Clerk accounts and should be directly added to the organization upon acceptance.

## Overview

**Scenario:** An admin invites a user who already has an EstimatePro account to join their organization.

**Key Differences from New User Flow:**
- ✅ No Clerk sign-up required
- ✅ Direct organization membership creation
- ✅ User can be member of multiple organizations
- ✅ Immediate access upon acceptance

## Prerequisites

Before testing:
1. ✅ Database running (PostgreSQL)
2. ✅ Redis running
3. ✅ Backend API running (`pnpm dev:api`)
4. ✅ Frontend web app running (`pnpm dev:web`)
5. ✅ Resend API key configured
6. ✅ Clerk configured
7. ✅ **Two test accounts:**
   - **Admin account:** User who will send invitation (e.g., admin@example.com)
   - **Existing user account:** User who will receive invitation (e.g., existinguser@example.com)

## Test Scenario 1: Complete Existing User Invitation Flow

### Step 1: Admin Sends Invitation

1. **Login as Organization Admin**
   - Navigate to: `http://localhost:3000`
   - Login with admin credentials (admin@example.com)
   - Verify you're in the correct organization

2. **Navigate to Settings**
   - Go to: `http://localhost:3000/dashboard/settings`
   - Verify Organization section is visible

3. **Open Invite Dialog**
   - Click "Invite Member" button
   - Dialog should open

4. **Enter Existing User's Email**
   - Email: `existinguser@example.com` (must be email of real existing user)
   - Role: Select "Member" (or any role)
   - Click "Send Invitation"

5. **Verify Success**
   - ✅ Success message appears
   - ✅ Dialog closes
   - ✅ Invitation appears in "Pending Invitations" list with "Pending" status

**Expected Database State:**
```sql
-- Verify invitation was created
SELECT
  id, email, role, status, token, expires_at, organization_id, invited_by
FROM organization_invitations
WHERE email = 'existinguser@example.com'
ORDER BY created_at DESC
LIMIT 1;

-- Should show:
-- - status: 'pending'
-- - token: random UUID
-- - expires_at: 7 days from now
-- - role: 'member'
```

### Step 2: Existing User Receives Email

1. **Check Email Inbox**
   - Login to email for existinguser@example.com
   - Look for invitation email (should arrive within 1-2 minutes)

2. **Verify Email Content**
   - ✅ Subject: "You're invited to join [Organization Name] on EstimatePro"
   - ✅ From: EstimatePro (via Resend)
   - ✅ Contains admin's name (who sent invitation)
   - ✅ Shows organization name
   - ✅ Shows assigned role (Member)
   - ✅ Has "Accept Invitation" button
   - ✅ Contains invitation link: `http://localhost:3000/invite/{token}`
   - ✅ Shows expiration: "This invitation expires on [Date]"

3. **Extract Invitation Token**
   - Copy the invitation link from email
   - Token should be: `http://localhost:3000/invite/{UUID}`

### Step 3: User Clicks Invitation Link (While Logged In)

1. **Login as Existing User First**
   - In a **different browser or incognito window**, go to: `http://localhost:3000`
   - Login as existing user (existinguser@example.com)
   - Verify you're logged in (see your name/avatar)
   - **Important:** Note which organization you're currently in

2. **Click Invitation Link**
   - Click the invitation link from email OR
   - Paste the URL: `http://localhost:3000/invite/{token}`

3. **Verify Accept Page**
   - ✅ Page loads without errors
   - ✅ Shows "Team Invitation" heading
   - ✅ Displays organization name correctly
   - ✅ Shows inviter's name
   - ✅ Shows role (Member)
   - ✅ "Accept Invitation" button is visible
   - ✅ "Decline" button is visible
   - ✅ No Clerk sign-up flow appears (already logged in)

**Expected Page Content:**
```
Team Invitation

You've been invited to join a team on EstimatePro

Organization
[Organization Name]

Role
[Member badge]

Invited By
[Admin Name]

[Accept Invitation] [Decline]

This invitation expires on [Date]
```

### Step 4: User Accepts Invitation

1. **Click "Accept Invitation" Button**
   - Button should show loading state ("Accepting...")

2. **Verify API Call**
   - Check browser DevTools Network tab
   - Should see POST to `/trpc/invitation.accept`
   - Response should be successful (200 OK)

3. **Verify Success State**
   - ✅ Success message appears: "Invitation Accepted!"
   - ✅ Shows organization name
   - ✅ Shows "Redirecting to dashboard..." message
   - ✅ Green checkmark icon visible

4. **Automatic Redirect**
   - After 2 seconds, should redirect to: `http://localhost:3000/dashboard`

### Step 5: Backend Adds User to Organization

**Database Verification:**

```sql
-- 1. Verify invitation status updated to 'accepted'
SELECT status, updated_at
FROM organization_invitations
WHERE email = 'existinguser@example.com'
AND token = '{token-from-email}';
-- Should show: status = 'accepted'

-- 2. Verify organization membership was created
SELECT
  om.id,
  om.organization_id,
  om.user_id,
  om.role,
  om.created_at,
  u.email,
  o.name as organization_name
FROM organization_members om
JOIN users u ON om.user_id = u.id
JOIN organizations o ON om.organization_id = o.id
WHERE u.email = 'existinguser@example.com'
ORDER BY om.created_at DESC;

-- Should show:
-- - New membership record with role='member'
-- - user_id matching existing user
-- - organization_id matching inviting organization
-- - created_at timestamp when invitation was accepted

-- 3. Verify user's complete organization list
SELECT
  o.id,
  o.name,
  om.role,
  om.created_at as joined_at
FROM organization_members om
JOIN organizations o ON om.organization_id = o.id
JOIN users u ON om.user_id = u.id
WHERE u.email = 'existinguser@example.com'
ORDER BY om.created_at DESC;

-- Should show ALL organizations user is member of
```

**Backend Logs Expected:**
```
[INFO] Invitation acceptance request received: token={token}
[INFO] Invitation found: id={invitation-id}, email=existinguser@example.com
[INFO] Invitation status: pending, expires: {date}
[INFO] Looking up existing user by email: existinguser@example.com
[INFO] Existing user found: id={user-id}, clerkId={clerk-id}
[INFO] Creating organization membership
[INFO] Organization membership created: org={org-id}, user={user-id}, role=member
[INFO] Updating invitation status to 'accepted'
[INFO] Invitation acceptance complete
```

### Step 6: User Switches to New Organization

1. **Verify Dashboard Loads**
   - After redirect, dashboard should load
   - No errors in browser console

2. **Check Organization Context**
   - Look for organization name in header/sidebar
   - Should show the NEW organization (the one you just joined)
   - **Or** should show organization switcher if available

3. **Test Organization Switcher** (if available)
   - Look for organization dropdown/switcher
   - Should show:
     - Original organization
     - Newly joined organization
   - Click switcher to change organizations
   - Verify you can switch between them

4. **Verify Permissions**
   - Navigate to various pages (projects, sessions, settings)
   - Verify role-based access:
     - If invited as "Member": Should see member-level access
     - If invited as "Admin": Should see admin features
     - If invited as "Viewer": Should have read-only access

5. **Test Organization Resources**
   - Projects: Should see organization's projects (or empty state for new org)
   - Settings: Permissions based on role
   - Team: Should see other members

**Success Criteria:**
- ✅ User successfully joined new organization
- ✅ User maintains membership in original organization
- ✅ Can switch between organizations
- ✅ Correct role permissions applied
- ✅ Access to organization resources works
- ✅ No errors in console or logs

---

## Test Scenario 2: First-Time Login After Accepting

This tests when an existing user accepts invitation while NOT logged in.

### Steps:

1. **Logout** (if currently logged in)

2. **Click Invitation Link**
   - Click link from email: `http://localhost:3000/invite/{token}`

3. **Clerk Login Appears**
   - Since not logged in, Clerk should show login form
   - Enter credentials for existing user
   - Complete Clerk authentication

4. **After Login**
   - Should redirect to invitation accept page
   - OR should auto-accept and redirect to dashboard
   - User should be added to organization

5. **Verify Membership**
   - Check database (see SQL queries above)
   - Verify user can access new organization

**Expected Behavior:**
- User sees Clerk login (not sign-up)
- After login, invitation is processed
- User is added to organization
- Redirected to dashboard with new organization context

---

## Test Scenario 3: Duplicate Invitation Handling

### Test: Admin sends invitation to user already in organization

1. **Verify User is Already Member**
   ```sql
   -- Check if user is already in org
   SELECT * FROM organization_members om
   JOIN users u ON om.user_id = u.id
   WHERE u.email = 'existinguser@example.com'
   AND om.organization_id = '{org-id}';
   ```

2. **Admin Sends Invitation**
   - Go to Settings > Invite Member
   - Enter email of existing member
   - Try to send invitation

3. **Expected Behavior:**
   - **Option A:** Frontend prevents duplicate (shows error: "User is already a member")
   - **Option B:** Backend rejects duplicate (API error returned)
   - **Option C:** Invitation created but acceptance updates role instead of creating duplicate

4. **Verify No Duplicate Memberships**
   ```sql
   -- Should only have ONE membership per org
   SELECT COUNT(*) FROM organization_members
   WHERE user_id = '{user-id}'
   AND organization_id = '{org-id}';
   -- Should be 1, not 2
   ```

---

## Test Scenario 4: Multi-Organization Membership

### Test: User joins multiple organizations via invitations

1. **Setup:**
   - User is member of Organization A
   - Admin of Organization B invites user
   - Admin of Organization C invites user

2. **Accept Both Invitations**
   - Accept invitation from Organization B
   - Accept invitation from Organization C

3. **Verify Multiple Memberships**
   ```sql
   SELECT
     o.name as organization_name,
     om.role,
     om.created_at
   FROM organization_members om
   JOIN organizations o ON om.organization_id = o.id
   JOIN users u ON om.user_id = u.id
   WHERE u.email = 'existinguser@example.com'
   ORDER BY om.created_at;
   ```
   - Should show memberships in all 3 organizations

4. **Test Organization Switching**
   - Dashboard should show organization switcher
   - User can switch between all 3 organizations
   - Data is properly scoped per organization

---

## Test Scenario 5: Role Assignment

### Test: Different roles assigned via invitation

1. **Admin Invites User as "Viewer"**
   - Send invitation with role="viewer"
   - User accepts

2. **Verify Viewer Permissions**
   - User should have read-only access
   - Cannot create/edit projects
   - Cannot invite other members
   - Can view dashboards and reports

3. **Admin Invites Same User to Different Org as "Admin"**
   - Different organization invites same user
   - Role selected: "Admin"
   - User accepts

4. **Verify Admin Permissions**
   - In second organization, user should have admin access
   - Can create/edit projects
   - Can invite members
   - Can modify organization settings

5. **Verify Role Isolation**
   ```sql
   SELECT
     o.name,
     om.role
   FROM organization_members om
   JOIN organizations o ON om.organization_id = o.id
   JOIN users u ON om.user_id = u.id
   WHERE u.email = 'existinguser@example.com';
   ```
   - Should show different roles per organization

---

## Verification Checklist

### Invitation Creation
- [ ] Admin can send invitation to existing user email
- [ ] Invitation appears in pending list
- [ ] Invitation record created in database
- [ ] Email sent successfully

### Email Delivery
- [ ] Existing user receives email
- [ ] Email contains correct information
- [ ] Invitation link is valid
- [ ] Email template renders correctly

### Invitation Acceptance (Logged In)
- [ ] Logged-in user can access invitation link
- [ ] Accept page displays correctly
- [ ] No Clerk sign-up appears (already logged in)
- [ ] Accept button works
- [ ] Success message appears
- [ ] Redirects to dashboard

### Invitation Acceptance (Not Logged In)
- [ ] Clerk login appears (not sign-up)
- [ ] After login, invitation processes correctly
- [ ] User added to organization

### Organization Membership
- [ ] Invitation status updated to 'accepted'
- [ ] Organization membership created in database
- [ ] User's internal ID (not Clerk ID) linked to org
- [ ] Correct role assigned
- [ ] No duplicate memberships created

### Multi-Organization Support
- [ ] User can be member of multiple organizations
- [ ] Each membership has independent role
- [ ] Organization switcher shows all organizations
- [ ] Can switch between organizations
- [ ] Data properly scoped per organization

### Permissions
- [ ] Role-based permissions enforced
- [ ] Viewer role: read-only access
- [ ] Member role: standard access
- [ ] Admin role: full access
- [ ] Permissions isolated per organization

### Error Handling
- [ ] Cannot accept already-accepted invitation
- [ ] Cannot accept expired invitation
- [ ] Cannot accept cancelled invitation
- [ ] Duplicate invitations handled gracefully
- [ ] Invalid tokens show error

---

## Common Issues & Troubleshooting

### Issue: User not added to organization after accepting

**Possible Causes:**
- Backend accept endpoint doesn't create organization membership
- User lookup by email fails
- Organization membership creation fails
- Missing error handling

**Debug Steps:**
```sql
-- Check invitation status
SELECT * FROM organization_invitations
WHERE email = 'existinguser@example.com'
ORDER BY created_at DESC LIMIT 1;

-- Check if membership was created
SELECT * FROM organization_members om
JOIN users u ON om.user_id = u.id
WHERE u.email = 'existinguser@example.com'
ORDER BY om.created_at DESC;
```

**Check Backend Logs:**
- Look for errors during invitation acceptance
- Verify organization membership creation logged
- Check for database constraint violations

### Issue: Duplicate organization memberships

**Possible Causes:**
- Multiple invitations accepted for same org
- Missing uniqueness check
- Race condition in acceptance flow

**Fix:**
```sql
-- Check for duplicates
SELECT organization_id, user_id, COUNT(*)
FROM organization_members
GROUP BY organization_id, user_id
HAVING COUNT(*) > 1;

-- Clean up duplicates (keep most recent)
-- Manual intervention required
```

### Issue: User can't switch organizations

**Possible Causes:**
- Organization switcher not implemented
- Organization context not updating
- Frontend doesn't detect multiple memberships

**Verify:**
- Check if organization switcher component exists
- Verify user's organization list is fetched
- Check that organization ID is properly scoped in queries

### Issue: Wrong permissions after joining

**Possible Causes:**
- Role not properly assigned during membership creation
- Role from different organization being applied
- Permission checks not scoped to organization

**Debug:**
```sql
-- Verify role assignment
SELECT
  o.name,
  om.role,
  om.organization_id
FROM organization_members om
JOIN organizations o ON om.organization_id = o.id
JOIN users u ON om.user_id = u.id
WHERE u.email = 'existinguser@example.com';
```

---

## Implementation Status

### ✅ Currently Working
- Invitation creation for existing users
- Email sending to existing users
- Invitation accept page UI
- Invitation status updates

### ⚠️ Needs Verification
- **Organization membership creation on acceptance**
  - Current implementation updates invitation status to 'accepted'
  - **May not create organization_members record automatically**
  - Needs backend enhancement to call `teamService.addMember()`

### 🔧 Implementation Gap

The current `invitation.accept` endpoint needs to be enhanced:

```typescript
// Current implementation (in invitation/router.ts)
accept: publicProcedure
  .input(acceptInvitationInput)
  .mutation(async ({ input }) => {
    // ... validation ...

    // Accept invitation (updates status to 'accepted')
    const accepted = await invitationService.acceptInvitation(input.token);

    // ⚠️ MISSING: Organization membership creation
    // Should add:
    // 1. Get user by email from invitation
    // 2. If user doesn't exist, create placeholder or return error
    // 3. Create organization membership with teamService.addMember()

    return accepted;
  }),
```

**Required Enhancement:**
```typescript
// Enhanced implementation needed
accept: authedProcedure // Note: Should require authentication
  .input(acceptInvitationInput)
  .mutation(async ({ ctx, input }) => {
    const invitation = await invitationService.getInvitationByToken(input.token);
    // ... validation ...

    // Get current authenticated user
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, ctx.userId),
    });

    // Create organization membership
    await teamService.addMember({
      organizationId: invitation.organizationId,
      userId: user.id,
      role: invitation.role,
    });

    // Mark invitation as accepted
    const accepted = await invitationService.acceptInvitation(input.token);

    return accepted;
  }),
```

---

## Success Metrics

The existing user invitation flow is considered successful when:
1. ✅ Admin can invite existing users
2. ✅ Existing users receive properly formatted emails
3. ✅ Logged-in users can accept without re-authentication
4. ✅ **Organization membership is created automatically**
5. ✅ Users can access new organization immediately
6. ✅ Multi-organization membership works correctly
7. ✅ Role-based permissions are enforced
8. ✅ No duplicate memberships created
9. ✅ All error cases handled gracefully
10. ✅ No errors in console or backend logs

---

## Next Steps

1. **Run Automated E2E Tests:**
   ```bash
   pnpm test:e2e existing-user-invitation-flow.spec.ts
   ```

2. **Complete Manual Testing:**
   - Follow all scenarios in this guide
   - Document any failures
   - Verify database state at each step

3. **Fix Implementation Gaps:**
   - Enhance `invitation.accept` endpoint
   - Add organization membership creation
   - Add duplicate prevention
   - Implement organization switcher (if missing)

4. **Verify Complete Flow:**
   - Re-test after fixes
   - Ensure all acceptance criteria met
   - Update tests to reflect actual behavior

5. **Document Findings:**
   - Record test results
   - Note any deviations from expected behavior
   - Create tickets for any bugs found
