import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { withUser } from "@/db/client";
import { media, posts, sites, type Media } from "@/db/schema";
import { AppError, notFound } from "@/lib/errors";
import { sniffImage } from "@/lib/image";
import { requireScope, type Actor } from "../actor";
import { requireConfirmation } from "../confirm";
import { getStorage, mediaUrl } from "../storage";
import { audit } from "./audit";
import { assertUserActive, getPlanForUser, userStorageBytes } from "./limits";
import { loadSite } from "./sites";

/** Hard ceiling regardless of plan, to bound memory use per request. */
const ABSOLUTE_MAX_BYTES = 10 * 1024 * 1024;

export const uploadMediaInput = z
  .object({
    siteId: z.string().describe("Site id or subdomain"),
    sourceUrl: z
      .string()
      .url()
      .max(2000)
      .optional()
      .describe("Public https URL of an image to import (e.g. from Unsplash). Preferred for agents: no need to base64-encode."),
    dataBase64: z.string().max(14_000_000).optional().describe("Image bytes, base64-encoded. Use when you generated the image yourself."),
    filename: z.string().trim().max(200).optional(),
    altText: z.string().trim().max(500).optional().describe("Describe the image for screen readers and SEO. Strongly recommended."),
  })
  .refine((v) => !!v.sourceUrl !== !!v.dataBase64, "Provide exactly one of sourceUrl or dataBase64");

export function toMediaDto(m: Media) {
  return {
    id: m.id,
    siteId: m.siteId,
    url: mediaUrl(m.storageKey),
    filename: m.filename,
    mimeType: m.mimeType,
    sizeBytes: m.sizeBytes,
    width: m.width,
    height: m.height,
    altText: m.altText,
    createdAt: m.createdAt.toISOString(),
    markdown: `![${(m.altText ?? "").replace(/[\[\]]/g, "")}](${mediaUrl(m.storageKey)})`,
  };
}

/** Block requests to loopback, link-local, private and metadata addresses (SSRF). */
export function isForbiddenHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h === "metadata.google.internal") return true;
  if (/^\d+$/.test(h) || /^0x/i.test(h)) return true; // integer / hex IP encodings
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (h.includes(":")) return h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("::ffff:");
  return false;
}

async function fetchRemoteImage(sourceUrl: string, maxBytes: number): Promise<Uint8Array> {
  let url = new URL(sourceUrl);
  for (let hop = 0; hop < 4; hop++) {
    if (url.protocol !== "https:") throw new AppError("VALIDATION", "sourceUrl must use https");
    if (url.port && url.port !== "443") throw new AppError("VALIDATION", "sourceUrl must use the default https port");
    if (url.username || url.password) throw new AppError("VALIDATION", "sourceUrl must not contain credentials");
    if (isForbiddenHost(url.hostname)) throw new AppError("VALIDATION", "sourceUrl points to a private or reserved address");
    const res = await fetch(url, { redirect: "manual", headers: { accept: "image/*", "user-agent": "FolioMediaImporter/1.0" }, signal: AbortSignal.timeout(10_000) });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) break;
      url = new URL(loc, url);
      continue;
    }
    if (!res.ok || !res.body) throw new AppError("UPSTREAM", `Could not download image (HTTP ${res.status})`);
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > maxBytes) throw new AppError("QUOTA_EXCEEDED", `Image is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB upload limit`);
    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new AppError("QUOTA_EXCEEDED", `Image is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB upload limit`);
      }
      chunks.push(value);
    }
    const out = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) {
      out.set(c, o);
      o += c.byteLength;
    }
    return out;
  }
  throw new AppError("UPSTREAM", "Too many redirects while downloading image");
}

