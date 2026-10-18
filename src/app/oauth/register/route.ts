import { AppError } from "@/lib/errors";
import { clientIpFrom, json, preflight } from "@/server/http/util";
import { registerClient } from "@/server/oauth/oauth";
import { rateLimit } from "@/server/services/ratelimit";

export async function POST(req: Request) {
  try {
    await rateLimit(`oauth:register:${clientIpFrom(req) ?? "unknown"}`, 20, 3600);
    const body = await req.json().catch(() => null);
    return json(await registerClient(body), { status: 201, cors: true });
  } catch (e) {
    if (e instanceof AppError) {
      const [error, ...rest] = e.message.split(": ");
      const code = e.code === "RATE_LIMITED" ? "rate_limited" : error.includes(" ") ? "invalid_client_metadata" : error;
      return json({ error: code, error_description: rest.join(": ") || e.message }, { status: e.code === "RATE_LIMITED" ? 429 : 400, cors: true });
    }
    throw e;
  }
}
export const OPTIONS = preflight;
