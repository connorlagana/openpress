CREATE TABLE "charts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"title" text NOT NULL,
	"spec" jsonb NOT NULL,
	"created_by" uuid,
	"created_via" text DEFAULT 'dashboard' NOT NULL,
	"agent_connection_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "charts" ADD CONSTRAINT "charts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charts" ADD CONSTRAINT "charts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "charts_site_idx" ON "charts" USING btree ("site_id","updated_at");--> statement-breakpoint
-- Same tenant isolation as posts and media: only site members can see or change a site's charts.
GRANT SELECT, INSERT, UPDATE, DELETE ON "charts" TO folio_app;--> statement-breakpoint
ALTER TABLE "charts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY charts_member ON "charts" FOR ALL TO folio_app USING (app_is_member(site_id)) WITH CHECK (app_is_member(site_id));
