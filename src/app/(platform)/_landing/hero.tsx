"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { CopyPrompt } from "./copy-prompt";

/** Full-height hero: two counter-rotating dotted rings that fade out as you scroll, prompt docked at the bottom. */
export function Hero({ appName, ctaHref, ctaLabel, prompt }: { appName: string; ctaHref: string; ctaLabel: string; prompt: string }) {
  const ring = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let queued = false;
    const frame = () => {
      queued = false;
      ring.current?.style.setProperty("--ring-o", String(Math.max(0, 1 - window.scrollY / (window.innerHeight * 0.8))));
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

  return (
    <section className="lp-hero">
      <div className="lp-hero__panel">
        <div ref={ring} className="lp-ring" aria-hidden>
          <i />
          <i />
        </div>
      </div>
      <div className="lp-hero__intro">
        <span className="lp-shadow inline-flex items-center gap-2 rounded-full bg-background px-3 py-1 text-[13px]">
          <span className="size-2 rounded-full bg-signal" aria-hidden />
          Free <span className="text-muted-foreground">hosting + MCP · no card</span>
        </span>
        <h1 className="max-w-[11em] text-[clamp(38px,4.4vw,60px)] leading-[1.02] font-semibold tracking-[-0.045em] text-balance">Websites your AI agent can build and publish.</h1>
        <p className="max-w-[30rem] text-[15.5px] leading-snug text-muted-foreground">
          Connect Claude, ChatGPT or any MCP client to {appName}, then ask for a site, a post or a redesign. Hosting, SEO and analytics are built in.
        </p>
        <Link href={ctaHref} className="lp-cta">
          {ctaLabel} <span className="lp-cta__arrow">→</span>
        </Link>
        <a href="#prompt" className="text-[13px] text-muted-foreground hover:text-foreground">
          or build your prompt in 4 questions ↓
        </a>
      </div>
      <div className="lp-dock lp-shadow" style={{ bottom: 24 }}>
        <CopyPrompt prompt={prompt} />
      </div>
    </section>
  );
}
