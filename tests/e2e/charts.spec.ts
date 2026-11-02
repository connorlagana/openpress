import { expect, test } from "@playwright/test";
import { connectAgent, signUpAndCreateSite } from "./helpers";

// Optional screenshots for design review: SCREENSHOT_DIR=/some/dir pnpm test:e2e charts
const dir = process.env.SCREENSHOT_DIR;

test("agent creates charts, embeds them, readers get interactive charts, and updates flow through", async ({ page, baseURL }) => {
  const sub = `charts-${Date.now().toString(36)}`;
  await signUpAndCreateSite(page, { siteName: "Bills Notebook", subdomain: sub });
  const { call } = await connectAgent(page, `${baseURL}/mcp`);
  const siteId = (await call("list_sites")).structuredContent!.sites[0].id;

  const line = (
    await call("create_chart", {
      siteId,
      type: "line",
      title: "Josh Allen's Development",
      subtitle: "Completion percentage · Wyoming and Buffalo Bills",
      source: "Pro Football Reference",
      labels: ["2017 College", "2018 NFL", "2019 NFL", "2020 NFL"],
      series: [
        { name: "Josh Allen", data: [56.3, 52.8, 58.8, 69.2] },
        { name: "League average", data: [null, 62.1, 63.1, 65.2] },
      ],
      valueFormat: { suffix: "%", decimals: 1 },
    })
  ).structuredContent!.chart;
  const bar = (
    await call("create_chart", {
      siteId,
      type: "bar",
      stacked: true,
      title: "Touchdowns by type",
      labels: ["2018", "2019", "2020", "2021"],
      series: [
        { name: "Passing", data: [10, 20, 37, 36] },
        { name: "Rushing", data: [8, 9, 8, 6] },
      ],
    })
  ).structuredContent!.chart;
  const donut = (
    await call("create_chart", {
      siteId,
      type: "donut",
      title: "2020 targets by position",
      labels: ["WR", "TE", "RB"],
      series: [{ name: "Targets", data: [402, 98, 112] }],
    })
  ).structuredContent!.chart;

  const post = (
    await call("create_post", {
      siteId,
      title: "The leap",
      content: `Year three changed everything.\n\n${line.embed}\n\nAnd the scoring followed.\n\n${bar.embed}\n\n${donut.embed}`,
    })
  ).structuredContent!.post;
  const url: string = (await call("publish_post", { postId: post.id })).structuredContent!.post.url;

  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(url);
  const fig = page.locator(`figure.op-chart[data-chart="${line.id}"]`);
  await expect(fig.getByText("Josh Allen's Development")).toBeVisible();
  await expect(page.locator("figure.op-chart svg.op-plot")).toHaveCount(3);
  await expect(page.getByRole("img", { name: /Josh Allen's Development/ })).toBeVisible();

  // Hover shows every series at that label; values lead.
  const plot = fig.locator(".op-chart-body");
  await fig.locator('.op-hit[data-i="3"]').hover();
  const tip = fig.locator(".op-tip");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("2020 NFL");
  await expect(tip).toContainText("69.2%");
  await expect(tip).toContainText("65.2%");
  if (dir) await fig.screenshot({ path: `${dir}/chart-line-hover.png` });

  // Toggle a series off: it disappears from the plot and the tooltip.
  const toggle = fig.getByRole("button", { name: "League average" });
  await expect(toggle).toBeEnabled();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(fig.locator("svg .op-c1")).toHaveCount(0);
  await toggle.click();

  // Keyboard: focus + arrows read values.
  await page.mouse.move(0, 0);
  await plot.focus();
  await page.keyboard.press("ArrowRight");
  await expect(tip).toContainText("2018 NFL");

  // Data table for everyone.
  await fig.getByText("View data").click();
  await expect(fig.getByRole("cell", { name: "52.8%" })).toBeVisible();
  if (dir) await page.screenshot({ path: `${dir}/chart-post-desktop.png`, fullPage: true });

  // Phones: re-rendered at the real width, no horizontal scroll.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const vb = await page.locator(`figure.op-chart[data-chart="${line.id}"] svg.op-plot`).getAttribute("viewBox");
  expect(Number(vb!.split(" ")[2])).toBeLessThan(400);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (dir) await page.screenshot({ path: `${dir}/chart-post-mobile.png`, fullPage: true });

  // Updating the chart updates the published post with no post edit.
  await call("update_chart", { chartId: bar.id, labels: ["2018", "2019", "2020", "2021", "2022"], series: [{ name: "Passing", data: [10, 20, 37, 36, 35] }, { name: "Rushing", data: [8, 9, 8, 6, 7] }] });
  await page.reload();
  await expect(page.locator(`figure.op-chart[data-chart="${bar.id}"] .op-hit`)).toHaveCount(5);
});
