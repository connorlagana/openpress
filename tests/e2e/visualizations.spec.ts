import { expect, test, type Page } from "@playwright/test";
import { DEMO_CHARTS, DEMO_CUSTOM_VIZ } from "../../src/lib/charts/demo";
import { connectAgent, signUpAndCreateSite } from "./helpers";

// Optional screenshots for design review: SCREENSHOT_DIR=/some/dir pnpm test:e2e visualizations
const dir = process.env.SCREENSHOT_DIR;
const shot = async (page: Page, name: string, locator?: ReturnType<Page["locator"]>) => {
  if (!dir) return;
  if (locator) await locator.screenshot({ path: `${dir}/${name}.png` });
  else await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
};

// One account for both tests: signups are rate limited per IP across the whole suite.
test.describe.configure({ mode: "serial" });
let page: Page;
let call: Awaited<ReturnType<typeof connectAgent>>["call"];
let siteId: string;

test.beforeAll(async ({ browser, baseURL }) => {
  page = await browser.newPage();
  await signUpAndCreateSite(page, { siteName: "Viz Lab", subdomain: `viz-${Date.now().toString(36)}` });
  ({ call } = await connectAgent(page, `${baseURL}/mcp`));
  siteId = (await call("list_sites")).structuredContent!.sites[0].id;
});
test.afterAll(() => page?.close());

test("agent builds every chart type; readers filter, hover and navigate by keyboard on desktop and phone", async () => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  expect((await call("get_visualization_capabilities")).structuredContent!.customVisualizations.enabled).toBe(true);

  const ids: Record<string, string> = {};
  const embeds: string[] = [];
  for (const d of DEMO_CHARTS) {
    const res = await call("create_chart", { siteId, ...d.build() });
    expect(res.isError, res.content[0]?.text).toBeFalsy();
    ids[d.key] = res.structuredContent!.chart.id;
    embeds.push(`## ${d.key}\n\n${res.structuredContent!.chart.embed}`);
  }
  const post = (await call("create_post", { siteId, title: "Every visualization", content: embeds.join("\n\n") })).structuredContent!.post;
  const url: string = (await call("publish_post", { postId: post.id })).structuredContent!.post.url;

  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(url);
  await expect(page.locator("figure.op-chart svg.op-plot")).toHaveCount(DEMO_CHARTS.length);
  const fig = (key: string) => page.locator(`figure.op-chart[data-chart="${ids[key]}"]`);

  // Scatter: season filter re-renders in place (no navigation), tooltips name the player.
  const qb = fig("qb-scatter");
  const season = qb.getByRole("combobox", { name: "Season", exact: true });
  await expect(season).toBeEnabled();
  await expect(qb.locator(".op-chart-note")).toHaveText("Showing 12 of 36 records");
  const before = await qb.locator("svg.op-plot").innerHTML();
  const navigations: string[] = [];
  page.on("framenavigated", (f) => f === page.mainFrame() && navigations.push(f.url()));
  await season.selectOption({ label: "2022" });
  await expect(qb.locator(".op-chart-note")).toHaveText("Showing 12 of 36 records");
  expect(await qb.locator("svg.op-plot").innerHTML()).not.toBe(before);
  expect(navigations).toEqual([]);
  const pt = qb.locator("circle.op-pt").first();
  await pt.hover();
  await expect(qb.locator(".op-tip")).toBeVisible();
  await expect(qb.locator(".op-tip")).toContainText("CPOE, EPA/play");
  await shot(page, "viz-scatter-hover", qb);

  // Keyboard: focus the plot and arrow between points / cells.
  await page.mouse.move(0, 0);
  await qb.locator(".op-chart-body").focus();
  const tip = qb.locator(".op-tip");
  await expect(tip).toBeVisible();
  const first = await tip.textContent();
  await page.keyboard.press("ArrowRight");
  await expect(tip).not.toHaveText(first!);
  await page.keyboard.press("Escape");
  await expect(tip).toBeHidden();

  const heat = fig("points-heatmap");
  await heat.locator(".op-chart-body").focus();
  await expect(heat.locator(".op-tip-head")).toHaveText(/Harbor Hawks · 1$/);
  await page.keyboard.press("ArrowDown");
  await expect(heat.locator(".op-tip-head")).toHaveText(/Ridge Rams · 1$/);
  await page.keyboard.press("ArrowRight");
  await expect(heat.locator(".op-tip-head")).toHaveText(/Ridge Rams · 2$/);
  await shot(page, "viz-heatmap-keyboard", heat);

  // Spatial heatmap: player select + season chips, the data table follows.
  const shots = fig("shot-heatmap");
  await shots.getByRole("combobox", { name: "Player", exact: true }).selectOption({ label: "Big C" });
  await expect(shots.locator(".op-chart-note")).toHaveText("Showing 520 of 1,560 records");
  await shots.getByRole("button", { name: "2023-24" }).click();
  await expect(shots.getByRole("button", { name: "2023-24" })).toHaveAttribute("aria-pressed", "false");
  await expect(shots.locator(".op-chart-note")).toHaveText("Showing 260 of 1,560 records");
  await shots.getByText("View data").click();
  await expect(shots.locator(".op-chart-table th").first()).toHaveText("X range");
  await shot(page, "viz-shot-heatmap", shots);

  // Line from a long-format dataset: metric select + date range.
  const trend = fig("trend-filters");
  await expect(trend.locator(".op-hit")).toHaveCount(18);
  await trend.getByRole("combobox", { name: "Metric", exact: true }).selectOption({ label: "Total yards" });
  const from = trend.locator('input[data-b="min"]');
  await from.fill("2024-10-06");
  await from.dispatchEvent("change");
  await expect(trend.locator(".op-hit")).toHaveCount(14);
  await expect(trend.locator(".op-legend-slot")).toContainText("Harbor Hawks");
  await shot(page, "viz-trend-filters", trend);

  for (const key of ["soccer-shots", "pass-targets", "spray-chart", "differential-heatmap", "custom-bar"]) await shot(page, `viz-${key}`, fig(key));
  await shot(page, "viz-post-desktop");

  // Phones: every chart redraws at the real width, nothing scrolls sideways.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator("figure.op-chart svg.op-plot")).toHaveCount(DEMO_CHARTS.length);
  for (const key of Object.keys(ids)) {
    const vb = await fig(key).locator("svg.op-plot").getAttribute("viewBox");
    expect(Number(vb!.split(" ")[2]), key).toBeLessThan(400);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // Touch: tapping a point shows its tooltip.
  await fig("spray-chart").locator("circle.op-pt").nth(3).dispatchEvent("pointerdown", { pointerType: "touch" });
  await shot(page, "viz-post-mobile");
  expect(errors).toEqual([]);
});

