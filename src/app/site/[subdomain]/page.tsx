import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listPublishedPosts } from "@/server/public/data";
import { loadPublicSite, pageMetadata, trackView } from "@/server/public/render";
import { HOMEPAGES } from "@/templates/components";

export async function generateMetadata({ params }: PageProps<"/site/[subdomain]">): Promise<Metadata> {
  const site = await loadPublicSite((await params).subdomain);
  if (!site) notFound();
  return { ...pageMetadata(site, { path: "/", title: site.tagline ? `${site.name} — ${site.tagline}` : site.name }), title: { absolute: site.tagline ? `${site.name} — ${site.tagline}` : site.name } };
}

export default async function SiteHome({ params }: PageProps<"/site/[subdomain]">) {
  const site = await loadPublicSite((await params).subdomain);
  if (!site) notFound();
  const { items } = await listPublishedPosts(site.id, { limit: site.settingsParsed.postsPerPage ?? 10 });
  await trackView(site, "/");
  const Home = HOMEPAGES[site.template as keyof typeof HOMEPAGES] ?? HOMEPAGES.editorial;
  return <Home site={site} posts={site.settingsParsed.showPostsOnHome === false ? [] : items} />;
}
