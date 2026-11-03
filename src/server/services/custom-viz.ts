import { and, count, desc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, withUser, type Tx } from "@/db/client";
import { customVisualizations, posts, sites, users, type CustomVisualization, type Site } from "@/db/schema";
import { datasetSchema } from "@/lib/charts/spec";
import { config } from "@/lib/config";
import { hmacHex, safeEqual, sha256Hex } from "@/lib/crypto";
import { AppError, forbidden, notFound } from "@/lib/errors";
import type { EmbedMode } from "@/lib/charts/render";
import { vizToken, type VizEmbed } from "@/lib/viz/embed";
import { CODE_FIELDS, VIZ_LIMITS, customVizInput, customVizPatch } from "@/lib/viz/schema";
import { requireScope, type Actor } from "../actor";
import { requireConfirmation } from "../confirm";
import { audit } from "./audit";
import { assertUserActive } from "./limits";
import { loadSite } from "./sites";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREVIEW_TTL_MS = 30 * 60 * 1000;

export function requireCustomVizEnabled() {
  if (!config.customViz.enabled) {
    throw new AppError("FORBIDDEN", "Custom visualizations are disabled on this server. Use create_chart (see get_visualization_capabilities for supported types).", { feature: "custom_visualizations" });
  }
}

export const codeHashOf = (c: { html: string; css: string; js: string }) => sha256Hex(`v1\0${c.html}\0${c.css}\0${c.js}`);

const isApproved = (v: Pick<CustomVisualization, "status" | "approvedHash" | "codeHash">) => v.status === "approved" && v.approvedHash === v.codeHash;
const statusOf = (v: CustomVisualization) => (isApproved(v) ? "approved" : v.status === "rejected" ? "rejected" : "pending_approval");

export const reviewUrl = (siteId: string, id: string) => `${config.appUrl}/dashboard/sites/${siteId}/visualizations/${id}`;

export function frameUrl(v: Pick<CustomVisualization, "id" | "codeHash" | "updatedAt">, preview?: string) {
  const u = new URL(`${config.customViz.origin}/viz-frame/${v.id}`);
  u.searchParams.set("v", `${v.codeHash.slice(0, 12)}-${v.updatedAt.getTime().toString(36)}`);
  if (preview) u.searchParams.set("preview", preview);
  return u.toString();
}

type UsedIn = { id: string; title: string; kind: "post" | "page"; status: "draft" | "published" };

async function postsUsing(tx: Tx, siteId: string, id: string): Promise<UsedIn[]> {
  return tx
    .select({ id: posts.id, title: posts.title, kind: posts.kind, status: posts.status })
    .from(posts)
    .where(and(eq(posts.siteId, siteId), isNull(posts.deletedAt), ilike(posts.contentMd, `%${vizToken(id)}%`)))
    .limit(50);
}

function toDto(v: CustomVisualization, opts: { code?: boolean; usedIn?: UsedIn[] } = {}) {
  return {
    id: v.id,
    siteId: v.siteId,
    title: v.title,
    description: v.description,
    embed: vizToken(v.id),
    status: statusOf(v),
    approvalUrl: reviewUrl(v.siteId, v.id),
    codeHash: v.codeHash,
    height: v.height,
    createdVia: v.createdVia,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    review: v.reviewedAt ? { at: v.reviewedAt.toISOString(), note: v.reviewNote } : null,
    ...(opts.code ? { html: v.html, css: v.css, js: v.js, data: v.data, table: v.dataTable } : {}),
    ...(opts.usedIn ? { usedIn: opts.usedIn } : {}),
  };
}

async function loadViz(tx: Tx, actor: Actor, id: string): Promise<{ viz: CustomVisualization; site: Site }> {
  if (!UUID_RE.test(id)) throw notFound("Visualization");
  const [viz] = await tx.select().from(customVisualizations).where(and(eq(customVisualizations.id, id), isNull(customVisualizations.deletedAt)));
  if (!viz) throw notFound("Visualization");
  return { viz, site: await loadSite(tx, actor, viz.siteId) };
}

