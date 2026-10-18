import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { SUBDOMAIN_RE } from "@/lib/slug";
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
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {fromAgent ? (
            "Create a free account to connect your agent"
          ) : site ? (
            <>
              Claim <span className="break-all">{site}.{config.rootDomain}</span>
            </>
          ) : (
            "Create your free site"
          )}
        </h1>
        <p className="text-sm text-muted-foreground">
          {fromAgent ? "Takes a few seconds. You'll go straight back to approving your agent." : "Free hosting and free MCP access. No trial, no card."}
        </p>
      </div>
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
