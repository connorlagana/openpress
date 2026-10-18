# Deployment

Target stack: **Cloudflare Workers** (Next.js via OpenNext) + **Supabase Postgres** + **Cloudflare R2**.

> Status: `pnpm build` and `opennextjs-cloudflare build` succeed, and the Worker serves pages in local `wrangler dev`. A deploy against live Supabase/R2/Cloudflare accounts has **not** been verified yet. Run through the checklist at the bottom on first deploy.

## Why this stack (and compatibility notes)

| Concern | Choice | Notes |
| --- | --- | --- |
| Next.js on Cloudflare | `@opennextjs/cloudflare` 1.20 | Supports Next 16.4. Node.js `proxy.ts`/middleware is experimental there, so subdomain routing uses `next.config.ts` host rewrites instead. Edge runtime is not used. |
| MCP transport | SDK `WebStandardStreamableHTTPServerTransport`, stateless | Pure Web APIs; no session store needed across Worker isolates. |
| Database | Supabase Postgres via `postgres` (postgres.js) + Drizzle | Workers can't reuse sockets across requests, so `src/db/client.ts` creates one client per request (`CF_WORKER=1`). Use Supabase's **transaction pooler** (port 6543) or, better, **Hyperdrive** in front of it. `prepare: false` is set for pooler compatibility. |
| Auth | Built in (PBKDF2 + DB sessions) + our own OAuth AS | Supabase Auth is not used; see AGENTS.md decisions. |
| Media | R2 via S3 API (`aws4fetch`) | Serve from a public R2 custom domain (`MEDIA_PUBLIC_URL`) to avoid Worker CPU on image requests. |
| Workers plan | **Workers Paid ($5/mo)** | The free plan's 10 ms CPU limit is too low for SSR + password hashing. |

## 1. Supabase

1. Create a project. Settings → Database: copy the **direct/session** connection string (for migrations) and the **transaction pooler** string (for the app).
2. Run migrations from your machine:
   ```bash
   DATABASE_URL="postgres://postgres:...@db.<ref>.supabase.co:5432/postgres" pnpm db:migrate
   ```
   This creates tables, the unprivileged `folio_app` role, RLS policies and the free plan.
3. Recommended: Settings → API → disable the Data API (PostgREST) for the `public` schema. All tables have RLS with no `anon`/`authenticated` policies, so it is already closed, but nothing needs it.

## 2. R2

```bash
npx wrangler r2 bucket create folio-media
```
- Bucket → Settings → connect a custom domain (e.g. `media.example.com`) → that's `MEDIA_PUBLIC_URL`.
- R2 → Manage API tokens → create an Object Read & Write token scoped to the bucket → `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`.

## 3. Domain + DNS

On a Cloudflare zone `example.com` (the platform domain):
- `A`/`AAAA` or CNAME records are created automatically for the custom domain route.
- Add a proxied wildcard record `*` (e.g. `AAAA * 100::`) so `<site>.example.com` reaches the Worker.
- Universal SSL covers `example.com` and `*.example.com`.

## 4. Worker

Edit `wrangler.jsonc`: set `NEXT_PUBLIC_ROOT_DOMAIN`, `routes` to your domain, and (optionally) a Hyperdrive binding:
```bash
npx wrangler hyperdrive create folio-db --connection-string="postgres://...pooler...:6543/postgres"
```

Secrets:
```bash
for s in APP_SECRET DATABASE_URL R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET MEDIA_PUBLIC_URL; do npx wrangler secret put $s; done
```
`APP_SECRET`: `openssl rand -base64 48`.

Deploy — `NEXT_PUBLIC_*` values are inlined at build time, so export them for the build:
```bash
NEXT_PUBLIC_ROOT_DOMAIN=example.com NEXT_PUBLIC_APP_NAME=Folio pnpm deploy:cf
```

## 5. First-deploy checklist

- [ ] `https://example.com` loads; sign up works; onboarding creates a site
- [ ] `https://<site>.example.com` renders with styles
- [ ] `curl -i -X POST https://example.com/mcp` → `401` with `WWW-Authenticate: Bearer resource_metadata=…`
- [ ] `https://example.com/.well-known/oauth-authorization-server` shows `https://example.com` URLs (not localhost)
- [ ] Connect MCP Inspector or Claude; run create_post → publish_post; open the returned URL
- [ ] Upload an image from the dashboard and via `upload_media {sourceUrl}`; it loads from `MEDIA_PUBLIC_URL`
- [ ] `select rolname, rolbypassrls from pg_roles where rolname='folio_app'` → `false`
- [ ] Cloudflare WAF/rate-limiting rule on `/signup`, `/login`, `/oauth/*` (defence in depth for app limits)

## Cost at small scale

| Service | Free allowance | Paid trigger |
| --- | --- | --- |
| Cloudflare Workers | — | $5/mo Paid plan (10M requests, 30M CPU-ms included) |
| Supabase | 500 MB DB, pauses after 7 days idle | $25/mo Pro for always-on + backups |
| R2 | 10 GB storage, 1M writes, 10M reads/mo, **free egress** | $0.015/GB-month beyond |

At 100 MB/site storage quota, 10 GB of R2 holds ~100 maxed-out free sites; typical usage is far lower. Analytics rows are pruned after 90 days.

## Alternative: any Node host

`pnpm build && pnpm start` with `DATABASE_URL`, `STORAGE_DRIVER=r2` etc. works on Fly.io, Render, Railway or a VPS. Point a wildcard DNS record at it. On a Node host, set `X-Forwarded-For` only from a trusted proxy (see SECURITY.md).
