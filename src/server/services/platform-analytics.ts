import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, rowsOf, withUser } from "@/db/client";
import { users } from "@/db/schema";
import { forbidden } from "@/lib/errors";
import type { Actor } from "../actor";
import { signupFunnel } from "./funnel";

/** Cross-tenant reporting is restricted to an active human administrator. */
export async function getPlatformAnalytics(actor: Actor, days = 30) {
  if (actor.kind !== "user") throw forbidden();
  const allowed = await withUser(actor.userId, async (tx) => {
    const [user] = await tx.select({ admin: users.isAdmin, suspended: users.suspendedAt }).from(users).where(eq(users.id, actor.userId));
    return user?.admin && !user.suspended;
  });
  if (!allowed) throw forbidden();
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
