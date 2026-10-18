import { and, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, withUser } from "@/db/client";
import { agentConnectionSites, agentConnections, agentTokens, oauthClients, oauthCodes, plans, sites, users } from "@/db/schema";
import { config } from "@/lib/config";
import { randomToken, sha256Base64Url, sha256Hex, safeEqual } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { ALL_SCOPES, parseScopes, type Actor, type Scope } from "../actor";
import { audit } from "../services/audit";

export const MCP_PATH = "/mcp";
export const mcpResourceUrl = () => `${config.appUrl}${MCP_PATH}`;

export function protectedResourceMetadata() {
  return {
    resource: mcpResourceUrl(),
    authorization_servers: [config.appUrl],
    scopes_supported: ALL_SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: `${config.appName} website publishing`,
    resource_documentation: `${config.appUrl}/docs/mcp`,
  };
}

export function authorizationServerMetadata() {
  return {
    issuer: config.appUrl,
    authorization_endpoint: `${config.appUrl}/oauth/authorize`,
    token_endpoint: `${config.appUrl}/oauth/token`,
    registration_endpoint: `${config.appUrl}/oauth/register`,
    revocation_endpoint: `${config.appUrl}/oauth/revoke`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ALL_SCOPES,
    service_documentation: `${config.appUrl}/docs/mcp`,
  };
}

/** https anywhere, http only on loopback, or a private-use app scheme (cursor://, vscode://...). */
export function isAllowedRedirectUri(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === "https:") return true;
  if (u.protocol === "http:") return ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  const scheme = u.protocol.slice(0, -1);
  return /^[a-z][a-z0-9+.-]*$/.test(scheme) && !["javascript", "data", "file", "vbscript", "blob", "about", "ftp", "ws", "wss"].includes(scheme);
}

const registerInput = z.object({
  client_name: z.string().trim().min(1).max(100).optional(),
  redirect_uris: z.array(z.string().max(2000)).min(1).max(10),
  client_uri: z.string().url().max(500).optional(),
  token_endpoint_auth_method: z.string().optional(),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
  scope: z.string().optional(),
});

export async function registerClient(body: unknown) {
  const parsed = registerInput.safeParse(body);
  if (!parsed.success) throw new AppError("VALIDATION", "invalid_client_metadata: " + parsed.error.issues.map((i) => i.message).join("; "));
  const data = parsed.data;
  const bad = data.redirect_uris.find((u) => !isAllowedRedirectUri(u));
  if (bad) throw new AppError("VALIDATION", `invalid_redirect_uri: ${bad}`);
  // Every client is registered as public (PKCE, no secret) regardless of the requested auth method.
  const id = randomToken(18, "fcl_");
  const db = await getDb();
  const [row] = await db
    .insert(oauthClients)
    .values({ id, name: data.client_name ?? "MCP client", redirectUris: data.redirect_uris, clientUri: data.client_uri })
    .returning();
  return {
    client_id: row.id,
    client_id_issued_at: Math.floor(row.createdAt.getTime() / 1000),
    client_name: row.name,
    redirect_uris: row.redirectUris,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    ...(row.clientUri ? { client_uri: row.clientUri } : {}),
  };
}

export async function getClient(clientId: string) {
  const db = await getDb();
  const [c] = await db.select().from(oauthClients).where(eq(oauthClients.id, clientId));
  return c ?? null;
}

export const authorizeParams = z.object({
  response_type: z.literal("code"),
  client_id: z.string().min(1).max(100),
  redirect_uri: z.string().min(1).max(2000),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal("S256"),
  state: z.string().max(1000).optional(),
  scope: z.string().max(500).optional(),
  resource: z.string().max(500).optional(),
});
export type AuthorizeParams = z.infer<typeof authorizeParams>;

/**
 * Validate an authorization request. Errors that make the redirect URI
 * untrustworthy are returned for display; never redirect to an unverified URI.
 */
export async function validateAuthorizeRequest(raw: Record<string, string | undefined>) {
  const clientId = raw.client_id;
  const client = clientId ? await getClient(clientId) : null;
  if (!client) return { ok: false as const, error: "Unknown client_id. The MCP client must register first (dynamic client registration)." };
  if (!raw.redirect_uri || !client.redirectUris.includes(raw.redirect_uri)) {
    return { ok: false as const, error: "redirect_uri does not match any URI registered for this client." };
  }
  const parsed = authorizeParams.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid authorization request (PKCE with S256 is required).",
      redirect: errorRedirect(raw.redirect_uri, "invalid_request", raw.state),
    };
  }
  if (parsed.data.resource && parsed.data.resource.replace(/\/$/, "") !== mcpResourceUrl()) {
    return { ok: false as const, error: "Unknown resource.", redirect: errorRedirect(raw.redirect_uri, "invalid_target", raw.state) };
  }
  const requested = parseScopes(parsed.data.scope);
  return { ok: true as const, client, params: parsed.data, requestedScopes: requested.length ? requested : null };
}

