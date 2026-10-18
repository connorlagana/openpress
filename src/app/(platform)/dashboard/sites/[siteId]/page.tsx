import type { Metadata } from "next";
import { loadDashboardSite } from "@/server/auth/load";
import { ContentList } from "./content-list";

export const metadata: Metadata = { title: "Posts" };

export default async function PostsPage({ params, searchParams }: PageProps<"/dashboard/sites/[siteId]">) {
  const { actor, site } = await loadDashboardSite((await params).siteId);
  const status = (await searchParams).status;
  return <ContentList actor={actor} siteId={site.id} kind="post" status={status === "draft" || status === "published" ? status : undefined} basePath={`/dashboard/sites/${site.id}`} />;
}
