import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { config } from "@/lib/config";
import { ipFromHeaders } from "../http/util";
import type { Actor } from "../actor";
import { createSession, deleteSession, userForSessionToken } from "./accounts";

export const SESSION_COOKIE = "folio_session";
/** Marks a browser that has signed in before, so sign-in prompts default to login instead of signup. Survives logout. */
export const SEEN_COOKIE = "op_seen";

/** Host-only cookie on the app domain: never sent to user sites on subdomains. */
export async function setSessionCookie(userId: string) {
  const h = await headers();
  const { token, expiresAt } = await createSession(userId, { ip: clientIp(h), userAgent: h.get("user-agent") });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.protocol === "https",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  (await cookies()).set(SEEN_COOKIE, "1", { httpOnly: true, secure: config.protocol === "https", sameSite: "lax", path: "/", maxAge: 365 * 86400 });
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);
  jar.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? userForSessionToken(token) : null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireActor(): Promise<Actor> {
  const user = await requireUser();
  return { kind: "user", userId: user.id, ip: clientIp(await headers()) };
}

export function clientIp(h: Headers): string | null {
  return ipFromHeaders(h);
}
