import { expect, test } from "@playwright/test";

test("landing: prompt builder produces a prompt, demo finishes, install tabs switch", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Websites your AI agent");
  // Scroll through the pinned story: the agent panel ends with the live URL.
  const story = page.locator("#how");
  const box = (await story.boundingBox())!;
  for (let y = 0; y <= box.height; y += 400) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(30);
  }
  await expect(page.getByText(/Live at field-notes\./)).toHaveCSS("opacity", "1");

  const builder = page.locator("#prompt");
  await builder.getByRole("button", { name: "A portfolio" }).click();
  await builder.getByPlaceholder("The Engineering Journal").fill("Ada Lovelace");
  await builder.getByPlaceholder(/how AI is changing/).fill("my work on the Analytical Engine");
  await builder.getByRole("button", { name: "Next" }).click();
  await builder.getByRole("button", { name: "Bold and modern" }).click();
  await builder.getByRole("button", { name: "Let me review first" }).click();
  const prompt = builder.getByText(/^Use Folio to create/);
  await expect(prompt).toContainText('called "Ada Lovelace" with the portfolio template');
  await expect(prompt).toContainText("save it as a draft");

  const connect = page.locator("#connect");
  await connect.getByRole("tab", { name: "Cursor" }).click();
  await expect(connect.getByRole("link", { name: /Add to Cursor/ })).toHaveAttribute("href", /^cursor:\/\/anysphere\.cursor-deeplink\/mcp\/install\?name=folio&config=/);

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
  await expect(page.getByRole("heading", { name: "Folio turns every screen into a tool call." })).toBeVisible();
});
