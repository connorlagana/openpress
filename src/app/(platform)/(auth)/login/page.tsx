import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { loginAction } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = (await searchParams).next;
  if (await getCurrentUser()) redirect(typeof next === "string" ? next : "/dashboard");
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        {typeof next === "string" && next.startsWith("/oauth/authorize") ? (
          <p className="text-sm text-muted-foreground">Sign in to connect your AI agent.</p>
        ) : null}
      </div>
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
