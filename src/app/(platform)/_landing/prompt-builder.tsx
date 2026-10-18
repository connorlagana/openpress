"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CopyPrompt } from "./copy-prompt";

const KINDS = [
  { id: "blog", label: "A blog", template: "editorial", noun: "blog" },
  { id: "company", label: "A company or product site", template: "saas", noun: "website" },
  { id: "portfolio", label: "A portfolio", template: "portfolio", noun: "portfolio" },
  { id: "personal", label: "A personal homepage", template: "portfolio", noun: "personal site" },
] as const;

const STYLES = [
  { id: "minimal", label: "Minimal and quiet", text: "Keep the design minimal: plenty of whitespace and a restrained accent color" },
  { id: "bold", label: "Bold and modern", text: "Make the design bold and modern: strong sans-serif headings and a vivid accent color" },
  { id: "warm", label: "Warm and editorial", text: "Make the design warm and editorial: serif type and earthy colors" },
  { id: "dark", label: "Dark", text: "Use a dark color scheme with one bright accent color" },
] as const;

const PUBLISH = [
  { id: "now", label: "Publish it right away", text: "publish it, then send me the link" },
  { id: "review", label: "Let me review first", text: "save it as a draft and show it to me before publishing" },
] as const;

type Answers = { kind?: (typeof KINDS)[number]; name: string; topic: string; style?: (typeof STYLES)[number]; publish?: (typeof PUBLISH)[number] };

function buildPrompt(a: Answers, appName: string) {
  const kind = a.kind ?? KINDS[0];
  const name = a.name.trim() || "My Site";
  const topic = a.topic.trim() || "what this site is about";
  const first = kind.id === "company" ? "a homepage headline, three feature blurbs, and a first blog post" : "a first post";
  return `Use ${appName} to create a ${kind.noun} called "${name}" with the ${kind.template} template. ${(a.style ?? STYLES[0]).text}. Write ${first} about ${topic}, add a fitting image with alt text, set the SEO title and description, and ${(a.publish ?? PUBLISH[0]).text}.`;
}

function Choice<T extends { id: string; label: string }>({ options, value, onPick }: { options: readonly T[]; value?: T; onPick: (o: T) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onPick(o)}
          aria-pressed={value?.id === o.id}
          className={cn("rounded-lg border px-3 py-2.5 text-left text-sm transition-colors", value?.id === o.id ? "border-foreground bg-muted" : "hover:border-foreground/30")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Four questions → one prompt the visitor pastes into their agent. */
export function PromptBuilder({ appName }: { appName: string }) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>({ name: "", topic: "" });
  const total = 4;

  const next = () => setStep((s) => s + 1);

  return (
    <div className="rounded-2xl border p-5 sm:p-6">
      {step < total ? (
        <>
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs text-muted-foreground">
              {step + 1} / {total}
            </p>
            <div className="flex gap-1" aria-hidden>
              {Array.from({ length: total }, (_, i) => (
                <span key={i} className={cn("h-1 w-6 rounded-full", i <= step ? "bg-foreground" : "bg-muted")} />
              ))}
            </div>
          </div>
          <div className="mt-4 min-h-[150px]">
            {step === 0 ? (
              <fieldset>
                <legend className="mb-3 font-medium">What are you making?</legend>
                <Choice options={KINDS} value={a.kind} onPick={(kind) => (setA({ ...a, kind }), next())} />
              </fieldset>
            ) : step === 1 ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  next();
                }}
                className="space-y-3"
              >
                <label className="block">
                  <span className="mb-1.5 block font-medium">What&rsquo;s it called?</span>
                  <input autoFocus value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} maxLength={80} placeholder="The Engineering Journal" className="h-9 w-full rounded-lg border bg-transparent px-3 text-sm outline-none focus:ring-3 focus:ring-ring/50" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm text-muted-foreground">What should the first post be about?</span>
                  <input value={a.topic} onChange={(e) => setA({ ...a, topic: e.target.value })} maxLength={200} placeholder="how AI is changing software engineering" className="h-9 w-full rounded-lg border bg-transparent px-3 text-sm outline-none focus:ring-3 focus:ring-ring/50" />
                </label>
                <Button type="submit" disabled={!a.name.trim()}>
                  Next
                </Button>
              </form>
            ) : step === 2 ? (
              <fieldset>
                <legend className="mb-3 font-medium">What should it feel like?</legend>
                <Choice options={STYLES} value={a.style} onPick={(style) => (setA({ ...a, style }), next())} />
              </fieldset>
            ) : (
              <fieldset>
                <legend className="mb-3 font-medium">When it&rsquo;s written…</legend>
                <Choice options={PUBLISH} value={a.publish} onPick={(publish) => (setA({ ...a, publish }), next())} />
              </fieldset>
            )}
          </div>
          {step > 0 ? (
            <button type="button" onClick={() => setStep(step - 1)} className="mt-2 text-sm text-muted-foreground hover:text-foreground">
              ← Back
            </button>
          ) : null}
        </>
      ) : (
        <div className="space-y-4">
          <p className="font-medium">Your prompt</p>
          <CopyPrompt prompt={buildPrompt(a, appName)} label="Paste this after connecting your agent" />
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {[a.kind?.label, a.name, a.style?.label, a.publish?.label].filter(Boolean).map((t) => (
              <span key={t} className="rounded-full border px-2 py-0.5">
                {t}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/signup" className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80">
              Create a free site
            </a>
            <Button
              variant="outline"
              onClick={() => {
                setA({ name: "", topic: "" });
                setStep(0);
              }}
            >
              Start over
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
