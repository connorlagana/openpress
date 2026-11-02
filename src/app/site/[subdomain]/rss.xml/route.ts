export const dynamic = "force-dynamic";

import { config } from "@/lib/config";
import { getPublicSite, listPublishedPosts, withCharts } from "@/server/public/data";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

export async function GET(_req: Request, ctx: RouteContext<"/site/[subdomain]/rss.xml">) {
  const site = await getPublicSite((await ctx.params).subdomain);
  if (!site) return new Response("Not found", { status: 404 });
  const base = config.siteUrl(site.subdomain);
  const { items: posts } = await listPublishedPosts(site.id, { limit: 50 });
  const items = await Promise.all(posts.map(async (p) => ({ ...p, contentHtml: await withCharts(site.id, p.contentHtml, "feed") })));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
<title>${esc(site.name)}</title>
<link>${base}</link>
<description>${esc(site.description ?? site.tagline ?? site.name)}</description>
<language>${esc(site.language)}</language>
<atom:link href="${base}/rss.xml" rel="self" type="application/rss+xml"/>
${items[0]?.publishedAt ? `<lastBuildDate>${items[0].publishedAt.toUTCString()}</lastBuildDate>` : ""}
${items
  .map(
    (p) => `<item>
<title>${esc(p.title)}</title>
<link>${base}/blog/${p.slug}</link>
<guid isPermaLink="false">${p.id}</guid>
${p.publishedAt ? `<pubDate>${p.publishedAt.toUTCString()}</pubDate>` : ""}
${p.excerpt ? `<description>${esc(p.excerpt)}</description>` : ""}
${p.tags.map((t) => `<category>${esc(t)}</category>`).join("")}
<content:encoded>${cdata(p.contentHtml)}</content:encoded>
</item>`,
  )
  .join("\n")}
</channel>
</rss>`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=300" } });
}