export function errorRedirect(redirectUri: string, error: string, state?: string) {
  const u = new URL(redirectUri);
  u.searchParams.set("error", error);
  if (state) u.searchParams.set("state", state);
  u.searchParams.set("iss", config.appUrl);
  return u.toString();
}

export const grantInput = z.object({
  scopes: z.array(z.enum(ALL_SCOPES as [Scope, ...Scope[]])).min(1),
  allSites: z.boolean(),
  siteIds: z.array(z.string().uuid()).default([]),
  confirmPublish: z.boolean().default(false),
  name: z.string().trim().min(1).max(80),
});

/** Create the user's grant (agent connection). RLS ensures sites belong to the user. */
async function createConnection(userId: string, kind: "oauth" | "api_key", clientId: string | null, grant: z.infer<typeof grantInput>, ip?: string | null) {
  return withUser(userId, async (tx) => {
    const [conn] = await tx
      .insert(agentConnections)
      .values({ userId, clientId, kind, name: grant.name, scopes: grant.scopes, allSites: grant.allSites, confirmPublish: grant.confirmPublish })
      .returning();
    if (!grant.allSites && grant.siteIds.length) {
      const owned = await tx.select({ id: sites.id }).from(sites).where(and(inArray(sites.id, grant.siteIds), isNull(sites.deletedAt)));
      if (owned.length) await tx.insert(agentConnectionSites).values(owned.map((s) => ({ connectionId: conn.id, siteId: s.id })));
    }
    await audit(tx, { kind: "user", userId, ip }, kind === "oauth" ? "agent.authorize" : "agent.api_key_create", {
      targetType: "agent_connection",
      targetId: conn.id,
      metadata: { name: grant.name, scopes: grant.scopes, allSites: grant.allSites, siteIds: grant.siteIds },
    });
    return conn;
  });
}

export async function approveAuthorization(userId: string, params: AuthorizeParams, grant: z.input<typeof grantInput>, ip?: string | null) {
  const g = grantInput.parse(grant);
  const conn = await createConnection(userId, "oauth", params.client_id, g, ip);
  const code = randomToken(32);
  const db = await getDb();
  await db.insert(oauthCodes).values({
    codeHash: await sha256Hex(code),
    connectionId: conn.id,
    clientId: params.client_id,
    redirectUri: params.redirect_uri,
    codeChallenge: params.code_challenge,
    resource: params.resource ?? null,
    expiresAt: new Date(Date.now() + 5 * 60_000),
  });
  const u = new URL(params.redirect_uri);
  u.searchParams.set("code", code);
  if (params.state) u.searchParams.set("state", params.state);
  u.searchParams.set("iss", config.appUrl);
  return u.toString();
}

export async function createApiKey(userId: string, grant: z.input<typeof grantInput>, ip?: string | null) {
  const g = grantInput.parse(grant);
  const conn = await createConnection(userId, "api_key", null, g, ip);
  const key = randomToken(32, "fol_key_");
  const db = await getDb();
  await db.insert(agentTokens).values({ tokenHash: await sha256Hex(key), connectionId: conn.id, kind: "api_key", prefix: key.slice(0, 14) });
  return { key, connectionId: conn.id };
}

async function issueTokens(connectionId: string, scopes: string[]) {
  const access = randomToken(32, "fol_at_");
  const refresh = randomToken(32, "fol_rt_");
  const db = await getDb();
  await db.insert(agentTokens).values([
    { tokenHash: await sha256Hex(access), connectionId, kind: "access", expiresAt: new Date(Date.now() + config.accessTokenTtlSeconds * 1000) },
    { tokenHash: await sha256Hex(refresh), connectionId, kind: "refresh", expiresAt: new Date(Date.now() + config.refreshTokenTtlDays * 86400_000) },
  ]);
  return { access_token: access, token_type: "Bearer", expires_in: config.accessTokenTtlSeconds, refresh_token: refresh, scope: scopes.join(" ") };
}

export class OAuthError extends Error {
  constructor(
    public error: string,
    public description: string,
    public status = 400,
  ) {
    super(description);
  }
}

async function revokeConnectionTokens(connectionId: string) {
  const db = await getDb();
  await db.update(agentTokens).set({ revokedAt: new Date() }).where(and(eq(agentTokens.connectionId, connectionId), isNull(agentTokens.revokedAt)));
}

