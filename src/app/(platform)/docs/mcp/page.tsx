import type { Metadata } from "next";
import Link from "next/link";
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
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← {config.appName}
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">MCP server</h1>
      <p className="mt-3 text-muted-foreground">
        A remote MCP server over Streamable HTTP. Authentication is OAuth 2.1 with PKCE and dynamic client registration (RFC 7591, RFC 8414, RFC 9728), or a bearer API key.
      </p>
      <div className="mt-6">
        <CodeBlock code={url} />
      </div>

      <h2 className="mt-12 text-lg font-semibold">Connect a client</h2>
      <div className="mt-4 space-y-8">
        {clientInstructions(url, config.appName).map((c) => (
          <div key={c.id}>
            <h3 className="font-medium">{c.name}</h3>
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

      <h2 className="mt-12 text-lg font-semibold">Permissions</h2>
      <ul className="mt-3 space-y-1.5 text-sm">
        {Object.entries(SCOPES).map(([k, v]) => (
          <li key={k}>
            <code className="font-mono text-xs">{k}</code> <span className="text-muted-foreground">— {v}</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-lg font-semibold">Tools</h2>
      <ul className="mt-3 divide-y rounded-xl border">
        {toolList().map((t) => (
          <li key={t.name} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <code className="font-mono text-sm">{t.name}</code>
              {t.annotations?.destructiveHint ? <span className="text-xs text-destructive">confirmation required</span> : null}
              {t.annotations?.readOnlyHint ? <span className="text-xs text-muted-foreground">read-only</span> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-lg font-semibold">Server instructions</h2>
      <pre className="mt-3 rounded-xl border bg-muted/30 p-4 text-sm whitespace-pre-wrap">{SERVER_INSTRUCTIONS}</pre>
    </main>
  );
}
