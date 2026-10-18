"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Section } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SiteSettings } from "@/templates/registry";
import { deleteSiteAction, updateSiteAction } from "../../../actions";

type Site = {
  id: string;
  name: string;
  subdomain: string;
  tagline: string | null;
  description: string | null;
  language: string;
  logoMediaId: string | null;
  faviconMediaId: string | null;
  settings: SiteSettings;
  navigation: { header: { label: string; href: string }[]; footer: { label: string; href: string }[] };
};

const navToText = (items: { label: string; href: string }[]) => items.map((i) => `${i.label} | ${i.href}`).join("\n");
const textToNav = (t: string) =>
  t
    .split("\n")
    .map((l) => l.split("|").map((s) => s.trim()))
    .filter(([label, href]) => label && href)
    .map(([label, href]) => ({ label, href }));
const featuresToText = (f: SiteSettings["features"]) => (f ?? []).map((x) => `${x.title} | ${x.body}`).join("\n");

export function SettingsForm({ site, media }: { site: Site; media: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState("");
  const hero = site.settings.hero ?? {};

  function submit(build: (f: FormData) => Parameters<typeof updateSiteAction>[1]) {
    return (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      start(async () => {
        const res = await updateSiteAction(site.id, build(data));
        if (!res.ok) return void toast.error(res.error);
        toast.success("Saved");
        router.refresh();
      });
    };
  }
  const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

  return (
    <div>
      <form onSubmit={submit((f) => ({ name: s(f, "name"), tagline: s(f, "tagline") || null, description: s(f, "description") || null, language: s(f, "language") || "en", logoMediaId: s(f, "logo") || null, faviconMediaId: s(f, "favicon") || null }))}>
        <Section title="General" description="Shown in the header, browser tabs and search results.">
          <div className="grid max-w-xl gap-4">
            <Field id="name" label="Site name">
              <Input id="name" name="name" defaultValue={site.name} required maxLength={80} />
            </Field>
            <Field id="tagline" label="Tagline">
              <Input id="tagline" name="tagline" defaultValue={site.tagline ?? ""} maxLength={160} />
            </Field>
            <Field id="description" label="Description" hint="Homepage meta description">
              <Textarea id="description" name="description" defaultValue={site.description ?? ""} maxLength={500} rows={3} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="language" label="Language">
                <Input id="language" name="language" defaultValue={site.language} className="font-mono" />
              </Field>
              <Field id="logo" label="Logo">
                <MediaSelect id="logo" defaultValue={site.logoMediaId} media={media} />
              </Field>
              <Field id="favicon" label="Favicon">
                <MediaSelect id="favicon" defaultValue={site.faviconMediaId} media={media} />
              </Field>
            </div>
            <div>
              <Button type="submit" disabled={pending}>
                Save
              </Button>
            </div>
          </div>
        </Section>
      </form>

      <form
        onSubmit={submit((f) => ({
          settings: {
            hero: {
              ...hero,
              headline: s(f, "headline") || undefined,
              subheadline: s(f, "subheadline") || undefined,
              ctaLabel: s(f, "ctaLabel") || undefined,
              ctaUrl: s(f, "ctaUrl") || undefined,
            },
            features: s(f, "features")
              .split("\n")
              .map((l) => l.split("|").map((x) => x.trim()))
              .filter(([t]) => t)
              .map(([title, body]) => ({ title, body: body ?? "" })),
            about: s(f, "about") || undefined,
            footerText: s(f, "footerText") || undefined,
          },
        }))}
      >
        <Section title="Homepage" description="Structured content blocks. Which ones appear depends on the template.">
          <div className="grid max-w-xl gap-4">
            <Field id="headline" label="Headline">
              <Input id="headline" name="headline" defaultValue={hero.headline ?? ""} maxLength={160} />
            </Field>
            <Field id="subheadline" label="Subheadline">
              <Textarea id="subheadline" name="subheadline" defaultValue={hero.subheadline ?? ""} maxLength={400} rows={2} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="ctaLabel" label="Button label">
                <Input id="ctaLabel" name="ctaLabel" defaultValue={hero.ctaLabel ?? ""} maxLength={40} />
              </Field>
              <Field id="ctaUrl" label="Button link">
                <Input id="ctaUrl" name="ctaUrl" defaultValue={hero.ctaUrl ?? ""} placeholder="/blog or https://" />
              </Field>
            </div>
            <Field id="features" label="Features" hint="One per line: Title | Description">
              <Textarea id="features" name="features" defaultValue={featuresToText(site.settings.features)} rows={4} className="font-mono text-xs" />
            </Field>
            <Field id="about" label="About" hint="Markdown, used by the portfolio template">
              <Textarea id="about" name="about" defaultValue={site.settings.about ?? ""} rows={4} />
            </Field>
            <Field id="footerText" label="Footer text">
              <Input id="footerText" name="footerText" defaultValue={site.settings.footerText ?? ""} maxLength={300} />
            </Field>
            <div>
              <Button type="submit" disabled={pending}>
                Save
              </Button>
            </div>
          </div>
        </Section>
      </form>

      <form onSubmit={submit((f) => ({ navigation: { header: textToNav(s(f, "header")), footer: textToNav(s(f, "footer")) } }))}>
        <Section title="Navigation" description="One link per line: Label | /path. Pages live at /slug, posts at /blog/slug.">
          <div className="grid max-w-xl gap-4 sm:grid-cols-2">
            <Field id="header" label="Header menu">
              <Textarea id="header" name="header" defaultValue={navToText(site.navigation.header)} rows={5} className="font-mono text-xs" />
            </Field>
            <Field id="footer" label="Footer menu">
              <Textarea id="footer" name="footer" defaultValue={navToText(site.navigation.footer)} rows={5} className="font-mono text-xs" />
            </Field>
            <div>
              <Button type="submit" disabled={pending}>
                Save
              </Button>
            </div>
          </div>
        </Section>
      </form>

      <Section title="Delete site" description="Takes the site offline and frees its address. This cannot be undone from the dashboard.">
        <form
          className="flex max-w-xl flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await deleteSiteAction(site.id, confirm, site.subdomain);
              if (res && !res.ok) toast.error(res.error);
            });
          }}
        >
          <Field id="confirm" label={`Type “${site.subdomain}” to confirm`}>
            <Input id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </Field>
          <Button type="submit" variant="destructive" disabled={pending || confirm !== site.subdomain}>
            Delete site
          </Button>
        </form>
      </Section>
    </div>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function MediaSelect({ id, defaultValue, media }: { id: string; defaultValue: string | null; media: { id: string; label: string }[] }) {
  return (
    <select id={id} name={id} defaultValue={defaultValue ?? ""} className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm">
      <option value="">None</option>
      {media.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
