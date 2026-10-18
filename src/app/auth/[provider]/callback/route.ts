import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { setSessionCookie } from "@/server/auth/session";
import { finishSso, isSsoProvider, peekFlow, SSO_COOKIE, SsoError } from "@/server/auth/sso";
import { clientIpFrom } from "@/server/http/util";
import { rateLimit } from "@/server/services/ratelimit";

// Google returns with a GET; Apple (response_mode=form_post) with a cross-site POST.
// Either way the answer is a 303 so the browser lands on a plain GET.

async function handle(req: NextRequest, provider: string, params: URLSearchParams) {
  if (!isSsoProvider(provider)) return new NextResponse("Not found", { status: 404 });
  const flowCookie = req.cookies.get(SSO_COOKIE)?.value;
  const go = (path: string) => {
    const res = NextResponse.redirect(`${config.appUrl}${path}`, 303);
    res.cookies.set(SSO_COOKIE, "", { path: "/auth", maxAge: 0 });
    return res;
  };
  const fail = async (code: string | null) => {
    const { next, linking } = await peekFlow(flowCookie);
    const q = new URLSearchParams();
    if (code) q.set("error", code);
    if (next && !linking) q.set("next", next);
    return go(`${linking ? "/dashboard/account" : "/login"}${q.size ? `?${q}` : ""}`);
  };
  // The user cancelled at the provider: just go back, no error message.
  if (params.get("error")) return fail(null);
  try {
    await rateLimit(`sso:callback:${clientIpFrom(req) ?? "unknown"}`, config.authRateLimitPerMinute);
    const r = await finishSso(
      provider,
      { code: params.get("code"), state: params.get("state"), appleUser: params.get("user") },
      flowCookie,
      { signupSource: (await cookies()).get("op_ref")?.value },
    );
    await setSessionCookie(r.user.id);
    return go(r.next ?? (r.created ? "/onboarding" : "/dashboard"));
  } catch (e) {
    if (e instanceof SsoError) return fail(e.code);
    console.error(e);
    return fail("provider");
  }
}

export async function GET(req: NextRequest, ctx: RouteContext<"/auth/[provider]/callback">) {
  return handle(req, (await ctx.params).provider, req.nextUrl.searchParams);
}

export async function POST(req: NextRequest, ctx: RouteContext<"/auth/[provider]/callback">) {
  return handle(req, (await ctx.params).provider, new URLSearchParams(await req.text()));
}
