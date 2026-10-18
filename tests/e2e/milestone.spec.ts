import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { OAuthClientInformationMixed, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { expect, test } from "@playwright/test";

const CALLBACK = "http://127.0.0.1:43123/callback";

class BrowserProvider implements OAuthClientProvider {
  info?: OAuthClientInformationMixed;
  tok?: OAuthTokens;
  verifier = "";
  authUrl?: URL;
  redirectUrl = CALLBACK;
  clientMetadata = { client_name: "E2E Agent", redirect_uris: [CALLBACK], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" };
  clientInformation = () => this.info;
  saveClientInformation = (i: OAuthClientInformationMixed) => void (this.info = i);
  tokens = () => this.tok;
  saveTokens = (t: OAuthTokens) => void (this.tok = t);
  redirectToAuthorization = (u: URL) => void (this.authUrl = u);
  saveCodeVerifier = (v: string) => void (this.verifier = v);
  codeVerifier = () => this.verifier;
}

type ToolResult = { isError?: boolean; structuredContent?: Record<string, any> };

test("sign up → create site → connect MCP client via OAuth → agent publishes → public URL works", async ({ page, baseURL }) => {
  const email = `e2e-${Date.now()}@example.com`;

  // 1. Sign up
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a-very-good-password");
  await page.getByRole("button", { name: "Create free account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  // 2. Create site
  const sub = `journal-${Date.now().toString(36)}`;
  await page.getByLabel("Site name").fill("The Engineering Journal");
  await page.locator("#subdomain").fill(sub);
  await expect(page.getByText("Available")).toBeVisible();
  await page.getByRole("button", { name: "Create site" }).click();
  await expect(page).toHaveURL(/\/dashboard\/agents\?welcome=/);
  await expect(page.getByText("Now connect your agent")).toBeVisible();
  const mcpUrl = `${baseURL}/mcp`;
  await expect(page.getByText(mcpUrl).first()).toBeVisible();

  // 3. Connect an MCP client with the official SDK, approving in the browser.
  const provider = new BrowserProvider();
  const client = new Client({ name: "e2e-agent", version: "1.0.0" });
  await expect(client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl), { authProvider: provider }))).rejects.toBeInstanceOf(UnauthorizedError);
  expect(provider.authUrl).toBeTruthy();

  await page.route("http://127.0.0.1:43123/**", (route) => route.fulfill({ status: 200, body: "ok" }));
  await page.goto(provider.authUrl!.toString());
  await expect(page.getByRole("heading", { name: /Allow E2E Agent/ })).toBeVisible();
  await page.getByRole("button", { name: "Allow access" }).click();
  await page.waitForURL(/127\.0\.0\.1:43123\/callback/);
  const code = new URL(page.url()).searchParams.get("code")!;
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), { authProvider: provider });
  await transport.finishAuth(code);
  await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl), { authProvider: provider }));

  // 4. Agent creates and publishes an article.
  const call = async (name: string, args: Record<string, unknown> = {}) => (await client.callTool({ name, arguments: args })) as ToolResult;
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

  // 7. The dashboard shows the agent-written post as published and the connection.
  await page.goto(`/dashboard/sites/${sites[0].id}`);
  await expect(page.getByRole("link", { name: "Will AI Replace Software Engineers?" })).toBeVisible();
  await expect(page.getByText("by agent")).toBeVisible();
  await page.goto("/dashboard/agents");
  await expect(page.getByText("E2E Agent").first()).toBeVisible();
});
