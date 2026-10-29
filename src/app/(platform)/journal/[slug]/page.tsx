import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
    <div className="min-h-screen bg-[#f7f8f2] text-[#172e25]">
      <header className="mx-auto flex max-w-5xl items-center justify-between border-b border-[#b8c4b7] px-6 py-6 text-sm">
        <Link href="/" className="font-semibold">✳ OpenPress Journal</Link>
        <Link href="/#connect">Start your own ↗</Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <article>
          <p className="font-mono text-xs uppercase tracking-widest text-[#39775a]">{article.category}</p>
          <h1 className="mt-6 text-5xl leading-[1.04] tracking-[-.05em] sm:text-7xl">{article.title}</h1>
          <p className="mt-6 text-xl leading-relaxed text-[#617065]">{article.description}</p>
          <p className="mt-6 border-b border-[#b8c4b7] pb-8 text-sm">OpenPress editorial · 2 min read</p>
          {article.sections.map((section) => <section key={section.title} className="mt-10"><h2 className="text-2xl font-medium tracking-tight">{section.title}</h2><p className="mt-4 text-lg leading-[1.8] text-[#46594c]">{section.body}</p></section>)}
        </article>
        <nav aria-label="More from the journal" className="mt-16 border-t border-[#b8c4b7] pt-8">
          <p className="mb-5 font-mono text-xs tracking-widest">KEEP READING</p>
          {articles.filter((item) => item.slug !== slug).map((item) => <Link className="block py-3 text-xl hover:underline" key={item.slug} href={`/journal/${item.slug}`}>{item.title} ↗</Link>)}
          <Link className="mt-8 inline-block text-sm underline" href="/docs/mcp">Connect your agent: the MCP guide</Link>
        </nav>
      </main>
    </div>
  );
}
