CREATE TABLE "custom_visualizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"html" text DEFAULT '' NOT NULL,
	"css" text DEFAULT '' NOT NULL,
	"js" text DEFAULT '' NOT NULL,
	"data" jsonb,
	"data_table" jsonb,
	"height" integer DEFAULT 420 NOT NULL,
	"code_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_hash" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_by" uuid,
	"created_via" text DEFAULT 'dashboard' NOT NULL,
	"agent_connection_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "custom_visualizations" ADD CONSTRAINT "custom_visualizations_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_visualizations" ADD CONSTRAINT "custom_visualizations_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_visualizations" ADD CONSTRAINT "custom_visualizations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_viz_site_idx" ON "custom_visualizations" USING btree ("site_id","updated_at");--> statement-breakpoint
-- Same tenant isolation as charts: only site members can see or change a site's custom visualizations.
GRANT SELECT, INSERT, UPDATE, DELETE ON "custom_visualizations" TO folio_app;--> statement-breakpoint
ALTER TABLE "custom_visualizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY custom_viz_member ON "custom_visualizations" FOR ALL TO folio_app USING (app_is_member(site_id)) WITH CHECK (app_is_member(site_id));
