"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import type { Scope } from "@/server/actor";
import { decideAction } from "./actions";

export function ConsentForm({ query, scopes, requested, sites }: { query: string; scopes: Record<Scope, string>; requested: Scope[]; sites: { id: string; name: string; url: string }[] }) {
  const [selected, setSelected] = useState<Scope[]>(requested.filter((s) => s !== "sites:delete"));
  const [allSites, setAllSites] = useState(true);
  const [siteIds, setSiteIds] = useState<string[]>(sites.map((s) => s.id));
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const decide = (approve: boolean) =>
    start(async () => {
      const res = await decideAction(query, { approve, scopes: selected, allSites, siteIds, confirmPublish });
      if ("error" in res && res.error) return setError(res.error);
      if ("redirect" in res && res.redirect) window.location.assign(res.redirect);
    });

  return (
    <div className="mt-8 space-y-7">
      <fieldset className="space-y-2.5">
        <legend className="mb-1 text-sm font-medium">It will be able to</legend>
        {(Object.keys(scopes) as Scope[]).map((s) => (
          <label key={s} className="flex items-start gap-2.5 text-sm">
            <Checkbox className="mt-0.5" checked={selected.includes(s)} onCheckedChange={(on) => setSelected(on ? [...selected, s] : selected.filter((x) => x !== s))} />
            <span>{scopes[s]}</span>
          </label>
        ))}
      </fieldset>
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
      <label className="flex items-center justify-between gap-4 text-sm">
        <span>
          Ask me before publishing
          <span className="block text-muted-foreground">The agent must get your OK in the chat for every publish.</span>
        </span>
        <Switch checked={confirmPublish} onCheckedChange={setConfirmPublish} />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button size="lg" onClick={() => decide(true)} disabled={pending || !selected.length}>
          {pending ? "Connecting…" : "Allow access"}
        </Button>
        <Button size="lg" variant="outline" onClick={() => decide(false)} disabled={pending}>
          Deny
        </Button>
      </div>
    </div>
  );
}
