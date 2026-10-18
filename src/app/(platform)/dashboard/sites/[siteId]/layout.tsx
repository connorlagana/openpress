import { loadDashboardSite } from "@/server/auth/load";
import { TabLink } from "../../nav-link";

export default async function SiteLayout({ children, params }: LayoutProps<"/dashboard/sites/[siteId]">) {
  const { siteId } = await params;
  const { site } = await loadDashboardSite(siteId);
  const base = `/dashboard/sites/${site.id}`;
  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{site.name}</h1>
          <a href={site.url} target="_blank" rel="noreferrer" className="font-mono text-xs text-muted-foreground hover:text-foreground">
            {site.url.replace(/^https?:\/\//, "")} ↗
          </a>
          {site.suspended ? <span className="text-xs text-destructive">Suspended</span> : null}
        </div>
        <nav className="mt-5 flex gap-5 overflow-x-auto border-b" aria-label="Site">
          <TabLink href={base} exact>
            Posts
          </TabLink>
          <TabLink href={`${base}/pages`}>Pages</TabLink>
          <TabLink href={`${base}/media`}>Media</TabLink>
          <TabLink href={`${base}/appearance`}>Appearance</TabLink>
          <TabLink href={`${base}/analytics`}>Analytics</TabLink>
          <TabLink href={`${base}/settings`}>Settings</TabLink>
        </nav>
      </div>
      {children}
    </div>
  );
}
