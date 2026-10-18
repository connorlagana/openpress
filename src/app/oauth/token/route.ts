import { AppError } from "@/lib/errors";
import { clientIpFrom, json, preflight } from "@/server/http/util";
import { exchangeToken, OAuthError } from "@/server/oauth/oauth";
import { rateLimit } from "@/server/services/ratelimit";

export async function POST(req: Request) {
  try {
    await rateLimit(`oauth:token:${clientIpFrom(req) ?? "unknown"}`, 60);
    const type = req.headers.get("content-type") ?? "";
    const form = type.includes("application/json")
      ? new URLSearchParams(Object.entries((await req.json()) as Record<string, string>))
      : new URLSearchParams(await req.text());
    return json(await exchangeToken(form), { cors: true, headers: { pragma: "no-cache" } });
  } catch (e) {
    if (e instanceof OAuthError) return json({ error: e.error, error_description: e.description }, { status: e.status, cors: true });
    if (e instanceof AppError && e.code === "RATE_LIMITED") return json({ error: "slow_down", error_description: e.message }, { status: 429, cors: true });
    console.error(e);
    return json({ error: "server_error" }, { status: 500, cors: true });
  }
}
export const OPTIONS = preflight;
