import { expect, test } from "@playwright/test";
import { connectAgent, signUpAndCreateSite } from "../e2e/helpers";

test("live: sign up → connect agent over OAuth → upload image → publish → public URL → owner deletes", async ({ page, baseURL, request }) => {
  const sub = `smoke-${Date.now().toString(36)}`;
  await signUpAndCreateSite(page, { siteName: "Smoke Test", subdomain: sub });
  const { call } = await connectAgent(page, `${baseURL}/mcp`);

  const site = (await call("list_sites")).structuredContent!.sites[0];
  expect(site.url).toBe(`${new URL(baseURL!).protocol}//${sub}.${new URL(baseURL!).host}`);

  const media = await call("upload_media", { siteId: site.id, sourceUrl: `${baseURL}/images/landing/coffee.jpg`, altText: "Coffee beans" });
  expect(media.isError, JSON.stringify(media.content)).toBeFalsy();
  const mediaUrl = media.structuredContent!.media?.url ?? media.structuredContent!.url;
  expect((await request.get(mediaUrl)).headers()["content-type"]).toMatch(/^image\//);

  const post = (await call("create_post", { siteId: site.id, title: "Hello from the smoke test", content: "## It works\n\nPublished by an agent.", coverMediaId: media.structuredContent!.media?.id ?? media.structuredContent!.id })).structuredContent!.post;
  const published = await call("publish_post", { postId: post.id });
  expect(published.isError, JSON.stringify(published.content)).toBeFalsy();
  const liveUrl = published.structuredContent!.post?.url ?? published.structuredContent!.url;

  const res = await request.get(liveUrl);
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain("Hello from the smoke test");
  expect(html).toContain('<link rel="canonical"');
  expect((await request.get(`${site.url}/sitemap.xml`)).status()).toBe(200);
  await page.goto(liveUrl);
  await expect(page.getByRole("heading", { name: "Hello from the smoke test" })).toBeVisible();

  // The default consent doesn't grant sites:delete, so the agent is refused outright (no confirmation token).
  const refused = await call("delete_site", { siteId: site.id });
  expect(refused.isError).toBe(true);
  expect(refused.structuredContent?.confirmation_token).toBeUndefined();

  // Clean up as the owner, from the dashboard.
  await page.goto(`/dashboard/sites/${site.id}/settings`);
  await page.getByLabel(new RegExp(`Type .${sub}. to confirm`)).fill(sub);
  await page.getByRole("button", { name: "Delete site" }).click();
  await expect(page).not.toHaveURL(/settings/);
  expect((await request.get(liveUrl)).status()).toBe(404);
});
