import Link from "next/link";
import { ClientTabs } from "@/components/app/client-tabs";
import { buttonVariants } from "@/components/ui/button";
import { clientInstructions } from "@/lib/clients";
import { config } from "@/lib/config";
import { getCurrentUser } from "@/server/auth/session";
import { mcpResourceUrl } from "@/server/oauth/oauth";
import { Compare } from "./_landing/compare";
import { Hero } from "./_landing/hero";
import { PromptBuilder } from "./_landing/prompt-builder";
import { Reveal } from "./_landing/reveal";
import { Story } from "./_landing/story";
import "./_landing/landing.css";

const HERO_PROMPT = `Create a minimalist blog on ${config.appName} called "Field Notes". Write a first post introducing it, add a fitting image, optimize it for search and publish it.`;

const FEATURES = [
  { title: "20 MCP tools", body: "Sites, posts, pages, media, templates, themes, SEO and analytics. Typed inputs and outputs, clear errors." },
  { title: "Three templates", body: "Editorial blog, product landing page, portfolio. Agents restyle them through safe theme settings." },
  { title: "SEO by default", body: "Titles, descriptions, canonical URLs, Open Graph, sitemaps, RSS and structured data, generated for every page." },
  { title: "Media library", body: "Agents import images by URL with alt text. Files are checked and size-limited." },
  { title: "Private analytics", body: "Pageviews, visitors, top pages and sources. No cookies and no ad trackers. Your agent can read them too." },
  { title: "A dashboard for humans", body: "Review drafts, edit with live preview, upload images and manage what each agent may do." },
];

const SAFETY = [
  { title: "Scoped access", body: "Choose exactly what each agent can do and on which sites. Revoke it in one click." },
  { title: "Confirm before deleting", body: "Deletes always need your OK in the chat. Turn on the same check for publishing." },
  { title: "Clean output", body: "Scripts, embeds and unsafe links are stripped from everything an agent writes." },
  { title: "Activity log", body: "Every publish, delete and permission change, with which agent did it." },
];

const FAQ = [
  ["Is it really free?", "Yes. One site on a free subdomain, 100 MB of images and unlimited MCP access, with no trial and no card. Paid plans may come later for extras like custom domains; the free tier stays."],
  ["Do I pay for AI?", `No. You bring your own agent (Claude, ChatGPT, Cursor or any MCP client). ${config.appName} never calls a language model.`],
  ["Which agents work?", "Any client that supports remote MCP servers over Streamable HTTP. OAuth sign-in works in Claude, ChatGPT, Claude Code, Cursor and VS Code; other clients can use an API key."],
  ["What can an agent do without asking me?", "Only what you approved on the consent screen. Deleting anything always requires your confirmation in the chat, and you can require it for publishing too."],
  ["Can I edit without an agent?", "Yes. The dashboard has an editor with preview, a media library, theme settings and analytics. You never need an agent, and you never need the dashboard."],
  ["Can I use my own domain?", "Not yet. Every site gets a free subdomain today; custom domains are planned."],
  ["What happens to my content?", "Posts are stored as Markdown. Your agent can read any of it back with get_post, and your site stays up as long as it follows the content rules."],
] as const;

function SectionHead({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="max-w-2xl">
      {eyebrow ? <p className="font-mono text-xs tracking-wide text-muted-foreground">{eyebrow}</p> : null}
      <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      {children ? <p className="mt-2 text-muted-foreground">{children}</p> : null}
    </div>
  );
}

