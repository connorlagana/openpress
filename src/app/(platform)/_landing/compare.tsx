"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const CASES = [
  {
    id: "start",
    label: "Start a blog",
    ask: "Start a blog called Field Notes and publish a first post about my trip to Lisbon.",
    agent: ["create_site", "upload_media", "create_post", "publish_post"],
    outcome: "Live on a free subdomain, with sitemap, RSS and social previews already set up.",
    manual: ["Choose and pay for hosting", "Install the CMS and pick a theme", "Install SEO, caching and security plugins", "Write, format and upload images", "Configure the sitemap and social previews", "Publish"],
  },
  {
    id: "seo",
    label: "Fix SEO on every post",
    ask: "Go through all my posts and write proper SEO titles and meta descriptions.",
    agent: ["list_posts", "get_post × n", "update_post_seo × n"],
    outcome: "Every post updated in one conversation, with each change in your activity log.",
    manual: ["Install an SEO plugin", "Open each post one by one", "Write a title and description in a side panel", "Save, repeat for every post"],
  },
  {
    id: "redesign",
    label: "Redesign the site",
    ask: "Make the site feel more modern: sans-serif headings, a dark theme and a grid of posts.",
    agent: ["update_theme"],
    outcome: "Live in seconds. Content stays untouched, and you can switch back anytime.",
    manual: ["Find and install a new theme", "Check that plugins still work", "Rebuild menus and widgets", "Fix layout issues page by page"],
  },
] as const;

export function Compare() {
  const [active, setActive] = useState<(typeof CASES)[number]["id"]>("start");
  const c = CASES.find((x) => x.id === active)!;
  return (
    <div>
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Example task">
        {CASES.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={x.id === active}
            onClick={() => setActive(x.id)}
            className={cn("rounded-md px-2.5 py-1 text-sm", x.id === active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border p-5">
          <p className="text-xs text-muted-foreground">With your agent</p>
          <p className="mt-2 text-sm italic">&ldquo;{c.ask}&rdquo;</p>
          <ul className="mt-4 space-y-1 font-mono text-[12.5px]">
            {c.agent.map((t) => (
              <li key={t}>
                <span className="text-signal">✓</span> {t}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm">{c.outcome}</p>
        </div>
        <div className="rounded-xl border border-dashed p-5">
          <p className="text-xs text-muted-foreground">By hand in a traditional CMS</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {c.manual.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
