import type { NextConfig } from "next";

// Public sites are served from <subdomain>.<ROOT_DOMAIN>. A host-based rewrite
// (instead of proxy.ts) keeps routing inside the Next.js router config, which
// OpenNext on Cloudflare supports fully; Node.js proxy there is experimental.
const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").split(":")[0];
const escaped = rootDomain.replace(/\./g, "\\.");

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  // Lets the e2e suite run its own dev server alongside a regular one.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  experimental: { globalNotFound: true },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/:path*",
          has: [{ type: "host", value: `(?<subdomain>[a-z0-9-]+)\\.${escaped}` }],
          destination: "/site/:subdomain/:path*",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
