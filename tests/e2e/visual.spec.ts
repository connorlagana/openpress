import { test } from "@playwright/test";
import { connectAgent, signUpAndCreateSite } from "./helpers";

// Screenshot tour for design review. Run with: SCREENSHOT_DIR=/some/dir pnpm test:e2e visual
const dir = process.env.SCREENSHOT_DIR;
test.skip(!dir, "set SCREENSHOT_DIR to capture screenshots");

const ARTICLE = `AI coding agents can now write, test and ship meaningful code. That raises a fair question for anyone who writes software for a living.

## What actually changes

The bottleneck moves from *typing code* to **deciding what to build** and verifying that it works.

- Clear specifications matter more than ever
- Code review becomes the core skill
- Systems thinking beats syntax recall

> The best engineers were never paid to type.

## What stays the same

Understanding users, owning outcomes, and debugging production at 2am.

\`\`\`ts
const answer = await agent.run("ship it");
\`\`\``;

for (const template of ["Editorial", "Launch", "Portfolio"] as const) {
  test(`tour: ${template}`, async ({ page, baseURL }) => {
    const sub = `${template.toLowerCase()}-${Date.now().toString(36)}`;
    await page.setViewportSize({ width: 1280, height: 860 });
    await signUpAndCreateSite(page, { siteName: template === "Portfolio" ? "Ada Lovelace" : "The Engineering Journal", subdomain: sub, template });
    if (template === "Editorial") await page.screenshot({ path: `${dir}/dashboard-agents.png`, fullPage: true });
    const { call } = await connectAgent(page, `${baseURL}/mcp`);
    const siteId = (await call("list_sites")).structuredContent!.sites[0].id;
    const img = await call("upload_media", { siteId, sourceUrl: "https://picsum.photos/id/180/1200/630", altText: "Laptop on a desk" });
    const coverMediaId = img.isError ? undefined : img.structuredContent!.media.id;
    for (const title of ["Will AI Replace Software Engineers?", "Notes on Writing Good Specs", "Code Review Is the New Coding"]) {
      const p = (await call("create_post", { siteId, title, content: ARTICLE, coverMediaId, tags: ["ai", "engineering"] })).structuredContent!.post;
      await call("publish_post", { postId: p.id });
    }
    if (template === "Launch") {
      await call("update_site_settings", {
        siteId,
        settings: {
          hero: { headline: "Ship docs your users actually read", subheadline: "OpenPress turns your changelog and guides into a fast, searchable site your AI agent keeps up to date.", ctaLabel: "Start free", ctaUrl: "/blog", secondaryCtaLabel: "Read the blog", secondaryCtaUrl: "/blog" },
        },
      });
    }
    if (template === "Portfolio") {
      await call("update_site_settings", {
        siteId,
        settings: {
          about: "Engineer and writer. I build tools for people who build things.",
          socialLinks: [{ label: "GitHub", url: "https://github.com" }, { label: "Email", url: "mailto:ada@example.com" }],
          projects: [
            { title: "Analytical Engine", description: "A general-purpose mechanical computer.", tags: ["hardware"] },
            { title: "Note G", description: "The first published algorithm.", tags: ["math"] },
            { title: "OpenPress", description: "Websites your agent can publish.", tags: ["web"] },
          ],
        },
      });
    }
    const site = `http://${sub}.localhost:3100`;
    await page.goto(site + "/");
    await page.screenshot({ path: `${dir}/${template}-home.png`, fullPage: true });
    await page.goto(site + "/blog/will-ai-replace-software-engineers");
    await page.screenshot({ path: `${dir}/${template}-post.png`, fullPage: true });
    if (template === "Editorial") {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `${dir}/${template}-post-mobile.png`, fullPage: true });
      await page.setViewportSize({ width: 1280, height: 860 });
      await page.goto(`/dashboard/sites/${siteId}`);
      await page.screenshot({ path: `${dir}/dashboard-posts.png`, fullPage: true });
      await page.getByRole("link", { name: "Will AI Replace Software Engineers?" }).click();
      await page.waitForURL(/posts\//);
      await page.screenshot({ path: `${dir}/dashboard-editor.png`, fullPage: true });
      await page.goto(`/dashboard/sites/${siteId}/appearance`);
      await page.screenshot({ path: `${dir}/dashboard-appearance.png`, fullPage: true });
      await page.goto(`/dashboard/sites/${siteId}/analytics`);
      await page.screenshot({ path: `${dir}/dashboard-analytics.png`, fullPage: true });
      await page.goto(`/dashboard/account`);
      await page.screenshot({ path: `${dir}/dashboard-account.png`, fullPage: true });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/`);
      await page.screenshot({ path: `${dir}/landing.png`, fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/`);
      await page.screenshot({ path: `${dir}/landing-mobile.png`, fullPage: true });
    }
  });
}
