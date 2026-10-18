"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { renderMarkdown } from "@/lib/markdown";
import { deleteAllSessions } from "@/server/auth/accounts";
import { requireActor, setSessionCookie } from "@/server/auth/session";
import { createApiKey } from "@/server/oauth/oauth";
import { changePassword, updateProfile } from "@/server/services/account";
import { revokeConnection, updateConnection } from "@/server/services/agents";
import { setTemplate, updateTheme } from "@/server/services/appearance";
import { deleteMedia } from "@/server/services/media";
import { createPost, deletePost, setPublished, updatePost } from "@/server/services/posts";
import { createSite, deleteSite, isSubdomainAvailable, updateSiteSettings, validateSubdomain } from "@/server/services/sites";
import type { Scope } from "@/server/actor";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function attempt<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message + (typeof e.details?.suggestion === "string" ? ` Try “${e.details.suggestion}”.` : "") };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues.map((i) => `${i.path.join(".") || "Input"}: ${i.message}`).join("; ") };
    throw e;
  }
}

// ---------- Onboarding ----------
export async function checkSubdomainAction(sub: string): Promise<{ ok: boolean; message: string }> {
  await requireActor();
  const v = sub.trim().toLowerCase();
  const err = validateSubdomain(v);
  if (err) return { ok: false, message: err };
  return (await isSubdomainAvailable(v)) ? { ok: true, message: "Available" } : { ok: false, message: "Already taken" };
}

export async function createSiteAction(input: { name: string; subdomain?: string; template: string }) {
  const actor = await requireActor();
  const res = await attempt(() => createSite(actor, { name: input.name, subdomain: input.subdomain || undefined, template: input.template as "editorial" }));
  if (!res.ok) return res;
  redirect(`/dashboard/agents?welcome=${res.data!.id}`);
}

// ---------- Posts ----------
export async function newPostAction(siteId: string, kind: "post" | "page") {
  const actor = await requireActor();
  const res = await attempt(() => createPost(actor, { siteId, kind, title: kind === "page" ? "Untitled page" : "Untitled post", content: "" }));
  if (!res.ok) return res;
  redirect(`/dashboard/sites/${siteId}/posts/${res.data!.id}`);
}

const editorInput = z.object({
  title: z.string(),
  content: z.string(),
  slug: z.string(),
  excerpt: z.string(),
  tags: z.string(),
  coverMediaId: z.string(),
  authorName: z.string(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  canonicalUrl: z.string(),
  noindex: z.boolean(),
});
export type EditorInput = z.infer<typeof editorInput>;

export async function savePostAction(postId: string, raw: EditorInput) {
  const actor = await requireActor();
  const d = editorInput.parse(raw);
  const blank = (s: string) => (s.trim() ? s.trim() : null);
  const res = await attempt(() =>
    updatePost(actor, postId, {
      title: d.title,
      content: d.content,
      slug: d.slug.trim() || undefined,
      excerpt: d.excerpt.trim() || undefined,
      tags: d.tags.split(",").map((t) => t.trim()).filter(Boolean),
      coverMediaId: blank(d.coverMediaId),
      authorName: d.authorName.trim() || undefined,
      seoTitle: blank(d.seoTitle),
      seoDescription: blank(d.seoDescription),
      canonicalUrl: blank(d.canonicalUrl),
      noindex: d.noindex,
    }),
  );
  if (res.ok) revalidatePath(`/dashboard/sites/${res.data!.siteId}`, "layout");
  return res;
}

export async function setPublishedAction(postId: string, publish: boolean) {
  const actor = await requireActor();
  const res = await attempt(() => setPublished(actor, postId, publish));
  if (res.ok) revalidatePath(`/dashboard/sites/${res.data!.siteId}`, "layout");
  return res;
}

export async function deletePostAction(siteId: string, postId: string, kind: "post" | "page") {
  const actor = await requireActor();
  const res = await attempt(() => deletePost(actor, postId));
  if (!res.ok) return res;
  redirect(`/dashboard/sites/${siteId}${kind === "page" ? "/pages" : ""}`);
}

export async function previewMarkdownAction(md: string) {
  await requireActor();
  return renderMarkdown(md.slice(0, 200_000));
}

// ---------- Media ----------
export async function deleteMediaAction(siteId: string, mediaId: string) {
  const actor = await requireActor();
  const res = await attempt(() => deleteMedia(actor, mediaId));
  if (res.ok) revalidatePath(`/dashboard/sites/${siteId}/media`);
  return res;
}

// ---------- Appearance ----------
export async function setTemplateAction(siteId: string, templateId: string) {
  const actor = await requireActor();
  const res = await attempt(() => setTemplate(actor, { siteId, templateId: templateId as "editorial", resetTheme: true }));
  if (res.ok) revalidatePath(`/dashboard/sites/${siteId}`, "layout");
  return res;
}

export async function updateThemeAction(siteId: string, theme: Record<string, unknown>) {
  const actor = await requireActor();
  const res = await attempt(() => updateTheme(actor, { siteId, theme }));
  if (res.ok) revalidatePath(`/dashboard/sites/${siteId}/appearance`);
  return res;
}

// ---------- Settings ----------
export async function updateSiteAction(siteId: string, patch: Parameters<typeof updateSiteSettings>[2]) {
  const actor = await requireActor();
  const res = await attempt(async () => {
    await updateSiteSettings(actor, siteId, patch);
  });
  if (res.ok) revalidatePath(`/dashboard/sites/${siteId}`, "layout");
  return res;
}

export async function deleteSiteAction(siteId: string, confirmSubdomain: string, expected: string) {
  const actor = await requireActor();
  if (confirmSubdomain.trim() !== expected) return { ok: false as const, error: "Type the subdomain exactly to confirm." };
  const res = await attempt(() => deleteSite(actor, siteId));
  if (!res.ok) return res;
  redirect("/dashboard");
}

// ---------- Agents ----------
export async function createApiKeyAction(input: { name: string; scopes: Scope[]; allSites: boolean; siteIds: string[]; confirmPublish: boolean }) {
  const actor = await requireActor();
  const res = await attempt(() => createApiKey(actor.userId, input, actor.ip));
  if (res.ok) revalidatePath("/dashboard/agents");
  return res;
}

export async function updateConnectionAction(id: string, input: { scopes: Scope[]; allSites: boolean; siteIds: string[]; confirmPublish: boolean }) {
  const actor = await requireActor();
  const res = await attempt(() => updateConnection(actor, id, input));
  if (res.ok) revalidatePath("/dashboard/agents");
  return res;
}

export async function revokeConnectionAction(id: string) {
  const actor = await requireActor();
  const res = await attempt(() => revokeConnection(actor, id));
  if (res.ok) revalidatePath("/dashboard/agents");
  return res;
}

// ---------- Account ----------
export async function updateProfileAction(name: string) {
  const actor = await requireActor();
  const res = await attempt(() => updateProfile(actor, name));
  if (res.ok) revalidatePath("/dashboard/account");
  return res;
}

export async function changePasswordAction(current: string, next: string) {
  const actor = await requireActor();
  const res = await attempt(async () => {
    await changePassword(actor, current, next);
    await deleteAllSessions(actor.userId);
    await setSessionCookie(actor.userId);
  });
  return res;
}
