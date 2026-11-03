import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { relativeTime } from "@/components/app/bits";
import { config } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { loadDashboardSite } from "@/server/auth/load";
import { getCustomViz, previewFrameUrl } from "@/server/services/custom-viz";
import { StatusBadge } from "../status-badge";
import { ReviewForm } from "./review-client";

export const metadata: Metadata = { title: "Review visualization" };

function Code({ label, code }: { label: string; code: string }) {
  return (
    <details className="op-card overflow-hidden" open={label === "JavaScript"}>
      <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">
        {label} <span className="font-normal text-muted-foreground">· {code.length.toLocaleString()} characters</span>
      </summary>
      <pre className="max-h-[28rem] overflow-auto border-t bg-muted/40 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">{code || "(empty)"}</pre>
    </details>
  );
}

export default async function ReviewPage({ params }: PageProps<"/dashboard/sites/[siteId]/visualizations/[vizId]">) {
  const { siteId, vizId } = await params;
  const { actor, site } = await loadDashboardSite(siteId);
  let viz;
  try {
    viz = await getCustomViz(actor, vizId);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  if (viz.siteId !== site.id) notFound();
  const preview = config.customViz.enabled ? await previewFrameUrl(actor, viz.id) : null;
  const data = JSON.stringify(viz.data ?? null, null, 2);
  return (
    <div className="space-y-6">
      <Link href={`/dashboard/sites/${site.id}/visualizations`} className="text-sm text-muted-foreground hover:text-foreground">
        ← Visualizations
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="op-h2">{viz.title}</h2>
        <StatusBadge status={viz.status} />
        <span className="text-xs text-muted-foreground">
          created via {viz.createdVia} · updated {relativeTime(viz.updatedAt)}
        </span>
      </div>
      {viz.description ? <p className="text-sm text-muted-foreground">{viz.description}</p> : null}

      <div className="op-card space-y-2 p-4 text-sm">
        <p className="font-medium">Before approving, check that the code only draws this visualization.</p>
        <p className="text-muted-foreground">
          It runs in an isolated frame with no network access and no access to your site, account or readers’ cookies. It can still show anything on its own canvas, so read it the way you’d read a post before publishing. Changing
          the code later resets approval; data updates don’t.
        </p>
      </div>

      {preview ? (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Preview (sandboxed)</h3>
          <div className="op-card overflow-hidden" style={{ height: viz.height }}>
            <iframe src={preview} title={`Preview: ${viz.title}`} sandbox="allow-scripts" referrerPolicy="no-referrer" className="size-full border-0 bg-white" />
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Custom visualizations are turned off on this server (CUSTOM_VIZ), so nothing can run or be approved.</p>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-medium">Code</h3>
        <Code label="JavaScript" code={viz.js ?? ""} />
        <Code label="HTML" code={viz.html ?? ""} />
        <Code label="CSS" code={viz.css ?? ""} />
        <Code label="Data (JSON)" code={data.length > 20_000 ? data.slice(0, 20_000) + "\n…" : data} />
        <p className="font-mono text-xs text-muted-foreground">sha256 {viz.codeHash}</p>
      </section>

      {config.customViz.enabled ? <ReviewForm siteId={site.id} vizId={viz.id} codeHash={viz.codeHash} status={viz.status} /> : null}
    </div>
  );
}
