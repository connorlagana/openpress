import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { DEFAULT_AGENT_SCOPES, SCOPES } from "@/server/actor";
import { getCurrentUser, SEEN_COOKIE } from "@/server/auth/session";
import { validateAuthorizeRequest } from "@/server/oauth/oauth";
import { listSites } from "@/server/services/sites";
import { ConsentForm } from "./consent-form";

export const metadata: Metadata = { title: "Authorize agent", robots: { index: false } };

export default async function AuthorizePage({ searchParams }: PageProps<"/oauth/authorize">) {
  const raw = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) as Record<string, string | undefined>;
  const query = new URLSearchParams(Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
  const v = await validateAuthorizeRequest(raw);
  if (!v.ok) {
    if (v.redirect) redirect(v.redirect);
    return (
      <main className="mx-auto max-w-md px-4 py-24">
        <h1 className="text-xl font-semibold">Can&rsquo;t connect this agent</h1>
        <p className="mt-2 text-sm text-muted-foreground">{v.error}</p>
      </main>
    );
  }
  const user = await getCurrentUser();
  // Agent-first visitors usually have no account yet, so start them on signup;
  // the page links to sign-in for everyone else. A remembered login skips both.
  if (!user) {
    const next = encodeURIComponent(`/oauth/authorize?${query}`);
    redirect((await cookies()).has(SEEN_COOKIE) ? `/login?next=${next}` : `/signup?next=${next}`);
  }
  const sites = await listSites({ kind: "user", userId: user.id });
  const requested = v.requestedScopes ?? DEFAULT_AGENT_SCOPES;
  const redirectHost = (() => {
    const u = new URL(v.params.redirect_uri);
    return u.protocol.startsWith("http") ? u.host : u.protocol.replace(/:$/, "");
  })();

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-12 sm:py-20">
      <p className="text-sm text-muted-foreground">{config.appName}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Allow <span className="break-words">{v.client.name}</span> to manage your websites?
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Signed in as {user.email}. After approval you&rsquo;ll return to <span className="font-mono text-foreground">{redirectHost}</span>. Only approve agents you trust; you can revoke access anytime in Dashboard → Agents.
      </p>
      {sites.length === 0 ? (
        <p className="mt-4 rounded-lg border bg-muted/40 px-3 py-2 text-sm">You don&rsquo;t have a site yet. Once you approve, just ask your agent to create one.</p>
      ) : null}
      <ConsentForm query={query} scopes={SCOPES} requested={requested} sites={sites.map((s) => ({ id: s.id, name: s.name, url: s.url }))} />
    </main>
  );
}
