"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ClaimName } from "./claim";
import { BlogSite } from "./blog-site";
import { SITES } from "./sites";

export function Hero({ appName, rootDomain, signedIn, banner }: { appName: string; rootDomain: string; signedIn: boolean; banner?: React.ReactNode }) {
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
                <BlogSite key={i} post={s} host={`${slug(s.name)}.${rootDomain}`} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="lp-hero__copy">
        {banner ?? (
          <span className="lp-shadow inline-flex items-center gap-2 rounded-full bg-background px-3 py-1 text-[13px]">
            <span className="size-2 rounded-full bg-signal" aria-hidden />
            Free <span className="text-muted-foreground">hosting + MCP · no card</span>
          </span>
        )}
        <h1 className="max-w-[11em] text-[clamp(38px,4.6vw,62px)] leading-[1.02] font-semibold tracking-[-0.045em] text-balance">Websites your AI agent can build and publish.</h1>
        <p className="max-w-[30rem] text-[16px] leading-snug text-muted-foreground">
          Connect Claude, ChatGPT or any MCP client to {appName}, then ask for a site, a post or a redesign. Hosting, SEO and analytics are built in.
        </p>
        {signedIn ? (
          <Link href="/dashboard" className="lp-cta">
            Open dashboard <span className="lp-cta__arrow">→</span>
          </Link>
        ) : (
          <ClaimName rootDomain={rootDomain} signedIn={signedIn} />
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <a href="#how" className="hover:text-foreground">
            See it build a site ↓
          </a>
          <a href="#connect" className="hover:text-foreground">
            Already in Claude or ChatGPT? Connect directly ↓
          </a>
        </div>
      </div>
    </section>
  );
}
