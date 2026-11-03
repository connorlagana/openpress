// Color scales for heatmaps and color-by-value. Two kinds of output:
// - "theme" (the default): a CSS color-mix() between site-aware variables, so
//   the ramp flips correctly in dark mode (chart.css --op-seq-*).
// - named schemes / custom stops: absolute hex, interpolated in OKLab so
//   gradients stay perceptually even. Hex input is validated before it gets here.

import type { ColorScaleSpec, SchemeName } from "./types";

const SCHEMES: Record<Exclude<SchemeName, "theme">, string[]> = {
  blues: ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#08519c", "#08306b"],
  greens: ["#f7fcf5", "#e5f5e0", "#c7e9c0", "#a1d99b", "#74c476", "#41ab5d", "#238b45", "#006d2c", "#00441b"],
  oranges: ["#fff5eb", "#fee6ce", "#fdd0a2", "#fdae6b", "#fd8d3c", "#f16913", "#d94801", "#a63603", "#7f2704"],
  reds: ["#fff5f0", "#fee0d2", "#fcbba1", "#fc9272", "#fb6a4a", "#ef3b2c", "#cb181d", "#a50f15", "#67000d"],
  purples: ["#fcfbfd", "#efedf5", "#dadaeb", "#bcbddc", "#9e9ac8", "#807dba", "#6a51a3", "#54278f", "#3f007d"],
  greys: ["#ffffff", "#f0f0f0", "#d9d9d9", "#bdbdbd", "#969696", "#737373", "#525252", "#252525", "#000000"],
  heat: ["#ffffcc", "#ffeda0", "#fed976", "#feb24c", "#fd8d3c", "#fc4e2a", "#e31a1c", "#bd0026", "#800026"],
  viridis: ["#440154", "#482878", "#3e4989", "#31688e", "#26828e", "#1f9e89", "#35b779", "#6ece58", "#b5de2b", "#fde725"],
  magma: ["#000004", "#180f3d", "#440f76", "#721f81", "#9e2f7f", "#cd4071", "#f1605d", "#fd9668", "#feca8d", "#fcfdbf"],
  cividis: ["#00224e", "#123570", "#3b496c", "#575d6d", "#707173", "#8a8678", "#a59c74", "#c3b369", "#e1cc55", "#fee838"],
  redBlue: ["#67001f", "#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#f7f7f7", "#d1e5f0", "#92c5de", "#4393c3", "#2166ac", "#053061"],
  brownTeal: ["#543005", "#8c510a", "#bf812d", "#dfc27d", "#f6e8c3", "#f5f5f5", "#c7eae5", "#80cdc1", "#35978f", "#01665e", "#003c30"],
  purpleGreen: ["#40004b", "#762a83", "#9970ab", "#c2a5cf", "#e7d4e8", "#f7f7f7", "#d9f0d3", "#a6dba0", "#5aae61", "#1b7837", "#00441b"],
};

export const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function normalizeHex(hex: string): string {
  const h = hex.toLowerCase();
  return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
}

