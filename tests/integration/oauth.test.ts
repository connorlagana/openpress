import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import type { OAuthClientInformationMixed, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { agentConnectionSites, agentConnections } from "@/db/schema";
import { approveAuthorization, isAllowedRedirectUri, reauthorize, validateAuthorizeRequest } from "@/server/oauth/oauth";
import { createSite } from "@/server/services/sites";
import { appFetch, call, makeUser } from "../helpers";

class MemoryProvider implements OAuthClientProvider {
  info?: OAuthClientInformationMixed;
  tok?: OAuthTokens;
  verifier = "";
  authUrl?: URL;
  get redirectUrl() {
    return "http://localhost:6274/callback";
  }
  get clientMetadata() {
    return { client_name: "Test Agent", redirect_uris: [this.redirectUrl], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" };
  }
  clientInformation() {
    return this.info;
  }
  saveClientInformation(i: OAuthClientInformationMixed) {
    this.info = i;
  }
  tokens() {
    return this.tok;
  }
  saveTokens(t: OAuthTokens) {
    this.tok = t;
  }
  redirectToAuthorization(url: URL) {
    this.authUrl = url;
  }
  saveCodeVerifier(v: string) {
    this.verifier = v;
  }
  codeVerifier() {
    return this.verifier;
  }
}

describe("OAuth 2.1 for remote MCP clients", () => {
  it("publishes discovery metadata", async () => {
    const pr = await (await appFetch("https://folio.test/.well-known/oauth-protected-resource/mcp")).json();
    expect(pr.resource).toBe("https://folio.test/mcp");
    expect(pr.authorization_servers).toEqual(["https://folio.test"]);
    const as = await (await appFetch("https://folio.test/.well-known/oauth-authorization-server")).json();
    expect(as.code_challenge_methods_supported).toEqual(["S256"]);
    expect(as.registration_endpoint).toBe("https://folio.test/oauth/register");
  });

  it("validates redirect URIs", () => {
    expect(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(isAllowedRedirectUri("http://localhost:3334/cb")).toBe(true);
    expect(isAllowedRedirectUri("cursor://anysphere.cursor-retrieval/oauth/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://evil.com/cb")).toBe(false);
    expect(isAllowedRedirectUri("javascript:alert(1)")).toBe(false);
  });

  it("completes discovery -> DCR -> PKCE authorize -> token -> tool call -> refresh with the official SDK client", async () => {
    const { user, actor } = await makeUser("oauth");
    const site = await createSite(actor, { name: "OAuth Site" });
    const provider = new MemoryProvider();
    const url = new URL("https://folio.test/mcp");
    let transport = new StreamableHTTPClientTransport(url, { authProvider: provider, fetch: appFetch });
    const client = new Client({ name: "agent", version: "1" });
    await expect(client.connect(transport)).rejects.toBeInstanceOf(UnauthorizedError);

    // The SDK registered itself and built an authorization URL with PKCE.
    expect(provider.info?.client_id).toMatch(/^fcl_/);
    const authUrl = provider.authUrl!;
    expect(authUrl.pathname).toBe("/oauth/authorize");
    expect(authUrl.searchParams.get("code_challenge_method")).toBe("S256");

    // Simulate the signed-in user approving on the consent screen.
    const v = await validateAuthorizeRequest(Object.fromEntries(authUrl.searchParams));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const redirect = new URL(
      await approveAuthorization(user.id, v.params, { name: "Test Agent", scopes: ["sites:read", "content:write", "content:publish"], allSites: false, siteIds: [site.id] }),
    );
    expect(redirect.searchParams.get("state")).toBe(authUrl.searchParams.get("state"));
    await transport.finishAuth(redirect.searchParams.get("code")!);
    expect(provider.tok?.access_token).toMatch(/^fol_at_/);

    transport = new StreamableHTTPClientTransport(url, { authProvider: provider, fetch: appFetch });
    const c2 = new Client({ name: "agent", version: "1" });
    await c2.connect(transport);
    const sites = (await call(c2, "list_sites")).structuredContent!.sites;
    expect(sites.map((s: { id: string }) => s.id)).toEqual([site.id]);
    // scope not granted
    expect((await call(c2, "update_theme", { siteId: site.id, theme: { primaryColor: "#000000" } })).structuredContent!.error.code).toBe("FORBIDDEN");

    // Refresh token rotation; reusing the old refresh token revokes the family.
    const oldRefresh = provider.tok!.refresh_token!;
    const refresh = async (rt: string) =>
      appFetch("https://folio.test/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: rt, client_id: provider.info!.client_id }),
      });
    const r1 = await refresh(oldRefresh);
    expect(r1.status).toBe(200);
    const fresh = await r1.json();
    expect(fresh.refresh_token).not.toBe(oldRefresh);
    expect((await refresh(oldRefresh)).status).toBe(400);
    expect((await refresh(fresh.refresh_token)).status).toBe(400); // whole family revoked on reuse

    // Authorization code cannot be replayed.
    const replay = await appFetch("https://folio.test/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code: redirect.searchParams.get("code")!, client_id: provider.info!.client_id, redirect_uri: provider.redirectUrl, code_verifier: provider.verifier }),
    });
    expect(replay.status).toBe(400);

  });

  it("rejects wrong PKCE verifier", async () => {
    const { user } = await makeUser("pkce");
    const reg = await (
      await appFetch("https://folio.test/oauth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "x", redirect_uris: ["https://app.example/cb"] }) })
    ).json();
    const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"; // sha256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")
    const v = await validateAuthorizeRequest({ response_type: "code", client_id: reg.client_id, redirect_uri: "https://app.example/cb", code_challenge: challenge, code_challenge_method: "S256", state: "s" });
    if (!v.ok) throw new Error(v.error);
    const code = new URL(await approveAuthorization(user.id, v.params, { name: "x", scopes: ["sites:read"], allSites: true })).searchParams.get("code")!;
    const bad = await appFetch("https://folio.test/oauth/token", {
      method: "POST",
      body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: reg.client_id, redirect_uri: "https://app.example/cb", code_verifier: "x".repeat(43) }),
    });
    expect(bad.status).toBe(400);
    const good = await appFetch("https://folio.test/oauth/token", {
      method: "POST",
      body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: reg.client_id, redirect_uri: "https://app.example/cb", code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" }),
    });
    // The code was consumed? No: failed PKCE must not burn it, but a correct verifier after a failure is fine.
    expect(good.status).toBe(200);
  });

  it("refuses unregistered redirect URIs without redirecting", async () => {
    const reg = await (
      await appFetch("https://folio.test/oauth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ redirect_uris: ["https://app.example/cb"] }) })
    ).json();
    const v = await validateAuthorizeRequest({ response_type: "code", client_id: reg.client_id, redirect_uri: "https://evil.example/cb", code_challenge: "a".repeat(43), code_challenge_method: "S256" });
    expect(v.ok).toBe(false);
    expect("redirect" in v && v.redirect).toBeFalsy();
  });
});

