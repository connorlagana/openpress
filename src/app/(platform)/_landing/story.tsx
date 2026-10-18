"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

// A pinned, scroll-driven story: CMS admin screens → flip into MCP tool calls →
// an agent runs them. Scroll progress p ∈ [0,1] drives every value through
// keyframe tracks, written straight to the DOM in rAF (no React re-renders).
// Without JS or with reduced motion, only the captions render, statically.

type Frame = { x: number; y: number; r: number; s: number; o: number; f: number };
type Track = [number, Frame][];

const CARDS = [
  {
    page: { title: "Appearance › Customize", label: "Theme customizer", meta: "3 unsaved changes", rows: [["Site identity", "›"], ["Colors", "›"], ["Menus", "›"], ["Widgets", "›"]] },
    tool: { name: "create_site", color: "#16a34a", args: [["name", "Field Notes"], ["template", "editorial"], ["→", "field-notes.folio"]] },
  },
  {
    page: { title: "Media › Add new", label: "Media library", meta: "max upload 2 MB", rows: [["desk.jpg", "uploading"], ["hero@2x.png", "too large"], ["alt text", "empty"]] },
    tool: { name: "upload_media", color: "#1c1c1a", args: [["sourceUrl", "https://…/desk.jpg"], ["altText", "Laptop on a desk"], ["→", "1200×630 webp"]] },
  },
  {
    page: { title: "Posts › Add new", label: "Block editor", meta: "autosave failed", rows: [["Paragraph", "+"], ["Image", "+"], ["Heading", "+"], ["Categories", "›"]] },
    tool: { name: "create_post", color: "#6d28d9", args: [["title", "Hello, Lisbon"], ["content", "## Day one…"], ["→", "draft saved"]] },
  },
  {
    page: { title: "SEO › Search appearance", label: "SEO plugin", meta: "12 problems found", rows: [["Focus keyphrase", "red"], ["Meta description", "missing"], ["Readability", "OK"]] },
    tool: { name: "update_post_seo", color: "#d97706", ink: "#1c1c1a", args: [["seoTitle", "Hello, Lisbon"], ["description", "148 chars"], ["→", "sitemap + OG ready"]] },
  },
  {
    page: { title: "Settings › Reading", label: "Publish settings", meta: "permalinks reset", rows: [["Visibility", "Public"], ["Search engines", "toggle"], ["Permalink", "?p=123"]] },
    tool: { name: "publish_post", color: "#2563eb", args: [["postId", "8f3c…"], ["→", "status: published"], ["url", "/blog/hello-lisbon"]] },
  },
] as const;

const LAYOUT = {
  wide: {
    w: 1060,
    h: 500,
    agentW: 520,
    select: { left: 20, top: 40, width: 1020, height: 420 },
    scatter: [
      [-410, -30, -4],
      [-205, 40, 3],
      [0, -40, -2],
      [205, 30, 4],
      [410, -20, -3],
    ],
    fan: (i: number) => ({ x: (i - 2) * 182, y: Math.abs(i - 2) * 8 - 10, r: (i - 2) * 3 }),
    cardScale: 1,
  },
  narrow: {
    w: 360,
    h: 600,
    agentW: 350,
    select: { left: 0, top: 10, width: 360, height: 580 },
    scatter: [
      [-80, -175, -4],
      [85, -110, 3],
      [-80, 10, -2],
      [85, 75, 4],
      [0, 200, -3],
    ],
    fan: (i: number) => ({ x: (i % 2 ? 40 : -40), y: -180 + i * 90, r: (i % 2 ? 4 : -4) }),
    cardScale: 0.72,
  },
};

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const ramp = (p: number, a: number, b: number) => ease(clamp((p - a) / (b - a)));

function at(track: Track, p: number): Frame {
  if (p <= track[0][0]) return track[0][1];
  for (let k = 1; k < track.length; k++) {
    const [p1, v1] = track[k];
    if (p <= p1) {
      const [p0, v0] = track[k - 1];
      const t = ease((p - p0) / (p1 - p0));
      const out = {} as Frame;
      for (const key of Object.keys(v1) as (keyof Frame)[]) out[key] = v0[key] + (v1[key] - v0[key]) * t;
      return out;
    }
  }
  return track[track.length - 1][1];
}

