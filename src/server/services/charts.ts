import { and, count, desc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { withUser, type Tx } from "@/db/client";
import { charts, posts, type Chart, type Site } from "@/db/schema";
import { chartIdsInHtml, chartIdsInMarkdown, chartToken, embedCharts, type ChartSpec } from "@/lib/charts/render";
import { chartSpecSchema, parseStoredSpec } from "@/lib/charts/spec";
import { config } from "@/lib/config";
import { AppError, notFound } from "@/lib/errors";
import { renderMarkdown } from "@/lib/markdown";
import { requireScope, type Actor } from "../actor";
import { requireConfirmation } from "../confirm";
import { notifyIndexNow } from "../indexnow";
import { audit } from "./audit";
import { assertUserActive } from "./limits";
import { loadSite } from "./sites";

/** Per-site ceiling; charts are small rows, this only bounds abuse. */
export const MAX_CHARTS_PER_SITE = 200;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CreateChartInput = { siteId: string } & z.input<typeof chartSpecSchema>;

/** Fields replace the stored ones; null clears an optional field. The merged chart is re-validated. */
export const updateChartPatch = z
  .object({
    type: z.enum(["line", "area", "bar", "pie", "donut"]),
    title: z.string(),
    subtitle: z.string().nullable(),
    source: z.string().nullable(),
    description: z.string().nullable(),
    labels: z.array(z.string()).describe("Replaces all labels. When the number of labels changes, also send series"),
    series: z.array(z.object({ name: z.string(), data: z.array(z.number().nullable()) })).describe("Replaces all series"),
    stacked: z.boolean().nullable(),
    xAxis: z.object({ title: z.string().optional() }).nullable(),
    yAxis: z.object({ title: z.string().optional(), min: z.number().optional(), max: z.number().optional() }).nullable(),
    valueFormat: z.object({ prefix: z.string().optional(), suffix: z.string().optional(), decimals: z.number().optional() }).nullable(),
  })
  .partial()
  .strict();

type UsedIn = { id: string; title: string; kind: "post" | "page"; status: "draft" | "published"; url: string };

function postUrl(site: Pick<Site, "subdomain">, p: { kind: "post" | "page"; slug: string }) {
  return `${config.siteUrl(site.subdomain)}${p.kind === "page" ? `/${p.slug}` : `/blog/${p.slug}`}`;
}

async function postsUsing(tx: Tx, site: Site, chartId: string): Promise<(UsedIn & { slug: string })[]> {
  const rows = await tx
    .select({ id: posts.id, title: posts.title, kind: posts.kind, status: posts.status, slug: posts.slug })
    .from(posts)
    .where(and(eq(posts.siteId, site.id), isNull(posts.deletedAt), ilike(posts.contentMd, `%${chartToken(chartId)}%`)))
    .limit(50);
  return rows.map((r) => ({ ...r, url: postUrl(site, r) }));
}

function toChartDto(c: Chart, usedIn?: UsedIn[]) {
  return {
    id: c.id,
    siteId: c.siteId,
    title: c.title,
    type: (c.spec as ChartSpec).type,
    embed: chartToken(c.id),
    spec: c.spec as ChartSpec,
    createdVia: c.createdVia,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    ...(usedIn ? { usedIn: usedIn.map(({ id, title, kind, status, url }) => ({ id, title, kind, status, url })) } : {}),
  };
}

async function loadChart(tx: Tx, actor: Actor, chartId: string): Promise<{ chart: Chart; site: Site }> {
  if (!UUID_RE.test(chartId)) throw notFound("Chart");
  const [chart] = await tx.select().from(charts).where(and(eq(charts.id, chartId), isNull(charts.deletedAt)));
  if (!chart) throw notFound("Chart");
  const site = await loadSite(tx, actor, chart.siteId);
  return { chart, site };
}

export async function createChart(actor: Actor, input: CreateChartInput) {
  requireScope(actor, "content:write");
  const { siteId: rawSiteId, ...rest } = input;
  const siteId = z.string().min(1).max(64).parse(rawSiteId);
  const spec = chartSpecSchema.parse(rest);
  return withUser(actor.userId, async (tx) => {
    await assertUserActive(tx, actor.userId);
    const site = await loadSite(tx, actor, siteId);
    const [{ n }] = await tx.select({ n: count() }).from(charts).where(and(eq(charts.siteId, site.id), isNull(charts.deletedAt)));
    if (Number(n) >= MAX_CHARTS_PER_SITE) {
      throw new AppError("QUOTA_EXCEEDED", `This site has reached the ${MAX_CHARTS_PER_SITE} chart limit. Reuse a chart with update_chart or delete unused ones.`);
    }
    const [row] = await tx
      .insert(charts)
      .values({
        siteId: site.id,
        title: spec.title,
        spec,
        createdBy: actor.userId,
        createdVia: actor.kind === "agent" ? "agent" : "dashboard",
        agentConnectionId: actor.kind === "agent" ? actor.connectionId : null,
      })
      .returning();
    await audit(tx, actor, "chart.create", { siteId: site.id, targetType: "chart", targetId: row.id, metadata: { title: row.title, type: spec.type } });
    return toChartDto(row, []);
  });
}

export async function getChart(actor: Actor, chartId: string) {
  requireScope(actor, "sites:read");
  return withUser(actor.userId, async (tx) => {
    const { chart, site } = await loadChart(tx, actor, chartId);
    return toChartDto(chart, await postsUsing(tx, site, chart.id));
  });
}

export async function listCharts(actor: Actor, siteId: string, limit = 50, offset = 0) {
  requireScope(actor, "sites:read");
  const take = Math.min(Math.max(limit, 1), 100);
  return withUser(actor.userId, async (tx) => {
    const site = await loadSite(tx, actor, siteId);
    const rows = await tx
      .select()
      .from(charts)
      .where(and(eq(charts.siteId, site.id), isNull(charts.deletedAt)))
      .orderBy(desc(charts.updatedAt))
      .limit(take + 1)
      .offset(offset);
    return { items: rows.slice(0, take).map((c) => toChartDto(c)), hasMore: rows.length > take };
  });
}

export async function updateChart(actor: Actor, chartId: string, input: z.input<typeof updateChartPatch>) {
  requireScope(actor, "content:write");
  const patch = updateChartPatch.parse(input);
  let ping = null as { subdomain: string; paths: string[] } | null; // assigned inside the transaction callback
  const result = await withUser(actor.userId, async (tx) => {
    await assertUserActive(tx, actor.userId);
    const { chart, site } = await loadChart(tx, actor, chartId);
    const merged: Record<string, unknown> = { ...(chart.spec as object) };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete merged[k];
      else if (v !== undefined) merged[k] = v;
    }
    const spec = chartSpecSchema.parse(merged);
    const [row] = await tx.update(charts).set({ spec, title: spec.title, updatedAt: new Date() }).where(eq(charts.id, chart.id)).returning();
    await audit(tx, actor, "chart.update", { siteId: site.id, targetType: "chart", targetId: chart.id, metadata: { fields: Object.keys(patch) } });
    const usedIn = await postsUsing(tx, site, chart.id);
    const live = usedIn.filter((p) => p.status === "published");
    if (live.length && !site.suspendedAt) ping = { subdomain: site.subdomain, paths: live.map((p) => new URL(p.url).pathname) };
    return toChartDto(row, usedIn);
  });
  if (ping) notifyIndexNow(ping.subdomain, ping.paths);
  return result;
}

