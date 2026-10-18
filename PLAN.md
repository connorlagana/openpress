# Implementation plan & status

Legend: [x] done and tested · [~] partial (see notes) · [ ] not started

## Phase 1 — Foundation
- [x] Repo, Next.js 16 App Router, Tailwind 4, shadcn/ui (Base UI), TypeScript strict
- [x] Drizzle schema: users, sessions, plans, sites, site_members, themes, nav_items, posts (+pages), post_revisions, redirects, media, oauth_clients, agent_connections (+sites), oauth_codes, agent_tokens, audit_logs, rate_limits, analytics_events, abuse_reports
- [x] RLS on every table, unprivileged `folio_app` role, tenant transactions (`withUser`)
- [x] Email/password auth, DB sessions (hashed tokens, httpOnly host-only cookie)
- [x] Deployment architecture: OpenNext → Cloudflare Workers, Supabase Postgres, R2 (build verified locally)

## Phase 2 — Publishing engine
- [x] Sites with free subdomains, reserved names, availability check
- [x] Host-based routing to public sites
- [x] Three templates (Editorial, Launch/SaaS, Portfolio) with structured themes
- [x] Posts, static pages, navigation, footer, logo/favicon, homepage blocks
- [x] Markdown rendering with allow-list sanitization
- [x] Media library: magic-byte validation, size/storage quotas, URL import with SSRF guard, local + R2 drivers
- [x] SEO: titles/descriptions, canonical, OG, Twitter cards, JSON-LD BlogPosting, sitemap.xml, robots.txt, RSS, noindex
- [x] Redirects on published slug change (308, see SECURITY.md)

## Phase 3 — MCP
- [x] Streamable HTTP endpoint (stateless), official SDK
- [x] OAuth 2.1: RFC 9728 resource metadata, RFC 8414 AS metadata, RFC 7591 DCR, PKCE S256, refresh rotation with reuse detection, revocation
- [x] Consent screen with per-scope and per-site grants, "ask before publishing"
- [x] API-key fallback (bearer)
- [x] 20 tools from the spec with input/output schemas, annotations, structured errors
- [x] Two-step confirmation for deletes (always) and publishing (per connection)
- [x] Per-connection and per-IP rate limits

## Phase 4 — Dashboard
- [x] Onboarding (name → subdomain → template → connect agent)
- [x] Sites overview, posts/pages lists with filters, editor with Markdown preview + SEO panel
- [x] Media library, appearance (template + theme), settings (general, homepage blocks, navigation, delete)
- [x] Analytics, agents (instructions per client, connections, permissions, revoke, API keys), account (usage, password, activity)

## Phase 5 — Hardening
- [x] Unit + integration tests (66) incl. RLS isolation, OAuth with SDK client, MCP protocol, XSS, SSRF
- [x] Playwright E2E for the milestone flow
- [x] Audit logs, suspension (CLI), abuse reports, signup honeypot + rate limits
- [~] Bandwidth safeguards: monthly pageviews tracked and shown; not yet enforced (rely on Cloudflare caching/WAF)
- [ ] Deployment verified against real Supabase + R2 + Cloudflare (needs accounts; see docs/DEPLOYMENT.md)

## Next (not in MVP)
- [ ] Email verification + password reset (needs an email provider, e.g. Resend)
- [ ] Custom domains, more sites, collaboration invites (data model ready: plans, site_members)
- [ ] Admin web UI for reports/suspensions (CLI exists)
- [ ] Scheduled publishing, post revisions restore UI
- [ ] Edge caching of public pages with purge on publish
