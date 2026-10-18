import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { getCurrentUser } from "@/server/auth/session";
import { enabledSsoProviders, isSsoProvider, SSO_COOKIE, startSso } from "@/server/auth/sso";
import { clientIpFrom } from "@/server/http/util";
import { rateLimit } from "@/server/services/ratelimit";

/** GET /auth/{google|apple}/start?next=/path[&link=1] → redirect to the provider. */
export async function GET(req: NextRequest, ctx: RouteContext<"/auth/[provider]/start">) {
  const { provider } = await ctx.params;
  if (!isSsoProvider(provider) || !enabledSsoProviders().includes(provider)) return new NextResponse("Not found", { status: 404 });
  const next = req.nextUrl.searchParams.get("next");
  try {
    await rateLimit(`sso:start:${clientIpFrom(req) ?? "unknown"}`, config.authRateLimitPerMinute);
  } catch {
    return NextResponse.redirect(`${config.appUrl}/login?error=rate_limited`, 303);
  }
  let linkUserId: string | null = null;
  if (req.nextUrl.searchParams.get("link") === "1") {
    const user = await getCurrentUser();
    if (!user) return NextResponse.redirect(`${config.appUrl}/login`, 303);
    linkUserId = user.id;
  }
  const { url, cookie } = await startSso(provider, { next, linkUserId });
  const res = NextResponse.redirect(url, 303);
  const https = config.protocol === "https";
  res.cookies.set(SSO_COOKIE, cookie, {
    httpOnly: true,
    secure: https,
    // Apple returns with a cross-site form POST, which only carries SameSite=None cookies.
    sameSite: provider === "apple" && https ? "none" : "lax",
    path: "/auth",
    maxAge: 600,
  });
  return res;
}
