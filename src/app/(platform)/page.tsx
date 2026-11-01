import Image from "next/image";
import Link from "next/link";
import { Logo, SiteFooter } from "@/components/app/brand";
import { ClientTabs } from "@/components/app/client-tabs";
import { buttonVariants } from "@/components/ui/button";
import { clientInstructions } from "@/lib/clients";
import { config } from "@/lib/config";
import { SUBDOMAIN_RE } from "@/lib/slug";
import { getCurrentUser } from "@/server/auth/session";
import { getPublicSite } from "@/server/public/data";
import { mcpResourceUrl } from "@/server/oauth/oauth";
import { BlogHero } from "./_landing/blog-hero";
import { ClaimName } from "./_landing/claim";
import { Examples } from "./_landing/examples";
import { RememberRef } from "./_landing/ref";
import { Reveal } from "./_landing/reveal";
import { Showcase } from "./_landing/showcase";
import { Story } from "./_landing/story";
import { articles } from "./journal/articles";
import "./_landing/landing.css";

const GUIDE_IMAGES = ["food", "surf", "city"];

const YOUR_WAY = [
  { title: "Write by talking", body: "No editor to learn. Brainstorm, argue, research or plan with your AI, then ask it to turn the good parts into a post in your voice." },
  { title: "Your own free address", body: "Every blog gets a free yourname subdomain, with a homepage, post pages, an about page and tags." },
  { title: "Make it look like you", body: "Pick a template, then ask for a warmer palette or a serif headline. Your AI restyles the blog with safe theme settings." },
];

const INFRA = [
  { title: "Secure by design", body: "You choose what each AI can do and on which blog. Deleting always needs your OK in the chat, and you can require it for publishing too." },
  { title: "Reliable, free hosting", body: "Your blog stays online with no plugins to update, no server to run and no bill. Free means free: no trial and no card." },
  { title: "Clean, fast pages", body: "Posts are rendered and sanitized when they're saved, so pages load quickly and scripts or unsafe embeds never get through." },
];

const TRAFFIC = [
  { title: "Found in search", body: "Titles, descriptions, canonical URLs and structured data are generated for every post. Your AI can tune them too." },
  { title: "Looks good when shared", body: "Open Graph cards for every post, so links look right in messages and social feeds." },
  { title: "Sitemaps and RSS", body: "Search engines discover new posts automatically, and readers can follow along in any feed reader." },
  { title: "Private analytics", body: "Visitors, top posts and sources with no cookies and no ad trackers. Ask your AI what's working." },
];

const EFFICIENT = [
  { title: "Drafts you review", body: "Have your AI save posts as drafts, then read and tweak them in the dashboard with a live preview." },
  { title: "Revisions and redirects", body: "Every edit keeps a revision, and changing a URL leaves a redirect behind so old links still work." },
  { title: "An activity log", body: "See every publish, edit and permission change, and which AI connection made it." },
];

const STEPS = [
  { title: "Claim your free blog", body: "Pick your name and create an account. It takes under a minute, with no card." },
  { title: "Connect your AI", body: "Add the OpenPress MCP server to Claude, ChatGPT, Cursor or any MCP client and approve what it may do." },
  { title: "Have a conversation", body: "Talk about anything: a trip, a recipe, something you learned, a problem you solved." },
  { title: "Say “make this a blog post”", body: "Your AI writes it up, adds a title, a summary and images, and saves or publishes it." },
  { title: "Share it", body: "Send the link. Then keep going: every good conversation can become the next post." },
];

const FAQ = [
  ["Is it really free?", "Yes. One blog on a free subdomain, 100 MB of images and unlimited MCP access, with no trial and no card. Paid plans may come later for extras like custom domains; the free tier stays."],
  ["Do I pay for AI?", `No. You bring the AI you already use (Claude, ChatGPT, Cursor or any MCP client). ${config.appName} never calls a language model, so there's nothing extra to pay for.`],
  ["How does my chatbot post to my blog?", "Through MCP, an open standard that lets AI apps use tools. Once you connect, your AI can create posts, upload images, change the theme and read your analytics, within the permissions you approved."],
  ["Will it publish things without asking?", "Only what you approved on the consent screen. Deleting always needs your confirmation in the chat, you can require it for publishing too, and you can have every post saved as a draft first."],
  ["Is this good for beginners?", "Yes. If you can chat with an AI, you can run a blog. There's also a dashboard with an editor, media library and theme settings if you ever want to edit by hand."],
  ["What should I blog about?", "Whatever you already talk to your AI about: travel plans, recipes, projects, things you're learning, reviews, opinions. The best posts often start as questions."],
  ["Can I use my own domain?", "Not yet. Every blog gets a free subdomain today; custom domains are planned."],
] as const;

