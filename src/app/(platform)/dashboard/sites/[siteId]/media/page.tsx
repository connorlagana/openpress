import type { Metadata } from "next";
import { EmptyState, formatBytes } from "@/components/app/bits";
import { CopyButton } from "@/components/app/copy-button";
import { withUser } from "@/db/client";
import { loadDashboardSite } from "@/server/auth/load";
import { getPlanForUser, userStorageBytes } from "@/server/services/limits";
import { listMedia } from "@/server/services/media";
import { DeleteMediaButton, UploadForm } from "./media-client";

export const metadata: Metadata = { title: "Media" };

export default async function MediaPage({ params }: PageProps<"/dashboard/sites/[siteId]/media">) {
  const { actor, site } = await loadDashboardSite((await params).siteId);
  const [{ items }, quota] = await Promise.all([
    listMedia(actor, site.id, 100),
    withUser(actor.userId, async (tx) => ({ plan: await getPlanForUser(tx, actor.userId), used: await userStorageBytes(tx, actor.userId) })),
  ]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {formatBytes(quota.used)} of {formatBytes(quota.plan.maxStorageBytes)} used · max {formatBytes(quota.plan.maxUploadBytes)} per image
        </p>
        <UploadForm siteId={site.id} />
      </div>
      {items.length ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((m) => (
            <li key={m.id} className="overflow-hidden rounded-xl border">
              <div className="aspect-[4/3] bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.altText ?? ""} className="size-full object-cover" loading="lazy" />
              </div>
              <div className="space-y-2 p-3">
                <div className="truncate text-sm" title={m.filename}>
                  {m.altText || m.filename}
                </div>
                <div className="text-xs text-muted-foreground">
                  {m.width && m.height ? `${m.width}×${m.height} · ` : ""}
                  {formatBytes(m.sizeBytes)}
                </div>
                <div className="flex gap-1.5">
                  <CopyButton value={m.markdown} label="Markdown" />
                  <DeleteMediaButton siteId={site.id} mediaId={m.id} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No images yet">Upload one here, or ask your agent to add images with upload_media.</EmptyState>
      )}
    </div>
  );
}
