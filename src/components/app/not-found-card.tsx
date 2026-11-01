import { Logo } from "@/components/app/brand";

/** 404 body shared by the platform's not-found pages. `inShell` drops the page chrome when a layout (the dashboard) already provides it. */
export function NotFoundCard({ href = "/", label = "Back to home", inShell }: { href?: string; label?: string; inShell?: boolean }) {
  const body = (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <p className="op-kicker">404</p>
      <h1 className="op-h1 mt-3">This page doesn&rsquo;t exist</h1>
      <p className="mt-4 max-w-md text-lg text-muted-foreground">The link may be broken, or the page may have been moved or deleted.</p>
      <a href={href} className="lp-cta mt-8">
        {label} <span className="lp-cta__arrow">→</span>
      </a>
    </div>
  );
  if (inShell) return body;
  return (
    <div className="op-canvas flex min-h-screen flex-col">
      <header className="flex h-14 items-center px-6 text-sm">
        <Logo />
      </header>
      <main className="flex flex-1 flex-col pb-24">{body}</main>
    </div>
  );
}
