import Link from "next/link";
import { Logo } from "@/components/app/brand";
import { config } from "@/lib/config";
import { BlogSite } from "../_landing/blog-site";
import { SITES } from "../_landing/sites";
import "../_landing/landing.css";
import "./auth.css";

const STEPS = [
  ["Create your account", "Free hosting and MCP access. No trial, no card."],
  ["Connect your agent", "Claude, ChatGPT, Cursor or any MCP client. You choose what it may do."],
  ["Ask for a site", "It writes, designs and publishes. You stay in control."],
] as const;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, "-");

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex min-w-0 flex-col bg-muted/20">
        <header className="flex h-14 items-center justify-between px-6 text-sm">
          <Logo />
          <Link href="/" className="rounded-lg px-2.5 py-1.5 text-muted-foreground hover:text-foreground">
            ← Home
          </Link>
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pt-4 pb-10 sm:items-center sm:px-6 sm:py-10">
          <div className="lp-shadow w-full max-w-[420px] rounded-2xl bg-background p-6 sm:p-8">{children}</div>
        </main>
        <footer className="flex flex-wrap gap-x-5 gap-y-2 px-6 py-5 text-xs text-muted-foreground">
          <span>Free websites your AI agent can publish.</span>
          <span className="flex-1" aria-hidden />
          <Link href="/docs/mcp" className="hover:text-foreground">
            MCP docs
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
        </footer>
      </div>

      <aside className="relative hidden p-3 lg:block">
        <div className="au-panel">
          <div className="au-wall" aria-hidden>
            <div className="au-wall__plane">
              {SITES.map((col, c) => (
                <div key={c} className="lp-wall__col" style={{ animationDuration: `${52 + c * 9}s`, animationDirection: c % 2 ? "reverse" : "normal" }}>
                  {[...col, ...col].map((s, i) => (
                    <BlogSite key={i} post={s} host={`${slug(s.name)}.${config.rootDomain}`} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="lp-shadow relative mt-auto max-w-[400px] rounded-2xl bg-background/90 p-5 backdrop-blur">
            <p className="font-mono text-xs tracking-wide text-muted-foreground">HOW IT WORKS</p>
            <ol className="mt-3 space-y-3">
              {STEPS.map(([title, body], i) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-px flex size-5 flex-none items-center justify-center rounded-full bg-signal/15 font-mono text-[11px] text-signal">{i + 1}</span>
                  <div>
                    <div className="text-sm font-medium">{title}</div>
                    <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </aside>
    </div>
  );
}
