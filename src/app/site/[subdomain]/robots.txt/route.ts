export const dynamic = "force-dynamic";

import { config } from "@/lib/config";
import { getPublicSite } from "@/server/public/data";

export async function GET(_req: Request, ctx: RouteContext<"/site/[subdomain]/robots.txt">) {
  const site = await getPublicSite((await ctx.params).subdomain);
  if (!site) return new Response("User-agent: *\nDisallow: /\n", { status: 404, headers: { "content-type": "text/plain" } });
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${config.siteUrl(site.subdomain)}/sitemap.xml\n`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
