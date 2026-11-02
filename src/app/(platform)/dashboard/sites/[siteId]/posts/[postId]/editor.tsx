"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { StatusDot } from "@/components/app/bits";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { deletePostAction, previewMarkdownAction, savePostAction, setPublishedAction, type EditorInput } from "../../../../actions";
import "@/lib/charts/chart.css";

type Post = {
  id: string;
  siteId: string;
  kind: "post" | "page";
  title: string;
  slug: string;
  status: "draft" | "published";
  url: string;
  path: string;
  isLive: boolean;
  excerpt: string | null;
  tags: string[];
  coverMediaId: string | null;
  authorName: string | null;
  content?: string;
  seo: { seoTitle: string | null; seoDescription: string | null; canonicalUrl: string | null; noindex: boolean };
};

function initial(p: Post): EditorInput {
  return {
    title: p.title,
    content: p.content ?? "",
    slug: p.slug,
    excerpt: p.excerpt ?? "",
    tags: p.tags.join(", "),
    coverMediaId: p.coverMediaId ?? "",
    authorName: p.authorName ?? "",
    seoTitle: p.seo.seoTitle ?? "",
    seoDescription: p.seo.seoDescription ?? "",
    canonicalUrl: p.seo.canonicalUrl ?? "",
    noindex: p.seo.noindex,
  };
}

