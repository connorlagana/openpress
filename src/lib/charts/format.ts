// Small shared helpers for the chart renderers.
import type { ValueFormat } from "./types";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export const r1 = (n: number) => Math.round(n * 10) / 10;

export function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export function formatValue(fmt: ValueFormat | undefined, v: number | null, opts: { compact?: boolean } = {}): string {
  if (v === null || !Number.isFinite(v)) return "–";
  const abs = Math.abs(v);
  const nf =
    opts.compact && abs >= 10_000
      ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })
      : fmt?.decimals !== undefined
        ? new Intl.NumberFormat("en-US", { minimumFractionDigits: fmt.decimals, maximumFractionDigits: fmt.decimals })
        : new Intl.NumberFormat("en-US", { maximumFractionDigits: opts.compact ? 1 : 2 });
  return `${v < 0 ? "−" : ""}${fmt?.prefix ?? ""}${nf.format(abs)}${fmt?.suffix ?? ""}`;
}

export function niceStep(raw: number): number {
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
}

/** A clean linear domain with round ticks around [lo, hi]. Fixed min/max win. */
export function niceDomain(lo: number, hi: number, opts: { min?: number; max?: number; ticks?: number } = {}) {
  if (opts.min !== undefined) lo = opts.min;
  if (opts.max !== undefined) hi = opts.max;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) [lo, hi] = [0, 1];
  if (hi <= lo) hi = lo + (Math.abs(lo) || 1);
  const step = niceStep((hi - lo) / (opts.ticks ?? 4));
  const min = opts.min ?? Math.floor(lo / step + 1e-9) * step;
  const max = opts.max ?? Math.ceil(hi / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step - 1e-9) * step; t <= max + step * 1e-6; t += step) ticks.push(Math.round(t / step) * step);
  return { min, max, ticks };
}

/** Inline style that overrides a series color, only for validated hex. */
export function colorStyle(colors: string[] | undefined, i: number): string {
  const c = colors?.[i];
  return c && /^#[0-9a-f]{6}$/i.test(c) ? ` style="--c:${c}"` : "";
}
