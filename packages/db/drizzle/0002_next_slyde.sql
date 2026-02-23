ALTER TABLE "cost_analyses" ADD COLUMN "search_vector" "tsvector";--> statement-breakpoint
CREATE INDEX "idx_cost_analyses_search_vector" ON "cost_analyses" USING gin ("search_vector");