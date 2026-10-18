"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Section } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { setTemplateAction, updateThemeAction } from "../../../actions";

const OPTIONS: { key: keyof Theme; label: string; values: string[] }[] = [
  { key: "headingFont", label: "Heading font", values: ["sans", "serif", "mono", "humanist", "geometric"] },
  { key: "bodyFont", label: "Body font", values: ["sans", "serif", "mono", "humanist", "geometric"] },
  { key: "headerStyle", label: "Header", values: ["simple", "centered", "split", "minimal"] },
  { key: "footerStyle", label: "Footer", values: ["simple", "columns", "minimal"] },
  { key: "contentWidth", label: "Content width", values: ["narrow", "medium", "wide"] },
  { key: "layout", label: "Post layout", values: ["single-column", "sidebar", "grid"] },
  { key: "buttonStyle", label: "Buttons", values: ["rounded", "pill", "square", "outline"] },
  { key: "colorMode", label: "Color mode", values: ["light", "dark", "auto"] },
];

export function AppearanceForm({ siteId, siteUrl, template, theme, templates }: { siteId: string; siteUrl: string; template: string; theme: Theme; templates: { id: string; name: string; description: string }[] }) {
  const router = useRouter();
  const [form, setForm] = useState(theme);
  const [pending, start] = useTransition();
  return (
    <div>
      <Section title="Template" description="Switching keeps your content and resets the theme to the template's defaults.">
        <div className="grid gap-3 sm:grid-cols-3">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={pending || t.id === template}
              onClick={() =>
                start(async () => {
                  const res = await setTemplateAction(siteId, t.id);
                  if (!res.ok) return void toast.error(res.error);
                  setForm(res.data!.theme as Theme);
                  toast.success(`Switched to ${t.name}`);
                  router.refresh();
                })
              }
              className={cn("rounded-xl border p-3 text-left transition-colors disabled:cursor-default", t.id === template ? "border-foreground" : "hover:border-foreground/30")}
              aria-pressed={t.id === template}
            >
              <div className="text-sm font-medium">{t.name}</div>
              <div className="mt-1 text-xs leading-snug text-muted-foreground">{t.description}</div>
            </button>
          ))}
        </div>
      </Section>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await updateThemeAction(siteId, form);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Theme saved", { description: "Your live site has been updated." });
          });
        }}
      >
        <Section title="Colors">
          <div className="grid gap-4 sm:grid-cols-2">
            {(["primaryColor", "secondaryColor"] as const).map((k) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={k}>{k === "primaryColor" ? "Primary" : "Secondary"}</Label>
                <div className="flex items-center gap-2">
                  <input id={k} type="color" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="h-8 w-10 cursor-pointer rounded border bg-transparent" />
                  <span className="font-mono text-xs text-muted-foreground">{form[k]}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Typography & layout">
          <div className="grid gap-4 sm:grid-cols-2">
            {OPTIONS.map((o) => (
              <div key={o.key} className="space-y-1.5">
                <Label htmlFor={o.key}>{o.label}</Label>
                <select
                  id={o.key}
                  value={String(form[o.key])}
                  onChange={(e) => setForm({ ...form, [o.key]: e.target.value })}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm capitalize"
                >
                  {o.values.map((v) => (
                    <option key={v} value={v}>
                      {v.replace("-", " ")}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="baseFontSize">Base font size</Label>
              <input
                id="baseFontSize"
                type="number"
                min={14}
                max={22}
                value={form.baseFontSize}
                onChange={(e) => setForm({ ...form, baseFontSize: Number(e.target.value) })}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save theme"}
            </Button>
            <a href={siteUrl} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:text-foreground">
              View site ↗
            </a>
          </div>
        </Section>
      </form>
    </div>
  );
}
