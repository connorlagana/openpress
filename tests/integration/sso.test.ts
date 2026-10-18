import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { userIdentities, users } from "@/db/schema";
import { fromBase64Url, sha256Base64Url, toBase64Url } from "@/lib/crypto";
import { authenticate } from "@/server/auth/accounts";
import { finishSso, startSso, type SsoProvider } from "@/server/auth/sso";
import { changePassword } from "@/server/services/account";
import { makeUser } from "../helpers";

const b64json = (o: unknown) => toBase64Url(new TextEncoder().encode(JSON.stringify(o)));
const fakeJwt = (claims: Record<string, unknown>) => `${b64json({ alg: "RS256" })}.${b64json(claims)}.sig`;

let applePublicKey: CryptoKey;
let seq = 0;
/** What the stubbed token endpoint puts in the ID token; tests override fields. */
let idClaims: (nonce: string) => Record<string, unknown>;
let tokenRequests: { url: string; body: URLSearchParams }[] = [];

beforeEach(async () => {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  applePublicKey = pair.publicKey;
  const pkcs8 = toBase64Url(new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey))).replace(/-/g, "+").replace(/_/g, "/");
  vi.stubEnv("GOOGLE_CLIENT_ID", "google-client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-secret");
  vi.stubEnv("APPLE_CLIENT_ID", "com.example.web");
  vi.stubEnv("APPLE_TEAM_ID", "TEAM123");
  vi.stubEnv("APPLE_KEY_ID", "KEY123");
  // As it usually arrives from an env file: one line with literal \n.
  vi.stubEnv("APPLE_PRIVATE_KEY", `-----BEGIN PRIVATE KEY-----\\n${pkcs8}\\n-----END PRIVATE KEY-----`);
  tokenRequests = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const body = new URLSearchParams(String(init.body));
    tokenRequests.push({ url, body });
    return Response.json({ id_token: fakeJwt(idClaims(currentNonce)) });
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

let currentNonce = "";
let lastAuthUrl: URL;
async function signIn(provider: SsoProvider, claims: Record<string, unknown>, opts: { linkUserId?: string; appleUser?: string; next?: string } = {}) {
  const { url, cookie } = await startSso(provider, { linkUserId: opts.linkUserId, next: opts.next });
  lastAuthUrl = new URL(url);
  const q = lastAuthUrl.searchParams;
  currentNonce = q.get("nonce")!;
  const iss = provider === "google" ? "https://accounts.google.com" : "https://appleid.apple.com";
  const aud = provider === "google" ? "google-client" : "com.example.web";
  idClaims = (nonce) => ({ iss, aud, exp: Math.floor(Date.now() / 1000) + 600, nonce, ...claims });
  return finishSso(provider, { code: "the-code", state: q.get("state"), appleUser: opts.appleUser }, cookie);
}
const email = (p: string) => `${p}${++seq}-${Date.now()}@example.com`;

