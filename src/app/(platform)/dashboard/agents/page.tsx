import type { Metadata } from "next";
import { PageHeader, Section, relativeTime } from "@/components/app/bits";
import { CopyButton } from "@/components/app/copy-button";
import { clientInstructions } from "@/lib/clients";
import { config } from "@/lib/config";
import { SCOPES } from "@/server/actor";
import { requireActor } from "@/server/auth/session";
import { mcpResourceUrl } from "@/server/oauth/oauth";
import { listConnections } from "@/server/services/agents";
import { listSites } from "@/server/services/sites";
import { ClientTabs } from "@/components/app/client-tabs";
import { ConnectionActions, NewApiKey } from "./agents-client";

export const metadata: Metadata = { title: "Agents" };

export default async function AgentsPage() {
  const actor = await requireActor();
  const [connections, sites] = await Promise.all([listConnections(actor), listSites(actor)]);
  const mcpUrl = mcpResourceUrl();
  const siteOptions = sites.map((s) => ({ id: s.id, name: s.name }));

  return (
    <>
      <PageHeader title="Agents" description="Connect any MCP-compatible AI agent. It can only do what you allow here." />

      <Section title="MCP server URL" description="The same URL works for every client. Sign-in happens with OAuth.">
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm">{mcpUrl}</code>
          <CopyButton value={mcpUrl} label="Copy URL" />
        </div>
        <div className="mt-6">
          <ClientTabs clients={clientInstructions(mcpUrl, config.appName)} />
        </div>
      </Section>

      <Section title="Connected agents" description="Each connection has its own permissions. Revoking takes effect immediately.">
        {connections.length ? (
          <ul className="divide-y rounded-xl border">
            {connections.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start gap-x-6 gap-y-2 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {c.clientName ?? c.name}
                    <span className="ml-2 rounded border px-1.5 py-0.5 font-mono text-[11px] font-normal text-muted-foreground">{c.kind === "oauth" ? "OAuth" : `API key ${c.keyPrefix ?? ""}…`}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {c.scopes.map((s) => s.replace(":", " ")).join(" · ")} — {c.allSites ? "all sites" : c.sites.map((s) => s.name).join(", ") || "no sites"}
                    {c.confirmPublish ? " — asks before publishing" : ""}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Last used {relativeTime(c.lastUsedAt)} · added {relativeTime(c.createdAt)}
                  </div>
                </div>
                <ConnectionActions connection={{ id: c.id, name: c.clientName ?? c.name, scopes: c.scopes, allSites: c.allSites, siteIds: c.sites.map((s) => s.id), confirmPublish: c.confirmPublish }} sites={siteOptions} scopes={SCOPES} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No agents connected yet. Add the URL above to your AI client.</p>
        )}
      </Section>

      <Section title="API keys" description="For MCP clients that don't support OAuth. Treat keys like passwords.">
        <NewApiKey sites={siteOptions} scopes={SCOPES} mcpUrl={mcpUrl} />
      </Section>
    </>
  );
}
