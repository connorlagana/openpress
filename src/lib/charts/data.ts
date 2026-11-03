// Row datasets → what the renderers draw. Pure and shared by the server render
// and the client enhancer, so filtering in the browser produces exactly what
// the server would have drawn for that filter state.

import { formatValue } from "./format";
import { MAX_SERIES, isRound, type Aggregate, type Cell, type ChartSpec, type Dataset, type DatasetField, type Filter, type ResolvedSpec } from "./types";

export const MAX_HEATMAP_ROWS = 60;
export const MAX_CATEGORIES = 200;

export type FilterValue = { kind: "set"; values: Cell[] | null } | { kind: "range"; min?: number | string; max?: number | string };
export type FilterState = FilterValue[];

export const fieldIndex = (ds: Dataset, name: string | undefined) => (name === undefined ? -1 : ds.fields.findIndex((f) => f.name === name));
export const fieldLabel = (f: DatasetField) => f.label ?? f.name;

/** Distinct non-null values of a column: numbers and dates ascending, strings in order of appearance. */
export function distinctValues(ds: Dataset, col: number): Cell[] {
  const seen = new Set<Cell>();
  for (const r of ds.rows) if (r[col] !== null && r[col] !== undefined) seen.add(r[col]);
  const vals = [...seen];
  const t = ds.fields[col]?.type;
  if (t === "number") vals.sort((a, b) => (a as number) - (b as number));
  else if (t === "date") vals.sort((a, b) => String(a).localeCompare(String(b)));
  return vals;
}

export function filterControl(f: Filter, field: DatasetField | undefined): "select" | "buttons" | "range" {
  return f.control ?? (field?.type === "date" ? "range" : "select");
}

export function defaultFilterState(spec: ChartSpec): FilterState {
  const ds = spec.dataset;
  return (spec.filters ?? []).map((f) => {
    const col = ds ? fieldIndex(ds, f.field) : -1;
    const control = filterControl(f, ds?.fields[col]);
    const d = f.default;
    if (control === "range") {
      const r = d && typeof d === "object" && !Array.isArray(d) ? d : {};
      return { kind: "range", min: r.min, max: r.max };
    }
    if (d !== undefined && (typeof d !== "object" || Array.isArray(d))) return { kind: "set", values: Array.isArray(d) ? d : [d] };
    if (f.allowAll === false && ds && col >= 0) {
      const first = distinctValues(ds, col)[0];
      return { kind: "set", values: first === undefined ? null : control === "buttons" ? distinctValues(ds, col) : [first] };
    }
    return { kind: "set", values: null };
  });
}

const cmp = (a: Cell, b: number | string) => (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b)));

export function applyFilters(spec: ChartSpec, state: FilterState): Cell[][] {
  const ds = spec.dataset;
  if (!ds) return [];
  const tests = (spec.filters ?? []).map((f, i) => {
    const col = fieldIndex(ds, f.field);
    const v = state[i];
    if (col < 0 || !v) return null;
    if (v.kind === "set") {
      if (!v.values) return null;
      const set = new Set(v.values);
      return (r: Cell[]) => set.has(r[col]);
    }
    if (v.min === undefined && v.max === undefined) return null;
    // Dates compare on the bound's precision: max "2024-09-08" includes that whole day.
    const isDate = ds.fields[col].type === "date";
    const c = (cellV: Cell, b: number | string) => cmp(isDate && typeof cellV === "string" ? cellV.slice(0, String(b).length) : cellV, b);
    return (r: Cell[]) => r[col] !== null && (v.min === undefined || c(r[col], v.min) >= 0) && (v.max === undefined || c(r[col], v.max) <= 0);
  });
  const active = tests.filter((t): t is (r: Cell[]) => boolean => t !== null);
  return active.length ? ds.rows.filter((r) => active.every((t) => t(r))) : ds.rows;
}

function aggregate(values: number[], how: Aggregate, count: number): number | null {
  if (how === "count") return count;
  if (!values.length) return null;
  switch (how) {
    case "mean":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    case "last":
      return values[values.length - 1];
    default:
      return values.reduce((a, b) => a + b, 0);
  }
}

export const cellText = (v: Cell) => (v === null ? "–" : String(v));

export function formatCell(field: DatasetField | undefined, v: Cell): string {
  if (typeof v === "number") return formatValue(field?.format, v);
  return cellText(v);
}

export type View = {
  spec: ResolvedSpec;
  rows: Cell[][];
  /** Rows before filtering (0 when there is no dataset). */
  total: number;
  note?: string;
};

/**
 * Resolve labels/series for the current filter state. Inline (v1) specs pass
 * through untouched. Scatter and spatial heatmaps keep empty labels/series and
 * read `rows` directly.
 */