export function Editor({ post, media }: { post: Post; media: { id: string; url: string; alt: string | null; filename: string }[] }) {
  const router = useRouter();
  const [saved, setSaved] = useState(() => initial(post));
  const [form, setForm] = useState(saved);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [preview, setPreview] = useState("");
  const [pending, start] = useTransition();
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);
  const set = <K extends keyof EditorInput>(k: K, v: EditorInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const backHref = `/dashboard/sites/${post.siteId}${post.kind === "page" ? "/pages" : ""}`;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (tab !== "preview") return;
    let alive = true;
    previewMarkdownAction(form.content, post.siteId).then((html) => alive && setPreview(html));
    return () => {
      alive = false;
    };
  }, [tab, form.content, post.siteId]);

  async function save(): Promise<boolean> {
    const res = await savePostAction(post.id, form);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    const next = { ...form, slug: res.data!.slug };
    setForm(next);
    setSaved(next);
    return true;
  }

  return (
    <form
      className="grid grid-cols-1 gap-8 *:min-w-0 lg:grid-cols-[minmax(0,1fr)_300px]"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          if (await save()) {
            toast.success(post.isLive ? "Saved. Changes are live." : "Draft saved");
            router.refresh();
          }
        });
      }}
    >
      <div className="min-w-0 space-y-4">
        <div className="flex items-center gap-3 text-sm">
          <Link href={backHref} className="text-muted-foreground hover:text-foreground">
            ← {post.kind === "page" ? "Pages" : "Posts"}
          </Link>
          <StatusDot live={post.isLive} />
          {dirty ? <span className="text-xs text-muted-foreground">Unsaved changes</span> : null}
        </div>
        <label htmlFor="title" className="sr-only">
          Title
        </label>
        <input
          id="title"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          className="w-full bg-transparent text-2xl font-bold sm:text-3xl tracking-[-.03em] outline-none placeholder:text-muted-foreground/50"
          placeholder="Title"
          maxLength={200}
          required
        />
        <div className="op-card overflow-hidden">
          <div className="flex items-center gap-1 border-b px-2 py-1.5" role="tablist">
            {(["write", "preview"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn("rounded-full px-3 py-1 text-sm capitalize", tab === t ? "bg-foreground/[.07] font-medium" : "text-muted-foreground hover:text-foreground")}
              >
                {t}
              </button>
            ))}
            <span className="ml-auto pr-2 text-xs text-muted-foreground">Markdown</span>
          </div>
          {tab === "write" ? (
            <Textarea
              aria-label="Content"
              value={form.content}
              onChange={(e) => set("content", e.target.value)}
              className="min-h-[55vh] resize-y rounded-none border-0 font-mono text-[13.5px] leading-relaxed shadow-none focus-visible:ring-0"
              placeholder={"Write in Markdown…\n\n## A heading\n\nSome **bold** text and a [link](https://example.com)."}
            />
          ) : (
            <div className="prose-preview min-h-[55vh] px-5 py-4" dangerouslySetInnerHTML={{ __html: preview || "<p class='text-muted-foreground'>Nothing to preview.</p>" }} />
          )}
        </div>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
        <div className="space-y-2">
          <Button type="submit" className="w-full" disabled={pending || !dirty}>
            {pending ? "Saving…" : post.isLive ? "Update" : "Save draft"}
          </Button>
          <Button
            type="button"
            variant={post.isLive ? "outline" : "secondary"}
            className="w-full"
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (dirty && !(await save())) return;
                const res = await setPublishedAction(post.id, !post.isLive);
                if (!res.ok) return void toast.error(res.error);
                toast.success(res.data!.isLive ? "Published" : "Unpublished", res.data!.isLive ? { description: res.data!.url } : undefined);
                router.refresh();
              })
            }
          >
            {post.isLive ? "Unpublish" : "Publish"}
          </Button>
          {post.isLive ? (
            <a href={post.url} target="_blank" rel="noreferrer" className="block truncate text-center font-mono text-xs text-muted-foreground hover:text-foreground">
              {post.url.replace(/^https?:\/\//, "")} ↗
            </a>
          ) : null}
        </div>

        <Field label="URL slug" htmlFor="slug" hint={post.isLive ? "Changing it adds a 301 redirect from the old URL." : undefined}>
          <Input id="slug" value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} className="font-mono text-xs" />
        </Field>
        <Field label="Excerpt" htmlFor="excerpt">
          <Textarea id="excerpt" value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} rows={3} maxLength={400} />
        </Field>
        {post.kind === "post" ? (
          <>
            <Field label="Tags" htmlFor="tags" hint="Comma separated">
              <Input id="tags" value={form.tags} onChange={(e) => set("tags", e.target.value)} />
            </Field>
            <Field label="Author" htmlFor="author">
              <Input id="author" value={form.authorName} onChange={(e) => set("authorName", e.target.value)} />
            </Field>
          </>
        ) : null}
        <Field label="Cover image" htmlFor="cover" hint={media.length ? undefined : "Upload images in the Media tab."}>
          <select id="cover" value={form.coverMediaId} onChange={(e) => set("coverMediaId", e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm">
            <option value="">None</option>
            {media.map((m) => (
              <option key={m.id} value={m.id}>
                {m.alt || m.filename}
              </option>
            ))}
          </select>
        </Field>

        <details className="group rounded-lg border px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">Search & social</summary>
          <div className="mt-3 space-y-4 pb-1">
            <Field label="SEO title" htmlFor="seoTitle" hint={`${(form.seoTitle || form.title).length}/60`}>
              <Input id="seoTitle" value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} placeholder={form.title} maxLength={70} />
            </Field>
            <Field label="Meta description" htmlFor="seoDescription" hint={`${form.seoDescription.length}/160`}>
              <Textarea id="seoDescription" value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} rows={3} maxLength={200} placeholder={form.excerpt} />
            </Field>
            <Field label="Canonical URL" htmlFor="canonical" hint="Only if first published elsewhere">
              <Input id="canonical" value={form.canonicalUrl} onChange={(e) => set("canonicalUrl", e.target.value)} placeholder="https://" />
            </Field>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="noindex" className="font-normal">
                Hide from search engines
              </Label>
              <Switch id="noindex" checked={form.noindex} onCheckedChange={(v) => set("noindex", v)} />
            </div>
          </div>
        </details>

        <AlertDialog>
          <AlertDialogTrigger render={<Button type="button" variant="ghost" size="sm" className="text-destructive" />}>Delete {post.kind}</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{post.title}”?</AlertDialogTitle>
              <AlertDialogDescription>{post.isLive ? "It will be removed from your live site immediately." : "This draft will be removed."}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() =>
                  start(async () => {
                    const res = await deletePostAction(post.siteId, post.id, post.kind);
                    if (res && !res.ok) toast.error(res.error);
                  })
                }
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </aside>
    </form>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor} className="shrink-0">
          {label}
        </Label>
        {hint ? <span className="text-right text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
