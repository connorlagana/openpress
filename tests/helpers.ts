import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import * as asMeta from "@/app/.well-known/oauth-authorization-server/route";
import * as prMeta from "@/app/.well-known/oauth-protected-resource/[[...path]]/route";
import * as mcpRoute from "@/app/mcp/route";
import * as register from "@/app/oauth/register/route";
import * as revoke from "@/app/oauth/revoke/route";
import * as token from "@/app/oauth/token/route";
import { config } from "@/lib/config";
import type { Actor, Scope } from "@/server/actor";
import { createUser } from "@/server/auth/accounts";
import { createApiKey } from "@/server/oauth/oauth";

let n = 0;
export async function makeUser(prefix = "user") {
  const user = await createUser({ email: `${prefix}${++n}-${Date.now()}@example.com`, password: "correct horse battery", name: prefix });
  const actor: Actor = { kind: "user", userId: user.id };
  return { user, actor };
}

/** In-process fetch that dispatches to the real Next.js route handlers. */
export const appFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const req = input instanceof Request ? input : new Request(input, init);
  const url = new URL(req.url);
  if (url.origin !== config.appUrl) throw new Error(`unexpected origin ${url.origin}`);
  const p = url.pathname;
  const method = req.method.toUpperCase() as "GET" | "POST" | "DELETE" | "OPTIONS";
  const pick = (mod: Record<string, unknown>) => {
    const h = mod[method] as ((r: Request) => Promise<Response> | Response) | undefined;
    return h ? h(req) : new Response("method not allowed", { status: 405 });
  };
  if (p === "/mcp") return pick(mcpRoute);
  if (p.startsWith("/.well-known/oauth-protected-resource")) return pick(prMeta);
  if (p === "/.well-known/oauth-authorization-server") return pick(asMeta);
  if (p === "/oauth/register") return pick(register);
  if (p === "/oauth/token") return pick(token);
  if (p === "/oauth/revoke") return pick(revoke);
  return new Response("not found", { status: 404 });
};

export async function connectWithApiKey(userId: string, opts: { scopes?: Scope[]; siteIds?: string[]; confirmPublish?: boolean } = {}) {
  const { key } = await createApiKey(userId, {
    name: "test key",
    scopes: opts.scopes ?? ["sites:read", "sites:write", "content:write", "content:publish", "analytics:read", "sites:delete"],
    allSites: !opts.siteIds,
    siteIds: opts.siteIds ?? [],
    confirmPublish: opts.confirmPublish ?? false,
  });
  const client = new Client({ name: "vitest", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${config.appUrl}/mcp`), {
    fetch: appFetch,
    requestInit: { headers: { authorization: `Bearer ${key}` } },
  });
  await client.connect(transport);
  return { client, key };
}

type ToolOut = { isError?: boolean; structuredContent?: Record<string, any>; content: { type: string; text?: string }[] };
export async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  return (await client.callTool({ name, arguments: args })) as ToolOut;
}
