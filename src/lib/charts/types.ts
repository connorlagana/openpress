// Chart spec types. The Zod schema in spec.ts is the source of validation;
// these hand-written types are kept in lockstep with it (see the check there)
// so the renderer can be imported on the client without pulling in Zod.
//
// Versions: v1 (no `version` key) = line/area/bar/pie/donut from labels+series.
// v2 is a strict superset: row datasets + encodings, filters, styling, scatter
// and heatmaps, field presets. Every v1 spec is a valid v2 spec unchanged.

export const CHART_SCHEMA_VERSION = 2;
export const MAX_SERIES = 8;

export const LEGACY_TYPES = ["line", "area", "bar", "pie", "donut"] as const;
export const CHART_TYPES = [...LEGACY_TYPES, "scatter", "heatmap", "spatial_heatmap"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export type ValueFormat = { prefix?: string; suffix?: string; decimals?: number };

export type FieldType = "number" | "string" | "date";
export type Cell = string | number | null;
export type DatasetField = { name: string; type: FieldType; label?: string; format?: ValueFormat };
export type Dataset = { fields: DatasetField[]; rows: Cell[][] };

export type Aggregate = "sum" | "mean" | "count" | "min" | "max" | "last";
export type Encoding = {
  x?: string;
  y?: string | string[];
  series?: string;
  value?: string;
  size?: string;
  color?: string;
  label?: string;
  aggregate?: Aggregate;
};

export type FilterDefault = string | number | (string | number)[] | { min?: string | number; max?: string | number };
export type Filter = {
  field: string;
  label?: string;
  control?: "select" | "buttons" | "range";
  allowAll?: boolean;
  default?: FilterDefault;
};

export const SEQUENTIAL_SCHEMES = ["blues", "greens", "oranges", "reds", "purples", "greys", "heat", "viridis", "magma", "cividis"] as const;
export const DIVERGING_SCHEMES = ["redBlue", "brownTeal", "purpleGreen"] as const;
export type SchemeName = "theme" | (typeof SEQUENTIAL_SCHEMES)[number] | (typeof DIVERGING_SCHEMES)[number];
export type ColorScaleSpec = {
  scheme?: SchemeName;
  colors?: string[];
  domain?: number[];
  reverse?: boolean;
  steps?: number;
};

export type ChartStyle = {
  colors?: string[];
  colorScale?: ColorScaleSpec;
  background?: string;
  legend?: { show?: boolean; position?: "top" | "bottom"; title?: string };
  tooltip?: { show?: boolean; fields?: string[] };
  markSize?: number;
  opacity?: number;
  showValues?: boolean;
  showLabels?: boolean;
};

export const FIELD_PRESETS = ["football", "basketball", "soccer", "baseball"] as const;
export type FieldPreset = (typeof FIELD_PRESETS)[number];
export type FieldSpec = {
  preset: FieldPreset;
  variant?: "full" | "half";
  orientation?: "auto" | "horizontal" | "vertical";
  look?: "minimal" | "turf";
};

export type SpatialSpec = { binSize?: number; aggregate?: "count" | "sum" | "mean"; smoothing?: number };
export type ReferenceLine = { axis: "x" | "y"; value: number; label?: string };

export type ChartSpec = {
  version?: 1 | 2;
  type: ChartType;
  title: string;
  subtitle?: string;
  source?: string;
  description?: string;
  labels?: string[];
  series?: { name: string; data: (number | null)[] }[];
  dataset?: Dataset;
  encoding?: Encoding;
  filters?: Filter[];
  stacked?: boolean;
  xAxis?: { title?: string; min?: number; max?: number };
  yAxis?: { title?: string; min?: number; max?: number };
  valueFormat?: ValueFormat;
  style?: ChartStyle;
  field?: FieldSpec;
  spatial?: SpatialSpec;
  annotations?: { lines?: ReferenceLine[] };
};

/** A spec whose labels/series are filled in (from inline data or the filtered dataset). */
export type ResolvedSpec = ChartSpec & { labels: string[]; series: { name: string; data: (number | null)[] }[] };

export const isRound = (s: Pick<ChartSpec, "type">) => s.type === "pie" || s.type === "donut";
export const isCartesian = (s: Pick<ChartSpec, "type">) => s.type === "line" || s.type === "area" || s.type === "bar";

/** One interactive mark (or band) in viewBox coordinates, for tooltips and keyboard focus. */
export type PlotItem = { i: number; x: number; y: number };
export type TipRow = { cls?: string; color?: string; value: string; name: string };
export type Tip = { head: string; rows: TipRow[] };
export type Plot = {
  svg: string;
  W: number;
  H: number;
  /** band: one item per x label (crosshair); slice/cell/point: one per mark. */
  mode: "band" | "slice" | "cell" | "point";
  items: PlotItem[];
  tip(i: number): Tip;
};
