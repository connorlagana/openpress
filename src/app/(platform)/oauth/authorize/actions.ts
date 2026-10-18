"use server";

import { headers } from "next/headers";
import { clientIp, requireUser } from "@/server/auth/session";
import { approveAuthorization, errorRedirect, validateAuthorizeRequest } from "@/server/oauth/oauth";
import type { Scope } from "@/server/actor";

/** Re-validates the original request server-side; the client only supplies the user's choices. */
export async function decideAction(query: string, decision: { approve: boolean; scopes: Scope[]; allSites: boolean; siteIds: string[]; confirmPublish: boolean }) {
  const user = await requireUser();
  const v = await validateAuthorizeRequest(Object.fromEntries(new URLSearchParams(query)));
  if (!v.ok) return { error: v.error };
  if (!decision.approve) return { redirect: errorRedirect(v.params.redirect_uri, "access_denied", v.params.state) };
  const url = await approveAuthorization(
    user.id,
    v.params,
    { name: v.client.name, scopes: decision.scopes, allSites: decision.allSites, siteIds: decision.siteIds, confirmPublish: decision.confirmPublish },
    clientIp(await headers()),
  );
  return { redirect: url };
}
