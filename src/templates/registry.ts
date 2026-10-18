import { z } from "zod";
import type { Theme } from "@/lib/theme";

const url = z
  .string()
  .max(2000)
  .refine((v) => /^https?:\/\//i.test(v) || /^\/(?!\/)/.test(v) || /^mailto:/i.test(v), "Must be an http(s) URL, mailto:, or a site path starting with /");

/** Structured, template-agnostic site content. Rendered as text, never as HTML. */
export const siteSettingsSchema = z.object({
  hero: z
    .object({
      headline: z.string().max(160).optional(),
      subheadline: z.string().max(400).optional(),
      ctaLabel: z.string().max(40).optional(),
      ctaUrl: url.optional(),
      secondaryCtaLabel: z.string().max(40).optional(),
      secondaryCtaUrl: url.optional(),
      imageUrl: url.optional(),
    })
    .optional(),
  features: z.array(z.object({ title: z.string().max(80), body: z.string().max(400) })).max(12).optional(),
  projects: z
    .array(
      z.object({
        title: z.string().max(100),
        description: z.string().max(500).optional(),
        url: url.optional(),
        imageUrl: url.optional(),
        tags: z.array(z.string().max(30)).max(8).optional(),
      }),
    )
    .max(24)
    .optional(),
  about: z.string().max(4000).optional().describe("Short bio / about blurb (Markdown) shown on the homepage of personal sites"),
  socialLinks: z.array(z.object({ label: z.string().max(40), url })).max(10).optional(),
  footerText: z.string().max(300).optional(),
  postsPerPage: z.number().int().min(1).max(50).optional(),
  showPostsOnHome: z.boolean().optional(),
});
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export type TemplateDef = {
  id: string;
  name: string;
  description: string;
  bestFor: string[];
  theme: Theme;
  settings: (siteName: string) => SiteSettings;
  nav: { header: { label: string; href: string }[]; footer: { label: string; href: string }[] };
};

export const TEMPLATES: Record<string, TemplateDef> = {
  editorial: {
    id: "editorial",
    name: "Editorial",
    description: "A minimal, typography-first blog. Serif headings, generous whitespace, reading-optimized line length.",
    bestFor: ["blog", "newsletter", "essays", "personal writing"],
    theme: {
      primaryColor: "#b4441f",
      secondaryColor: "#f4efe8",
      headingFont: "serif",
      bodyFont: "serif",
      baseFontSize: 18,
      headerStyle: "centered",
      footerStyle: "minimal",
      contentWidth: "narrow",
      layout: "single-column",
      buttonStyle: "rounded",
      colorMode: "auto",
    },
    settings: () => ({ showPostsOnHome: true, postsPerPage: 10 }),
    nav: { header: [{ label: "Home", href: "/" }, { label: "Archive", href: "/blog" }], footer: [{ label: "RSS", href: "/rss.xml" }] },
  },
  saas: {
    id: "saas",
    name: "Launch",
    description: "A modern product landing page: hero with calls to action, feature grid, and a blog for updates.",
    bestFor: ["startup", "SaaS", "product launch", "company website", "landing page"],
    theme: {
      primaryColor: "#4f46e5",
      secondaryColor: "#eef2ff",
      headingFont: "sans",
      bodyFont: "sans",
      baseFontSize: 16,
      headerStyle: "split",
      footerStyle: "columns",
      contentWidth: "wide",
      layout: "grid",
      buttonStyle: "rounded",
      colorMode: "light",
    },
    settings: (name) => ({
      hero: {
        headline: name,
        subheadline: "Describe what you do in one clear sentence.",
        ctaLabel: "Get started",
        ctaUrl: "/blog",
      },
      features: [
        { title: "Fast", body: "Explain the first reason customers choose you." },
        { title: "Simple", body: "Explain the second reason." },
        { title: "Reliable", body: "Explain the third reason." },
      ],
      showPostsOnHome: true,
      postsPerPage: 9,
    }),
    nav: { header: [{ label: "Product", href: "/" }, { label: "Blog", href: "/blog" }], footer: [{ label: "Blog", href: "/blog" }, { label: "RSS", href: "/rss.xml" }] },
  },
  portfolio: {
    id: "portfolio",
    name: "Portfolio",
    description: "A personal site with an intro, selected projects grid, and writing. Clean sans-serif, works for designers, engineers and creatives.",
    bestFor: ["portfolio", "personal website", "resume", "freelancer"],
    theme: {
      primaryColor: "#0f766e",
      secondaryColor: "#f0fdfa",
      headingFont: "geometric",
      bodyFont: "sans",
      baseFontSize: 17,
      headerStyle: "minimal",
      footerStyle: "simple",
      contentWidth: "medium",
      layout: "grid",
      buttonStyle: "pill",
      colorMode: "auto",
    },
    settings: (name) => ({
      hero: { headline: `Hi, I'm ${name}.`, subheadline: "A short line about what you make and what you care about." },
      projects: [],
      showPostsOnHome: true,
      postsPerPage: 6,
    }),
    nav: { header: [{ label: "Work", href: "/" }, { label: "Writing", href: "/blog" }], footer: [{ label: "RSS", href: "/rss.xml" }] },
  },
};

export const TEMPLATE_IDS = Object.keys(TEMPLATES) as [string, ...string[]];
export const templateIdSchema = z.enum(TEMPLATE_IDS);

export function getTemplate(id: string): TemplateDef {
  return TEMPLATES[id] ?? TEMPLATES.editorial;
}

export function parseSettings(raw: unknown): SiteSettings {
  const r = siteSettingsSchema.safeParse(raw ?? {});
  return r.success ? r.data : {};
}