test("custom visualization runs only after approval, inside a sandbox with no network or page access", async ({ baseURL }) => {
  await page.setViewportSize({ width: 1200, height: 900 });

  // Chromium reports CSP-blocked attempts as failed requests; anything that got
  // a response (or failed for another reason) would be a real leak.
  const leaked: string[] = [];
  const blocked: string[] = [];
  page.on("response", (r) => r.url().includes("should-not-load") && leaked.push(`${r.status()} ${r.url()}`));
  page.on("requestfailed", (r) => {
    if (!r.url().includes("should-not-load")) return;
    const why = r.failure()?.errorText ?? "";
    (/csp/i.test(why) ? blocked : leaked).push(`${why} ${r.url()}`);
  });

  const probe = (await call("create_custom_visualization", {
    siteId,
    title: "Sandbox probe",
    description: "Tries to escape; reports what it could reach.",
    html: '<pre id="r">running</pre>',
    js: `const res = {};
try { res.cookie = document.cookie === "" ? "empty" : "READ"; } catch (e) { res.cookie = "blocked"; }
try { localStorage.setItem("x", "1"); res.storage = "WRITE"; } catch (e) { res.storage = "blocked"; }
try { res.parent = parent.document.title ? "READ" : "?"; } catch (e) { res.parent = "blocked"; }
try { res.top = window.open("${baseURL}/should-not-load-popup") ? "OPENED" : "blocked"; } catch (e) { res.top = "blocked"; }
const img = new Image(); img.src = "${baseURL}/should-not-load.png";
const done = () => { document.getElementById("r").textContent = JSON.stringify(res); OpenPress.resize(); };
fetch("${baseURL}/should-not-load-fetch").then(() => { res.fetch = "OK"; done(); }, () => { res.fetch = "blocked"; done(); });`,
    table: { fields: [{ name: "check", type: "string" }], rows: [["cookie"], ["storage"]] },
    height: 160,
  })).structuredContent!.visualization;
  const clock = (await call("create_custom_visualization", { siteId, ...DEMO_CUSTOM_VIZ })).structuredContent!.visualization;
  expect(probe.status).toBe("pending_approval");

  const post = (await call("create_post", { siteId, title: "Sandboxed", content: `${probe.embed}\n\n${clock.embed}` })).structuredContent!.post;
  const url: string = (await call("publish_post", { postId: post.id })).structuredContent!.post.url;

  // Pending: readers get the accessible fallback, no frame.
  await page.goto(url);
  await expect(page.locator("figure.op-viz")).toHaveCount(2);
  await expect(page.locator("figure.op-viz iframe")).toHaveCount(0);
  await expect(page.getByText("Sandbox probe")).toBeVisible();

  // The owner reviews and approves in the dashboard (with a sandboxed preview).
  for (const v of [probe, clock]) {
    await page.goto(v.approvalUrl);
    await expect(page.getByRole("heading", { name: v.title })).toBeVisible();
    await expect(page.getByText("Needs review")).toBeVisible();
    await expect(page.locator("iframe[sandbox='allow-scripts']")).toHaveCount(1);
    if (v === clock) await shot(page, "viz-review");
    await page.getByRole("button", { name: "Approve this code" }).click();
    await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();
  }

  await page.goto(url);
  const frames = page.locator("figure.op-viz iframe");
  await expect(frames).toHaveCount(2);
  await expect(frames.first()).toHaveAttribute("sandbox", "allow-scripts");
  const result = page.frameLocator(`figure.op-viz[data-viz="${probe.id}"] iframe`).locator("#r");
  await expect(result).toHaveText(/\{.*\}/);
  expect(JSON.parse((await result.textContent())!)).toEqual({ cookie: "blocked", storage: "blocked", parent: "blocked", top: "blocked", fetch: "blocked" });
  expect(leaked).toEqual([]);
  expect(blocked.length).toBeGreaterThan(0);
  await expect(page.frameLocator(`figure.op-viz[data-viz="${clock.id}"] iframe`).locator("path")).toHaveCount(1);
  await shot(page, "viz-custom-approved");

  // Changing the code locks it again until re-approved.
  await call("update_custom_visualization", { vizId: clock.id, js: "document.body.textContent = 'v2'" });
  await page.reload();
  await expect(page.locator(`figure.op-viz[data-viz="${clock.id}"] iframe`)).toHaveCount(0);
  await expect(page.locator(`figure.op-viz[data-viz="${probe.id}"] iframe`)).toHaveCount(1);
});
