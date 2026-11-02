import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { GET as rss } from "@/app/site/[subdomain]/rss.xml/route";
import { withUser } from "@/db/client";
import { charts } from "@/db/schema";
import { getPublishedPost, withCharts } from "@/server/public/data";
import { createChart, getChart, previewPostHtml, updateChart } from "@/server/services/charts";
import { createPost } from "@/server/services/posts";
import { createSite } from "@/server/services/sites";
import { call, connectWithApiKey, makeUser } from "../helpers";

const allen = {
  type: "line",
  title: "Josh Allen's Development",
  subtitle: "Completion percentage · Wyoming and Buffalo Bills",
  labels: ["2017 College", "2018 NFL", "2019 NFL", "2020 NFL"],
  series: [{ name: "Completion %", data: [56.3, 52.8, 58.8, 69.2] }],
  valueFormat: { suffix: "%", decimals: 1 },
};

describe("charts over MCP", () => {
  it("creates a chart, embeds it in a post, and updates it without editing the post", async () => {
    const { user } = await makeUser("charts");
    const { client } = await connectWithApiKey(user.id);
    const site = (await call(client, "create_site", { name: "Bills Notebook" })).structuredContent!.site;

    const created = await call(client, "create_chart", { siteId: site.subdomain, ...allen });
    expect(created.isError).toBeFalsy();
    const chart = created.structuredContent!.chart;
    expect(chart.embed).toBe(`{{chart:${chart.id}}}`);
    expect(chart.type).toBe("line");

    const post = (
      await call(client, "create_post", { siteId: site.id, title: "The leap", content: `Year three changed everything.\n\n${chart.embed}\n\nMore below.` })
    ).structuredContent!.post;
    await call(client, "publish_post", { postId: post.id });

    let live = await getPublishedPost(site.subdomain, "post", post.slug);
    expect(live!.post.contentHtml).toContain(`<figure class="op-chart" data-chart="${chart.id}"`);
    expect(live!.post.contentHtml).toContain("<svg");
    expect(live!.post.contentHtml).toContain("69.2%"); // data table
    expect(live!.post.contentHtml).not.toContain("{{chart:");

    const got = await call(client, "get_chart", { chartId: chart.id });
    expect(got.structuredContent!.chart.spec.labels).toEqual(allen.labels);
    expect(got.structuredContent!.chart.usedIn).toEqual([expect.objectContaining({ id: post.id, status: "published", url: post.url.replace(/\/blog\/.*/, `/blog/${post.slug}`) })]);

    const updated = await call(client, "update_chart", {
      chartId: chart.id,
      labels: [...allen.labels, "2021 NFL"],
      series: [{ name: "Completion %", data: [...allen.series[0].data, 63.3] }],
      subtitle: null,
    });
    expect(updated.isError).toBeFalsy();
    expect(updated.structuredContent!.chart.spec.subtitle).toBeUndefined();
    live = await getPublishedPost(site.subdomain, "post", post.slug);
    expect(live!.post.contentHtml).toContain("2021 NFL");
    expect(live!.post.contentHtml).toContain("63.3%");

    const listed = await call(client, "list_charts", { siteId: site.id });
    expect(listed.structuredContent!.items.map((c: { id: string }) => c.id)).toEqual([chart.id]);
  });

  it("returns actionable validation errors", async () => {
    const { user } = await makeUser("charts-bad");
    const { client } = await connectWithApiKey(user.id);
    const site = (await call(client, "create_site", { name: "Bad Data" })).structuredContent!.site;

    const mismatch = await call(client, "create_chart", { siteId: site.id, ...allen, series: [{ name: "x", data: [1, 2] }] });
    expect(mismatch.isError).toBe(true);
    expect(mismatch.structuredContent!.error.message).toContain("one value per label");

    const chart = (await call(client, "create_chart", { siteId: site.id, ...allen })).structuredContent!.chart;
    const badUpdate = await call(client, "update_chart", { chartId: chart.id, labels: ["only one"] });
    expect(badUpdate.isError).toBe(true);
    expect(badUpdate.structuredContent!.error.message).toContain("one value per label");

    const ghost = "00000000-0000-4000-8000-000000000000";
    const post = await call(client, "create_post", { siteId: site.id, title: "Ghost", content: `{{chart:${ghost}}}` });
    expect(post.isError).toBe(true);
    expect(post.structuredContent!.error.code).toBe("VALIDATION");
    expect(post.structuredContent!.error.details.missingChartIds).toEqual([ghost]);
  });

  it("requires confirmation to delete, then removes the chart from published posts", async () => {
    const { user } = await makeUser("charts-del");
    const { client } = await connectWithApiKey(user.id);
    const site = (await call(client, "create_site", { name: "Delete Me" })).structuredContent!.site;
    const chart = (await call(client, "create_chart", { siteId: site.id, ...allen })).structuredContent!.chart;
    const post = (await call(client, "create_post", { siteId: site.id, title: "Uses it", content: chart.embed })).structuredContent!.post;
    await call(client, "publish_post", { postId: post.id });

    const first = await call(client, "delete_chart", { chartId: chart.id });
    expect(first.structuredContent!.status).toBe("confirmation_required");
    expect(first.structuredContent!.summary).toContain('"Uses it" (published)');
    expect((await getPublishedPost(site.subdomain, "post", post.slug))!.post.contentHtml).toContain("op-chart");

    const second = await call(client, "delete_chart", { chartId: chart.id, confirmationToken: first.structuredContent!.confirmation_token });
    expect(second.structuredContent!.deleted).toBe(true);
    expect((await getPublishedPost(site.subdomain, "post", post.slug))!.post.contentHtml).not.toContain("op-chart");
    expect((await call(client, "get_chart", { chartId: chart.id })).structuredContent!.error.code).toBe("NOT_FOUND");
  });

  it("respects scopes", async () => {
    const { user } = await makeUser("charts-ro");
    const site = await createSite({ kind: "user", userId: user.id }, { name: "Read Only Charts" });
    const { client } = await connectWithApiKey(user.id, { scopes: ["sites:read"] });
    const res = await call(client, "create_chart", { siteId: site.id, ...allen });
    expect(res.structuredContent!.error.code).toBe("FORBIDDEN");
  });

  it("sends the data table, not SVG, in RSS", async () => {
    const { actor } = await makeUser("charts-rss");
    const site = await createSite(actor, { name: "Feed Charts" });
    const chart = await createChart(actor, { siteId: site.id, ...allen } as never);
    const { client } = await connectWithApiKey(actor.userId);
    const post = (await call(client, "create_post", { siteId: site.id, title: "Feed", content: chart.embed })).structuredContent!.post;
    await call(client, "publish_post", { postId: post.id });
    const xml = await (await rss(new Request("https://x.test/rss.xml"), { params: Promise.resolve({ subdomain: site.subdomain }) })).text();
    expect(xml).toContain("<table>");
    expect(xml).toContain("Josh Allen&#39;s Development");
    expect(xml).not.toContain("<svg");
  });
});