export async function deleteChart(actor: Actor, chartId: string, confirmationToken?: string) {
  requireScope(actor, "content:write");
  return withUser(actor.userId, async (tx) => {
    const { chart, site } = await loadChart(tx, actor, chartId);
    const usedIn = await postsUsing(tx, site, chart.id);
    const live = usedIn.filter((p) => p.status === "published");
    await requireConfirmation(actor, {
      action: "delete_chart",
      targetId: chart.id,
      required: true,
      token: confirmationToken,
      summary: `Delete chart "${chart.title}".${usedIn.length ? ` It is embedded in: ${usedIn.map((p) => `"${p.title}" (${p.status})`).join(", ")}${live.length ? "; it will disappear from the published ones" : ""}.` : " It is not embedded in any post."} Ask the user to confirm, then call again with confirmationToken.`,
    });
    await tx.update(charts).set({ deletedAt: new Date() }).where(eq(charts.id, chart.id));
    await audit(tx, actor, "chart.delete", { siteId: site.id, targetType: "chart", targetId: chart.id, metadata: { title: chart.title } });
    return { id: chart.id, deleted: true };
  });
}

// ---------- Used by posts ----------

/** Reject content that embeds charts which don't exist on this site, with a fix the agent can act on. */
export async function assertChartsOnSite(tx: Tx, siteId: string, md: string) {
  const ids = chartIdsInMarkdown(md);
  if (!ids.length) return;
  const found = await tx.select({ id: charts.id }).from(charts).where(and(eq(charts.siteId, siteId), isNull(charts.deletedAt), inArray(charts.id, ids)));
  const have = new Set(found.map((f) => f.id));
  const missing = ids.filter((id) => !have.has(id));
  if (missing.length) {
    throw new AppError("VALIDATION", `Content embeds chart${missing.length > 1 ? "s" : ""} not found on this site: ${missing.join(", ")}. Create one with create_chart and use the embed it returns.`, { missingChartIds: missing });
  }
}

export async function chartSpecsFor(tx: Pick<Tx, "select">, siteId: string, ids: string[]): Promise<Map<string, ChartSpec>> {
  const map = new Map<string, ChartSpec>();
  if (!ids.length) return map;
  const rows = await tx.select({ id: charts.id, spec: charts.spec }).from(charts).where(and(eq(charts.siteId, siteId), isNull(charts.deletedAt), inArray(charts.id, ids)));
  for (const r of rows) {
    const spec = parseStoredSpec(r.spec);
    if (spec) map.set(r.id, spec);
  }
  return map;
}

/** Dashboard editor preview, with the site's charts drawn in. */
export async function previewPostHtml(actor: Actor, siteId: string, md: string) {
  requireScope(actor, "sites:read");
  const html = renderMarkdown(md);
  const ids = chartIdsInHtml(html);
  if (!ids.length) return html;
  return withUser(actor.userId, async (tx) => {
    const site = await loadSite(tx, actor, siteId);
    return embedCharts(html, await chartSpecsFor(tx, site.id, ids), "preview");
  });
}
