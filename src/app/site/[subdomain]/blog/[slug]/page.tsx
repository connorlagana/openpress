import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { findRedirect, getPublishedPost } from "@/server/public/data";
import { articleJsonLd, loadPublicSite, pageMetadata, trackView } from "@/server/public/render";
import { Article } from "@/templates/components";

type Props = PageProps<"/site/[subdomain]/blog/[slug]">;

async function load(params: Props["params"]) {
  const { subdomain, slug } = await params;
  const site = await loadPublicSite(subdomain);
  if (!site) notFound();
  const found = await getPublishedPost(subdomain, "post", slug);
  if (!found) {
    const to = await findRedirect(site.id, `/blog/${slug}`);
    if (to) permanentRedirect(to);
    notFound();
  }
  return found;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { site, post } = await load(params);
  return pageMetadata(site, {
    path: `/blog/${post.slug}`,
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt,
    image: post.ogImageUrl ?? post.coverUrl,
    type: "article",
    post,
    noindex: post.noindex,
    canonical: post.canonicalUrl,
  });
}

export default async function PostPage({ params }: Props) {
  const { site, post } = await load(params);
  await trackView(site, `/blog/${post.slug}`);
  return (
    <div className="fs-container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleJsonLd(site, post) }} />
      <Article site={site} post={post} />
    </div>
  );
}
