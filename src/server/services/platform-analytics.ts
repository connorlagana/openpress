import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, rowsOf, withUser } from "@/db/client";
import { users } from "@/db/schema";
import { forbidden } from "@/lib/errors";
import type { Actor } from "../actor";
import { signupFunnel } from "./funnel";

/** Cross-tenant reporting is restricted to an active human administrator. */
async function requireAdmin(actor: Actor) {
  if (actor.kind !== "user") throw forbidden();
  const allowed = await withUser(actor.userId, async (tx) => {
    const [user] = await tx.select({ admin: users.isAdmin, suspended: users.suspendedAt }).from(users).where(eq(users.id, actor.userId));
    return user?.admin && !user.suspended;
  });
  if (!allowed) throw forbidden();
}

export async function getPlatformAnalytics(actor: Actor, days = 30) {
  await requireAdmin(actor);
  const span = z.union([z.literal(7), z.literal(30), z.literal(90)]).parse(days);
  const db = await getDb();
  const since = sql`(current_date - ${span - 1}::int)`;
  const funnel = await signupFunnel(span);
  const [inventory] = rowsOf<{ users: number; sites: number; published: number; agents: number }>(await db.execute(sql`
    select (select count(*)::int from users) as users,
      (select count(*)::int from sites where deleted_at is null and suspended_at is null) as sites,
      (select count(*)::int from posts p join sites s on s.id = p.site_id where p.status = 'published' and p.deleted_at is null and s.deleted_at is null and s.suspended_at is null) as published,
      (select count(*)::int from agent_connections where revoked_at is null) as agents`));
  const daily = rowsOf<{ day: string; signups: number; pageviews: number }>(await db.execute(sql`
    with signups as (select (created_at at time zone 'UTC')::date as day, count(*)::int as n from users where created_at >= ${since} group by 1),
    traffic as (select day, count(*)::int as n from analytics_events where day >= ${since} group by day)
    select to_char(d::date, 'YYYY-MM-DD') as day, coalesce(s.n, 0)::int as signups, coalesce(t.n, 0)::int as pageviews
    from generate_series(${since}, current_date, interval '1 day') d
    left join signups s on s.day = d::date left join traffic t on t.day = d::date order by d`));
  const [traffic] = rowsOf<{ pageviews: number; visitors: number; sites: number }>(await db.execute(sql`
    select count(*)::int as pageviews, count(distinct (site_id, day, visitor_hash))::int as visitors,
      count(distinct site_id)::int as sites from analytics_events where day >= ${since}`));
  const sources = rowsOf<{ category: string; pageviews: number }>(await db.execute(sql`
    select referrer_category as category, count(*)::int as pageviews from analytics_events
    where day >= ${since} group by referrer_category order by pageviews desc, category`));
  const topSites = rowsOf<{ subdomain: string; name: string; pageviews: number }>(await db.execute(sql`
    select s.subdomain, s.name, count(*)::int as pageviews from analytics_events e join sites s on s.id = e.site_id
    where e.day >= ${since} and s.deleted_at is null and s.suspended_at is null
    group by s.id order by pageviews desc, s.subdomain limit 10`));
  return { days: span, inventory, funnel, daily, traffic, sources, topSites };
}

export type PlatformSite = {
  id: string; subdomain: string; name: string; ownerEmail: string; createdAt: Date | string; suspendedAt: Date | string | null;
  posts: number; drafts: number; pages: number; lastPublishedAt: Date | string | null; pageviews: number;
};

const sitesQuery = z.object({ q: z.string().trim().max(100).default(""), page: z.number().int().min(1).max(10_000).default(1) });
export const PLATFORM_SITES_PAGE_SIZE = 50;

/** Every non-deleted site (suspended included) with owner, content counts and 30-day traffic, newest first. */
export async function listPlatformSites(actor: Actor, input: { q?: string; page?: number } = {}) {
  await requireAdmin(actor);
  const { q, page } = sitesQuery.parse(input);
  const db = await getDb();
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const match = q ? sql`and (s.subdomain ilike ${like} or s.name ilike ${like} or u.email ilike ${like})` : sql``;
  const [{ total }] = rowsOf<{ total: number }>(await db.execute(sql`
    select count(*)::int as total from sites s join users u on u.id = s.owner_id where s.deleted_at is null ${match}`));
  const rows = rowsOf<PlatformSite>(await db.execute(sql`
    select s.id, s.subdomain, s.name, u.email as "ownerEmail", s.created_at as "createdAt", s.suspended_at as "suspendedAt",
      coalesce(p.posts, 0)::int as posts, coalesce(p.drafts, 0)::int as drafts, coalesce(p.pages, 0)::int as pages,
      p.last_published as "lastPublishedAt", coalesce(t.n, 0)::int as pageviews
    from sites s join users u on u.id = s.owner_id
    left join lateral (
      select count(*) filter (where kind = 'post' and status = 'published') as posts,
        count(*) filter (where kind = 'post' and status = 'draft') as drafts,
        count(*) filter (where kind = 'page' and status = 'published') as pages,
        max(published_at) filter (where status = 'published') as last_published
      from posts where site_id = s.id and deleted_at is null
    ) p on true
    left join lateral (select count(*) as n from analytics_events where site_id = s.id and day >= current_date - 29) t on true
    where s.deleted_at is null ${match}
    order by s.created_at desc, s.subdomain
    limit ${PLATFORM_SITES_PAGE_SIZE} offset ${(page - 1) * PLATFORM_SITES_PAGE_SIZE}`));
  return { sites: rows, total, page, pageSize: PLATFORM_SITES_PAGE_SIZE, q };
}
