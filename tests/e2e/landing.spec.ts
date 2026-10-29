import { expect, test } from "@playwright/test";

test("landing: blog pitch, example blogs, starter prompts, install tabs switch", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Create a blog from the conversations");
  await expect(page.locator("#examples .wb-marquee__item").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "How to create a blog for free" })).toBeVisible();
  await expect(page.locator("#steps li")).toHaveCount(5);

  const examples = page.locator("#prompt");
  await expect(examples.locator("[data-prompt]")).toHaveCount(3);
  await expect(examples.locator("[data-prompt]").first()).toContainText("Use OpenPress to start a blog based on my interests");

  const connect = page.locator("#connect");
  await connect.getByRole("tab", { name: "Cursor" }).click();
  await expect(connect.getByRole("link", { name: /Add to Cursor/ })).toHaveAttribute("href", /^cursor:\/\/anysphere\.cursor-deeplink\/mcp\/install\?name=openpress&config=/);

  const llms = await page.request.get("/llms.txt");
  expect(llms.ok()).toBe(true);
  expect(await llms.text()).toContain("- publish_post:");
});

test("landing has no horizontal scroll on a phone, and a static gallery with reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator(".wb-marquee__track")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".wb-marquee__set[aria-hidden]")).toBeHidden();
});
