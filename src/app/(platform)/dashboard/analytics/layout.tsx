import { TabLink } from "../nav-link";

export default function AnalyticsLayout({ children }: LayoutProps<"/dashboard/analytics">) {
  return (
    <div>
      <nav className="mb-8 flex gap-5 overflow-x-auto border-b" aria-label="Analytics">
        <TabLink href="/dashboard/analytics" exact>
          Overview
        </TabLink>
        <TabLink href="/dashboard/analytics/sites">All blogs</TabLink>
      </nav>
      {children}
    </div>
  );
}
