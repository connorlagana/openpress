import { z } from "zod";
import { MAX_SERIES, type ChartSpec } from "./render";

// Charts are structured data, never markup or code: OpenPress draws them, so an
// agent can't inject SVG or script through a chart.

const text = (max: number) => z.string().trim().min(1).max(max);
const value = z.number().finite().nullable();

const valueFormat = z
  .object({
    prefix: z.string().max(4).optional().describe('Shown before values, e.g. "$"'),
    suffix: z.string().max(6).optional().describe('Shown after values, e.g. "%" or " pts"'),
    decimals: z.number().int().min(0).max(4).optional().describe("Fixed decimal places. Default: up to 2, trailing zeros dropped"),
  })
  .strict();

export const chartSpecSchema = z
  .object({
    type: z.enum(["line", "area", "bar", "pie", "donut"]).describe("line/area for change over time, bar to compare categories, pie/donut for parts of one whole"),
    title: text(120).describe("Shown above the chart and used as its accessible name"),
    subtitle: z.string().trim().max(200).optional().describe("One line under the title, e.g. units or scope"),
    source: z.string().trim().max(200).optional().describe('Credit line under the chart, e.g. "Pro Football Reference"'),
    description: z.string().trim().max(500).optional().describe("Summary of what the chart shows, for screen readers"),
    labels: z.array(text(40)).min(1).max(100).describe("X-axis categories (bar/line/area) or slice names (pie/donut), in order"),
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
      .max(MAX_SERIES)
      .describe(`1-${MAX_SERIES} series. Pie/donut take exactly one.`),
    stacked: z.boolean().optional().describe("Bar only: stack series instead of grouping them"),
    xAxis: z.object({ title: z.string().trim().max(60).optional() }).strict().optional(),
    yAxis: z
      .object({
        title: z.string().trim().max(60).optional(),
        min: z.number().finite().optional(),
        max: z.number().finite().optional(),
      })
      .strict()
      .optional(),
    valueFormat: valueFormat.optional(),
  })
  .strict()
  .superRefine((s, ctx) => {
    s.series.forEach((ser, i) => {
      if (ser.data.length !== s.labels.length) {
        ctx.addIssue({ code: "custom", path: ["series", i, "data"], message: `Has ${ser.data.length} values but there are ${s.labels.length} labels; provide one value per label (null for gaps)` });
      }
      if (ser.data.every((v) => v === null)) ctx.addIssue({ code: "custom", path: ["series", i, "data"], message: "Needs at least one value" });
    });
    const round = s.type === "pie" || s.type === "donut";
    if (round) {
      if (s.series.length !== 1) ctx.addIssue({ code: "custom", path: ["series"], message: `${s.type} charts take exactly one series` });
      if (s.labels.length > MAX_SERIES) ctx.addIssue({ code: "custom", path: ["labels"], message: `${s.type} charts take at most ${MAX_SERIES} slices; group the rest into "Other"` });
      if (s.series[0]?.data.some((v) => v !== null && v < 0)) ctx.addIssue({ code: "custom", path: ["series", 0, "data"], message: `${s.type} values can't be negative` });
    }
    if (s.stacked && s.type !== "bar") ctx.addIssue({ code: "custom", path: ["stacked"], message: "Only bar charts can be stacked" });
    if (s.yAxis?.min !== undefined && s.yAxis?.max !== undefined && s.yAxis.min >= s.yAxis.max) {
      ctx.addIssue({ code: "custom", path: ["yAxis", "max"], message: "yAxis.max must be greater than yAxis.min" });
    }
  });

// Keep the hand-written renderer type and the schema in lockstep.
type Parsed = z.infer<typeof chartSpecSchema>;
const _check: (p: Parsed) => ChartSpec = (p) => p;
void _check;

export function parseStoredSpec(raw: unknown): ChartSpec | null {
  const r = chartSpecSchema.safeParse(raw);
  return r.success ? r.data : null;
}
