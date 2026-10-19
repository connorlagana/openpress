import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { SUBDOMAIN_RE } from "@/lib/slug";
import { SsoButtons } from "@/components/app/sso-buttons";
import { getCurrentUser } from "@/server/auth/session";
import { signUpAction } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const params = await searchParams;
  // A name claimed on the landing page rides along to onboarding.
  const site = typeof params.site === "string" && SUBDOMAIN_RE.test(params.site) ? params.site : undefined;
  const next = typeof params.next === "string" ? params.next : site ? `/onboarding?site=${site}` : undefined;
  const fromAgent = next?.startsWith("/oauth/authorize");
  if (await getCurrentUser()) redirect(next ?? "/dashboard");
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <span className="inline-flex items-center gap-2 rounded-full border bg-background px-2.5 py-0.5 text-xs">
          <span className="size-1.5 rounded-full bg-signal" aria-hidden />
          Free <span className="text-muted-foreground">hosting + MCP · no card</span>
        </span>
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.035em] text-balance">
          {fromAgent ? (
            "Create a free account to connect your agent"
          ) : site ? (
            <>
              Claim{" "}
              <span className="block [overflow-wrap:anywhere] text-signal">
                {site}.{config.rootDomain}
              </span>
            </>
          ) : (
            "Create your free site"
          )}
        </h1>
        <p className="text-sm text-muted-foreground">
          {fromAgent ? "Takes a few seconds. You'll go straight back to approving your agent." : "Your agent does the building. Setup takes under a minute."}
        </p>
      </div>
      <SsoButtons next={next} />
      <AuthForm mode="signup" action={signUpAction} next={next} />
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link className="text-foreground underline underline-offset-4" href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
