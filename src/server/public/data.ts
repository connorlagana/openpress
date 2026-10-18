import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { media, navItems, posts, redirects, sites, themes, users, type Post, type Site } from "@/db/schema";
import { resolveTheme, type Theme } from "@/lib/theme";
import { getTemplate, parseSettings, type SiteSettings } from "@/templates/registry";
import { mediaUrl } from "../storage";

// Public, unauthenticated reads for rendering sites. These use the privileged
// connection, so every query here MUST filter to published, live content.

export type PublicSite = Site & {
  theme: Theme;
  settingsParsed: SiteSettings;
  nav: { header: { label: string; href: string }[]; footer: { label: string; href: string }[] };
  logoUrl: string | null;
  faviconUrl: string | null;
};

export async function getPublicSite(subdomain: string): Promise<PublicSite | null> {
  if (!/^[a-z0-9-]{1,63}$/.test(subdomain)) return null;
  const db = await getDb();
  const [row] = await db
    .select({ site: sites, tokens: themes.tokens, ownerSuspended: users.suspendedAt })
    .from(sites)
    .innerJoin(users, eq(sites.ownerId, users.id))
    .leftJoin(themes, eq(themes.siteId, sites.id))
    .where(and(eq(sites.subdomain, subdomain), isNull(sites.deletedAt)));
  if (!row || row.site.suspendedAt || row.ownerSuspended) return null;
  const site = row.site;
  const nav = await db.select().from(navItems).where(eq(navItems.siteId, site.id)).orderBy(asc(navItems.position));
  const mediaIds = [site.logoMediaId, site.faviconMediaId].filter(Boolean) as string[];
  const mediaRows = mediaIds.length
    ? await db.select().from(media).where(and(eq(media.siteId, site.id), isNull(media.deletedAt), sql`${media.id} in ${mediaIds}`))
    : [];
  const urlFor = (id: string | null) => {
    const m = mediaRows.find((r) => r.id === id);
    return m ? mediaUrl(m.storageKey) : null;
  };
  return {
    ...site,
    theme: resolveTheme(getTemplate(site.template).theme, row.tokens),
    settingsParsed: parseSettings(site.settings),
    nav: {
      header: nav.filter((n) => n.location === "header").map(({ label, href }) => ({ label, href })),
      footer: nav.filter((n) => n.location === "footer").map(({ label, href }) => ({ label, href })),
    },
    logoUrl: urlFor(site.logoMediaId),
    faviconUrl: urlFor(site.faviconMediaId),
  };
}

export type PublicPost = Post & { coverUrl: string | null; coverAlt: string | null; coverWidth: number | null; coverHeight: number | null };

const publishedPostColumns = {
  post: posts,
  coverKey: media.storageKey,
  coverAlt: media.altText,
  coverWidth: media.width,
  coverHeight: media.height,
};

function withCover(r: { post: Post; coverKey: string | null; coverAlt: string | null; coverWidth: number | null; coverHeight: number | null }): PublicPost {
  return { ...r.post, coverUrl: r.coverKey ? mediaUrl(r.coverKey) : null, coverAlt: r.coverAlt, coverWidth: r.coverWidth, coverHeight: r.coverHeight };
}

export async function getPublishedPost(subdomain: string, kind: "post" | "page", slug: string): Promise<{ site: PublicSite; post: PublicPost } | null> {
  const site = await getPublicSite(subdomain);
  if (!site) return null;
  const db = await getDb();
  const [row] = await db
    .select(publishedPostColumns)
    .from(posts)
    .leftJoin(media, and(eq(posts.coverMediaId, media.id), isNull(media.deletedAt)))
    .where(and(eq(posts.siteId, site.id), eq(posts.kind, kind), eq(posts.slug, slug), eq(posts.status, "published"), isNull(posts.deletedAt)));
  return row ? { site, post: withCover(row) } : null;
}

export async function listPublishedPosts(siteId: string, opts: { limit?: number; offset?: number; tag?: string } = {}) {
  const db = await getDb();
  const where = and(
    eq(posts.siteId, siteId),
    eq(posts.kind, "post"),
    eq(posts.status, "published"),
    isNull(posts.deletedAt),
    opts.tag ? sql`${opts.tag} = any(${posts.tags})` : undefined,
  );
  const [rows, [total]] = await Promise.all([
    db
      .select(publishedPostColumns)
      .from(posts)
      .leftJoin(media, and(eq(posts.coverMediaId, media.id), isNull(media.deletedAt)))
      .where(where)
      .orderBy(desc(posts.publishedAt))
      .limit(opts.limit ?? 10)
      .offset(opts.offset ?? 0),
    db.select({ n: count() }).from(posts).where(where),
  ]);
  return { items: rows.map(withCover), total: Number(total?.n ?? 0) };
}

export async function listPublishedPages(siteId: string) {
  const db = await getDb();
  return db
    .select({ slug: posts.slug, title: posts.title, updatedAt: posts.updatedAt, noindex: posts.noindex })
    .from(posts)
    .where(and(eq(posts.siteId, siteId), eq(posts.kind, "page"), eq(posts.status, "published"), isNull(posts.deletedAt)));
}

export async function sitemapEntries(siteId: string) {
  const db = await getDb();
  return db
    .select({ kind: posts.kind, slug: posts.slug, updatedAt: posts.updatedAt })
    .from(posts)
    .where(and(eq(posts.siteId, siteId), eq(posts.status, "published"), eq(posts.noindex, false), isNull(posts.deletedAt)))
    .orderBy(desc(posts.updatedAt))
    .limit(50_000);
}

export async function findRedirect(siteId: string, path: string) {
  const db = await getDb();
  const [r] = await db.select({ to: redirects.toPath }).from(redirects).where(and(eq(redirects.siteId, siteId), eq(redirects.fromPath, path)));
  return r?.to ?? null;
}
