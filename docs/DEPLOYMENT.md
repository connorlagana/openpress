# Deployment

**Production (since 2026-10-18): Railway + Neon, DNS at Porkbun.** https://openpress.blog

| Piece | Where | Notes |
| --- | --- | --- |
| App | Railway project `openpress`, service `web` | Railpack builds `pnpm build` and runs `pnpm start` (plain Node). Deploy: `railway up --service web`. |
| Database | Neon project `openpress` (pooled connection string) | Migrations are run from a dev machine with the direct (non-pooler) URL: `DATABASE_URL=… pnpm db:migrate`. |
| Media | Railway volume mounted at `/data` | `STORAGE_DRIVER=local`, `LOCAL_MEDIA_DIR=/data/media`, served through `/m/`. Move to R2 (`STORAGE_DRIVER=r2`) if it outgrows the volume. |
| DNS | Porkbun | `ALIAS @` and `CNAME *` → Railway targets, plus `_acme-challenge` CNAME (wildcard certificate) and `_railway-verify` TXT. |

Service variables: `DATABASE_URL`, `APP_SECRET`, `NEXT_PUBLIC_ROOT_DOMAIN=openpress.blog`, `NEXT_PUBLIC_APP_NAME=OpenPress`, `STORAGE_DRIVER`, `LOCAL_MEDIA_DIR`, `IP_HEADER=x-real-ip` (Railway's edge overwrites it; verified that forged `x-real-ip`/`cf-connecting-ip` headers are ignored), `DATABASE_POOL_MAX`. Don't set `NODE_ENV` on the service: it would skip devDependencies during the build.

Verify a deploy with `pnpm test:live` (signs up, connects an agent over OAuth, uploads an image, publishes, checks the public URL, then deletes the site). It leaves a test account behind; delete `e2e-*@example.com` users afterwards.

---

# Alternative: Cloudflare Workers

The app also runs on Cloudflare Workers (OpenNext). It was deployed and verified there on 2026-10-18 before moving to Railway; the notes below are kept for that path.

> Hyperdrive is required, not optional: postgres.js fails on Workers when it opens TLS to the database itself (`options.rejectUnauthorized is not implemented`). Wildcard subdomains require the domain's DNS to be on Cloudflare. `wrangler.workersdev.jsonc` deploys without custom-domain routes.

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
npx wrangler r2 bucket create openpress-media
```
- On Workers the app uses the `MEDIA` bucket binding in `wrangler.jsonc` (`STORAGE_DRIVER=r2-binding`), so no R2 API keys are needed.
- Optional: Bucket → Settings → connect a custom domain (e.g. `media.example.com`) → that's `MEDIA_PUBLIC_URL`. Without it, media is served through `/m/`.
- Only when running outside Workers: use `STORAGE_DRIVER=r2` with an Object Read & Write API token (`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`).

## 3. Domain + DNS

On a Cloudflare zone `example.com` (the platform domain):
- `A`/`AAAA` or CNAME records are created automatically for the custom domain route.
- Add a proxied wildcard record `*` (e.g. `AAAA * 100::`) so `<site>.example.com` reaches the Worker.
- Universal SSL covers `example.com` and `*.example.com`.

## 4. Worker

Edit `wrangler.jsonc`: set `NEXT_PUBLIC_ROOT_DOMAIN`, `routes` to your domain, and (optionally) a Hyperdrive binding:
```bash
npx wrangler hyperdrive create openpress-db --connection-string="postgres://...pooler...:6543/postgres"
```

Secrets:
```bash
for s in APP_SECRET DATABASE_URL; do npx wrangler secret put $s; done
```
`APP_SECRET`: `openssl rand -base64 48`.

Deploy — `NEXT_PUBLIC_*` values are inlined at build time, so export them for the build:
```bash
NEXT_PUBLIC_ROOT_DOMAIN=example.com NEXT_PUBLIC_APP_NAME=OpenPress pnpm deploy:cf
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
