import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, withUser, type Tx } from "@/db/client";
import { agentConnectionSites, media, navItems, posts, siteMembers, sites, themes, type Site } from "@/db/schema";
import { config } from "@/lib/config";
import { AppError, notFound } from "@/lib/errors";
import { RESERVED_SUBDOMAINS, SUBDOMAIN_RE, slugify } from "@/lib/slug";
import { resolveTheme } from "@/lib/theme";
import { getTemplate, parseSettings, siteSettingsSchema, templateIdSchema } from "@/templates/registry";
import { assertSiteAllowed, requireScope, siteAllowed, type Actor } from "../actor";
import { audit } from "./audit";
import { assertUserActive, getPlanForUser, ownedSiteCount } from "./limits";

export const createSiteInput = z.object({
  name: z.string().trim().min(1).max(80).describe("Site name, e.g. 'The Engineering Journal'"),
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .describe(`Desired subdomain (3-32 chars, a-z 0-9 -). The site will live at https://<subdomain>.${config.rootDomain}. Derived from the name if omitted.`),
  template: templateIdSchema.optional().describe("Starter template id from list_templates. Defaults to 'editorial'."),
  tagline: z.string().trim().max(160).optional(),
  description: z.string().trim().max(500).optional().describe("Used as the homepage meta description"),
});

export const navLinkSchema = z.object({
  label: z.string().trim().min(1).max(40),
  href: z
    .string()
    .trim()
    .max(500)
    .refine((v) => /^https?:\/\//i.test(v) || /^\/(?!\/)/.test(v), "Use an http(s) URL or a path starting with /"),
});

export const updateSiteInput = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  tagline: z.string().trim().max(160).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  language: z.string().trim().regex(/^[a-z]{2}(-[A-Z]{2})?$/).optional().describe("BCP 47 language tag, e.g. en or en-US"),
  logoMediaId: z.string().uuid().nullable().optional().describe("Media id from upload_media to use as the logo"),
  faviconMediaId: z.string().uuid().nullable().optional().describe("Media id from upload_media to use as the favicon"),
  settings: siteSettingsSchema.partial().optional().describe("Structured homepage content. Keys provided replace existing values; omitted keys are kept."),
  navigation: z
    .object({ header: z.array(navLinkSchema).max(12).optional(), footer: z.array(navLinkSchema).max(20).optional() })
    .optional()
    .describe("Replaces the header and/or footer menu. Pages live at /<slug>, posts at /blog/<slug>."),
});

export function siteUrl(site: Pick<Site, "subdomain">) {
  return config.siteUrl(site.subdomain);
}

export function validateSubdomain(sub: string): string | null {
  if (!SUBDOMAIN_RE.test(sub)) return "Subdomain must be 3-32 characters: lowercase letters, numbers and hyphens, not starting or ending with a hyphen.";
  if (RESERVED_SUBDOMAINS.has(sub)) return `"${sub}" is reserved.`;
  if (sub.includes("--")) return "Subdomain cannot contain consecutive hyphens.";
  return null;
}

/** Availability must be checked outside RLS: other tenants' sites are invisible to the caller. */
export async function isSubdomainAvailable(sub: string): Promise<boolean> {
  const db = await getDb();
  const [r] = await db.select({ n: count() }).from(sites).where(and(eq(sites.subdomain, sub), isNull(sites.deletedAt)));
  return Number(r?.n ?? 0) === 0;
}

