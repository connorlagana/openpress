import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Public sites deliberately use plain <a> (full page loads: no client router,
    // no prefetch requests inflating analytics) and plain <img> (user media is
    // already sized/served from R2; next/image optimization is a paid add-on on Cloudflare).
    files: ["src/templates/**", "src/app/site/**", "src/app/global-not-found.tsx"],
    rules: { "@next/next/no-html-link-for-pages": "off", "@next/next/no-img-element": "off" },
  },
  {
    files: ["tests/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  globalIgnores([".next/**", ".next-e2e/**", ".open-next/**", ".wrangler/**", ".data/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
