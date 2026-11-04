export const dynamic = "force-dynamic";

import { config } from "@/lib/config";
import { randomToken } from "@/lib/crypto";
import { FRAME_PERMISSIONS_POLICY, frameCsp, frameDocument } from "@/lib/viz/frame";
import { frameViz } from "@/server/services/custom-viz";

// Serves a custom visualization's code as a sandboxed document. 404 unless the
// request is for the sandbox origin and the code is approved exactly as stored (or carries a reviewer's preview token). See
// lib/viz/frame.ts for the CSP and docs/SECURITY.md for the threat model.

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

export async function GET(req: Request, ctx: RouteContext<"/viz-frame/[id]">) {
  const url = new URL(req.url);
  const sandboxHost = new URL(config.customViz.origin).host;
  // With a dedicated sandbox origin configured, never serve user code from the
  // app origin. Use the Host header: under `next start` behind a proxy
  // (Railway), req.url carries the server's listen address (0.0.0.0:$PORT), not
  // the public host. Host is what the browser requested and the proxy routed
  // on; X-Forwarded-Host is client-settable, so it's not used.
  const host = (req.headers.get("host") ?? url.host).toLowerCase();
  if (host !== sandboxHost) return notFound();

  const found = await frameViz((await ctx.params).id, url.searchParams.get("preview"));
  if (!found) return notFound();
  const { viz, subdomain, preview } = found;
  const nonce = randomToken(18);
  const ancestors = [...new Set([config.siteUrl(subdomain), config.appUrl])];
  return new Response(frameDocument({ title: viz.title, html: viz.html, css: viz.css, js: viz.js, data: viz.data }, nonce), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": frameCsp(nonce, ancestors),
      "Permissions-Policy": FRAME_PERMISSIONS_POLICY,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Cross-Origin-Opener-Policy": "same-origin",
      "X-Robots-Tag": "noindex",
      // The embed URL changes with the code and data, so a short cache is safe; previews never cache.
      "Cache-Control": preview ? "no-store" : "public, max-age=60",
    },
  });
}
