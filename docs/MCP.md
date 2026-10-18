# Connecting an AI agent

**Server URL:** `https://<ROOT_DOMAIN>/mcp` (local: `http://localhost:3000/mcp`). Transport: Streamable HTTP (stateless, JSON responses).

## Authentication

1. **OAuth 2.1 (recommended).** Clients discover everything automatically:
   - `401` from `/mcp` with `WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource/mcp"`
   - Protected resource metadata (RFC 9728) → authorization server metadata at `/.well-known/oauth-authorization-server` (RFC 8414)
   - Dynamic client registration at `/oauth/register` (RFC 7591, public clients only)
   - Authorization code + PKCE S256 at `/oauth/authorize` → consent screen → `/oauth/token`
   - Access tokens last 1 hour; refresh tokens rotate on every use (reusing an old one revokes the connection)
2. **API key (fallback).** Dashboard → Agents → Create API key. Send `Authorization: Bearer fol_key_…`. Same scopes and site restrictions as OAuth grants.

Allowed redirect URIs: any `https://`, `http://localhost|127.0.0.1|[::1]`, or a private app scheme (e.g. `cursor://`).

## Client setup

| Client | Setup |
| --- | --- |
| Claude (web/desktop) | Settings → Connectors → Add custom connector → paste URL → Connect |
| ChatGPT | Settings → Apps & Connectors (developer mode if needed) → create connector with URL, OAuth |
| Claude Code | `claude mcp add --transport http folio <URL>` then `/mcp` to sign in |
| Cursor | `~/.cursor/mcp.json`: `{"mcpServers":{"folio":{"url":"<URL>"}}}` |
| VS Code | `.vscode/mcp.json`: `{"servers":{"folio":{"type":"http","url":"<URL>"}}}` |
| Anything else | Streamable HTTP + OAuth, or the API key header |

Client UIs change frequently; the in-app Agents page shows the same steps with your URL filled in.

## Permissions (scopes)

| Scope | Allows |
| --- | --- |
| `sites:read` | list/get sites, posts, pages, media, templates |
| `sites:write` | create sites, settings, navigation, templates, themes |
| `content:write` | create/edit/delete drafts and pages, upload/delete media |
| `content:publish` | publish/unpublish |
| `analytics:read` | site analytics |
| `sites:delete` | delete sites (off by default on the consent screen) |

Each connection is also limited to **all sites** or a **chosen list** of sites. A site-restricted agent automatically gets access to sites it creates. Users edit or revoke any connection in Dashboard → Agents; changes apply on the next request.

## Tools

Sites: `create_site`, `list_sites`, `get_site`, `update_site_settings` (incl. homepage blocks + navigation), `delete_site`
Content: `create_post` (drafts; `kind: post|page`), `get_post`, `list_posts`, `update_post`, `publish_post`, `unpublish_post`, `delete_post`
Media: `upload_media` (`sourceUrl` or `dataBase64`), `list_media`, `delete_media`
Appearance: `list_templates`, `set_template`, `update_theme`
SEO/analytics: `update_post_seo`, `get_site_analytics`

Every tool has a JSON Schema for input and output and MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`). The full live reference is at `/docs/mcp`.

## Errors

Failures return `isError: true` with `structuredContent.error = { code, message, details? }`. Codes: `UNAUTHORIZED`, `FORBIDDEN` (missing scope or site grant), `NOT_FOUND`, `VALIDATION`, `CONFLICT` (with `details.suggestion`, e.g. a free slug), `QUOTA_EXCEEDED`, `RATE_LIMITED`, `SUSPENDED`, `UPSTREAM`, `INTERNAL`.

## Confirmation flow

`delete_site`, `delete_post`, `delete_media` always — and `publish_post` / `unpublish_post` when the user enabled "Ask me before publishing" — first return:

```json
{ "status": "confirmation_required", "summary": "Delete the PUBLISHED post …", "confirmation_token": "…", "expires_at": "…" }
```

Nothing has changed at this point. The agent shows the summary, gets an explicit yes from the user, then repeats the call with `confirmationToken`. Tokens are HMAC-bound to the connection, action and target, and expire after 10 minutes.

## Example session

> "Create a technology blog called The Engineering Journal. Make it minimalist, write an article about AI replacing software engineers, add appropriate images, optimize for SEO, and publish it."

A typical agent run: `list_sites` → `create_site {name, template:"editorial"}` → `upload_media {sourceUrl, altText}` → `create_post {title, content, coverMediaId, seoDescription}` → `publish_post` → reply with the returned `post.url`.
