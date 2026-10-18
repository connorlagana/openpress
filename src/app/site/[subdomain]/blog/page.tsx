import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listPublishedPosts } from "@/server/public/data";
import { loadPublicSite, pageMetadata, trackView } from "@/server/public/render";
import { PostList, WithSidebar } from "@/templates/components";

type Props = PageProps<"/site/[subdomain]/blog">;

async function query(searchParams: Props["searchParams"]) {
  const sp = await searchParams;
  const page = Math.max(1, Math.min(1000, Number(sp.page) || 1));
  const tag = typeof sp.tag === "string" ? sp.tag.slice(0, 40) : undefined;
  return { page, tag };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const site = await loadPublicSite((await params).subdomain);
  if (!site) notFound();
  const { page, tag } = await query(searchParams);
  const title = tag ? `Posts tagged “${tag}”` : "Blog";
  return pageMetadata(site, { path: page > 1 || tag ? `/blog?${new URLSearchParams({ ...(tag ? { tag } : {}), ...(page > 1 ? { page: String(page) } : {}) })}` : "/blog", title, noindex: !!tag });
}

export default async function BlogIndex({ params, searchParams }: Props) {
  const site = await loadPublicSite((await params).subdomain);
  if (!site) notFound();
  const { page, tag } = await query(searchParams);
  const perPage = site.settingsParsed.postsPerPage ?? 10;
  const { items, total } = await listPublishedPosts(site.id, { limit: perPage, offset: (page - 1) * perPage, tag });
  if (page > 1 && !items.length) notFound();
  await trackView(site, "/blog");
  const href = (p: number) => `/blog?${new URLSearchParams({ ...(tag ? { tag } : {}), page: String(p) })}`;
  return (
    <div className={site.theme.layout === "grid" ? "fs-container-wide" : "fs-container"}>
      <WithSidebar site={site}>
        <header className="fs-article-header">
          <h1>{tag ? `Tagged “${tag}”` : "All posts"}</h1>
          <p className="fs-meta">
            {total} post{total === 1 ? "" : "s"}
          </p>
        </header>
        <PostList site={site} posts={items} />
        {total > perPage ? (
          <nav className="fs-pagination" aria-label="Pagination">
            {page > 1 ? <a href={href(page - 1)}>← Newer</a> : <span />}
            {page * perPage < total ? <a href={href(page + 1)}>Older →</a> : <span />}
          </nav>
        ) : null}
      </WithSidebar>
    </div>
  );
}
