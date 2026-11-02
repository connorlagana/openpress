import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { withUser, type Tx } from "@/db/client";
import { media, postRevisions, posts, redirects, type Post, type Site } from "@/db/schema";
import { config } from "@/lib/config";
import { AppError, notFound } from "@/lib/errors";
import { plainText, renderMarkdown } from "@/lib/markdown";
import { RESERVED_PAGE_SLUGS, SLUG_RE, slugify, uniqueSlug } from "@/lib/slug";
import { requireScope, type Actor } from "../actor";
import { requireConfirmation } from "../confirm";
import { notifyIndexNow } from "../indexnow";
import { audit } from "./audit";
import { assertChartsOnSite } from "./charts";
import { assertUserActive, getPlanForUser, sitePostCount } from "./limits";
import { loadSite } from "./sites";

const slugSchema = z.string().trim().toLowerCase().max(80).regex(SLUG_RE, "Slug may contain lowercase letters, numbers and single hyphens");
const httpUrl = z.string().trim().url().max(2000).refine((v) => /^https?:\/\//i.test(v), "Must be an http(s) URL");

export const seoInput = z.object({
  seoTitle: z.string().trim().max(70).nullable().optional().describe("Title tag / social title. Defaults to the post title. Aim for under 60 characters."),
  seoDescription: z.string().trim().max(200).nullable().optional().describe("Meta description. Defaults to the excerpt. Aim for 120-160 characters."),
  ogImageUrl: httpUrl.nullable().optional().describe("Social share image URL. Defaults to the cover image."),
  canonicalUrl: httpUrl.nullable().optional().describe("Only set when the content was first published elsewhere."),
  noindex: z.boolean().optional().describe("Ask search engines not to index this URL"),
});

export const createPostInput = z
  .object({
    siteId: z.string().describe("Site id or subdomain"),
    kind: z.enum(["post", "page"]).default("post").describe("'post' = dated blog post at /blog/<slug>; 'page' = static page at /<slug>"),
    title: z.string().trim().min(1).max(200),
    content: z.string().max(200_000).default("").describe("Body in Markdown (GitHub-flavored). Raw HTML is sanitized; scripts, iframes and styles are removed. Embed a chart from create_chart by putting its {{chart:<id>}} token on its own line."),
    slug: slugSchema.optional().describe("URL slug. Derived from the title if omitted; collisions get a numeric suffix."),
    excerpt: z.string().trim().max(400).optional().describe("Short summary for listings and default meta description"),
    tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
    coverMediaId: z.string().uuid().nullable().optional().describe("Media id (from upload_media) used as the cover / social image"),
    authorName: z.string().trim().max(80).optional(),
  })
  .merge(seoInput);

export const updatePostInput = createPostInput.omit({ siteId: true, kind: true }).partial().extend({
  slug: slugSchema.optional().describe("Changing the slug of a published post creates a 301 redirect from the old URL."),
});

export const listPostsInput = z.object({
  siteId: z.string(),
  kind: z.enum(["post", "page"]).optional(),
  status: z.enum(["draft", "published"]).optional(),
  query: z.string().trim().max(100).optional().describe("Case-insensitive title search"),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export function postPath(p: Pick<Post, "kind" | "slug">) {
  return p.kind === "page" ? `/${p.slug}` : `/blog/${p.slug}`;
}

/** A post appearing or disappearing also changes the homepage and /blog listings. */
function listingPaths(p: Pick<Post, "kind" | "slug">) {
  return p.kind === "post" ? [postPath(p), "/blog", "/"] : [postPath(p)];
}

/** A search engine ping to send once the transaction has committed. */
type Ping = { subdomain: string; paths: string[] } | null;

export function toPostDto(p: Post, site: Pick<Site, "subdomain">, opts: { content?: boolean } = {}) {
  const path = postPath(p);
  return {
    id: p.id,
    siteId: p.siteId,
    kind: p.kind,
    title: p.title,
    slug: p.slug,
    status: p.status,
    path,
    url: `${config.siteUrl(site.subdomain)}${path}`,
    isLive: p.status === "published",
    excerpt: p.excerpt,
    tags: p.tags,
    coverMediaId: p.coverMediaId,
    authorName: p.authorName,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    updatedAt: p.updatedAt.toISOString(),
    createdVia: p.createdVia,
    seo: { seoTitle: p.seoTitle, seoDescription: p.seoDescription, ogImageUrl: p.ogImageUrl, canonicalUrl: p.canonicalUrl, noindex: p.noindex },
    ...(opts.content ? { content: p.contentMd } : {}),
  };
}

async function takenSlugs(tx: Tx, siteId: string, kind: "post" | "page", base: string, excludeId?: string) {
  const rows = await tx
    .select({ slug: posts.slug, id: posts.id })
    .from(posts)
    .where(and(eq(posts.siteId, siteId), eq(posts.kind, kind), isNull(posts.deletedAt), or(eq(posts.slug, base), sql`${posts.slug} like ${base + "-%"}`)));
  const set = new Set(rows.filter((r) => r.id !== excludeId).map((r) => r.slug));
  if (kind === "page") for (const r of RESERVED_PAGE_SLUGS) set.add(r);
  return set;
}

async function assertMediaOnSite(tx: Tx, siteId: string, mediaId: string | null | undefined) {
  if (!mediaId) return;
  const [m] = await tx.select({ id: media.id }).from(media).where(and(eq(media.id, mediaId), eq(media.siteId, siteId), isNull(media.deletedAt)));
  if (!m) throw new AppError("VALIDATION", "coverMediaId: media not found on this site");
}

export async function loadPost(tx: Tx, actor: Actor, postId: string): Promise<{ post: Post; site: Site }> {
  if (!/^[0-9a-f-]{36}$/i.test(postId)) throw notFound("Post");
  const [post] = await tx.select().from(posts).where(and(eq(posts.id, postId), isNull(posts.deletedAt)));
  if (!post) throw notFound("Post");
  const site = await loadSite(tx, actor, post.siteId);
  return { post, site };
}

export async function createPost(actor: Actor, input: z.input<typeof createPostInput>) {
  requireScope(actor, "content:write");
  const data = createPostInput.parse(input);
  return withUser(actor.userId, async (tx) => {
    await assertUserActive(tx, actor.userId);
    const site = await loadSite(tx, actor, data.siteId);
    const plan = await getPlanForUser(tx, actor.userId);
    if ((await sitePostCount(tx, site.id)) >= plan.maxPostsPerSite) {
      throw new AppError("QUOTA_EXCEEDED", `This site has reached the ${plan.maxPostsPerSite} post/page limit of the ${plan.name} plan.`);
    }
    await assertMediaOnSite(tx, site.id, data.coverMediaId);
    await assertChartsOnSite(tx, site.id, data.content);

    let slug: string;
    if (data.slug) {
      const taken = await takenSlugs(tx, site.id, data.kind, data.slug);
      if (taken.has(data.slug)) {
        throw new AppError("CONFLICT", `The slug "${data.slug}" is already used${RESERVED_PAGE_SLUGS.has(data.slug) ? " by a built-in route" : ""}.`, {
          suggestion: uniqueSlug(data.slug, taken),
        });
      }
      slug = data.slug;
    } else {
      const base = slugify(data.title);
      slug = uniqueSlug(base, await takenSlugs(tx, site.id, data.kind, base));
    }

    const [post] = await tx
      .insert(posts)
      .values({
        siteId: site.id,
        kind: data.kind,
        title: data.title,
        slug,
        excerpt: data.excerpt ?? (data.content ? plainText(data.content, 200) : null),
        contentMd: data.content,
        contentHtml: renderMarkdown(data.content),
        tags: data.tags ?? [],
        coverMediaId: data.coverMediaId ?? null,
        authorName: data.authorName,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        ogImageUrl: data.ogImageUrl,
        canonicalUrl: data.canonicalUrl,
        noindex: data.noindex ?? false,
        createdBy: actor.userId,
        createdVia: actor.kind === "agent" ? "agent" : "dashboard",
        agentConnectionId: actor.kind === "agent" ? actor.connectionId : null,
      })
      .returning();
    await audit(tx, actor, `${data.kind}.create`, { siteId: site.id, targetType: data.kind, targetId: post.id, metadata: { title: post.title, slug } });
    return toPostDto(post, site, { content: true });
  });
}

export async function getPost(actor: Actor, postId: string) {
  requireScope(actor, "sites:read");
  return withUser(actor.userId, async (tx) => {
    const { post, site } = await loadPost(tx, actor, postId);
    return toPostDto(post, site, { content: true });
  });
}

/** Look up by site + slug, for agents that know the URL but not the id. */
export async function getPostBySlug(actor: Actor, siteId: string, kind: "post" | "page", slug: string) {
  requireScope(actor, "sites:read");
  return withUser(actor.userId, async (tx) => {
    const site = await loadSite(tx, actor, siteId);
    const [post] = await tx.select().from(posts).where(and(eq(posts.siteId, site.id), eq(posts.kind, kind), eq(posts.slug, slug), isNull(posts.deletedAt)));
    if (!post) throw notFound(kind === "page" ? "Page" : "Post");
    return toPostDto(post, site, { content: true });
  });
}

export async function listPosts(actor: Actor, input: z.input<typeof listPostsInput>) {
  requireScope(actor, "sites:read");
  const data = listPostsInput.parse(input);
  return withUser(actor.userId, async (tx) => {
    const site = await loadSite(tx, actor, data.siteId);
    const where = and(
      eq(posts.siteId, site.id),
      isNull(posts.deletedAt),
      data.kind ? eq(posts.kind, data.kind) : undefined,
      data.status ? eq(posts.status, data.status) : undefined,
      data.query ? ilike(posts.title, `%${data.query.replace(/[%_\\]/g, "\\$&")}%`) : undefined,
    );
    const rows = await tx
      .select()
      .from(posts)
      .where(where)
      .orderBy(desc(sql`coalesce(${posts.publishedAt}, ${posts.updatedAt})`))
      .limit(data.limit + 1)
      .offset(data.offset);
    return {
      items: rows.slice(0, data.limit).map((p) => toPostDto(p, site)),
      hasMore: rows.length > data.limit,
      nextOffset: rows.length > data.limit ? data.offset + data.limit : null,
    };
  });
}

export async function updatePost(actor: Actor, postId: string, input: z.input<typeof updatePostInput>) {
  requireScope(actor, "content:write");
  const data = updatePostInput.parse(input);
  let ping = null as Ping; // assigned inside the transaction callback
  const result = await withUser(actor.userId, async (tx) => {
    await assertUserActive(tx, actor.userId);
    const { post, site } = await loadPost(tx, actor, postId);
    await assertMediaOnSite(tx, site.id, data.coverMediaId);
    if (data.content !== undefined) await assertChartsOnSite(tx, site.id, data.content);

    let slug = post.slug;
    if (data.slug && data.slug !== post.slug) {
      const taken = await takenSlugs(tx, site.id, post.kind, data.slug, post.id);
      if (taken.has(data.slug)) throw new AppError("CONFLICT", `The slug "${data.slug}" is already used.`, { suggestion: uniqueSlug(data.slug, taken) });
      slug = data.slug;
    }

    // Snapshot the previous version before changing content.
    if (data.content !== undefined || data.title !== undefined || slug !== post.slug) {
      await tx.insert(postRevisions).values({
        postId: post.id,
        siteId: site.id,
        title: post.title,
        slug: post.slug,
        contentMd: post.contentMd,
        createdBy: actor.userId,
        createdVia: actor.kind === "agent" ? "agent" : "dashboard",
      });
    }

    const [updated] = await tx
      .update(posts)
      .set({
        title: data.title,
        slug,
        excerpt: data.excerpt,
        ...(data.content !== undefined ? { contentMd: data.content, contentHtml: renderMarkdown(data.content) } : {}),
        tags: data.tags,
        coverMediaId: data.coverMediaId,
        authorName: data.authorName,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        ogImageUrl: data.ogImageUrl,
        canonicalUrl: data.canonicalUrl,
        noindex: data.noindex,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, post.id))
      .returning();

    if (slug !== post.slug && post.publishedAt) {
      await addRedirect(tx, site.id, postPath(post), postPath(updated));
    }
    await audit(tx, actor, `${post.kind}.update`, { siteId: site.id, targetType: post.kind, targetId: post.id, metadata: { fields: Object.keys(data) } });
    if (updated.status === "published" && !site.suspendedAt) ping = { subdomain: site.subdomain, paths: [postPath(updated), postPath(post)] };
    return toPostDto(updated, site, { content: true });
  });
  if (ping) notifyIndexNow(ping.subdomain, ping.paths);
  return result;
}

/** Record a 301 old -> new, repointing existing chains and dropping any redirect that would shadow the new URL. */
async function addRedirect(tx: Tx, siteId: string, from: string, to: string) {
  await tx.delete(redirects).where(and(eq(redirects.siteId, siteId), eq(redirects.fromPath, to)));
  await tx.update(redirects).set({ toPath: to }).where(and(eq(redirects.siteId, siteId), eq(redirects.toPath, from)));
  await tx
    .insert(redirects)
    .values({ siteId, fromPath: from, toPath: to })
    .onConflictDoUpdate({ target: [redirects.siteId, redirects.fromPath], set: { toPath: to } });
}

export async function setPublished(actor: Actor, postId: string, publish: boolean, confirmationToken?: string) {
  requireScope(actor, "content:publish");
  let ping = null as Ping; // assigned inside the transaction callback
  const result = await withUser(actor.userId, async (tx) => {
    await assertUserActive(tx, actor.userId);
    const { post, site } = await loadPost(tx, actor, postId);
    if (site.suspendedAt) throw new AppError("SUSPENDED", "This site is suspended and cannot publish.");
    if ((post.status === "published") === publish) return { ...toPostDto(post, site), changed: false };
    if (publish && !post.title.trim()) throw new AppError("VALIDATION", "Add a title before publishing.");
    await requireConfirmation(actor, {
      action: publish ? "publish" : "unpublish",
      targetId: post.id,
      required: actor.kind === "agent" && actor.confirmPublish,
      token: confirmationToken,
      summary: `${publish ? "Publish" : "Unpublish"} ${post.kind} "${post.title}" ${publish ? "at" : "from"} ${config.siteUrl(site.subdomain)}${postPath(post)}. Ask the user to confirm, then call again with confirmation_token.`,
    });
    const [updated] = await tx
      .update(posts)
      .set({
        status: publish ? "published" : "draft",
        publishedAt: publish ? (post.publishedAt ?? new Date()) : post.publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, post.id))
      .returning();
    await audit(tx, actor, `${post.kind}.${publish ? "publish" : "unpublish"}`, {
      siteId: site.id,
      targetType: post.kind,
      targetId: post.id,
      metadata: { title: post.title, path: postPath(post) },
    });
    ping = { subdomain: site.subdomain, paths: listingPaths(updated) };
    return { ...toPostDto(updated, site), changed: true };
  });
  if (ping) notifyIndexNow(ping.subdomain, ping.paths);
  return result;
}

export async function deletePost(actor: Actor, postId: string, confirmationToken?: string) {
  requireScope(actor, "content:write");
  let ping = null as Ping; // assigned inside the transaction callback
  const result = await withUser(actor.userId, async (tx) => {
    const { post, site } = await loadPost(tx, actor, postId);
    await requireConfirmation(actor, {
      action: "delete_post",
      targetId: post.id,
      required: true,
      token: confirmationToken,
      summary: `Permanently remove ${post.status === "published" ? "the PUBLISHED" : "the draft"} ${post.kind} "${post.title}"${post.status === "published" ? ` (live at ${config.siteUrl(site.subdomain)}${postPath(post)})` : ""}. Ask the user to confirm, then call again with confirmation_token.`,
    });
    await tx.update(posts).set({ deletedAt: new Date(), status: "draft" }).where(eq(posts.id, post.id));
    await audit(tx, actor, `${post.kind}.delete`, { siteId: site.id, targetType: post.kind, targetId: post.id, metadata: { title: post.title } });
    if (post.status === "published" && !site.suspendedAt) ping = { subdomain: site.subdomain, paths: listingPaths(post) };
    return { id: post.id, deleted: true };
  });
  if (ping) notifyIndexNow(ping.subdomain, ping.paths);
  return result;
}

export async function listRevisions(actor: Actor, postId: string) {
  requireScope(actor, "sites:read");
  return withUser(actor.userId, async (tx) => {
    const { post } = await loadPost(tx, actor, postId);
    return tx
      .select({ id: postRevisions.id, title: postRevisions.title, createdAt: postRevisions.createdAt, createdVia: postRevisions.createdVia })
      .from(postRevisions)
      .where(eq(postRevisions.postId, post.id))
      .orderBy(desc(postRevisions.createdAt))
      .limit(50);
  });
}
