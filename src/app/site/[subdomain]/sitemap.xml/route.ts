export const dynamic = "force-dynamic";

import { config } from "@/lib/config";
import { getPublicSite, sitemapEntries } from "@/server/public/data";

export async function GET(_req: Request, ctx: RouteContext<"/site/[subdomain]/sitemap.xml">) {
  const site = await getPublicSite((await ctx.params).subdomain);
  if (!site) return new Response("Not found", { status: 404 });
  const base = config.siteUrl(site.subdomain);
  const entries = await sitemapEntries(site.id);
  const latest = entries[0]?.updatedAt ?? site.updatedAt;
  const urls = [
    { loc: base + "/", lastmod: latest },
    { loc: `${base}/blog`, lastmod: latest },
    ...entries.map((e) => ({ loc: `${base}${e.kind === "page" ? "" : "/blog"}/${e.slug}`, lastmod: e.updatedAt })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${u.loc}</loc><lastmod>${u.lastmod.toISOString()}</lastmod></url>`).join("\n")}
</urlset>`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" } });
}
