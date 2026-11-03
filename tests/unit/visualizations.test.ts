import { describe, expect, it } from "vitest";
import { CHART_EXAMPLES, visualizationCapabilities } from "@/lib/charts/capabilities";
import { buildColorScale, interpolateStops } from "@/lib/charts/color";
import { applyFilters, defaultFilterState, resolveView, type FilterState } from "@/lib/charts/data";
import { DEMO_CHARTS, DEMO_CUSTOM_VIZ, demoPointsHeatmap, demoQbScatter, demoShotHeatmap, demoTrendWithFilters } from "@/lib/charts/demo";
import { fieldFrame } from "@/lib/charts/fields";
import { spatialBins } from "@/lib/charts/plots";
import { chartFeedHtml, chartFigureHtml, chartTableHtml, renderChartSvg, renderPlot, type ChartSpec } from "@/lib/charts/render";
import { chartSpecSchema } from "@/lib/charts/spec";
import { pointsOf } from "@/lib/charts/data";
import { embedViz, vizFigureHtml, vizIdsInMarkdown } from "@/lib/viz/embed";
import { frameCsp, frameDocument } from "@/lib/viz/frame";
import { customVizInput } from "@/lib/viz/schema";
import { renderMarkdown } from "@/lib/markdown";
import v1 from "./fixtures/v1-charts.json";

const ID = "2f0c6a52-6d8e-4b1a-9a59-0d6a9b8f1c11";
const parse = (s: unknown) => chartSpecSchema.parse(s) as ChartSpec;

describe("backward compatibility with v1 charts", () => {
  // Fixture rendered by the pre-v2 renderer (git HEAD before this change).
  for (const [name, spec] of Object.entries(v1.specs)) {
    it(`draws v1 "${name}" byte-for-byte as before`, () => {
      const s = parse(spec);
      const expected = v1.out[name as keyof typeof v1.out];
      expect(renderChartSvg(s)).toBe(expected.svg680);
      expect(renderChartSvg(s, { width: 360 })).toBe(expected.svg360);
      expect(renderChartSvg(s, { hidden: new Set([1]) })).toBe(expected.hidden);
      expect(chartTableHtml(s)).toBe(expected.table);
    });
  }

  it("accepts every v1 spec unchanged and keeps the figure contract the enhancer and tests rely on", () => {
    for (const spec of Object.values(v1.specs)) expect(chartSpecSchema.parse(spec)).toEqual(spec);
    const html = chartFigureHtml(ID, parse(v1.specs.line));
    expect(html).toContain(`<figure class="op-chart" data-chart="${ID}" data-type="line">`);
    expect(html).toContain('class="op-toggle" data-s="1" aria-pressed="true" disabled');
    expect(html).toContain("<details class=\"op-chart-data\"><summary>View data</summary>");
    expect(html).not.toContain("op-filters");
  });
});

