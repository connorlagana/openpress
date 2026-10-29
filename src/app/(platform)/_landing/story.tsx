"use client";

import Image from "next/image";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

// A pinned, scroll-driven build: an agent's tool calls on the left, the site
// they produce on the right. Scroll progress p ∈ [0,1] becomes one 0–1 value
// per tool call (--site, --theme, …), written as CSS custom properties in rAF;
// landing.css maps those to every transform, color and reveal. Without JS or
// with reduced motion every value stays at 1, so the finished site renders
// statically.

const PHASES = [
  { key: "site", at: [0.12, 0.24], tool: "create_site", arg: 'name: "Field Notes"', rail: "Site" },
  { key: "theme", at: [0.26, 0.38], tool: "update_theme", arg: 'fontHeading: "serif"', rail: "Theme" },
  { key: "media", at: [0.4, 0.5], tool: "upload_media", arg: 'altText: "Lake Como…"', rail: "Image" },
  { key: "post", at: [0.52, 0.66], tool: "create_post", arg: 'title: "Lake Como, without the crowds"', rail: "Post" },
  { key: "seo", at: [0.68, 0.78], tool: "update_post_seo", arg: 'description: "A slower Lake Como…"', rail: "SEO" },
  { key: "pub", at: [0.8, 0.88], tool: "publish_post", arg: 'status: "published"', rail: "Publish" },
] as const;

const PROMPT = "Start a travel blog called Field Notes. Warm and editorial. First post about a slow weekend on Lake Como, with a photo. Make it findable, then publish.";
const TITLE = "Lake Como, without the crowds";
const VISITORS = 37;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ramp = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

/** Subscribe to a media query; `server` is the value used during SSR and hydration. */
function useMedia(query: string, server: boolean) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => server,
  );
}

const SIZE = { wide: { w: 1100, h: 560 }, narrow: { w: 360, h: 950 } };

const step = (key: string) => ({ "--x": `var(--${key})` }) as React.CSSProperties;

