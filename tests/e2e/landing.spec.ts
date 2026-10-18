import { expect, test } from "@playwright/test";

test("landing: story finishes, example prompts render, install tabs switch", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Websites your AI agent");
  // Scroll through the pinned story: the agent panel ends with the live URL.
  const story = page.locator("#how");
  const box = (await story.boundingBox())!;
  for (let y = 0; y <= box.height; y += 400) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(30);
  }
  await expect(story.getByText("● Live")).toHaveCSS("opacity", "1");
  await expect(story.getByText("Draft", { exact: true })).toHaveCSS("opacity", "0");

  const examples = page.locator("#prompt");
  await expect(examples.locator("[data-prompt]")).toHaveCount(3);
  await expect(examples.locator("[data-prompt]").first()).toContainText('Use OpenPress to start a travel blog');

  const connect = page.locator("#connect");
  await connect.getByRole("tab", { name: "Cursor" }).click();
  await expect(connect.getByRole("link", { name: /Add to Cursor/ })).toHaveAttribute("href", /^cursor:\/\/anysphere\.cursor-deeplink\/mcp\/install\?name=openpress&config=/);

  const llms = await page.request.get("/llms.txt");
  expect(llms.ok()).toBe(true);
  expect(await llms.text()).toContain("- publish_post:");
});

test("landing has no horizontal scroll on a phone, and a static story with reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.getByRole("heading", { name: "One prompt. Six tool calls. A live site." })).toBeVisible();
  // Static story shows the finished site.
  await expect(page.locator("#how").getByText("● Live")).toHaveCSS("opacity", "1");
});
