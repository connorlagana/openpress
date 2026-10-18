import { sql } from "drizzle-orm";
import { getDb, rowsOf, withUser } from "@/db/client";
import { analyticsEvents } from "@/db/schema";
import { config } from "@/lib/config";
import { hmacHex, sha256Hex } from "@/lib/crypto";
import { requireScope, type Actor } from "../actor";
import { loadSite } from "./sites";

const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|monitor|curl|wget|python-requests|httpclient|headless|lighthouse|pingdom|uptime/i;

const REFERRER_CATEGORIES: [string, RegExp][] = [
  ["search", /(^|\.)(google|bing|duckduckgo|yahoo|baidu|yandex|ecosia|search\.brave|startpage|qwant)\./],
  ["ai", /(^|\.)(chatgpt\.com|chat\.openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|you\.com|phind\.com)$/],
  ["social", /(^|\.)(t\.co|twitter\.com|x\.com|facebook\.com|fb\.com|linkedin\.com|lnkd\.in|reddit\.com|news\.ycombinator\.com|instagram\.com|youtube\.com|threads\.net|bsky\.app|mastodon\.social|pinterest\.com|tiktok\.com)$/],
];

export function categorizeReferrer(referrer: string | null, siteHost: string): { host: string | null; category: string } {
  if (!referrer) return { host: null, category: "direct" };
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return { host: null, category: "direct" };
  }
  if (host === siteHost) return { host: null, category: "internal" };
  for (const [cat, re] of REFERRER_CATEGORIES) if (re.test(host)) return { host, category: cat };
  return { host, category: "other" };
}

/**
 * Record a pageview without cookies or stored IPs. The daily salt is derived
 * from APP_SECRET, so hashes cannot be correlated across days.
 */
export async function recordPageview(opts: { siteId: string; siteHost: string; path: string; ip: string | null; userAgent: string | null; referrer: string | null }) {
  if (!opts.userAgent || BOT_RE.test(opts.userAgent)) return;
  const day = new Date().toISOString().slice(0, 10);
  const salt = await hmacHex(config.secret, `analytics:${day}`);
  const visitorHash = (await sha256Hex(`${salt}|${opts.siteId}|${opts.ip ?? ""}|${opts.userAgent}`)).slice(0, 32);
  const ref = categorizeReferrer(opts.referrer, opts.siteHost);
  const db = await getDb();
  await db.insert(analyticsEvents).values({
    siteId: opts.siteId,
    path: opts.path.slice(0, 300),
    visitorHash,
    referrerHost: ref.host,
    referrerCategory: ref.category,
    day,
  });
  if (Math.random() < 0.001) {
    await db.execute(sql`delete from analytics_events where day < (now() - make_interval(days => ${config.analyticsRetentionDays}))::date`);
  }
}

export async function getSiteAnalytics(actor: Actor, siteId: string, days = 30) {
  requireScope(actor, "analytics:read");
  const span = Math.min(Math.max(Math.trunc(days), 1), config.analyticsRetentionDays);
  return withUser(actor.userId, async (tx) => {
    const site = await loadSite(tx, actor, siteId);
    const since = sql`(current_date - ${span - 1}::int)`;
    const [totals] = rowsOf<{ pageviews: number; visitors: number }>(
      await tx.execute(sql`
        select count(*)::int as pageviews, count(distinct (visitor_hash, day))::int as visitors
        from analytics_events where site_id = ${site.id} and day >= ${since}`),
    );
    const daily = rowsOf<{ day: string; pageviews: number; visitors: number }>(
      await tx.execute(sql`
        select to_char(d::date, 'YYYY-MM-DD') as day,
               count(e.id)::int as pageviews,
               count(distinct e.visitor_hash)::int as visitors
        from generate_series(${since}, current_date, interval '1 day') d
        left join analytics_events e on e.site_id = ${site.id} and e.day = d::date
        group by d order by d`),
    );
    const topPages = rowsOf<{ path: string; pageviews: number; visitors: number }>(
      await tx.execute(sql`
        select path, count(*)::int as pageviews, count(distinct (visitor_hash, day))::int as visitors
        from analytics_events where site_id = ${site.id} and day >= ${since}
        group by path order by pageviews desc limit 10`),
    );
    const referrers = rowsOf<{ category: string; pageviews: number }>(
      await tx.execute(sql`
        select referrer_category as category, count(*)::int as pageviews
        from analytics_events where site_id = ${site.id} and day >= ${since}
        group by referrer_category order by pageviews desc`),
    );
    const topReferrers = rowsOf<{ host: string; pageviews: number }>(
      await tx.execute(sql`
        select referrer_host as host, count(*)::int as pageviews
        from analytics_events where site_id = ${site.id} and day >= ${since} and referrer_host is not null
        group by referrer_host order by pageviews desc limit 10`),
    );
    return {
      siteId: site.id,
      periodDays: span,
      pageviews: Number(totals?.pageviews ?? 0),
      uniqueVisitors: Number(totals?.visitors ?? 0),
      note: "Unique visitors are counted per day with a rotating anonymous hash (no cookies), so a person visiting on 3 days counts 3 times.",
      daily,
      topPages,
      referrers,
      topReferrers,
    };
  });
}
