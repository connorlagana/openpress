import { expect, test } from "@playwright/test";

test("journal is immediately readable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://localhost:3100/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /Skip intro|Replay conversation/ })).toHaveCount(0);
  await page.getByRole("link", { name: /Read the story/ }).click();
  await expect(page).toHaveURL(/\/journal\/learn-by-making/);
  await expect(page.locator("article h1")).toHaveText("Learn by making something small.");
  await context.close();
});

test("journal fits desktop and mobile without an intro", async ({ page }, testInfo) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator(".op-journal")).toBeVisible();
    await expect(page.locator(".op-journal")).not.toHaveAttribute("inert");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: testInfo.outputPath(`landing-${width}.png`) });
  }
});

test("journal articles are readable and unknown stories return 404", async ({ page, request }) => {
  for (const slug of ["learn-by-making", "a-small-place-on-the-web"]) {
    await page.goto(`/journal/${slug}`);
    await expect(page.locator("article h1")).toBeVisible();
    await expect(page.locator("article section")).toHaveCount(4);
  }
  expect((await request.get("/journal/not-a-real-story")).status()).toBe(404);
});
