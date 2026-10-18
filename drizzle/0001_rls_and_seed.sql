-- Tenant isolation. The application connects as the migration owner but runs
-- every user-scoped request inside a transaction that does
--   set local role folio_app; set_config('app.user_id', <uuid>, true)
-- folio_app has no BYPASSRLS, so these policies are the last line of defence
-- even if application-level checks have a bug. Tables with RLS enabled and no
-- policy for folio_app (sessions, oauth_codes, rate_limits, abuse_reports) are
-- only reachable from the privileged auth/public-rendering code paths.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'folio_app') THEN
    CREATE ROLE folio_app NOLOGIN;
  END IF;
END $$;
--> statement-breakpoint
GRANT folio_app TO CURRENT_USER;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO folio_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO folio_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO folio_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO folio_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO folio_app;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_member(sid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT EXISTS (SELECT 1 FROM site_members WHERE site_id = sid AND user_id = app_uid()) $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_owns_site(sid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT EXISTS (SELECT 1 FROM sites WHERE id = sid AND owner_id = app_uid()) $$;
--> statement-breakpoint
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE site_members ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE nav_items ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE post_revisions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE redirects ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE oauth_clients ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE agent_connections ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE agent_connection_sites ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE oauth_codes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE agent_tokens ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE abuse_reports ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY plans_read ON plans FOR SELECT TO folio_app USING (true);
--> statement-breakpoint
CREATE POLICY users_self_read ON users FOR SELECT TO folio_app USING (id = app_uid());
--> statement-breakpoint
CREATE POLICY users_self_update ON users FOR UPDATE TO folio_app USING (id = app_uid()) WITH CHECK (id = app_uid());
--> statement-breakpoint
CREATE POLICY sites_read ON sites FOR SELECT TO folio_app USING (owner_id = app_uid() OR app_is_member(id));
--> statement-breakpoint
CREATE POLICY sites_insert ON sites FOR INSERT TO folio_app WITH CHECK (owner_id = app_uid());
--> statement-breakpoint
CREATE POLICY sites_update ON sites FOR UPDATE TO folio_app USING (app_is_member(id)) WITH CHECK (app_is_member(id));
--> statement-breakpoint
CREATE POLICY sites_delete ON sites FOR DELETE TO folio_app USING (owner_id = app_uid());
--> statement-breakpoint
CREATE POLICY site_members_read ON site_members FOR SELECT TO folio_app USING (user_id = app_uid() OR app_is_member(site_id));
--> statement-breakpoint
CREATE POLICY site_members_insert ON site_members FOR INSERT TO folio_app WITH CHECK (app_owns_site(site_id));
--> statement-breakpoint
CREATE POLICY site_members_delete ON site_members FOR DELETE TO folio_app USING (app_owns_site(site_id));
--> statement-breakpoint
CREATE POLICY themes_member ON themes FOR ALL TO folio_app USING (app_is_member(site_id)) WITH CHECK (app_is_member(site_id));
--> statement-breakpoint
CREATE POLICY nav_items_member ON nav_items FOR ALL TO folio_app USING (app_is_member(site_id)) WITH CHECK (app_is_member(site_id));
--> statement-breakpoint
CREATE POLICY media_member ON media FOR ALL TO folio_app USING (app_is_member(site_id)) WITH CHECK (app_is_member(site_id));
--> statement-breakpoint
CREATE POLICY posts_member ON posts FOR ALL TO folio_app USING (app_is_member(site_id)) WITH CHECK (app_is_member(site_id));
--> statement-breakpoint
CREATE POLICY post_revisions_member ON post_revisions FOR ALL TO folio_app USING (app_is_member(site_id)) WITH CHECK (app_is_member(site_id));
--> statement-breakpoint
CREATE POLICY redirects_member ON redirects FOR ALL TO folio_app USING (app_is_member(site_id)) WITH CHECK (app_is_member(site_id));
--> statement-breakpoint
CREATE POLICY analytics_member_read ON analytics_events FOR SELECT TO folio_app USING (app_is_member(site_id));
--> statement-breakpoint
CREATE POLICY oauth_clients_read ON oauth_clients FOR SELECT TO folio_app USING (true);
--> statement-breakpoint
CREATE POLICY agent_connections_owner ON agent_connections FOR ALL TO folio_app USING (user_id = app_uid()) WITH CHECK (user_id = app_uid());
--> statement-breakpoint
CREATE POLICY agent_connection_sites_owner ON agent_connection_sites FOR ALL TO folio_app
  USING (EXISTS (SELECT 1 FROM agent_connections c WHERE c.id = connection_id AND c.user_id = app_uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM agent_connections c WHERE c.id = connection_id AND c.user_id = app_uid()) AND app_is_member(site_id));
--> statement-breakpoint
CREATE POLICY agent_tokens_owner ON agent_tokens FOR ALL TO folio_app
  USING (EXISTS (SELECT 1 FROM agent_connections c WHERE c.id = connection_id AND c.user_id = app_uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM agent_connections c WHERE c.id = connection_id AND c.user_id = app_uid()));
--> statement-breakpoint
CREATE POLICY audit_logs_read ON audit_logs FOR SELECT TO folio_app USING (user_id = app_uid() OR (site_id IS NOT NULL AND app_is_member(site_id)));
--> statement-breakpoint
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT TO folio_app WITH CHECK (user_id = app_uid());
--> statement-breakpoint
INSERT INTO plans (id, name, max_sites, max_storage_bytes, max_upload_bytes, max_posts_per_site, mcp_requests_per_minute, monthly_pageviews, custom_domains)
VALUES ('free', 'Free', 1, 104857600, 5242880, 500, 60, 50000, false)
ON CONFLICT (id) DO NOTHING;
