-- Wave-3 rollback migration
-- Remove persistent cost analysis workspace table and indexes.

DROP INDEX IF EXISTS "idx_cost_analyses_github_integration";
DROP INDEX IF EXISTS "idx_cost_analyses_created_by";
DROP INDEX IF EXISTS "idx_cost_analyses_project_id";
DROP INDEX IF EXISTS "idx_cost_analyses_organization_id";

DROP TABLE IF EXISTS "cost_analyses";
