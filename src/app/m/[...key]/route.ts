import { getStorage } from "@/server/storage";

// Media proxy used when no public R2 domain (MEDIA_PUBLIC_URL) is configured.
// Only keys under sites/ are served; content type comes from upload-time sniffing.
export async function GET(_req: Request, ctx: RouteContext<"/m/[...key]">) {
  const key = (await ctx.params).key.map(decodeURIComponent).join("/");
  if (!/^sites\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|gif|webp|avif|ico)$/.test(key)) return new Response("Not found", { status: 404 });
  const obj = await getStorage().get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  return new Response(obj.body as BodyInit, {
    headers: {
      "content-type": obj.contentType,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