export async function exchangeToken(form: URLSearchParams) {
  const grantType = form.get("grant_type");
  const clientId = form.get("client_id") ?? "";
  const db = await getDb();

  if (grantType === "authorization_code") {
    const code = form.get("code") ?? "";
    const verifier = form.get("code_verifier") ?? "";
    const [row] = await db.select().from(oauthCodes).where(eq(oauthCodes.codeHash, await sha256Hex(code)));
    if (!row) throw new OAuthError("invalid_grant", "Unknown authorization code");
    if (row.usedAt) {
      // Code replay: revoke everything issued from it (RFC 6749 §4.1.2).
      await revokeConnectionTokens(row.connectionId);
      throw new OAuthError("invalid_grant", "Authorization code already used");
    }
    if (row.expiresAt < new Date()) throw new OAuthError("invalid_grant", "Authorization code expired");
    if (row.clientId !== clientId) throw new OAuthError("invalid_grant", "client_id mismatch");
    if (row.redirectUri !== form.get("redirect_uri")) throw new OAuthError("invalid_grant", "redirect_uri mismatch");
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || !safeEqual(await sha256Base64Url(verifier), row.codeChallenge)) {
      throw new OAuthError("invalid_grant", "PKCE verification failed");
    }
    const claimed = await db
      .update(oauthCodes)
      .set({ usedAt: new Date() })
      .where(and(eq(oauthCodes.codeHash, row.codeHash), isNull(oauthCodes.usedAt)))
      .returning({ c: oauthCodes.codeHash });
    if (!claimed.length) throw new OAuthError("invalid_grant", "Authorization code already used");
    const [conn] = await db.select().from(agentConnections).where(and(eq(agentConnections.id, row.connectionId), isNull(agentConnections.revokedAt)));
    if (!conn) throw new OAuthError("invalid_grant", "Authorization was revoked");
    return issueTokens(conn.id, conn.scopes);
  }

  if (grantType === "refresh_token") {
    const token = form.get("refresh_token") ?? "";
    const hash = await sha256Hex(token);
    const [row] = await db
      .select({ t: agentTokens, c: agentConnections })
      .from(agentTokens)
      .innerJoin(agentConnections, eq(agentTokens.connectionId, agentConnections.id))
      .where(and(eq(agentTokens.tokenHash, hash), eq(agentTokens.kind, "refresh")));
    if (!row) throw new OAuthError("invalid_grant", "Unknown refresh token");
    if (row.c.clientId !== clientId) throw new OAuthError("invalid_grant", "client_id mismatch");
    if (row.t.revokedAt) {
      // A rotated-out refresh token was replayed: assume theft, kill the family.
      await revokeConnectionTokens(row.c.id);
      throw new OAuthError("invalid_grant", "Refresh token was already used");
    }
    if (row.c.revokedAt) throw new OAuthError("invalid_grant", "Authorization was revoked");
    if (row.t.expiresAt && row.t.expiresAt < new Date()) throw new OAuthError("invalid_grant", "Refresh token expired");
    const rotated = await db
      .update(agentTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(agentTokens.tokenHash, hash), isNull(agentTokens.revokedAt)))
      .returning({ h: agentTokens.tokenHash });
    if (!rotated.length) throw new OAuthError("invalid_grant", "Refresh token was already used");
    return issueTokens(row.c.id, row.c.scopes);
  }

  throw new OAuthError("unsupported_grant_type", "Supported grant types: authorization_code, refresh_token");
}

export async function revokeToken(token: string) {
  const db = await getDb();
  await db.update(agentTokens).set({ revokedAt: new Date() }).where(eq(agentTokens.tokenHash, await sha256Hex(token)));
}

/** Resolve a bearer token (OAuth access token or API key) to an agent Actor. */
export async function actorForBearer(token: string, ip?: string | null): Promise<{ actor: Actor & { kind: "agent" }; requestsPerMinute: number } | null> {
  if (!token || token.length > 200 || !token.startsWith("fol_")) return null;
  const db = await getDb();
  const [row] = await db
    .select({ t: agentTokens, c: agentConnections, u: users, clientName: oauthClients.name, rpm: plans.mcpRequestsPerMinute })
    .from(agentTokens)
    .innerJoin(agentConnections, eq(agentTokens.connectionId, agentConnections.id))
    .innerJoin(users, eq(agentConnections.userId, users.id))
    .innerJoin(plans, eq(users.planId, plans.id))
    .leftJoin(oauthClients, eq(agentConnections.clientId, oauthClients.id))
    .where(
      and(
        eq(agentTokens.tokenHash, await sha256Hex(token)),
        inArray(agentTokens.kind, ["access", "api_key"]),
        isNull(agentTokens.revokedAt),
        isNull(agentConnections.revokedAt),
        or(isNull(agentTokens.expiresAt), gt(agentTokens.expiresAt, new Date())),
      ),
    );
  if (!row || row.u.suspendedAt) return null;
  const siteIds = row.c.allSites
    ? ("all" as const)
    : new Set((await db.select({ id: agentConnectionSites.siteId }).from(agentConnectionSites).where(eq(agentConnectionSites.connectionId, row.c.id))).map((r) => r.id));
  if (!row.c.lastUsedAt || Date.now() - row.c.lastUsedAt.getTime() > 5 * 60_000) {
    await db.update(agentConnections).set({ lastUsedAt: sql`now()` }).where(eq(agentConnections.id, row.c.id));
  }
  return {
    actor: {
      kind: "agent",
      userId: row.u.id,
      connectionId: row.c.id,
      clientName: row.clientName ?? row.c.name,
      scopes: new Set(parseScopes(row.c.scopes)),
      siteIds,
      confirmPublish: row.c.confirmPublish,
      ip,
    },
    requestsPerMinute: row.rpm,
  };
}
