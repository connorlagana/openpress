import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { rowsOf, withUser } from "@/db/client";
import { posts, sites } from "@/db/schema";
import { createPost, getPost, listPosts, setPublished, updatePost } from "@/server/services/posts";
import { createSite, getSite, listSites } from "@/server/services/sites";
import { call, connectWithApiKey, makeUser } from "../helpers";

describe("multi-tenant isolation", () => {
  it("users cannot read or modify each other's sites through services", async () => {
    const a = await makeUser("alice");
    const b = await makeUser("bob");
    const siteA = await createSite(a.actor, { name: "Alice Blog" });
    const postA = await createPost(a.actor, { siteId: siteA.id, title: "Secret draft", content: "x" });

    expect(await listSites(b.actor)).toEqual([]);
    await expect(getSite(b.actor, siteA.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getSite(b.actor, siteA.subdomain)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getPost(b.actor, postA.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(listPosts(b.actor, { siteId: siteA.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updatePost(b.actor, postA.id, { title: "pwned" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setPublished(b.actor, postA.id, true)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createPost(b.actor, { siteId: siteA.id, title: "inject", content: "" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("RLS blocks raw SQL across tenants even if application checks are bypassed", async () => {
    const a = await makeUser("rls-a");
    const b = await makeUser("rls-b");
    const siteA = await createSite(a.actor, { name: "RLS A" });
    await createPost(a.actor, { siteId: siteA.id, title: "A only", content: "x" });

    await withUser(b.user.id, async (tx) => {
      expect(await tx.select().from(sites).where(eq(sites.id, siteA.id))).toEqual([]);
      expect(await tx.select().from(posts).where(eq(posts.siteId, siteA.id))).toEqual([]);
      const upd = await tx.update(posts).set({ title: "pwned" }).where(eq(posts.siteId, siteA.id)).returning();
      expect(upd).toEqual([]);
      await expect(tx.insert(posts).values({ siteId: siteA.id, title: "x", slug: "x" })).rejects.toThrow();
    });
    await expect(
      withUser(b.user.id, (tx) => tx.execute(sql`select * from sessions`)),
    ).resolves.toSatisfy((r: unknown) => rowsOf(r).length === 0);
    await expect(withUser(b.user.id, (tx) => tx.execute(sql`select * from users where id = ${a.user.id}`))).resolves.toSatisfy((r: unknown) => rowsOf(r).length === 0);
  });

  it("agents restricted to one site cannot see the user's other sites", async () => {
    const u = await makeUser("multi");
    const { withUser: _w } = await import("@/db/client");
    // Lift the free-tier cap for this user to create two sites.
    await _w(u.user.id, async () => {});
    const { getDb } = await import("@/db/client");
    const db = await getDb();
    await db.execute(sql`insert into plans (id, name, max_sites, max_storage_bytes, max_upload_bytes, max_posts_per_site, mcp_requests_per_minute, monthly_pageviews) values ('pro-test', 'Pro', 5, 1000000000, 5000000, 1000, 600, 1000000) on conflict do nothing`);
    await db.execute(sql`update users set plan_id = 'pro-test' where id = ${u.user.id}`);
    const s1 = await createSite(u.actor, { name: "Allowed" });
    const s2 = await createSite(u.actor, { name: "Forbidden" });
    const { client } = await connectWithApiKey(u.user.id, { siteIds: [s1.id] });
    const listed = (await call(client, "list_sites")).structuredContent!.sites;
    expect(listed.map((s: { id: string }) => s.id)).toEqual([s1.id]);
    const res = await call(client, "create_post", { siteId: s2.id, title: "x", content: "" });
    expect(res.structuredContent!.error.code).toBe("FORBIDDEN");
    // A site the restricted agent creates is added to its grant.
    const s3 = (await call(client, "create_site", { name: "Agent made" })).structuredContent!.site;
    expect((await call(client, "get_site", { siteId: s3.id })).isError).toBeFalsy();
  });

  it("suspended accounts cannot publish and their sites go offline", async () => {
    const u = await makeUser("susp");
    const site = await createSite(u.actor, { name: "Suspended Co" });
    const post = await createPost(u.actor, { siteId: site.id, title: "Hello", content: "x" });
    const { getDb } = await import("@/db/client");
    const { getPublicSite } = await import("@/server/public/data");
    expect(await getPublicSite(site.subdomain)).not.toBeNull();
    await (await getDb()).execute(sql`update users set suspended_at = now() where id = ${u.user.id}`);
    await expect(setPublished(u.actor, post.id, true)).rejects.toMatchObject({ code: "SUSPENDED" });
    expect(await getPublicSite(site.subdomain)).toBeNull();
  });
});
