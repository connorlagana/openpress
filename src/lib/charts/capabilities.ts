import { z } from "zod";
import { SCHEME_NAMES } from "./color";
import { FIELDS } from "./fields";
import { MAX_CELLS, MAX_FIELDS, MAX_ROWS, MAX_SPEC_BYTES, chartSpecSchema } from "./spec";
import { CHART_SCHEMA_VERSION, MAX_SERIES, type ChartSpec } from "./types";
import { VIZ_LIMITS } from "@/lib/viz/schema";

// What get_visualization_capabilities returns: one self-describing document so
// agents discover features from data instead of from a tool per feature.
// Every example here is validated by tests/unit/visualizations.test.ts.

export const CHART_EXAMPLES: Record<string, ChartSpec> = {
  line_inline: {
    type: "line",
    title: "Completion % by season",
    labels: ["2021", "2022", "2023", "2024"],
    series: [{ name: "Completion %", data: [63.3, 63.3, 66.5, 63.6] }],
    valueFormat: { suffix: "%", decimals: 1 },
  },
  line_dataset_with_filters: {
    type: "line",
    title: "Weekly production",
    dataset: {
      fields: [
        { name: "week", type: "number", label: "Week" },
        { name: "player", type: "string" },
        { name: "metric", type: "string" },
        { name: "value", type: "number" },
      ],
      rows: [
        [1, "Allen", "Pass yds", 297],
        [2, "Allen", "Pass yds", 263],
        [1, "Allen", "Rush yds", 39],
        [2, "Allen", "Rush yds", 46],
        [1, "Mahomes", "Pass yds", 291],
        [2, "Mahomes", "Pass yds", 205],
        [1, "Mahomes", "Rush yds", 16],
        [2, "Mahomes", "Rush yds", 30],
      ],
    },
    encoding: { x: "week", y: "value", series: "player" },
    filters: [{ field: "metric", allowAll: false }],
  },
  scatter: {
    type: "scatter",
    title: "Efficiency vs. accuracy",
    dataset: {
      fields: [
        { name: "player", type: "string" },
        { name: "epa", type: "number", label: "EPA/play" },
        { name: "cpoe", type: "number", label: "CPOE", format: { suffix: "%" } },
        { name: "att", type: "number", label: "Attempts" },
      ],
      rows: [
        ["Allen", 0.21, 2.1, 483],
        ["Mahomes", 0.12, 1.4, 581],
        ["Jackson", 0.27, 4.5, 475],
      ],
    },
    encoding: { x: "cpoe", y: "epa", label: "player", size: "att" },
    style: { showLabels: true },
    annotations: { lines: [{ axis: "y", value: 0, label: "League avg" }] },
  },
  heatmap: {
    type: "heatmap",
    title: "Points by quarter",
    labels: ["Q1", "Q2", "Q3", "Q4"],
    series: [
      { name: "BUF", data: [7, 10, 3, 7] },
      { name: "KC", data: [3, 7, 7, 10] },
    ],
    style: { colorScale: { scheme: "blues" } },
  },
  spatial_heatmap_on_court: {
    type: "spatial_heatmap",
    title: "Shot locations",
    dataset: {
      fields: [
        { name: "x", type: "number" },
        { name: "y", type: "number" },
        { name: "made", type: "number" },
      ],
      rows: [
        [5.5, 25, 1],
        [6, 24, 0],
        [19, 25, 1],
        [28, 10, 0],
      ],
    },
    encoding: { x: "x", y: "y" },
    field: { preset: "basketball", variant: "half" },
  },
};

