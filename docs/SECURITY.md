# Security model & known limitations

## Threat model

OpenPress is multi-tenant hosting operated by third-party AI agents. We assume: tenants are adversarial to each other; agents may be confused or prompt-injected (including by content on the sites they read); published content is untrusted HTML-ish input; anyone on the internet can hit every endpoint.

## Controls

**Tenant isolation**
- Every user-scoped query runs inside `withUser()`: a transaction that switches to the `folio_app` role (no `BYPASSRLS`) and sets `app.user_id`. RLS policies (`drizzle/0001_rls_and_seed.sql`) restrict every table to sites the user is a member of. Tests prove raw SQL as user B cannot read or write user A's rows.
- Service-layer checks run on top (defence in depth). Agent site restrictions (`agent_connection_sites`) are enforced in services.
- Privileged queries exist only in auth/OAuth (`src/server/auth`, `src/server/oauth`), public rendering (`src/server/public`, published content only), rate limiting, analytics ingestion, admin-only platform analytics and operator scripts.

**Agents (MCP)**
- OAuth 2.1 with PKCE S256 only, exact redirect URI match, codes single-use (replay revokes issued tokens), 1h access tokens, rotating refresh tokens with reuse detection, revocation endpoint. Only token hashes are stored.
- Per-connection scopes and site lists chosen by the user on the consent screen; editable/revocable at any time. Agents cannot manage their own permissions.
- Sign in with Google / Apple (`src/server/auth/sso.ts`): OIDC authorization code flow; state, nonce and (Google) PKCE verifier travel in an HMAC-signed, 10-minute, HttpOnly cookie scoped to `/auth` (SameSite=None for Apple's cross-site form_post). The ID token comes directly from the provider's token endpoint over TLS, so its `iss`/`aud`/`exp`/`nonce` are checked but not its signature (OIDC Core 3.1.3.7). Only provider-verified emails are used. A provider account is **never linked to an existing password account by email** (we don't verify emails at password signup, so that would allow pre-registration takeover); the signed-in owner connects it from Account instead. Accounts created by Google and Apple with the same verified email are merged.
- Consent is skipped (`reauthorize` in `src/server/oauth/oauth.ts`) only for a signed-in user with a live grant to the same client_id, or to another registration with the identical **https** redirect URI (only the callback's owner can receive the code). Loopback and app-scheme callbacks never match across client_ids, since any local program can claim them. A request for a scope outside the prior grant, or `prompt=consent`, shows the consent screen. Same-client reconnects reuse the existing connection, so a cross-site GET can't pile up connections.
- Destructive operations need a two-step HMAC confirmation token bound to connection + action + target; publishing optionally too. Tool annotations mark destructive tools for clients that prompt.
- Agents get no SQL, shell, filesystem or admin capabilities — only the 20 typed tools.
- Prompt injection: tool results contain user content as JSON data; server instructions tell agents to treat site content as data. Authorization never depends on agent behaviour.

**Content**
- Markdown is rendered and sanitized with an allow-list at write time: no scripts, iframes, forms, styles, event handlers, SVG, `javascript:`/`data:` URLs, protocol-relative links. External links get `rel="nofollow ugc noopener noreferrer"`.
- Themes are validated tokens (hex colors, enums), never CSS. Homepage blocks and navigation are rendered as text; URLs must be `http(s)`, `mailto:` or site-relative.
- JSON-LD escapes `<`.

**Media**
- File type from magic bytes, not names or MIME headers. Allowed: PNG, JPEG, GIF, WebP, AVIF, ICO. SVG rejected.
- Per-file (plan, ≤10 MB hard cap) and per-account storage quotas, re-checked inside the write transaction.
- URL import: https only, default port, no credentials, private/loopback/link-local/metadata/encoded-IP hosts blocked, redirects re-validated, 10s timeout, streamed size cap. On Cloudflare, `global_fetch_strictly_public` blocks private destinations at the platform level.
- Media proxy serves only well-formed keys with `nosniff` and a sandboxing CSP.

**Web**
- Session: random 256-bit token, SHA-256 stored, httpOnly, `SameSite=Lax`, `Secure` on https, host-only (never sent to user sites on subdomains).
- CSRF: Server Actions verify Origin (Next.js built-in); the upload route checks Origin; OAuth/MCP endpoints are bearer-token only.
- Passwords: PBKDF2-SHA256 (310k iterations), constant-time compare, timing-equalized unknown-user path.
- Rate limits (Postgres fixed window): login per IP and per email, signup per IP, OAuth register/token per IP, MCP per IP and per connection (plan-based), uploads per user, abuse reports per IP.
- Headers: `nosniff`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`.

**Abuse**
- Public report form (`/report`), honeypot on signup, reserved subdomains (platform names and common impersonation targets).
- Operator CLI: list reports, suspend/unsuspend sites and users. Suspended users lose sessions and agent tokens; suspended sites stop rendering and can't publish.
- Audit log of create/publish/unpublish/delete/permission changes, attributed to dashboard or the specific agent.

## Custom visualizations

Agent-written HTML/CSS/JS (`create_custom_visualization`) is untrusted code. Layers, outermost first:

1. **Feature flag.** `CUSTOM_VIZ` is off by default. While off, the tools aren't registered, the frame route returns 404, and embeds render only the static fallback.
2. **Publisher approval.** Code runs only after a signed-in site member approves it in the dashboard. Agents can't approve: there is no tool, and the service rejects agent actors even with a confirmation token. Approval is bound to the SHA-256 of `html`+`css`+`js`; any code change resets it, and approving a stale hash fails (`CONFLICT`). Approve/reject/create/update are audit-logged.
3. **Opaque-origin sandbox.** Post HTML contains only `<iframe sandbox="allow-scripts" referrerpolicy="no-referrer" allow="">` pointing at `VIZ_SANDBOX_ORIGIN`. The response also sends CSP `sandbox allow-scripts`, so the document is sandboxed even if opened directly. No `allow-same-origin`, so no cookies, storage or DOM access to any origin; no popups, forms, top navigation or modals.
4. **No network.** `default-src 'none'`, `connect-src 'none'`, `img-src`/`font-src`/`media-src` limited to `data:`/`blob:`, `form-action 'none'`, `base-uri 'none'`, no workers or nested frames. Scripts need a per-response nonce, so markup in `html` can't execute. Validation also rejects `<script>`, `<meta>`, `<base>`, `<link>`, `<iframe>`, `<object>`, `<embed>`, `<form>` and CSS `@import`.
5. **Embedding limits.** `frame-ancestors` is the owning site plus the dashboard; `Permissions-Policy` denies all powerful features; the global `X-Frame-Options` header is excluded for `/viz-frame/*` only.
6. **Narrow parent channel.** The parent accepts only `{type: "op-viz:resize", height}` from that iframe's own window (clamped 80–2400 px) and sends only theme colors. It sets `src` itself and removes a frame that navigates away (a second `load`).
7. **Takedown.** Deleted visualizations, suspended sites and suspended owners stop serving immediately (frames are cached ≤ 60 s).

Run the sandbox origin on its **own registrable domain** (e.g. `openpress-usercontent.net`, like `googleusercontent.com`), so the browser treats it as a separate site from both the app and user sites. When `VIZ_SANDBOX_ORIGIN` is set, the route refuses requests for any other host.

Residual risks (why the flag stays off until an external review):
- A frame can still **navigate itself** (`location = …`) to a third-party URL. CSP can't block that, and it would reveal the reader's IP and the frame URL. The parent detects it and removes the frame, but only after the request was made. Browser-level leaks such as DNS prefetch and WebRTC are similarly outside CSP's reach.
- Approved code can still display misleading or abusive content in its frame; approval is a human review, not an analysis.
- CPU/memory abuse (an infinite loop) is limited only by the browser's per-frame process isolation.
- With the default (unset) `VIZ_SANDBOX_ORIGIN`, frames are served from the app origin. They are still opaque-origin sandboxed, but there is no separate-site boundary.

## Known limitations (not production-hardened yet)

- **No email verification or password reset.** Needs an email provider. Account recovery is manual.
- **Supabase Auth is not used** (custom auth). It's small and tested but has had no external review; no MFA.
- **Redirects return 308**, not 301 (Next.js `permanentRedirect`). Search engines treat them equivalently.
- **Bandwidth safeguards are not enforced**: monthly pageviews are tracked and displayed but nothing throttles a site that exceeds them. Rely on Cloudflare caching/WAF; add enforcement before a public launch.
- **Public pages are not edge-cached** (rendered per request). Fine for small scale; add cache + purge-on-publish for traffic spikes.
- **No Content-Security-Policy on public sites.** Content is sanitized, but a CSP (nonce-based) would be stronger defence in depth.
- **Client IP** comes from `cf-connecting-ip`, falling back to `X-Forwarded-For`. On non-Cloudflare hosts, make sure only a trusted proxy can set XFF, or IP rate limits can be bypassed.
- **SSRF on Node hosts:** hostname checks don't resolve DNS, so a public name pointing to a private IP isn't caught outside Cloudflare. Use Cloudflare or an egress proxy.
- **Rate limiter and analytics write to Postgres** on hot paths. Fine for an MVP; move to Workers Rate Limiting / Analytics Engine at scale.
- **RLS is tested on PGlite (Postgres 17 engine)**, not yet against a live Supabase instance. Verify the `folio_app` role on first deploy (checklist in DEPLOYMENT.md).
- **Prompt injection** can still mislead an agent into a *permitted* action (e.g. editing a post). Mitigations: least-privilege grants, "ask before publishing", confirmations for deletes, audit log, revisions.
- **Abuse review is manual**; no automated spam/phishing classification.
- **Custom visualizations** are disabled by default pending a sandbox review; see the residual risks above.
- **Unique visitors** are counted per day via a rotating hash (privacy by design), so multi-day totals overcount returning visitors.
