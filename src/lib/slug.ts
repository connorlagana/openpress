export function slugify(input: string, maxLength = 80): string {
  const s = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return s || "untitled";
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

/** Subdomains we never hand out: platform surfaces, impersonation bait, infra names. */
export const RESERVED_SUBDOMAINS = new Set([
  "www", "app", "api", "mcp", "admin", "dashboard", "auth", "login", "signup", "oauth", "account", "accounts",
  "mail", "email", "smtp", "ftp", "cdn", "static", "assets", "media", "files", "status", "docs", "help",
  "support", "blog", "billing", "pay", "payments", "secure", "security", "verify", "official", "root",
  "system", "staff", "team", "internal", "dev", "staging", "test", "localhost", "site", "sites", "abuse",
  "google", "apple", "microsoft", "paypal", "openai", "anthropic", "claude", "chatgpt", "amazon", "facebook",
]);

/** Page slugs that would shadow built-in public routes. */
export const RESERVED_PAGE_SLUGS = new Set(["blog", "feed", "rss.xml", "sitemap.xml", "robots.txt", "media", "api", "tag", "_next"]);

/** Given a desired slug and the set of taken slugs, return the first free variant: foo, foo-2, foo-3... */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}
