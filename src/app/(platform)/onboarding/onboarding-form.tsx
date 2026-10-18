"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { checkSubdomainAction, createSiteAction } from "../dashboard/actions";

function toSubdomain(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28)
    .replace(/-+$/, "");
}

const PREVIEW: Record<string, string> = {
  editorial: "bg-[#f4efe8] [&_i]:bg-[#b4441f]",
  saas: "bg-[#eef2ff] [&_i]:bg-[#4f46e5]",
  portfolio: "bg-[#f0fdfa] [&_i]:bg-[#0f766e]",
};

/** "field-notes" → "Field Notes" */
const titleFrom = (sub: string) => sub.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

export function OnboardingForm({ claimed, rootDomain, templates }: { claimed?: string; rootDomain: string; templates: { id: string; name: string; description: string }[] }) {
  const [name, setName] = useState(claimed ? titleFrom(claimed) : "");
  const [sub, setSub] = useState(claimed ?? "");
  const [subEdited, setSubEdited] = useState(!!claimed);
  const [template, setTemplate] = useState("editorial");
  const [availability, setAvailability] = useState<{ ok: boolean; message: string; suggestion?: string; sub: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const effectiveSub = subEdited ? sub : toSubdomain(name);

  useEffect(() => {
    if (effectiveSub.length < 3) return;
    const t = setTimeout(() => checkSubdomainAction(effectiveSub).then((r) => setAvailability({ ...r, sub: effectiveSub })), 300);
    return () => clearTimeout(t);
  }, [effectiveSub]);
  // Ignore results for a subdomain the user has since edited away from.
  const status = availability?.sub === effectiveSub && effectiveSub.length >= 3 ? availability : null;

  return (
    <form
      className="mt-8 space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await createSiteAction({ name, subdomain: effectiveSub, template });
          if (res && !res.ok) setError(res.error);
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="site-name">Site name</Label>
        <Input id="site-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="The Engineering Journal" required maxLength={80} autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="subdomain">Address</Label>
        <div className="flex items-center rounded-lg border border-input focus-within:ring-3 focus-within:ring-ring/50">
          <span className="pl-3 text-sm text-muted-foreground">https://</span>
          <input
            id="subdomain"
            className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm outline-none"
            value={effectiveSub}
            onChange={(e) => {
              setSubEdited(true);
              setSub(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
            placeholder="your-site"
            aria-describedby="subdomain-status"
            required
            minLength={3}
            maxLength={32}
          />
          <span className="pr-3 text-sm text-muted-foreground">.{rootDomain}</span>
        </div>
        <p id="subdomain-status" aria-live="polite" className={cn("text-xs", status?.ok ? "text-signal" : status ? "text-destructive" : "text-muted-foreground")}>
          {status ? status.message : "Lowercase letters, numbers and hyphens."}
          {status?.suggestion ? (
            <>
              {" · "}
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => {
                  setSubEdited(true);
                  setSub(status.suggestion!);
                }}
              >
                use {status.suggestion}
              </button>
            </>
          ) : null}
        </p>
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Starting template</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {templates.map((t) => (
            <label
              key={t.id}
              className={cn(
                "cursor-pointer rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                template === t.id ? "border-foreground" : "hover:border-foreground/30",
              )}
            >
              <input type="radio" name="template" value={t.id} checked={template === t.id} onChange={() => setTemplate(t.id)} className="sr-only" />
              <div className={cn("mb-3 h-20 rounded-md p-2.5", PREVIEW[t.id])} aria-hidden>
                <i className="block h-1.5 w-8 rounded-full" />
                <span className="mt-2 block h-1 w-16 rounded-full bg-black/15" />
                <span className="mt-1 block h-1 w-12 rounded-full bg-black/10" />
              </div>
              <div className="text-sm font-medium">{t.name}</div>
              <div className="mt-0.5 text-xs leading-snug text-muted-foreground">{t.description.split(".")[0]}.</div>
            </label>
          ))}
        </div>
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending || !name.trim() || status?.ok === false}>
        {pending ? "Creating…" : "Create site"}
      </Button>
    </form>
  );
}
