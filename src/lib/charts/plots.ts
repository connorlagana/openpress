// Scatter plots, categorical heatmaps and spatial heatmaps. Same contract as
// the cartesian/pie renderers in render.ts: pure string building from
// validated data, every spec string escaped, colors either CSS classes or
// hex/color-mix values computed here (never spec-provided CSS).

import { buildColorScale, type ColorScale } from "./color";
import { fieldIndex, fieldLabel, formatCell, pointsOf, type Point, type View } from "./data";
import { fieldFrame, fieldMarkingsSvg, FIELDS } from "./fields";
import { colorStyle, esc, formatValue, niceDomain, niceStep, r1, truncate } from "./format";
import type { ChartSpec, Plot, PlotItem, Tip, TipRow } from "./types";

const TICK_CHAR = 7.2;

type Frame = {
  W: number;
  H: number;
  px(x: number, y: number): [number, number];
  /** Plot area in viewBox units. */
  box: { x: number; y: number; w: number; h: number };
  under: string;
  over: string;
};

function backgroundRect(spec: ChartSpec, b: Frame["box"], turfPreset?: string): string {
  const bg = spec.style?.background;
  if (bg) return `<rect class="op-bg" x="${r1(b.x)}" y="${r1(b.y)}" width="${r1(b.w)}" height="${r1(b.h)}" fill="${bg}"/>`;
  if (turfPreset) return `<rect class="op-bg op-turf op-turf-${turfPreset}" x="${r1(b.x)}" y="${r1(b.y)}" width="${r1(b.w)}" height="${r1(b.h)}"/>`;
  return "";
}

