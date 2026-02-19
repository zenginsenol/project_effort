-- Wave-3 migration
-- Add persistent cost analysis workspace for save/edit/compare/export/github-sync flow.

CREATE TABLE IF NOT EXISTS "cost_analyses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "description" text,
  "source_type" text NOT NULL DEFAULT 'project_tasks',
  "source_provider" text,
  "source_model" text,
  "source_reasoning_effort" text,
  "source_input" text,
  "source_context" text,
  "parameters" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "editable_sections" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "assumptions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "task_snapshot" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "summary_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "breakdown_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "github_integration_id" uuid REFERENCES "integrations"("id") ON DELETE SET NULL,
  "github_repository" text,
  "github_issue_number" integer,
  "github_issue_url" text,
  "github_synced_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_cost_analyses_organization_id" ON "cost_analyses" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_cost_analyses_project_id" ON "cost_analyses" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_cost_analyses_created_by" ON "cost_analyses" ("created_by_user_id");
CREATE INDEX IF NOT EXISTS "idx_cost_analyses_github_integration" ON "cost_analyses" ("github_integration_id");
