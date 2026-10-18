import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { AppError } from "@/lib/errors";
import { createUser, authenticate } from "@/server/auth/accounts";
import { findRedirect, getPublicSite, getPublishedPost, listPublishedPosts, sitemapEntries } from "@/server/public/data";
import { getSiteAnalytics, recordPageview } from "@/server/services/analytics";
import { deleteMedia, listMedia, uploadMedia } from "@/server/services/media";
import { createPost, setPublished, updatePost } from "@/server/services/posts";
import { rateLimit } from "@/server/services/ratelimit";
import { createSite, updateSiteSettings } from "@/server/services/sites";
import * as storage from "@/server/storage";
import { makeUser } from "../helpers";

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a5d4c5ba0000000049454e44ae426082", "hex");

describe("content lifecycle", () => {
  let actor: Awaited<ReturnType<typeof makeUser>>["actor"];
  let siteId: string;
  let sub: string;
  beforeAll(async () => {
    actor = (await makeUser("content")).actor;
    const site = await createSite(actor, { name: "Content Site", template: "saas" });
    siteId = site.id;
    sub = site.subdomain;
  });

  it("auto-suffixes colliding slugs and rejects explicit collisions with a suggestion", async () => {
    const a = await createPost(actor, { siteId, title: "Hello World", content: "x" });
    const b = await createPost(actor, { siteId, title: "Hello World", content: "y" });
    expect([a.slug, b.slug]).toEqual(["hello-world", "hello-world-2"]);
    const err = await createPost(actor, { siteId, title: "Other", slug: "hello-world", content: "" }).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe("CONFLICT");
    expect(err.details.suggestion).toBe("hello-world-3");
    // Pages and posts have separate namespaces, but pages can't shadow built-in routes.
    expect((await createPost(actor, { siteId, kind: "page", title: "Hello World", content: "" })).slug).toBe("hello-world");
    expect((await createPost(actor, { siteId, kind: "page", title: "Blog", content: "" })).slug).toBe("blog-2");
  });

  it("drafts are invisible publicly until published; unpublish hides again", async () => {
    const p = await createPost(actor, { siteId, title: "Draft Visibility", content: "secret" });
    expect(await getPublishedPost(sub, "post", p.slug)).toBeNull();
    expect((await listPublishedPosts(siteId)).items.find((x) => x.id === p.id)).toBeUndefined();
    await setPublished(actor, p.id, true);
    expect(await getPublishedPost(sub, "post", p.slug)).not.toBeNull();
    await setPublished(actor, p.id, false);
    expect(await getPublishedPost(sub, "post", p.slug)).toBeNull();
  });

  it("records 301s on slug changes, repoints chains and keeps revisions", async () => {
    const p = await createPost(actor, { siteId, title: "Chain", content: "v1" });
    await setPublished(actor, p.id, true);
    await updatePost(actor, p.id, { slug: "chain-2-0", content: "v2" });
    await updatePost(actor, p.id, { slug: "chain-3-0" });
    expect(await findRedirect(siteId, "/blog/chain")).toBe("/blog/chain-3-0");
    expect(await findRedirect(siteId, "/blog/chain-2-0")).toBe("/blog/chain-3-0");
    // Renaming back removes the redirect that would shadow the live URL.
    await updatePost(actor, p.id, { slug: "chain" });
    expect(await findRedirect(siteId, "/blog/chain")).toBeNull();
    const db = await getDb();
    const revs = await db.execute(sql`select count(*)::int as n from post_revisions where post_id = ${p.id}`);
    expect(Number((Array.isArray(revs) ? revs : (revs as any).rows)[0].n)).toBe(3);
  });

  it("excludes noindex posts from the sitemap", async () => {
    const p = await createPost(actor, { siteId, title: "Hidden", content: "x", noindex: true });
    await setPublished(actor, p.id, true);
    const entries = await sitemapEntries(siteId);
    expect(entries.find((e) => e.slug === p.slug)).toBeUndefined();
  });

  it("validates site settings and navigation links", async () => {
    await expect(updateSiteSettings(actor, siteId, { navigation: { header: [{ label: "x", href: "javascript:alert(1)" }] } })).rejects.toThrow();
    await expect(updateSiteSettings(actor, siteId, { settings: { hero: { ctaUrl: "javascript:alert(1)" } } })).rejects.toThrow();
    const updated = await updateSiteSettings(actor, siteId, { tagline: "New", navigation: { header: [{ label: "Docs", href: "/docs" }] } });
    expect(updated.navigation.header).toEqual([{ label: "Docs", href: "/docs" }]);
    expect((await getPublicSite(sub))?.tagline).toBe("New");
  });
});