describe("reconnecting a previously approved app skips consent", () => {
  const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
  const register = async (redirectUri: string) =>
    (
      await appFetch("https://folio.test/oauth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "Re Agent", redirect_uris: [redirectUri] }) })
    ).json() as Promise<{ client_id: string }>;
  const request = async (clientId: string, redirectUri: string, scope?: string) => {
    const v = await validateAuthorizeRequest({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, code_challenge: CHALLENGE, code_challenge_method: "S256", state: "s", scope });
    if (!v.ok) throw new Error(v.error);
    return v;
  };
  const exchange = (code: string, clientId: string, redirectUri: string) =>
    appFetch("https://folio.test/oauth/token", {
      method: "POST",
      body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, redirect_uri: redirectUri, code_verifier: VERIFIER }),
    });
  const connectionsOf = async (userId: string) => (await getDb()).select().from(agentConnections).where(eq(agentConnections.userId, userId));

  it("reuses the grant for the same client without creating a new connection", async () => {
    const { user } = await makeUser("reauth-same");
    const { client_id } = await register("http://localhost:7001/cb");
    const v = await request(client_id, "http://localhost:7001/cb");
    expect(await reauthorize(user.id, v.params, v.requestedScopes)).toBeNull(); // never approved yet
    await approveAuthorization(user.id, v.params, { name: "Re Agent", scopes: ["sites:read", "content:write"], allSites: true });

    const url = new URL((await reauthorize(user.id, v.params, v.requestedScopes))!);
    expect(url.searchParams.get("state")).toBe("s");
    const res = await exchange(url.searchParams.get("code")!, client_id, "http://localhost:7001/cb");
    expect(res.status).toBe(200);
    expect((await res.json()).scope).toBe("sites:read content:write");
    expect(await connectionsOf(user.id)).toHaveLength(1);
  });

  it("asks again for scopes the user never granted, after revocation, and for other users", async () => {
    const { user } = await makeUser("reauth-scope");
    const { user: other } = await makeUser("reauth-other");
    const { client_id } = await register("https://re.example/cb");
    const v = await request(client_id, "https://re.example/cb");
    await approveAuthorization(user.id, v.params, { name: "Re Agent", scopes: ["sites:read"], allSites: true });

    const broader = await request(client_id, "https://re.example/cb", "sites:read content:publish");
    expect(await reauthorize(user.id, broader.params, broader.requestedScopes)).toBeNull();
    expect(await reauthorize(other.id, v.params, v.requestedScopes)).toBeNull();

    await (await getDb()).update(agentConnections).set({ revokedAt: new Date() }).where(eq(agentConnections.userId, user.id));
    expect(await reauthorize(user.id, v.params, v.requestedScopes)).toBeNull();
  });

  it("copies the grant to a re-registered client with the same https callback", async () => {
    const { user, actor } = await makeUser("reauth-copy");
    const site = await createSite(actor, { name: "Copy Site" });
    const first = await register("https://copy.example/cb");
    const v1 = await request(first.client_id, "https://copy.example/cb");
    await approveAuthorization(user.id, v1.params, { name: "Re Agent", scopes: ["sites:read", "content:write"], allSites: false, siteIds: [site.id], confirmPublish: true });

    const second = await register("https://copy.example/cb");
    const v2 = await request(second.client_id, "https://copy.example/cb");
    const url = new URL((await reauthorize(user.id, v2.params, v2.requestedScopes))!);
    expect((await exchange(url.searchParams.get("code")!, second.client_id, "https://copy.example/cb")).status).toBe(200);

    const conns = await connectionsOf(user.id);
    expect(conns).toHaveLength(2);
    const copy = conns.find((c) => c.clientId === second.client_id)!;
    expect(copy).toMatchObject({ scopes: ["sites:read", "content:write"], allSites: false, confirmPublish: true });
    const granted = await (await getDb()).select().from(agentConnectionSites).where(eq(agentConnectionSites.connectionId, copy.id));
    expect(granted.map((g) => g.siteId)).toEqual([site.id]);
  });

  it("never matches loopback callbacks across clients", async () => {
    const { user } = await makeUser("reauth-loop");
    const first = await register("http://127.0.0.1:7002/cb");
    const v1 = await request(first.client_id, "http://127.0.0.1:7002/cb");
    await approveAuthorization(user.id, v1.params, { name: "Re Agent", scopes: ["sites:read"], allSites: true });
    const second = await register("http://127.0.0.1:7002/cb");
    const v2 = await request(second.client_id, "http://127.0.0.1:7002/cb");
    expect(await reauthorize(user.id, v2.params, v2.requestedScopes)).toBeNull();
  });
});
