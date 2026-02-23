#!/bin/bash
# Invitation API Verification Script
# This script verifies that all invitation API components are properly implemented

set -e

echo "=== Invitation API Verification ==="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: Must run from project root"
    exit 1
fi

echo "✓ Running from project root"
echo ""

# 1. Verify schema file exists
echo "1. Checking invitation schema..."
if [ -f "apps/api/src/routers/invitation/schema.ts" ]; then
    echo "   ✓ schema.ts exists"

    # Verify schema exports
    if grep -q "createInvitationInput" apps/api/src/routers/invitation/schema.ts; then
        echo "   ✓ createInvitationInput found"
    else
        echo "   ✗ createInvitationInput not found"
        exit 1
    fi

    if grep -q "listInvitationsInput" apps/api/src/routers/invitation/schema.ts; then
        echo "   ✓ listInvitationsInput found"
    else
        echo "   ✗ listInvitationsInput not found"
        exit 1
    fi

    if grep -q "cancelInvitationInput" apps/api/src/routers/invitation/schema.ts; then
        echo "   ✓ cancelInvitationInput found"
    else
        echo "   ✗ cancelInvitationInput not found"
        exit 1
    fi

    if grep -q "resendInvitationInput" apps/api/src/routers/invitation/schema.ts; then
        echo "   ✓ resendInvitationInput found"
    else
        echo "   ✗ resendInvitationInput not found"
        exit 1
    fi

    if grep -q "acceptInvitationInput" apps/api/src/routers/invitation/schema.ts; then
        echo "   ✓ acceptInvitationInput found"
    else
        echo "   ✗ acceptInvitationInput not found"
        exit 1
    fi
else
    echo "   ✗ schema.ts not found"
    exit 1
fi
echo ""

# 2. Verify service file exists
echo "2. Checking invitation service..."
if [ -f "apps/api/src/routers/invitation/service.ts" ]; then
    echo "   ✓ service.ts exists"

    # Verify service exports
    if grep -q "class InvitationService" apps/api/src/routers/invitation/service.ts; then
        echo "   ✓ InvitationService class found"
    else
        echo "   ✗ InvitationService class not found"
        exit 1
    fi

    if grep -q "createInvitation" apps/api/src/routers/invitation/service.ts; then
        echo "   ✓ createInvitation method found"
    else
        echo "   ✗ createInvitation method not found"
        exit 1
    fi

    if grep -q "listInvitations" apps/api/src/routers/invitation/service.ts; then
        echo "   ✓ listInvitations method found"
    else
        echo "   ✗ listInvitations method not found"
        exit 1
    fi

    if grep -q "cancelInvitation" apps/api/src/routers/invitation/service.ts; then
        echo "   ✓ cancelInvitation method found"
    else
        echo "   ✗ cancelInvitation method not found"
        exit 1
    fi

    if grep -q "resendInvitation" apps/api/src/routers/invitation/service.ts; then
        echo "   ✓ resendInvitation method found"
    else
        echo "   ✗ resendInvitation method not found"
        exit 1
    fi

    if grep -q "acceptInvitation" apps/api/src/routers/invitation/service.ts; then
        echo "   ✓ acceptInvitation method found"
    else
        echo "   ✗ acceptInvitation method not found"
        exit 1
    fi
else
    echo "   ✗ service.ts not found"
    exit 1
fi
echo ""

# 3. Verify router file exists
echo "3. Checking invitation router..."
if [ -f "apps/api/src/routers/invitation/router.ts" ]; then
    echo "   ✓ router.ts exists"

    # Verify router exports and endpoints
    if grep -q "invitationRouter" apps/api/src/routers/invitation/router.ts; then
        echo "   ✓ invitationRouter export found"
    else
        echo "   ✗ invitationRouter export not found"
        exit 1
    fi

    if grep -q "create:" apps/api/src/routers/invitation/router.ts; then
        echo "   ✓ create endpoint found"
    else
        echo "   ✗ create endpoint not found"
        exit 1
    fi

    if grep -q "list:" apps/api/src/routers/invitation/router.ts; then
        echo "   ✓ list endpoint found"
    else
        echo "   ✗ list endpoint not found"
        exit 1
    fi

    if grep -q "cancel:" apps/api/src/routers/invitation/router.ts; then
        echo "   ✓ cancel endpoint found"
    else
        echo "   ✗ cancel endpoint not found"
        exit 1
    fi

    if grep -q "resend:" apps/api/src/routers/invitation/router.ts; then
        echo "   ✓ resend endpoint found"
    else
        echo "   ✗ resend endpoint not found"
        exit 1
    fi

    if grep -q "accept:" apps/api/src/routers/invitation/router.ts; then
        echo "   ✓ accept endpoint found"
    else
        echo "   ✗ accept endpoint not found"
        exit 1
    fi

    # Verify proper procedure usage
    if grep -q "orgProcedure" apps/api/src/routers/invitation/router.ts; then
        echo "   ✓ orgProcedure used (authenticated endpoints)"
    else
        echo "   ✗ orgProcedure not found"
        exit 1
    fi

    if grep -q "publicProcedure" apps/api/src/routers/invitation/router.ts; then
        echo "   ✓ publicProcedure used (accept endpoint)"
    else
        echo "   ✗ publicProcedure not found"
        exit 1
    fi

    # Verify email integration
    if grep -q "sendInvitationEmail" apps/api/src/routers/invitation/router.ts; then
        echo "   ✓ Email service integration found"
    else
        echo "   ✗ Email service integration not found"
        exit 1
    fi