const NEXT_STEP = "It will not run until a site member reviews and approves the code in the dashboard (approvalUrl). Embed it now with `embed`; readers see the title, description and data table until then.";

export async function createCustomViz(actor: Actor, input: { siteId: string } & z.input<typeof customVizInput>) {
  requireCustomVizEnabled();
  requireScope(actor, "content:write");
  const { siteId: rawSiteId, ...rest } = input;
  const siteId = z.string().min(1).max(64).parse(rawSiteId);
  const v = customVizInput.parse(rest);
  const code = { html: v.html ?? "", css: v.css ?? "", js: v.js };
  const codeHash = await codeHashOf(code);
  return withUser(actor.userId, async (tx) => {
    await assertUserActive(tx, actor.userId);
    const site = await loadSite(tx, actor, siteId);
    const [{ n }] = await tx.select({ n: count() }).from(customVisualizations).where(and(eq(customVisualizations.siteId, site.id), isNull(customVisualizations.deletedAt)));
    if (Number(n) >= VIZ_LIMITS.perSite) throw new AppError("QUOTA_EXCEEDED", `This site has reached the ${VIZ_LIMITS.perSite} custom visualization limit.`);
    const [row] = await tx
      .insert(customVisualizations)
      .values({
        siteId: site.id,
        title: v.title,
        description: v.description ?? null,
        ...code,
        data: v.data ?? null,
        dataTable: v.table ?? null,
        height: v.height ?? 420,
        codeHash,
        createdBy: actor.userId,
        createdVia: actor.kind === "agent" ? "agent" : "dashboard",
        agentConnectionId: actor.kind === "agent" ? actor.connectionId : null,
      })
      .returning();
    await audit(tx, actor, "custom_viz.create", { siteId: site.id, targetType: "custom_viz", targetId: row.id, metadata: { title: row.title, codeHash } });
    return { ...toDto(row, { usedIn: [] }), next: NEXT_STEP };
  });
}

export async function getCustomViz(actor: Actor, id: string) {
  requireScope(actor, "sites:read");
  return withUser(actor.userId, async (tx) => {
    const { viz } = await loadViz(tx, actor, id);
    return toDto(viz, { code: true, usedIn: await postsUsing(tx, viz.siteId, viz.id) });
  });
}

export async function listCustomViz(actor: Actor, siteId: string, limit = 50, offset = 0) {
  requireScope(actor, "sites:read");
  const take = Math.min(Math.max(limit, 1), 100);
  return withUser(actor.userId, async (tx) => {
    const site = await loadSite(tx, actor, siteId);
    const rows = await tx
      .select()
      .from(customVisualizations)
      .where(and(eq(customVisualizations.siteId, site.id), isNull(customVisualizations.deletedAt)))
      .orderBy(desc(customVisualizations.updatedAt))
      .limit(take + 1)
      .offset(Math.max(0, offset));
    return { items: rows.slice(0, take).map((r) => toDto(r)), hasMore: rows.length > take };
  });
}