/** A field preset, or linear axes fitted to the data (with optional fixed min/max). */
function frameFor(spec: ChartSpec, W: number, xs: number[], ys: number[], fmtX: (v: number) => string, fmtY: (v: number) => string): Frame {
  if (spec.field) {
    const f = fieldFrame(spec.field, W);
    const [ax, ay] = f.project(f.domain.x0, f.domain.y1);
    const [bx, by] = f.project(f.domain.x1, f.domain.y0);
    const box = { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
    const turf = spec.field.look === "turf" ? spec.field.preset : undefined;
    // Markings are clipped like the marks: a half-court view must not draw the other half.
    return { W, H: f.H, px: f.project, box, under: backgroundRect(spec, box, turf), over: clip({ x: box.x - 2, y: box.y - 2, w: box.w + 4, h: box.h + 4 }, fieldMarkingsSvg(spec.field, f)) };
  }
  const lo = (a: number[]) => (a.length ? Math.min(...a) : 0);
  const hi = (a: number[]) => (a.length ? Math.max(...a) : 1);
  const lines = spec.annotations?.lines ?? [];
  const xLines = lines.filter((l) => l.axis === "x").map((l) => l.value);
  const yLines = lines.filter((l) => l.axis === "y").map((l) => l.value);
  const xd = niceDomain(lo([...xs, ...xLines]), hi([...xs, ...xLines]), { min: spec.xAxis?.min, max: spec.xAxis?.max, ticks: W < 480 ? 3 : 5 });
  const yd = niceDomain(lo([...ys, ...yLines]), hi([...ys, ...yLines]), { min: spec.yAxis?.min, max: spec.yAxis?.max });
  const yText = yd.ticks.map(fmtY);
  const yTitle = spec.yAxis?.title;
  const xTitle = spec.xAxis?.title;
  const left = Math.ceil(Math.max(...yText.map((t) => t.length)) * TICK_CHAR + 16 + (yTitle ? 18 : 0));
  const top = 12;
  const right = 16;
  const H = Math.round(Math.min(420, Math.max(240, W * 0.62)));
  const bottom = 26 + (xTitle ? 20 : 0);
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const px = (x: number, y: number): [number, number] => [left + ((x - xd.min) / (xd.max - xd.min)) * plotW, top + plotH - ((y - yd.min) / (yd.max - yd.min)) * plotH];
  const box = { x: left, y: top, w: plotW, h: plotH };
  const a: string[] = [`<g class="op-axis" aria-hidden="true">`];
  yd.ticks.forEach((t, k) => {
    const y = r1(px(0, t)[1]);
    a.push(`<line class="op-grid" x1="${left}" x2="${W - right}" y1="${y}" y2="${y}"/>`, `<text x="${left - 8}" y="${y}" dy="0.32em" text-anchor="end">${esc(yText[k])}</text>`);
  });
  xd.ticks.forEach((t) => {
    const x = r1(px(t, 0)[0]);
    a.push(`<line class="op-grid" x1="${x}" x2="${x}" y1="${top}" y2="${top + plotH}"/>`, `<text x="${x}" y="${top + plotH + 18}" text-anchor="middle">${esc(fmtX(t))}</text>`);
  });
  a.push(`<line class="op-base" x1="${left}" x2="${W - right}" y1="${top + plotH}" y2="${top + plotH}"/>`);
  if (yTitle) a.push(`<text class="op-axis-title" transform="translate(12 ${r1(top + plotH / 2)}) rotate(-90)" text-anchor="middle">${esc(yTitle)}</text>`);
  if (xTitle) a.push(`<text class="op-axis-title" x="${r1(left + plotW / 2)}" y="${H - 4}" text-anchor="middle">${esc(xTitle)}</text>`);
  a.push(`</g>`);
  const ref: string[] = [];
  for (const l of lines) {
    const [x, y] = px(l.value, l.value);
    if (l.axis === "x") ref.push(`<line class="op-ref" x1="${r1(x)}" x2="${r1(x)}" y1="${top}" y2="${top + plotH}"/>${l.label ? `<text class="op-ref-label" x="${r1(x + 4)}" y="${top + 10}">${esc(l.label)}</text>` : ""}`);
    else ref.push(`<line class="op-ref" x1="${left}" x2="${W - right}" y1="${r1(y)}" y2="${r1(y)}"/>${l.label ? `<text class="op-ref-label" x="${W - right}" y="${r1(y - 5)}" text-anchor="end">${esc(l.label)}</text>` : ""}`);
  }
  return { W, H, px, box, under: backgroundRect(spec, box) + a.join(""), over: ref.length ? `<g class="op-refs" aria-hidden="true">${ref.join("")}</g>` : "" };
}

/** Clip marks to the plot area without ids (a nested <svg> clips to its viewport). */
const clip = (b: Frame["box"], inner: string) => `<svg x="${r1(b.x)}" y="${r1(b.y)}" width="${r1(b.w)}" height="${r1(b.h)}" viewBox="${r1(b.x)} ${r1(b.y)} ${r1(b.w)} ${r1(b.h)}" overflow="hidden">${inner}</svg>`;

const open = (W: number, H: number, label: string) => `<svg class="op-plot" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${label}">`;

function axisFormatter(spec: ChartSpec, field: "x" | "y") {
  const ds = spec.dataset;
  const name = field === "x" ? spec.encoding?.x : typeof spec.encoding?.y === "string" ? spec.encoding.y : spec.encoding?.y?.[0];
  const f = ds?.fields[fieldIndex(ds, name)];
  const fmt = f?.format ?? (field === "y" ? spec.valueFormat : undefined);
  return { field: f, fmt: (v: number) => formatValue(fmt ? { prefix: fmt.prefix, suffix: fmt.suffix } : undefined, v, { compact: true }), full: (v: number) => formatValue(fmt, v) };
}

function extraTipRows(spec: ChartSpec, row: Point["row"], skip: Set<number>): TipRow[] {
  const ds = spec.dataset;
  if (!ds) return [];
  return (spec.style?.tooltip?.fields ?? [])
    .map((n) => fieldIndex(ds, n))
    .filter((i) => i >= 0 && !skip.has(i))
    .map((i) => ({ value: formatCell(ds.fields[i], row[i]), name: fieldLabel(ds.fields[i]) }));
}

// ---------- Scatter ----------

export function scatterPlot(view: View, W: number, ariaLabel: string, hidden?: ReadonlySet<number>): Plot {
  const spec = view.spec;
  const { points, seriesNames } = pointsOf(spec, view.rows);
  const xf = axisFormatter(spec, "x");
  const yf = axisFormatter(spec, "y");
  const frame = frameFor(spec, W, points.map((p) => p.x), points.map((p) => p.y), xf.fmt, yf.fmt);
  const ds = spec.dataset!;
  const enc = spec.encoding ?? {};
  const sizes = points.map((p) => p.size).filter((v): v is number => v !== null);
  const zmin = Math.min(...sizes);
  const zmax = Math.max(...sizes);
  const base = spec.style?.markSize ?? (points.length > 500 ? 3 : 4.5);
  const radius = (p: Point) => (p.size === null || !sizes.length ? base : base * 0.6 + base * 2 * Math.sqrt((p.size - zmin) / (zmax - zmin || 1)));
  const colorScale: ColorScale | null = fieldIndex(ds, enc.color) >= 0 ? buildColorScale(spec.style?.colorScale, points.map((p) => p.color).filter((v): v is number => v !== null)) : null;
  const opacity = spec.style?.opacity ?? (points.length > 300 ? 0.6 : 0.85);
  const shown = points.map((p, i) => ({ p, i })).filter(({ p }) => !hidden?.has(p.s));
  // Big marks first so small ones stay hoverable on top.
  shown.sort((a, b) => radius(b.p) - radius(a.p));
  const items: PlotItem[] = [];
  const marks: string[] = [];
  const labels: string[] = [];
  for (const { p, i } of shown) {
    const [x, y] = frame.px(p.x, p.y);
    const fill = colorScale && p.color !== null ? ` style="fill:${colorScale.paint(p.color).fill}"` : colorStyle(spec.style?.colors, p.s);
    marks.push(`<circle class="op-pt op-c${p.s}" data-i="${i}" cx="${r1(x)}" cy="${r1(y)}" r="${r1(radius(p))}"${fill}/>`);
    items.push({ i, x: r1(x), y: r1(y) });
    if (spec.style?.showLabels && p.label && labels.length < 60) labels.push(`<text class="op-pt-label" x="${r1(x + radius(p) + 3)}" y="${r1(y)}" dy="0.32em">${esc(truncate(p.label, 24))}</text>`);
  }
  const svg = [
    open(frame.W, frame.H, ariaLabel),
    spec.field ? frame.under + frame.over : frame.under,
    clip(frame.box, `<g class="op-marks" style="--op-pt-opacity:${opacity}">${marks.join("")}</g>`),
    spec.field ? "" : frame.over,
    labels.length ? `<g class="op-pt-labels" aria-hidden="true">${labels.join("")}</g>` : "",
    `</svg>`,
  ].join("");
  const xi = fieldIndex(ds, enc.x);
  const yi = fieldIndex(ds, typeof enc.y === "string" ? enc.y : enc.y?.[0]);
  const used = new Set([xi, yi, fieldIndex(ds, enc.series), fieldIndex(ds, enc.label), fieldIndex(ds, enc.size), fieldIndex(ds, enc.color)]);
  const tip = (i: number): Tip => {
    const p = points[i];
    const rows: TipRow[] = [];
    const swatch = colorScale && p.color !== null ? { color: colorScale.paint(p.color).fill } : { cls: `op-c${p.s}`, color: spec.style?.colors?.[p.s] };
    rows.push({ ...swatch, value: `${xf.full(p.x)}, ${yf.full(p.y)}`, name: `${fieldLabel(ds.fields[xi])}, ${fieldLabel(ds.fields[yi])}` });
    for (const [key, v] of [["size", p.size], ["color", p.color]] as const) {
      const fi = fieldIndex(ds, enc[key]);
      if (fi >= 0 && v !== null) rows.push({ value: formatCell(ds.fields[fi], v), name: fieldLabel(ds.fields[fi]) });
    }
    rows.push(...extraTipRows(spec, p.row, used));
    const head = [p.label, seriesNames.length > 1 || (seriesNames.length && !p.label) ? seriesNames[p.s] : null].filter(Boolean).join(" · ");
    return { head, rows };
  };
  return { svg, W: frame.W, H: frame.H, mode: "point", items, tip };
}

// ---------- Categorical heatmap ----------

export function heatmapPlot(view: View, W: number, ariaLabel: string): Plot {
  const spec = view.spec;
  const cols = spec.labels;
  const rows = spec.series;
  const fmt = spec.valueFormat;
  const scale = buildColorScale(spec.style?.colorScale, rows.flatMap((r) => r.data.filter((v): v is number => v !== null)));
  const xTitle = spec.xAxis?.title;
  const longest = Math.min(22, Math.max(1, ...rows.map((r) => r.name.length)));
  const left = Math.ceil(longest * 6.6 + 14);
  const right = 8;
  const top = 6;
  const bottom = 26 + (xTitle ? 20 : 0);
  const plotW = Math.max(40, W - left - right);
  const cw = plotW / Math.max(1, cols.length);
  const ch = Math.min(40, Math.max(18, cw * 0.75));
  const H = Math.round(top + ch * rows.length + bottom);
  const gap = cw > 8 ? 1.5 : 0.5;
  const out: string[] = [open(W, H, ariaLabel), `<g class="op-axis" aria-hidden="true">`];
  rows.forEach((r, k) => out.push(`<text x="${left - 8}" y="${r1(top + (k + 0.5) * ch)}" dy="0.32em" text-anchor="end">${esc(truncate(r.name, 22))}</text>`));
  const maxLen = Math.min(14, Math.max(1, ...cols.map((l) => l.length)));
  const every = Math.max(1, Math.ceil((maxLen * 6.6 + 8) / cw));
  cols.forEach((l, c) => {
    if (c % every === 0) out.push(`<text x="${r1(left + (c + 0.5) * cw)}" y="${r1(top + rows.length * ch + 18)}" text-anchor="middle">${esc(truncate(l, 14))}</text>`);
  });
  if (xTitle) out.push(`<text class="op-axis-title" x="${r1(left + plotW / 2)}" y="${H - 4}" text-anchor="middle">${esc(xTitle)}</text>`);
  out.push(`</g>`);
  if (spec.style?.background) out.push(backgroundRect(spec, { x: left, y: top, w: plotW, h: ch * rows.length }));
  const items: PlotItem[] = [];
  const cells: string[] = [];
  const texts: string[] = [];
  const showValues = spec.style?.showValues ?? (cw >= 34 && cols.length * rows.length <= 120);
  rows.forEach((r, k) =>
    r.data.forEach((v, c) => {
      const i = k * cols.length + c;
      const x = left + c * cw;
      const y = top + k * ch;
      if (v === null) {
        cells.push(`<rect class="op-cell op-cell-empty" x="${r1(x + gap / 2)}" y="${r1(y + gap / 2)}" width="${r1(cw - gap)}" height="${r1(ch - gap)}"/>`);
        return;
      }
      const paint = scale.paint(v);
      cells.push(`<rect class="op-cell" data-i="${i}" x="${r1(x + gap / 2)}" y="${r1(y + gap / 2)}" width="${r1(cw - gap)}" height="${r1(ch - gap)}" rx="${cw > 12 ? 2 : 0}" style="fill:${paint.fill}"/>`);
      items.push({ i, x: r1(x + cw / 2), y: r1(y + ch / 2) });
      if (showValues && cw >= 26 && ch >= 16) texts.push(`<text class="op-cell-v op-ink-${paint.ink}" x="${r1(x + cw / 2)}" y="${r1(y + ch / 2)}" dy="0.32em" text-anchor="middle">${esc(formatValue(fmt, v, { compact: true }))}</text>`);
    }),
  );
  out.push(`<g class="op-marks">${cells.join("")}</g>`);
  if (texts.length) out.push(`<g class="op-cell-values" aria-hidden="true">${texts.join("")}</g>`);
  out.push(`</svg>`);
  const tip = (i: number): Tip => {
    const k = Math.floor(i / cols.length);
    const c = i % cols.length;
    const v = rows[k]?.data[c] ?? null;
    return { head: `${rows[k]?.name ?? ""} · ${cols[c] ?? ""}`, rows: [{ color: v === null ? undefined : scale.paint(v).fill, value: formatValue(fmt, v), name: spec.style?.legend?.title ?? "" }] };
  };
  return { svg: out.join(""), W, H, mode: "cell", items, tip };
}

// ---------- Spatial heatmap ----------

export type Bin = { col: number; row: number; x0: number; x1: number; y0: number; y1: number; n: number; sum: number; value: number };

export function spatialBins(spec: ChartSpec, points: Point[]) {
  const d = spec.field
    ? (spec.field.variant === "half" && FIELDS[spec.field.preset].half) || FIELDS[spec.field.preset].full
    : (() => {
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        const x = niceDomain(xs.length ? Math.min(...xs) : 0, xs.length ? Math.max(...xs) : 1, { min: spec.xAxis?.min, max: spec.xAxis?.max });
        const y = niceDomain(ys.length ? Math.min(...ys) : 0, ys.length ? Math.max(...ys) : 1, { min: spec.yAxis?.min, max: spec.yAxis?.max });
        return { x0: x.min, x1: x.max, y0: y.min, y1: y.max };
      })();
  const size = spec.spatial?.binSize ?? niceStep((d.x1 - d.x0) / 32);
  const nc = Math.max(1, Math.min(200, Math.ceil((d.x1 - d.x0) / size - 1e-9)));
  const nr = Math.max(1, Math.min(200, Math.ceil((d.y1 - d.y0) / size - 1e-9)));
  const hasWeight = points.some((p) => p.weight !== null);
  const how = spec.spatial?.aggregate ?? (spec.encoding?.value ? "sum" : "count");
  const n = new Float64Array(nc * nr);
  const sum = new Float64Array(nc * nr);
  for (const p of points) {
    if (p.x < d.x0 || p.x > d.x1 || p.y < d.y0 || p.y > d.y1) continue;
    const c = Math.min(nc - 1, Math.floor((p.x - d.x0) / size));
    const r = Math.min(nr - 1, Math.floor((p.y - d.y0) / size));
    n[r * nc + c] += 1;
    sum[r * nc + c] += p.weight ?? 1;
  }
  const valueOf = (nn: number, ss: number) => (how === "count" ? nn : how === "sum" ? ss : nn ? ss / nn : 0);
  // Optional Gaussian smoothing (in bins) for a continuous surface. Means smooth
  // numerator and denominator separately, i.e. a kernel-weighted mean.
  const sigma = spec.spatial?.smoothing ?? (how === "mean" ? 0 : 1);
  let sn = n;
  let ss = sum;
  if (sigma > 0) {
    const rad = Math.ceil(sigma * 2);
    // Normalized, so smoothed values stay in "per bin" units (legend matches the table).
    const raw = Array.from({ length: 2 * rad + 1 }, (_, k) => Math.exp(-((k - rad) ** 2) / (2 * sigma * sigma)));
    const total = raw.reduce((a, b) => a + b, 0);
    const kern = raw.map((k) => k / total);
    const blur = (src: Float64Array) => {
      const tmp = new Float64Array(src.length);
      const dst = new Float64Array(src.length);
      for (let r = 0; r < nr; r++)
        for (let c = 0; c < nc; c++) {
          let a = 0;
          for (let k = -rad; k <= rad; k++) if (c + k >= 0 && c + k < nc) a += src[r * nc + c + k] * kern[k + rad];
          tmp[r * nc + c] = a;
        }
      for (let r = 0; r < nr; r++)
        for (let c = 0; c < nc; c++) {
          let a = 0;
          for (let k = -rad; k <= rad; k++) if (r + k >= 0 && r + k < nr) a += tmp[(r + k) * nc + c] * kern[k + rad];
          dst[r * nc + c] = a;
        }
      return dst;
    };
    sn = blur(n);
    ss = blur(sum);
  }
  const bins: Bin[] = [];
  const surface: { col: number; row: number; v: number }[] = [];
  for (let r = 0; r < nr; r++)
    for (let c = 0; c < nc; c++) {
      const k = r * nc + c;
      const sv = valueOf(sn[k], ss[k]);
      if (sv > 0 || (how === "mean" && sn[k] > 0)) surface.push({ col: c, row: r, v: sv });
      if (n[k] > 0) bins.push({ col: c, row: r, x0: d.x0 + c * size, x1: Math.min(d.x1, d.x0 + (c + 1) * size), y0: d.y0 + r * size, y1: Math.min(d.y1, d.y0 + (r + 1) * size), n: n[k], sum: sum[k], value: valueOf(n[k], sum[k]) });
    }
  return { domain: d, size, nc, nr, how, bins, surface, hasWeight };
}

export function spatialPlot(view: View, W: number, ariaLabel: string): Plot {
  const spec = view.spec;
  const { points } = pointsOf(spec, view.rows);
  const grid = spatialBins(spec, points);
  const xf = axisFormatter(spec, "x");
  const yf = axisFormatter(spec, "y");
  const d = grid.domain;
  const frame = frameFor(spec, W, [d.x0, d.x1], [d.y0, d.y1], xf.fmt, yf.fmt);
  const max = Math.max(0, ...grid.surface.map((s) => s.v));
  const cutoff = grid.how === "mean" ? -Infinity : max * 0.05;
  const values = grid.surface.filter((s) => s.v > cutoff).map((s) => s.v);
  const scale = buildColorScale(spec.style?.colorScale ?? { scheme: "heat" }, grid.how === "mean" ? values : [0, ...values]);
  const fmt = spec.valueFormat;
  const rect = (c: number, r: number) => {
    const [ax, ay] = frame.px(d.x0 + c * grid.size, d.y0 + r * grid.size);
    const [bx, by] = frame.px(Math.min(d.x1, d.x0 + (c + 1) * grid.size), Math.min(d.y1, d.y0 + (r + 1) * grid.size));
    return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
  };
  const heat: string[] = [];
  const baseOpacity = spec.style?.opacity;
  for (const s of grid.surface) {
    if (s.v <= cutoff) continue;
    const b = rect(s.col, s.row);
    const t = scale.t(s.v);
    // Density fades toward transparent so sparse areas don't paint over the field.
    const op = baseOpacity ?? (grid.how === "mean" ? 0.85 : 0.12 + 0.78 * t);
    heat.push(`<rect x="${r1(b.x)}" y="${r1(b.y)}" width="${r1(b.w + 0.4)}" height="${r1(b.h + 0.4)}" style="fill:${scale.paint(s.v).fill}" fill-opacity="${r1(op * 100) / 100}"/>`);
  }
  // Invisible hit areas only where there is real (unsmoothed) data.
  const items: PlotItem[] = [];
  const hits = grid.bins.map((b, i) => {
    const r = rect(b.col, b.row);
    items.push({ i, x: r1(r.x + r.w / 2), y: r1(r.y + r.h / 2) });
    return `<rect class="op-bin" data-i="${i}" x="${r1(r.x)}" y="${r1(r.y)}" width="${r1(r.w)}" height="${r1(r.h)}"/>`;
  });
  const svg = [
    open(frame.W, frame.H, ariaLabel),
    frame.under,
    clip(frame.box, `<g class="op-heat">${heat.join("")}</g>`),
    frame.over,
    `<g class="op-marks">${hits.join("")}</g>`,
    `</svg>`,
  ].join("");
  const units = spec.field ? ` ${FIELDS[spec.field.preset].units}` : "";
  const valueName = grid.how === "count" ? "records" : (spec.style?.legend?.title ?? (grid.how === "mean" ? "average" : "total"));
  const tip = (i: number): Tip => {
    const b = grid.bins[i];
    const rows: TipRow[] = [{ color: scale.paint(b.value).fill, value: grid.how === "count" ? String(b.n) : formatValue(fmt, b.value), name: valueName }];
    if (grid.how !== "count") rows.push({ value: String(b.n), name: "records" });
    return { head: `x ${xf.full(r1(b.x0))}–${xf.full(r1(b.x1))}, y ${yf.full(r1(b.y0))}–${yf.full(r1(b.y1))}${units}`, rows };
  };
  return { svg, W: frame.W, H: frame.H, mode: "cell", items, tip };
}

/** Values the color legend should span, matching what the plot paints. */
export function scaleValues(view: View): { values: number[]; scheme: ChartSpec["style"] } | null {
  const spec = view.spec;
  if (spec.type === "heatmap") return { values: spec.series.flatMap((r) => r.data.filter((v): v is number => v !== null)), scheme: spec.style };
  if (spec.type === "spatial_heatmap") {
    const grid = spatialBins(spec, pointsOf(spec, view.rows).points);
    const max = Math.max(0, ...grid.surface.map((s) => s.v));
    const vals = grid.surface.map((s) => s.v).filter((v) => grid.how === "mean" || v > max * 0.05);
    return { values: grid.how === "mean" ? vals : [0, ...vals], scheme: { ...spec.style, colorScale: spec.style?.colorScale ?? { scheme: "heat" } } };
  }
  if (spec.type === "scatter" && spec.dataset && fieldIndex(spec.dataset, spec.encoding?.color) >= 0) {
    return { values: pointsOf(spec, view.rows).points.map((p) => p.color).filter((v): v is number => v !== null), scheme: spec.style };
  }
  return null;
}
