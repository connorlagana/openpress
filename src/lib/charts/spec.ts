import { z } from "zod";
import { HEX_RE, normalizeHex } from "./color";
import { distinctValues } from "./data";
import { FIELDS } from "./fields";
import { CHART_TYPES, DIVERGING_SCHEMES, FIELD_PRESETS, LEGACY_TYPES, MAX_SERIES, SEQUENTIAL_SCHEMES, isRound, type ChartSpec, type Dataset } from "./types";

// Charts are structured data, never markup or code: OpenPress draws them, so an
// agent can't inject SVG, CSS or script through a chart. Every v1 spec (no
// `version`) is still valid; v2 only adds optional keys and chart types.

export const MAX_ROWS = 5000;
export const MAX_FIELDS = 16;
export const MAX_CELLS = 60_000;
export const MAX_SPEC_BYTES = 600_000;

const text = (max: number) => z.string().trim().min(1).max(max);
const value = z.number().finite().nullable();
const hex = z.string().regex(HEX_RE, 'Use a hex color like "#1f77b4"').transform(normalizeHex);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

const valueFormat = z
  .object({
    prefix: z.string().max(4).optional().describe('Shown before values, e.g. "$"'),
    suffix: z.string().max(6).optional().describe('Shown after values, e.g. "%" or " pts"'),
    decimals: z.number().int().min(0).max(4).optional().describe("Fixed decimal places. Default: up to 2, trailing zeros dropped"),
  })
  .strict();

const cell = z.union([z.number().finite(), z.string().max(120), z.null()]);
const fieldName = z.string().trim().min(1).max(40);

