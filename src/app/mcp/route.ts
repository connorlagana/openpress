import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { config } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { CORS_HEADERS, clientIpFrom, json, preflight } from "@/server/http/util";
import { buildMcpServer } from "@/server/mcp/server";
import { actorForBearer } from "@/server/oauth/oauth";
import { rateLimit } from "@/server/services/ratelimit";

// Stateless Streamable HTTP: every request is authenticated and gets a fresh
// server instance, so it scales horizontally on serverless with no session store.
async function handle(req: Request): Promise<Response> {
  const ip = clientIpFrom(req);
  try {
    await rateLimit(`mcp:ip:${ip ?? "unknown"}`, config.ipRateLimitPerMinute);
  } catch (e) {
    return rateLimited(e);
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  const resolved = token ? await actorForBearer(token, ip) : null;
  if (!resolved) {
    const meta = `${config.appUrl}/.well-known/oauth-protected-resource/mcp`;
    return json(
      { jsonrpc: "2.0", error: { code: -32001, message: token ? "Invalid or expired token" : "Authentication required" }, id: null },
      {
        status: 401,
        cors: true,
        headers: { "www-authenticate": `Bearer resource_metadata="${meta}"${token ? ', error="invalid_token"' : ""}` },
      },
    );
  }

  try {
    await rateLimit(`mcp:conn:${resolved.actor.connectionId}`, resolved.requestsPerMinute);
  } catch (e) {
    return rateLimited(e);
  }

  const server = buildMcpServer(resolved.actor);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 16 * 1024 * 1024 });
  await server.connect(transport);
  const res = await transport.handleRequest(req);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

function rateLimited(e: unknown) {
  const retry = e instanceof AppError ? String(e.details?.retryAfterSeconds ?? 60) : "60";
  return json({ jsonrpc: "2.0", error: { code: -32029, message: (e as Error).message }, id: null }, { status: 429, cors: true, headers: { "retry-after": retry } });
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export const OPTIONS = preflight;
