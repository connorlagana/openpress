"use server";

import { headers } from "next/headers";
import { authErrorMessage, logInAndSignIn, signUpAndSignIn } from "@/server/auth/flows";
import { clientIp, requireUser } from "@/server/auth/session";
import { approveAuthorization, errorRedirect, validateAuthorizeRequest } from "@/server/oauth/oauth";
import type { Scope } from "@/server/actor";

type Decision = { approve: boolean; scopes: Scope[]; allSites: boolean; siteIds: string[]; confirmPublish: boolean };
export type Account = { mode: "signup" | "login"; email: string; password: string; website: string };

/** Re-validates the original request server-side; the client only supplies the user's choices. */
export async function decideAction(query: string, decision: Decision) {
  const v = await validateAuthorizeRequest(Object.fromEntries(new URLSearchParams(query)));
  if (!v.ok) return { error: v.error };
  // Denying needs no account: it only sends the client its own error.
  if (!decision.approve) return { redirect: errorRedirect(v.params.redirect_uri, "access_denied", v.params.state) };
  const user = await requireUser();
  return { redirect: await approve(user.id, v, decision) };
}

type ValidRequest = Extract<Awaited<ReturnType<typeof validateAuthorizeRequest>>, { ok: true }>;

async function approve(userId: string, v: ValidRequest, decision: Decision) {
  return approveAuthorization(
    userId,
    v.params,
    { name: v.client.name, scopes: decision.scopes, allSites: decision.allSites, siteIds: decision.siteIds, confirmPublish: decision.confirmPublish },
    clientIp(await headers()),
  );
}

/** Signed-out visitors create an account (or sign in) and approve in one step. */
export async function connectAction(query: string, account: Account, decision: Decision) {
  const v = await validateAuthorizeRequest(Object.fromEntries(new URLSearchParams(query)));
  if (!v.ok) return { error: v.error };
  let userId: string;
  try {
    const user =
      account.mode === "signup"
        ? await signUpAndSignIn({ email: account.email, password: account.password, honeypot: account.website })
        : await logInAndSignIn(account.email, account.password);
    userId = user.id;
  } catch (e) {
    return { error: authErrorMessage(e) };
  }
  return { redirect: await approve(userId, v, decision) };
}
