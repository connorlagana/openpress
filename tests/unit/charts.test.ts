import { describe, expect, it } from "vitest";
import { chartFigureHtml, chartIdsInMarkdown, embedCharts, formatValue, renderChartSvg, yScale, type ChartSpec } from "@/lib/charts/render";
import { chartSpecSchema } from "@/lib/charts/spec";
import { renderMarkdown } from "@/lib/markdown";

const allen: ChartSpec = {
  type: "line",
  title: "Josh Allen's Development",
  subtitle: "Completion percentage · Wyoming and Buffalo Bills",
  labels: ["2017 College", "2018 NFL", "2019 NFL", "2020 NFL"],
  series: [{ name: "Completion %", data: [56.3, 52.8, 58.8, 69.2] }],
  valueFormat: { suffix: "%", decimals: 1 },
};
const ID = "2f0c6a52-6d8e-4b1a-9a59-0d6a9b8f1c11";

describe("chart spec validation", () => {
  it("accepts a well-formed spec", () => {
    expect(chartSpecSchema.parse(allen)).toEqual(allen);
  });

  it("requires one value per label", () => {
    const r = chartSpecSchema.safeParse({ ...allen, series: [{ name: "x", data: [1, 2] }] });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].message).toContain("one value per label");
  });

  it("rejects unknown keys (no smuggled markup or options)", () => {
    expect(chartSpecSchema.safeParse({ ...allen, html: "<svg onload=alert(1)>" }).success).toBe(false);
    expect(chartSpecSchema.safeParse({ ...allen, series: [{ ...allen.series[0], color: "red" }] }).success).toBe(false);
  });

  it("enforces pie rules", () => {
    const pie = { type: "pie", title: "Share", labels: ["A", "B"], series: [{ name: "s", data: [1, 2] }] };
    expect(chartSpecSchema.safeParse(pie).success).toBe(true);
    expect(chartSpecSchema.safeParse({ ...pie, series: [...pie.series, { name: "t", data: [1, 1] }] }).success).toBe(false);
    expect(chartSpecSchema.safeParse({ ...pie, series: [{ name: "s", data: [1, -2] }] }).success).toBe(false);
    expect(chartSpecSchema.safeParse({ ...pie, stacked: true }).success).toBe(false);
  });
});

describe("chart rendering", () => {
  it("lets a line axis float off zero when the data sits far from it", () => {
    const { min, max, ticks } = yScale(allen, [0]);
    expect(min).toBe(50);
    expect(max).toBe(70);
    expect(ticks).toEqual([50, 55, 60, 65, 70]);
  });

  it("always includes zero for bars", () => {
    expect(yScale({ ...allen, type: "bar" }, [0]).min).toBe(0);
  });

  it("formats values with prefix, suffix, sign and compact axis ticks", () => {
    expect(formatValue({ suffix: "%", decimals: 1 }, 69.2)).toBe("69.2%");
    expect(formatValue({ prefix: "$" }, -1234.5)).toBe("−$1,234.5");
    expect(formatValue(undefined, 25_000, { compact: true })).toBe("25K");
    expect(formatValue(undefined, null)).toBe("–");
  });

  it("escapes every piece of chart text", () => {
    const evil: ChartSpec = {
      ...allen,
      title: `</script><script>alert(1)</script>`,
      labels: [`"><img src=x onerror=alert(1)>`, "b", "c", "d"],
      series: [{ name: "<b>x</b>", data: [1, 2, 3, 4] }],
      source: "<iframe>",
    };
    const html = chartFigureHtml(ID, evil);
    expect(html).not.toMatch(/<script>alert|<img|<iframe|<b>/);
    // The only <script> is the inert JSON spec, and its payload can't close it.
    expect(html.match(/<script/g)).toHaveLength(1);
    const json = html.match(/<script type="application\/json" class="op-chart-spec">([\s\S]*?)<\/script>/)![1];
    expect(json).not.toContain("<");
    expect(JSON.parse(json).title).toBe(evil.title);
  });

  it("draws bars, stacked bars, areas, pies and donuts", () => {
    const base = { title: "t", labels: ["a", "b", "c"], series: [{ name: "x", data: [3, null, 5] }, { name: "y", data: [1, 2, 3] }] };
    expect(renderChartSvg({ ...base, type: "bar" })).toContain('class="op-bar op-c1"');
    expect(renderChartSvg({ ...base, type: "bar", stacked: true }).match(/op-bar/g)).toHaveLength(5);
    expect(renderChartSvg({ ...base, type: "area" })).toContain('class="op-area"');
    const pie = renderChartSvg({ type: "donut", title: "t", labels: ["a", "b"], series: [{ name: "x", data: [1, 3] }] });
    expect(pie.match(/op-slice/g)).toHaveLength(2);
    expect(renderChartSvg({ type: "pie", title: "t", labels: ["a", "b"], series: [{ name: "x", data: [5, 0] }] })).toContain('fill-rule="evenodd"');
  });

  it("re-renders at a given width and hides toggled-off series", () => {
    const two: ChartSpec = { ...allen, series: [allen.series[0], { name: "League avg", data: [60, 62, 63, 64] }] };
    expect(renderChartSvg(two, { width: 360 })).toContain('viewBox="0 0 360 ');
    const hidden = renderChartSvg(two, { hidden: new Set([1]) });
    expect(hidden).not.toContain("op-c1");
  });
});

describe("chart embeds in posts", () => {
  it("finds tokens in Markdown and swaps the rendered paragraph for the chart", () => {
    const md = `Intro\n\n{{chart:${ID}}}\n\nInline {{chart:${ID}}} mention.\n\n\`{{chart:${ID}}}\``;
    expect(chartIdsInMarkdown(md)).toEqual([ID]);
    const html = embedCharts(renderMarkdown(md), new Map([[ID, allen]]));
    expect(html.match(/<figure class="op-chart"/g)).toHaveLength(1); // only the token on its own line
    expect(html).toContain("Josh Allen&#39;s Development");
    expect(html).toContain("<code>{{chart:");
  });

  it("drops unknown charts publicly and flags them in previews", () => {
    const html = renderMarkdown(`{{chart:${ID}}}`);
    expect(embedCharts(html, new Map()).trim()).toBe("");
    expect(embedCharts(html, new Map(), "preview")).toContain("not found");
    expect(embedCharts(html, new Map([[ID, allen]]), "feed")).toMatch(/<table>.*69\.2%/);
  });
});
