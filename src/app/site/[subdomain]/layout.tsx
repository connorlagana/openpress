import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { themeCssVars } from "@/lib/theme";
import { loadPublicSite, siteBaseMetadata } from "@/server/public/render";
import { SiteFooter, SiteHeader } from "@/templates/components";
import "./site.css";

export async function generateMetadata({ params }: LayoutProps<"/site/[subdomain]">): Promise<Metadata> {
  const site = await loadPublicSite((await params).subdomain);
  if (!site) return { title: "Site not found", robots: { index: false } };
  const v = site.settingsParsed.searchVerification;
  return {
    ...siteBaseMetadata(site),
    verification: v?.google || v?.bing ? { google: v.google, other: v.bing ? { "msvalidate.01": v.bing } : undefined } : undefined,
    title: { default: site.name, template: `%s · ${site.name}` },
    description: site.description ?? site.tagline ?? undefined,
  };
}

export default async function SiteLayout({ children, params }: LayoutProps<"/site/[subdomain]">) {
  const site = await loadPublicSite((await params).subdomain);
  if (!site) {
    return (
      <html lang="en">
        <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>{children}</body>
      </html>
    );
  }
  return (
    <html lang={site.language} className={`fs-${site.theme.colorMode}`} style={themeCssVars(site.theme) as CSSProperties}>
      <body>
        <a className="fs-skip" href="#content">
          Skip to content
        </a>
        <SiteHeader site={site} path="" />
        <main id="content" className="fs-main">
          {children}
        </main>
        <SiteFooter site={site} />
      </body>
    </html>
  );
}