function SectionHead({ title, children, center }: { title: string; children?: React.ReactNode; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-2xl"}>
      <h2 className="wb-h2">{title}</h2>
      {children ? <p className="mt-4 text-lg text-muted-foreground">{children}</p> : null}
    </div>
  );
}

function StartCta({ signedIn, label = "Start blogging" }: { signedIn: boolean; label?: string }) {
  return (
    <Link href={signedIn ? "/dashboard" : "/signup"} className="lp-cta mt-8">
      {signedIn ? "Open dashboard" : label} <span className="lp-cta__arrow">→</span>
    </Link>
  );
}

function Blocks({ items, cols }: { items: readonly { title: string; body: string }[]; cols: 3 | 4 }) {
  return (
    <div className={`mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 ${cols === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
      {items.map((f) => (
        <div key={f.title}>
          <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{f.body}</p>
        </div>
      ))}
    </div>
  );
}

function Shot({ src, children, className }: { src: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={`wb-banner ${className ?? ""}`} aria-hidden>
      <Image src={`/images/landing/${src}.jpg`} alt="" fill sizes="(min-width: 1024px) 1100px, 100vw" className="object-cover" unoptimized />
      {children}
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
          <Logo className="mr-2" />
          <a href="#steps" className="hidden rounded-lg px-2.5 py-1.5 text-muted-foreground hover:text-foreground sm:inline">
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
                Start blogging
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="flex-1">
        {ref.source ? <RememberRef source={ref.source} /> : null}
        <BlogHero rootDomain={config.rootDomain} signedIn={!!user} banner={banner} />
        <Story rootDomain={config.rootDomain} />

        {/* Example blogs */}
        <section id="examples" className="wb-section border-t">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal>
              <SectionHead center title="Blogs that started as a chat">
                Travel journals, recipe notebooks, field notes, hot takes. Pick a template and your AI makes it yours, so no two blogs come out the same.
              </SectionHead>
            </Reveal>
          </div>
          <Reveal className="mt-12" delay={120}>
            <Showcase rootDomain={config.rootDomain} />
          </Reveal>
          <div className="text-center">
            <StartCta signedIn={!!user} label="Start your blog" />
          </div>
        </section>

        {/* Your way */}
        <section id="how" className="wb-section scroll-mt-16 border-t">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2">
            <Reveal>
              <Shot src="outdoors" className="wb-banner--tall">
                <div className="wb-float wb-float--chat">
                  <p className="wb-chat__me">Okay, that hike plan is great. Turn it into a post?</p>
                  <p className="wb-chat__ai">Done. &ldquo;Take the trail with no shortcuts&rdquo; is saved as a draft for you to review.</p>
                </div>
              </Shot>
            </Reveal>
            <div>
              <SectionHead title="Blog your way, in plain words">
                {config.appName} is the free connection between the AI you already talk to and a blog that&rsquo;s entirely yours.
              </SectionHead>
              <div className="mt-8 space-y-6">
                {YOUR_WAY.map((f) => (
                  <div key={f.title}>
                    <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{f.body}</p>
                  </div>
                ))}
              </div>
              <StartCta signedIn={!!user} />
            </div>
          </div>
        </section>

        {/* Infrastructure */}
        <section className="wb-section border-t bg-muted/30">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal>
              <SectionHead title="Free hosting that keeps you in control">
                Your AI acts on your behalf, so the server enforces every rule, not the AI.
              </SectionHead>
            </Reveal>
            <Blocks items={INFRA} cols={3} />
          </div>
        </section>

        {/* Traffic */}
        <section className="wb-section border-t">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal>
              <SectionHead title="Get your posts read">
                Every post is ready for search, sharing and subscribers the moment it&rsquo;s published.
              </SectionHead>
            </Reveal>
            <Reveal className="mt-10" delay={120}>
              <Shot src="coffee" className="wb-banner--wide">
                <div className="wb-float wb-float--serp">
                  <span>dailygrind.{config.rootDomain} › brewing</span>
                  <b>Your best coffee isn&rsquo;t at a café</b>
                  <p>One good bag of beans, a simple brewer, and a few small changes to your morning.</p>
                </div>
                <div className="wb-float wb-float--stats">
                  <span>Visitors · last 30 days</span>
                  <b>2,481</b>
                  <svg viewBox="0 0 120 36" preserveAspectRatio="none"><polyline points="0,32 15,28 30,30 45,22 60,24 75,15 90,17 105,8 120,4" /></svg>
                </div>
              </Shot>
            </Reveal>
            <Blocks items={TRAFFIC} cols={4} />
            <StartCta signedIn={!!user} />
          </div>
        </section>

        {/* Efficiency */}
        <section className="wb-section border-t">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2">
            <div className="lg:order-2">
              <Reveal>
                <Shot src="design" className="wb-banner--tall">
                  <div className="wb-float wb-float--drafts">
                    <span>Posts</span>
                    <p><b>A little less stuff. A lot more home.</b><i className="is-live">Published</i></p>
                    <p><b>Five corners that deserve a reading chair</b><i>Draft</i></p>
                    <p><b>Notes on afternoon light</b><i>Draft</i></p>
                  </div>
                </Shot>
              </Reveal>
            </div>
            <div>
              <SectionHead title="Your AI does the busywork">
                You bring the ideas. Formatting, titles, summaries, images and SEO are handled for you, and you stay in charge of what goes live.
              </SectionHead>
              <div className="mt-8 space-y-6">
                {EFFICIENT.map((f) => (
                  <div key={f.title}>
                    <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{f.body}</p>
                  </div>
                ))}
              </div>
              <StartCta signedIn={!!user} />
            </div>
          </div>
        </section>

        {/* Steps */}
        <section id="steps" className="wb-section border-t bg-muted/30">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal>
              <SectionHead center title="How to create a blog for free" />
            </Reveal>
            <ol className="wb-steps">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <Reveal delay={i * 70} className="h-full">
                    <span className="wb-steps__n">{i + 1}</span>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
            <div className="text-center">
              <StartCta signedIn={!!user} />
            </div>
          </div>
        </section>

        {/* Install */}
        <section id="connect" className="wb-section border-t">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_1.3fr]">
            <Reveal>
              <SectionHead title="Connect the free MCP server">
                Add this URL to your AI app. If you don&rsquo;t have an account yet, you&rsquo;ll create one in the sign-in window, then your AI can set up the blog for you.
              </SectionHead>
            </Reveal>
            <Reveal className="min-w-0" delay={120}>
              <div className="lp-shadow rounded-2xl bg-background p-5">
                <ClientTabs clients={clientInstructions(mcpUrl, config.appName)} />
              </div>
            </Reveal>
          </div>
        </section>

        {/* Example prompts */}
        <section id="prompt" className="wb-section border-t">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal>
              <SectionHead title="Not sure where to start?">
                Paste a starter into your AI once it&rsquo;s connected. It asks what it needs and builds from there.
              </SectionHead>
            </Reveal>
            <Reveal className="mt-10" delay={120}>
              <Examples appName={config.appName} rootDomain={config.rootDomain} />
            </Reveal>
          </div>
        </section>

        {/* Guides */}
        <section className="wb-section border-t">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal>
              <SectionHead title="Learn how to grow your blog" />
            </Reveal>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {articles.map((a, i) => (
                <Reveal key={a.slug} delay={i * 90} className="h-full">
                  <Link href={`/journal/${a.slug}`} className="wb-guide">
                    <div className="wb-guide__img">
                      <Image src={`/images/landing/${GUIDE_IMAGES[i % GUIDE_IMAGES.length]}.jpg`} alt="" fill sizes="(min-width: 768px) 360px, 100vw" className="object-cover" unoptimized />
                    </div>
                    <span>{a.category}</span>
                    <h3>{a.title}</h3>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="wb-section border-t">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <SectionHead title="FAQ" />
            </Reveal>
            <div className="divide-y border-y">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium [&::-webkit-details-marker]:hidden">
                    {q}
                    <span className="text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="mt-2 text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="wb-closing">
          <div className="mx-auto flex max-w-3xl flex-col items-center px-6 text-center">
            <h2 className="wb-h2">Your next good conversation is a post.</h2>
            <p className="mt-4 text-lg opacity-75">Free blog. Free MCP. Bring your own AI.</p>
            <div className="mt-8 w-full max-w-[34rem]">
              {user ? (
                <Link href="/dashboard" className="lp-cta">
                  Open dashboard <span className="lp-cta__arrow">→</span>
                </Link>
              ) : (
                <ClaimName rootDomain={config.rootDomain} signedIn={false} />
              )}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
