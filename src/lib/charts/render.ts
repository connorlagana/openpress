// Chart renderer: spec -> SVG/HTML strings. Pure and dependency-free so the
// same code draws the server render (no JS needed, crawlable, accessible) and
// the client re-render at the reader's real width (see chart-enhancer.tsx).
// Every string that came from a spec goes through esc(); numbers are finite by
// validation. Colors, fonts and surfaces come from CSS (site.css, .op-chart).

export const MAX_SERIES = 8;

export type ChartType = "line" | "area" | "bar" | "pie" | "donut";
export type ValueFormat = { prefix?: string; suffix?: string; decimals?: number };
export type ChartSpec = {
  type: ChartType;
  title: string;
  subtitle?: string;
  source?: string;
  description?: string;
  labels: string[];
  series: { name: string; data: (number | null)[] }[];
  stacked?: boolean;
  xAxis?: { title?: string };
  yAxis?: { title?: string; min?: number; max?: number };
  valueFormat?: ValueFormat;
};

export const DEFAULT_WIDTH = 680;

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const isRound = (s: Pick<ChartSpec, "type">) => s.type === "pie" || s.type === "donut";

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

function niceStep(raw: number): number {
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
}

/** Y domain + clean tick values. Bars and areas always include zero. */
export function yScale(spec: ChartSpec, visible: number[]) {
  let lo = Infinity;
  let hi = -Infinity;
  if (spec.type === "bar" && spec.stacked) {
    spec.labels.forEach((_, i) => {
      let pos = 0;
      let neg = 0;
      for (const s of visible) {
        const v = spec.series[s].data[i] ?? 0;
        if (v >= 0) pos += v;
        else neg += v;
      }
      hi = Math.max(hi, pos);
      lo = Math.min(lo, neg);
    });
  } else {
    for (const s of visible) {
      for (const v of spec.series[s].data) {
        if (v === null) continue;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
  }
  if (!Number.isFinite(lo)) {
    lo = 0;
    hi = 1;
  }
  // Lines may float off zero when the data sits far from it (e.g. 52-69%).
  const zero = spec.type !== "line" || (lo >= 0 && lo < hi - lo) || (hi <= 0 && -hi < hi - lo);
  if (zero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (spec.yAxis?.min !== undefined) lo = spec.yAxis.min;
  if (spec.yAxis?.max !== undefined) hi = spec.yAxis.max;
  if (hi <= lo) hi = lo + (Math.abs(lo) || 1);
  const step = niceStep((hi - lo) / 4);
  const min = spec.yAxis?.min ?? Math.floor(lo / step + 1e-9) * step;
  const max = spec.yAxis?.max ?? Math.ceil(hi / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step - 1e-9) * step; t <= max + step * 1e-6; t += step) ticks.push(Math.round(t / step) * step);
  return { min, max, ticks };
}

/** A bar from baseline y0 to tip y1, square at the baseline and rounded (r ≤ 4) at the tip. */
function barPath(x: number, w: number, y0: number, y1: number, round: boolean): string {
  const h = Math.abs(y1 - y0);
  const r = round ? Math.min(4, w / 2, h) : 0;
  const up = y1 <= y0;
  const tip = y1;
  const d = up ? 1 : -1;
  if (r === 0) return `M${r1(x)} ${r1(y0)}V${r1(tip)}H${r1(x + w)}V${r1(y0)}Z`;
  return (
    `M${r1(x)} ${r1(y0)}V${r1(tip + d * r)}` +
    `Q${r1(x)} ${r1(tip)} ${r1(x + r)} ${r1(tip)}H${r1(x + w - r)}` +
    `Q${r1(x + w)} ${r1(tip)} ${r1(x + w)} ${r1(tip + d * r)}V${r1(y0)}Z`
  );
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export type RenderOpts = { width?: number; hidden?: ReadonlySet<number> };

export function renderChartSvg(spec: ChartSpec, opts: RenderOpts = {}): string {
  const W = Math.max(240, Math.round(opts.width ?? DEFAULT_WIDTH));
  const label = esc(spec.title + (spec.description ? `. ${spec.description}` : ""));
  return isRound(spec) ? pieSvg(spec, W, label) : cartesianSvg(spec, W, label, opts.hidden);
}

function cartesianSvg(spec: ChartSpec, W: number, ariaLabel: string, hidden?: ReadonlySet<number>): string {
  let visible = spec.series.map((_, i) => i).filter((i) => !hidden?.has(i));
  if (!visible.length) visible = spec.series.map((_, i) => i);
  const H = Math.round(Math.min(360, Math.max(220, W * 0.52)));
  const fmt = spec.valueFormat;
  const { min, max, ticks } = yScale(spec, visible);
  const compact = Math.max(Math.abs(min), Math.abs(max)) >= 10_000;
  // Ticks are round numbers: keep prefix/suffix but not forced decimals ("70%", not "70.0%").
  const tickFmt = fmt ? { prefix: fmt.prefix, suffix: fmt.suffix } : undefined;
  const tickText = ticks.map((t) => formatValue(tickFmt, t, { compact }));
  const yTitle = spec.yAxis?.title;
  const xTitle = spec.xAxis?.title;
  const left = Math.ceil(Math.max(...tickText.map((t) => t.length)) * 7.5 + 16 + (yTitle ? 18 : 0));
  const top = 12;
  const right = 14;
  const bottom = 26 + (xTitle ? 20 : 0);
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const n = spec.labels.length;
  const band = plotW / n;
  const y = (v: number) => top + plotH - ((v - min) / (max - min)) * plotH;
  const cx = (i: number) => left + (i + 0.5) * band;
  const baseV = Math.min(Math.max(0, min), max);
  const y0 = y(baseV);
  const out: string[] = [];

  out.push(`<svg class="op-plot" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${ariaLabel}">`);
  out.push(`<g class="op-axis" aria-hidden="true">`);
  ticks.forEach((t, k) => {
    const ty = r1(y(t));
    out.push(`<line class="op-grid" x1="${left}" x2="${W - right}" y1="${ty}" y2="${ty}"/>`);
    out.push(`<text x="${left - 8}" y="${ty}" dy="0.32em" text-anchor="end">${esc(tickText[k])}</text>`);
  });
  out.push(`<line class="op-base" x1="${left}" x2="${W - right}" y1="${r1(y0)}" y2="${r1(y0)}"/>`);
  const maxLen = Math.min(18, Math.max(...spec.labels.map((l) => l.length)));
  const every = Math.max(1, Math.ceil((maxLen * 6.6 + 12) / band));
  spec.labels.forEach((l, i) => {
    if (i % every !== 0) return;
    out.push(`<text x="${r1(cx(i))}" y="${top + plotH + 18}" text-anchor="middle">${esc(truncate(l, 18))}</text>`);
  });
  if (yTitle) out.push(`<text class="op-axis-title" transform="translate(12 ${r1(top + plotH / 2)}) rotate(-90)" text-anchor="middle">${esc(yTitle)}</text>`);
  if (xTitle) out.push(`<text class="op-axis-title" x="${r1(left + plotW / 2)}" y="${H - 4}" text-anchor="middle">${esc(xTitle)}</text>`);
  out.push(`</g>`);

  if (spec.type === "bar") {
    out.push(`<g class="op-marks">`);
    if (spec.stacked) {
      const bw = Math.max(2, Math.min(24, band * 0.62));
      spec.labels.forEach((_, i) => {
        const segs = visible.map((s) => ({ s, v: spec.series[s].data[i] })).filter((x): x is { s: number; v: number } => x.v !== null && x.v !== 0);
        for (const sign of [1, -1]) {
          const part = segs.filter((x) => Math.sign(x.v) === sign);
          let acc = 0;
          part.forEach((seg, k) => {
            const from = acc;
            acc += seg.v;
            let a = y(from);
            let b = y(acc);
            if (k > 0) a -= sign; // 2px surface gap between stacked segments
            if (k < part.length - 1) b += sign;
            out.push(`<path class="op-bar op-c${seg.s}" data-i="${i}" d="${barPath(cx(i) - bw / 2, bw, a, b, k === part.length - 1)}"/>`);
          });
        }
      });
    } else {
      const k = visible.length;
      const gap = 2;
      const bw = Math.max(1, Math.min(24, (band * 0.72 - gap * (k - 1)) / k));
      const groupW = bw * k + gap * (k - 1);
      spec.labels.forEach((_, i) => {
        visible.forEach((s, j) => {
          const v = spec.series[s].data[i];
          if (v === null) return;
          const x = cx(i) - groupW / 2 + j * (bw + gap);
          out.push(`<path class="op-bar op-c${s}" data-i="${i}" d="${barPath(x, bw, y0, y(Math.min(Math.max(v, min), max)), true)}"/>`);
        });
      });
    }
    out.push(`</g>`);
  } else {
    out.push(`<line class="op-cross" x1="0" x2="0" y1="${top}" y2="${top + plotH}" visibility="hidden"/>`);
    out.push(`<g class="op-marks">`);
    for (const s of visible) {
      const data = spec.series[s].data;
      const runs: { i: number; v: number }[][] = [];
      let run: { i: number; v: number }[] = [];
      data.forEach((v, i) => {
        if (v === null) {
          if (run.length) runs.push(run);
          run = [];
        } else run.push({ i, v });
      });
      if (run.length) runs.push(run);
      out.push(`<g class="op-series op-c${s}">`);
      for (const r of runs) {
        const pts = r.map((p) => `${r1(cx(p.i))} ${r1(y(p.v))}`);
        if (spec.type === "area" && r.length > 1) {
          out.push(`<path class="op-area" d="M${pts.join("L")}V${r1(y0)}H${r1(cx(r[0].i))}Z"/>`);
        }
        if (r.length > 1) out.push(`<path class="op-line" d="M${pts.join("L")}"/>`);
      }
      const dots = n <= 24 ? data.map((v, i) => ({ v, i })) : data.map((v, i) => ({ v, i })).filter((p, i, a) => p.v !== null && a.slice(i + 1).every((q) => q.v === null));
      for (const p of dots) if (p.v !== null) out.push(`<circle class="op-dot" data-i="${p.i}" cx="${r1(cx(p.i))}" cy="${r1(y(p.v))}" r="4"/>`);
      out.push(`</g>`);
    }
    out.push(`</g>`);
  }

  out.push(`<g class="op-hits">`);
  spec.labels.forEach((_, i) => out.push(`<rect class="op-hit" data-i="${i}" data-x="${r1(cx(i))}" x="${r1(left + i * band)}" y="${top}" width="${r1(band)}" height="${r1(plotH)}"/>`));
  out.push(`</g></svg>`);
  return out.join("");
}

function pieSvg(spec: ChartSpec, W: number, ariaLabel: string): string {
  const H = Math.round(Math.min(280, Math.max(200, W * 0.6)));
  const R = H / 2 - 6;
  const cx = W / 2;
  const cy = H / 2;
  const inner = spec.type === "donut" ? R * 0.6 : 0;
  const data = spec.series[0].data;
  const total = data.reduce<number>((a, v) => a + (v ?? 0), 0);
  const out: string[] = [`<svg class="op-plot" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${ariaLabel}"><g class="op-marks">`];
  const pt = (a: number, rad: number) => `${r1(cx + rad * Math.cos(a))} ${r1(cy + rad * Math.sin(a))}`;
  let a0 = -Math.PI / 2;
  data.forEach((v, i) => {
    if (!v || total <= 0) return;
    const frac = v / total;
    if (frac >= 0.9999) {
      const ring = inner ? `M${cx - R} ${cy}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0M${cx - inner} ${cy}a${inner} ${inner} 0 1 1 ${2 * inner} 0a${inner} ${inner} 0 1 1 ${-2 * inner} 0Z` : `M${cx - R} ${cy}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0Z`;
      out.push(`<path class="op-slice op-c${i}" data-i="${i}" fill-rule="evenodd" d="${ring}"/>`);
      return;
    }
    const a1 = a0 + frac * 2 * Math.PI;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const d = inner
      ? `M${pt(a0, R)}A${r1(R)} ${r1(R)} 0 ${large} 1 ${pt(a1, R)}L${pt(a1, inner)}A${r1(inner)} ${r1(inner)} 0 ${large} 0 ${pt(a0, inner)}Z`
      : `M${cx} ${cy}L${pt(a0, R)}A${r1(R)} ${r1(R)} 0 ${large} 1 ${pt(a1, R)}Z`;
    out.push(`<path class="op-slice op-c${i}" data-i="${i}" d="${d}"/>`);
    a0 = a1;
  });
  out.push(`</g></svg>`);
  return out.join("");
}

function legendHtml(spec: ChartSpec): string {
  if (isRound(spec)) {
    const data = spec.series[0].data;
    const total = data.reduce<number>((a, v) => a + (v ?? 0), 0);
    return `<ul class="op-legend">${spec.labels
      .map((l, i) => `<li><span class="op-key op-key-rect op-c${i}" aria-hidden="true"></span>${esc(l)} <span class="op-legend-v">${total > 0 ? Math.round(((data[i] ?? 0) / total) * 100) : 0}%</span></li>`)
      .join("")}</ul>`;
  }
  if (spec.series.length < 2) return "";
  const shape = spec.type === "bar" ? "rect" : "line";
  // Toggles start disabled; the enhancer enables them once it can re-render.
  return `<div class="op-legend" role="group" aria-label="Series">${spec.series
    .map((s, i) => `<button type="button" class="op-toggle" data-s="${i}" aria-pressed="true" disabled><span class="op-key op-key-${shape} op-c${i}" aria-hidden="true"></span>${esc(s.name)}</button>`)
    .join("")}</div>`;
}

export function chartTableHtml(spec: ChartSpec): string {
  const fmt = spec.valueFormat;
  const head = isRound(spec) ? [spec.xAxis?.title ?? "", spec.series[0].name] : [spec.xAxis?.title ?? "", ...spec.series.map((s) => s.name)];
  const rows = spec.labels.map(
    (l, i) => `<tr><th scope="row">${esc(l)}</th>${spec.series.map((s) => `<td>${esc(formatValue(fmt, s.data[i] ?? null))}</td>`).join("")}</tr>`,
  );
  return `<table><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

/** Serialize for an inline JSON <script>; escapes anything that could end the element. */
export function specJson(spec: ChartSpec): string {
  return JSON.stringify(spec).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/** The full embed: caption, legend, SVG, source, data table, spec for the enhancer. */
export function chartFigureHtml(id: string, spec: ChartSpec): string {
  return [
    `<figure class="op-chart" data-chart="${esc(id)}" data-type="${spec.type}">`,
    `<figcaption class="op-chart-head"><span class="op-chart-title">${esc(spec.title)}</span>${spec.subtitle ? `<span class="op-chart-sub">${esc(spec.subtitle)}</span>` : ""}</figcaption>`,
    legendHtml(spec),
    `<div class="op-chart-body">${renderChartSvg(spec)}<div class="op-tip" role="status" hidden></div></div>`,
    `<div class="op-chart-foot">${spec.source ? `<span class="op-chart-source">Source: ${esc(spec.source)}</span>` : "<span></span>"}<details class="op-chart-data"><summary>View data</summary><div class="op-chart-table">${chartTableHtml(spec)}</div></details></div>`,
    `<script type="application/json" class="op-chart-spec">${specJson(spec)}</script>`,
    `</figure>`,
  ].join("");
}

/** Charts in feeds: readers strip SVG and scripts, so send the title and the data. */
export function chartFeedHtml(spec: ChartSpec): string {
  return `<figure><figcaption><strong>${esc(spec.title)}</strong>${spec.subtitle ? ` · ${esc(spec.subtitle)}` : ""}</figcaption>${chartTableHtml(spec)}${spec.source ? `<p><small>Source: ${esc(spec.source)}</small></p>` : ""}</figure>`;
}

// ---------- Embedding in posts ----------

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** The Markdown embed token, e.g. {{chart:2f0c…}}. Must sit on its own line. */
export const chartToken = (id: string) => `{{chart:${id}}}`;
const TOKEN_MD = new RegExp(`\\{\\{chart:(${UUID})\\}\\}`, "gi");
/** What marked turns a token on its own line into (sanitize leaves it alone). */
const TOKEN_HTML = new RegExp(`<p>\\{\\{chart:(${UUID})\\}\\}</p>`, "gi");

export function chartIdsInMarkdown(md: string): string[] {
  return [...new Set([...md.matchAll(TOKEN_MD)].map((m) => m[1].toLowerCase()))];
}

export function chartIdsInHtml(html: string): string[] {
  return [...new Set([...html.matchAll(TOKEN_HTML)].map((m) => m[1].toLowerCase()))];
}

export type EmbedMode = "page" | "feed" | "preview";

/**
 * Replace embed tokens in rendered post HTML with charts. Unknown or deleted
 * charts disappear from public pages and show a notice in previews.
 */
export function embedCharts(html: string, charts: ReadonlyMap<string, ChartSpec>, mode: EmbedMode = "page"): string {
  return html.replace(TOKEN_HTML, (_m, rawId: string) => {
    const id = rawId.toLowerCase();
    const spec = charts.get(id);
    if (!spec) return mode === "preview" ? `<p><em>Chart ${esc(id)} not found on this site.</em></p>` : "";
    return mode === "feed" ? chartFeedHtml(spec) : chartFigureHtml(id, spec);
  });
}