export function Story({ rootDomain }: { rootDomain: string }) {
  const live = !useMedia("(prefers-reduced-motion: reduce)", true);
  const narrow = useMedia("(max-width: 719px)", false);
  const story = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const typed = useRef<HTMLSpanElement>(null);
  const url = useRef<HTMLSpanElement>(null);
  const title = useRef<HTMLSpanElement>(null);
  const visitors = useRef<HTMLElement>(null);
  const host = `field-notes.${rootDomain}`;

  useEffect(() => {
    const S = narrow ? SIZE.narrow : SIZE.wide;
    const root = story.current!;
    const c = canvas.current!;
    const fit = () => {
      const k = Math.max(0.45, Math.min(1, (window.innerWidth - 32) / S.w, live ? (window.innerHeight - 210) / S.h : 1));
      c.style.transform = `scale(${k})`;
      c.parentElement!.style.height = `${S.h * k}px`;
    };
    fit();
    addEventListener("resize", fit);
    if (!live) {
      for (const ph of PHASES) root.style.removeProperty(`--${ph.key}`);
      return () => removeEventListener("resize", fit);
    }

    const frame = () => {
      const r = root.getBoundingClientRect();
      const p = clamp(-r.top / (r.height - window.innerHeight));
      for (const ph of PHASES) root.style.setProperty(`--${ph.key}`, ramp(p, ph.at[0], ph.at[1]).toFixed(3));
      typed.current!.textContent = PROMPT.slice(0, Math.round(PROMPT.length * ramp(p, 0.02, 0.1)));
      const s = ramp(p, 0.12, 0.2);
      url.current!.textContent = s > 0 ? host.slice(0, Math.round(host.length * s)) : "New tab";
      url.current!.classList.toggle("is-empty", s === 0);
      title.current!.textContent = TITLE.slice(0, Math.round(TITLE.length * ramp(p, 0.52, 0.58)));
      visitors.current!.textContent = String(Math.round(VISITORS * ramp(p, 0.88, 0.98)));
    };
    let queued = false;
    let frameId = 0;
    const tick = () => {
      if (queued) return;
      queued = true;
      frameId = requestAnimationFrame(() => {
        queued = false;
        frame();
      });
    };
    frame();
    addEventListener("scroll", tick, { passive: true });
    return () => {
      cancelAnimationFrame(frameId);
      removeEventListener("scroll", tick);
      removeEventListener("resize", fit);
    };
  }, [live, narrow, host]);

  const S = narrow ? SIZE.narrow : SIZE.wide;

  return (
    <div ref={story} className={cn("lp-story", live && "is-live")} id="how">
      <div className="lp-story__stage">
        <div className="text-center">
          <p className="font-mono text-xs tracking-wide text-muted-foreground">HOW IT WORKS</p>
          <h2 className="mt-2 text-[clamp(24px,2.6vw,36px)] leading-tight font-semibold tracking-[-0.03em]">One prompt. Six tool calls. A live site.</h2>
        </div>
        <div className="lp-fit">
          <div ref={canvas} className={cn("st", narrow ? "is-narrow" : "is-wide")} style={{ width: S.w, height: S.h }} aria-hidden>
            {/* The agent */}
            <div className="st-chat lp-shadow">
              <div className="st-chat__bar">
                <span className="font-medium text-foreground">Your agent</span>
                <span>MCP · {rootDomain}</span>
              </div>
              <div className="st-msg">
                <span ref={typed}>{PROMPT}</span>
              </div>
              <ol className="st-calls">
                {PHASES.map((ph) => (
                  <li key={ph.key} style={step(ph.key)}>
                    <span className="st-ico">
                      <i className="st-spin" />
                      <i className="st-ok">✓</i>
                    </span>
                    <b>{ph.tool}</b>
                    <code>{ph.arg}</code>
                  </li>
                ))}
              </ol>
            </div>

            {/* The site */}
            <div className="st-browser lp-shadow">
              <div className="st-bar">
                <span className="st-dots">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="st-url">
                  <span className="st-lock" />
                  <span ref={url}>{host}</span>
                </span>
                <span className="st-badge">
                  <span className="st-badge__draft">Draft</span>
                  <span className="st-badge__live">● Live</span>
                </span>
              </div>
              <div className="st-page">
                <div className="st-blank">Nothing here yet</div>
                <div className="st-site">
                  <header className="st-head">
                    <span className="st-brand">
                      <span className="st-brand__sans">Field Notes</span>
                      <span className="st-brand__serif">Field Notes</span>
                    </span>
                    <nav>
                      {["Journal", "Places", "About"].map((n, i) => (
                        <span key={n} style={{ "--i": i } as React.CSSProperties}>
                          {n}
                        </span>
                      ))}
                    </nav>
                  </header>
                  <div className="st-rule" />
                  <div className="st-article">
                    <div className="st-cover">
                      <span className="st-cover__ph">image</span>
                      <div className="st-photo">
                        <Image src="/images/landing/travel.jpg" alt="" fill sizes="660px" unoptimized />
                        <span className="st-photo__caption">A slower weekend · Lake Como, Italy</span>
                      </div>
                    </div>
                    <div className="st-text">
                      <p className="st-kicker">Italy · The slow travel journal</p>
                      <h3 className="st-title">
                        <span ref={title}>{TITLE}</span>
                      </h3>
                      <p className="st-excerpt">Sleepy villages, lakeside walks, and the long way home. Skip the packed itinerary and find a quieter side of Lake Como.</p>
                      <div className="st-byline">
                        <span className="st-avatar">SC</span>
                        <span className="st-author"><b>By Sofia Chen</b><span>Travel writer</span></span>
                        <span className="st-readtime">6 min read</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* What search engines see */}
            <div className="st-serp lp-shadow">
              <div className="st-serp__url">{host} › blog › a-slower-lake-como</div>
              <div className="st-serp__title">{TITLE} · Field Notes</div>
              <p>A slower weekend on Lake Como: sleepy villages, lakeside walks, and a little more time to take it all in.</p>
            </div>

            {/* First visitors */}
            <div className="st-visits lp-shadow">
              <span className="st-pulse" />
              <span>
                <b ref={visitors}>{VISITORS}</b> visitors today
              </span>
            </div>
          </div>
        </div>
        <ol className="st-rail" aria-hidden>
          {PHASES.map((ph) => (
            <li key={ph.key} style={step(ph.key)}>
              <i />
              {ph.rail}
            </li>
          ))}
        </ol>
        <p className="text-center text-xs text-muted-foreground">Example site. Tool names are real.</p>
      </div>
    </div>
  );
}