export function visualizationCapabilities(opts: { includeJsonSchema?: boolean } = {}) {
  return {
    schemaVersion: CHART_SCHEMA_VERSION,
    summary:
      "Declarative charts: send data + configuration to create_chart / update_chart; OpenPress draws accessible, themed, interactive SVG. No JavaScript needed for these types. Embed with the returned token on its own line; later updates show up in every embedding post without republishing.",
    embedSyntax: { chart: "{{chart:<id>}}", customVisualization: "{{viz:<id>}}", rule: "Put the token alone on its own line in post Markdown." },
    dataModels: {
      inline: "labels (x categories) + series [{name, data[]}] with one value per label. line/area/bar/pie/donut/heatmap.",
      dataset:
        "dataset {fields: [{name, type: number|string|date, label?, format?}], rows: [[...] | {...}]} + encoding (which field drives x, y, series, value, size, color, label). Required for scatter, spatial_heatmap and filters. Long/tidy format (one row per observation) works best: e.g. columns player, season, metric, value.",
    },
    chartTypes: [
      { type: "line", use: "Change over time", data: "inline, or dataset with encoding.x + encoding.y (one field or several) and optional encoding.series", options: ["valueFormat", "yAxis.min/max", "annotations.lines (axis y)"] },
      { type: "area", use: "Change over time, emphasizing volume", data: "same as line" },
      { type: "bar", use: "Compare categories", data: "same as line", options: ["stacked"] },
      { type: "pie", use: `Parts of one whole (≤ ${MAX_SERIES} slices)`, data: "inline with one series, or dataset with encoding.x (slice) + encoding.y (value)" },
      { type: "donut", use: "Same as pie", data: "same as pie" },
      { type: "scatter", use: "Two measures per item; shot/spray charts on a field", data: "dataset; encoding.x/y numeric; optional series (color groups), size, color (numeric → colorScale), label", options: ["field", "style.showLabels", "annotations.lines"] },
      { type: "heatmap", use: "Value per (column, row) pair, e.g. team × week", data: "inline labels (columns) + series (one per row, ≤ 60), or dataset with encoding.x, encoding.y (row field) and encoding.value (or aggregate count)", options: ["style.colorScale", "style.showValues"] },
      { type: "spatial_heatmap", use: "Density or intensity over continuous space, e.g. shot locations", data: "dataset; encoding.x/y numeric positions; optional encoding.value weight", options: ["field", "spatial.binSize", "spatial.aggregate (count|sum|mean)", "spatial.smoothing"] },
    ],
    customization: {
      colors: `style.colors: up to ${MAX_SERIES} hex colors for series/slices (default palette is colorblind-checked and adapts to dark mode)`,
      colorScale: { schemes: ["theme", ...SCHEME_NAMES], diverging: ["redBlue", "brownTeal", "purpleGreen"], options: "colors (custom gradient stops), domain [min,max] or [min,mid,max], reverse, steps (quantize)" },
      background: "style.background: hex color for the plot area; field.look 'turf' paints grass/hardwood",
      legend: "style.legend: {show, position: top|bottom, title}",
      tooltip: "style.tooltip: {show, fields: extra dataset fields to list}",
      marks: "style.markSize, style.opacity, style.showValues (heatmap), style.showLabels (scatter)",
      fieldPresets: Object.fromEntries(Object.entries(FIELDS).map(([k, f]) => [k, { units: f.units, variants: f.half ? ["full", "half"] : ["full"], coordinates: f.coordinates }])),
    },
    interactivity: {
      alwaysOn: ["tooltips on hover, tap and keyboard focus", "arrow-key navigation between values", "series toggles in the legend", "responsive redraw at the reader's width", "'View data' table that follows the current filters"],
      filters:
        "filters: [{field, label?, control: select|buttons|range, allowAll?, default?}] (≤ 4). Filter on any dataset field — season, player, metric, team, date. Filtering happens in the reader's browser without reloading; the data table and record count update with it.",
    },
    accessibility: [
      "Every chart has an accessible name (title + description) and a data table",
      "Keyboard: focus the chart, then use arrow keys (Home/End jump); Escape closes the tooltip",
      "Filters are native select/button/input controls with labels; result counts are announced",
      "Works without JavaScript: the server render shows the default view and its table",
    ],
    limits: { maxRows: MAX_ROWS, maxFields: MAX_FIELDS, maxCells: MAX_CELLS, maxSpecBytes: MAX_SPEC_BYTES, maxSeries: MAX_SERIES, maxHeatmapRows: 60, maxFilters: 4, chartsPerSite: 200 },
    examples: CHART_EXAMPLES,
    customVisualizations: {
      enabled: true,
      when: "Only for visualization types the declarative charts can't express. Prefer create_chart.",
      tools: ["create_custom_visualization", "get_custom_visualization", "list_custom_visualizations", "update_custom_visualization", "delete_custom_visualization"],
      approval: "New or changed code runs only after a site member approves it in the dashboard (the tool result's approvalUrl). Agents cannot approve. Data-only updates keep the approval.",
      sandbox: [
        "Runs in a cross-origin, opaque-origin sandboxed iframe (scripts only: no same-origin access, cookies, storage, popups, forms or top navigation)",
        "No network: fetch/XHR/WebSocket and external scripts, styles, images and fonts are blocked. Inline everything; images/fonts only as data: URLs",
        "No <script>, <link>, <meta>, <iframe>, <form> in html: build the DOM from js",
      ],
      runtime: "window.OpenPress = { data, theme: {fg, bg, accent, font, dark}, onTheme(fn), resize(height?) }. CSS variables --op-fg, --op-bg, --op-accent, --op-font follow the site theme. The frame resizes to its content.",
      limits: { htmlChars: VIZ_LIMITS.html, cssChars: VIZ_LIMITS.css, jsChars: VIZ_LIMITS.js, dataBytes: VIZ_LIMITS.dataBytes, perSite: VIZ_LIMITS.perSite },
      accessibility: "Provide description (screen-reader summary) and table (same shape as a chart dataset): both render outside the frame, also for readers without JS.",
    },
    ...(opts.includeJsonSchema ? { jsonSchema: z.toJSONSchema(chartSpecSchema, { io: "input", unrepresentable: "any" }) } : {}),
  };
}
