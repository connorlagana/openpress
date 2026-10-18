CREATE TABLE "abuse_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid,
	"url" text NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"reporter_email" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_connection_sites" (
	"connection_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	CONSTRAINT "agent_connection_sites_connection_id_site_id_pk" PRIMARY KEY("connection_id","site_id")
);
--> statement-breakpoint
CREATE TABLE "agent_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" text,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"scopes" text[] NOT NULL,
	"all_sites" boolean DEFAULT false NOT NULL,
	"confirm_publish" boolean DEFAULT false NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"connection_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"prefix" text,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"path" text NOT NULL,
	"visitor_hash" text NOT NULL,
	"referrer_host" text,
	"referrer_category" text NOT NULL,
	"day" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"site_id" uuid,
	"connection_id" uuid,
	"via" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"alt_text" text,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "nav_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"location" text NOT NULL,
	"label" text NOT NULL,
	"href" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"redirect_uris" text[] NOT NULL,
	"client_uri" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_codes" (
	"code_hash" text PRIMARY KEY NOT NULL,
	"connection_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_challenge" text NOT NULL,
	"resource" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"max_sites" integer NOT NULL,
	"max_storage_bytes" bigint NOT NULL,
	"max_upload_bytes" integer NOT NULL,
	"max_posts_per_site" integer NOT NULL,
	"mcp_requests_per_minute" integer NOT NULL,
	"monthly_pageviews" integer NOT NULL,
	"custom_domains" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"content_md" text NOT NULL,
	"created_by" uuid,
	"created_via" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"kind" text DEFAULT 'post' NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text,
	"content_md" text DEFAULT '' NOT NULL,
	"content_html" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"cover_media_id" uuid,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"author_name" text,
	"seo_title" text,
	"seo_description" text,
	"og_image_url" text,
	"canonical_url" text,
	"noindex" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_via" text DEFAULT 'dashboard' NOT NULL,
	"agent_connection_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"from_path" text NOT NULL,
	"to_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_members" (
	"site_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_members_site_id_user_id_pk" PRIMARY KEY("site_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"subdomain" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text,
	"description" text,
	"template" text DEFAULT 'editorial' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"logo_media_id" uuid,
	"favicon_media_id" uuid,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"suspended_at" timestamp with time zone,
	"suspension_reason" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"site_id" uuid PRIMARY KEY NOT NULL,
	"tokens" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"plan_id" text DEFAULT 'free' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"suspended_at" timestamp with time zone,
	"suspension_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_connection_sites" ADD CONSTRAINT "agent_connection_sites_connection_id_agent_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."agent_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_connection_sites" ADD CONSTRAINT "agent_connection_sites_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_connections" ADD CONSTRAINT "agent_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_connections" ADD CONSTRAINT "agent_connections_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tokens" ADD CONSTRAINT "agent_tokens_connection_id_agent_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."agent_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nav_items" ADD CONSTRAINT "nav_items_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_connection_id_agent_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."agent_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_revisions" ADD CONSTRAINT "post_revisions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_revisions" ADD CONSTRAINT "post_revisions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_members" ADD CONSTRAINT "site_members_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_members" ADD CONSTRAINT "site_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_connections_user_idx" ON "agent_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_tokens_connection_idx" ON "agent_tokens" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "analytics_site_day_idx" ON "analytics_events" USING btree ("site_id","day");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_site_idx" ON "audit_logs" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX "media_site_idx" ON "media" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "media_storage_key" ON "media" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "nav_items_site_idx" ON "nav_items" USING btree ("site_id","location","position");--> statement-breakpoint
CREATE INDEX "post_revisions_post_idx" ON "post_revisions" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_site_kind_slug_live_key" ON "posts" USING btree ("site_id","kind","slug") WHERE "posts"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "posts_site_status_idx" ON "posts" USING btree ("site_id","kind","status","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "redirects_site_from_key" ON "redirects" USING btree ("site_id","from_path");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "site_members_user_idx" ON "site_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sites_subdomain_live_key" ON "sites" USING btree ("subdomain") WHERE "sites"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "sites_owner_idx" ON "sites" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree (lower("email"));