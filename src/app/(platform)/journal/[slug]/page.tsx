import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/app/brand";
import { config } from "@/lib/config";
import { articles } from "../articles";

export function generateStaticParams() { return articles.map(({ slug }) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = articles.find((item) => item.slug === slug);
  return article ? { title: article.title, description: article.description } : { title: "Story not found" };
}

export default async function JournalArticle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = articles.find((item) => item.slug === slug);
  if (!article) notFound();
  return (
    <PublicShell>
      <main className="mx-auto max-w-3xl px-6 pt-14 pb-24 sm:pt-20">
        <article>
          <p className="op-kicker">{article.category}</p>
          <h1 className="mt-4 text-[clamp(38px,6vw,64px)] leading-[1.02] font-bold tracking-[-.045em] text-balance">{article.title}</h1>
          <p className="mt-6 text-xl leading-relaxed text-pretty text-muted-foreground">{article.description}</p>
          <p className="mt-6 border-b pb-8 text-sm text-muted-foreground">{config.appName} guides · 2 min read</p>
          {article.sections.map((section) => (
            <section key={section.title} className="mt-12">
              <h2 className="text-2xl font-semibold tracking-tight">{section.title}</h2>
              <p className="mt-4 text-lg leading-[1.75] text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </article>
        <nav aria-label="More from the journal" className="mt-16 border-t pt-10">
          <h2 className="op-h2">Keep reading</h2>
          <div className="op-card mt-5 divide-y">
            {articles
              .filter((item) => item.slug !== slug)
              .map((item) => (
                <Link className="group flex items-center justify-between gap-4 px-5 py-4" key={item.slug} href={`/journal/${item.slug}`}>
                  <span className="text-lg font-semibold tracking-tight group-hover:underline group-hover:underline-offset-4">{item.title}</span>
                  <span className="text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden>→</span>
                </Link>
              ))}
          </div>
          <Link className="lp-cta mt-10" href="/docs/mcp">
            Connect your agent <span className="lp-cta__arrow">→</span>
          </Link>
        </nav>
      </main>
    </PublicShell>
  );
}
