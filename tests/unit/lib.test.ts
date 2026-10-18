import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { sniffImage } from "@/lib/image";
import { plainText, renderMarkdown } from "@/lib/markdown";
import { slugify, uniqueSlug } from "@/lib/slug";
import { resolveTheme, themeSchema } from "@/lib/theme";
import { categorizeReferrer } from "@/server/services/analytics";
import { isForbiddenHost } from "@/server/services/media";
import { TEMPLATES } from "@/templates/registry";

describe("markdown sanitization (XSS)", () => {
  const cases: [string, RegExp][] = [
    ["<script>alert(1)</script>", /<script/i],
    ['<img src=x onerror="alert(1)">', /onerror/i],
    ["[click](javascript:alert(1))", /javascript:/i],
    ['<a href="data:text/html,<script>alert(1)</script>">x</a>', /data:/i],
    ['<iframe src="https://evil.example"></iframe>', /<iframe/i],
    ['<svg onload="alert(1)"><circle/></svg>', /<svg|onload/i],
    ['<div style="background:url(javascript:alert(1))">x</div>', /style=/i],
    ['<form action="https://evil"><input name="password"></form>', /<form|name="password"/i],
    ["<style>body{display:none}</style>", /<style/i],
    ['<a href="//evil.example">x</a>', /href="\/\/evil/i],
    ['<meta http-equiv="refresh" content="0;url=https://evil">', /<meta/i],
  ];
  it.each(cases)("strips %s", (input, bad) => {
    expect(renderMarkdown(input)).not.toMatch(bad);
  });

  it("keeps normal formatting and hardens external links", () => {
    const html = renderMarkdown("## Hi\n\n**bold** [ext](https://example.com) [int](/about)\n\n```ts\nconst a = 1;\n```\n\n![alt](https://img.example/a.png)");
    expect(html).toContain("<h2>Hi</h2>");
    expect(html).toContain('rel="noopener noreferrer nofollow ugc"');
    expect(html).toContain('href="/about"');
    expect(html).toContain('class="language-ts"');
    expect(html).toContain('loading="lazy"');
  });

  it("builds excerpts from paragraphs only", () => {
    expect(plainText("Intro text here.\n\n## Heading\n\n- list item")).toBe("Intro text here.");
    expect(plainText("word ".repeat(100), 50).length).toBeLessThanOrEqual(50);
  });
});

describe("slugs", () => {
  it("slugifies", () => {
    expect(slugify("Will AI Replace Software Engineers?")).toBe("will-ai-replace-software-engineers");
    expect(slugify("Crème Brûlée — it's great")).toBe("creme-brulee-its-great");
    expect(slugify("!!!")).toBe("untitled");
  });
  it("resolves collisions", () => {
    expect(uniqueSlug("a", new Set())).toBe("a");
    expect(uniqueSlug("a", new Set(["a", "a-2"]))).toBe("a-3");
  });
});

describe("image validation by magic bytes", () => {
  const png = Uint8Array.from(Buffer.from("89504e470d0a1a0a0000000d494844520000002000000010080600000000", "hex"));
  it("detects PNG and its size", () => expect(sniffImage(png)).toMatchObject({ mime: "image/png", width: 32, height: 16 }));
  it("detects GIF", () => expect(sniffImage(new TextEncoder().encode("GIF89a\x0a\x00\x05\x00"))?.mime).toBe("image/gif"));
  it("rejects SVG, HTML and text even if named .png", () => {
    expect(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffImage(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe("SSRF guard", () => {
  it.each(["localhost", "127.0.0.1", "10.0.0.5", "192.168.1.1", "172.16.0.1", "169.254.169.254", "[::1]", "metadata.google.internal", "2130706433", "0x7f000001", "foo.localhost", "100.64.0.1"])(
    "blocks %s",
    (h) => expect(isForbiddenHost(h)).toBe(true),
  );
  it("allows public hosts", () => {
    expect(isForbiddenHost("images.unsplash.com")).toBe(false);
    expect(isForbiddenHost("8.8.8.8")).toBe(false);
  });
});

describe("themes", () => {
  it("every template default theme is valid", () => {
    for (const t of Object.values(TEMPLATES)) expect(themeSchema.safeParse(t.theme).success).toBe(true);
  });
  it("drops invalid stored values but keeps valid ones", () => {
    const t = resolveTheme(TEMPLATES.editorial.theme, { primaryColor: "red", headerStyle: "split" });
    expect(t.primaryColor).toBe(TEMPLATES.editorial.theme.primaryColor);
    expect(t.headerStyle).toBe("split");
  });
});

describe("analytics referrers", () => {
  it("categorizes", () => {
    expect(categorizeReferrer(null, "a.folio.test").category).toBe("direct");
    expect(categorizeReferrer("https://www.google.com/", "a.folio.test").category).toBe("search");
    expect(categorizeReferrer("https://chatgpt.com/", "a.folio.test").category).toBe("ai");
    expect(categorizeReferrer("https://t.co/x", "a.folio.test").category).toBe("social");
    expect(categorizeReferrer("https://a.folio.test/blog", "a.folio.test").category).toBe("internal");
    expect(categorizeReferrer("https://someblog.dev/", "a.folio.test")).toEqual({ host: "someblog.dev", category: "other" });
  });
});

describe("passwords", () => {
  it("hashes and verifies", async () => {
    const h = await hashPassword("correct horse");
    expect(h).toMatch(/^pbkdf2-sha256\$/);
    expect(await verifyPassword("correct horse", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
});
