"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const STEPS = [
  { tool: "create_site", args: '{ name: "The Engineering Journal", template: "editorial" }', result: "the-engineering-journal" },
  { tool: "upload_media", args: '{ sourceUrl: "https://images…/desk.jpg", altText: "Laptop on a desk" }', result: "desk.jpg · 1200×630" },
  { tool: "create_post", args: '{ title: "Will AI Replace Software Engineers?", content: "## The short answer…" }', result: "draft saved" },
  { tool: "update_post_seo", args: '{ seoTitle, seoDescription, slug: "ai-and-engineers" }', result: "title 52 chars · description 148 chars" },
  { tool: "publish_post", args: "{ postId }", result: "status: published" },
];

/**
 * Scripted (not live) walkthrough of an agent building a site. Shows the
 * final state immediately for visitors who prefer reduced motion.
 */
export function AgentDemo({ rootDomain }: { rootDomain: string }) {
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setStep(STEPS.length), 0);
      return () => clearTimeout(t);
    }
    const timers = STEPS.map((_, i) => setTimeout(() => setStep(i + 1), 700 + i * 1100));
    return () => timers.forEach(clearTimeout);
  }, [run]);

  const done = step >= STEPS.length;
  const host = `the-engineering-journal.${rootDomain}`;

  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-2xl border bg-muted/20 md:grid-cols-2" aria-label="Example: an agent building and publishing a blog">
      {/* Agent panel */}
      <div className="min-w-0 border-b p-4 font-mono text-[12.5px] leading-relaxed md:border-r md:border-b-0">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">your agent</span>
          <button
            type="button"
            onClick={() => {
              setStep(0);
              setRun((r) => r + 1);
            }}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Replay demo"
          >
            <RotateCcw className="size-3" /> Replay
          </button>
        </div>
        <p className="mt-3">
          <span className="text-muted-foreground">you › </span>Start a minimalist tech blog called The Engineering Journal. Write a post about AI and software engineering, add an image, optimize it for search and publish it.
        </p>
        <ol className="mt-3 space-y-2" aria-live="polite">
          {STEPS.map((s, i) => (
            <li key={s.tool} className={cn("transition-opacity duration-300 motion-reduce:transition-none", i < step ? "opacity-100" : "opacity-0")} aria-hidden={i >= step}>
              <div>
                <span className="text-signal">✓</span> <span className="font-medium">{s.tool}</span>
              </div>
              <div className="truncate pl-4 text-muted-foreground">{s.args}</div>
              <div className="pl-4 text-muted-foreground">→ {s.result}</div>
            </li>
          ))}
        </ol>
        <p className={cn("mt-3 transition-opacity duration-300 motion-reduce:transition-none", done ? "opacity-100" : "opacity-0")}>
          <span className="text-signal">agent › </span>It&rsquo;s live at {host}/blog/ai-and-engineers
        </p>
      </div>

      {/* Browser panel */}
      <div className="flex min-h-[340px] min-w-0 flex-col bg-background">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <span className="flex gap-1" aria-hidden>
            <i className="size-2 rounded-full bg-muted-foreground/25" />
            <i className="size-2 rounded-full bg-muted-foreground/25" />
            <i className="size-2 rounded-full bg-muted-foreground/25" />
          </span>
          <span className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{step >= 1 ? host : "about:blank"}</span>
          {step >= 3 ? (
            <span className={cn("rounded-full px-1.5 py-0.5 font-mono text-[10px]", done ? "bg-signal/15 text-signal" : "bg-muted text-muted-foreground")}>{done ? "LIVE" : "DRAFT"}</span>
          ) : null}
        </div>
        <div className="flex-1 p-5" style={{ fontFamily: 'ui-serif, Georgia, "Iowan Old Style", serif' }}>
          {step >= 1 ? (
            <div className="border-b pb-3 text-center">
              <div className="text-lg font-semibold">The Engineering Journal</div>
              <div className="mt-1 flex justify-center gap-3 font-sans text-[11px] text-muted-foreground">
                <span>Home</span>
                <span>Archive</span>
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center font-sans text-xs text-muted-foreground">Waiting for your agent…</div>
          )}
          {step >= 3 ? (
            <div className="mx-auto mt-4 max-w-xs">
              <div className="font-sans text-[10px] text-muted-foreground">Oct 18 · 4 min read</div>
              <div className="mt-1 text-xl leading-tight font-semibold">Will AI Replace Software Engineers?</div>
            </div>
          ) : null}
          {step >= 2 ? (
            <div
              className="mx-auto mt-3 aspect-[1200/630] max-w-xs rounded-md"
              style={{ background: "linear-gradient(135deg, #8a5a3b 0%, #b07a52 45%, #d9c7b0 46%, #efe6da 100%)" }}
              role="img"
              aria-label="Laptop on a desk"
            />
          ) : null}
          {step >= 3 ? (
            <div className="mx-auto mt-3 max-w-xs space-y-1.5" aria-hidden>
              <div className="h-1.5 rounded bg-foreground/15" />
              <div className="h-1.5 w-11/12 rounded bg-foreground/15" />
              <div className="h-1.5 w-4/5 rounded bg-foreground/15" />
            </div>
          ) : null}
          {step >= 4 ? (
            <div className="mx-auto mt-4 max-w-xs rounded-md border p-2 font-sans">
              <div className="text-[10px] text-muted-foreground">Search preview</div>
              <div className="truncate text-[12px] text-[#1a0dab] dark:text-[#8ab4f8]">Will AI Replace Software Engineers? · The Engineering Journal</div>
              <div className="line-clamp-2 text-[11px] text-muted-foreground">A practical look at how AI coding agents change what engineers do, and what stays the same.</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
