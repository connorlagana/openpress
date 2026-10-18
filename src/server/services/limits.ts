import { and, count, eq, isNull, sql, sum } from "drizzle-orm";
import { rowsOf, type Queryable } from "@/db/client";
import { media, plans, posts, sites, users, type Plan } from "@/db/schema";
import { AppError } from "@/lib/errors";

export async function getPlanForUser(tx: Queryable, userId: string): Promise<Plan> {
  const [row] = await tx.select({ plan: plans }).from(users).innerJoin(plans, eq(users.planId, plans.id)).where(eq(users.id, userId));
  if (!row) throw new AppError("UNAUTHORIZED", "Account not found");
  return row.plan;
}

export async function assertUserActive(tx: Queryable, userId: string) {
  const [u] = await tx.select({ suspendedAt: users.suspendedAt }).from(users).where(eq(users.id, userId));
  if (!u) throw new AppError("UNAUTHORIZED", "Account not found");
  if (u.suspendedAt) throw new AppError("SUSPENDED", "This account is suspended. Contact support.");
}

export async function siteStorageBytes(tx: Queryable, siteId: string): Promise<number> {
  const [r] = await tx.select({ total: sum(media.sizeBytes) }).from(media).where(and(eq(media.siteId, siteId), isNull(media.deletedAt)));
  return Number(r?.total ?? 0);
}

export async function userStorageBytes(tx: Queryable, userId: string): Promise<number> {
  const [r] = await tx
    .select({ total: sum(media.sizeBytes) })
    .from(media)
    .innerJoin(sites, eq(media.siteId, sites.id))
    .where(and(eq(sites.ownerId, userId), isNull(media.deletedAt), isNull(sites.deletedAt)));
  return Number(r?.total ?? 0);
}

export async function ownedSiteCount(tx: Queryable, userId: string): Promise<number> {
  const [r] = await tx.select({ n: count() }).from(sites).where(and(eq(sites.ownerId, userId), isNull(sites.deletedAt)));
  return Number(r?.n ?? 0);
}

export async function sitePostCount(tx: Queryable, siteId: string): Promise<number> {
  const [r] = await tx.select({ n: count() }).from(posts).where(and(eq(posts.siteId, siteId), isNull(posts.deletedAt)));
  return Number(r?.n ?? 0);
}

export async function usageSummary(tx: Queryable, userId: string) {
  const plan = await getPlanForUser(tx, userId);
  const [siteCount, storage] = await Promise.all([ownedSiteCount(tx, userId), userStorageBytes(tx, userId)]);
  const [pv] = rowsOf<{ n: number }>(
    await tx.execute(sql`
      select count(*)::int as n from analytics_events e join sites s on s.id = e.site_id
      where s.owner_id = ${userId} and e.day >= date_trunc('month', now())::date`),
  );
  return {
    plan,
    sites: { used: siteCount, limit: plan.maxSites },
    storageBytes: { used: storage, limit: plan.maxStorageBytes },
    pageviewsThisMonth: { used: Number(pv?.n ?? 0), limit: plan.monthlyPageviews },
    maxUploadBytes: plan.maxUploadBytes,
    mcpRequestsPerMinute: plan.mcpRequestsPerMinute,
  };
}