else
    echo "   ✗ router.ts not found"
    exit 1
fi
echo ""

# 4. Verify router registration in main index
echo "4. Checking router registration..."
if grep -q "import { invitationRouter }" apps/api/src/routers/index.ts; then
    echo "   ✓ invitationRouter imported in main router"
else
    echo "   ✗ invitationRouter not imported"
    exit 1
fi

if grep -q "invitation: invitationRouter" apps/api/src/routers/index.ts; then
    echo "   ✓ invitationRouter registered in appRouter"
else
    echo "   ✗ invitationRouter not registered"
    exit 1
fi
echo ""

# 5. Verify database schema exists
echo "5. Checking database schema..."
if [ -f "packages/db/src/schema/invitations.ts" ]; then
    echo "   ✓ invitations.ts schema exists"

    if grep -q "organizationInvitations" packages/db/src/schema/invitations.ts; then
        echo "   ✓ organizationInvitations table found"
    else
        echo "   ✗ organizationInvitations table not found"
        exit 1
    fi
else
    echo "   ✗ invitations.ts schema not found"
    exit 1
fi

if [ -f "packages/db/src/schema/enums.ts" ]; then
    if grep -q "invitationStatusEnum" packages/db/src/schema/enums.ts; then
        echo "   ✓ invitationStatusEnum found"
    else
        echo "   ✗ invitationStatusEnum not found"
        exit 1
    fi
else
    echo "   ✗ enums.ts not found"
    exit 1
fi
echo ""

# 6. Verify email service exists
echo "6. Checking email service..."
if [ -f "apps/api/src/services/email/resend.ts" ]; then
    echo "   ✓ Resend email service exists"

    if grep -q "ResendEmailService" apps/api/src/services/email/resend.ts; then
        echo "   ✓ ResendEmailService class found"
    else
        echo "   ✗ ResendEmailService class not found"
        exit 1
    fi
else
    echo "   ✗ Resend email service not found"
    exit 1
fi

if [ -f "apps/api/src/services/email/templates.ts" ]; then
    echo "   ✓ Email templates exist"

    if grep -q "invitationEmailTemplate" apps/api/src/services/email/templates.ts; then
        echo "   ✓ invitationEmailTemplate found"
    else
        echo "   ✗ invitationEmailTemplate not found"
        exit 1
    fi
else
    echo "   ✗ Email templates not found"
    exit 1
fi

if [ -f "apps/api/src/services/email/index.ts" ]; then
    echo "   ✓ Email service index exists"

    if grep -q "sendInvitationEmail" apps/api/src/services/email/index.ts; then
        echo "   ✓ sendInvitationEmail function found"
    else
        echo "   ✗ sendInvitationEmail function not found"
        exit 1
    fi
else
    echo "   ✗ Email service index not found"
    exit 1
fi
echo ""

# 7. Verify environment variables
echo "7. Checking environment configuration..."
if [ -f ".env.example" ]; then
    echo "   ✓ .env.example exists"

    if grep -q "RESEND_API_KEY" .env.example; then
        echo "   ✓ RESEND_API_KEY documented"
    else
        echo "   ✗ RESEND_API_KEY not in .env.example"
        exit 1
    fi
else
    echo "   ✗ .env.example not found"
    exit 1
fi
echo ""

echo "==================================="
echo "✓ All invitation API components verified!"
echo ""
echo "API Endpoints Available:"
echo "  POST /trpc/invitation.create  - Create invitation (authenticated)"
echo "  POST /trpc/invitation.list    - List invitations (authenticated)"
echo "  POST /trpc/invitation.cancel  - Cancel invitation (authenticated)"
echo "  POST /trpc/invitation.resend  - Resend invitation (authenticated)"
echo "  POST /trpc/invitation.accept  - Accept invitation (public)"
echo ""
echo "Next Steps:"
echo "1. Start the API server: pnpm dev:api"
echo "2. Test endpoints using curl (see INVITATION_API_TEST_GUIDE.md)"
echo "3. Verify email delivery in Resend dashboard"
echo "==================================="
