import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as frameRoute } from "@/app/viz-frame/[id]/route";
import { GET as rss } from "@/app/site/[subdomain]/rss.xml/route";
import { getDb, withUser } from "@/db/client";
import { charts, customVisualizations } from "@/db/schema";
import { DEMO_CHARTS, DEMO_CUSTOM_VIZ, demoQbScatter } from "@/lib/charts/demo";
import { config } from "@/lib/config";
import type { Actor } from "@/server/actor";
import { getPublishedPost } from "@/server/public/data";
import { getChart, updateChart } from "@/server/services/charts";
import { createCustomViz, getCustomViz, previewFrameUrl, reviewCustomViz, updateCustomViz } from "@/server/services/custom-viz";
import { createPost } from "@/server/services/posts";
import { createSite } from "@/server/services/sites";
import { call, connectWithApiKey, makeUser } from "../helpers";

const frame = (url: string) => {
  const id = new URL(url).pathname.split("/").pop()!;
  return frameRoute(new Request(url), { params: Promise.resolve({ id }) });
};

async function publishWith(client: Awaited<ReturnType<typeof connectWithApiKey>>["client"], siteId: string, title: string, content: string) {
  const post = (await call(client, "create_post", { siteId, title, content })).structuredContent!.post;
  expect(post, JSON.stringify(post)).toBeTruthy();
  await call(client, "publish_post", { postId: post.id });
  return post as { id: string; slug: string };
}

