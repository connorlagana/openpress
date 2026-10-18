<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# OpenPress — agent guide

MCP-native website hosting: users connect their own AI agent (Claude, ChatGPT, Cursor…) over MCP and publish sites by asking.

## Commands

| Task | Command |
| --- | --- |
| Dev server (embedded Postgres, no Docker) | `pnpm dev` → http://localhost:3000, sites at http://<sub>.localhost:3000 |
| Type check (regenerates route types) | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Unit + integration tests (PGlite, real RLS) | `pnpm test` |
| End-to-end (starts its own dev server on :3100) | `pnpm test:e2e` |
| Screenshot tour for design review | `SCREENSHOT_DIR=/tmp/shots pnpm test:e2e visual` |
| All checks | `pnpm check` |
| New migration from schema change | edit `src/db/schema.ts` → `pnpm db:generate` |
| Apply migrations to Postgres | `DATABASE_URL=postgres://… pnpm db:migrate` |
| Abuse tooling | `pnpm admin reports`, `pnpm admin suspend-site <sub> "<reason>"` |
| Cloudflare build / preview / deploy | `pnpm preview:cf`, `pnpm deploy:cf` |

## Architecture (where things live)

- `src/db/schema.ts` — Drizzle schema. `drizzle/0001_rls_and_seed.sql` — hand-written RLS policies, `folio_app` role, free plan seed.
- `src/db/client.ts` — `getDb()` (privileged) and `withUser(userId, fn)` (tenant transaction: `SET LOCAL ROLE folio_app` + `app.user_id`). **Every user-scoped query goes through `withUser`.**
- `src/server/actor.ts` — `Actor` (dashboard user or agent connection), scopes, site restrictions.
- `src/server/services/*` — all business logic. Both the dashboard (server actions) and MCP tools call these; they enforce scopes, site grants, quotas, confirmation and audit logging. Never put authorization in UI or tool code only.
- `src/server/mcp/server.ts` — MCP tool definitions (thin wrappers over services). `src/app/mcp/route.ts` — stateless Streamable HTTP endpoint with bearer auth + rate limits.
- `src/server/oauth/oauth.ts` — OAuth 2.1 authorization server (DCR, PKCE S256, refresh rotation, revocation) and bearer → Actor resolution. Consent UI: `src/app/(platform)/oauth/authorize`.
- `src/server/public/*` — privileged, read-only queries for public site rendering. Must only ever return published, non-deleted, non-suspended content.
- `src/app/site/[subdomain]/**` — public sites. Reached through a host-based rewrite in `next.config.ts` (`<sub>.<ROOT_DOMAIN>/x` → `/site/<sub>/x`).
- `src/templates/` — template registry (default theme + homepage blocks) and React components. Add a template = add a registry entry + homepage component in `HOMEPAGES`.
- `src/app/(platform)/**` — marketing, auth, onboarding, dashboard.

## Conventions

- Validate all input with Zod in the service layer. Throw `AppError(code, userSafeMessage, details?)` for expected failures.
- Agent-facing destructive ops use `requireConfirmation` (two-step token). Deletes always; publish/unpublish when the connection has `confirmPublish`.
- Content is Markdown, rendered + sanitized **at write time** (`src/lib/markdown.ts`). Never render unsanitized HTML; everything else in templates is text.
- Theme changes are structured tokens (`src/lib/theme.ts`), never raw CSS.
- Public site pages use plain `<a>`/`<img>` on purpose (see eslint config).
- Tests: integration tests use in-memory PGlite and the real route handlers (`tests/helpers.ts#appFetch`). Add a test with every new tool or policy.
- Keep `.env.example` in sync with any new env var.

## Decisions log

- **Own auth instead of Supabase Auth.** The OAuth authorization server for MCP must be ours anyway (consent with per-site scopes), and Supabase Auth can't run locally without Docker, which made the core flows untestable in CI-like environments. Supabase is still the database. See `docs/SECURITY.md`.
- **Host rewrite instead of `proxy.ts`.** Node.js proxy/middleware is experimental on OpenNext Cloudflare; config rewrites are fully supported.
- **Stateless MCP.** New server per request, JSON responses. Scales on serverless without session storage; no server-initiated notifications.
- **Posts and pages share one table** (`kind`), since drafts, publishing, SEO, revisions and redirects are identical.
- **PGlite for local dev/tests.** Real Postgres (WASM), so RLS policies are genuinely exercised without Docker.
