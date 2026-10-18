import { config } from "@/lib/config";
import { SCOPES } from "@/server/actor";
import { buildMcpServer } from "@/server/mcp/server";
import { mcpResourceUrl } from "@/server/oauth/oauth";

// https://llmstxt.org — a plain-text overview for agents discovering the platform.
export function GET() {
  const tools = (buildMcpServer({ kind: "user", userId: "00000000-0000-0000-0000-000000000000" }) as unknown as {
    _registeredTools: Record<string, { description?: string }>;
  })._registeredTools;
  const body = `# ${config.appName}

> Free website hosting operated through MCP. Users connect their own AI agent to create, edit, publish and manage websites (blogs, portfolios, landing pages) on free subdomains.

## MCP server

- URL: ${mcpResourceUrl()}
- Transport: Streamable HTTP (stateless, JSON responses)
- Auth: OAuth 2.1 with PKCE and dynamic client registration; discovery at ${config.appUrl}/.well-known/oauth-protected-resource/mcp. API keys (Bearer) are also supported.
- Scopes: ${Object.keys(SCOPES).join(", ")}

## Tools

${Object.entries(tools)
  .map(([name, t]) => `- ${name}: ${(t.description ?? "").split(". ")[0].replace(/\.$/, "")}.`)
  .join("\n")}

## Docs

- [MCP documentation](${config.appUrl}/docs/mcp)
- [Sign up](${config.appUrl}/signup)
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
