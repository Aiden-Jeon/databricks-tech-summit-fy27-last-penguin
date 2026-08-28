CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TABLE "app"."action_recommendations" (
	"id" text PRIMARY KEY NOT NULL,
	"segment_id" text NOT NULL,
	"recommended_action" text,
	"predicted_conversion_lift" double precision,
	"predicted_net_value_usd" double precision,
	"action_ranking" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scored_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'default' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."experiments" (
	"id" text PRIMARY KEY NOT NULL,
	"experiment_id" text NOT NULL,
	"experiment_name" text,
	"variant" text,
	"feature_area" text,
	"tested_cohort" text,
	"tested_platform" text,
	"won" boolean,
	"observed_lift" double precision,
	"description" text,
	"is_active" boolean
);
--> statement-breakpoint
CREATE TABLE "app"."feature_decisions_app" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"segment_id" text NOT NULL,
	"action_type" text NOT NULL,
	"target_experiment_id" text,
	"flag_key" text,
	"variant" text,
	"rollout_pct" integer,
	"drafted_note" text,
	"predicted_conversion_lift" double precision,
	"status" text DEFAULT 'proposed' NOT NULL,
	"approved_by" text,
	"audit_trail" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "app"."feature_decisions_app" ADD CONSTRAINT "feature_decisions_app_status_check" CHECK ("app"."feature_decisions_app"."status" IN ('investigating', 'investigation_failed', 'proposed', 'approved', 'committed'));
--> statement-breakpoint
CREATE TABLE "app"."feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_email" text NOT NULL,
	"value" text NOT NULL,
	"rationale" text,
	"trace_id" text,
	"mlflow_assessment_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"position" integer NOT NULL,
	"trace_id" text,
	"thinking" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"canceled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."open_sliding" (
	"id" text PRIMARY KEY NOT NULL,
	"segment_id" text NOT NULL,
	"cohort" text,
	"platform" text,
	"mau" integer,
	"conversion_rate" double precision,
	"conversion_drop" double precision,
	"conversion_at_risk_usd" double precision,
	"has_matching_experiment" boolean,
	"matching_experiment_id" text,
	"matching_experiment_lift" double precision,
	"neighbor_flag_key" text
);
--> statement-breakpoint
CREATE TABLE "app"."segment_position" (
	"id" text PRIMARY KEY NOT NULL,
	"segment_id" text NOT NULL,
	"cohort" text,
	"platform" text,
	"region" text,
	"mau" integer,
	"segment_summary" text,
	"conversion_rate" double precision,
	"conversion_rate_3w_ago" double precision,
	"conversion_drop" double precision,
	"sessions" integer,
	"slide_signal_score" double precision,
	"conversion_at_risk_usd" double precision,
	"conv_band" text
);
--> statement-breakpoint
ALTER TABLE "app"."feedback" ADD CONSTRAINT "feedback_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "app"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "app"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recommendations_segment_idx" ON "app"."action_recommendations" USING btree ("segment_id");--> statement-breakpoint
CREATE INDEX "conversations_user_idx" ON "app"."conversations" USING btree ("user_email","updated_at");--> statement-breakpoint
CREATE INDEX "conversations_kind_idx" ON "app"."conversations" USING btree ("user_email","kind");--> statement-breakpoint
CREATE INDEX "experiments_name_idx" ON "app"."experiments" USING btree ("experiment_name");--> statement-breakpoint
CREATE INDEX "feature_decisions_segment_idx" ON "app"."feature_decisions_app" USING btree ("segment_id");--> statement-breakpoint
CREATE INDEX "feature_decisions_created_idx" ON "app"."feature_decisions_app" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "feedback_message_idx" ON "app"."feedback" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_convo_pos_uq" ON "app"."messages" USING btree ("conversation_id","position");--> statement-breakpoint
CREATE INDEX "open_sliding_segment_idx" ON "app"."open_sliding" USING btree ("segment_id");--> statement-breakpoint
CREATE INDEX "segment_position_band_idx" ON "app"."segment_position" USING btree ("conv_band");--> statement-breakpoint
CREATE INDEX "segment_position_id_idx" ON "app"."segment_position" USING btree ("segment_id");
