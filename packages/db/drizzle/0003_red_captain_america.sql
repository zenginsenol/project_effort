ALTER TABLE "sessions" ADD COLUMN "search_vector" "tsvector";--> statement-breakpoint
CREATE INDEX "idx_sessions_search_vector" ON "sessions" USING btree ("search_vector");