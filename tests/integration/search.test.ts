import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { generateMetadata as siteLayoutMetadata } from "@/app/site/[subdomain]/layout";
import { GET as keyFile } from "@/app/site/[subdomain]/indexnow-key.txt/route";
import { flushIndexNow, indexNowKey, INDEXNOW_ENDPOINT, pingIndexNow } from "@/server/indexnow";
import { createPost, deletePost, setPublished, updatePost } from "@/server/services/posts";
import { createSite, getSite, updateSiteSettings } from "@/server/services/sites";
import { makeUser } from "../helpers";

// The site layout is a Server Component module; vitest isn't a React server environment.
vi.mock("server-only", () => ({}));

const params = (subdomain: string) => ({ params: Promise.resolve({ subdomain }) });

describe("search engine discovery", () => {
  let actor: Awaited<ReturnType<typeof makeUser>>["actor"];
  let siteId: string;
  let sub: string;
  beforeAll(async () => {
    actor = (await makeUser("search")).actor;
    const site = await createSite(actor, { name: "Search Site" });
    siteId = site.id;
    sub = site.subdomain;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("serves a stable per-site IndexNow key on the site's own host", async () => {
    const res = await keyFile(new Request(`https://${sub}.folio.test/indexnow-key.txt`), params(sub) as never);
    expect(res.status).toBe(200);
    const key = await res.text();
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).toBe(await indexNowKey(sub));
    expect(key).not.toBe(await indexNowKey(`${sub}-other`));
    expect((await keyFile(new Request("https://nope.folio.test/indexnow-key.txt"), params("no-such-site") as never)).status).toBe(404);
  });

  it("builds a valid IndexNow submission and never throws on failure", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 202 }));
    expect(await pingIndexNow(sub, ["/blog/a", "/blog/a", "/"], fetchImpl as unknown as typeof fetch)).toBe(202);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(INDEXNOW_ENDPOINT);
    expect(JSON.parse(init.body as string)).toEqual({
      host: `${sub}.folio.test`,
      key: await indexNowKey(sub),
      keyLocation: `https://${sub}.folio.test/indexnow-key.txt`,
      urlList: [`https://${sub}.folio.test/blog/a`, `https://${sub}.folio.test/`],
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const failing = vi.fn(async () => {
      throw new Error("network down");
    });
    expect(await pingIndexNow(sub, ["/"], failing as unknown as typeof fetch)).toBeNull();
  });

  it("pings after publish, update and delete of live content, not for drafts", async () => {
    vi.stubEnv("INDEXNOW", "on");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(null, { status: 200 }));
    const submitted = () => fetchSpy.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)).urlList as string[]);
    const base = `https://${sub}.folio.test`;

    const p = await createPost(actor, { siteId, title: "Findable", content: "hello" });
    await updatePost(actor, p.id, { content: "draft edit" });
    await flushIndexNow();
    expect(fetchSpy).not.toHaveBeenCalled();

    await setPublished(actor, p.id, true);
    await flushIndexNow();
    expect(submitted().at(-1)).toEqual([`${base}/blog/findable`, `${base}/blog`, `${base}/`]);

    await updatePost(actor, p.id, { slug: "found" });
    await flushIndexNow();
    expect(submitted().at(-1)).toEqual([`${base}/blog/found`, `${base}/blog/findable`]);

    await deletePost(actor, p.id);
    await flushIndexNow();
    expect(submitted().at(-1)).toEqual([`${base}/blog/found`, `${base}/blog`, `${base}/`]);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("stores verification codes (bare or pasted meta tag) and renders them as meta tags", async () => {
    await updateSiteSettings(actor, siteId, {
      settings: { searchVerification: { google: '<meta name="google-site-verification" content="abc123_XYZ-def456" />', bing: "0123456789ABCDEF0123456789ABCDEF" } },
    });
    expect((await getSite(actor, siteId)).settings.searchVerification).toEqual({ google: "abc123_XYZ-def456", bing: "0123456789ABCDEF0123456789ABCDEF" });
    const meta = await siteLayoutMetadata(params(sub) as never);
    expect(meta.verification).toEqual({ google: "abc123_XYZ-def456", other: { "msvalidate.01": "0123456789ABCDEF0123456789ABCDEF" } });

    await expect(updateSiteSettings(actor, siteId, { settings: { searchVerification: { google: '"><script>alert(1)</script>' } } })).rejects.toThrow();

    await updateSiteSettings(actor, siteId, { settings: { searchVerification: { google: "", bing: "" } } });
    expect((await siteLayoutMetadata(params(sub) as never)).verification).toBeUndefined();
  });
});

