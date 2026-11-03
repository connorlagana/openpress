// Chart renderer: spec -> SVG/HTML strings. Pure and dependency-free so the
// same code draws the server render (no JS needed, crawlable, accessible) and
// the client re-render at the reader's real width and filter state (see
// chart-enhancer.tsx). Every string that came from a spec goes through esc();
// numbers are finite by validation; colors are validated hex or values
// computed here. Fonts and surfaces come from CSS (site.css, .op-chart).

import { buildColorScale } from "./color";
import { cellText, defaultFilterState, distinctValues, fieldIndex, fieldLabel, filterControl, formatCell, pointsOf, resolveView, type FilterState, type View } from "./data";
import { colorStyle, esc, formatValue, r1, truncate } from "./format";
import { heatmapPlot, scaleValues, scatterPlot, spatialBins, spatialPlot } from "./plots";
import { MAX_SERIES, isRound, type ChartSpec, type ChartType, type Plot, type PlotItem, type ResolvedSpec, type Tip, type ValueFormat } from "./types";

export { MAX_SERIES, esc, formatValue, resolveView, defaultFilterState };
export type { ChartSpec, ChartType, ValueFormat, View, FilterState, Plot, Tip };

export const DEFAULT_WIDTH = 680;
export const MAX_TABLE_ROWS = 500;

function niceStep(raw: number): number {
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
}

type Inline = Pick<ResolvedSpec, "type" | "labels" | "series" | "stacked" | "yAxis" | "annotations">;

