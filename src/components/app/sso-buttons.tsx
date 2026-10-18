import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { enabledSsoProviders, type SsoProvider } from "@/server/auth/sso";

const LABELS: Record<SsoProvider, string> = { google: "Google", apple: "Apple" };

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.28 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.27a12 12 0 0 0 0 10.76l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 1.27 6.62l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="currentColor">
      <path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.27-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.51 1.25-2.58-.03-.01-2.4-.92-2.42-3.65l.04-.03ZM14.1 5.87c.63-.77 1.06-1.83.94-2.9-.91.04-2.01.61-2.66 1.37-.58.67-1.1 1.76-.96 2.8 1.01.08 2.05-.52 2.68-1.27Z" />
    </svg>
  );
}

/**
 * "Continue with Google / Apple" links. Renders nothing when no provider is configured.
 * Plain <a>: these hit route handlers that redirect off-site, so there's nothing to prefetch.
 */
export function SsoButtons({ next, link = false, connected = [], divider = true }: { next?: string; link?: boolean; connected?: SsoProvider[]; divider?: boolean }) {
  const providers = enabledSsoProviders().filter((p) => !connected.includes(p));
  if (!providers.length) return null;
  const href = (p: SsoProvider) => {
    const q = new URLSearchParams();
    if (next) q.set("next", next);
    if (link) q.set("link", "1");
    return `/auth/${p}/start${q.size ? `?${q}` : ""}`;
  };
  return (
    <div className="space-y-6">
      <div className={cn("grid gap-2.5", link && "sm:flex")}>
        {providers.map((p) => (
          <a
            key={p}
            href={href(p)}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "gap-2 px-4",
              p === "apple" && "border-transparent bg-black text-white hover:bg-black/85 hover:text-white dark:bg-white dark:text-black dark:hover:bg-white/90 dark:hover:text-black",
            )}
          >
            {p === "google" ? <GoogleMark /> : <AppleMark />}
            {link ? `Connect ${LABELS[p]}` : `Continue with ${LABELS[p]}`}
          </a>
        ))}
      </div>
      {divider ? (
        <div className="flex items-center gap-3 text-xs text-muted-foreground" role="separator">
          <span className="h-px flex-1 bg-border" />
          or with email
          <span className="h-px flex-1 bg-border" />
        </div>
      ) : null}
    </div>
  );
}
