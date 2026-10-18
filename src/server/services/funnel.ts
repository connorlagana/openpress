import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb, rowsOf } from "@/db/client";

export type FunnelRow = { source: string; signups: number; createdSite: number; agentUsed: number; published: number; published24h: number };

/**
 * Activation funnel for signups in the last `days`: signup → site → agent made
 * a call → anything published (and within 24h of signup), split by signup
 * source with a "total" row. Operator-only (privileged connection).
 */
export async function signupFunnel(days = 30): Promise<FunnelRow[]> {
  const span = z.number().int().min(1).max(365).parse(days);
  const db = await getDb();
  const rows = rowsOf<Record<string, string | number | null>>(
    await db.execute(sql`
      with u as (
        select id, created_at, coalesce(signup_source, 'direct') as src from users
        where created_at >= current_date - ${span - 1}::int
      ),
      f as (
        select u.src,
          exists (select 1 from sites s where s.owner_id = u.id) as created_site,
          exists (select 1 from agent_connections c where c.user_id = u.id and c.last_used_at is not null) as agent_used,
          (select min(p.published_at) from posts p join sites s on s.id = p.site_id where s.owner_id = u.id) as first_publish,
          u.created_at
        from u
      )
      select coalesce(src, 'total') as source, count(*) as signups,
        count(*) filter (where created_site) as created_site,
        count(*) filter (where agent_used) as agent_used,
        count(*) filter (where first_publish is not null) as published,
        count(*) filter (where first_publish < created_at + interval '24 hours') as published_24h
      from f group by rollup (src) order by (src is null), count(*) desc`),
  );
  return rows.map((r) => ({
    source: String(r.source),
    signups: Number(r.signups),
    createdSite: Number(r.created_site),
    agentUsed: Number(r.agent_used),
    published: Number(r.published),
    published24h: Number(r.published_24h),
  }));
}