function buildTracks(L: (typeof LAYOUT)["wide"]): Track[] {
  return CARDS.map((_, i) => {
    const [sx, sy, sr] = L.scatter[i];
    const fan = L.fan(i);
    const s = L.cardScale;
    const d = i * 0.02;
    return [
      [0, { x: sx, y: sy + 70, r: sr * 2, s: s * 0.9, o: 0, f: 0 }],
      [0.08 + d, { x: sx, y: sy, r: sr, s, o: 1, f: 0 }],
      [0.3 + d, { x: sx, y: sy, r: sr, s, o: 1, f: 0 }],
      [0.42 + d, { x: fan.x, y: fan.y, r: fan.r, s: s * 1.04, o: 1, f: 180 }],
      [0.56, { x: fan.x, y: fan.y, r: fan.r, s: s * 1.04, o: 1, f: 180 }],
      [0.66 + d / 2, { x: fan.x * 0.6, y: fan.y + 120, r: fan.r * 2, s: s * 0.85, o: 0, f: 180 }],
    ];
  });
}

const PROMPT = "Start a travel blog called Field Notes. Write a first post about Lisbon, add a photo, make it findable and publish it.";
const RESULTS = [
  ["create_site", "field-notes"],
  ["upload_media", "desk.jpg"],
  ["create_post", "draft"],
  ["update_post_seo", "ready"],
  ["publish_post", "published"],
];
const CAP_RANGES: [number, number][] = [
  [0, 0.33],
  [0.34, 0.6],
  [0.61, 1.01],
];

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

