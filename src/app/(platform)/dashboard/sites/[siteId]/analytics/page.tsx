import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/bits";
import { cn } from "@/lib/utils";
import { loadDashboardSite } from "@/server/auth/load";
import { getSiteAnalytics } from "@/server/services/analytics";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({ params, searchParams }: PageProps<"/dashboard/sites/[siteId]/analytics">) {
  const { actor, site } = await loadDashboardSite((await params).siteId);
  const days = [7, 30, 90].includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 30;
  const a = await getSiteAnalytics(actor, site.id, days);
  const max = Math.max(1, ...a.daily.map((d) => d.pageviews));
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <dl className="flex gap-10">
          <div>
            <dt className="text-xs text-muted-foreground">Pageviews</dt>
            <dd className="text-2xl font-semibold tabular-nums">{a.pageviews.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Daily unique visitors</dt>
            <dd className="text-2xl font-semibold tabular-nums">{a.uniqueVisitors.toLocaleString()}</dd>
          </div>
        </dl>
        <div className="flex gap-1 text-sm">
          {[7, 30, 90].map((d) => (
            <Link key={d} href={`?days=${d}`} className={cn("rounded-md px-2.5 py-1", d === days ? "bg-muted" : "text-muted-foreground hover:text-foreground")} aria-current={d === days ? "page" : undefined}>
              {d}d
            </Link>
          ))}
        </div>
      </div>

      {a.pageviews === 0 ? (
        <EmptyState title="No visits yet">Share your site&rsquo;s link. Visits appear here within seconds. No cookies, no personal data.</EmptyState>
      ) : (
        <>
          <figure>
            <div className="flex h-40 items-end gap-[2px]" role="img" aria-label={`Daily pageviews over the last ${days} days, peak ${max}`}>
              {a.daily.map((d) => (
                <div key={d.day} className="group relative flex-1">
                  <div className="rounded-t-sm bg-foreground/80 group-hover:bg-foreground" style={{ height: `${Math.max(2, (d.pageviews / max) * 160)}px` }} />
                  <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-[11px] whitespace-nowrap text-background group-hover:block">
                    {d.day}: {d.pageviews}
                  </span>
                </div>
              ))}
            </div>
            <figcaption className="mt-2 flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>{a.daily[0]?.day}</span>
              <span>{a.daily.at(-1)?.day}</span>
            </figcaption>
          </figure>
          <div className="grid gap-8 md:grid-cols-2">
            <Table title="Top pages" rows={a.topPages.map((p) => [p.path, p.pageviews])} />
            <Table title="Sources" rows={a.referrers.map((r) => [r.category, r.pageviews])} />
            <Table title="Top referring domains" rows={a.topReferrers.map((r) => [r.host, r.pageviews])} />
          </div>
          <p className="text-xs text-muted-foreground">{a.note}</p>
        </>
      )}
    </div>
  );
}

function Table({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div>
      <h2 className="mb-2 text-sm font-medium">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No data for this period.</p>}
      <ul className="space-y-1">
        {rows.map(([k, v]) => (
          <li key={k} className="relative flex justify-between rounded px-2 py-1 text-sm">
            <span className="absolute inset-y-0 left-0 rounded bg-muted" style={{ width: `${(v / max) * 100}%` }} aria-hidden />
            <span className="relative truncate font-mono text-xs leading-5">{k}</span>
            <span className="relative tabular-nums">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