type Lab = [number, number, number];
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLin = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToOklab(hex: string): Lab {
  const h = normalizeHex(hex);
  const [r, g, b] = [1, 3, 5].map((i) => toLin(parseInt(h.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

function oklabToHex([L, a, b]: Lab): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return "#" + rgb.map((c) => Math.round(Math.min(1, Math.max(0, fromLin(c))) * 255).toString(16).padStart(2, "0")).join("");
}

/** WCAG relative luminance of a hex color. */
export function luminance(hex: string): number {
  const h = normalizeHex(hex);
  const [r, g, b] = [1, 3, 5].map((i) => toLin(parseInt(h.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function interpolateStops(stops: string[], t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = hexToOklab(stops[i]);
  const b = hexToOklab(stops[i + 1]);
  return oklabToHex([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
}

/**
 * Label ink for text drawn on a cell: absolute fills get a fixed light/dark
 * ink; theme fills get a class whose color flips with the theme (chart.css).
 */
export type Paint = { fill: string; ink: "light" | "dark" | "strong" | "soft" };

export type ColorScale = {
  domain: number[];
  diverging: boolean;
  /** Position 0..1 of a value on the ramp (after clamping, quantizing, reversing). */
  t(v: number): number;
  paint(v: number): Paint;
  /** CSS background for the legend bar. */
  gradient(): string;
};

const isDivergingScheme = (s?: SchemeName) => s === "redBlue" || s === "brownTeal" || s === "purpleGreen";

/** Build a scale over `values`; spec.domain overrides the data extent. */
export function buildColorScale(spec: ColorScaleSpec | undefined, values: number[]): ColorScale {
  const finite = values.filter(Number.isFinite);
  let lo = finite.length ? Math.min(...finite) : 0;
  let hi = finite.length ? Math.max(...finite) : 1;
  const diverging = spec?.domain?.length === 3 || isDivergingScheme(spec?.scheme);
  let domain: number[];
  if (spec?.domain?.length) domain = spec.domain;
  else if (diverging) {
    const m = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
    domain = lo < 0 && hi > 0 ? [-m, 0, m] : [lo, (lo + hi) / 2, hi];
  } else {
    if (hi === lo) hi = lo + 1;
    domain = [lo, hi];
  }
  if (diverging && domain.length === 2) domain = [domain[0], (domain[0] + domain[1]) / 2, domain[1]];
  [lo, hi] = [domain[0], domain[domain.length - 1]];
  const steps = spec?.steps;

  const t = (v: number) => {
    let x: number;
    if (diverging) {
      const mid = domain[1];
      x = v <= mid ? 0.5 * ((v - lo) / (mid - lo || 1)) : 0.5 + 0.5 * ((v - mid) / (hi - mid || 1));
    } else x = (v - lo) / (hi - lo || 1);
    x = Math.min(1, Math.max(0, x));
    if (steps && steps > 1) x = Math.min(steps - 1, Math.floor(x * steps)) / (steps - 1);
    return spec?.reverse ? 1 - x : x;
  };

  const stops = spec?.colors?.length ? spec.colors.map(normalizeHex) : spec?.scheme && spec.scheme !== "theme" ? SCHEMES[spec.scheme] : null;

  const paintAt = (x: number): Paint => {
    if (stops) {
      const fill = interpolateStops(stops, x);
      return { fill, ink: luminance(fill) < 0.3 ? "light" : "dark" };
    }
    // Theme ramp: CSS mixes between site-aware variables (see chart.css).
    if (diverging) {
      const side = x < 0.5 ? "lo" : "hi";
      const p = Math.round(Math.abs(x - 0.5) * 200);
      return { fill: `color-mix(in oklab, var(--op-div-${side}) ${p}%, var(--op-div-mid))`, ink: p >= 65 ? "strong" : "soft" };
    }
    const p = Math.round(x * 100);
    return { fill: `color-mix(in oklab, var(--op-seq-hi) ${p}%, var(--op-seq-lo))`, ink: p >= 60 ? "strong" : "soft" };
  };

  const gradient = () => {
    const n = steps && steps > 1 ? steps : 9;
    const parts: string[] = [];
    for (let k = 0; k < n; k++) {
      const x = n === 1 ? 0 : k / (n - 1);
      const c = paintAt(spec?.reverse ? 1 - x : x).fill;
      if (steps && steps > 1) parts.push(`${c} ${((k / n) * 100).toFixed(1)}%`, `${c} ${(((k + 1) / n) * 100).toFixed(1)}%`);
      else parts.push(`${c} ${(x * 100).toFixed(1)}%`);
    }
    return `linear-gradient(to right, ${parts.join(", ")})`;
  };

  return { domain, diverging, t, paint: (v) => paintAt(t(v)), gradient };
}

export const SCHEME_NAMES = Object.keys(SCHEMES) as Exclude<SchemeName, "theme">[];