describe("v2 schema", () => {
  it("accepts every capability example and every demo chart", () => {
    for (const [k, ex] of Object.entries(CHART_EXAMPLES)) expect(chartSpecSchema.safeParse(ex).success, k).toBe(true);
    for (const d of DEMO_CHARTS) {
      const r = chartSpecSchema.safeParse(d.build());
      expect(r.success, `${d.key}: ${r.error?.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`).toBe(true);
    }
  });

  it("normalizes object rows and short hex", () => {
    const s = parse({
      type: "bar",
      title: "t",
      dataset: { fields: [{ name: "k", type: "string" }, { name: "v", type: "number" }], rows: [{ k: "a", v: 1 }, { v: 2, k: "b" }, { k: "c" }] },
      encoding: { x: "k", y: "v" },
      style: { colors: ["#ABC"] },
    });
    expect(s.dataset!.rows).toEqual([["a", 1], ["b", 2], ["c", null]]);
    expect(s.style!.colors).toEqual(["#aabbcc"]);
  });

  it("returns actionable errors", () => {
    const msg = (s: unknown) => chartSpecSchema.safeParse(s).error?.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" | ") ?? "";
    const ds = { fields: [{ name: "x", type: "number" }, { name: "name", type: "string" }], rows: [[1, "a"]] };
    expect(msg({ type: "scatter", title: "t", labels: ["a"], series: [{ name: "s", data: [1] }] })).toContain("need dataset");
    expect(msg({ type: "scatter", title: "t", dataset: ds, encoding: { x: "x", y: "nope" } })).toContain('No field "nope"');
    expect(msg({ type: "scatter", title: "t", dataset: ds, encoding: { x: "x", y: "name" } })).toContain('"name" must be a number');
    expect(msg({ type: "bar", title: "t", labels: ["a"], series: [{ name: "s", data: [1] }], filters: [{ field: "x" }] })).toContain("Filters need a dataset");
    expect(msg({ type: "line", title: "t", dataset: ds, encoding: { x: "name", y: "x" }, filters: [{ field: "name", control: "range" }] })).toContain("range filters need a number or date");
    expect(msg({ type: "bar", title: "t", dataset: { fields: [{ name: "d", type: "date" }], rows: [["yesterday"]] }, encoding: { x: "d", aggregate: "count" } })).toContain("ISO 8601");
    expect(msg({ type: "bar", title: "t", labels: ["a"], series: [{ name: "s", data: [1] }], field: { preset: "soccer" } })).toContain("Field presets apply to scatter");
    expect(msg({ type: "pie", title: "t", dataset: ds, encoding: { x: "name", y: "x", series: "name" } })).toContain("no series");
  });

  it("rejects anything that isn't data: markup, CSS or URLs in colors", () => {
    const base = { type: "bar", title: "t", labels: ["a"], series: [{ name: "s", data: [1] }] };
    for (const bad of ["red", "#12", "url(javascript:alert(1))", "#fff;background:url(x)", "var(--x)"]) {
      expect(chartSpecSchema.safeParse({ ...base, style: { colors: [bad] } }).success, bad).toBe(false);
      expect(chartSpecSchema.safeParse({ ...base, style: { background: bad } }).success, bad).toBe(false);
      expect(chartSpecSchema.safeParse({ ...base, style: { colorScale: { colors: [bad, "#000000"] } } }).success, bad).toBe(false);
    }
    expect(chartSpecSchema.safeParse({ ...base, style: { css: "x" } }).success).toBe(false);
    expect(chartSpecSchema.safeParse({ ...base, html: "<b>" }).success).toBe(false);
  });
});

describe("filtering", () => {
  const spec = parse(demoTrendWithFilters());

  it("starts on the default view and filters by metric and date range without touching the source", () => {
    const state = defaultFilterState(spec);
    expect(state[0]).toEqual({ kind: "set", values: ["Points"] }); // allowAll false → first value
    expect(state[1]).toEqual({ kind: "range", min: undefined, max: undefined });
    const all = resolveView(spec, state);
    expect(all.rows.every((r) => r[2] === "Points")).toBe(true);
    expect(all.spec.labels).toHaveLength(18);
    expect(all.spec.series.map((s) => s.name)).toEqual(["Harbor Hawks", "Ridge Rams", "Delta Owls"]);

    const narrowed: FilterState = [{ kind: "set", values: ["Total yards"] }, { kind: "range", min: "2024-09-15", max: "2024-10-06" }];
    const view = resolveView(spec, narrowed);
    expect(view.spec.labels).toEqual(["2024-09-15", "2024-09-22", "2024-09-29", "2024-10-06"]);
    expect(view.spec.series[0].data.every((v) => v !== null && v >= 150)).toBe(true);
    expect(view.total).toBe(spec.dataset!.rows.length);
    expect(spec.dataset!.rows).toHaveLength(108);
  });

  it("includes the whole day for date max bounds when values carry times", () => {
    const s = parse({ type: "bar", title: "t", dataset: { fields: [{ name: "d", type: "date" }], rows: [["2024-01-01T10:00:00Z"], ["2024-01-02T10:00:00Z"]] }, encoding: { x: "d", aggregate: "count" }, filters: [{ field: "d" }] });
    expect(applyFilters(s, [{ kind: "range", max: "2024-01-01" }])).toHaveLength(1);
  });

  it("aggregates rows that share an x and series", () => {
    const s = parse({
      type: "bar",
      title: "t",
      dataset: { fields: [{ name: "q", type: "string" }, { name: "team", type: "string" }, { name: "pts", type: "number" }], rows: [["Q1", "A", 3], ["Q1", "A", 7], ["Q1", "B", 3], ["Q2", "B", 0]] },
      encoding: { x: "q", y: "pts", series: "team" },
    });
    const v = resolveView(s);
    expect(v.spec.series).toEqual([{ name: "A", data: [10, null] }, { name: "B", data: [3, 0] }]);
    expect(resolveView({ ...s, encoding: { ...s.encoding, aggregate: "mean" } }).spec.series[0].data[0]).toBe(5);
    expect(resolveView({ ...s, encoding: { x: "q", aggregate: "count" } }).spec.series[0].data).toEqual([3, 1]);
  });

  it("re-renders the figure parts for a new filter state (what the enhancer does)", () => {
    const s = parse(demoQbScatter());
    const v2024 = resolveView(s);
    const v2022 = resolveView(s, [{ kind: "set", values: [2022] }]);
    expect(v2024.rows.every((r) => r[2] === 2024)).toBe(true);
    expect(v2022.rows).toHaveLength(12);
    expect(renderPlot(v2022).svg).not.toBe(renderPlot(v2024).svg);
  });
});

