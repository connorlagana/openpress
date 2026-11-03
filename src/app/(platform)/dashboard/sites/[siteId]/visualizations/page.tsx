import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, relativeTime } from "@/components/app/bits";
import { CopyButton } from "@/components/app/copy-button";
import { Badge } from "@/components/ui/badge";
import { config } from "@/lib/config";
import { loadDashboardSite } from "@/server/auth/load";
import { StatusBadge } from "./status-badge";
import { listCharts } from "@/server/services/charts";
import { listCustomViz } from "@/server/services/custom-viz";

export const metadata: Metadata = { title: "Visualizations" };

const TYPE_NAMES: Record<string, string> = { spatial_heatmap: "spatial heatmap" };

export default async function VisualizationsPage({ params }: PageProps<"/dashboard/sites/[siteId]/visualizations">) {
  const { actor, site } = await loadDashboardSite((await params).siteId);
  const [charts, custom] = await Promise.all([listCharts(actor, site.id, 100), listCustomViz(actor, site.id, 100)]);
  const pending = custom.items.filter((v) => v.status === "pending_approval").length;
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h2 className="op-h2">Charts</h2>
          <p className="mt-1 text-sm text-muted-foreground">Drawn by {config.appName} from data your agent sends. Paste the embed on its own line in a post; edits show up everywhere it is embedded.</p>
        </div>
        {charts.items.length ? (
          <ul className="op-card divide-y">
            {charts.items.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {TYPE_NAMES[c.type] ?? c.type} · updated {relativeTime(c.updatedAt)}
                  </div>
                </div>
                <CopyButton value={c.embed} label="Embed" />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No charts yet">Ask your agent to chart some data with create_chart.</EmptyState>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="op-h2">Custom visualizations {pending ? <Badge variant="outline" className="ml-2 align-middle">{pending} to review</Badge> : null}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Code written by an agent for visualizations charts can’t draw. It runs in an isolated sandbox, and only after you approve it here.
          </p>
        </div>
        {custom.items.length ? (
          <ul className="op-card divide-y">
            {custom.items.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/sites/${site.id}/visualizations/${v.id}`} className="truncate text-sm font-medium hover:underline">
                    {v.title}
                  </Link>
                  <div className="text-xs text-muted-foreground">updated {relativeTime(v.updatedAt)}</div>
                </div>
                <StatusBadge status={v.status} />
                <CopyButton value={v.embed} label="Embed" />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="None">Agents can create one with create_custom_visualization.</EmptyState>
        )}
      </section>
    </div>
  );
}
