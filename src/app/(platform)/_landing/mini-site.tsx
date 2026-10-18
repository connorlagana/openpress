import Image from "next/image";
import type { CSSProperties } from "react";

// A miniature rendering of an example OpenPress site. Sized in em, so the caller sets
// the scale with font-size. Colors are custom properties, so palette changes
// transition smoothly.

export type MiniTemplate = "editorial" | "saas" | "portfolio";

export const PALETTES = {
  minimal: { bg: "#ffffff", fg: "#18181b", ac: "#18181b", mu: "#a1a1aa", card: "#f4f4f5", font: "var(--font-geist-sans), system-ui, sans-serif", weight: 600 },
  bold: { bg: "#f7f7fb", fg: "#0b0b12", ac: "#4f46e5", mu: "#9ca3af", card: "#e0e7ff", font: "var(--font-geist-sans), system-ui, sans-serif", weight: 800 },
  warm: { bg: "#faf6ef", fg: "#2b2118", ac: "#c2410c", mu: "#c8b8a4", card: "#efe4d4", font: 'ui-serif, Georgia, "Iowan Old Style", serif', weight: 500 },
  dark: { bg: "#101216", fg: "#f4f4f5", ac: "#22d3ee", mu: "#3f4652", card: "#1c2027", font: "var(--font-geist-sans), system-ui, sans-serif", weight: 600 },
  forest: { bg: "#f3f6f1", fg: "#14261b", ac: "#15803d", mu: "#b6c6b8", card: "#dfe9db", font: 'ui-serif, Georgia, "Iowan Old Style", serif', weight: 600 },
  sunset: { bg: "#fff7f0", fg: "#2a1608", ac: "#ea580c", mu: "#e5c4aa", card: "#ffe2cc", font: "var(--font-geist-sans), system-ui, sans-serif", weight: 700 },
} as const;

export type MiniPalette = keyof typeof PALETTES;

export function MiniSite({ template, palette, name, headline, host, className, style }: { template: MiniTemplate; palette: MiniPalette; name: string; headline: string; host?: string; className?: string; style?: CSSProperties }) {
  const p = PALETTES[palette];
  const vars = { "--ms-bg": p.bg, "--ms-fg": p.fg, "--ms-ac": p.ac, "--ms-mu": p.mu, "--ms-card": p.card, "--ms-font": p.font, "--ms-w": p.weight, ...style } as CSSProperties;
  return (
    <div className={`ms ${className ?? ""}`} style={vars} aria-hidden>
      <div className="ms-chrome">
        <i />
        <i />
        <i />
        <span>{host}</span>
      </div>
      <div className="ms-body">
        <div className="ms-head">
          <b>{name}</b>
          <span className="ms-nav">{template === "editorial" ? "Journal · Places · About" : template === "saas" ? "Features · Pricing" : "Work · About · Contact"}</span>
        </div>
        {template === "editorial" ? (
          <div key="editorial" className="ms-ed">
            <Image className="ms-example__cover" src="/images/landing/travel.jpg" alt="" width={640} height={420} unoptimized />
            <p className="ms-example__eyebrow">Italy · The slow travel journal</p>
            <h5>{headline}</h5>
            <p className="ms-example__description">Sleepy villages, lakeside walks, and the long way home. Find a quieter side of northern Italy.</p>
            <div className="ms-example__author"><b>By Sofia Chen</b><span>6 min read</span></div>
          </div>
        ) : template === "saas" ? (
          <div key="saas" className="ms-saas">
            <p className="ms-example__eyebrow">Built for independent work</p>
            <h5>{headline}</h5>
            <p className="ms-example__description">Less chasing payments. More doing what you love. Meet your new freelance back office.</p>
            <span className="ms-example__cta">Join the waitlist <span>↗</span></span>
            <div className="ms-invoice">
              <div className="ms-invoice__heading"><b>Invoice #042</b><span>Paid ✓</span></div>
              <p>Brand identity · Studio North</p>
              <div className="ms-invoice__total"><span>Project total</span><b>$2,400.00</b></div>
              <div className="ms-invoice__footer">Sent Monday. Paid Tuesday.</div>
            </div>
            <div className="ms-example__features"><span>Easy invoices</span><span>Auto reminders</span><span>Payment tracking</span></div>
          </div>
        ) : (
          <div key="portfolio" className="ms-pf">
            <p className="ms-example__eyebrow">Independent designer · Porto</p>
            <h5>{headline}</h5>
            <p className="ms-example__description">I&rsquo;m Ana. I turn everyday problems into thoughtful digital experiences.</p>
            <div className="ms-projects">
              {[
                { image: "design", name: "Soft Space", detail: "Home discovery" },
                { image: "coffee", name: "Daily Grind", detail: "Coffee subscriptions" },
                { image: "outdoors", name: "The Long Way", detail: "Trail planning" },
                { image: "surf", name: "Dawn Patrol", detail: "Surf forecasts" },
              ].map((project) => (
                <div key={project.name}>
                  <Image src={`/images/landing/${project.image}.jpg`} alt="" width={320} height={160} unoptimized />
                  <b>{project.name} <span>↗</span></b>
                  <span>{project.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