export const datasetSchema = z
  .object({
    fields: z
      .array(
        z
          .object({
            name: fieldName.describe("Column key used by encoding and filters"),
            type: z.enum(["number", "string", "date"]).describe('date = ISO 8601 string, e.g. "2024-09-08"'),
            label: z.string().trim().max(60).optional().describe("Human-readable name for axes, tooltips and the data table"),
            format: valueFormat.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_FIELDS),
    rows: z
      .array(z.union([z.array(cell), z.record(z.string(), cell)]))
      .max(MAX_ROWS)
      .describe(`Up to ${MAX_ROWS} rows, each an array in field order or an object keyed by field name. Use null for missing values.`),
  })
  .strict()
  .transform((ds, ctx): Dataset => {
    const names = ds.fields.map((f) => f.name);
    if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", path: ["fields"], message: "Field names must be unique" });
    if (ds.rows.length * ds.fields.length > MAX_CELLS) ctx.addIssue({ code: "custom", path: ["rows"], message: `Too much data: at most ${MAX_CELLS} cells (rows × fields)` });
    const rows = ds.rows.map((r, i) => {
      if (Array.isArray(r)) {
        if (r.length !== names.length) ctx.addIssue({ code: "custom", path: ["rows", i], message: `Has ${r.length} values but there are ${names.length} fields` });
        return r;
      }
      const extra = Object.keys(r).filter((k) => !names.includes(k));
      if (extra.length) ctx.addIssue({ code: "custom", path: ["rows", i], message: `Unknown field(s): ${extra.slice(0, 3).join(", ")}` });
      return names.map((n) => r[n] ?? null);
    });
    rows.forEach((r, i) =>
      r.forEach((v, k) => {
        const f = ds.fields[k];
        if (v === null || !f) return;
        const ok = f.type === "number" ? typeof v === "number" : f.type === "date" ? typeof v === "string" && ISO_DATE.test(v) : typeof v === "string";
        if (!ok) ctx.addIssue({ code: "custom", path: ["rows", i, k], message: `"${f.name}" is a ${f.type} field${f.type === "date" ? " (ISO 8601, e.g. 2024-09-08)" : ""}` });
      }),
    );
    return { fields: ds.fields, rows };
  });

const encodingSchema = z
  .object({
    x: fieldName.optional().describe("Field on the x axis (categories/dates for line/area/bar/heatmap; slice names for pie; numeric position for scatter/spatial_heatmap)"),
    y: z.union([fieldName, z.array(fieldName).min(1).max(MAX_SERIES)]).optional().describe("Value field(s) for line/area/bar/pie (several = one series each); row category for heatmap; numeric position for scatter/spatial_heatmap"),
    series: fieldName.optional().describe("Split into one series (and color) per value of this field, e.g. player"),
    value: fieldName.optional().describe("Heatmap cell value, or spatial_heatmap weight per point"),
    size: fieldName.optional().describe("Scatter: numeric field mapped to point size"),
    color: fieldName.optional().describe("Scatter: numeric field mapped to the color scale"),
    label: fieldName.optional().describe("Scatter: names each point in tooltips (and on the plot with style.showLabels)"),
    aggregate: z.enum(["sum", "mean", "count", "min", "max", "last"]).optional().describe("How rows sharing an x (and series) combine. Default sum. count needs no value field"),
  })
  .strict();

const filterDefault = z.union([z.string().max(120), z.number().finite(), z.array(z.union([z.string().max(120), z.number().finite()])).max(200), z.object({ min: z.union([z.string(), z.number()]).optional(), max: z.union([z.string(), z.number()]).optional() }).strict()]);

const filterSchema = z
  .object({
    field: fieldName.describe("Dataset field to filter on, e.g. season, player, metric, date"),
    label: z.string().trim().max(40).optional(),
    control: z.enum(["select", "buttons", "range"]).optional().describe("select: dropdown (default for strings/numbers). buttons: toggle chips, several on at once (≤ 30 values). range: from/to inputs (default for dates)"),
    allowAll: z.boolean().optional().describe('select only: offer "All" (default true). false starts on the first value'),
    default: filterDefault.optional().describe("Initial value(s): a value, a list (buttons), or {min, max} (range)"),
  })
  .strict();

const colorScaleSchema = z
  .object({
    scheme: z.enum(["theme", ...SEQUENTIAL_SCHEMES, ...DIVERGING_SCHEMES]).optional().describe("Named ramp. theme (default) follows the site and dark mode; diverging schemes: redBlue, brownTeal, purpleGreen"),
    colors: z.array(hex).min(2).max(11).optional().describe("Custom gradient stops (low → high). Overrides scheme"),
    domain: z.array(z.number().finite()).min(2).max(3).optional().describe("[min, max], or [min, mid, max] for a diverging scale. Default: data extent"),
    reverse: z.boolean().optional(),
    steps: z.number().int().min(2).max(12).optional().describe("Quantize into this many discrete color bins"),
  })
  .strict();

const styleSchema = z
  .object({
    colors: z.array(hex).min(1).max(MAX_SERIES).optional().describe("Series / slice colors in order (hex). Default: a colorblind-checked palette that adapts to dark mode"),
    colorScale: colorScaleSchema.optional().describe("Heatmaps, spatial heatmaps and scatter color-by-value"),
    background: hex.optional().describe("Plot-area background color"),
    legend: z.object({ show: z.boolean().optional(), position: z.enum(["top", "bottom"]).optional(), title: z.string().trim().max(60).optional() }).strict().optional(),
    tooltip: z.object({ show: z.boolean().optional(), fields: z.array(fieldName).max(8).optional().describe("Extra dataset fields to list in tooltips") }).strict().optional(),
    markSize: z.number().min(1).max(20).optional().describe("Scatter point radius in px"),
    opacity: z.number().min(0.1).max(1).optional().describe("Scatter point / heat cell opacity"),
    showValues: z.boolean().optional().describe("Heatmap: print values in cells (default: when they fit)"),
    showLabels: z.boolean().optional().describe("Scatter: print encoding.label next to points (first 60)"),
  })
  .strict();

const fieldSchema = z
  .object({
    preset: z.enum(FIELD_PRESETS).describe("Draws the playing surface and fixes the coordinate system (see get_visualization_capabilities)"),
    variant: z.enum(["full", "half"]).optional().describe("half = the attacking half (soccer/football) or one basket (basketball)"),
    orientation: z.enum(["auto", "horizontal", "vertical"]).optional(),
    look: z.enum(["minimal", "turf"]).optional().describe("minimal (default): theme-colored lines. turf: grass/hardwood surface"),
  })
  .strict();

const axis = z.object({ title: z.string().trim().max(60).optional(), min: z.number().finite().optional(), max: z.number().finite().optional() }).strict();

export const chartSpecSchema = z
  .object({
    version: z.union([z.literal(1), z.literal(2)]).optional().describe("Spec schema version. Omit for the latest (2)"),
    type: z
      .enum(CHART_TYPES)
      .describe("line/area: change over time. bar: compare categories. pie/donut: parts of one whole. scatter: two measures per item (shot charts with field). heatmap: value per (x category, y category). spatial_heatmap: point density/intensity over a continuous surface or sports field"),
    title: text(120).describe("Shown above the chart and used as its accessible name"),
    subtitle: z.string().trim().max(200).optional().describe("One line under the title, e.g. units or scope"),
    source: z.string().trim().max(200).optional().describe('Credit line under the chart, e.g. "Pro Football Reference"'),
    description: z.string().trim().max(500).optional().describe("Summary of what the chart shows, for screen readers"),
    labels: z.array(text(40)).min(1).max(100).optional().describe("Inline data: x-axis categories (bar/line/area/heatmap columns) or slice names (pie/donut), in order. Use either labels+series or dataset+encoding"),
    series: z
      .array(
        z
          .object({
            name: text(60),
            data: z.array(value).describe("One value per label, same order. null = no data for that label"),
          })
          .strict(),
      )
      .min(1)
      .max(60)
      .optional()
      .describe(`Inline data: 1-${MAX_SERIES} series (pie/donut exactly one; heatmap: one per row, up to 60)`),
    dataset: datasetSchema.optional().describe("Row data (tidy/long format). Required for scatter, spatial_heatmap and filters"),
    encoding: encodingSchema.optional().describe("Which dataset fields drive which visual channel"),
    filters: z.array(filterSchema).max(4).optional().describe("Reader controls that filter dataset rows in the page, without reloading"),
    stacked: z.boolean().optional().describe("Bar only: stack series instead of grouping them"),
    xAxis: axis.optional().describe("min/max apply to numeric x (scatter, spatial_heatmap)"),
    yAxis: axis.optional(),
    valueFormat: valueFormat.optional(),
    style: styleSchema.optional(),
    field: fieldSchema.optional().describe("Scatter / spatial_heatmap: draw on a sports field preset"),
    spatial: z
      .object({
        binSize: z.number().positive().max(1000).optional().describe("Bin edge in data units (default: ~1/32 of the width)"),
        aggregate: z.enum(["count", "sum", "mean"]).optional().describe("count (default without encoding.value), sum (default with it) or mean of value per bin"),
        smoothing: z.number().min(0).max(4).optional().describe("Gaussian smoothing radius in bins. Default 1 (0 for mean)"),
      })
      .strict()
      .optional(),
    annotations: z
      .object({ lines: z.array(z.object({ axis: z.enum(["x", "y"]), value: z.number().finite(), label: z.string().trim().max(40).optional() }).strict()).max(6).optional().describe("Reference lines, e.g. league average") })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((s, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
    const ds = s.dataset;
    const enc = s.encoding ?? {};
    const inline = s.labels !== undefined || s.series !== undefined;
    const legacy = (LEGACY_TYPES as readonly string[]).includes(s.type);
    const field = (name: string | undefined, path: (string | number)[], types?: string[]) => {
      if (name === undefined || !ds) return;
      const f = ds.fields.find((x) => x.name === name);
      if (!f) issue(path, `No field "${name}" in dataset.fields (${ds.fields.map((x) => x.name).join(", ")})`);
      else if (types && !types.includes(f.type)) issue(path, `"${name}" must be a ${types.join(" or ")} field`);
    };

    if (inline && ds) issue(["dataset"], "Use either labels+series (inline) or dataset+encoding, not both");
    if (inline) {
      if (!s.labels || !s.series) issue([s.labels ? "series" : "labels"], "Inline data needs both labels and series");
      if (s.type === "scatter" || s.type === "spatial_heatmap") issue(["dataset"], `${s.type} charts need dataset + encoding (x and y numeric fields)`);
    } else if (!ds) {
      issue(["labels"], legacy || s.type === "heatmap" ? "Provide data: labels + series, or dataset + encoding" : `${s.type} charts need dataset + encoding`);
    }

    if (s.labels && s.series) {
      s.series.forEach((ser, i) => {
        if (ser.data.length !== s.labels!.length) {
          issue(["series", i, "data"], `Has ${ser.data.length} values but there are ${s.labels!.length} labels; provide one value per label (null for gaps)`);
        }
        if (ser.data.every((v) => v === null)) issue(["series", i, "data"], "Needs at least one value");
      });
      if (s.type !== "heatmap" && s.series.length > MAX_SERIES) issue(["series"], `At most ${MAX_SERIES} series; use a dataset with a filter to show more`);
      if (isRound(s)) {
        if (s.series.length !== 1) issue(["series"], `${s.type} charts take exactly one series`);
        if (s.labels.length > MAX_SERIES) issue(["labels"], `${s.type} charts take at most ${MAX_SERIES} slices; group the rest into "Other"`);
        if (s.series[0]?.data.some((v) => v !== null && v < 0)) issue(["series", 0, "data"], `${s.type} values can't be negative`);
      }
    }

    if (ds) {
      field(enc.series, ["encoding", "series"]);
      field(enc.label, ["encoding", "label"]);
      field(enc.size, ["encoding", "size"], ["number"]);
      field(enc.color, ["encoding", "color"], ["number"]);
      const ys = Array.isArray(enc.y) ? enc.y : enc.y ? [enc.y] : [];
      if (!enc.x) issue(["encoding", "x"], "encoding.x is required with a dataset");
      if (s.type === "scatter" || s.type === "spatial_heatmap") {
        field(enc.x, ["encoding", "x"], ["number"]);
        if (ys.length !== 1) issue(["encoding", "y"], "encoding.y must be one numeric field");
        else field(ys[0], ["encoding", "y"], ["number"]);
        field(enc.value, ["encoding", "value"], ["number"]);
      } else if (s.type === "heatmap") {
        field(enc.x, ["encoding", "x"]);
        if (ys.length !== 1) issue(["encoding", "y"], "encoding.y must be one field: the row category");
        else field(ys[0], ["encoding", "y"]);
        if (!enc.value && enc.aggregate !== "count") issue(["encoding", "value"], 'heatmap needs encoding.value (a number field) or aggregate "count"');
        field(enc.value, ["encoding", "value"], ["number"]);
      } else {
        field(enc.x, ["encoding", "x"]);
        if (!ys.length && enc.aggregate !== "count") issue(["encoding", "y"], 'encoding.y (number field) is required, unless aggregate is "count"');
        ys.forEach((y, i) => field(y, ["encoding", "y", ...(Array.isArray(enc.y) ? [i] : [])], ["number"]));
        if (ys.length > 1 && enc.series) issue(["encoding", "series"], "Use several y fields or a series field, not both");
        if (isRound(s) && (ys.length > 1 || enc.series)) issue(["encoding"], `${s.type} charts take one value field and no series`);
      }
      (s.style?.tooltip?.fields ?? []).forEach((f, i) => field(f, ["style", "tooltip", "fields", i]));
      (s.filters ?? []).forEach((f, i) => {
        field(f.field, ["filters", i, "field"]);
        const def = ds.fields.find((x) => x.name === f.field);
        if (!def) return;
        const col = ds.fields.indexOf(def);
        const n = distinctValues(ds, col).length;
        if (f.control === "range" && def.type === "string") issue(["filters", i, "control"], "range filters need a number or date field");
        if (f.control === "buttons" && n > 30) issue(["filters", i, "control"], `"${f.field}" has ${n} values; use a select for more than 30`);
        if (n > 200 && f.control !== "range" && def.type === "string") issue(["filters", i, "field"], `"${f.field}" has ${n} values; filters offer at most 200`);
      });
    } else if (s.filters?.length) issue(["filters"], "Filters need a dataset (they filter its rows)");
    else if (s.encoding) issue(["encoding"], "encoding needs a dataset");

    if (s.field && s.type !== "scatter" && s.type !== "spatial_heatmap") issue(["field"], "Field presets apply to scatter and spatial_heatmap charts");
    if (s.field?.variant === "half" && !FIELDS[s.field.preset].half) issue(["field", "variant"], `${s.field.preset} has no half variant`);
    if (s.spatial && s.type !== "spatial_heatmap") issue(["spatial"], "spatial options apply to spatial_heatmap only");
    if (s.stacked && s.type !== "bar") issue(["stacked"], "Only bar charts can be stacked");
    (s.annotations?.lines ?? []).forEach((l, i) => {
      if (l.axis === "x" && s.type !== "scatter" && s.type !== "spatial_heatmap") issue(["annotations", "lines", i, "axis"], "x reference lines need a numeric x axis (scatter)");
      if (s.field) issue(["annotations", "lines", i], "Reference lines are not drawn on field presets");
    });
    for (const a of ["xAxis", "yAxis"] as const) {
      const ax = s[a];
      if (ax?.min !== undefined && ax?.max !== undefined && ax.min >= ax.max) issue([a, "max"], `${a}.max must be greater than ${a}.min`);
    }
    const dom = s.style?.colorScale?.domain;
    if (dom && dom.some((v, i) => i > 0 && v <= dom[i - 1])) issue(["style", "colorScale", "domain"], "domain values must increase");
  });

// Keep the hand-written renderer type and the schema in lockstep.
type Parsed = z.infer<typeof chartSpecSchema>;
const _check: (p: Parsed) => ChartSpec = (p) => p;
void _check;

/**
 * Read a stored spec, migrating older versions forward. v1 → v2 is the
 * identity (v2 only added optional keys); future breaking versions add steps here.
 */
export function parseStoredSpec(raw: unknown): ChartSpec | null {
  const r = chartSpecSchema.safeParse(raw);
  return r.success ? r.data : null;
}
