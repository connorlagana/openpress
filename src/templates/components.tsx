import type { ReactNode } from "react";
import { config } from "@/lib/config";
import { renderMarkdown } from "@/lib/markdown";
import type { PublicPost, PublicSite } from "@/server/public/data";
import { ChartEnhancer } from "./chart-enhancer";

// Shared building blocks for public site templates. Everything user- or
// agent-supplied is rendered as text, except post bodies, which are sanitized
// at write time (see lib/markdown.ts), plus charts OpenPress draws itself from
// validated data at read time (lib/charts/render.ts).

const dateFmt = (d: Date | null, lang: string) =>
  d ? new Intl.DateTimeFormat(lang, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(d) : "";

export function readingMinutes(md: string) {
  return Math.max(1, Math.round(md.split(/\s+/).length / 230));
}

export function SiteHeader({ site, path }: { site: PublicSite; path: string }) {
  const style = site.theme.headerStyle;
  const cta = site.template === "saas" ? site.settingsParsed.hero : undefined;
  return (
    <header className={`fs-header fs-header-${style}`}>
      <div className="fs-container-wide fs-header-inner">
        <a className="fs-brand" href="/">
          {site.logoUrl ? <img src={site.logoUrl} alt="" width={32} height={32} /> : null}
          <span>{site.name}</span>
        </a>
        {style === "centered" && site.tagline ? <p className="fs-tagline">{site.tagline}</p> : null}
        {site.nav.header.length ? (
          <nav className="fs-nav" aria-label="Main">
            {site.nav.header.map((n) => (
              <a key={n.href + n.label} href={n.href} aria-current={n.href === path ? "page" : undefined}>
                {n.label}
              </a>
            ))}
          </nav>
        ) : null}
        {style === "split" ? (
          <div className="fs-header-cta">
            {cta?.ctaLabel && cta.ctaUrl ? (
              <a className="fs-btn fs-btn-sm" href={cta.ctaUrl}>
                {cta.ctaLabel}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function SiteFooter({ site }: { site: PublicSite }) {
  const s = site.settingsParsed;
  const year = new Date().getUTCFullYear();
  const style = site.theme.footerStyle;
  return (
    <footer className={`fs-footer fs-footer-${style}`}>
      <div className="fs-container-wide fs-footer-inner">
        <div>
          <div>{s.footerText ?? `© ${year} ${site.name}`}</div>
          {style === "columns" && site.description ? <p style={{ marginTop: "0.5rem", maxWidth: "32rem" }}>{site.description}</p> : null}
        </div>
        {site.nav.footer.length ? (
          <nav className="fs-nav fs-footer-nav" aria-label="Footer">
            {site.nav.footer.map((n) => (
              <a key={n.href + n.label} href={n.href}>
                {n.label}
              </a>
            ))}
          </nav>
        ) : null}
        {s.socialLinks?.length ? (
          <nav className="fs-nav fs-footer-nav" aria-label="Social">
            {s.socialLinks.map((l) => (
              <a key={l.url} href={l.url} rel="me noopener">
                {l.label}
              </a>
            ))}
          </nav>
        ) : null}
        <div className="fs-powered">
          {/* Attributed so visitors who follow it land on a page about this site (see the landing page's ref banner). */}
          <a href={`${config.appUrl}/?ref=${site.subdomain}&utm_source=site&utm_medium=footer`}>Published with {config.appName}</a>
        </div>
      </div>
    </footer>
  );
}

function PostMeta({ post, lang }: { post: PublicPost; lang: string }) {
  return (
    <div className="fs-meta">
      <time dateTime={post.publishedAt?.toISOString()}>{dateFmt(post.publishedAt, lang)}</time>
      <span>{readingMinutes(post.contentMd)} min read</span>
    </div>
  );
}

export function PostList({ site, posts, layout }: { site: PublicSite; posts: PublicPost[]; layout?: "single-column" | "sidebar" | "grid" }) {
  if (!posts.length) return <p className="fs-empty">No posts yet.</p>;
  const mode = layout ?? site.theme.layout;
  if (mode === "grid") {
    return (
      <ul className="fs-grid">
        {posts.map((p) => (
          <li key={p.id} className="fs-card">
            {p.coverUrl ? (
              <div className="fs-card-media">
                <img src={p.coverUrl} alt={p.coverAlt ?? ""} loading="lazy" width={p.coverWidth ?? undefined} height={p.coverHeight ?? undefined} />
              </div>
            ) : null}
            <div className="fs-card-body">
              <h3>
                <a href={`/blog/${p.slug}`}>{p.title}</a>
              </h3>
              {p.excerpt ? <p className="fs-excerpt">{p.excerpt}</p> : null}
              <PostMeta post={p} lang={site.language} />
            </div>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="fs-list">
      {posts.map((p) => (
        <li key={p.id} className="fs-list-item">
          <PostMeta post={p} lang={site.language} />
          <h2>
            <a href={`/blog/${p.slug}`}>{p.title}</a>
          </h2>
          {p.excerpt ? <p className="fs-excerpt">{p.excerpt}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export function WithSidebar({ site, children }: { site: PublicSite; children: ReactNode }) {
  if (site.theme.layout !== "sidebar") return <>{children}</>;
  return (
    <div className="fs-with-sidebar">
      <div>{children}</div>
      <aside className="fs-sidebar">
        <h2 className="fs-section-title">About</h2>
        <p>{site.description ?? site.tagline ?? site.name}</p>
        <p>
          <a href="/rss.xml">Subscribe via RSS</a>
        </p>
      </aside>
    </div>
  );
}

export function Article({ site, post }: { site: PublicSite; post: PublicPost }) {
  const isPost = post.kind === "post";
  return (
    <article>
      <header className="fs-article-header">
        {isPost ? <PostMeta post={post} lang={site.language} /> : null}
        <h1>{post.title}</h1>
        {isPost && post.authorName ? <div className="fs-meta">By {post.authorName}</div> : null}
      </header>
      {post.coverUrl ? (
        <figure className="fs-article-cover">
          <img src={post.coverUrl} alt={post.coverAlt ?? ""} width={post.coverWidth ?? undefined} height={post.coverHeight ?? undefined} fetchPriority="high" />
        </figure>
      ) : null}
      {/* contentHtml is sanitized with an allow-list when saved. */}
      <div className="fs-prose" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
      {/* Charts are drawn by OpenPress from validated data (lib/charts/render.ts) and enhanced on the client. */}
      {post.contentHtml.includes('class="op-chart"') ? <ChartEnhancer /> : null}
      {isPost ? (
        <footer className="fs-article-footer">
          {post.tags.length ? (
            <ul className="fs-tags" aria-label="Tags">
              {post.tags.map((t) => (
                <li key={t}>
                  <a className="fs-tag" href={`/blog?tag=${encodeURIComponent(t)}`}>
                    {t}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <span />
          )}
          <a href="/blog">← All posts</a>
        </footer>
      ) : null}
    </article>
  );
}

/* ---------------- Template homepages ---------------- */

export function EditorialHome({ site, posts }: { site: PublicSite; posts: PublicPost[] }) {
  return (
    <div className={site.theme.layout === "grid" ? "fs-container-wide" : "fs-container"}>
      <WithSidebar site={site}>
        {site.settingsParsed.hero?.headline ? (
          <section className="fs-article-header">
            <h1>{site.settingsParsed.hero.headline}</h1>
            {site.settingsParsed.hero.subheadline ? <p className="fs-excerpt">{site.settingsParsed.hero.subheadline}</p> : null}
          </section>
        ) : null}
        <h2 className="fs-section-title">Latest</h2>
        <PostList site={site} posts={posts} />
        {posts.length ? (
          <div className="fs-pagination">
            <span />
            <a href="/blog">Archive →</a>
          </div>
        ) : null}
      </WithSidebar>
    </div>
  );
}

export function SaasHome({ site, posts }: { site: PublicSite; posts: PublicPost[] }) {
  const s = site.settingsParsed;
  const hero = s.hero ?? {};
  return (
    <>
      <section className="fs-container-wide fs-hero">
        <h1>{hero.headline ?? site.name}</h1>
        {hero.subheadline ?? site.tagline ? <p>{hero.subheadline ?? site.tagline}</p> : null}
        <div className={`fs-hero-actions ${site.theme.buttonStyle === "outline" ? "fs-btn-outline" : ""}`}>
          {hero.ctaLabel && hero.ctaUrl ? (
            <a className="fs-btn" href={hero.ctaUrl}>
              {hero.ctaLabel}
            </a>
          ) : null}
          {hero.secondaryCtaLabel && hero.secondaryCtaUrl ? (
            <a className="fs-btn fs-btn-secondary" href={hero.secondaryCtaUrl}>
              {hero.secondaryCtaLabel}
            </a>
          ) : null}
        </div>
        {hero.imageUrl ? (
          <div className="fs-hero-image">
            <img src={hero.imageUrl} alt="" />
          </div>
        ) : null}
      </section>
      {s.features?.length ? (
        <section className="fs-band" aria-label="Features">
          <div className="fs-container-wide fs-features">
            {s.features.map((f) => (
              <div className="fs-feature" key={f.title}>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {s.showPostsOnHome !== false && posts.length ? (
        <section className="fs-container-wide" style={{ paddingTop: "4rem" }}>
          <h2 className="fs-section-title">From the blog</h2>
          <PostList site={site} posts={posts.slice(0, 6)} layout="grid" />
        </section>
      ) : null}
    </>
  );
}

export function PortfolioHome({ site, posts }: { site: PublicSite; posts: PublicPost[] }) {
  const s = site.settingsParsed;
  return (
    <div className="fs-container-wide">
      <section className="fs-intro">
        <h1>{s.hero?.headline ?? site.name}</h1>
        {s.hero?.subheadline ?? site.tagline ? <p>{s.hero?.subheadline ?? site.tagline}</p> : null}
        {s.about ? <div className="fs-prose" style={{ maxWidth: "40rem", marginTop: "1.5rem" }} dangerouslySetInnerHTML={{ __html: renderMarkdown(s.about) }} /> : null}
        {s.socialLinks?.length ? (
          <div className="fs-social">
            {s.socialLinks.map((l) => (
              <a key={l.url} href={l.url} rel="me noopener">
                {l.label}
              </a>
            ))}
          </div>
        ) : null}
      </section>
      {s.projects?.length ? (
        <section className="fs-projects" aria-label="Selected work">
          <h2 className="fs-section-title">Selected work</h2>
          <ul className="fs-grid">
            {s.projects.map((p) => (
              <li key={p.title} className="fs-card">
                {p.imageUrl ? (
                  <div className="fs-card-media">
                    <img src={p.imageUrl} alt="" loading="lazy" />
                  </div>
                ) : null}
                <div className="fs-card-body">
                  <h3>{p.url ? <a href={p.url}>{p.title}</a> : p.title}</h3>
                  {p.description ? <p className="fs-excerpt">{p.description}</p> : null}
                  {p.tags?.length ? (
                    <ul className="fs-tags">
                      {p.tags.map((t) => (
                        <li key={t} className="fs-tag">
                          {t}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {s.showPostsOnHome !== false ? (
        <section>
          <h2 className="fs-section-title">Writing</h2>
          <PostList site={site} posts={posts} layout="single-column" />
        </section>
      ) : null}
    </div>
  );
}

export const HOMEPAGES = { editorial: EditorialHome, saas: SaasHome, portfolio: PortfolioHome } as const;
