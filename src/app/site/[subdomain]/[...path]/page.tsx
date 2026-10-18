import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { findRedirect, getPublishedPost } from "@/server/public/data";
import { loadPublicSite, pageMetadata, trackView } from "@/server/public/render";
import { Article } from "@/templates/components";

type Props = PageProps<"/site/[subdomain]/[...path]">;

// Static pages live at /<slug>. Any other path is checked against the
// redirect table (301s recorded when published URLs change).
async function load(params: Props["params"]) {
  const { subdomain, path } = await params;
  const site = await loadPublicSite(subdomain);
  if (!site) notFound();
  const found = path.length === 1 ? await getPublishedPost(subdomain, "page", decodeURIComponent(path[0])) : null;
  if (!found) {
    const to = await findRedirect(site.id, "/" + path.map(decodeURIComponent).join("/"));
    if (to) permanentRedirect(to);
    notFound();
  }
  return found;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { site, post } = await load(params);
  return pageMetadata(site, {
    path: `/${post.slug}`,
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt,
    image: post.ogImageUrl ?? post.coverUrl,
    noindex: post.noindex,
    canonical: post.canonicalUrl,
  });
}

export default async function StaticPage({ params }: Props) {
  const { site, post } = await load(params);
  await trackView(site, `/${post.slug}`);
  return (
    <div className="fs-container">
      <Article site={site} post={post} />
    </div>
  );
}
