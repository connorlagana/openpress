// Parent-side glue for custom visualization frames (lib/viz). The frame is an
// opaque-origin sandbox, so messages arrive with origin "null": we trust a
// message only if it comes from *this* iframe's window, and only act on
// {type: "op-viz:resize", height} (clamped). We send the frame the site's theme
// colors; nothing else crosses the boundary. A frame that navigates itself
// away (a second load) is removed and the static fallback stays.

const MIN_H = 80;
const MAX_H = 2400;

export function enhanceViz(fig: HTMLElement): (() => void) | undefined {
  const iframe = fig.querySelector<HTMLIFrameElement>("iframe");
  const box = fig.querySelector<HTMLElement>(".op-viz-frame");
  if (!iframe || !box) return;
  let loads = 0;

  const theme = () => {
    const cs = getComputedStyle(fig);
    const pick = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
    const html = document.documentElement;
    const dark = html.classList.contains("fs-dark") || (html.classList.contains("fs-auto") && matchMedia("(prefers-color-scheme: dark)").matches);
    return { type: "op-viz:theme", fg: pick("--op-fg", "#1c1c1c"), bg: pick("--op-bg", "#ffffff"), accent: pick("--fs-primary", "#2a78d6"), font: pick("--fs-body-font", "system-ui, sans-serif"), dark };
  };

  const onMessage = (e: MessageEvent) => {
    if (e.source !== iframe.contentWindow) return;
    const m = e.data as { type?: unknown; height?: unknown } | null;
    if (!m || m.type !== "op-viz:resize" || typeof m.height !== "number" || !Number.isFinite(m.height)) return;
    box.style.height = `${Math.round(Math.min(MAX_H, Math.max(MIN_H, m.height)))}px`;
  };
  const onLoad = () => {
    loads++;
    if (loads > 1) {
      // The code navigated its frame somewhere else: stop it.
      iframe.remove();
      box.remove();
      fig.classList.add("op-viz-static");
      return;
    }
    iframe.contentWindow?.postMessage(theme(), "*");
  };
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onScheme = () => iframe.contentWindow?.postMessage(theme(), "*");

  window.addEventListener("message", onMessage);
  iframe.addEventListener("load", onLoad);
  mq.addEventListener("change", onScheme);
  // Load only once we are listening, so every navigation is counted.
  const src = iframe.dataset.src;
  if (src && /^https?:\/\//.test(src)) iframe.src = src;
  return () => {
    window.removeEventListener("message", onMessage);
    iframe.removeEventListener("load", onLoad);
    mq.removeEventListener("change", onScheme);
  };
}
