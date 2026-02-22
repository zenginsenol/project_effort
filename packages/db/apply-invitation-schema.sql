-- Create invitation_status enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'expired', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create organization_invitations table if it doesn't exist
CREATE TABLE IF NOT EXISTS "organization_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "organization_role" DEFAULT 'member' NOT NULL,
	"invited_by" uuid NOT NULL,
	"token" text NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_invitations_token_unique" UNIQUE("token")
);

-- Add foreign key constraints if they don't exist
DO $$ BEGIN
    ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes if they don't exist
CREATE UNIQUE INDEX IF NOT EXISTS "idx_invitations_token" ON "organization_invitations" USING btree ("token");
CREATE INDEX IF NOT EXISTS "idx_invitations_organization_id" ON "organization_invitations" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_invitations_email" ON "organization_invitations" USING btree ("email");
CREATE INDEX IF NOT EXISTS "idx_invitations_status" ON "organization_invitations" USING btree ("status");
