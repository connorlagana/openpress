import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { config } from "@/lib/config";
import { cn } from "@/lib/utils";

export function Logo({ href = "/", compact, className }: { href?: string; compact?: boolean; className?: string }) {
  return (
    <Link href={href} aria-label={compact ? config.appName : undefined} className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="size-2.5 flex-none rounded-full bg-signal ring-3 ring-signal/20" aria-hidden />
      <span className={compact ? "hidden sm:inline" : undefined}>{config.appName}</span>
    </Link>
  );
}

export const navLinkClass = "whitespace-nowrap rounded-lg px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground";

/** The landing page's top bar, for the platform's other public pages. `right` replaces the default sign-in links. */
export function PublicHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <nav className="mx-auto flex h-14 max-w-[1180px] items-center gap-1 px-6 text-sm" aria-label="Main">
        <Logo className="mr-2" />
        <Link href="/docs/mcp" className={cn(navLinkClass, "hidden sm:inline")}>
          Docs
        </Link>
        <Link href="/journal/bring-your-own-ai" className={cn(navLinkClass, "hidden sm:inline")}>
          Guides
        </Link>
        <span className="flex-1" aria-hidden />
        {right ?? (
          <>
            <Link href="/login" className={navLinkClass}>
              Sign in
            </Link>
            <Link href="/signup" className={buttonVariants({ size: "sm" })}>
              Start blogging
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-6 px-6 py-8 text-xs text-muted-foreground">
        <div>
          <div className="font-medium text-foreground">{config.appName}</div>
          <p className="mt-1">Free blog hosting with a free MCP server. Your AI writes, you share.</p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
          <Link href="/docs/mcp" className="hover:text-foreground">
            MCP docs
          </Link>
          <a href="/llms.txt" className="hover:text-foreground">
            llms.txt
          </a>
          <Link href="/.well-known/oauth-protected-resource/mcp" prefetch={false} className="hover:text-foreground">
            OAuth metadata
          </Link>
          <Link href="/journal/bring-your-own-ai" className="hover:text-foreground">
            Guides
          </Link>
          <Link href="/report" className="hover:text-foreground">
            Report abuse
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}

/** Header, signal-tinted canvas and footer around a public content page (docs, privacy, report, journal). */
export function PublicShell({ children, header }: { children: ReactNode; header?: ReactNode }) {
  return (
    <div className="op-canvas flex min-h-screen flex-col">
      {header ?? <PublicHeader />}
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}

/** Title block matching the landing's section heads. */
export function PageIntro({ kicker, title, children, center }: { kicker?: ReactNode; title: ReactNode; children?: ReactNode; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : undefined}>
      {kicker ? <p className="op-kicker">{kicker}</p> : null}
      <h1 className={cn("op-h1", kicker && "mt-3")}>{title}</h1>
      {children ? <div className="mt-4 text-lg leading-relaxed text-pretty text-muted-foreground">{children}</div> : null}
    </div>
  );
}
