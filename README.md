# OpenPress

Free website hosting that AI agents can operate. Sign up, pick a template, connect Claude / ChatGPT / Cursor / any MCP client, and ask it to write and publish.

- **Remote MCP server** (Streamable HTTP) with OAuth 2.1 + PKCE + dynamic client registration, or API keys
- **20 tools**: sites, posts/pages, publishing, media, templates, themes, SEO, analytics
- **Public sites** on `<name>.<your-domain>` with three templates, RSS, sitemaps, Open Graph, JSON-LD
- **Dashboard** for humans: editor with preview, media, appearance, settings, analytics, agent permissions
- **Multi-tenant security**: Postgres row-level security, scoped per-site agent grants, confirmation for destructive actions, audit log

## Local development

Requirements: Node 22+, pnpm 10. No Docker: the dev database is embedded Postgres (PGlite) stored in `.data/`.

```bash
pnpm install
cp .env.example .env.local      # defaults work as-is for local dev
pnpm dev
```

- Dashboard: http://localhost:3000
- Your sites: http://&lt;subdomain&gt;.localhost:3000 (browsers resolve `*.localhost` automatically)
- MCP endpoint: http://localhost:3000/mcp

Try it with the MCP Inspector: `npx @modelcontextprotocol/inspector`, transport "Streamable HTTP", URL `http://localhost:3000/mcp`. It will walk through OAuth against your local account. Or create an API key in Dashboard → Agents and send `Authorization: Bearer fol_key_…`.

Reset local data: stop the server and delete `.data/`.

## Tests

```bash
pnpm test        # 66 unit + integration tests (real Postgres engine via PGlite, real route handlers, official MCP SDK client)
pnpm test:e2e    # Playwright: signup → site → OAuth connect → agent publishes → public page (first run: npx playwright install chromium)
pnpm check       # typecheck + lint + tests
```

## Docs

- [AGENTS.md](AGENTS.md) — architecture, conventions, commands (start here if you're changing code)
- [docs/MCP.md](docs/MCP.md) — connecting clients, tools, permissions, confirmation flow
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Supabase + Cloudflare Workers + R2, costs
- [docs/SECURITY.md](docs/SECURITY.md) — security model and known limitations
- [PLAN.md](PLAN.md) — what's done, partial, and next

## Status

MVP. The milestone flow (register → create site → connect agent → publish → visit) passes end-to-end locally. Production deployment has been built and smoke-tested in the local Workers runtime but **not yet verified against live Supabase/R2/Cloudflare**, and some items are intentionally out of scope (email verification, password reset, custom domains). See PLAN.md and docs/SECURITY.md before calling it production-ready.
