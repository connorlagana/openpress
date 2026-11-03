// The sandbox document for a custom visualization. Security model (see
// docs/SECURITY.md#custom-visualizations):
// - The response carries CSP `sandbox allow-scripts`, so even when opened
//   directly (not framed) the document gets an opaque origin: no cookies, no
//   storage, no access to any OpenPress origin, no popups, no top navigation,
//   no forms. The embedding <iframe> repeats sandbox="allow-scripts".
// - Network is closed: default-src 'none', connect-src 'none'; only data:/blob:
//   images/fonts/media. Scripts need the per-response nonce, so markup in `html`
//   can't run code (inline handlers are blocked too).
// - frame-ancestors limits embedding to the owning site and the dashboard.
// - It is served from VIZ_SANDBOX_ORIGIN (ideally its own registrable domain).

import { specJson } from "@/lib/charts/render";

export type FrameCode = { title: string; html: string; css: string; js: string; data: unknown };

export function frameCsp(nonce: string, ancestors: string[]): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "font-src data:",
    "media-src data: blob:",
    "connect-src 'none'",
    "worker-src 'none'",
    "frame-src 'none'",
    "child-src 'none'",
    "object-src 'none'",
    "manifest-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    `frame-ancestors ${ancestors.join(" ")}`,
    "sandbox allow-scripts",
  ].join("; ");
}

export const FRAME_PERMISSIONS_POLICY = [
  "accelerometer", "ambient-light-sensor", "autoplay", "battery", "bluetooth", "camera", "display-capture", "encrypted-media",
  "fullscreen", "gamepad", "geolocation", "gyroscope", "hid", "idle-detection", "magnetometer", "microphone", "midi", "payment",
  "publickey-credentials-get", "screen-wake-lock", "serial", "usb", "web-share", "xr-spatial-tracking",
].map((f) => `${f}=()`).join(", ");

/** The tiny runtime every frame gets: data, theme, auto-resize. Parent messages are only {type, height}. */
const RUNTIME = `(function(){
var el=document.getElementById("op-data");var data=null;try{data=JSON.parse(el?el.textContent:"null")}catch(e){}
var fns=[];var theme={fg:"#1c1c1c",bg:"#ffffff",accent:"#2a78d6",font:"system-ui, sans-serif",dark:false};
var last=0;function resize(h){var n=Math.ceil(h||document.documentElement.scrollHeight);if(n===last)return;last=n;parent.postMessage({type:"op-viz:resize",height:n},"*")}
function apply(t){var s=document.documentElement.style;s.setProperty("--op-fg",t.fg);s.setProperty("--op-bg",t.bg);s.setProperty("--op-accent",t.accent);s.setProperty("--op-font",t.font);document.documentElement.classList.toggle("op-dark",!!t.dark)}
apply(theme);
window.addEventListener("message",function(e){if(e.source!==parent)return;var m=e.data;if(!m||m.type!=="op-viz:theme")return;
["fg","bg","accent","font"].forEach(function(k){if(typeof m[k]==="string"&&m[k].length<200&&!/[;{}<>]/.test(m[k]))theme[k]=m[k]});theme.dark=!!m.dark;apply(theme);fns.forEach(function(f){try{f(theme)}catch(err){console.error(err)}})});
window.OpenPress=Object.freeze({data:data,get theme(){return Object.assign({},theme)},onTheme:function(f){if(typeof f==="function")fns.push(f)},resize:resize});
if(typeof ResizeObserver==="function")new ResizeObserver(function(){resize()}).observe(document.documentElement);
window.addEventListener("load",function(){resize()});
})();`;

export function frameDocument(code: FrameCode, nonce: string): string {
  const title = code.title.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>html{color-scheme:light dark}body{margin:0;font-family:var(--op-font);color:var(--op-fg);background:transparent}*{box-sizing:border-box}</style>
<style>${code.css}</style></head><body>${code.html}
<script type="application/json" id="op-data">${specJson(code.data ?? null)}</script>
<script nonce="${nonce}">${RUNTIME}</script>
<script nonce="${nonce}">${code.js}</script>
</body></html>`;
}
