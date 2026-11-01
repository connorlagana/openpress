import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/bits";
import { AppError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { requireActor } from "@/server/auth/session";
import { getPlatformAnalytics } from "@/server/services/platform-analytics";

export const metadata: Metadata = { title: "Platform analytics" };
const pct = (n: number, total: number) => total ? `${Math.round(n / total * 100)}%` : "—";

export default async function AnalyticsPage({ searchParams }: PageProps<"/dashboard/analytics">) {
  const raw = (await searchParams).days;
  const days = typeof raw === "string" && [7, 30, 90].includes(Number(raw)) ? Number(raw) : 30;
  const actor = await requireActor();
  const a = await getPlatformAnalytics(actor, days).catch((error) => {
    if (error instanceof AppError && error.code === "FORBIDDEN") notFound();
    throw error;
  });
  const total = a.funnel.find((r) => r.source === "total");
  const signups = total?.signups ?? 0;
  const stages: [string, number][] = [["Signed up", signups], ["Created a site", total?.createdSite ?? 0], ["Used an agent", total?.agentUsed ?? 0], ["Published content", total?.published ?? 0], ["Published within 24h", total?.published24h ?? 0]];
  return (
    <div className="space-y-8">
      <PageHeader title="Platform analytics" description="Acquisition, activation and traffic across OpenPress." actions={
        <nav aria-label="Analytics period" className="flex gap-1">
          {[7, 30, 90].map((d) => <Link key={d} href={`?days=${d}`} aria-current={days === d ? "page" : undefined} className={cn("rounded-full px-3 py-1.5 text-sm", days === d ? "bg-foreground/[.07] font-medium" : "text-muted-foreground hover:text-foreground")}>{d} days</Link>)}
        </nav>
      } />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Signups" value={signups} detail={`Last ${days} calendar days`} />
        <Metric label="Published after signup" value={total?.published ?? 0} detail={`${pct(total?.published ?? 0, signups)} of selected signups`} />
        <Metric label="Hosted-site pageviews" value={a.traffic.pageviews} detail={`Across ${a.traffic.sites} sites with traffic`} />
        <Metric label="Daily unique visitors" value={a.traffic.visitors} detail="Summed across days and sites" />
      </div>
      <section className="op-card p-6">
        <h2 className="font-medium">Signup activity</h2>
        <p className="mt-1 text-sm text-muted-foreground">Daily signups, including days with no activity. Dates use UTC.</p>
        <div className="mt-6 flex h-36 items-end gap-1" role="img" aria-label={`${signups} signups in the last ${days} days. Daily values follow below.`}>
          {a.daily.map((d) => <div key={d.day} title={`${d.day}: ${d.signups} signups`} className="min-w-0 flex-1 rounded-t bg-signal/70" style={{ height: `${Math.max(1, d.signups / Math.max(1, ...a.daily.map((r) => r.signups)) * 100)}%` }} />)}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{a.daily[0]?.day}</span><span>{a.daily.at(-1)?.day}</span></div>
        <details className="mt-4 text-sm"><summary className="cursor-pointer">View daily counts</summary><DataTable headers={["Date (UTC)", "Signups", "Hosted-site pageviews"]} rows={a.daily.map((d) => [d.day, d.signups, d.pageviews])} /></details>
      </section>
      <section>
        <h2 className="font-medium">Signup activation</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">Users who signed up in the selected period and have reached each milestone as of now. Milestones are independent; publishing does not require an agent.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{stages.map(([label, value]) => <Metric key={label} label={label} value={value} detail={`${pct(value, signups)} of signups`} />)}</div>
      </section>
      <section>
        <h2 className="font-medium">Acquisition sources</h2>
        <p className="mt-1 text-sm text-muted-foreground">First-touch signup attribution. Direct includes unknown sources. Rates use signups from that source.</p>
        <DataTable headers={["Source", "Signups", "Created site", "Used agent", "Published", "Published <24h"]} rows={a.funnel.filter((r) => r.source !== "total").map((r) => [r.source, r.signups, `${r.createdSite} (${pct(r.createdSite, r.signups)})`, `${r.agentUsed} (${pct(r.agentUsed, r.signups)})`, `${r.published} (${pct(r.published, r.signups)})`, `${r.published24h} (${pct(r.published24h, r.signups)})`])} />
      </section>
      <div className="grid gap-8 lg:grid-cols-2">
        <section><h2 className="font-medium">Hosted-site traffic sources</h2><DataTable headers={["Source", "Pageviews"]} rows={a.sources.map((r) => [r.category, r.pageviews])} /></section>
        <section><h2 className="font-medium">Top sites by traffic</h2><DataTable headers={["Site", "Subdomain", "Pageviews"]} rows={a.topSites.map((r) => [r.name, r.subdomain, r.pageviews])} /></section>
      </div>
      <section><h2 className="mb-4 font-medium">Platform totals · current state</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Accounts" value={a.inventory.users} detail="All registered accounts" />
        <Metric label="Available sites" value={a.inventory.sites} detail="Excludes deleted and suspended sites" />
        <Metric label="Published content" value={a.inventory.published} detail="Live posts and pages on available sites" />
        <Metric label="Agent connections" value={a.inventory.agents} detail="Non-revoked connections" />
      </div></section>
      <p className="text-xs leading-5 text-muted-foreground">Traffic covers hosted sites, not visits to the OpenPress marketing site. Visitor hashes rotate daily and differ by site, so these counts are not unique people over the entire period. Traffic is retained for 90 days. Activation reflects retained records and can change after content is unpublished or deleted. Recent signups may not have had a full 24 hours to publish.</p>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="op-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">{value.toLocaleString()}</p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></div>;
}
function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  if (!rows.length) return <p className="mt-4 op-well p-6 text-sm text-muted-foreground">No activity in this period.</p>;
  return <div className="op-card mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-muted/50"><tr>{headers.map((h) => <th key={h} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i} className="border-t">{row.map((v, j) => <td key={j} className="px-4 py-3 tabular-nums">{typeof v === "number" ? v.toLocaleString() : v}</td>)}</tr>)}</tbody></table></div>;
}
