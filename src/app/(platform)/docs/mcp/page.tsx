import type { Metadata } from "next";
import { PageIntro, PublicShell } from "@/components/app/brand";
import { CodeBlock } from "@/components/app/copy-button";
import { clientInstructions } from "@/lib/clients";
import { config } from "@/lib/config";
import { SCOPES } from "@/server/actor";
import { buildMcpServer, SERVER_INSTRUCTIONS } from "@/server/mcp/server";
import { mcpResourceUrl } from "@/server/oauth/oauth";

export const metadata: Metadata = { title: "MCP server" };

/** Tool reference rendered from the live server definition, so docs can't drift. */
function toolList() {
  const server = buildMcpServer({ kind: "user", userId: "00000000-0000-0000-0000-000000000000" });
  const tools = (server as unknown as { _registeredTools: Record<string, { title?: string; description?: string; annotations?: { destructiveHint?: boolean; readOnlyHint?: boolean } }> })._registeredTools;
  return Object.entries(tools).map(([name, t]) => ({ name, ...t }));
}

export default function McpDocs() {
  const url = mcpResourceUrl();
  return (
    <PublicShell>
      <main className="mx-auto max-w-3xl px-6 pt-14 pb-24">
        <PageIntro kicker="Docs" title="MCP server">
          A remote MCP server over Streamable HTTP. Authentication is OAuth 2.1 with PKCE and dynamic client registration (RFC 7591, RFC 8414, RFC 9728), or a bearer API key.
        </PageIntro>
        <div className="mt-8">
          <CodeBlock code={url} />
        </div>

        <h2 className="op-h2 mt-14">Connect a client</h2>
        <div className="mt-4 space-y-4">
          {clientInstructions(url, config.appName).map((c) => (
            <div key={c.id} className="op-card p-5">
              <h3 className="text-lg font-semibold tracking-tight">{c.name}</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                {c.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <div className="mt-3">
                <CodeBlock code={c.code} />
              </div>
            </div>
          ))}
        </div>

        <h2 className="op-h2 mt-14">Permissions</h2>
        <ul className="mt-3 space-y-1.5 text-sm">
          {Object.entries(SCOPES).map(([k, v]) => (
            <li key={k}>
              <code className="font-mono text-xs">{k}</code> <span className="text-muted-foreground">— {v}</span>
            </li>
          ))}
        </ul>

        <h2 className="op-h2 mt-14">Tools</h2>
        <ul className="mt-3 op-card divide-y">
          {toolList().map((t) => (
            <li key={t.name} className="px-5 py-4">
              <div className="flex items-center gap-2">
                <code className="font-mono text-sm">{t.name}</code>
                {t.annotations?.destructiveHint ? <span className="text-xs text-destructive">confirmation required</span> : null}
                {t.annotations?.readOnlyHint ? <span className="text-xs text-muted-foreground">read-only</span> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
            </li>
          ))}
        </ul>

        <h2 className="op-h2 mt-14">Server instructions</h2>
        <pre className="op-well mt-3 p-5 text-sm whitespace-pre-wrap">{SERVER_INSTRUCTIONS}</pre>
      </main>
    </PublicShell>
  );
}