/** Y domain + clean tick values. Bars and areas always include zero. */
export function yScale(spec: Inline | ChartSpec, visible: number[]) {
  const labels = spec.labels ?? [];
  const series = spec.series ?? [];
  let lo = Infinity;
  let hi = -Infinity;
  if (spec.type === "bar" && spec.stacked) {
    labels.forEach((_, i) => {
      let pos = 0;
      let neg = 0;
      for (const s of visible) {
        const v = series[s].data[i] ?? 0;
        if (v >= 0) pos += v;
        else neg += v;
      }
      hi = Math.max(hi, pos);
      lo = Math.min(lo, neg);
    });
  } else {
    for (const s of visible) {
      for (const v of series[s].data) {
        if (v === null) continue;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
  }
  for (const l of spec.annotations?.lines ?? []) {
    if (l.axis !== "y") continue;
    lo = Math.min(lo, l.value);
    hi = Math.max(hi, l.value);
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

export type RenderOpts = { width?: number; hidden?: ReadonlySet<number>; state?: FilterState };

const ariaLabelOf = (spec: ChartSpec) => esc(spec.title + (spec.description ? `. ${spec.description}` : ""));

/** Draw the plot for an already-resolved view (labels/series filled in for the current filters). */
export function renderPlot(view: View, opts: Omit<RenderOpts, "state"> = {}): Plot {
  const W = Math.max(240, Math.round(opts.width ?? DEFAULT_WIDTH));
  const label = ariaLabelOf(view.spec);
  switch (view.spec.type) {
    case "scatter":
      return scatterPlot(view, W, label, opts.hidden);
    case "heatmap":
      return heatmapPlot(view, W, label);
    case "spatial_heatmap":
      return spatialPlot(view, W, label);
    case "pie":
    case "donut":
      return piePlot(view.spec, W, label);
    default:
      return cartesianPlot(view.spec, W, label, opts.hidden);
  }
}

export function renderChartSvg(spec: ChartSpec, opts: RenderOpts = {}): string {
  return renderPlot(resolveView(spec, opts.state), opts).svg;
}

function cartesianPlot(spec: ResolvedSpec, W: number, ariaLabel: string, hidden?: ReadonlySet<number>): Plot {
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
  const band = plotW / Math.max(1, n);
  const y = (v: number) => top + plotH - ((v - min) / (max - min)) * plotH;
  const cx = (i: number) => left + (i + 0.5) * band;
  const baseV = Math.min(Math.max(0, min), max);
  const y0 = y(baseV);
  const colors = spec.style?.colors;
  const out: string[] = [];

  out.push(`<svg class="op-plot" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${ariaLabel}">`);
  if (spec.style?.background) out.push(`<rect class="op-bg" x="${left}" y="${top}" width="${r1(plotW)}" height="${r1(plotH)}" fill="${spec.style.background}"/>`);
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
            out.push(`<path class="op-bar op-c${seg.s}" data-i="${i}"${colorStyle(colors, seg.s)} d="${barPath(cx(i) - bw / 2, bw, a, b, k === part.length - 1)}"/>`);
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
          out.push(`<path class="op-bar op-c${s}" data-i="${i}"${colorStyle(colors, s)} d="${barPath(x, bw, y0, y(Math.min(Math.max(v, min), max)), true)}"/>`);
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
      out.push(`<g class="op-series op-c${s}"${colorStyle(colors, s)}>`);
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

  const refs = (spec.annotations?.lines ?? []).filter((l) => l.axis === "y" && l.value >= min && l.value <= max);
  if (refs.length) {
    out.push(`<g class="op-refs" aria-hidden="true">`);
    for (const l of refs) {
      const ly = r1(y(l.value));
      out.push(`<line class="op-ref" x1="${left}" x2="${W - right}" y1="${ly}" y2="${ly}"/>`);
      if (l.label) out.push(`<text class="op-ref-label" x="${W - right}" y="${r1(ly - 5)}" text-anchor="end">${esc(l.label)}</text>`);
    }
    out.push(`</g>`);
  }

  const items: PlotItem[] = [];
  out.push(`<g class="op-hits">`);
  spec.labels.forEach((_, i) => {
    items.push({ i, x: r1(cx(i)), y: top });
    out.push(`<rect class="op-hit" data-i="${i}" data-x="${r1(cx(i))}" x="${r1(left + i * band)}" y="${top}" width="${r1(band)}" height="${r1(plotH)}"/>`);
  });
  out.push(`</g></svg>`);
  const tip = (i: number): Tip => ({
    head: spec.labels[i] ?? "",
    rows: visible.map((k) => ({ cls: `op-c${k}`, color: colors?.[k], value: formatValue(fmt, spec.series[k].data[i] ?? null), name: spec.series[k].name })),
  });
  return { svg: out.join(""), W, H, mode: "band", items, tip };
}

function piePlot(spec: ResolvedSpec, W: number, ariaLabel: string): Plot {
  const H = Math.round(Math.min(280, Math.max(200, W * 0.6)));
  const R = H / 2 - 6;
  const cx = W / 2;
  const cy = H / 2;
  const inner = spec.type === "donut" ? R * 0.6 : 0;
  const data = spec.series[0].data;
  const total = data.reduce<number>((a, v) => a + (v ?? 0), 0);
  const colors = spec.style?.colors;
  const out: string[] = [`<svg class="op-plot" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${ariaLabel}"><g class="op-marks">`];
  const pt = (a: number, rad: number) => `${r1(cx + rad * Math.cos(a))} ${r1(cy + rad * Math.sin(a))}`;
  const items: PlotItem[] = [];
  let a0 = -Math.PI / 2;
  data.forEach((v, i) => {
    if (!v || total <= 0) return;
    const frac = v / total;
    if (frac >= 0.9999) {
      const ring = inner ? `M${cx - R} ${cy}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0M${cx - inner} ${cy}a${inner} ${inner} 0 1 1 ${2 * inner} 0a${inner} ${inner} 0 1 1 ${-2 * inner} 0Z` : `M${cx - R} ${cy}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0Z`;
      out.push(`<path class="op-slice op-c${i}" data-i="${i}"${colorStyle(colors, i)} fill-rule="evenodd" d="${ring}"/>`);
      items.push({ i, x: cx, y: cy - R });
      return;
    }
    const a1 = a0 + frac * 2 * Math.PI;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const d = inner
      ? `M${pt(a0, R)}A${r1(R)} ${r1(R)} 0 ${large} 1 ${pt(a1, R)}L${pt(a1, inner)}A${r1(inner)} ${r1(inner)} 0 ${large} 0 ${pt(a0, inner)}Z`
      : `M${cx} ${cy}L${pt(a0, R)}A${r1(R)} ${r1(R)} 0 ${large} 1 ${pt(a1, R)}Z`;
    out.push(`<path class="op-slice op-c${i}" data-i="${i}"${colorStyle(colors, i)} d="${d}"/>`);
    const mid = (a0 + a1) / 2;
    items.push({ i, x: r1(cx + R * 0.8 * Math.cos(mid)), y: r1(cy + R * 0.8 * Math.sin(mid)) });
    a0 = a1;
  });
  out.push(`</g></svg>`);
  const tip = (i: number): Tip => {
    const pct = total > 0 ? ` · ${Math.round(((data[i] ?? 0) / total) * 100)}%` : "";
    return { head: spec.labels[i] ?? "", rows: [{ cls: `op-c${i}`, color: colors?.[i], value: formatValue(spec.valueFormat, data[i] ?? null) + pct, name: spec.series[0].name }] };
  };
  return { svg: out.join(""), W, H, mode: "slice", items, tip };
}

// ---------- Legend ----------

function scaleLegendHtml(view: View): string {
  const sv = scaleValues(view);
  if (!sv) return "";
  const scale = buildColorScale(sv.scheme?.colorScale, sv.values);
  const fmt = view.spec.valueFormat;
  const ticks = scale.domain.map((v) => `<span>${esc(formatValue(fmt, r1(v * 100) / 100, { compact: true }))}</span>`).join("");
  const title = view.spec.style?.legend?.title ?? (view.spec.type === "spatial_heatmap" ? (spatialBins(view.spec, []).how === "count" ? "Density" : "Value") : "");
  return `<div class="op-scale"${title ? "" : ' aria-hidden="true"'}>${title ? `<span class="op-scale-title">${esc(title)}</span>` : ""}<span class="op-scale-bar" aria-hidden="true" style="background:${scale.gradient()}"></span><span class="op-scale-ticks" aria-hidden="true">${ticks}</span></div>`;
}

export function legendHtml(view: View): string {
  const spec = view.spec;
  if (spec.style?.legend?.show === false) return "";
  const colors = spec.style?.colors;
  const title = spec.style?.legend?.title && spec.type !== "heatmap" && spec.type !== "spatial_heatmap" ? `<span class="op-legend-title">${esc(spec.style.legend.title)}</span>` : "";
  if (isRound(spec)) {
    const data = spec.series[0]?.data ?? [];
    const total = data.reduce<number>((a, v) => a + (v ?? 0), 0);
    return `<ul class="op-legend">${title ? `<li>${title}</li>` : ""}${spec.labels
      .map((l, i) => `<li><span class="op-key op-key-rect op-c${i}" aria-hidden="true"${colorStyle(colors, i)}></span>${esc(l)} <span class="op-legend-v">${total > 0 ? Math.round(((data[i] ?? 0) / total) * 100) : 0}%</span></li>`)
      .join("")}</ul>`;
  }
  if (spec.type === "heatmap" || spec.type === "spatial_heatmap") return scaleLegendHtml(view);
  let names = spec.series.map((s) => s.name);
  let shape = spec.type === "bar" ? "rect" : "line";
  let extra = "";
  if (spec.type === "scatter") {
    names = pointsOf(spec, view.rows).seriesNames;
    shape = "dot";
    extra = scaleLegendHtml(view);
  }
  if (names.length < 2) return extra;
  // Toggles start disabled; the enhancer enables them once it can re-render.
  return `<div class="op-legend" role="group" aria-label="${title ? esc(spec.style!.legend!.title!) : "Series"}">${title}${names
    .map((name, i) => `<button type="button" class="op-toggle" data-s="${i}" aria-pressed="true" disabled><span class="op-key op-key-${shape} op-c${i}" aria-hidden="true"${colorStyle(colors, i)}></span>${esc(name)}</button>`)
    .join("")}</div>${extra}`;
}

// ---------- Filters ----------

export function filtersHtml(spec: ChartSpec, state: FilterState, enabled = false): string {
  const ds = spec.dataset;
  if (!ds || !spec.filters?.length) return "";
  const dis = enabled ? "" : " disabled";
  const parts = spec.filters.map((f, i) => {
    const col = fieldIndex(ds, f.field);
    const field = ds.fields[col];
    const label = esc(f.label ?? (field ? fieldLabel(field) : f.field));
    const control = filterControl(f, field);
    const st = state[i];
    if (control === "range") {
      const vals = distinctValues(ds, col);
      const isDate = field?.type === "date";
      const v = (x: unknown) => (x === undefined || x === null ? "" : esc(isDate ? String(x).slice(0, 10) : String(x)));
      const lo = v(vals[0]);
      const hi = v(vals[vals.length - 1]);
      const cur = st?.kind === "range" ? st : { min: undefined, max: undefined };
      const input = (b: "min" | "max", text: string) =>
        `<label><span>${text}</span><input type="${isDate ? "date" : "number"}" data-f="${i}" data-b="${b}" min="${lo}" max="${hi}" value="${v(cur[b])}" placeholder="${b === "min" ? lo : hi}"${isDate ? "" : ' step="any"'}${dis}></label>`;
      return `<div class="op-filter op-filter-range" role="group" aria-label="${label}"><span class="op-filter-label" aria-hidden="true">${label}</span>${input("min", "From")}${input("max", "To")}</div>`;
    }
    const vals = distinctValues(ds, col);
    const selected = st?.kind === "set" ? st.values : null;
    const on = (x: unknown) => (selected ? selected.includes(x as never) : true);
    if (control === "buttons") {
      return `<div class="op-filter" role="group" aria-label="${label}"><span class="op-filter-label" aria-hidden="true">${label}</span><span class="op-chips">${vals
        .map((x, k) => `<button type="button" class="op-chip" data-f="${i}" data-k="${k}" aria-pressed="${on(x)}"${dis}>${esc(truncate(cellText(x), 40))}</button>`)
        .join("")}</span></div>`;
    }
    const all = f.allowAll === false ? "" : `<option value="*"${selected ? "" : " selected"}>All</option>`;
    const opts = vals.map((x, k) => `<option value="${k}"${selected && selected.length === 1 && selected[0] === x ? " selected" : ""}>${esc(truncate(cellText(x), 60))}</option>`).join("");
    return `<label class="op-filter"><span class="op-filter-label">${label}</span><select data-f="${i}"${dis}>${all}${opts}</select></label>`;
  });
  return `<div class="op-filters" role="group" aria-label="Filter the chart">${parts.join("")}</div>`;
}

export function filterStatusText(view: View, spec: ChartSpec): string {
  if (!spec.filters?.length || !spec.dataset) return "";
  return `Showing ${view.rows.length.toLocaleString("en-US")} of ${view.total.toLocaleString("en-US")} records`;
}

// ---------- Data table ----------

export function chartTableHtml(spec: Pick<ChartSpec, "type" | "labels" | "series" | "xAxis" | "valueFormat">): string {
  const fmt = spec.valueFormat;
  const labels = spec.labels ?? [];
  const series = spec.series ?? [];
  const head = isRound(spec) ? [spec.xAxis?.title ?? "", series[0]?.name ?? ""] : [spec.xAxis?.title ?? "", ...series.map((s) => s.name)];
  const rows = labels.map((l, i) => `<tr><th scope="row">${esc(l)}</th>${series.map((s) => `<td>${esc(formatValue(fmt, s.data[i] ?? null))}</td>`).join("")}</tr>`);
  return `<table><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

function table(head: string[], body: string[][], rowHeader = true): string {
  return `<table><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${body
    .map((r) => `<tr>${r.map((c, k) => (k === 0 && rowHeader ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

/** The accessible data behind the current view. */
export function viewTableHtml(view: View): string {
  const spec = view.spec;
  const fmt = spec.valueFormat;
  if (spec.type === "heatmap") {
    return table([spec.yAxis?.title ?? "", ...spec.labels], spec.series.map((s) => [s.name, ...s.data.map((v) => formatValue(fmt, v))]));
  }
  if (spec.type === "spatial_heatmap") {
    const grid = spatialBins(spec, pointsOf(spec, view.rows).points);
    const bins = [...grid.bins].sort((a, b) => b.value - a.value).slice(0, 200);
    const valueHead = grid.how === "count" ? [] : [spec.style?.legend?.title ?? (grid.how === "mean" ? "Average" : "Total")];
    const note = grid.bins.length > bins.length ? `<p class="op-table-note">Top ${bins.length} of ${grid.bins.length} zones.</p>` : "";
    return (
      table(
        ["X range", "Y range", "Records", ...valueHead],
        bins.map((b) => [`${r1(b.x0)}–${r1(b.x1)}`, `${r1(b.y0)}–${r1(b.y1)}`, String(b.n), ...(grid.how === "count" ? [] : [formatValue(fmt, b.value)])]),
        false,
      ) + note
    );
  }
  if (spec.type === "scatter" && spec.dataset) {
    const ds = spec.dataset;
    const rows = view.rows.slice(0, MAX_TABLE_ROWS);
    const labelCol = fieldIndex(ds, spec.encoding?.label);
    const order = labelCol >= 0 ? [labelCol, ...ds.fields.map((_, i) => i).filter((i) => i !== labelCol)] : ds.fields.map((_, i) => i);
    const note = view.rows.length > rows.length ? `<p class="op-table-note">First ${rows.length} of ${view.rows.length} rows.</p>` : "";
    return table(order.map((i) => fieldLabel(ds.fields[i])), rows.map((r) => order.map((i) => formatCell(ds.fields[i], r[i]))), labelCol >= 0) + note;
  }
  return chartTableHtml(spec);
}

// ---------- Figure ----------

/** Serialize for an inline JSON <script>; escapes anything that could end the element. */
export function specJson(spec: unknown): string {
  return JSON.stringify(spec).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/** The full embed: caption, filters, legend, SVG, source, data table, spec for the enhancer. */
export function chartFigureHtml(id: string, spec: ChartSpec): string {
  const view = resolveView(spec);
  const bottom = spec.style?.legend?.position === "bottom";
  const legend = `<div class="op-legend-slot">${legendHtml(view)}</div>`;
  const status = filterStatusText(view, spec);
  return [
    `<figure class="op-chart${bottom ? " op-legend-bottom" : ""}" data-chart="${esc(id)}" data-type="${spec.type}">`,
    `<figcaption class="op-chart-head"><span class="op-chart-title">${esc(spec.title)}</span>${spec.subtitle ? `<span class="op-chart-sub">${esc(spec.subtitle)}</span>` : ""}</figcaption>`,
    filtersHtml(spec, defaultFilterState(spec)),
    bottom ? "" : legend,
    `<div class="op-chart-body">${renderPlot(view).svg}<div class="op-tip" role="status" hidden></div></div>`,
    bottom ? legend : "",
    `<p class="op-chart-note"${view.note || status ? "" : " hidden"} aria-live="polite">${esc([status, view.note].filter(Boolean).join(". "))}</p>`,
    `<div class="op-chart-foot">${spec.source ? `<span class="op-chart-source">Source: ${esc(spec.source)}</span>` : "<span></span>"}<details class="op-chart-data"><summary>View data</summary><div class="op-chart-table">${viewTableHtml(view)}</div></details></div>`,
    `<script type="application/json" class="op-chart-spec">${specJson(spec)}</script>`,
    `</figure>`,
  ].join("");
}

/** Charts in feeds: readers strip SVG and scripts, so send the title and the data. */
export function chartFeedHtml(spec: ChartSpec): string {
  return `<figure><figcaption><strong>${esc(spec.title)}</strong>${spec.subtitle ? ` · ${esc(spec.subtitle)}` : ""}</figcaption>${viewTableHtml(resolveView(spec))}${spec.source ? `<p><small>Source: ${esc(spec.source)}</small></p>` : ""}</figure>`;
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