async function pickSubdomain(name: string): Promise<string> {
  let base = slugify(name, 28).replace(/^-|-$/g, "");
  if (base.length < 3) base = `${base}-site`.replace(/^-/, "");
  if (RESERVED_SUBDOMAINS.has(base)) base = `${base}-site`;
  if (await isSubdomainAvailable(base)) return base;
  for (let i = 2; i < 50; i++) {
    const c = `${base}-${i}`;
    if (await isSubdomainAvailable(c)) return c;
  }
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function createSite(actor: Actor, input: z.input<typeof createSiteInput>) {
  requireScope(actor, "sites:write");
  const data = createSiteInput.parse(input);
  let subdomain = data.subdomain;
  if (subdomain) {
    const err = validateSubdomain(subdomain);
    if (err) throw new AppError("VALIDATION", err);
    if (!(await isSubdomainAvailable(subdomain))) {
      throw new AppError("CONFLICT", `The subdomain "${subdomain}" is taken.`, { suggestion: await pickSubdomain(subdomain) });
    }
  } else {
    subdomain = await pickSubdomain(data.name);
  }
  const template = getTemplate(data.template ?? "editorial");

  const site = await withUser(actor.userId, async (tx) => {
    await assertUserActive(tx, actor.userId);
    const plan = await getPlanForUser(tx, actor.userId);
    if ((await ownedSiteCount(tx, actor.userId)) >= plan.maxSites) {
      throw new AppError(
        "QUOTA_EXCEEDED",
        `The ${plan.name} plan includes ${plan.maxSites} site${plan.maxSites === 1 ? "" : "s"}. Delete an existing site or use list_sites to work with the one you have.`,
      );
    }
    let created: Site;
    try {
      [created] = await tx
        .insert(sites)
        .values({
          ownerId: actor.userId,
          subdomain: subdomain!,
          name: data.name,
          tagline: data.tagline,
          description: data.description,
          template: template.id,
          settings: template.settings(data.name),
        })
        .returning();
    } catch (e) {
      if (isUniqueViolation(e)) throw new AppError("CONFLICT", `The subdomain "${subdomain}" is taken.`);
      throw e;
    }
    await tx.insert(siteMembers).values({ siteId: created.id, userId: actor.userId, role: "owner" });
    await tx.insert(themes).values({ siteId: created.id, tokens: template.theme });
    await replaceNav(tx, created.id, template.nav);
    if (actor.kind === "agent" && actor.siteIds !== "all") {
      // An agent restricted to specific sites gets access to sites it creates.
      await tx.insert(agentConnectionSites).values({ connectionId: actor.connectionId, siteId: created.id });
    }
    await audit(tx, actor, "site.create", { siteId: created.id, targetType: "site", targetId: created.id, metadata: { subdomain, template: template.id } });
    return created;
  });
  return toSiteSummary(site);
}

export function toSiteSummary(s: Site, extra?: { postCount?: number; publishedCount?: number }) {
  return {
    id: s.id,
    name: s.name,
    subdomain: s.subdomain,
    url: siteUrl(s),
    template: s.template,
    tagline: s.tagline,
    description: s.description,
    suspended: !!s.suspendedAt,
    createdAt: s.createdAt.toISOString(),
    ...extra,
  };
}

export async function listSites(actor: Actor) {
  requireScope(actor, "sites:read");
  return withUser(actor.userId, async (tx) => {
    const rows = await tx
      .select({
        site: sites,
        postCount: sql<number>`(select count(*)::int from posts p where p.site_id = ${sites.id} and p.deleted_at is null)`,
        publishedCount: sql<number>`(select count(*)::int from posts p where p.site_id = ${sites.id} and p.deleted_at is null and p.status = 'published')`,
      })
      .from(sites)
      .where(isNull(sites.deletedAt))
      .orderBy(asc(sites.createdAt));
    return rows
      .filter((r) => siteAllowed(actor, r.site.id))
      .map((r) => toSiteSummary(r.site, { postCount: Number(r.postCount), publishedCount: Number(r.publishedCount) }));
  });
}

/** Load a live site the actor may access, by id or subdomain. Runs inside the caller's tenant transaction. */
export async function loadSite(tx: Tx, actor: Actor, idOrSubdomain: string): Promise<Site> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSubdomain);
  const [site] = await tx
    .select()
    .from(sites)
    .where(and(isUuid ? eq(sites.id, idOrSubdomain) : eq(sites.subdomain, idOrSubdomain.toLowerCase()), isNull(sites.deletedAt)));
  if (!site) throw notFound("Site");
  assertSiteAllowed(actor, site.id);
  return site;
}

export async function getSite(actor: Actor, siteId: string) {
  requireScope(actor, "sites:read");
  return withUser(actor.userId, (tx) => readSite(tx, actor, siteId));
}