export function resolveView(spec: ChartSpec, state: FilterState = defaultFilterState(spec)): View {
  const ds = spec.dataset;
  if (!ds) return { spec: { ...spec, labels: spec.labels ?? [], series: spec.series ?? [] }, rows: [], total: 0 };
  const rows = applyFilters(spec, state);
  if (spec.type === "scatter" || spec.type === "spatial_heatmap") return { spec: { ...spec, labels: [], series: [] }, rows, total: ds.rows.length };

  const enc = spec.encoding ?? {};
  const xCol = fieldIndex(ds, enc.x);
  const how: Aggregate = enc.aggregate ?? "sum";
  const heat = spec.type === "heatmap";
  const yNames = heat ? [] : Array.isArray(enc.y) ? enc.y : enc.y ? [enc.y] : [];
  const sCol = heat ? fieldIndex(ds, typeof enc.y === "string" ? enc.y : undefined) : fieldIndex(ds, enc.series);
  const vCol = heat ? fieldIndex(ds, enc.value) : fieldIndex(ds, yNames[0]);

  const xKeys: Cell[] = [];
  const xSeen = new Set<Cell>();
  for (const r of rows) {
    if (r[xCol] === null || xSeen.has(r[xCol])) continue;
    xSeen.add(r[xCol]);
    xKeys.push(r[xCol]);
  }
  const xType = ds.fields[xCol]?.type;
  if (xType === "number") xKeys.sort((a, b) => (a as number) - (b as number));
  else if (xType === "date") xKeys.sort((a, b) => String(a).localeCompare(String(b)));
  const xPos = new Map(xKeys.map((k, i) => [k, i]));
  const labels = xKeys.map((k) => cellText(k).slice(0, 40));

  type Acc = { vals: number[]; n: number };
  const grid = (nSeries: number) => Array.from({ length: nSeries }, () => xKeys.map((): Acc => ({ vals: [], n: 0 })));
  let names: string[];
  let acc: Acc[][];
  if (sCol >= 0) {
    const keys: Cell[] = [];
    const seen = new Map<Cell, number>();
    for (const r of rows) {
      if (r[sCol] === null || seen.has(r[sCol])) continue;
      seen.set(r[sCol], keys.length);
      keys.push(r[sCol]);
    }
    if (ds.fields[sCol]?.type !== "string") {
      keys.sort((a, b) => cmp(a, b as number | string));
      keys.forEach((k, i) => seen.set(k, i));
    }
    names = keys.map((k) => cellText(k).slice(0, 60));
    acc = grid(keys.length);
    for (const r of rows) {
      const i = xPos.get(r[xCol]);
      const s = seen.get(r[sCol]);
      if (i === undefined || s === undefined) continue;
      const cell = acc[s][i];
      cell.n++;
      if (typeof r[vCol] === "number") cell.vals.push(r[vCol] as number);
    }
  } else {
    // No value field (aggregate "count"): one series counting rows per x.
    const cols = heat ? [vCol] : yNames.length ? yNames.map((n) => fieldIndex(ds, n)) : [-1];
    names = heat ? [fieldLabel(ds.fields[vCol] ?? { name: "Count", type: "number" })] : cols.map((c) => (c >= 0 ? fieldLabel(ds.fields[c]) : "Count"));
    acc = grid(cols.length);
    for (const r of rows) {
      const i = xPos.get(r[xCol]);
      if (i === undefined) continue;
      cols.forEach((c, s) => {
        const cell = acc[s][i];
        cell.n++;
        if (c >= 0 && typeof r[c] === "number") cell.vals.push(r[c] as number);
      });
    }
  }
  let series = names.map((name, s) => ({ name, data: acc[s].map((c) => (c.n ? aggregate(c.vals, how, c.n) : null)) }));
  let note: string | undefined;
  const cap = heat ? MAX_HEATMAP_ROWS : isRound(spec) ? 1 : MAX_SERIES;
  if (series.length > cap) {
    note = `Showing the first ${cap} of ${series.length} ${heat ? "rows" : "series"}. Use a filter to see the rest.`;
    series = series.slice(0, cap);
  }
  if (isRound(spec) && labels.length > MAX_SERIES) note = `Showing the first ${MAX_SERIES} of ${labels.length} slices.`;
  const resolved: ResolvedSpec = {
    ...spec,
    labels: isRound(spec) ? labels.slice(0, MAX_SERIES) : labels,
    series: isRound(spec) ? series.map((s) => ({ ...s, data: s.data.slice(0, MAX_SERIES) })) : series,
  };
  if (!resolved.valueFormat && vCol >= 0 && ds.fields[vCol]?.format) resolved.valueFormat = ds.fields[vCol].format;
  if (!resolved.xAxis?.title && xCol >= 0 && !heat) resolved.xAxis = { ...resolved.xAxis, title: resolved.xAxis?.title ?? fieldLabel(ds.fields[xCol]) };
  return { spec: resolved, rows, total: ds.rows.length, note };
}

// ---------- Points (scatter, spatial heatmap) ----------

export type Point = { x: number; y: number; s: number; size: number | null; color: number | null; label: string | null; weight: number | null; row: Cell[] };

export function pointsOf(spec: ChartSpec, rows: Cell[][]): { points: Point[]; seriesNames: string[] } {
  const ds = spec.dataset;
  if (!ds) return { points: [], seriesNames: [] };
  const enc = spec.encoding ?? {};
  const xi = fieldIndex(ds, enc.x);
  const yi = fieldIndex(ds, typeof enc.y === "string" ? enc.y : enc.y?.[0]);
  const si = fieldIndex(ds, enc.series);
  const zi = fieldIndex(ds, enc.size);
  const ci = fieldIndex(ds, enc.color);
  const li = fieldIndex(ds, enc.label);
  const vi = fieldIndex(ds, enc.value);
  const seriesKeys = si >= 0 ? distinctValues({ ...ds, rows }, si) : [];
  const sPos = new Map(seriesKeys.map((k, i) => [k, i]));
  const points: Point[] = [];
  for (const r of rows) {
    const x = r[xi];
    const y = r[yi];
    if (typeof x !== "number" || typeof y !== "number") continue;
    const num = (i: number) => (i >= 0 && typeof r[i] === "number" ? (r[i] as number) : null);
    points.push({ x, y, s: si >= 0 ? Math.min(sPos.get(r[si]) ?? MAX_SERIES - 1, MAX_SERIES - 1) : 0, size: num(zi), color: num(ci), label: li >= 0 && r[li] !== null ? String(r[li]) : null, weight: num(vi), row: r });
  }
  return { points, seriesNames: seriesKeys.slice(0, MAX_SERIES).map((k, i) => (i === MAX_SERIES - 1 && seriesKeys.length > MAX_SERIES ? "Other" : cellText(k))) };
}
