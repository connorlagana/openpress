import { expect, test } from "@playwright/test";

test("landing is readable without JavaScript and links to the guides", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://localhost:3100/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: /Learn by making something small/ }).click();
  await expect(page).toHaveURL(/\/journal\/learn-by-making/);
  await expect(page.locator("article h1")).toHaveText("Learn by making something small.");
  await context.close();
});

test("landing fits desktop and mobile", async ({ page }, testInfo) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator(".wb-hero")).toBeVisible();
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