function decodeBase64(data: string): Uint8Array {
  const clean = data.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(clean)) throw new AppError("VALIDATION", "dataBase64 is not valid base64");
  const bin = atob(clean.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function uploadMedia(actor: Actor, input: z.input<typeof uploadMediaInput>, raw?: Uint8Array) {
  requireScope(actor, "content:write");
  const data = uploadMediaInput.parse(raw ? { ...input, dataBase64: "AA==" } : input);

  // Phase 1: authorization + quota precheck (short transaction).
  const { site, maxUpload, storageLeft } = await withUser(actor.userId, async (tx) => {
    await assertUserActive(tx, actor.userId);
    const site = await loadSite(tx, actor, data.siteId);
    const plan = await getPlanForUser(tx, actor.userId);
    const used = await userStorageBytes(tx, actor.userId);
    return { site, maxUpload: Math.min(plan.maxUploadBytes, ABSOLUTE_MAX_BYTES), storageLeft: plan.maxStorageBytes - used };
  });

  const bytes = raw ?? (data.sourceUrl ? await fetchRemoteImage(data.sourceUrl, maxUpload) : decodeBase64(data.dataBase64!));
  if (bytes.byteLength === 0) throw new AppError("VALIDATION", "File is empty");
  if (bytes.byteLength > maxUpload) throw new AppError("QUOTA_EXCEEDED", `File exceeds the ${Math.round(maxUpload / 1024 / 1024)} MB upload limit`);
  if (bytes.byteLength > storageLeft) throw new AppError("QUOTA_EXCEEDED", "Storage quota exceeded. Delete unused media with delete_media.");
  const info = sniffImage(bytes);
  if (!info) throw new AppError("VALIDATION", "Unsupported file type. Upload PNG, JPEG, GIF, WebP, AVIF or ICO images (SVG is not accepted).");

  const id = crypto.randomUUID();
  const key = `sites/${site.id}/${id}.${info.ext}`;
  const baseName = (data.filename ?? (data.sourceUrl ? new URL(data.sourceUrl).pathname.split("/").pop() : null) ?? `image.${info.ext}`)
    .replace(/[^\w.\- ]+/g, "")
    .slice(0, 120) || `image.${info.ext}`;

  await getStorage().put(key, bytes, info.mime);
  try {
    return await withUser(actor.userId, async (tx) => {
      // Re-check quota inside the write transaction to narrow the race window.
      const plan = await getPlanForUser(tx, actor.userId);
      if ((await userStorageBytes(tx, actor.userId)) + bytes.byteLength > plan.maxStorageBytes) {
        throw new AppError("QUOTA_EXCEEDED", "Storage quota exceeded.");
      }
      const [row] = await tx
        .insert(media)
        .values({
          id,
          siteId: site.id,
          storageKey: key,
          filename: baseName,
          mimeType: info.mime,
          sizeBytes: bytes.byteLength,
          width: info.width ?? null,
          height: info.height ?? null,
          altText: data.altText ?? null,
          sourceUrl: data.sourceUrl ?? null,
        })
        .returning();
      await audit(tx, actor, "media.upload", { siteId: site.id, targetType: "media", targetId: id, metadata: { size: bytes.byteLength, mime: info.mime } });
      return toMediaDto(row);
    });
  } catch (e) {
    await getStorage().delete(key).catch(() => {});
    throw e;
  }
}

export async function listMedia(actor: Actor, siteId: string, limit = 50, offset = 0) {
  requireScope(actor, "sites:read");
  return withUser(actor.userId, async (tx) => {
    const site = await loadSite(tx, actor, siteId);
    const rows = await tx
      .select()
      .from(media)
      .where(and(eq(media.siteId, site.id), isNull(media.deletedAt)))
      .orderBy(desc(media.createdAt))
      .limit(Math.min(limit, 100) + 1)
      .offset(offset);
    return { items: rows.slice(0, limit).map(toMediaDto), hasMore: rows.length > limit };
  });
}

export async function deleteMedia(actor: Actor, mediaId: string, confirmationToken?: string) {
  requireScope(actor, "content:write");
  const key = await withUser(actor.userId, async (tx) => {
    if (!/^[0-9a-f-]{36}$/i.test(mediaId)) throw notFound("Media");
    const [m] = await tx.select().from(media).where(and(eq(media.id, mediaId), isNull(media.deletedAt)));
    if (!m) throw notFound("Media");
    const site = await loadSite(tx, actor, m.siteId);
    const usedBy = await tx.select({ title: posts.title }).from(posts).where(and(eq(posts.coverMediaId, m.id), isNull(posts.deletedAt))).limit(5);
    await requireConfirmation(actor, {
      action: "delete_media",
      targetId: m.id,
      required: true,
      token: confirmationToken,
      summary: `Delete image "${m.filename}"${usedBy.length ? ` (cover image of: ${usedBy.map((u) => u.title).join(", ")})` : ""}. Any post embedding its URL will show a broken image. Ask the user to confirm, then call again with confirmation_token.`,
    });
    await tx.update(media).set({ deletedAt: new Date() }).where(eq(media.id, m.id));
    await tx.update(posts).set({ coverMediaId: null }).where(eq(posts.coverMediaId, m.id));
    await tx.update(sites).set({ logoMediaId: null }).where(and(eq(sites.id, site.id), eq(sites.logoMediaId, m.id)));
    await tx.update(sites).set({ faviconMediaId: null }).where(and(eq(sites.id, site.id), eq(sites.faviconMediaId, m.id)));
    await audit(tx, actor, "media.delete", { siteId: site.id, targetType: "media", targetId: m.id, metadata: { filename: m.filename } });
    return m.storageKey;
  });
  await getStorage().delete(key).catch(() => {});
  return { id: mediaId, deleted: true };
}
