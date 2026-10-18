import { expect, test } from "@playwright/test";
import { connectAgent, signUpAndCreateSite } from "./helpers";

test("sign up → create site → connect MCP client via OAuth → agent publishes → public URL works", async ({ page, baseURL }) => {
  // 1-2. Sign up and create a site through the UI.
  const sub = `journal-${Date.now().toString(36)}`;
  await signUpAndCreateSite(page, { siteName: "The Engineering Journal", subdomain: sub });
  await expect(page.getByText("Now connect your agent")).toBeVisible();
  const connectUrl = page.url();
  await expect(page.getByText("Waiting for your agent to connect")).toBeVisible();
  const mcpUrl = `${baseURL}/mcp`;
  await expect(page.getByText(mcpUrl).first()).toBeVisible();

  // 3. Connect an MCP client with the official SDK, approving in the browser.
  const { call } = await connectAgent(page, mcpUrl);

  // 4. Agent creates and publishes an article.
  const sites = (await call("list_sites")).structuredContent!.sites;
  expect(sites).toHaveLength(1);
  const post = (
    await call("create_post", {
      siteId: sites[0].id,
      title: "Will AI Replace Software Engineers?",
      content: "## Short answer\n\nNo, but the job is changing fast.\n\n- Specs matter more\n- Review matters more",
      seoDescription: "A pragmatic look at how AI coding agents change software engineering work.",
      tags: ["ai"],
    })
  ).structuredContent!.post;
  expect(post.status).toBe("draft");

  // Draft is not public.
  const draftRes = await page.goto(`http://${sub}.localhost:3100/blog/${post.slug}`);
  expect(draftRes?.status()).toBe(404);

  const published = await call("publish_post", { postId: post.id });
  expect(published.structuredContent!.status).toBe("published");
  const liveUrl: string = published.structuredContent!.post.url;
  expect(liveUrl).toBe(`http://${sub}.localhost:3100/blog/will-ai-replace-software-engineers`);

  // 5. Visit the public URL.
  const res = await page.goto(liveUrl);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Will AI Replace Software Engineers?" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Short answer" })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", liveUrl);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Will AI Replace Software Engineers?");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /pragmatic look/);
  expect(await page.locator('script[type="application/ld+json"]').textContent()).toContain('"@type":"BlogPosting"');

  // Homepage, RSS and sitemap include it.
  await page.goto(`http://${sub}.localhost:3100/`);
  await expect(page.getByRole("link", { name: "Will AI Replace Software Engineers?" })).toBeVisible();
  const rss = await page.request.get(`http://${sub}.localhost:3100/rss.xml`);
  expect(await rss.text()).toContain("<title>Will AI Replace Software Engineers?</title>");
  const sitemap = await page.request.get(`http://${sub}.localhost:3100/sitemap.xml`);
  expect(await sitemap.text()).toContain(`/blog/will-ai-replace-software-engineers`);

  // 6. Slug change on a published post leaves a 301.
  await call("update_post_seo", { postId: post.id, slug: "ai-and-software-engineers" });
  const old = await page.request.get(liveUrl, { maxRedirects: 0 });
  // Next.js permanentRedirect() emits 308, which search engines treat like 301.
  expect(old.status()).toBe(308);
  expect(old.headers()["location"]).toContain("/blog/ai-and-software-engineers");

  // The public site's footer credits OpenPress with an attributed link, and the landing page credits the site back.
  await page.goto(liveUrl.replace(/\/blog\/.*/, "/"));
  const footer = page.getByRole("link", { name: /Published with/ });
  await expect(footer).toHaveAttribute("href", new RegExp(`\\?ref=${sub}&`));
  await page.goto(`/?ref=${sub}&utm_source=site`);
  await expect(page.getByText("was built and published by an AI agent")).toBeVisible();
  await expect.poll(async () => (await page.context().cookies()).find((c) => c.name === "op_ref")?.value).toBe(`site:${sub}`);

  // The onboarding screen noticed both the connection and the first publish.
  await page.goto(connectUrl);
  await expect(page.getByText("E2E Agent connected")).toBeVisible();
  await expect(page.getByText("First post published")).toBeVisible();

  // 7. The dashboard shows the agent-written post as published and the connection.
  await page.goto(`/dashboard/sites/${sites[0].id}`);
  await expect(page.getByRole("link", { name: "Will AI Replace Software Engineers?" })).toBeVisible();
  await expect(page.getByText("by agent")).toBeVisible();
  await page.goto("/dashboard/agents");
  await expect(page.getByText("E2E Agent").first()).toBeVisible();
});
