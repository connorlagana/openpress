"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "./actions";

export function AuthForm({ mode, action, next }: { mode: "login" | "signup"; action: (s: FormState, f: FormData) => Promise<FormState>; next?: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [showPassword, setShowPassword] = useState(false);
  return (
    <form action={formAction} className="space-y-4" noValidate={false}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {mode === "signup" ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" autoComplete="name" placeholder="Ada Lovelace" className="h-10 px-3" defaultValue={state?.fields?.name} />
          </div>
          <div aria-hidden className="absolute -left-[9999px]">
            <label htmlFor="website">Website</label>
            <input id="website" name="website" tabIndex={-1} autoComplete="off" />
          </div>
        </>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" className="h-10 px-3" required defaultValue={state?.fields?.email} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={mode === "signup" ? 10 : undefined}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            aria-describedby={mode === "signup" ? "password-hint" : undefined}
            className="h-10 pr-16 pl-3"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
            className="absolute inset-y-1 right-1 rounded-md px-2.5 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        {mode === "signup" ? (
          <p id="password-hint" className="text-xs text-muted-foreground">
            At least 10 characters.
          </p>
        ) : null}
      </div>
      {state?.error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="lp-cta au-submit" disabled={pending}>
        {pending ? "Please wait…" : mode === "signup" ? "Create free account" : "Sign in"}
        {pending ? null : <span className="lp-cta__arrow" aria-hidden>→</span>}
      </button>
    </form>
  );
}
