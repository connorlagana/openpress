// {{viz:<id>}} embeds for custom visualizations. Post HTML only ever gets an
// <iframe sandbox="allow-scripts"> pointing at the sandbox origin (never the
// code itself; the enhancer sets src once it is watching the frame), plus a
// server-rendered title, description and data table that work without JS, in
// feeds and for screen readers.

import { viewTableHtml, resolveView } from "@/lib/charts/render";
import { esc } from "@/lib/charts/format";
import type { Dataset } from "@/lib/charts/types";
import type { EmbedMode } from "@/lib/charts/render";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const vizToken = (id: string) => `{{viz:${id}}}`;
const TOKEN_MD = new RegExp(`\\{\\{viz:(${UUID})\\}\\}`, "gi");
const TOKEN_HTML = new RegExp(`<p>\\{\\{viz:(${UUID})\\}\\}</p>`, "gi");

export const vizIdsInMarkdown = (md: string) => [...new Set([...md.matchAll(TOKEN_MD)].map((m) => m[1].toLowerCase()))];
export const vizIdsInHtml = (html: string) => [...new Set([...html.matchAll(TOKEN_HTML)].map((m) => m[1].toLowerCase()))];

export type VizEmbed = {
  id: string;
  title: string;
  description: string | null;
  height: number;
  table: Dataset | null;
  /** Sandbox frame URL when the code may run (approved), else null. */
  frameUrl: string | null;
  /** Why it isn't running, for previews only. */
  notice?: string;
};

/** A dataset drawn as a plain records table (the chart renderer's scatter table). */
const rawTable = (t: Dataset | null) => (t ? viewTableHtml(resolveView({ type: "scatter", title: "", dataset: t, encoding: {} })) : "");

function tableHtml(t: Dataset | null): string {
  return t ? `<details class="op-chart-data"><summary>View data</summary><div class="op-chart-table">${rawTable(t)}</div></details>` : "";
}

export function vizFigureHtml(v: VizEmbed, mode: EmbedMode): string {
  if (mode === "feed") return `<figure><figcaption><strong>${esc(v.title)}</strong>${v.description ? ` · ${esc(v.description)}` : ""}</figcaption>${rawTable(v.table)}</figure>`;
  const head = `<figcaption class="op-chart-head"><span class="op-chart-title">${esc(v.title)}</span>${v.description ? `<span class="op-chart-sub">${esc(v.description)}</span>` : ""}</figcaption>`;
  const frame = v.frameUrl
    ? `<div class="op-viz-frame" style="height:${Math.round(v.height)}px"><iframe data-src="${esc(v.frameUrl)}" title="${esc(v.title)}" sandbox="allow-scripts" referrerpolicy="no-referrer" allow="" loading="lazy" credentialless width="100%" height="100%"></iframe></div>`
    : "";
  const notice = mode === "preview" && v.notice ? `<p class="op-viz-notice">${esc(v.notice)}</p>` : "";
  return `<figure class="op-viz${v.frameUrl ? "" : " op-viz-static"}" data-viz="${esc(v.id)}">${head}${frame}${notice}<div class="op-chart-foot"><span></span>${tableHtml(v.table)}</div></figure>`;
}

export function embedViz(html: string, items: ReadonlyMap<string, VizEmbed>, mode: EmbedMode = "page"): string {
  return html.replace(TOKEN_HTML, (_m, rawId: string) => {
    const v = items.get(rawId.toLowerCase());
    if (!v) return mode === "preview" ? `<p><em>Visualization ${esc(rawId.toLowerCase())} not found on this site.</em></p>` : "";
    return vizFigureHtml(v, mode);
  });
}