describe("media", () => {
  it("accepts real images, rejects disguised files, and enforces size limits", async () => {
    const { actor } = await makeUser("media");
    const site = await createSite(actor, { name: "Media Site" });
    const m = await uploadMedia(actor, { siteId: site.id, dataBase64: PNG.toString("base64"), filename: "dot.png", altText: "A dot" });
    expect(m).toMatchObject({ mimeType: "image/png", width: 1, height: 1 });
    expect(m.markdown).toContain("![A dot](");

    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString("base64");
    await expect(uploadMedia(actor, { siteId: site.id, dataBase64: svg, filename: "evil.png" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(uploadMedia(actor, { siteId: site.id, sourceUrl: "http://169.254.169.254/latest/meta-data" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(uploadMedia(actor, { siteId: site.id, sourceUrl: "https://127.0.0.1/x.png" })).rejects.toMatchObject({ code: "VALIDATION" });

    const big = new Uint8Array(6 * 1024 * 1024);
    big.set(PNG);
    await expect(uploadMedia(actor, { siteId: site.id }, big)).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });

    const other = await makeUser("media-other");
    await expect(uploadMedia(other.actor, { siteId: site.id, dataBase64: PNG.toString("base64") })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteMedia(other.actor, m.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("does not leave a database row behind when storage fails (failure recovery)", async () => {
    const { actor } = await makeUser("media-fail");
    const site = await createSite(actor, { name: "Failing Storage" });
    const spy = vi.spyOn(storage, "getStorage").mockReturnValue({
      put: async () => {
        throw new Error("R2 unavailable");
      },
      get: async () => null,
      delete: async () => {},
    });
    await expect(uploadMedia(actor, { siteId: site.id, dataBase64: PNG.toString("base64") })).rejects.toThrow("R2 unavailable");
    spy.mockRestore();
    expect((await listMedia(actor, site.id)).items).toHaveLength(0);
  });
});

describe("rate limiting", () => {
  it("allows up to the limit per window then rejects with retry info", async () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 3; i++) await rateLimit(key, 3);
    const err = await rateLimit(key, 3).catch((e) => e);
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.details.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("auth", () => {
  it("rejects duplicate emails case-insensitively and wrong passwords", async () => {
    const email = `Dup${Date.now()}@Example.com`;
    await createUser({ email, password: "long enough password" });
    await expect(createUser({ email: email.toLowerCase(), password: "long enough password" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(authenticate(email, "nope")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(authenticate(email.toUpperCase(), "long enough password")).resolves.toBeTruthy();
    await expect(createUser({ email: "short@example.com", password: "short" })).rejects.toThrow();
  });
});

describe("analytics", () => {
  it("counts pageviews and approximate visitors without storing IPs, ignoring bots", async () => {
    const { actor } = await makeUser("analytics");
    const site = await createSite(actor, { name: "Analytics Site" });
    const base = { siteId: site.id, siteHost: `${site.subdomain}.folio.test`, path: "/" };
    await recordPageview({ ...base, ip: "1.1.1.1", userAgent: "Mozilla/5.0 Firefox", referrer: "https://www.google.com/" });
    await recordPageview({ ...base, ip: "1.1.1.1", userAgent: "Mozilla/5.0 Firefox", referrer: null, path: "/blog" });
    await recordPageview({ ...base, ip: "2.2.2.2", userAgent: "Mozilla/5.0 Safari", referrer: "https://chatgpt.com/" });
    await recordPageview({ ...base, ip: "3.3.3.3", userAgent: "Googlebot/2.1", referrer: null });
    const a = await getSiteAnalytics(actor, site.id, 7);
    expect(a.pageviews).toBe(3);
    expect(a.uniqueVisitors).toBe(2);
    expect(a.daily).toHaveLength(7);
    expect(a.referrers.map((r) => r.category).sort()).toEqual(["ai", "direct", "search"]);
    const db = await getDb();
    const raw = await db.execute(sql`select * from analytics_events where site_id = ${site.id}`);
    expect(JSON.stringify(raw)).not.toContain("1.1.1.1");
  });
});