describe("Sign in with Google", () => {
  it("creates a passwordless account, then signs the same identity back in", async () => {
    const addr = email("g-new");
    const first = await signIn("google", { sub: `g-${addr}`, email: addr, email_verified: true, name: "Grace Hopper" }, { next: "/oauth/authorize?x=1" });
    expect(first).toMatchObject({ created: true, next: "/oauth/authorize?x=1" });
    expect(first.user).toMatchObject({ email: addr, name: "Grace Hopper", passwordHash: null });

    // PKCE: the verifier sent to Google matches the challenge in the authorization URL.
    expect(lastAuthUrl.searchParams.get("code_challenge_method")).toBe("S256");
    const req = tokenRequests[0];
    expect(req.url).toBe("https://oauth2.googleapis.com/token");
    expect(req.body.get("client_secret")).toBe("google-secret");
    expect(req.body.get("redirect_uri")).toBe("https://folio.test/auth/google/callback");
    expect(await sha256Base64Url(req.body.get("code_verifier")!)).toBe(lastAuthUrl.searchParams.get("code_challenge"));

    const again = await signIn("google", { sub: `g-${addr}`, email: addr, email_verified: true });
    expect(again.created).toBe(false);
    expect(again.user.id).toBe(first.user.id);
    // No password login for a Google-only account.
    await expect(authenticate(addr, "")).rejects.toThrow();
  });

  it("rejects a bad state, a tampered cookie, a wrong nonce or audience, and unverified email", async () => {
    const { url, cookie } = await startSso("google");
    const state = new URL(url).searchParams.get("state")!;
    await expect(finishSso("google", { code: "c", state: "nope" }, cookie)).rejects.toMatchObject({ code: "invalid_state" });
    await expect(finishSso("google", { code: "c", state }, cookie.replace(/.$/, (c) => (c === "0" ? "1" : "0")))).rejects.toMatchObject({ code: "invalid_state" });
    await expect(finishSso("apple", { code: "c", state }, cookie)).rejects.toMatchObject({ code: "invalid_state" });

    idClaims = () => ({ iss: "https://accounts.google.com", aud: "google-client", exp: Math.floor(Date.now() / 1000) + 600, nonce: "other", sub: "s" });
    await expect(finishSso("google", { code: "c", state }, cookie)).rejects.toMatchObject({ code: "provider" });
    await expect(signIn("google", { sub: "s1", aud: "someone-else", email: email("aud"), email_verified: true })).rejects.toMatchObject({ code: "provider" });
    await expect(signIn("google", { sub: "s2", email: email("unverified"), email_verified: false })).rejects.toMatchObject({ code: "no_email" });
  });

  it("never links an existing password account by email; the signed-in owner can connect it", async () => {
    const { user, actor } = await makeUser("pw-owner");
    const sub = `g-owner-${seq++}`;
    await expect(signIn("google", { sub, email: user.email.toUpperCase(), email_verified: true })).rejects.toMatchObject({ code: "account_exists" });
    const db = await getDb();
    expect(await db.select().from(userIdentities).where(eq(userIdentities.userId, user.id))).toHaveLength(0);

    const linked = await signIn("google", { sub, email: user.email, email_verified: true }, { linkUserId: user.id });
    expect(linked).toMatchObject({ linked: true, created: false });
    expect((await signIn("google", { sub, email: user.email, email_verified: true })).user.id).toBe(user.id);

    // The same Google account can't be attached to a second user.
    const { user: other } = await makeUser("pw-other");
    await expect(signIn("google", { sub, email: user.email, email_verified: true }, { linkUserId: other.id })).rejects.toMatchObject({ code: "linked_elsewhere" });

    // Suspended users can't get in this way either.
    await db.update(users).set({ suspendedAt: new Date() }).where(eq(users.id, actor.userId));
    await expect(signIn("google", { sub, email: user.email, email_verified: true })).rejects.toMatchObject({ code: "suspended" });
  });
});

describe("Sign in with Apple", () => {
  it("signs its client secret with the team key, uses the one-time name, and links to a Google account with the same email", async () => {
    const addr = email("a-new");
    const r = await signIn("apple", { sub: `a-${addr}`, email: addr, email_verified: "true" }, { appleUser: JSON.stringify({ name: { firstName: "Ada", lastName: "Lovelace" } }) });
    expect(r.user).toMatchObject({ email: addr, name: "Ada Lovelace", passwordHash: null });

    const secret = tokenRequests[0].body.get("client_secret")!;
    const [h, p, sig] = secret.split(".");
    expect(JSON.parse(new TextDecoder().decode(fromBase64Url(h)))).toEqual({ alg: "ES256", kid: "KEY123" });
    expect(JSON.parse(new TextDecoder().decode(fromBase64Url(p)))).toMatchObject({ iss: "TEAM123", sub: "com.example.web", aud: "https://appleid.apple.com" });
    const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, applePublicKey, fromBase64Url(sig) as BufferSource, new TextEncoder().encode(`${h}.${p}`));
    expect(valid).toBe(true);

    const { url } = await startSso("apple");
    expect(new URL(url).searchParams.get("response_mode")).toBe("form_post");

    // Both providers verified the address and neither has a password: one account.
    const g = await signIn("google", { sub: `g-${addr}`, email: addr, email_verified: true });
    expect(g).toMatchObject({ created: false, linked: true });
    expect(g.user.id).toBe(r.user.id);
    const db = await getDb();
    expect(await db.select().from(userIdentities).where(and(eq(userIdentities.userId, r.user.id)))).toHaveLength(2);
  });

  it("lets a passwordless account set a password without a current one", async () => {
    const addr = email("a-setpw");
    const { user } = await signIn("apple", { sub: `a-${addr}`, email: addr, email_verified: true });
    await changePassword({ kind: "user", userId: user.id }, "", "a-brand-new-password");
    expect((await authenticate(addr, "a-brand-new-password")).id).toBe(user.id);
    await expect(changePassword({ kind: "user", userId: user.id }, "", "another-password-1")).rejects.toThrow("Current password is incorrect.");
  });
});
