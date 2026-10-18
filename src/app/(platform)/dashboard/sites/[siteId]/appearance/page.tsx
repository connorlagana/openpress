import type { Metadata } from "next";
import { loadDashboardSite } from "@/server/auth/load";
import { listTemplates } from "@/server/services/appearance";
import { AppearanceForm } from "./appearance-form";

export const metadata: Metadata = { title: "Appearance" };

export default async function AppearancePage({ params }: PageProps<"/dashboard/sites/[siteId]/appearance">) {
  const { site } = await loadDashboardSite((await params).siteId);
  return <AppearanceForm siteId={site.id} siteUrl={site.url} template={site.template} theme={site.theme} templates={listTemplates().map(({ id, name, description }) => ({ id, name, description }))} />;
}
