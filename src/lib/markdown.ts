import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";

const marked = new Marked({ gfm: true, breaks: false, async: false });

// Allow-list only. No scripts, iframes, forms, inline event handlers, style
// attributes or SVG: agent- and user-supplied content is untrusted.
const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "blockquote", "pre", "code", "em", "strong", "del", "s",
    "ul", "ol", "li", "a", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "sup", "sub",
    "kbd", "mark", "details", "summary", "input",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    code: ["class"],
    th: ["align"],
    td: ["align"],
    ol: ["start"],
    input: ["type", "checked", "disabled"],
  },
  allowedClasses: { code: [/^language-[a-z0-9+#-]+$/] },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  exclusiveFilter: (frame) => frame.tag === "input" && frame.attribs.type !== "checkbox",
  transformTags: {
    a: (tagName, attribs) => {
      const external = /^https?:\/\//i.test(attribs.href ?? "");
      return {
        tagName,
        attribs: external ? { ...attribs, rel: "noopener noreferrer nofollow ugc", target: "_blank" } : { ...attribs, rel: attribs.rel ?? "" },
      };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
    input: (tagName, attribs) => ({ tagName, attribs: { ...attribs, disabled: "" } }),
  },
};

export function sanitize(html: string): string {
  return sanitizeHtml(html, SANITIZE);
}

/** Markdown (with optional inline HTML) -> sanitized HTML safe to render. */
export function renderMarkdown(md: string): string {
  return sanitize(marked.parse(md) as string);
}

/** Plain-text excerpt for meta descriptions and listings. */
export function plainText(md: string, max = 160): string {
  const text = sanitizeHtml(marked.parse(md) as string, { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(" ") > max * 0.6 ? cut.lastIndexOf(" ") : cut.length) + "…";
}