describe("chart isolation", () => {
  it("keeps charts inside their tenant and site", async () => {
    const a = await makeUser("chart-a");
    const b = await makeUser("chart-b");
    const siteA = await createSite(a.actor, { name: "Chart Owner" });
    const siteB = await createSite(b.actor, { name: "Chart Thief" });
    const chart = await createChart(a.actor, { siteId: siteA.id, ...allen } as never);

    await expect(getChart(b.actor, chart.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateChart(b.actor, chart.id, { title: "pwned" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createChart(b.actor, { siteId: siteA.id, ...allen } as never)).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Can't embed another site's chart, and rendering never pulls it in.
    await expect(createPost(b.actor, { siteId: siteB.id, title: "steal", content: chart.embed })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await withCharts(siteB.id, `<p>${chart.embed}</p>`)).toBe("");
    expect(await previewPostHtml(b.actor, siteB.id, chart.embed)).toContain("not found");

    // RLS underneath the service checks.
    await withUser(b.user.id, async (tx) => {
      expect(await tx.select().from(charts).where(eq(charts.id, chart.id))).toEqual([]);
      expect(await tx.update(charts).set({ title: "x" }).where(eq(charts.id, chart.id)).returning()).toEqual([]);
      await expect(tx.insert(charts).values({ siteId: siteA.id, title: "x", spec: {} })).rejects.toThrow();
    });
  });
});