export async function updateCustomViz(actor: Actor, id: string, input: z.input<typeof customVizPatch>) {
  requireCustomVizEnabled();
  requireScope(actor, "content:write");
  const patch = customVizPatch.parse(input);
  return withUser(actor.userId, async (tx) => {
    await assertUserActive(tx, actor.userId);
    const { viz, site } = await loadViz(tx, actor, id);
    const code = {
      html: patch.html === undefined ? viz.html : (patch.html ?? ""),
      css: patch.css === undefined ? viz.css : (patch.css ?? ""),
      js: patch.js ?? viz.js,
    };
    const codeHash = await codeHashOf(code);
    const codeChanged = codeHash !== viz.codeHash;
    const [row] = await tx
      .update(customVisualizations)
      .set({
        ...code,
        codeHash,
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.data !== undefined ? { data: patch.data } : {}),
        ...(patch.table !== undefined ? { dataTable: patch.table } : {}),
        ...(patch.height !== undefined ? { height: patch.height ?? 420 } : {}),
        // New code is new code: it needs a fresh review, whatever came before.
        ...(codeChanged ? { status: "pending" as const, approvedHash: null, reviewedBy: null, reviewedAt: null, reviewNote: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(customVisualizations.id, viz.id))
      .returning();
    await audit(tx, actor, "custom_viz.update", { siteId: site.id, targetType: "custom_viz", targetId: viz.id, metadata: { fields: Object.keys(patch), codeChanged, codeHash } });
    const usedIn = await postsUsing(tx, site.id, viz.id);
    return { ...toDto(row, { usedIn }), ...(codeChanged ? { next: `The code changed, so approval was reset. ${NEXT_STEP}` } : {}) };
  });
}

export async function deleteCustomViz(actor: Actor, id: string, confirmationToken?: string) {
  requireScope(actor, "content:write");
  return withUser(actor.userId, async (tx) => {
    const { viz, site } = await loadViz(tx, actor, id);
    const usedIn = await postsUsing(tx, site.id, viz.id);
    await requireConfirmation(actor, {
      action: "delete_custom_visualization",
      targetId: viz.id,
      required: true,
      token: confirmationToken,
      summary: `Delete custom visualization "${viz.title}".${usedIn.length ? ` It is embedded in: ${usedIn.map((p) => `"${p.title}" (${p.status})`).join(", ")}.` : " It is not embedded in any post."} Ask the user to confirm, then call again with confirmationToken.`,
    });
    await tx.update(customVisualizations).set({ deletedAt: new Date() }).where(eq(customVisualizations.id, viz.id));
    await audit(tx, actor, "custom_viz.delete", { siteId: site.id, targetType: "custom_viz", targetId: viz.id, metadata: { title: viz.title } });
    return { id: viz.id, deleted: true };
  });
}

/**
 * Publisher approval. Only a signed-in person in the dashboard can approve:
 * agents can't (not even with a confirmation token), so an agent can never
 * green-light its own code. The reviewer approves the exact code they saw:
 * `codeHash` must match the stored code or the call fails.
 */
export async function reviewCustomViz(actor: Actor, id: string, input: { decision: "approve" | "reject"; codeHash: string; note?: string }) {
  if (actor.kind !== "user") throw forbidden("Only a site member can approve custom code, in the OpenPress dashboard. Share the approvalUrl with the user.");
  requireCustomVizEnabled();
  const { decision, codeHash, note } = z.object({ decision: z.enum(["approve", "reject"]), codeHash: z.string().regex(/^[0-9a-f]{64}$/), note: z.string().trim().max(500).optional() }).parse(input);
  return withUser(actor.userId, async (tx) => {
    await assertUserActive(tx, actor.userId);
    const { viz, site } = await loadViz(tx, actor, id);
    if (viz.codeHash !== codeHash) throw new AppError("CONFLICT", "The code changed since you opened it. Reload and review the new version.");
    const [row] = await tx
      .update(customVisualizations)
      .set({ status: decision === "approve" ? "approved" : "rejected", approvedHash: decision === "approve" ? codeHash : null, reviewedBy: actor.userId, reviewedAt: new Date(), reviewNote: note ?? null })
      .where(and(eq(customVisualizations.id, viz.id), eq(customVisualizations.codeHash, codeHash)))
      .returning();
    if (!row) throw new AppError("CONFLICT", "The code changed while you were reviewing it. Reload and review the new version.");
    await audit(tx, actor, `custom_viz.${decision}`, { siteId: site.id, targetType: "custom_viz", targetId: viz.id, metadata: { codeHash, note: note ?? null } });
    return toDto(row);
  });
}

// ---------- Preview (dashboard review) ----------

const previewMessage = (id: string, codeHash: string, exp: number) => `viz-preview|${id}|${codeHash}|${exp}`;

/** A short-lived frame URL that runs the current (possibly unapproved) code, for the reviewer only. */
export async function previewFrameUrl(actor: Actor, id: string) {
  if (actor.kind !== "user") throw forbidden();
  requireCustomVizEnabled();
  return withUser(actor.userId, async (tx) => {
    const { viz } = await loadViz(tx, actor, id);
    const exp = Date.now() + PREVIEW_TTL_MS;
    const token = `${exp}.${await hmacHex(config.secret, previewMessage(viz.id, viz.codeHash, exp))}`;
    return frameUrl(viz, token);
  });
}

async function previewValid(id: string, codeHash: string, token: string) {
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!sig || !Number.isFinite(exp) || exp < Date.now()) return false;
  return safeEqual(sig, await hmacHex(config.secret, previewMessage(id, codeHash, exp)));
}

// ---------- Public (privileged, read-only) ----------

/** The code for the sandbox frame: live site, not deleted, approved exactly as stored (or a valid preview token). */
export async function frameViz(id: string, previewToken?: string | null) {
  if (!config.customViz.enabled || !UUID_RE.test(id)) return null;
  const db = await getDb();
  const [row] = await db
    .select({ viz: customVisualizations, subdomain: sites.subdomain, siteSuspended: sites.suspendedAt, siteDeleted: sites.deletedAt, ownerSuspended: users.suspendedAt })
    .from(customVisualizations)
    .innerJoin(sites, eq(sites.id, customVisualizations.siteId))
    .innerJoin(users, eq(users.id, sites.ownerId))
    .where(and(eq(customVisualizations.id, id), isNull(customVisualizations.deletedAt)));
  if (!row || row.siteSuspended || row.siteDeleted || row.ownerSuspended) return null;
  const ok = previewToken ? await previewValid(row.viz.id, row.viz.codeHash, previewToken) : isApproved(row.viz);
  if (!ok) return null;
  return { viz: row.viz, subdomain: row.subdomain, preview: !!previewToken };
}

/** Embeds for post rendering. Only this site's visualizations; code runs only when enabled + approved. */
export async function vizEmbedsFor(db: Pick<Tx, "select">, siteId: string, ids: string[], mode: EmbedMode): Promise<Map<string, VizEmbed>> {
  const map = new Map<string, VizEmbed>();
  if (!ids.length) return map;
  const rows = await db
    .select()
    .from(customVisualizations)
    .where(and(eq(customVisualizations.siteId, siteId), isNull(customVisualizations.deletedAt), inArray(customVisualizations.id, ids)));
  const enabled = config.customViz.enabled;
  for (const v of rows) {
    const runs = enabled && isApproved(v) && mode !== "feed";
    map.set(v.id, {
      id: v.id,
      title: v.title,
      description: v.description,
      height: v.height,
      table: v.dataTable ? (datasetSchema.safeParse(v.dataTable).data ?? null) : null,
      frameUrl: runs ? frameUrl(v) : null,
      notice: !enabled
        ? "Custom visualizations are disabled on this server, so readers see the title, description and data table."
        : v.status === "rejected"
          ? "This visualization was rejected in review and does not run."
          : !isApproved(v)
            ? "Awaiting approval: a site member must approve this code under Visualizations before it runs. Readers see the title, description and data table until then."
            : undefined,
    });
  }
  return map;
}

export async function assertVizOnSite(tx: Tx, siteId: string, ids: string[]) {
  if (!ids.length) return;
  const found = await tx
    .select({ id: customVisualizations.id })
    .from(customVisualizations)
    .where(and(eq(customVisualizations.siteId, siteId), isNull(customVisualizations.deletedAt), inArray(customVisualizations.id, ids)));
  const have = new Set(found.map((f) => f.id));
  const missing = ids.filter((id) => !have.has(id));
  if (missing.length) {
    throw new AppError("VALIDATION", `Content embeds visualization${missing.length > 1 ? "s" : ""} not found on this site: ${missing.join(", ")}. Create one with create_custom_visualization and use the embed it returns.`, { missingVizIds: missing });
  }
}

export { CODE_FIELDS };
