BEGIN;
--> statement-breakpoint
ALTER TABLE "app"."feature_decisions_app" DROP CONSTRAINT IF EXISTS "feature_decisions_app_status_check";
--> statement-breakpoint
ALTER TABLE "app"."feature_decisions_app" ADD CONSTRAINT "feature_decisions_app_status_check" CHECK ("status" IN ('investigating', 'investigation_failed', 'proposed', 'approved', 'committed'));
--> statement-breakpoint
COMMIT;
