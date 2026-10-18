import { beforeAll, describe, expect, it } from "vitest";
import { getPublishedPost } from "@/server/public/data";
import { appFetch, call, connectWithApiKey, makeUser } from "../helpers";

describe("MCP server over Streamable HTTP", () => {
  let userId: string;
  beforeAll(async () => {
    userId = (await makeUser("mcp")).user.id;
  });

  it("rejects unauthenticated requests with a resource_metadata challenge", async () => {
    const res = await appFetch("https://folio.test/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "x", version: "1" } } }),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain('resource_metadata="https://folio.test/.well-known/oauth-protected-resource/mcp"');
  });

  it("rejects a bogus bearer token", async () => {
    const res = await appFetch("https://folio.test/mcp", { method: "POST", headers: { authorization: "Bearer fol_at_nope", "content-type": "application/json" }, body: "{}" });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain('error="invalid_token"');
  });

  it("initializes and lists all required tools with schemas", async () => {
    const { client } = await connectWithApiKey(userId);
    expect(client.getServerVersion()?.name).toBe("openpress-publishing");
    expect(client.getInstructions()).toContain("confirmation_required");
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "create_site", "list_sites", "get_site", "update_site_settings", "delete_site",
        "create_post", "get_post", "list_posts", "update_post", "publish_post", "unpublish_post", "delete_post",
        "upload_media", "list_media", "delete_media", "list_templates", "set_template", "update_theme",
        "update_post_seo", "get_site_analytics",
      ].sort(),
    );
    for (const t of tools) {
      expect(t.description?.length).toBeGreaterThan(20);
      expect(t.inputSchema.type).toBe("object");
      expect(t.outputSchema?.type).toBe("object");
    }
    expect(tools.find((t) => t.name === "delete_post")?.annotations?.destructiveHint).toBe(true);
  });

  it("runs the milestone flow: create site -> draft -> publish -> public", async () => {
    const { client } = await connectWithApiKey(userId);
    const site = await call(client, "create_site", { name: "The Engineering Journal", template: "editorial" });
    expect(site.isError).toBeFalsy();
    const s = site.structuredContent!.site;
    expect(s.subdomain).toBe("the-engineering-journal");
    expect(s.url).toBe("https://the-engineering-journal.folio.test");

    const created = await call(client, "create_post", {
      siteId: s.id,
      title: "Will AI Replace Software Engineers?",
      content: "## The short answer\n\nNo. <script>alert(1)</script>But the job is changing.",
      tags: ["ai", "careers"],
    });
    const post = created.structuredContent!.post;
    expect(post.status).toBe("draft");
    expect(post.isLive).toBe(false);
    expect(post.slug).toBe("will-ai-replace-software-engineers");
    expect(await getPublishedPost(s.subdomain, "post", post.slug)).toBeNull();

    const published = await call(client, "publish_post", { postId: post.id });
    expect(published.structuredContent!.status).toBe("published");
    expect(published.structuredContent!.post.url).toBe("https://the-engineering-journal.folio.test/blog/will-ai-replace-software-engineers");

    const live = await getPublishedPost(s.subdomain, "post", post.slug);
    expect(live?.post.title).toBe("Will AI Replace Software Engineers?");
    expect(live?.post.contentHtml).not.toContain("<script");
    expect(live?.post.contentHtml).toContain("<h2>The short answer</h2>");
  });

  it("enforces the one-site free tier with a structured error", async () => {
    const { client } = await connectWithApiKey(userId);
    const res = await call(client, "create_site", { name: "Second" });
    expect(res.isError).toBe(true);
    expect(res.structuredContent!.error.code).toBe("QUOTA_EXCEEDED");
  });

  it("returns VALIDATION errors for bad input instead of throwing", async () => {
    const { client } = await connectWithApiKey(userId);
    const sites = (await call(client, "list_sites")).structuredContent!.sites;
    const res = await call(client, "update_theme", { siteId: sites[0].id, theme: { primaryColor: "red" } });
    expect(res.isError).toBe(true);
  });

  it("requires a confirmation round-trip for delete_post", async () => {
    const { client } = await connectWithApiKey(userId);
    const siteId = (await call(client, "list_sites")).structuredContent!.sites[0].id;
    const post = (await call(client, "create_post", { siteId, title: "Temp", content: "x" })).structuredContent!.post;
    const first = await call(client, "delete_post", { postId: post.id });
    expect(first.isError).toBeFalsy();
    expect(first.structuredContent!.status).toBe("confirmation_required");
    expect(first.structuredContent!.summary).toContain("Temp");
    // still there
    expect((await call(client, "get_post", { postId: post.id })).isError).toBeFalsy();
    const bad = await call(client, "delete_post", { postId: post.id, confirmationToken: "123.abc" });
    expect(bad.isError).toBe(true);
    const second = await call(client, "delete_post", { postId: post.id, confirmationToken: first.structuredContent!.confirmation_token });
    expect(second.structuredContent!.deleted).toBe(true);
    expect((await call(client, "get_post", { postId: post.id })).structuredContent!.error.code).toBe("NOT_FOUND");
  });

  it("confirmation tokens are bound to the target", async () => {
    const { client } = await connectWithApiKey(userId);
    const siteId = (await call(client, "list_sites")).structuredContent!.sites[0].id;
    const a = (await call(client, "create_post", { siteId, title: "A", content: "x" })).structuredContent!.post;
    const b = (await call(client, "create_post", { siteId, title: "B", content: "x" })).structuredContent!.post;
    const tokenA = (await call(client, "delete_post", { postId: a.id })).structuredContent!.confirmation_token;
    const res = await call(client, "delete_post", { postId: b.id, confirmationToken: tokenA });
    expect(res.isError).toBe(true);
  });

  it("gates publishing behind confirmation when the connection requires it", async () => {
    const { client } = await connectWithApiKey(userId, { confirmPublish: true });
    const siteId = (await call(client, "list_sites")).structuredContent!.sites[0].id;
    const post = (await call(client, "create_post", { siteId, title: "Gated", content: "x" })).structuredContent!.post;
    const first = await call(client, "publish_post", { postId: post.id });
    expect(first.structuredContent!.status).toBe("confirmation_required");
    expect((await call(client, "get_post", { postId: post.id })).structuredContent!.post.status).toBe("draft");
    const second = await call(client, "publish_post", { postId: post.id, confirmationToken: first.structuredContent!.confirmation_token });
    expect(second.structuredContent!.status).toBe("published");
  });

  it("denies tools outside the granted scopes", async () => {
    const { client } = await connectWithApiKey(userId, { scopes: ["sites:read"] });
    const siteId = (await call(client, "list_sites")).structuredContent!.sites[0].id;
    const res = await call(client, "create_post", { siteId, title: "nope", content: "" });
    expect(res.isError).toBe(true);
    expect(res.structuredContent!.error.code).toBe("FORBIDDEN");
  });

  it("refuses delete_site without the sites:delete scope before issuing a confirmation token", async () => {
    const { client } = await connectWithApiKey(userId, { scopes: ["sites:read", "sites:write"] });
    const sites = (await call(client, "list_sites")).structuredContent!.sites;
    const res = await call(client, "delete_site", { siteId: sites[0].id });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("sites:delete");
  });
});
