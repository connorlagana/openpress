import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader, relativeTime } from "@/components/app/bits";
import { requireActor } from "@/server/auth/session";
import { listConnections } from "@/server/services/agents";
import { usageSummary } from "@/server/services/limits";
import { listSites } from "@/server/services/sites";
import { withUser } from "@/db/client";

export const metadata: Metadata = { title: "Sites" };

export default async function DashboardHome() {
  const actor = await requireActor();
  const [sites, connections, usage] = await Promise.all([listSites(actor), listConnections(actor), withUser(actor.userId, (tx) => usageSummary(tx, actor.userId))]);
  if (!sites.length) redirect("/onboarding");
  const canCreate = usage.sites.used < usage.sites.limit;
  return (
    <>
      <PageHeader
        title="Sites"
        actions={
          canCreate ? (
            <Link href="/onboarding" className={buttonVariants({ variant: "outline" })}>
              New site
            </Link>
          ) : null
        }
      />
      {!connections.length ? (
        <div className="op-card mb-6 flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              <span className="size-2 rounded-full bg-signal ring-3 ring-signal/20" aria-hidden />
              Connect your AI agent
            </p>
            <p className="text-sm text-muted-foreground">Add the MCP server to Claude, ChatGPT or another client, then ask it to write and publish.</p>
          </div>
          <Link href="/dashboard/agents" className={buttonVariants()}>
            Connect an agent
          </Link>
        </div>
      ) : null}
      <ul className="op-card divide-y">
        {sites.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-5">
            <div className="min-w-0 flex-1 basis-full sm:basis-0">
              <Link href={`/dashboard/sites/${s.id}`} className="text-lg font-semibold tracking-tight hover:underline underline-offset-4">
                {s.name}
              </Link>
              <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{s.url.replace(/^https?:\/\//, "")}</div>
            </div>
            <div className="text-sm text-muted-foreground tabular-nums">
              {s.publishedCount} published · {(s.postCount ?? 0) - (s.publishedCount ?? 0)} drafts
            </div>
            <div className="text-xs text-muted-foreground">Created {relativeTime(s.createdAt)}</div>
            <a href={s.url} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Visit ↗
            </a>
          </li>
        ))}
      </ul>
      {!canCreate ? (
        <p className="mt-3 text-xs text-muted-foreground">
          The {usage.plan.name} plan includes {usage.sites.limit} site. More sites will be available on paid plans.
        </p>
      ) : null}
    </>
  );
}
