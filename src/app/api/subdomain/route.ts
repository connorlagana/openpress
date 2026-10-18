import { clientIpFrom, errorResponse, json } from "@/server/http/util";
import { rateLimit } from "@/server/services/ratelimit";
import { checkSubdomain } from "@/server/services/sites";

// Public availability check for the landing page's "claim your name" box.
// Site addresses are public anyway; the rate limit stops bulk enumeration.
export async function GET(req: Request) {
  try {
    await rateLimit(`subdomain:ip:${clientIpFrom(req) ?? "unknown"}`, 60);
    return json(await checkSubdomain(new URL(req.url).searchParams.get("name") ?? ""));
  } catch (e) {
    return errorResponse(e);
  }
}
