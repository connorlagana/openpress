import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppError } from "@/lib/errors";
import { loadDashboardSite } from "@/server/auth/load";
import { listMedia } from "@/server/services/media";
import { getPost } from "@/server/services/posts";
import { Editor } from "./editor";

export const metadata: Metadata = { title: "Edit" };

export default async function EditPostPage({ params }: PageProps<"/dashboard/sites/[siteId]/posts/[postId]">) {
  const { siteId, postId } = await params;
  const { actor, site } = await loadDashboardSite(siteId);
  const post = await getPost(actor, postId).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  if (post.siteId !== site.id) notFound();
  const media = await listMedia(actor, site.id, 100);
  return <Editor post={post} media={media.items.map((m) => ({ id: m.id, url: m.url, alt: m.altText, filename: m.filename }))} />;
}
