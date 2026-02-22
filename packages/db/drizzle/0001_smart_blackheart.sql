ALTER TABLE "tasks" ADD COLUMN "search_vector" "tsvector";--> statement-breakpoint
CREATE INDEX "idx_tasks_search_vector" ON "tasks" USING gin ("search_vector");