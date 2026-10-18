import { config } from "@/lib/config";
import { AppError, type ErrorCode } from "@/lib/errors";

export const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version, mcp-session-id, last-event-id",
  "access-control-expose-headers": "mcp-session-id, www-authenticate",
  "access-control-max-age": "86400",
};

export function json(data: unknown, init: ResponseInit & { cors?: boolean } = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  headers.set("cache-control", "no-store");
  if (init.cors) for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function preflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  QUOTA_EXCEEDED: 403,
  RATE_LIMITED: 429,
  SUSPENDED: 403,
  CONFIRMATION_REQUIRED: 409,
  UPSTREAM: 502,
};

export function errorResponse(e: unknown, cors = false) {
  if (e instanceof AppError) {
    const headers: Record<string, string> = {};
    if (e.code === "RATE_LIMITED" && e.details?.retryAfterSeconds) headers["retry-after"] = String(e.details.retryAfterSeconds);
    return json({ error: e.code.toLowerCase(), error_description: e.message }, { status: STATUS[e.code], headers, cors });
  }
  console.error(e);
  return json({ error: "server_error" }, { status: 500, cors });
}

export function clientIpFrom(req: Request) {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

/** CSRF defence for cookie-authenticated POST endpoints outside Server Actions. */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  return !origin || origin === config.appUrl;
}
