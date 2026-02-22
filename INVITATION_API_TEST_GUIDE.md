# Invitation API Testing Guide

This document provides curl commands and test scenarios for the invitation API endpoints.

## Prerequisites

1. Start the API server:
```bash
pnpm dev:api
```

2. Ensure the following environment variables are set in `.env`:
- `DATABASE_URL` - PostgreSQL connection
- `RESEND_API_KEY` - Resend email service API key
- `CLERK_SECRET_KEY` - Clerk authentication key
- `NEXT_PUBLIC_APP_URL` - Frontend URL (for invitation links)

## API Endpoints

The invitation router is registered at `/trpc/invitation` with the following endpoints:

### 1. Create Invitation (Authenticated - Org Admin)

**Endpoint**: `POST /trpc/invitation.create`

**Authentication**: Requires valid Clerk JWT token and organization membership

**Request**:
```bash
curl -X POST http://localhost:4000/trpc/invitation.create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_JWT_TOKEN" \
  -d '{
    "email": "newmember@example.com",
    "role": "member",
    "organizationId": "org_xxxxx"
  }'
```

**Expected Response** (200):
```json
{
  "result": {
    "data": {
      "id": "uuid-here",
      "organizationId": "org_xxxxx",
      "email": "newmember@example.com",
      "role": "member",
      "invitedBy": "user-uuid",
      "token": "unique-invitation-token",
      "status": "pending",
      "expiresAt": "2026-03-01T12:00:00.000Z",
      "createdAt": "2026-02-22T12:00:00.000Z",
      "updatedAt": "2026-02-22T12:00:00.000Z"
    }
  }
}
```

**Side Effects**:
- Creates invitation record in database
- Sends invitation email via Resend
- Email contains one-click accept link

### 2. List Invitations (Authenticated - Org Admin)

**Endpoint**: `POST /trpc/invitation.list`

**Authentication**: Requires valid Clerk JWT token and organization membership

**Request**:
```bash
curl -X POST http://localhost:4000/trpc/invitation.list \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_JWT_TOKEN" \
  -d '{
    "organizationId": "org_xxxxx"
  }'
```

**Expected Response** (200):
```json
{
  "result": {
    "data": [
      {
        "id": "uuid-here",
        "organizationId": "org_xxxxx",
        "email": "newmember@example.com",
        "role": "member",
        "status": "pending",
        "expiresAt": "2026-03-01T12:00:00.000Z",
        "createdAt": "2026-02-22T12:00:00.000Z",
        "organization": {
          "id": "org_xxxxx",
          "name": "My Organization"
        },
        "inviter": {
          "id": "user-uuid",
          "email": "admin@example.com",
          "firstName": "Admin",
          "lastName": "User"
        }
      }
    ]
  }
}
```

### 3. Cancel Invitation (Authenticated - Org Admin)

**Endpoint**: `POST /trpc/invitation.cancel`

**Authentication**: Requires valid Clerk JWT token and organization membership

**Request**:
```bash
curl -X POST http://localhost:4000/trpc/invitation.cancel \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_JWT_TOKEN" \
  -d '{
    "invitationId": "uuid-here"
  }'
```

**Expected Response** (200):
```json
{
  "result": {
    "data": {
      "id": "uuid-here",
      "status": "cancelled",
      "updatedAt": "2026-02-22T12:30:00.000Z"
    }
  }
}
```

### 4. Resend Invitation (Authenticated - Org Admin)

**Endpoint**: `POST /trpc/invitation.resend`

**Authentication**: Requires valid Clerk JWT token and organization membership

**Request**:
```bash
curl -X POST http://localhost:4000/trpc/invitation.resend \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_JWT_TOKEN" \
  -d '{
    "invitationId": "uuid-here"
  }'
```

**Expected Response** (200):
```json
{
  "result": {
    "data": {
      "id": "uuid-here",
      "token": "new-unique-token",
      "expiresAt": "2026-03-01T12:00:00.000Z",
      "updatedAt": "2026-02-22T12:30:00.000Z"
    }
  }
}
```

**Side Effects**:
- Generates new invitation token
- Extends expiration date by 7 days from now
- Sends new invitation email with updated token

### 5. Accept Invitation (Public - No Auth Required)

**Endpoint**: `POST /trpc/invitation.accept`

**Authentication**: None (uses invitation token)

**Request**:
```bash
curl -X POST http://localhost:4000/trpc/invitation.accept \
  -H "Content-Type: application/json" \
  -d '{
    "token": "unique-invitation-token"
  }'
```

**Expected Response** (200):
```json
{
  "result": {
    "data": {
      "id": "uuid-here",
      "status": "accepted",
      "updatedAt": "2026-02-22T13:00:00.000Z"
    }
  }
}
```

## Error Scenarios

### Unauthorized Access (401)
```bash
curl -X POST http://localhost:4000/trpc/invitation.create \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "role": "member",
    "organizationId": "org_xxxxx"
  }'
```

**Response**:
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Not authenticated"
  }
}
```

### Organization Mismatch (403)
When user tries to access invitations for an organization they don't belong to.

### Invitation Not Found (404)
When trying to cancel/resend/accept an invitation that doesn't exist.

### Expired Invitation (400)
When accepting an invitation that has expired:
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invitation has expired"
  }
}
```

### Invalid Invitation Status (400)
When accepting an invitation that has already been accepted or cancelled:
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invitation is no longer valid"
  }
}
```

## Testing Workflow

### Manual End-to-End Test

1. **Create an invitation** (as org admin):
```bash
curl -X POST http://localhost:4000/trpc/invitation.create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","role":"member","organizationId":"YOUR_ORG_ID"}'
```

2. **Verify email was sent** - Check Resend dashboard or email inbox

3. **List pending invitations**:
```bash
curl -X POST http://localhost:4000/trpc/invitation.list \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"YOUR_ORG_ID"}'
```

4. **Accept the invitation** (extract token from email or response):
```bash
curl -X POST http://localhost:4000/trpc/invitation.accept \
  -H "Content-Type: application/json" \
  -d '{"token":"INVITATION_TOKEN_HERE"}'
```

5. **Verify invitation status changed** - List again to confirm status is "accepted"

### Testing Resend Functionality

1. Create invitation
2. Resend invitation:
```bash
curl -X POST http://localhost:4000/trpc/invitation.resend \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invitationId":"INVITATION_ID"}'
```
3. Verify new email was sent with new token
4. Accept using new token

### Testing Cancel Functionality

1. Create invitation
2. Cancel invitation:
```bash
curl -X POST http://localhost:4000/trpc/invitation.cancel \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invitationId":"INVITATION_ID"}'
```
3. Try to accept - should fail with "no longer valid" error

## Database Verification

After running tests, verify database state:

```sql
-- Check invitation was created
SELECT * FROM organization_invitations WHERE email = 'test@example.com';

-- Check invitation status
SELECT status, expires_at FROM organization_invitations WHERE id = 'uuid-here';

-- Check for expired invitations
SELECT * FROM organization_invitations WHERE expires_at < NOW() AND status = 'pending';
```

## Health Check

Before testing, verify API is running:
```bash
curl http://localhost:4000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-22T12:00:00.000Z"
}
```

## Notes

- All authenticated endpoints use `orgProcedure` which validates:
  - User is authenticated (valid Clerk JWT)
  - User belongs to the specified organization
  - User has appropriate role (admin/owner for invitation management)

- The `accept` endpoint uses `publicProcedure` since new users may not be authenticated yet

- Invitation tokens are cryptographically secure UUID v4 tokens

- Invitations expire after 7 days from creation/resend

- Email sending is asynchronous but errors are caught and reported
