import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { userIdentities, users, type User } from "@/db/schema";
import { config } from "@/lib/config";
import { fromBase64Url, hmacHex, randomToken, safeEqual, sha256Base64Url, toBase64Url } from "@/lib/crypto";
import { signUpInput } from "./accounts";

// Sign in with Google / Apple (OpenID Connect, authorization code flow).
// The ID token comes straight from the provider's token endpoint over TLS, so
// its claims are checked but not its signature (OIDC Core 3.1.3.7).
// Privileged connection: like accounts.ts, this runs before a tenant identity exists.

export type SsoProvider = "google" | "apple";
export const SSO_PROVIDERS: SsoProvider[] = ["google", "apple"];
export const SSO_COOKIE = "op_sso";

export const isSsoProvider = (p: string): p is SsoProvider => (SSO_PROVIDERS as string[]).includes(p);
export const enabledSsoProviders = (): SsoProvider[] => SSO_PROVIDERS.filter((p) => config[p]);
export const ssoRedirectUri = (p: SsoProvider) => `${config.appUrl}/auth/${p}/callback`;

const FLOW_TTL_MS = 10 * 60_000;

export type SsoErrorCode = "invalid_state" | "provider" | "no_email" | "account_exists" | "linked_elsewhere" | "suspended";
export const SSO_ERROR_MESSAGES: Record<SsoErrorCode, string> = {
  invalid_state: "That sign-in link expired. Please try again.",
  provider: "We couldn't complete sign-in with that provider. Please try again.",
  no_email: "Your account didn't share an email address, which we need to create your account.",
  account_exists: "An account with this email already exists. Sign in with your password, then connect it in Dashboard → Account.",
  linked_elsewhere: "That account is already connected to a different user.",
  suspended: "This account is suspended.",
};

export class SsoError extends Error {
  constructor(public code: SsoErrorCode) {
    super(SSO_ERROR_MESSAGES[code]);
  }
}

/** Everything the callback needs to trust, carried in an HMAC-signed, short-lived cookie. */
const flowSchema = z.object({
  provider: z.enum(["google", "apple"]),
  state: z.string(),
  nonce: z.string(),
  verifier: z.string(),
  next: z.string().nullable(),
  /** Set when a signed-in user is connecting this provider to their account. */
  linkUserId: z.string().uuid().nullable(),
  exp: z.number(),
});
type Flow = z.infer<typeof flowSchema>;

async function sealFlow(flow: Flow) {
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(flow)));
  return `${body}.${await hmacHex(config.secret, `sso:${body}`)}`;
}

async function openFlow(cookie: string | undefined): Promise<Flow | null> {
  const [body, mac] = (cookie ?? "").split(".");
  if (!body || !mac || !safeEqual(mac, await hmacHex(config.secret, `sso:${body}`))) return null;
  try {
    const flow = flowSchema.parse(JSON.parse(new TextDecoder().decode(fromBase64Url(body))));
    return flow.exp > Date.now() ? flow : null;
  } catch {
    return null;
  }
}

/** Where a flow was headed, for sending the user back after a failed or cancelled sign-in. */
export async function peekFlow(cookie: string | undefined) {
  const flow = await openFlow(cookie);
  return { next: flow?.next ?? null, linking: !!flow?.linkUserId };
}

/** Only same-site relative paths. */
export function safeNext(next: string | null | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null;
}

/** Build the provider's authorization URL and the flow cookie to set alongside the redirect. */
export async function startSso(provider: SsoProvider, opts: { next?: string | null; linkUserId?: string | null } = {}) {
  const flow: Flow = {
    provider,
    state: randomToken(24),
    nonce: randomToken(24),
    verifier: randomToken(32),
    next: safeNext(opts.next),
    linkUserId: opts.linkUserId ?? null,
    exp: Date.now() + FLOW_TTL_MS,
  };
  const p = new URLSearchParams({ response_type: "code", redirect_uri: ssoRedirectUri(provider), state: flow.state, nonce: flow.nonce });
  let url: string;
  if (provider === "google") {
    const g = config.google;
    if (!g) throw new SsoError("provider");
    p.set("client_id", g.clientId);
    p.set("scope", "openid email profile");
    p.set("code_challenge", await sha256Base64Url(flow.verifier));
    p.set("code_challenge_method", "S256");
    p.set("prompt", "select_account");
    url = `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
  } else {
    const a = config.apple;
    if (!a) throw new SsoError("provider");
    p.set("client_id", a.clientId);
    p.set("scope", "name email");
    // Apple requires form_post whenever name or email is requested.
    p.set("response_mode", "form_post");
    url = `https://appleid.apple.com/auth/authorize?${p}`;
  }
  return { url, cookie: await sealFlow(flow) };
}

type Claims = { sub: string; email: string | null; name: string | null };

function decodeJwtPayload(jwt: unknown): Record<string, unknown> {
  if (typeof jwt !== "string") throw new SsoError("provider");
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(jwt.split(".")[1] ?? "")));
  } catch {
    throw new SsoError("provider");
  }
}

function checkIdToken(c: Record<string, unknown>, issuers: string[], audience: string, nonce: string) {
  const ok =
    typeof c.iss === "string" &&
    issuers.includes(c.iss) &&
    (c.aud === audience || (Array.isArray(c.aud) && c.aud.includes(audience))) &&
    typeof c.exp === "number" &&
    c.exp * 1000 > Date.now() &&
    c.nonce === nonce &&
    typeof c.sub === "string" &&
    c.sub.length > 0;
  if (!ok) throw new SsoError("provider");
}

