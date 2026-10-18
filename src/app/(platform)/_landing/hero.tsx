"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { CopyPrompt } from "./copy-prompt";
import { MiniSite, type MiniPalette, type MiniTemplate } from "./mini-site";

// Example sites an agent could publish. Three columns drift past on a tilted
// plane; scrolling tips the plane back and fades it out.
const SITES: { t: MiniTemplate; p: MiniPalette; name: string; head: string }[][] = [
  [
    { t: "editorial", p: "warm", name: "Field Notes", head: "Hello, Lisbon" },
    { t: "saas", p: "bold", name: "Lumen", head: "Invoices that send themselves" },
    { t: "portfolio", p: "minimal", name: "Ana Sousa", head: "Product designer in Porto" },
  ],
  [
    { t: "saas", p: "dark", name: "Relay", head: "Webhooks without the wiring" },
    { t: "editorial", p: "forest", name: "Cast Iron", head: "Weeknight bread, no knead" },
    { t: "portfolio", p: "sunset", name: "Kofi Mensah", head: "Photographs, 2019 to now" },
  ],
  [
    { t: "portfolio", p: "dark", name: "Studio Mono", head: "Type and identity" },
    { t: "editorial", p: "minimal", name: "The Diff", head: "Notes on shipping software" },
    { t: "saas", p: "forest", name: "Sprout", head: "A garden planner that remembers" },
  ],
];

export function Hero({ appName, rootDomain, ctaHref, ctaLabel, prompt }: { appName: string; rootDomain: string; ctaHref: string; ctaLabel: string; prompt: string }) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    let queued = false;
    const frame = () => {
      queued = false;
      root.current?.style.setProperty("--h", String(Math.min(1, window.scrollY / (window.innerHeight * 0.9))));
    };
    const tick = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(frame);
      }
    };
    frame();
    addEventListener("scroll", tick, { passive: true });
    return () => removeEventListener("scroll", tick);
  }, []);

  const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, "-");

  return (
    <section ref={root} className="lp-hero">
      <div className="lp-wall" aria-hidden>
        <div className="lp-wall__plane">
          {SITES.map((col, c) => (
            <div key={c} className="lp-wall__col" style={{ animationDuration: `${46 + c * 9}s`, animationDirection: c % 2 ? "reverse" : "normal" }}>
              {[...col, ...col].map((s, i) => (
                <MiniSite key={i} template={s.t} palette={s.p} name={s.name} headline={s.head} host={`${slug(s.name)}.${rootDomain}`} className="lp-wall__site" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="lp-hero__copy">
        <span className="lp-shadow inline-flex items-center gap-2 rounded-full bg-background px-3 py-1 text-[13px]">
          <span className="size-2 rounded-full bg-signal" aria-hidden />
          Free <span className="text-muted-foreground">hosting + MCP · no card</span>
        </span>
        <h1 className="max-w-[11em] text-[clamp(38px,4.6vw,62px)] leading-[1.02] font-semibold tracking-[-0.045em] text-balance">Websites your AI agent can build and publish.</h1>
        <p className="max-w-[30rem] text-[16px] leading-snug text-muted-foreground">
          Connect Claude, ChatGPT or any MCP client to {appName}, then ask for a site, a post or a redesign. Hosting, SEO and analytics are built in.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href={ctaHref} className="lp-cta">
            {ctaLabel} <span className="lp-cta__arrow">→</span>
          </Link>
          <a href="#how" className="text-sm text-muted-foreground hover:text-foreground">
            See it build a site ↓
          </a>
        </div>
        <div className="lp-shadow w-full max-w-[34rem] rounded-xl">
          <CopyPrompt prompt={prompt} />
        </div>
      </div>
    </section>
  );
}
