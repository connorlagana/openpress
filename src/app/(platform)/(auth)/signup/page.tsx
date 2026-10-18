import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { signUpAction } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const next = (await searchParams).next;
  if (await getCurrentUser()) redirect(typeof next === "string" ? next : "/dashboard");
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Create your free site</h1>
        <p className="text-sm text-muted-foreground">Free hosting and free MCP access. No trial, no card.</p>
      </div>
      <AuthForm mode="signup" action={signUpAction} next={typeof next === "string" ? next : undefined} />
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link className="text-foreground underline underline-offset-4" href={`/login${typeof next === "string" ? `?next=${encodeURIComponent(next)}` : ""}`}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
