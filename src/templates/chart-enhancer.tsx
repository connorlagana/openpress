"use client";

import { useEffect } from "react";
import { formatValue, renderChartSvg, type ChartSpec } from "@/lib/charts/render";

// Progressive enhancement for server-rendered charts (lib/charts/render.ts):
// re-draws each chart at the reader's real width, and adds tooltips, a
// crosshair, keyboard access and series toggles. Without JS the chart, its
// legend and its data table still render. Chart text is untrusted, so the
// tooltip is built with textContent only.

export function ChartEnhancer() {
  useEffect(() => {
    const cleanups = Array.from(document.querySelectorAll<HTMLElement>("figure.op-chart")).map(enhance);
    return () => cleanups.forEach((c) => c?.());
  }, []);
  return null;
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
  const round = spec.type === "pie" || spec.type === "donut";
  const hidden = new Set<number>();
  const n = spec.labels.length;
  let lastWidth = 0;
  let active = -1;

  const svg = () => body.querySelector<SVGSVGElement>("svg.op-plot");
  const draw = (force = false) => {
    const width = Math.round(body.clientWidth);
    if (!width || (!force && width === lastWidth)) return;
    lastWidth = width;
    const el = svg();
    if (el) el.outerHTML = renderChartSvg(spec, { width, hidden });
    if (active >= 0) show(active);
  };

  const row = (cls: string, value: string, name: string) => {
    const r = document.createElement("div");
    r.className = "op-tip-row";
    const key = document.createElement("span");
    key.className = `op-key op-key-line ${cls}`;
    const v = document.createElement("strong");
    v.textContent = value;
    const l = document.createElement("span");
    l.textContent = name;
    r.append(key, v, l);
    return r;
  };

  function show(i: number, pointer?: { x: number; y: number }) {
    const plot = svg();
    if (!plot) return;
    active = i;
    const fmt = spec.valueFormat;
    const head = document.createElement("div");
    head.className = "op-tip-head";
    head.textContent = spec.labels[i];
    tip.replaceChildren(head);
    if (round) {
      const data = spec.series[0].data;
      const total = data.reduce<number>((a, v) => a + (v ?? 0), 0);
      const pct = total > 0 ? ` · ${Math.round(((data[i] ?? 0) / total) * 100)}%` : "";
      tip.append(row(`op-c${i}`, formatValue(fmt, data[i] ?? null) + pct, spec.series[0].name));
    } else {
      spec.series.forEach((s, k) => {
        if (!hidden.has(k)) tip.append(row(`op-c${k}`, formatValue(fmt, s.data[i] ?? null), s.name));
      });
    }
    plot.classList.add("op-active");
    plot.querySelectorAll("[data-i]:not(.op-hit)").forEach((m) => m.classList.toggle("op-on", m.getAttribute("data-i") === String(i)));

    const box = body.getBoundingClientRect();
    const vb = plot.viewBox.baseVal;
    const scale = vb.width ? plot.clientWidth / vb.width : 1;
    const hit = plot.querySelector<SVGRectElement>(`.op-hit[data-i="${i}"]`);
    const cross = plot.querySelector<SVGLineElement>(".op-cross");
    const anchorX = hit ? Number(hit.getAttribute("data-x")) * scale : pointer ? pointer.x - box.left : box.width / 2;
    if (cross && hit) {
      cross.setAttribute("x1", hit.getAttribute("data-x")!);
      cross.setAttribute("x2", hit.getAttribute("data-x")!);
      cross.setAttribute("visibility", "visible");
    }
    tip.hidden = false;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let left = anchorX + 14;
    if (left + tw > box.width) left = anchorX - tw - 14;
    const top = pointer ? Math.min(Math.max(pointer.y - box.top - th / 2, 0), Math.max(0, box.height - th)) : 8;
    tip.style.transform = `translate(${Math.max(0, Math.round(left))}px, ${Math.round(top)}px)`;
  }

  function hide() {
    active = -1;
    tip.hidden = true;
    const plot = svg();
    plot?.classList.remove("op-active");
    plot?.querySelector(".op-cross")?.setAttribute("visibility", "hidden");
    plot?.querySelectorAll(".op-on").forEach((m) => m.classList.remove("op-on"));
  }

  const indexAt = (e: PointerEvent) => {
    const t = (e.target as Element | null)?.closest?.("[data-i]");
    return t ? Number(t.getAttribute("data-i")) : -1;
  };
  const onMove = (e: PointerEvent) => {
    const i = indexAt(e);
    if (i < 0) return hide();
    show(i, { x: e.clientX, y: e.clientY });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") return hide();
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = active < 0 ? 0 : (active + (e.key === "ArrowRight" ? 1 : -1) + n) % n;
    show(next);
  };

  // Keyboard: focus the plot, then arrow through the labels.
  body.tabIndex = 0;
  body.setAttribute("aria-description", "Use the left and right arrow keys to read values");
  body.addEventListener("pointermove", onMove);
  body.addEventListener("pointerdown", onMove);
  body.addEventListener("pointerleave", hide);
  body.addEventListener("keydown", onKey);
  body.addEventListener("focus", () => show(active < 0 ? 0 : active));
  body.addEventListener("blur", hide);

  const toggles = Array.from(fig.querySelectorAll<HTMLButtonElement>("button.op-toggle"));
  for (const b of toggles) {
    b.disabled = false;
    b.addEventListener("click", () => {
      const s = Number(b.dataset.s);
      if (!hidden.has(s) && hidden.size === spec.series.length - 1) return; // keep one series visible
      if (hidden.has(s)) hidden.delete(s);
      else hidden.add(s);
      b.setAttribute("aria-pressed", String(!hidden.has(s)));
      draw(true);
    });
  }

  const ro = new ResizeObserver(() => draw());
  ro.observe(body);
  draw();
  return () => ro.disconnect();
}
