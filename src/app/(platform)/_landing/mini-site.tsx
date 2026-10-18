import type { CSSProperties } from "react";

// A tiny, CSS-only rendering of an OpenPress site. Sized in em, so the caller sets
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
          <span>
            <i />
            <i />
            <i />
          </span>
        </div>
        {template === "editorial" ? (
          <div key="editorial" className="ms-ed">
            <div className="ms-ed__cover" />
            <h5>{headline}</h5>
            <i className="ms-line" />
            <i className="ms-line" style={{ width: "72%" }} />
            <div className="ms-ed__row">
              <i />
              <span>
                <i className="ms-line" />
                <i className="ms-line" style={{ width: "55%" }} />
              </span>
            </div>
          </div>
        ) : template === "saas" ? (
          <div key="saas" className="ms-saas">
            <h5>{headline}</h5>
            <i className="ms-line" style={{ width: "60%", margin: "0 auto" }} />
            <span className="ms-btn" />
            <div className="ms-feats">
              <i />
              <i />
              <i />
            </div>
          </div>
        ) : (
          <div key="portfolio" className="ms-pf">
            <h5>{headline}</h5>
            <i className="ms-line" style={{ width: "50%" }} />
            <div className="ms-pf__grid">
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
