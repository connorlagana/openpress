import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { config } from "@/lib/config";
import { getCurrentUser } from "@/server/auth/session";
import { mcpResourceUrl } from "@/server/oauth/oauth";

const TRANSCRIPT = [
  { who: "you", text: "Create a technology blog called The Engineering Journal. Minimalist. Write an article about AI and software engineering, add an image, optimize it for search and publish it." },
  { who: "tool", text: "create_site → the-engineering-journal" },
  { who: "tool", text: "upload_media → cover.jpg (alt text set)" },
  { who: "tool", text: "create_post → draft “Will AI Replace Software Engineers?”" },
  { who: "tool", text: "update_post_seo → title, description, slug" },
  { who: "tool", text: "publish_post → status: published" },
  { who: "agent", text: `Done. It’s live at the-engineering-journal.${config.rootDomain}/blog/will-ai-replace-software-engineers` },
];

export default async function Landing() {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-semibold tracking-tight">{config.appName}</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/docs/mcp" className="text-muted-foreground hover:text-foreground">
            MCP docs
          </Link>
          {user ? (
            <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-muted-foreground hover:text-foreground">
                Sign in
              </Link>
              <Link href="/signup" className={buttonVariants({ size: "sm" })}>
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>
      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl gap-12 px-6 pt-16 pb-24 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
          <div>
            <p className="font-mono text-xs tracking-wide text-muted-foreground">MCP-NATIVE PUBLISHING</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Websites your AI agent can build, write and publish.</h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Free hosting with a built-in MCP server. Connect Claude, ChatGPT or any MCP client, then ask for a site, a post, or a redesign. No servers, no plugins, no code.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={user ? "/dashboard" : "/signup"} className={buttonVariants({ size: "lg" })}>
                {user ? "Open dashboard" : "Create a free site"}
              </Link>
              <Link href="/docs/mcp" className={buttonVariants({ size: "lg", variant: "outline" })}>
                How it works
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Free forever. No trial, no card, no AI subscription from us.</p>
            <div className="mt-10">
              <p className="text-xs text-muted-foreground">MCP server</p>
              <code className="mt-1 inline-block rounded-md border bg-muted/40 px-2.5 py-1.5 font-mono text-sm">{mcpResourceUrl()}</code>
            </div>
          </div>
          <div className="rounded-2xl border bg-muted/20 p-5 font-mono text-[13px] leading-relaxed" aria-label="Example agent session">
            {TRANSCRIPT.map((l, i) => (
              <div key={i} className={l.who === "tool" ? "pl-4 text-muted-foreground" : "py-2"}>
                {l.who === "you" ? <span className="mr-2 text-muted-foreground">you ›</span> : l.who === "agent" ? <span className="mr-2 text-signal">agent ›</span> : <span className="mr-2">↳</span>}
                {l.text}
              </div>
            ))}
          </div>
        </section>
        <section className="border-t">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-3">
            {[
              ["1. Sign up", "Pick a name and a template. You get a free subdomain in under a minute."],
              ["2. Connect your agent", "Paste one URL into your AI client and approve exactly what it may do, on which sites."],
              ["3. Ask", "Your agent drafts, uploads images, tunes SEO and publishes. You can review everything in a simple dashboard."],
            ].map(([t, d]) => (
              <div key={t}>
                <h2 className="font-medium">{t}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-6 py-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} {config.appName}</span>
          <div className="flex gap-4">
            <Link href="/docs/mcp">MCP docs</Link>
            <Link href="/report">Report abuse</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
