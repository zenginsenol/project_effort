CREATE TYPE "public"."activity_type" AS ENUM('task_created', 'task_updated', 'task_status_changed', 'session_created', 'session_completed', 'cost_analysis_created', 'cost_analysis_exported', 'integration_sync_completed', 'member_joined', 'member_left', 'project_created', 'project_updated', 'project_deleted');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'access', 'sign_in', 'sign_out', 'revoke', 'sync_initiated', 'sync_completed');--> statement-breakpoint
CREATE TYPE "public"."audit_entity_type" AS ENUM('project', 'task', 'analysis', 'session', 'integration', 'api_key', 'organization', 'user');--> statement-breakpoint
CREATE TYPE "public"."audit_event_type" AS ENUM('auth.sign_in', 'auth.sign_out', 'auth.failed_attempt', 'project.created', 'project.updated', 'project.deleted', 'task.created', 'task.updated', 'task.deleted', 'analysis.created', 'analysis.updated', 'analysis.deleted', 'session.created', 'session.updated', 'session.completed', 'integration.sync_initiated', 'integration.sync_completed', 'api_key.created', 'api_key.revoked', 'organization.settings_changed', 'organization.member_added', 'organization.member_removed', 'organization.member_role_changed');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'open', 'paid', 'void', 'uncollectible');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('session_invitation', 'vote_reminder', 'session_complete', 'task_assigned', 'task_status_change', 'sync_complete', 'mention_in_comment');--> statement-breakpoint
CREATE TYPE "public"."onboarding_step" AS ENUM('organization_created', 'project_setup', 'tasks_created', 'first_estimation');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('free', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'cancelled', 'past_due', 'trialing');--> statement-breakpoint
CREATE TABLE "onboarding_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"current_step" "onboarding_step",
	"completed_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"is_skipped" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"notification_type" "notification_type" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"metadata" jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"actor_id" uuid,
	"activity_type" "activity_type" NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_invitations" (
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
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan" "subscription_plan" DEFAULT 'free' NOT NULL,
	"status" "subscription_status" NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"stripe_invoice_id" text,
	"amount_paid" numeric(10, 2),
	"amount_due" numeric(10, 2),
	"currency" text,
	"status" "invoice_status" NOT NULL,
	"invoice_pdf" text,
	"hosted_invoice_url" text,
	"billing_period_start" timestamp with time zone,
	"billing_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"month_year" text NOT NULL,
	"ai_analyses_count" integer DEFAULT 0 NOT NULL,
	"projects_count" integer DEFAULT 0 NOT NULL,
	"team_members_count" integer DEFAULT 0 NOT NULL,
	"estimation_sessions_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_hint" text NOT NULL,
	"rate_limit" integer DEFAULT 1000 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"response_status" integer,
	"response_body" text,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"url" text NOT NULL,
	"events" jsonb NOT NULL,
	"secret" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "current_plan" "subscription_plan" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "sprint_id" uuid;--> statement-breakpoint
ALTER TABLE "session_participants" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "session_participants" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "onboarding_state" ADD CONSTRAINT "onboarding_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_state" ADD CONSTRAINT "onboarding_state_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_tracking" ADD CONSTRAINT "usage_tracking_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_api_keys" ADD CONSTRAINT "public_api_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_onboarding_state_user_id" ON "onboarding_state" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_onboarding_state_org_id" ON "onboarding_state" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_onboarding_state_completed" ON "onboarding_state" USING btree ("is_completed");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notification_prefs_user_org_type" ON "notification_preferences" USING btree ("user_id","organization_id","notification_type");--> statement-breakpoint
CREATE INDEX "idx_notification_prefs_user_id" ON "notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_id" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_organization_id" ON "notifications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_created_at" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_is_read" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "idx_activities_organization_id" ON "activities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_activities_project_id" ON "activities" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_activities_actor_id" ON "activities" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_activities_activity_type" ON "activities" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "idx_activities_created_at" ON "activities" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_invitations_token" ON "organization_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_invitations_organization_id" ON "organization_invitations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_invitations_email" ON "organization_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_invitations_status" ON "organization_invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_organization_id" ON "subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_stripe_customer_id" ON "subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_organization_id" ON "invoices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_usage_tracking_organization_id" ON "usage_tracking" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_usage_tracking_org_month" ON "usage_tracking" USING btree ("organization_id","month_year");--> statement-breakpoint
CREATE INDEX "idx_public_api_keys_organization_id" ON "public_api_keys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_public_api_keys_org_active" ON "public_api_keys" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_webhook_id" ON "webhook_deliveries" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_webhook_created" ON "webhook_deliveries" USING btree ("webhook_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_webhooks_organization_id" ON "webhooks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_webhooks_org_active" ON "webhooks" USING btree ("organization_id","is_active");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_projects_org_created" ON "projects" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_projects_org_status" ON "projects" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_tasks_sprint_id" ON "tasks" USING btree ("sprint_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_project_status" ON "tasks" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "idx_tasks_project_created" ON "tasks" USING btree ("project_id","created_at");