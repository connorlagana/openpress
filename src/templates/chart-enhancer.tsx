"use client";

import { useEffect } from "react";
import { distinctValues, fieldIndex, type FilterState } from "@/lib/charts/data";
import { filterStatusText, legendHtml, renderPlot, resolveView, viewTableHtml, defaultFilterState, type ChartSpec, type Plot, type View } from "@/lib/charts/render";
import type { Cell } from "@/lib/charts/types";
import { enhanceViz } from "./viz-enhancer";

// Progressive enhancement for server-rendered charts (lib/charts/render.ts):
// re-draws each chart at the reader's real width, and adds tooltips, keyboard
// access, series toggles and dataset filters (no page reload: the same pure
// renderer runs here). Without JS the chart, its legend and its data table
// still render for the default filter state. Chart text is untrusted, so the
// tooltip is built with textContent only; other HTML comes from the renderer,
// which escapes every spec string.

export function ChartEnhancer() {
  useEffect(() => {
    const cleanups = [
      ...Array.from(document.querySelectorAll<HTMLElement>("figure.op-chart")).map(enhance),
      ...Array.from(document.querySelectorAll<HTMLElement>("figure.op-viz")).map(enhanceViz),
    ];
    return () => cleanups.forEach((c) => c?.());
  }, []);
  return null;
}

type Dir = "left" | "right" | "up" | "down";

/** Nearest item in a direction (2D grids and scatter), favoring the main axis. */
function stepItem(items: Plot["items"], from: number, dir: Dir): number {
  const c = items[from];
  const [dx, dy] = dir === "left" ? [-1, 0] : dir === "right" ? [1, 0] : dir === "up" ? [0, -1] : [0, 1];
  let best = -1;
  let score = Infinity;
  items.forEach((p, k) => {
    if (k === from) return;
    const along = (p.x - c.x) * dx + (p.y - c.y) * dy;
    if (along <= 0.5) return;
    const across = Math.abs((p.x - c.x) * dy) + Math.abs((p.y - c.y) * dx);
    const s = along + across * 3;
    if (s < score) {
      score = s;
      best = k;
    }
  });
  return best < 0 ? from : best;
}