async function tokenRequest(url: string, form: Record<string, string>) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body: new URLSearchParams(form) });
  if (!res.ok) throw new SsoError("provider");
  return (await res.json()) as { id_token?: unknown };
}

async function googleClaims(code: string, flow: Flow): Promise<Claims> {
  const g = config.google;
  if (!g) throw new SsoError("provider");
  const t = await tokenRequest("https://oauth2.googleapis.com/token", {
    grant_type: "authorization_code",
    code,
    client_id: g.clientId,
    client_secret: g.clientSecret,
    redirect_uri: ssoRedirectUri("google"),
    code_verifier: flow.verifier,
  });
  const c = decodeJwtPayload(t.id_token);
  checkIdToken(c, ["https://accounts.google.com", "accounts.google.com"], g.clientId, flow.nonce);
  return {
    sub: c.sub as string,
    email: c.email_verified === true && typeof c.email === "string" ? c.email : null,
    name: typeof c.name === "string" ? c.name : null,
  };
}

/** Apple's client secret is a short-lived ES256 JWT signed with the team's Sign in with Apple key. */
export async function appleClientSecret(a: NonNullable<typeof config.apple>) {
  const enc = (o: unknown) => toBase64Url(new TextEncoder().encode(JSON.stringify(o)));
  const now = Math.floor(Date.now() / 1000);
  const signingInput = `${enc({ alg: "ES256", kid: a.keyId })}.${enc({ iss: a.teamId, iat: now, exp: now + 300, aud: "https://appleid.apple.com", sub: a.clientId })}`;
  const der = Uint8Array.from(atob(a.privateKey.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (ch) => ch.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  // WebCrypto returns the raw r||s signature, which is exactly what JWS ES256 wants.
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${toBase64Url(new Uint8Array(sig))}`;
}

async function appleClaims(code: string, flow: Flow, appleUser: string | null | undefined): Promise<Claims> {
  const a = config.apple;
  if (!a) throw new SsoError("provider");
  const t = await tokenRequest("https://appleid.apple.com/auth/token", {
    grant_type: "authorization_code",
    code,
    client_id: a.clientId,
    client_secret: await appleClientSecret(a),
    redirect_uri: ssoRedirectUri("apple"),
  });
  const c = decodeJwtPayload(t.id_token);
  checkIdToken(c, ["https://appleid.apple.com"], a.clientId, flow.nonce);
  // Apple sends the user's name only once, as an unsigned form field; it's used for display only.
  let name: string | null = null;
  try {
    const n = (JSON.parse(appleUser ?? "null") as { name?: { firstName?: string; lastName?: string } } | null)?.name;
    name = [n?.firstName, n?.lastName].filter((x) => typeof x === "string" && x).join(" ").slice(0, 80) || null;
  } catch {}
  const verified = c.email_verified === true || c.email_verified === "true";
  return { sub: c.sub as string, email: verified && typeof c.email === "string" ? c.email : null, name };
}

/**
 * Complete a sign-in: verify the flow cookie, exchange the code, then find,
 * link or create the user. An existing password account is never linked by
 * email alone, since its email was never verified; the owner connects the
 * provider from Account settings while signed in instead.
 */
export async function finishSso(
  provider: SsoProvider,
  input: { code?: string | null; state?: string | null; appleUser?: string | null },
  cookie: string | undefined,
  opts: { signupSource?: string } = {},
): Promise<{ user: User; created: boolean; linked: boolean; next: string | null }> {
  const flow = await openFlow(cookie);
  if (!flow || flow.provider !== provider || !input.state || !safeEqual(input.state, flow.state) || !input.code) throw new SsoError("invalid_state");
  const claims = provider === "google" ? await googleClaims(input.code, flow) : await appleClaims(input.code, flow, input.appleUser);
  const db = await getDb();

  const [identity] = await db.select().from(userIdentities).where(and(eq(userIdentities.provider, provider), eq(userIdentities.subject, claims.sub)));
  const finish = (user: User | undefined, created = false, linked = false) => {
    if (!user) throw new SsoError("provider");
    if (user.suspendedAt) throw new SsoError("suspended");
    return { user, created, linked, next: flow.next };
  };
  const byId = async (id: string) => (await db.select().from(users).where(eq(users.id, id)))[0];
  const link = (userId: string) => db.insert(userIdentities).values({ provider, subject: claims.sub, userId, email: claims.email });

  if (flow.linkUserId) {
    if (identity && identity.userId !== flow.linkUserId) throw new SsoError("linked_elsewhere");
    if (!identity) await link(flow.linkUserId);
    return finish(await byId(flow.linkUserId), false, !identity);
  }
  if (identity) return finish(await byId(identity.userId));

  if (!claims.email) throw new SsoError("no_email");
  const email = claims.email.trim().toLowerCase();
  const [existing] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email));
  if (existing) {
    if (existing.suspendedAt) throw new SsoError("suspended");
    if (existing.passwordHash) throw new SsoError("account_exists");
    // Created through the other provider: both verified this email, so link.
    await link(existing.id);
    return finish(existing, false, true);
  }
  const user = await db.transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ email, passwordHash: null, name: claims.name, signupSource: signUpInput.shape.signupSource.parse(opts.signupSource) ?? null }).returning();
    await tx.insert(userIdentities).values({ provider, subject: claims.sub, userId: u.id, email });
    return u;
  });
  return finish(user, true, true);
}