async function readSite(tx: Tx, actor: Actor, siteId: string) {
    const site = await loadSite(tx, actor, siteId);
    const [theme] = await tx.select().from(themes).where(eq(themes.siteId, site.id));
    const nav = await tx.select().from(navItems).where(eq(navItems.siteId, site.id)).orderBy(asc(navItems.position));
    const counts = await tx
      .select({ kind: posts.kind, status: posts.status, n: count() })
      .from(posts)
      .where(and(eq(posts.siteId, site.id), isNull(posts.deletedAt)))
      .groupBy(posts.kind, posts.status);
    const template = getTemplate(site.template);
    return {
      ...toSiteSummary(site),
      language: site.language,
      logoMediaId: site.logoMediaId,
      faviconMediaId: site.faviconMediaId,
      settings: parseSettings(site.settings),
      theme: resolveTheme(template.theme, theme?.tokens),
      navigation: {
        header: nav.filter((n) => n.location === "header").map(({ label, href }) => ({ label, href })),
        footer: nav.filter((n) => n.location === "footer").map(({ label, href }) => ({ label, href })),
      },
      contentCounts: counts.map((c) => ({ kind: c.kind, status: c.status, count: Number(c.n) })),
    };
}

async function replaceNav(tx: Tx, siteId: string, nav: { header?: { label: string; href: string }[]; footer?: { label: string; href: string }[] }) {
  for (const location of ["header", "footer"] as const) {
    const items = nav[location];
    if (!items) continue;
    await tx.delete(navItems).where(and(eq(navItems.siteId, siteId), eq(navItems.location, location)));
    if (items.length) {
      await tx.insert(navItems).values(items.map((it, i) => ({ siteId, location, label: it.label, href: it.href, position: i })));
    }
  }
}

export async function updateSiteSettings(actor: Actor, siteId: string, input: z.input<typeof updateSiteInput>) {
  requireScope(actor, "sites:write");
  const data = updateSiteInput.parse(input);
  return withUser(actor.userId, async (tx) => {
    const site = await loadSite(tx, actor, siteId);
    for (const key of ["logoMediaId", "faviconMediaId"] as const) {
      const id = data[key];
      if (id) {
        const [m] = await tx.select({ id: media.id }).from(media).where(and(eq(media.id, id), eq(media.siteId, site.id), isNull(media.deletedAt)));
        if (!m) throw new AppError("VALIDATION", `${key}: media not found on this site`);
      }
    }
    const settings = data.settings ? { ...parseSettings(site.settings), ...data.settings } : undefined;
    await tx
      .update(sites)
      .set({
        name: data.name,
        tagline: data.tagline,
        description: data.description,
        language: data.language,
        logoMediaId: data.logoMediaId,
        faviconMediaId: data.faviconMediaId,
        settings,
        updatedAt: new Date(),
      })
      .where(eq(sites.id, site.id));
    if (data.navigation) await replaceNav(tx, site.id, data.navigation);
    await audit(tx, actor, "site.update", { siteId: site.id, targetType: "site", targetId: site.id, metadata: { fields: Object.keys(data) } });
    return readSite(tx, actor, site.id);
  });
}

export async function deleteSite(actor: Actor, siteId: string) {
  requireScope(actor, "sites:delete");
  return withUser(actor.userId, async (tx) => {
    const site = await loadSite(tx, actor, siteId);
    if (site.ownerId !== actor.userId) throw new AppError("FORBIDDEN", "Only the site owner can delete a site.");
    await tx.update(sites).set({ deletedAt: new Date() }).where(eq(sites.id, site.id));
    await audit(tx, actor, "site.delete", { siteId: site.id, targetType: "site", targetId: site.id, metadata: { subdomain: site.subdomain } });
    return { id: site.id, subdomain: site.subdomain, deleted: true };
  });
}

/** Site ids the user is a member of (used for agent consent screens). */
export async function memberSiteIds(userId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  return withUser(userId, async (tx) =>
    (await tx.select({ id: sites.id }).from(sites).where(and(inArray(sites.id, ids), isNull(sites.deletedAt)))).map((r) => r.id),
  );
}

export function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}
