import Link from "next/link";
import { ClientTabs } from "@/components/app/client-tabs";
import { buttonVariants } from "@/components/ui/button";
import { clientInstructions } from "@/lib/clients";
import { config } from "@/lib/config";
import { SUBDOMAIN_RE } from "@/lib/slug";
import { getCurrentUser } from "@/server/auth/session";
import { getPublicSite } from "@/server/public/data";
import { mcpResourceUrl } from "@/server/oauth/oauth";
import { ClaimName } from "./_landing/claim";
import { Compare } from "./_landing/compare";
import { Hero } from "./_landing/hero";
import { Examples } from "./_landing/examples";
import { RememberRef } from "./_landing/ref";
import { Reveal } from "./_landing/reveal";
import { Story } from "./_landing/story";
import "./_landing/landing.css";

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

/** Visitors arriving from a site's "Published with" footer link (?ref=<subdomain>) or a campaign (?utm_source=…). */
async function attribution(params: Record<string, string | string[] | undefined>) {
  const ref = typeof params.ref === "string" && SUBDOMAIN_RE.test(params.ref) ? params.ref : undefined;
  const site = ref ? await getPublicSite(ref) : null;
  const utm = typeof params.utm_source === "string" ? params.utm_source.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40) : "";
  return { site, source: site ? `site:${site.subdomain}` : utm && utm !== "site" ? `utm:${utm}` : undefined };
}

export default async function Landing({ searchParams }: PageProps<"/">) {
  const [user, ref] = await Promise.all([getCurrentUser(), searchParams.then(attribution)]);
  const mcpUrl = mcpResourceUrl();
  const banner = ref.site ? (
    <a href={config.siteUrl(ref.site.subdomain)} className="lp-shadow inline-flex max-w-full items-center gap-2 rounded-full bg-background px-3 py-1 text-[13px]">
      <span className="size-2 flex-none rounded-full bg-signal" aria-hidden />
      <span className="truncate">
        <b className="font-medium">{ref.site.name}</b> <span className="text-muted-foreground">was built and published by an AI agent on {config.appName}</span>
      </span>
    </a>
  ) : undefined;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-transparent bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <nav className="mx-auto flex h-14 max-w-[1180px] items-center gap-1 px-6 text-sm" aria-label="Main">
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
          <span className="flex-1" aria-hidden />
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
        {ref.source ? <RememberRef source={ref.source} /> : null}
        <Hero appName={config.appName} rootDomain={config.rootDomain} signedIn={!!user} banner={banner} />
        <Story rootDomain={config.rootDomain} />

        {/* Example prompts */}
        <section id="prompt" className="border-t">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <Reveal>
              <SectionHead eyebrow="START HERE" title="One sentence is enough.">
                Paste a starter into your agent once it&rsquo;s connected. It asks what it needs and makes the site yours, so no two come out the same.
              </SectionHead>
            </Reveal>
            <Reveal className="mt-10" delay={120}>
              <Examples appName={config.appName} rootDomain={config.rootDomain} />
            </Reveal>
          </div>
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
              <SectionHead eyebrow="CONNECT" title="Already have an agent? Start there.">
                Add this URL to your client. If you don&rsquo;t have an account yet, you&rsquo;ll create one in the sign-in window, then your agent can build the site for you.
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
          <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-6 px-6 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">Your agent is ready to publish.</h2>
            {user ? (
              <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
                Open dashboard
              </Link>
            ) : (
              <ClaimName rootDomain={config.rootDomain} signedIn={false} />
            )}
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
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