describe("new chart types", () => {
  it("draws scatter points with size, labels, reference lines and toggles", () => {
    const s = parse(demoQbScatter());
    const plot = renderPlot(resolveView(s));
    expect(plot.mode).toBe("point");
    expect(plot.items).toHaveLength(12);
    expect(plot.svg.match(/class="op-pt /g)).toHaveLength(12);
    expect(plot.svg).toContain('class="op-ref"');
    expect(plot.svg).toContain("J. Calder");
    const tip = plot.tip(plot.items[0].i);
    expect(tip.rows.map((r) => r.name)).toEqual(expect.arrayContaining(["CPOE, EPA/play", "Attempts", "Team"]));
  });

  it("hides toggled-off scatter series", () => {
    const s = parse({
      type: "scatter",
      title: "t",
      dataset: { fields: [{ name: "g", type: "string" }, { name: "x", type: "number" }, { name: "y", type: "number" }], rows: [["a", 1, 1], ["b", 2, 2], ["b", 3, 3]] },
      encoding: { x: "x", y: "y", series: "g" },
    });
    expect(renderPlot(resolveView(s)).items).toHaveLength(3);
    expect(renderPlot(resolveView(s), { hidden: new Set([1]) }).items).toHaveLength(1);
    expect(chartFigureHtml(ID, s)).toContain('class="op-key op-key-dot op-c1"');
  });

  it("draws categorical heatmaps from inline rows or a dataset, with a color legend", () => {
    const inline = parse(CHART_EXAMPLES.heatmap);
    const plot = renderPlot(resolveView(inline));
    expect(plot.svg.match(/class="op-cell"/g)).toHaveLength(8);
    expect(plot.svg).toMatch(/style="fill:#[0-9a-f]{6}"/);
    expect(plot.tip(1).head).toBe("BUF · Q2");

    const ds = parse(demoPointsHeatmap());
    const v = resolveView(ds);
    expect(v.spec.series).toHaveLength(8);
    expect(v.spec.labels).toHaveLength(17);
    const fig = chartFigureHtml(ID, ds);
    expect(fig).toContain('class="op-scale"');
    expect(fig).toContain("linear-gradient(to right,");
    // Matrix table: one row header per team.
    expect(fig.match(/<th scope="row">/g)!.length).toBeGreaterThanOrEqual(8);
  });

  it("uses the theme-aware ramp by default so heatmaps adapt to dark mode", () => {
    const s = parse({ type: "heatmap", title: "t", labels: ["a", "b"], series: [{ name: "r", data: [0, 10] }] });
    expect(renderChartSvg(s)).toContain("color-mix(in oklab, var(--op-seq-hi) 100%, var(--op-seq-lo))");
  });

  it("bins spatial heatmaps on a field and only counts points inside it", () => {
    const s = parse(demoShotHeatmap());
    const view = resolveView(s);
    const { points } = pointsOf(view.spec, view.rows);
    const grid = spatialBins(view.spec, points);
    expect(grid.how).toBe("count");
    expect(grid.bins.reduce((a, b) => a + b.n, 0)).toBe(points.filter((p) => p.x <= 47).length);
    const plot = renderPlot(view);
    expect(plot.svg).toContain('class="op-field"');
    expect(plot.svg).toContain("<svg x="); // marks clipped to the half court
    expect(plot.tip(0).head).toMatch(/feet$/);
  });

  it("projects field presets with their true aspect ratio, rotated for vertical views", () => {
    const h = fieldFrame({ preset: "football" }, 680);
    expect(h.vertical).toBe(false);
    expect(h.H).toBeCloseTo((680 - 16) * (53.3 / 120) + 16, 0);
    const half = fieldFrame({ preset: "basketball", variant: "half" }, 400);
    expect(half.vertical).toBe(true);
    // Hoop (x 5.25) sits near the top in the default vertical half-court view.
    expect(half.project(5.25, 25)[1]).toBeLessThan(half.H / 4);
    const soccerHalf = fieldFrame({ preset: "soccer", variant: "half" }, 400);
    expect(soccerHalf.project(105, 34)[1]).toBeLessThan(soccerHalf.H / 4);
  });

  it("renders every demo chart at desktop and phone widths, with tables and feeds", () => {
    for (const d of DEMO_CHARTS) {
      const s = parse(d.build());
      const view = resolveView(s);
      for (const width of [680, 340]) {
        const plot = renderPlot(view, { width });
        expect(plot.W, d.key).toBe(width);
        expect(plot.svg).toMatch(/^<svg class="op-plot" viewBox="0 0 \d+ \d+"/);
        expect(plot.svg).not.toMatch(/NaN|undefined|Infinity/);
      }
      const fig = chartFigureHtml(ID, s);
      expect(fig).toContain("<table>");
      expect(chartFeedHtml(s)).not.toContain("<svg");
    }
  });
});

describe("color scales", () => {
  it("interpolates, quantizes, reverses and centers diverging domains", () => {
    expect(interpolateStops(["#000000", "#ffffff"], 0)).toBe("#000000");
    expect(interpolateStops(["#000000", "#ffffff"], 1)).toBe("#ffffff");
    const q = buildColorScale({ scheme: "blues", steps: 3 }, [0, 10]);
    expect(new Set([0, 1, 2, 4, 6, 9, 10].map((v) => q.t(v)))).toEqual(new Set([0, 0.5, 1]));
    expect(buildColorScale({ scheme: "blues", reverse: true }, [0, 10]).t(0)).toBe(1);
    const d = buildColorScale({ scheme: "redBlue" }, [-5, 20]);
    expect(d.domain).toEqual([-20, 0, 20]);
    expect(d.t(0)).toBe(0.5);
  });
});

describe("accessibility markup", () => {
  it("labels the plot, filters and data table", () => {
    const fig = chartFigureHtml(ID, parse(demoTrendWithFilters()));
    expect(fig).toMatch(/<svg class="op-plot"[^>]*role="img" aria-label="Weekly offense"/);
    expect(fig).toContain('<div class="op-filters" role="group" aria-label="Filter the chart">');
    expect(fig).toMatch(/<label class="op-filter"><span class="op-filter-label">Metric<\/span><select data-f="0" disabled>/);
    expect(fig).toContain('role="group" aria-label="Game date"');
    expect(fig).toMatch(/<input type="date" data-f="1" data-b="min" min="2024-09-08" max="2025-01-05"/);
    expect(fig).toContain('aria-live="polite">Showing 54 of 108 records');
    expect(fig).toContain('<th scope="col">');
    const chips = chartFigureHtml(ID, parse(demoShotHeatmap()));
    expect(chips).toContain('class="op-chip" data-f="1" data-k="0" aria-pressed="true" disabled');
  });

  it("escapes every spec string, including dataset values, field labels and filter labels", () => {
    const x = `"><img src=x onerror=alert(1)>`;
    const s = parse({
      type: "scatter",
      title: x,
      dataset: { fields: [{ name: "n", type: "string", label: x }, { name: "a", type: "number", label: x }, { name: "b", type: "number" }], rows: [[x, 1, 2], ["</script><script>alert(1)</script>", 2, 3]] },
      encoding: { x: "a", y: "b", series: "n", label: "n" },
      filters: [{ field: "n", label: x, control: "buttons" }],
      style: { showLabels: true, legend: { title: x } },
      annotations: { lines: [{ axis: "y", value: 1, label: x }] },
    });
    const html = chartFigureHtml(ID, s);
    expect(html).not.toMatch(/<img|<script>alert/);
    expect(html.match(/<script/g)).toHaveLength(1);
    const json = html.match(/<script type="application\/json" class="op-chart-spec">([\s\S]*?)<\/script>/)![1];
    expect(json).not.toContain("<");
  });
});

describe("custom visualization input and sandbox document", () => {
  it("rejects tags that load or navigate, script breakouts and @import", () => {
    const ok = { title: "t", js: "console.log(1)" };
    expect(customVizInput.safeParse(ok).success).toBe(true);
    expect(customVizInput.safeParse(DEMO_CUSTOM_VIZ).success).toBe(true);
    for (const html of ["<script>x</script>", "<SCRIPT src=x>", "<meta http-equiv=refresh content='0;url=//evil'>", "<base href=//evil>", "<link rel=prefetch href=//x>", "<iframe src=//x>", "<form action=//x>", "<object data=x>", "< embed src=x>"]) {
      expect(customVizInput.safeParse({ ...ok, html }).success, html).toBe(false);
    }
    expect(customVizInput.safeParse({ ...ok, js: "a='</script><img src=x>'" }).success).toBe(false);
    expect(customVizInput.safeParse({ ...ok, css: "@import url(//evil.css);" }).success).toBe(false);
    expect(customVizInput.safeParse({ ...ok, css: "</style><script>" }).success).toBe(false);
    expect(customVizInput.safeParse({ ...ok, data: "x".repeat(600_000) }).success).toBe(false);
  });

  it("closes the network and sandboxes the document via CSP", () => {
    const csp = frameCsp("abc", ["http://s.localhost:3000", "http://localhost:3000"]);
    for (const d of ["default-src 'none'", "script-src 'nonce-abc'", "connect-src 'none'", "form-action 'none'", "base-uri 'none'", "frame-src 'none'", "worker-src 'none'", "sandbox allow-scripts", "frame-ancestors http://s.localhost:3000 http://localhost:3000"]) {
      expect(csp).toContain(d);
    }
    expect(csp).not.toMatch(/allow-same-origin|allow-popups|allow-top-navigation|allow-forms|unsafe-eval|https?:\/\/\*|\s\*/);
  });

  it("only nonces our scripts, and data can't break out of its JSON block", () => {
    const doc = frameDocument({ title: "<t>", html: '<div onclick="x()">hi</div>', css: "", js: "draw()", data: { s: "</script><script>alert(1)</script>" } }, "N0NCE");
    expect(doc.match(/<script nonce="N0NCE">/g)).toHaveLength(2);
    expect(doc.match(/<script/g)).toHaveLength(3); // + the inert JSON block
    expect(doc).not.toContain("</script><script>alert");
    expect(doc).toContain("<title>&lt;t&gt;</title>");
  });

  it("embeds a sandboxed iframe only when allowed, with an accessible fallback either way", () => {
    const md = `{{viz:${ID}}}`;
    expect(vizIdsInMarkdown(md)).toEqual([ID]);
    const base = { id: ID, title: "Clock <x>", description: "Radial", height: 300, table: { fields: [{ name: "a", type: "number" as const }], rows: [[1]] } };
    const live = vizFigureHtml({ ...base, frameUrl: "http://localhost:3000/viz-frame/x?v=1" }, "page");
    expect(live).toContain('<iframe data-src="http://localhost:3000/viz-frame/x?v=1" title="Clock &lt;x&gt;" sandbox="allow-scripts" referrerpolicy="no-referrer"');
    expect(live).not.toMatch(/allow-same-origin/);
    expect(live).toContain("<table>");
    const off = embedViz(renderMarkdown(md), new Map([[ID, { ...base, frameUrl: null, notice: "Awaiting approval" }]]), "preview");
    expect(off).not.toContain("<iframe");
    expect(off).toContain("Awaiting approval");
    expect(embedViz(renderMarkdown(md), new Map([[ID, { ...base, frameUrl: null, notice: "Awaiting approval" }]]), "page")).not.toContain("Awaiting");
  });
});

describe("capabilities", () => {
  it("describes types, presets and the custom viz switch", () => {
    const c = visualizationCapabilities({ customVizEnabled: false });
    expect(c.chartTypes.map((t) => t.type)).toEqual(["line", "area", "bar", "pie", "donut", "scatter", "heatmap", "spatial_heatmap"]);
    expect(Object.keys(c.customization.fieldPresets)).toEqual(["football", "basketball", "soccer", "baseball"]);
    expect(c.customVisualizations.enabled).toBe(false);
    expect(c.customVisualizations.tools).toEqual([]);
    expect("jsonSchema" in c).toBe(false);
    const withSchema = visualizationCapabilities({ customVizEnabled: true, includeJsonSchema: true }) as { jsonSchema: { properties: Record<string, unknown> } };
    expect(Object.keys(withSchema.jsonSchema.properties)).toEqual(expect.arrayContaining(["type", "dataset", "encoding", "filters", "style", "field"]));
  });
});
