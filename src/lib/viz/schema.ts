import { z } from "zod";
import { datasetSchema } from "@/lib/charts/spec";

// Custom visualization input. The code is untrusted no matter who wrote it: it
// is never sanitized into the post, only ever executed inside the sandboxed
// frame (lib/viz/frame.ts). These checks keep the frame document well-formed
// and close obvious escape hatches (navigation, external loads); the sandbox
// and CSP are the actual security boundary.

export const VIZ_LIMITS = { html: 100_000, css: 100_000, js: 200_000, dataBytes: 500_000, perSite: 50 } as const;

/** Tags that load, navigate or nest documents. Build DOM from `js` instead. */
const FORBIDDEN_HTML = /<\s*\/?\s*(script|meta|base|link|iframe|frame|frameset|object|embed|form|portal|applet)\b/i;

const html = z
  .string()
  .max(VIZ_LIMITS.html)
  .refine((s) => !FORBIDDEN_HTML.test(s), "html may not contain <script>, <meta>, <base>, <link>, <iframe>, <object>, <embed> or <form>. Put code in `js` and inline any assets as data: URLs");
const css = z
  .string()
  .max(VIZ_LIMITS.css)
  .refine((s) => !/<\/style/i.test(s), "css may not contain </style")
  .refine((s) => !/@import/i.test(s), "css may not @import (no network access in the sandbox)");
const js = z
  .string()
  .max(VIZ_LIMITS.js)
  .refine((s) => !/<\/script/i.test(s), 'js may not contain "</script"; write "<\\/script" inside strings');
const data = z
  .unknown()
  .refine((v) => v === undefined || JSON.stringify(v).length <= VIZ_LIMITS.dataBytes, `data must serialize to at most ${VIZ_LIMITS.dataBytes} bytes of JSON`)
  .describe("Any JSON. Available in the frame as window.OpenPress.data. Updating only data keeps the approval");

export const customVizInput = z
  .object({
    title: z.string().trim().min(1).max(120).describe("Shown above the visualization and used as the frame's accessible name"),
    description: z.string().trim().max(500).optional().describe("What it shows, in words: the screen-reader summary and the no-JS fallback"),
    html: html.optional().describe("Markup for <body>. No scripts, external resources or forms"),
    css: css.optional().describe("Styles. Use var(--op-fg), var(--op-bg), var(--op-accent), var(--op-font) to match the site theme"),
    js: js.describe(
      "Self-contained JavaScript (no imports, no network: fetch/XHR/WebSocket and external URLs are blocked). Read window.OpenPress.data; call OpenPress.onTheme(fn) for theme changes; the frame auto-resizes to its content (or call OpenPress.resize())",
    ),
    data: data.optional(),
    table: datasetSchema.optional().describe("Accessible data table shown under the frame ({fields, rows}, same format as a chart dataset). Strongly recommended"),
    height: z.number().int().min(120).max(1600).optional().describe("Initial frame height in px (default 420)"),
  })
  .strict();

export const customVizPatch = z
  .object({
    title: customVizInput.shape.title,
    description: z.string().trim().max(500).nullable(),
    html: html.nullable(),
    css: css.nullable(),
    js,
    data: data.nullable(),
    table: datasetSchema.nullable(),
    height: z.number().int().min(120).max(1600).nullable(),
  })
  .partial()
  .strict();

export const CODE_FIELDS = ["html", "css", "js"] as const;