describe("declarative visualizations over MCP", () => {
  it("advertises capabilities so agents can discover features", async () => {
    const { user } = await makeUser("viz-caps");
    const { client } = await connectWithApiKey(user.id);
    const res = await call(client, "get_visualization_capabilities", {});
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent!.schemaVersion).toBe(2);
    expect(res.structuredContent!.chartTypes.map((t: { type: string }) => t.type)).toContain("spatial_heatmap");
    expect(res.structuredContent!.customVisualizations.enabled).toBe(false);
    const full = await call(client, "get_visualization_capabilities", { includeJsonSchema: true });
    expect(full.structuredContent!.jsonSchema.properties.filters).toBeTruthy();
  });

  it("creates every demo chart, embeds them, and serves interactive markup with filters", async () => {
    const { user } = await makeUser("viz-demo");
    const { client } = await connectWithApiKey(user.id);
    const site = (await call(client, "create_site", { name: "Demo Lab" })).structuredContent!.site;
    const embeds: string[] = [];
    for (const d of DEMO_CHARTS) {
      const res = await call(client, "create_chart", { siteId: site.id, ...d.build() });
      expect(res.isError, `${d.key}: ${res.content[0]?.text}`).toBeFalsy();
      expect(res.structuredContent!.chart.spec.version).toBe(2);
      embeds.push(res.structuredContent!.chart.embed);
    }
    const post = await publishWith(client, site.id, "Every chart", embeds.join("\n\n"));
    const html = (await getPublishedPost(site.subdomain, "post", post.slug))!.post.contentHtml;
    expect(html.match(/<figure class="op-chart/g)).toHaveLength(DEMO_CHARTS.length);
    expect(html).toContain('data-type="spatial_heatmap"');
    expect(html).toContain('<div class="op-filters" role="group" aria-label="Filter the chart">');
    expect(html).toContain('class="op-field');
    expect(html).not.toContain("{{chart:");
  });

  it("updates styling, data and type with update_chart and the published post follows without republishing", async () => {
    const { user } = await makeUser("viz-update");
    const { client } = await connectWithApiKey(user.id);
    const site = (await call(client, "create_site", { name: "Update Lab" })).structuredContent!.site;
    const chart = (await call(client, "create_chart", { siteId: site.id, type: "bar", title: "Inline", labels: ["a", "b"], series: [{ name: "s", data: [1, 2] }] })).structuredContent!.chart;
    const post = await publishWith(client, site.id, "Follows", chart.embed);

    let res = await call(client, "update_chart", { chartId: chart.id, style: { colors: ["#0f766e"], legend: { position: "bottom" } } });
    expect(res.isError, res.content[0]?.text).toBeFalsy();
    let html = (await getPublishedPost(site.subdomain, "post", post.slug))!.post.contentHtml;
    expect(html).toContain('style="--c:#0f766e"');

    // Switch from inline data to a filtered dataset scatter in one patch.
    const qb = demoQbScatter();
    res = await call(client, "update_chart", { chartId: chart.id, type: "scatter", labels: null, series: null, style: null, dataset: qb.dataset, encoding: qb.encoding, filters: qb.filters });
    expect(res.isError, res.content[0]?.text).toBeFalsy();
    html = (await getPublishedPost(site.subdomain, "post", post.slug))!.post.contentHtml;
    expect(html).toContain('data-type="scatter"');
    expect(html).toContain("op-pt");
    expect(html).toContain('<select data-f="0" disabled>');

    // An invalid patch is rejected as a whole, leaving the chart intact.
    const bad = await call(client, "update_chart", { chartId: chart.id, encoding: { x: "nope", y: "epa" } });
    expect(bad.isError).toBe(true);
    expect(bad.structuredContent!.error.message).toContain('No field "nope"');
    expect((await call(client, "get_chart", { chartId: chart.id })).structuredContent!.chart.type).toBe("scatter");
  });

  it("keeps rendering and updating charts stored before v2 (no version key)", async () => {
    const { actor } = await makeUser("viz-legacy");
    const site = await createSite(actor, { name: "Legacy Charts" });
    const legacy = { type: "line", title: "Old", labels: ["a", "b"], series: [{ name: "s", data: [1, 2] }] };
    const [row] = await withUser(actor.userId, (tx) => tx.insert(charts).values({ siteId: site.id, title: "Old", spec: legacy }).returning());
    const p = await createPost(actor, { siteId: site.id, title: "Legacy", content: `{{chart:${row.id}}}` });
    const { client } = await connectWithApiKey(actor.userId);
    await call(client, "publish_post", { postId: p.id });
    const html = (await getPublishedPost(site.subdomain, "post", p.slug))!.post.contentHtml;
    expect(html).toContain('<figure class="op-chart" data-chart');
    expect((await getChart(actor, row.id)).spec).toEqual(legacy);
    const updated = await updateChart(actor, row.id, { title: "Still works" });
    expect(updated.spec).toMatchObject({ ...legacy, title: "Still works", version: 2 });
  });

  it("rejects oversized specs with a helpful message", async () => {
    const { user } = await makeUser("viz-big");
    const { client } = await connectWithApiKey(user.id);
    const site = (await call(client, "create_site", { name: "Big Data" })).structuredContent!.site;
    const rows = Array.from({ length: 5001 }, (_, i) => [i, i]);
    const res = await call(client, "create_chart", { siteId: site.id, type: "scatter", title: "Too big", dataset: { fields: [{ name: "x", type: "number" }, { name: "y", type: "number" }], rows }, encoding: { x: "x", y: "y" } });
    expect(res.isError).toBe(true);
    // Rejected by the tool's input schema (before the service): the agent still gets the reason.
    expect(res.content[0].text).toMatch(/rows|5000/);
  });
});

describe("custom visualizations", () => {
  const prev = { flag: process.env.CUSTOM_VIZ, origin: process.env.VIZ_SANDBOX_ORIGIN };
  const on = () => (process.env.CUSTOM_VIZ = "on");
  const off = () => delete process.env.CUSTOM_VIZ;
  afterAll(() => {
    if (prev.flag === undefined) delete process.env.CUSTOM_VIZ;
    else process.env.CUSTOM_VIZ = prev.flag;
  });

  it("are unavailable while the feature flag is off", async () => {
    off();
    const { user, actor } = await makeUser("cviz-off");
    const { client } = await connectWithApiKey(user.id);
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).not.toContain("create_custom_visualization");
    const site = await createSite(actor, { name: "Flag Off" });
    await expect(createCustomViz(actor, { siteId: site.id, ...DEMO_CUSTOM_VIZ })).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Even an approved row (e.g. from before the flag was turned off) never runs.
    on();
    const viz = await createCustomViz(actor, { siteId: site.id, ...DEMO_CUSTOM_VIZ });
    await reviewCustomViz(actor, viz.id, { decision: "approve", codeHash: viz.codeHash });
    const post = await createPost(actor, { siteId: site.id, title: "Flagged", content: viz.embed });
    await call(client, "publish_post", { postId: post.id });
    off();
    const html = (await getPublishedPost(site.subdomain, "post", post.slug))!.post.contentHtml;
    expect(html).not.toContain("<iframe");
    expect(html).toContain("Win probability clock");
    expect(html).toContain("<table>");
    expect((await frame(`${config.appUrl}/viz-frame/${viz.id}`)).status).toBe(404);
  });

  describe("with the flag on", () => {
    beforeAll(on);

    it("runs only after a person approves the exact code, and re-locks on code changes", async () => {
      const { user, actor } = await makeUser("cviz");
      const { client } = await connectWithApiKey(user.id);
      const site = (await call(client, "create_site", { name: "Viz Lab" })).structuredContent!.site;
      const created = await call(client, "create_custom_visualization", { siteId: site.id, ...DEMO_CUSTOM_VIZ });
      expect(created.isError, created.content[0]?.text).toBeFalsy();
      const viz = created.structuredContent!.visualization;
      expect(viz.status).toBe("pending_approval");
      expect(viz.embed).toBe(`{{viz:${viz.id}}}`);
      expect(viz.approvalUrl).toBe(`${config.appUrl}/dashboard/sites/${site.id}/visualizations/${viz.id}`);

      const post = await publishWith(client, site.id, "Clock", `Intro\n\n${viz.embed}`);
      const read = async () => (await getPublishedPost(site.subdomain, "post", post.slug))!.post.contentHtml;

      // Pending: fallback only, frame refuses to serve.
      expect(await read()).not.toContain("<iframe");
      expect(await read()).not.toContain("Awaiting approval"); // previews only
      expect((await frame(`${config.appUrl}/viz-frame/${viz.id}`)).status).toBe(404);

      // Agents can't approve: there is no tool, and the service refuses agent actors.
      expect((await client.listTools()).tools.map((t) => t.name)).not.toContain("approve_custom_visualization");
      const agentActor: Actor = { kind: "agent", userId: user.id, connectionId: "00000000-0000-4000-8000-000000000001", clientName: "x", scopes: new Set(["content:write", "sites:read"]), siteIds: "all", confirmPublish: false };
      await expect(reviewCustomViz(agentActor, viz.id, { decision: "approve", codeHash: viz.codeHash })).rejects.toMatchObject({ code: "FORBIDDEN" });

      // The reviewer's preview link runs the pending code, bound to that code.
      const preview = await previewFrameUrl(actor, viz.id);
      const pres = await frame(preview);
      expect(pres.status).toBe(200);
      expect(pres.headers.get("cache-control")).toBe("no-store");
      const tampered = new URL(preview);
      tampered.searchParams.set("preview", tampered.searchParams.get("preview")!.replace(/.$/, (c) => (c === "0" ? "1" : "0")));
      expect((await frame(tampered.toString())).status).toBe(404);

      // Approving a stale hash fails; the right one works.
      await expect(reviewCustomViz(actor, viz.id, { decision: "approve", codeHash: "0".repeat(64) })).rejects.toMatchObject({ code: "CONFLICT" });
      const approved = await reviewCustomViz(actor, viz.id, { decision: "approve", codeHash: viz.codeHash });
      expect(approved.status).toBe("approved");

      const html = await read();
      const src = html.match(/<iframe data-src="([^"]+)"/)![1].replace(/&amp;/g, "&");
      expect(html).toContain('sandbox="allow-scripts"');
      expect(html).not.toContain("allow-same-origin");
      expect(src.startsWith(`${config.customViz.origin}/viz-frame/${viz.id}?v=`)).toBe(true);

      const res = await frame(src);
      expect(res.status).toBe(200);
      const csp = res.headers.get("content-security-policy")!;
      expect(csp).toContain("sandbox allow-scripts");
      expect(csp).toContain("connect-src 'none'");
      expect(csp).toContain(`frame-ancestors ${config.siteUrl(site.subdomain)} ${config.appUrl}`);
      expect(res.headers.get("x-frame-options")).toBeNull();
      expect(res.headers.get("permissions-policy")).toContain("camera=()");
      const body = await res.text();
      expect(body).toContain("window.OpenPress");
      expect(body).toContain('"home":"Hawks"');

      // Data-only update: stays approved, new data is served, page URL changes (cache bust).
      const dataOnly = await call(client, "update_custom_visualization", { vizId: viz.id, data: { home: "Owls", samples: [{ minute: 1, p: 0.5 }] } });
      expect(dataOnly.structuredContent!.visualization.status).toBe("approved");
      const src2 = (await read()).match(/<iframe data-src="([^"]+)"/)![1].replace(/&amp;/g, "&");
      expect(src2).not.toBe(src);
      expect(await (await frame(src2)).text()).toContain('"home":"Owls"');

      // Code change: approval resets, the iframe disappears, the frame stops serving.
      const codeChange = await call(client, "update_custom_visualization", { vizId: viz.id, js: "document.body.textContent = 'changed'" });
      expect(codeChange.structuredContent!.visualization.status).toBe("pending_approval");
      expect(codeChange.structuredContent!.visualization.next).toContain("approval was reset");
      expect(await read()).not.toContain("<iframe");
      expect((await frame(src2)).status).toBe(404);
      // An old preview token is bound to the old code.
      expect((await frame(preview)).status).toBe(404);
    });

    it("validates code and enforces site isolation", async () => {
      const a = await makeUser("cviz-a");
      const b = await makeUser("cviz-b");
      const siteA = await createSite(a.actor, { name: "Viz Owner" });
      const siteB = await createSite(b.actor, { name: "Viz Thief" });
      const { client } = await connectWithApiKey(a.user.id);
      const bad = await call(client, "create_custom_visualization", { siteId: siteA.id, title: "x", js: "1", html: "<script src=//evil.example/x.js></script>" });
      expect(bad.isError).toBe(true);
      expect(bad.content[0].text).toContain("html may not contain <script>");

      const viz = await createCustomViz(a.actor, { siteId: siteA.id, ...DEMO_CUSTOM_VIZ });
      await expect(getCustomViz(b.actor, viz.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(updateCustomViz(b.actor, viz.id, { js: "steal()" })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(reviewCustomViz(b.actor, viz.id, { decision: "approve", codeHash: viz.codeHash })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(createCustomViz(b.actor, { siteId: siteA.id, ...DEMO_CUSTOM_VIZ })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(createPost(b.actor, { siteId: siteB.id, title: "steal", content: viz.embed })).rejects.toMatchObject({ code: "VALIDATION" });
      await withUser(b.user.id, async (tx) => {
        expect(await tx.select().from(customVisualizations).where(eq(customVisualizations.id, viz.id))).toEqual([]);
        expect(await tx.update(customVisualizations).set({ status: "approved" }).where(eq(customVisualizations.id, viz.id)).returning()).toEqual([]);
      });

      // Read-only connections can't create; site-restricted ones can't reach other sites.
      const ro = await connectWithApiKey(a.user.id, { scopes: ["sites:read"] });
      expect((await call(ro.client, "create_custom_visualization", { siteId: siteA.id, ...DEMO_CUSTOM_VIZ })).structuredContent!.error.code).toBe("FORBIDDEN");
      const restricted = await connectWithApiKey(a.user.id, { siteIds: [siteB.id] });
      expect((await call(restricted.client, "get_custom_visualization", { vizId: viz.id })).structuredContent!.error.code).toBe("FORBIDDEN");
    });

    it("stops serving for suspended accounts and requires confirmation to delete", async () => {
      const { user, actor } = await makeUser("cviz-susp");
      const site = await createSite(actor, { name: "Suspend Viz" });
      const viz = await createCustomViz(actor, { siteId: site.id, ...DEMO_CUSTOM_VIZ });
      await reviewCustomViz(actor, viz.id, { decision: "approve", codeHash: viz.codeHash });
      const url = `${config.appUrl}/viz-frame/${viz.id}`;
      expect((await frame(url)).status).toBe(200);

      const { client } = await connectWithApiKey(user.id);
      const first = await call(client, "delete_custom_visualization", { vizId: viz.id });
      expect(first.structuredContent!.status).toBe("confirmation_required");
      expect((await frame(url)).status).toBe(200);

      await (await getDb()).execute(sql`update users set suspended_at = now() where id = ${user.id}`);
      expect((await frame(url)).status).toBe(404);
    });

    it("only serves frames from the configured sandbox origin", async () => {
      const { actor } = await makeUser("cviz-origin");
      const site = await createSite(actor, { name: "Origin Viz" });
      const viz = await createCustomViz(actor, { siteId: site.id, ...DEMO_CUSTOM_VIZ });
      await reviewCustomViz(actor, viz.id, { decision: "approve", codeHash: viz.codeHash });
      process.env.VIZ_SANDBOX_ORIGIN = "https://usercontent.example";
      try {
        expect((await frame(`${config.appUrl}/viz-frame/${viz.id}`)).status).toBe(404);
        expect((await frame(`https://usercontent.example/viz-frame/${viz.id}`)).status).toBe(200);
      } finally {
        if (prev.origin === undefined) delete process.env.VIZ_SANDBOX_ORIGIN;
        else process.env.VIZ_SANDBOX_ORIGIN = prev.origin;
      }
    });

    it("sends the accessible table, not the frame, in RSS", async () => {
      const { user, actor } = await makeUser("cviz-rss");
      const site = await createSite(actor, { name: "Viz Feed" });
      const viz = await createCustomViz(actor, { siteId: site.id, ...DEMO_CUSTOM_VIZ });
      await reviewCustomViz(actor, viz.id, { decision: "approve", codeHash: viz.codeHash });
      const { client } = await connectWithApiKey(user.id);
      await publishWith(client, site.id, "Feed viz", viz.embed);
      const xml = await (await rss(new Request("https://x.test/rss.xml"), { params: Promise.resolve({ subdomain: site.subdomain }) })).text();
      expect(xml).toContain("Win probability clock");
      expect(xml).toContain("<table>");
      expect(xml).not.toContain("<iframe");
    });
  });
});
