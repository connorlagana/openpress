"use client";

import { cn } from "@/lib/utils";
import { CopyPrompt } from "./copy-prompt";
import { MiniSite, PALETTES, type MiniPalette } from "./mini-site";
import { useState } from "react";

const KINDS = [
  { id: "blog", label: "Blog", template: "editorial", noun: "blog", headline: "Notes from the field" },
  { id: "company", label: "Company", template: "saas", noun: "website", headline: "Software that gets out of the way" },
  { id: "portfolio", label: "Portfolio", template: "portfolio", noun: "portfolio", headline: "Selected work, 2020 to now" },
  { id: "personal", label: "Personal", template: "portfolio", noun: "personal site", headline: "Hi, I write and build things" },
] as const;

const STYLES: { id: MiniPalette; label: string; text: string }[] = [
  { id: "minimal", label: "Minimal", text: "Keep the design minimal: plenty of whitespace and a restrained accent color" },
  { id: "bold", label: "Bold", text: "Make the design bold and modern: strong sans-serif headings and a vivid accent color" },
  { id: "warm", label: "Warm", text: "Make the design warm and editorial: serif type and earthy colors" },
  { id: "dark", label: "Dark", text: "Use a dark color scheme with one bright accent color" },
];

const PUBLISH = [
  { id: "now", label: "Publish right away", text: "publish it, then send me the link" },
  { id: "review", label: "Let me review first", text: "save it as a draft and show it to me before publishing" },
] as const;

function Segmented<T extends { id: string; label: string }>({ label, options, value, onChange }: { label: string; options: readonly T[]; value: T; onChange: (o: T) => void }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className="lp-seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.id} type="button" aria-pressed={o.id === value.id} onClick={() => onChange(o)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Changed values flash when they change: the key remounts the mark and replays its animation. */
const Mark = ({ v }: { v: string }) => (
  <mark key={v} className="lp-mark bg-transparent text-inherit">
    {v}
  </mark>
);

/** Pick a few options, watch the preview restyle, copy the prompt that builds it. */
export function PromptBuilder({ appName, rootDomain }: { appName: string; rootDomain: string }) {
  const [kind, setKind] = useState<(typeof KINDS)[number]>(KINDS[0]);
  const [style, setStyle] = useState(STYLES[2]);
  const [publish, setPublish] = useState<(typeof PUBLISH)[number]>(PUBLISH[0]);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");

  const siteName = name.trim() || "My Site";
  const subject = topic.trim() || "what this site is about";
  const first = kind.id === "company" ? "a homepage headline, three feature blurbs, and a first blog post" : "a first post";
  const prompt = `Use ${appName} to create a ${kind.noun} called "${siteName}" with the ${kind.template} template. ${style.text}. Write ${first} about ${subject}, add a fitting image with alt text, set the SEO title and description, and ${publish.text}.`;
  const host = `${siteName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-site"}.${rootDomain}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-start">
      <div className="space-y-5">
        <Segmented label="What are you making?" options={KINDS} value={kind} onChange={setKind} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="The Engineering Journal" className="lp-shadow h-10 w-full rounded-xl bg-background px-3 text-sm outline-none focus:ring-3 focus:ring-ring/50" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">First post about</span>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} placeholder="how AI is changing software engineering" className="lp-shadow h-10 w-full rounded-xl bg-background px-3 text-sm outline-none focus:ring-3 focus:ring-ring/50" />
          </label>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Style</p>
          <div className="flex gap-4" role="group" aria-label="Style">
            {STYLES.map((s) => {
              const p = PALETTES[s.id];
              return (
                <button key={s.id} type="button" className="lp-swatch" aria-pressed={s.id === style.id} onClick={() => setStyle(s)}>
                  <span style={{ background: p.bg }}>
                    <i style={{ background: p.ac }} />
                  </span>
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
        <Segmented label="When it's written" options={PUBLISH} value={publish} onChange={setPublish} />
      </div>

      <div className="min-w-0 space-y-4">
        <div className="lp-preview">
          <MiniSite template={kind.template} palette={style.id} name={siteName} headline={topic.trim() || kind.headline} host={host} />
        </div>
        <CopyPrompt prompt={prompt} label="Your prompt · paste after connecting your agent">
          Use {appName} to create a <Mark v={kind.noun} /> called &quot;<Mark v={siteName} />&quot; with the <Mark v={kind.template} /> template. <Mark v={style.text} />. Write {first} about <Mark v={subject} />, add a fitting image with alt text, set the SEO title and description, and <Mark v={publish.text} />.
        </CopyPrompt>
        <a href="/signup" className={cn("inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/80")}>
          Create a free site
        </a>
      </div>
    </div>
  );
}