function enhance(fig: HTMLElement): (() => void) | undefined {
  let spec: ChartSpec;
  try {
    spec = JSON.parse(fig.querySelector("script.op-chart-spec")?.textContent ?? "");
  } catch {
    return;
  }
  const bodyEl = fig.querySelector<HTMLElement>(".op-chart-body");
  const tipEl = fig.querySelector<HTMLElement>(".op-tip");
  if (!bodyEl || !tipEl) return;
  const body: HTMLElement = bodyEl;
  const tip: HTMLElement = tipEl;
  const legendSlot = fig.querySelector<HTMLElement>(".op-legend-slot");
  const tableEl = fig.querySelector<HTMLElement>(".op-chart-table");
  const noteEl = fig.querySelector<HTMLElement>(".op-chart-note");
  const tooltips = spec.style?.tooltip?.show !== false;
  const state: FilterState = defaultFilterState(spec);
  const hidden = new Set<number>();
  let view: View = resolveView(spec, state);
  let plot: Plot | null = null;
  let lastWidth = 0;
  let active = -1; // index into plot.items

  const svg = () => body.querySelector<SVGSVGElement>("svg.op-plot");
  const draw = (force = false) => {
    const width = Math.round(body.clientWidth);
    if (!width || (!force && width === lastWidth)) return;
    lastWidth = width;
    plot = renderPlot(view, { width, hidden });
    const el = svg();
    if (el) el.outerHTML = plot.svg;
    if (active >= 0 && active < plot.items.length) show(active);
    else active = -1;
  };

  const row = (r: ReturnType<Plot["tip"]>["rows"][number]) => {
    const el = document.createElement("div");
    el.className = "op-tip-row";
    const key = document.createElement("span");
    key.className = `op-key op-key-line ${r.cls ?? ""}`;
    // Colors are validated hex or renderer-computed color-mix() values.
    if (r.color) key.style.setProperty("--c", r.color);
    if (!r.cls && !r.color) key.style.visibility = "hidden";
    const v = document.createElement("strong");
    v.textContent = r.value;
    const l = document.createElement("span");
    l.textContent = r.name;
    el.append(key, v, l);
    return el;
  };

  function show(k: number, pointer?: { x: number; y: number }) {
    const el = svg();
    if (!el || !plot || !tooltips) return;
    const item = plot.items[k];
    if (!item) return;
    active = k;
    const data = plot.tip(item.i);
    const head = document.createElement("div");
    head.className = "op-tip-head";
    head.textContent = data.head;
    tip.replaceChildren(...(data.head ? [head] : []), ...data.rows.map(row));
    el.classList.add("op-active");
    el.querySelectorAll("[data-i]:not(.op-hit)").forEach((m) => m.classList.toggle("op-on", m.getAttribute("data-i") === String(item.i)));

    const box = body.getBoundingClientRect();
    const svgBox = el.getBoundingClientRect();
    const scale = plot.W ? svgBox.width / plot.W : 1;
    const ox = svgBox.left - box.left;
    const oy = svgBox.top - box.top;
    const anchorX = ox + item.x * scale;
    const cross = el.querySelector<SVGLineElement>(".op-cross");
    if (cross && plot.mode === "band") {
      cross.setAttribute("x1", String(item.x));
      cross.setAttribute("x2", String(item.x));
      cross.setAttribute("visibility", "visible");
    }
    tip.hidden = false;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let left = anchorX + 14;
    if (left + tw > box.width) left = anchorX - tw - 14;
    const anchorY = plot.mode === "band" ? (pointer ? pointer.y - box.top : oy + 8 + th / 2) : oy + item.y * scale;
    const top = Math.min(Math.max(anchorY - th / 2, 0), Math.max(0, box.height - th));
    tip.style.transform = `translate(${Math.max(0, Math.round(left))}px, ${Math.round(top)}px)`;
  }

  function hide() {
    active = -1;
    tip.hidden = true;
    const el = svg();
    el?.classList.remove("op-active");
    el?.querySelector(".op-cross")?.setAttribute("visibility", "hidden");
    el?.querySelectorAll(".op-on").forEach((m) => m.classList.remove("op-on"));
  }

  const itemAt = (e: PointerEvent): number => {
    if (!plot) return -1;
    if (plot.mode === "point") {
      const el = svg();
      if (!el) return -1;
      const r = el.getBoundingClientRect();
      const scale = r.width / plot.W || 1;
      const x = (e.clientX - r.left) / scale;
      const y = (e.clientY - r.top) / scale;
      const reach = (e.pointerType === "touch" ? 28 : 16) / scale;
      let best = -1;
      let bd = reach * reach;
      plot.items.forEach((p, k) => {
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d <= bd) {
          bd = d;
          best = k;
        }
      });
      return best;
    }
    const t = (e.target as Element | null)?.closest?.("[data-i]");
    if (!t) return -1;
    const i = Number(t.getAttribute("data-i"));
    return plot.items.findIndex((p) => p.i === i);
  };
  const onMove = (e: PointerEvent) => {
    const k = itemAt(e);
    if (k < 0) return hide();
    show(k, { x: e.clientX, y: e.clientY });
  };
  const onKey = (e: KeyboardEvent) => {
    if (!plot || !plot.items.length) return;
    if (e.key === "Escape") return hide();
    const n = plot.items.length;
    let next = -1;
    const linear = plot.mode === "band" || plot.mode === "slice";
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else if (active < 0 && e.key.startsWith("Arrow")) next = 0;
    else if (linear && (e.key === "ArrowRight" || e.key === "ArrowLeft")) next = (active + (e.key === "ArrowRight" ? 1 : -1) + n) % n;
    else if (!linear && e.key.startsWith("Arrow")) next = stepItem(plot.items, active, e.key.slice(5).toLowerCase() as Dir);
    if (next < 0) return;
    e.preventDefault();
    show(next);
  };

  const hint =
    spec.type === "heatmap" || spec.type === "spatial_heatmap" || spec.type === "scatter"
      ? "Use the arrow keys to move between values; Home and End jump to the ends"
      : "Use the left and right arrow keys to read values";
  if (tooltips) {
    body.tabIndex = 0;
    body.setAttribute("aria-description", hint);
    body.addEventListener("pointermove", onMove);
    body.addEventListener("pointerdown", onMove);
    body.addEventListener("pointerleave", hide);
    body.addEventListener("keydown", onKey);
    body.addEventListener("focus", () => show(active < 0 ? 0 : active));
    body.addEventListener("blur", hide);
  }

  const bindToggles = () => {
    const nSeries = spec.type === "scatter" ? fig.querySelectorAll("button.op-toggle").length : view.spec.series.length;
    for (const b of Array.from(fig.querySelectorAll<HTMLButtonElement>("button.op-toggle"))) {
      const s = Number(b.dataset.s);
      b.disabled = false;
      b.setAttribute("aria-pressed", String(!hidden.has(s)));
      b.addEventListener("click", () => {
        if (!hidden.has(s) && hidden.size === nSeries - 1) return; // keep one series visible
        if (hidden.has(s)) hidden.delete(s);
        else hidden.add(s);
        b.setAttribute("aria-pressed", String(!hidden.has(s)));
        draw(true);
      });
    }
  };
  bindToggles();

  // ---------- Filters ----------
  const ds = spec.dataset;
  const values = (spec.filters ?? []).map((f) => (ds ? distinctValues(ds, fieldIndex(ds, f.field)) : []));
  const refresh = () => {
    view = resolveView(spec, state);
    hidden.clear();
    hide();
    if (legendSlot) {
      legendSlot.innerHTML = legendHtml(view);
      bindToggles();
    }
    if (tableEl) tableEl.innerHTML = viewTableHtml(view);
    if (noteEl) {
      const text = [filterStatusText(view, spec), view.note].filter(Boolean).join(". ");
      noteEl.textContent = text;
      noteEl.hidden = !text;
    }
    draw(true);
  };
  const controls = Array.from(fig.querySelectorAll<HTMLElement>(".op-filters [data-f]"));
  for (const el of controls) {
    const f = Number(el.dataset.f);
    const vals = values[f] ?? [];
    (el as HTMLInputElement).disabled = false;
    if (el instanceof HTMLSelectElement) {
      el.addEventListener("change", () => {
        state[f] = { kind: "set", values: el.value === "*" ? null : [vals[Number(el.value)]] };
        refresh();
      });
    } else if (el instanceof HTMLButtonElement) {
      const value: Cell = vals[Number(el.dataset.k)];
      el.addEventListener("click", () => {
        const cur = state[f];
        const set = new Set(cur?.kind === "set" && cur.values ? cur.values : vals);
        if (set.has(value)) {
          if (set.size === 1) return; // keep at least one value on
          set.delete(value);
        } else set.add(value);
        state[f] = { kind: "set", values: set.size === vals.length ? null : vals.filter((v) => set.has(v)) };
        fig.querySelectorAll<HTMLButtonElement>(`.op-chip[data-f="${f}"]`).forEach((b) => b.setAttribute("aria-pressed", String(set.has(vals[Number(b.dataset.k)]))));
        refresh();
      });
    } else if (el instanceof HTMLInputElement) {
      el.addEventListener("change", () => {
        const cur = state[f]?.kind === "range" ? { ...(state[f] as { min?: number | string; max?: number | string }) } : {};
        const raw = el.value.trim();
        const v = raw === "" ? undefined : el.type === "number" ? Number(raw) : raw;
        if (typeof v === "number" && !Number.isFinite(v)) return;
        cur[el.dataset.b === "max" ? "max" : "min"] = v;
        state[f] = { kind: "range", ...cur };
        refresh();
      });
    }
  }

  const ro = new ResizeObserver(() => draw());
  ro.observe(body);
  draw();
  return () => ro.disconnect();
}
