export const dynamic = "force-dynamic";

import { indexNowKey } from "@/server/indexnow";
import { getPublicSite } from "@/server/public/data";

/** Proves to IndexNow that submissions for this host come from us. See src/server/indexnow.ts. */
export async function GET(_req: Request, ctx: RouteContext<"/site/[subdomain]/indexnow-key.txt">) {
  const site = await getPublicSite((await ctx.params).subdomain);
  if (!site) return new Response("Not found", { status: 404 });
  return new Response(await indexNowKey(site.subdomain), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } });
}
