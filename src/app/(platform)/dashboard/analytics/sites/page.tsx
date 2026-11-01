import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, PageHeader, relativeTime } from "@/components/app/bits";
import { config } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/session";
import { listPlatformSites } from "@/server/services/platform-analytics";

export const metadata: Metadata = { title: "All blogs" };

export default async function AllSitesPage({ searchParams }: PageProps<"/dashboard/analytics/sites">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const page = Math.min(10_000, Math.max(1, Math.floor(Number(params.page)) || 1));
  const actor = await requireActor();
  const r = await listPlatformSites(actor, { q, page }).catch((error) => {
    if (error instanceof AppError && error.code === "FORBIDDEN") notFound();
    throw error;
  });
  const pages = Math.max(1, Math.ceil(r.total / r.pageSize));
  const href = (p: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;
  return (
    <div className="space-y-6">
      <PageHeader title="All blogs" description={`${r.total.toLocaleString()} ${q ? "matching" : "non-deleted"} sites across every account, newest first. Suspended sites are included.`} />
      <form className="flex gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Search subdomain, name or owner email" aria-label="Search sites" className="h-9 w-full max-w-sm rounded-lg border bg-background px-3 text-sm" />
        <button type="submit" className="h-9 rounded-lg border px-3 text-sm hover:bg-foreground/[.04]">Search</button>
        {q ? <Link href="?" className="self-center text-sm text-muted-foreground hover:text-foreground">Clear</Link> : null}
      </form>
      {r.sites.length === 0 ? (
        <EmptyState title={q ? "No matching sites" : "No sites yet"} />
      ) : (
        <div className="op-card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>{["Site", "Owner", "Posts", "Drafts", "Pages", "Last published", "Views (30d)", "Created"].map((h) => <th key={h} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {r.sites.map((s) => (
                <tr key={s.id} className="border-t align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.name}</div>
                    <a href={config.siteUrl(s.subdomain)} target="_blank" rel="noreferrer" className="font-mono text-xs text-muted-foreground hover:text-foreground">{s.subdomain} ↗</a>
                    {s.suspendedAt ? <span className="ml-2 text-xs text-destructive">Suspended</span> : null}
                  </td>
                  <td className="max-w-56 truncate px-4 py-3 text-muted-foreground">{s.ownerEmail}</td>
                  {[s.posts, s.drafts, s.pages].map((n, i) => <td key={i} className="px-4 py-3 tabular-nums">{n.toLocaleString()}</td>)}
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{s.lastPublishedAt ? relativeTime(s.lastPublishedAt) : "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{s.pageviews.toLocaleString()}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{relativeTime(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          {r.page > 1 ? <Link href={href(r.page - 1)} className="hover:underline">← Newer</Link> : <span />}
          <span className="text-muted-foreground">Page {r.page} of {pages}</span>
          {r.page < pages ? <Link href={href(r.page + 1)} className="hover:underline">Older →</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