export function Story({ rootDomain }: { rootDomain: string }) {
  // Static on the server and for reduced motion; pinned and scroll-driven otherwise.
  const live = !useMedia("(prefers-reduced-motion: reduce)", true);
  const narrow = useMedia("(max-width: 719px)", false);
  const story = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const caps = useRef<(HTMLHeadingElement | null)[]>([]);
  const select = useRef<HTMLDivElement>(null);
  const agent = useRef<HTMLDivElement>(null);
  const typed = useRef<HTMLSpanElement>(null);
  const steps = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!live) return;
    const L = narrow ? LAYOUT.narrow : LAYOUT.wide;
    const tracks = buildTracks(L);
    const fit = () => {
      const c = canvas.current!;
      const k = Math.max(0.5, Math.min(1, (window.innerWidth - 32) / L.w, (window.innerHeight - 250) / L.h));
      c.style.transform = `scale(${k})`;
      c.parentElement!.style.height = `${L.h * k}px`;
    };
    const frame = () => {
      const r = story.current!.getBoundingClientRect();
      const p = clamp(-r.top / (r.height - window.innerHeight));
      cards.current.forEach((c, i) => {
        if (!c) return;
        const v = at(tracks[i], p);
        c.style.opacity = String(v.o);
        c.style.transform = `translate(${v.x}px, ${v.y}px) rotate(${v.r}deg) scale(${v.s})`;
        (c.firstElementChild as HTMLElement).style.transform = `rotateY(${v.f}deg)`;
      });
      const sweep = ramp(p, 0.18, 0.27);
      select.current!.style.opacity = String(Math.min(ramp(p, 0.17, 0.21), 1 - ramp(p, 0.31, 0.36)));
      select.current!.style.clipPath = `inset(0 ${100 - 100 * sweep}% ${100 - 100 * sweep}% 0 round 6px)`;
      caps.current.forEach((c, i) => {
        if (!c) return;
        const [a, b] = CAP_RANGES[i];
        const o = Math.min(i === 0 ? 1 : ramp(p, a, a + 0.03), i === CAP_RANGES.length - 1 ? 1 : 1 - ramp(p, b - 0.03, b));
        c.style.opacity = String(o);
        c.style.transform = `translateY(${(1 - o) * 10}px)`;
      });
      const ao = ramp(p, 0.62, 0.7);
      agent.current!.style.opacity = String(ao);
      agent.current!.style.scale = String(0.94 + 0.06 * ao);
      typed.current!.textContent = PROMPT.slice(0, Math.round(PROMPT.length * ramp(p, 0.69, 0.77)));
      steps.current.forEach((s, i) => {
        if (!s) return;
        const o = ramp(p, 0.78 + i * 0.02, 0.8 + i * 0.02);
        s.style.opacity = String(o);
        s.style.maxHeight = `${o * 48}px`;
      });
    };
    let queued = false;
    const tick = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        frame();
      });
    };
    const onResize = () => {
      fit();
      tick();
    };
    fit();
    frame();
    addEventListener("scroll", tick, { passive: true });
    addEventListener("resize", onResize);
    return () => {
      removeEventListener("scroll", tick);
      removeEventListener("resize", onResize);
    };
  }, [live, narrow]);

  const L = narrow ? LAYOUT.narrow : LAYOUT.wide;

  return (
    <div ref={story} className={cn("lp-story", live && "is-live")} id="how">
      <div className="lp-story__stage">
        <div className="lp-fit">
          <div ref={canvas} className="lp-canvas" style={{ width: L.w, height: L.h }} aria-hidden>
            <div ref={select} className="lp-select" style={L.select}>
              <span className="lp-select__tag">Folio MCP</span>
            </div>
            {CARDS.map((c, i) => (
              <div key={c.tool.name} ref={(el) => void (cards.current[i] = el)} className="lp-sc" style={{ opacity: 0 }}>
                <div className="lp-sc__in">
                  <div className="lp-face lp-face--page lp-shadow">
                    <div className="lp-shot lp-shadow">
                      <div className="lp-shot__top">
                        <i />
                        {c.page.title}
                      </div>
                      {c.page.rows.map(([k, v]) => (
                        <div key={k} className="lp-shot__row">
                          <b>{k}</b>
                          {v === "toggle" ? <span className="lp-tog" /> : v === "+" || v === "›" ? <span>{v}</span> : v === "red" ? <span style={{ color: "#dc2626" }}>●</span> : <span>{v}</span>}
                        </div>
                      ))}
                      <div className="lp-bar" style={{ marginTop: 6, width: "70%" }} />
                    </div>
                    <h4>{c.page.label}</h4>
                    <p>{c.page.meta}</p>
                  </div>
                  <div className="lp-face lp-face--card" style={{ background: c.tool.color, color: "ink" in c.tool ? c.tool.ink : "#fff" }}>
                    <small>
                      <span>MCP tool</span>
                      <span>✓</span>
                    </small>
                    <h4>{c.tool.name}</h4>
                    <dl>
                      {c.tool.args.map(([k, v]) => (
                        <div key={k + v}>
                          <dt>{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              </div>
            ))}
            <div ref={agent} className="lp-agent" style={{ width: L.agentW }}>
              <div className="lp-editor lp-shadow">
                <div className="lp-editor__bar">
                  <span className="font-medium text-foreground">your agent</span>
                  <span>↵ Send</span>
                </div>
                <pre>
                  <span ref={typed} />
                  <span className="lp-caret">You</span>
                </pre>
              </div>
              <div className="lp-steps">
                {RESULTS.map(([tool, out], i) => (
                  <div key={tool} ref={(el) => void (steps.current[i] = el)} className="lp-step">
                    <span style={{ color: "var(--signal)", marginLeft: 0 }}>✓</span>
                    <b>{tool}</b>
                    <span>{out}</span>
                  </div>
                ))}
                <div ref={(el) => void (steps.current[RESULTS.length] = el)} className="lp-live">
                  Live at field-notes.{rootDomain}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="lp-caps">
          <h2 ref={(el) => void (caps.current[0] = el)} className="lp-cap">
            Website builders weren&rsquo;t built for agents.
          </h2>
          <h2 ref={(el) => void (caps.current[1] = el)} className="lp-cap" style={live ? { opacity: 0 } : undefined}>
            Folio turns every screen into a tool call.
          </h2>
          <h2 ref={(el) => void (caps.current[2] = el)} className="lp-cap" style={live ? { opacity: 0 } : undefined}>
            Your agent builds it. You approve what matters.
            <small>Example site. Tool names are real.</small>
          </h2>
        </div>
      </div>
    </div>
  );
}
