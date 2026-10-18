"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Scope } from "@/server/actor";
import { connectAction, decideAction } from "./actions";

/**
 * Consent with sensible defaults shown as a summary; "Customize" reveals the controls.
 * With `account`, the visitor is signed out and creates an account (or signs in) in the same step.
 */
export function ConsentForm({
  query,
  scopes,
  requested,
  sites,
  account,
}: {
  query: string;
  scopes: Record<Scope, string>;
  requested: Scope[];
  sites: { id: string; name: string; url: string }[];
  account?: { defaultMode: "signup" | "login" };
}) {
  const [selected, setSelected] = useState<Scope[]>(requested.filter((s) => s !== "sites:delete"));
  const [allSites, setAllSites] = useState(true);
  const [siteIds, setSiteIds] = useState<string[]>(sites.map((s) => s.id));
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [mode, setMode] = useState(account?.defaultMode ?? "signup");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const decide = (approve: boolean, form?: FormData) =>
    start(async () => {
      const decision = { approve, scopes: selected, allSites, siteIds, confirmPublish };
      const res =
        approve && account && form
          ? await connectAction(query, { mode, email: String(form.get("email") ?? ""), password: String(form.get("password") ?? ""), website: String(form.get("website") ?? "") }, decision)
          : await decideAction(query, decision);
      if ("error" in res && res.error) return setError(res.error);
      if ("redirect" in res && res.redirect) window.location.assign(res.redirect);
    });

  return (
    <form
      className="mt-8 space-y-7"
      onSubmit={(e) => {
        e.preventDefault();
        decide(true, new FormData(e.currentTarget));
      }}
    >
      {account ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={mode === "signup" ? 10 : undefined}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              aria-describedby={mode === "signup" ? "password-hint" : undefined}
            />
            {mode === "signup" ? (
              <p id="password-hint" className="text-xs text-muted-foreground">
                At least 10 characters.
              </p>
            ) : null}
          </div>
          <div aria-hidden className="absolute -left-[9999px]">
            <label htmlFor="website">Website</label>
            <input id="website" name="website" tabIndex={-1} autoComplete="off" />
          </div>
          <p className="text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account? " : "New here? "}
            <button
              type="button"
              className="text-foreground underline underline-offset-4"
              onClick={() => {
                setMode(mode === "signup" ? "login" : "signup");
                setError(null);
              }}
            >
              {mode === "signup" ? "Sign in instead" : "Create a free account"}
            </button>
          </p>
        </div>
      ) : null}

      {customizing ? (
        <>
          <fieldset className="space-y-2.5">
            <legend className="mb-1 text-sm font-medium">It will be able to</legend>
            {(Object.keys(scopes) as Scope[]).map((s) => (
              <label key={s} className="flex items-start gap-2.5 text-sm">
                <Checkbox className="mt-0.5" checked={selected.includes(s)} onCheckedChange={(on) => setSelected(on ? [...selected, s] : selected.filter((x) => x !== s))} />
                <span>{scopes[s]}</span>
              </label>
            ))}
          </fieldset>
          {sites.length ? (
            <fieldset className="space-y-2.5">
              <legend className="mb-1 text-sm font-medium">On these sites</legend>
              <label className="flex items-center gap-2.5 text-sm">
                <Checkbox checked={allSites} onCheckedChange={(on) => setAllSites(!!on)} />
                All my sites, including ones it creates
              </label>
              {!allSites
                ? sites.map((s) => (
                    <label key={s.id} className="flex items-center gap-2.5 pl-6 text-sm">
                      <Checkbox checked={siteIds.includes(s.id)} onCheckedChange={(on) => setSiteIds(on ? [...siteIds, s.id] : siteIds.filter((x) => x !== s.id))} />
                      {s.name} <span className="font-mono text-xs text-muted-foreground">{s.url.replace(/^https?:\/\//, "")}</span>
                    </label>
                  ))
                : null}
            </fieldset>
          ) : null}
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>
              Ask me before publishing
              <span className="block text-muted-foreground">The agent must get your OK in the chat for every publish.</span>
            </span>
            <Switch checked={confirmPublish} onCheckedChange={setConfirmPublish} />
          </label>
        </>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-medium">It will be able to</p>
            <button type="button" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground" onClick={() => setCustomizing(true)}>
              Customize
            </button>
          </div>
          <ul className="space-y-1.5 text-sm">
            {selected.map((s) => (
              <li key={s} className="flex items-start gap-2.5">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                {scopes[s]}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">On all your sites, including ones it creates. You can change this or revoke access anytime in Dashboard → Agents.</p>
        </div>
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button type="submit" size="lg" disabled={pending || !selected.length}>
          {pending ? "Connecting…" : !account ? "Allow access" : mode === "signup" ? "Create account & allow" : "Sign in & allow"}
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={() => decide(false)} disabled={pending}>
          Deny
        </Button>
      </div>
    </form>
  );
}
