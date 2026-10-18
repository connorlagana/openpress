import type { Metadata } from "next";
import { loadDashboardSite } from "@/server/auth/load";
import { listMedia } from "@/server/services/media";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params }: PageProps<"/dashboard/sites/[siteId]/settings">) {
  const { actor, site } = await loadDashboardSite((await params).siteId);
  const media = await listMedia(actor, site.id, 100);
  return <SettingsForm site={site} media={media.items.map((m) => ({ id: m.id, label: m.altText || m.filename }))} />;
}
