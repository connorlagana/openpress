import "server-only";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { after } from "next/server";
import { cache } from "react";
import { config } from "@/lib/config";
import { recordPageview } from "../services/analytics";
import { getPublicSite, type PublicPost, type PublicSite } from "./data";

/** Per-request memoized site lookup shared by layout, metadata and page. */
export const loadPublicSite = cache((subdomain: string) => getPublicSite(subdomain));

/** Count a pageview after the response is sent. Skips prefetches. */
export async function trackView(site: PublicSite, path: string) {
  const h = await headers();
  const purpose = h.get("sec-purpose") ?? h.get("purpose") ?? "";
  if (purpose.includes("prefetch") || h.get("next-router-prefetch")) return;
  const meta = {
    siteId: site.id,
    siteHost: `${site.subdomain}.${config.rootDomain.split(":")[0]}`,
    path,
    ip: h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
    referrer: h.get("referer"),
  };
  after(() => recordPageview(meta).catch((e) => console.error("[analytics]", e)));
}

export function siteBaseMetadata(site: PublicSite): Metadata {
  const base = config.siteUrl(site.subdomain);
  return {
    metadataBase: new URL(base),
    applicationName: site.name,
    icons: site.faviconUrl ? { icon: site.faviconUrl } : undefined,
    alternates: { types: { "application/rss+xml": [{ url: `${base}/rss.xml`, title: site.name }] } },
  };
}

export function pageMetadata(site: PublicSite, opts: { path: string; title: string; description?: string | null; image?: string | null; type?: "website" | "article"; post?: PublicPost; noindex?: boolean; canonical?: string | null }): Metadata {
  const base = config.siteUrl(site.subdomain);
  const url = `${base}${opts.path === "/" ? "" : opts.path}` || base;
  const description = opts.description ?? site.description ?? site.tagline ?? undefined;
  const images = opts.image ? [{ url: opts.image }] : site.logoUrl ? [{ url: site.logoUrl }] : undefined;
  return {
    ...siteBaseMetadata(site),
    title: opts.title,
    description,
    alternates: { ...siteBaseMetadata(site).alternates, canonical: opts.canonical ?? url },
    robots: opts.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: opts.type ?? "website",
      url,
      siteName: site.name,
      title: opts.title,
      description,
      images,
      locale: site.language.replace("-", "_"),
      ...(opts.post
        ? {
            publishedTime: opts.post.publishedAt?.toISOString(),
            modifiedTime: opts.post.updatedAt.toISOString(),
            tags: opts.post.tags,
            authors: opts.post.authorName ? [opts.post.authorName] : undefined,
          }
        : {}),
    },
    twitter: { card: images ? "summary_large_image" : "summary", title: opts.title, description, images: images?.map((i) => i.url) },
  };
}

/** JSON-LD for an article. `<` is escaped so content can't close the script tag. */
export function articleJsonLd(site: PublicSite, post: PublicPost) {
  const url = `${config.siteUrl(site.subdomain)}/blog/${post.slug}`;
  const data = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt ?? undefined,
    image: post.ogImageUrl ?? post.coverUrl ?? undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Person", name: post.authorName ?? site.name },
    publisher: { "@type": "Organization", name: site.name, ...(site.logoUrl ? { logo: { "@type": "ImageObject", url: site.logoUrl } } : {}) },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    keywords: post.tags.length ? post.tags.join(", ") : undefined,
    inLanguage: site.language,
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
