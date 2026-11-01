import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Logo } from "@/components/app/brand";
import { SsoButtons } from "@/components/app/sso-buttons";
import { config } from "@/lib/config";
import { DEFAULT_AGENT_SCOPES, SCOPES } from "@/server/actor";
import { clientIp, getCurrentUser, SEEN_COOKIE } from "@/server/auth/session";
import { reauthorize, validateAuthorizeRequest } from "@/server/oauth/oauth";
import { listSites } from "@/server/services/sites";
import { ConsentForm } from "./consent-form";

export const metadata: Metadata = { title: "Authorize agent", robots: { index: false } };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="op-canvas flex min-h-screen flex-col">
      <header className="flex h-14 items-center px-6 text-sm">
        <Logo />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-4 pb-16 sm:pt-[6vh]">
        <div className="op-card w-full max-w-lg p-6 sm:p-8">{children}</div>
      </main>
    </div>
  );
}

export default async function AuthorizePage({ searchParams }: PageProps<"/oauth/authorize">) {
  const raw = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) as Record<string, string | undefined>;
  const query = new URLSearchParams(Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
  const v = await validateAuthorizeRequest(raw);
  if (!v.ok) {
    if (v.redirect) redirect(v.redirect);
    return (
      <Shell>
        <h1 className="op-h2">Can&rsquo;t connect this agent</h1>
        <p className="mt-2 text-sm text-muted-foreground">{v.error}</p>
        <p className="mt-4 text-sm text-muted-foreground">Go back to your AI app and try connecting again. If it keeps happening, remove the connector there and add it again.</p>
        <a href="/docs/mcp" className="mt-6 inline-block text-sm font-medium underline underline-offset-4">
          Read the setup guide
        </a>
      </Shell>
    );
  }
  const user = await getCurrentUser();
  const requested = v.requestedScopes ?? DEFAULT_AGENT_SCOPES;
  const redirectHost = (() => {
    const u = new URL(v.params.redirect_uri);
    return u.protocol.startsWith("http") ? u.host : u.protocol.replace(/:$/, "");
  })();

  // Agent-first visitors usually have no account yet: create one (or sign in)
  // and approve on this same screen.
  if (!user) {
    const seen = (await cookies()).has(SEEN_COOKIE);
    return (
      <Shell>
        <p className="op-kicker">Connect an agent</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-balance">
          Connect <span className="break-words">{v.client.name}</span> to {config.appName}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {seen ? "Sign in" : "Create a free account"} and approve in one step. You&rsquo;ll go straight back to{" "}
          <span className="font-mono text-foreground">{redirectHost}</span>. Only approve agents you trust.
        </p>
        <div className="mt-8">
          <SsoButtons next={`/oauth/authorize?${query}`} />
        </div>
        <ConsentForm query={query} scopes={SCOPES} requested={requested} sites={[]} account={{ defaultMode: seen ? "login" : "signup" }} />
      </Shell>
    );
  }

  // Already approved this app before: reconnect without asking again,
  // unless the client explicitly wants the consent screen.
  if (raw.prompt !== "consent") {
    const url = await reauthorize(user.id, v.params, v.requestedScopes, clientIp(await headers()));
    if (url) redirect(url);
  }

  const sites = await listSites({ kind: "user", userId: user.id });

  return (
    <Shell>
      <p className="op-kicker">Authorize agent</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-balance">
        Allow <span className="break-words">{v.client.name}</span> to manage your websites?
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Signed in as {user.email}. After approval you&rsquo;ll return to <span className="font-mono text-foreground">{redirectHost}</span>. Only approve agents you trust; you can revoke access anytime in Dashboard → Agents.
      </p>
      {sites.length === 0 ? (
        <p className="mt-4 rounded-xl bg-signal/10 px-4 py-3 text-sm">You don&rsquo;t have a site yet. Once you approve, just ask your agent to create one.</p>
      ) : null}
      <ConsentForm query={query} scopes={SCOPES} requested={requested} sites={sites.map((s) => ({ id: s.id, name: s.name, url: s.url }))} />
    </Shell>
  );
}
