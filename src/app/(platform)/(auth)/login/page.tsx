import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SsoButtons } from "@/components/app/sso-buttons";
import { getCurrentUser } from "@/server/auth/session";
import { SSO_ERROR_MESSAGES } from "@/server/auth/sso";
import { loginAction } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  if (await getCurrentUser()) redirect(typeof next === "string" ? next : "/dashboard");
  const errorMessage =
    error === "rate_limited" ? "Too many attempts. Please wait a minute and try again." : typeof error === "string" && error in SSO_ERROR_MESSAGES ? SSO_ERROR_MESSAGES[error as keyof typeof SSO_ERROR_MESSAGES] : null;
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        {typeof next === "string" && next.startsWith("/oauth/authorize") ? (
          <p className="text-sm text-muted-foreground">Sign in to connect your AI agent.</p>
        ) : null}
      </div>
      {errorMessage ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
      <SsoButtons next={typeof next === "string" ? next : undefined} />
      <AuthForm mode="login" action={loginAction} next={typeof next === "string" ? next : undefined} />
      <p className="text-sm text-muted-foreground">
        New here?{" "}
        <Link className="text-foreground underline underline-offset-4" href={`/signup${typeof next === "string" ? `?next=${encodeURIComponent(next)}` : ""}`}>
          Create a free account
        </Link>
      </p>
    </div>
  );
}
