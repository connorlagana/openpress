import Link from "next/link";
import { EmptyState, StatusDot, relativeTime } from "@/components/app/bits";
import { cn } from "@/lib/utils";
import { listPosts } from "@/server/services/posts";
import type { Actor } from "@/server/actor";
import { NewPostButton } from "./new-post-button";

export async function ContentList({ actor, siteId, kind, status, basePath }: { actor: Actor; siteId: string; kind: "post" | "page"; status?: "draft" | "published"; basePath: string }) {
  const { items } = await listPosts(actor, { siteId, kind, status, limit: 100 });
  const noun = kind === "page" ? "page" : "post";
  const filters = [
    { label: "All", value: undefined },
    { label: "Published", value: "published" },
    { label: "Drafts", value: "draft" },
  ] as const;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 text-sm" role="group" aria-label="Filter">
          {filters.map((f) => (
            <Link
              key={f.label}
              href={f.value ? `${basePath}?status=${f.value}` : basePath}
              aria-current={status === f.value ? "page" : undefined}
              className={cn("rounded-md px-2.5 py-1", status === f.value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <NewPostButton siteId={siteId} kind={kind} />
      </div>
      {items.length ? (
        <ul className="divide-y rounded-xl border">
          {items.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <Link href={`/dashboard/sites/${siteId}/posts/${p.id}`} className="font-medium hover:underline underline-offset-4">
                  {p.title}
                </Link>
                <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{p.path}</div>
              </div>
              {p.createdVia === "agent" ? <span className="rounded border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">by agent</span> : null}
              <StatusDot live={p.isLive} />
              <span className="w-20 text-right text-xs text-muted-foreground">{relativeTime(p.updatedAt)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={status ? `No ${status === "draft" ? "drafts" : "published " + noun + "s"}` : `No ${noun}s yet`} action={!status ? <NewPostButton siteId={siteId} kind={kind} /> : undefined}>
          {!status ? (
            <>
              Write one here, or ask your connected agent: <span className="italic">&ldquo;Write a {noun} about … and publish it.&rdquo;</span>
            </>
          ) : null}
        </EmptyState>
      )}
    </div>
  );
}