export default async function Landing() {
  const user = await getCurrentUser();
  const mcpUrl = mcpResourceUrl();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="fixed inset-x-0 top-3 z-30 flex justify-center px-3">
        <nav className="lp-shadow flex items-center gap-1 rounded-2xl bg-background/85 py-1.5 pr-1.5 pl-3 text-sm backdrop-blur" aria-label="Main">
          <Link href="/" className="mr-2 flex items-center gap-2 font-semibold tracking-tight">
            <span className="size-2.5 rounded-full bg-signal ring-3 ring-signal/20" aria-hidden />
            {config.appName}
          </Link>
          <a href="#how" className="hidden rounded-lg px-2.5 py-1.5 text-muted-foreground hover:text-foreground sm:inline">
            How it works
          </a>
          <Link href="/docs/mcp" className="hidden rounded-lg px-2.5 py-1.5 text-muted-foreground hover:text-foreground sm:inline">
            Docs
          </Link>
          <a href="#faq" className="hidden rounded-lg px-2.5 py-1.5 text-muted-foreground hover:text-foreground sm:inline">
            FAQ
          </a>
          <span className="mx-1.5 hidden h-5 w-px bg-border sm:block" aria-hidden />
          {user ? (
            <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-2.5 py-1.5 text-muted-foreground hover:text-foreground">
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
        <Hero appName={config.appName} ctaHref={user ? "/dashboard" : "/signup"} ctaLabel={user ? "Open dashboard" : "Create a free site"} prompt={HERO_PROMPT} />
        <Story rootDomain={config.rootDomain} />

        {/* Prompt builder */}
        <section id="prompt" className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <SectionHead eyebrow="START HERE" title="Four questions. One prompt.">
              Answer a few questions and get a prompt that builds your whole site. Paste it into your agent after you connect it.
            </SectionHead>
          </Reveal>
          <Reveal delay={120}>
            <PromptBuilder appName={config.appName} />
          </Reveal>
        </section>

        {/* Comparison */}
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <Reveal>
            <SectionHead eyebrow="EXAMPLES" title="Ask once. Skip the setup." />
          </Reveal>
          <Reveal className="mt-8" delay={120}>
            <Compare />
          </Reveal>
        </section>

        {/* Features */}
        <section className="border-t">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <Reveal>
              <SectionHead eyebrow="INCLUDED" title="Everything a site needs. Nothing to install." />
            </Reveal>
            <Reveal delay={120}>
            <div className="mt-10 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="bg-background p-5">
                  <h3 className="font-medium">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>
            </Reveal>
          </div>
        </section>

        {/* Install */}
        <section id="connect" className="border-t bg-muted/20">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[1fr_1.3fr]">
            <Reveal>
              <SectionHead eyebrow="CONNECT" title="One URL for every agent.">
                Add the server to your client, sign in, and approve what it may do. Same URL for every client.
              </SectionHead>
            </Reveal>
            <Reveal className="min-w-0" delay={120}>
              <div className="lp-shadow rounded-2xl bg-background p-5">
                <ClientTabs clients={clientInstructions(mcpUrl, config.appName)} />
              </div>
            </Reveal>
          </div>
        </section>

        {/* Safety */}
        <section className="border-t">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <Reveal>
              <SectionHead eyebrow="SAFETY" title="Safe by design.">
                Agents act on your behalf, so the server enforces every rule, not the agent.
              </SectionHead>
            </Reveal>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SAFETY.map((s, i) => (
                <li key={s.title}>
                  <Reveal delay={i * 90} className="h-full">
                    <div className="lp-shadow h-full rounded-2xl bg-background p-5">
                      <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                      <h3 className="mt-2 font-medium">{s.title}</h3>
                      <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <SectionHead eyebrow="FAQ" title="Fair questions." />
            </Reveal>
            <div className="divide-y border-y">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                    {q}
                    <span className="text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="border-t">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">Your agent is ready to publish.</h2>
            <Link href={user ? "/dashboard" : "/signup"} className={buttonVariants({ size: "lg" })}>
              {user ? "Open dashboard" : "Create a free site"}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-6 px-6 py-8 text-xs text-muted-foreground">
          <div>
            <div className="font-medium text-foreground">{config.appName}</div>
            <p className="mt-1">Free websites your AI agent can publish.</p>
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
            <Link href="/report" className="hover:text-foreground">
              Report abuse
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
