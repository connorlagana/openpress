import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { analyticsEvents, sites, users } from "@/db/schema";
import type { Actor } from "@/server/actor";
import { getPlatformAnalytics, listPlatformSites } from "@/server/services/platform-analytics";
import { createSite } from "@/server/services/sites";
import { createPost, setPublished } from "@/server/services/posts";
import { makeUser } from "../helpers";

describe("platform analytics", () => {
  it("rejects non-admins, agents of admins, missing accounts and suspended admins", async () => {
    const { actor, user } = await makeUser("report-access");
    await expect(getPlatformAnalytics(actor)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const db = await getDb();
    await db.update(users).set({ isAdmin: true }).where(eq(users.id, user.id));
    const agent: Actor = { kind: "agent", userId: user.id, connectionId: "test", clientName: "test", scopes: new Set(["analytics:read"]), siteIds: "all", confirmPublish: false };
    await expect(getPlatformAnalytics(agent)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getPlatformAnalytics({ kind: "user", userId: "00000000-0000-0000-0000-000000000000" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db.update(users).set({ suspendedAt: new Date() }).where(eq(users.id, user.id));
    await expect(getPlatformAnalytics(actor)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reports cross-tenant activation and bounded traffic with zero-filled days", async () => {
    const admin = await makeUser("report-admin");
    const owner = await makeUser("report-owner");
    const db = await getDb();
    await db.update(users).set({ isAdmin: true }).where(eq(users.id, admin.user.id));
    await db.update(users).set({ signupSource: "utm:analytics-test" }).where(eq(users.id, owner.user.id));
    const site = await createSite(owner.actor, { name: "Report site", template: "editorial" });
    const post = await createPost(owner.actor, { siteId: site.id, title: "Report post", content: "Hello" });
    await setPublished(owner.actor, post.id, true);
    await db.insert(analyticsEvents).values([
      { siteId: site.id, day: sql`current_date`, path: "/", visitorHash: "same", referrerCategory: "search" },
      { siteId: site.id, day: sql`current_date`, path: "/hello", visitorHash: "same", referrerCategory: "search" },
      { siteId: site.id, day: sql`current_date - 6`, path: "/", visitorHash: "older", referrerCategory: "direct" },
      { siteId: site.id, day: sql`current_date - 7`, path: "/", visitorHash: "excluded", referrerCategory: "direct" },
    ]);
    const report = await getPlatformAnalytics(admin.actor, 7);
    expect(report.daily).toHaveLength(7);
    expect(report.daily.at(-1)?.pageviews).toBe(2);
    expect(report.daily[1].pageviews).toBe(0);
    expect(report.traffic).toEqual({ pageviews: 3, visitors: 2, sites: 1 });
    expect(report.sources).toContainEqual({ category: "search", pageviews: 2 });
    expect(report.topSites[0]).toMatchObject({ name: "Report site", pageviews: 3 });
    expect(report.funnel.find((r) => r.source === "utm:analytics-test")).toMatchObject({ signups: 1, createdSite: 1, agentUsed: 0, published: 1, published24h: 1 });
    expect(report.inventory.published).toBeGreaterThanOrEqual(1);
    await expect(getPlatformAnalytics(admin.actor, 365)).rejects.toThrow();
    await expect(getPlatformAnalytics(admin.actor, NaN)).rejects.toThrow();
  });

  it("lists every tenant's sites with counts for admins only", async () => {
    const admin = await makeUser("sites-admin");
    const owner = await makeUser("sites-owner");
    const db = await getDb();
    await expect(listPlatformSites(admin.actor)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db.update(users).set({ isAdmin: true }).where(eq(users.id, admin.user.id));
    const site = await createSite(owner.actor, { name: "Listed blog", template: "editorial" });
    const live = await createPost(owner.actor, { siteId: site.id, title: "Live", content: "Hi" });
    await setPublished(owner.actor, live.id, true);
    await createPost(owner.actor, { siteId: site.id, title: "Draft", content: "Later" });
    await db.update(sites).set({ suspendedAt: new Date() }).where(eq(sites.id, site.id));
    await db.insert(analyticsEvents).values({ siteId: site.id, day: sql`current_date`, path: "/", visitorHash: "v", referrerCategory: "direct" });

    const all = await listPlatformSites(admin.actor);
    expect(all.total).toBeGreaterThanOrEqual(1);
    const row = all.sites.find((s) => s.id === site.id);
    expect(row).toMatchObject({ name: "Listed blog", ownerEmail: owner.user.email, posts: 1, drafts: 1, pages: 0, pageviews: 1 });
    expect(row?.suspendedAt).toBeTruthy();
    expect(row?.lastPublishedAt).toBeTruthy();

    const found = await listPlatformSites(admin.actor, { q: "LISTED blog" });
    expect(found.sites.map((s) => s.id)).toEqual([site.id]);
    expect((await listPlatformSites(admin.actor, { q: "%" })).sites.find((s) => s.id === site.id)).toBeUndefined();
    await db.update(sites).set({ deletedAt: new Date() }).where(eq(sites.id, site.id));
    expect((await listPlatformSites(admin.actor, { q: "Listed blog" })).total).toBe(0);
  });
});
