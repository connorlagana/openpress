# Visualizations

Agents make charts by sending **data and configuration** over MCP. OpenPress draws them: themed, accessible SVG with tooltips, keyboard navigation, filters and a data table. No JavaScript is needed for the supported types. For anything those types can't express there is an optional, approval-gated **custom visualization**: agent-written HTML/CSS/JS run in a sandboxed iframe.

## Tools

| Tool | Purpose |
| --- | --- |
| `get_visualization_capabilities` | Self-describing schema: chart types, data models, filters, color scales, field presets and their coordinates, limits, validated examples, whether custom code is enabled. `includeJsonSchema: true` adds the full JSON Schema. |
| `create_chart` / `update_chart` / `get_chart` / `list_charts` / `delete_chart` | Declarative charts. `update_chart` replaces whole top-level keys (`null` clears one) and re-validates the merged chart. |
| `create_custom_visualization` / `update_…` / `get_…` / `list_…` / `delete_…` | Only registered when `CUSTOM_VIZ=on`. |

Embed with the returned token on its own line in post Markdown: `{{chart:<id>}}` or `{{viz:<id>}}`. Tokens are swapped for the visualization **at read time**, so updates go live in every embedding post without republishing.

## Chart spec (schema version 2)

v2 is a strict superset of v1: every v1 spec (`labels` + `series`, no `version`) is still valid and draws byte-for-byte as before (`tests/unit/fixtures/v1-charts.json`). Stored specs are stamped `version: 2` on their next write; `parseStoredSpec` is where future migrations go.

| Key | |
| --- | --- |
| `type` | `line`, `area`, `bar`, `pie`, `donut`, `scatter`, `heatmap`, `spatial_heatmap` |
| `labels` + `series` | Inline data (line/area/bar/pie/donut/heatmap) |
| `dataset` | `{fields: [{name, type: number\|string\|date, label?, format?}], rows}`. Rows as arrays or objects. ≤ 5,000 rows, 16 fields, 60k cells |
| `encoding` | `x`, `y` (field or fields), `series`, `value`, `size`, `color`, `label`, `aggregate` (`sum` default, `mean`, `count`, `min`, `max`, `last`) |
| `filters` | ≤ 4 reader controls on any dataset field: `select` (default), `buttons` (multi), `range` (default for dates). `default`, `allowAll` |
| `style` | `colors` (hex per series), `colorScale` (`scheme`, custom `colors` stops, `domain` 2 or 3 values, `reverse`, `steps`), `background`, `legend` (`show`, `position`, `title`), `tooltip` (`show`, extra `fields`), `markSize`, `opacity`, `showValues`, `showLabels` |
| `field` | `preset`: `football`, `basketball`, `soccer`, `baseball`; `variant` `full`/`half`; `orientation`; `look` `minimal`/`turf` |
| `spatial` | `binSize`, `aggregate` (`count`/`sum`/`mean`), `smoothing` (Gaussian, in bins) |
| `annotations.lines` | Reference lines `{axis, value, label}` |

Colors are validated hex only (never CSS); every string is escaped; unknown keys are rejected. Long/tidy data (one row per observation with columns like `player, season, metric, value`) makes filtering by any dimension, including "metric", a plain `select` filter.

### Field coordinates

| Preset | Coordinates |
| --- | --- |
| football | yards; x 0–120 (end zones 0–10, 110–120), y 0–53.3 |
| basketball | feet; x 0–94, y 0–50, hoops at (5.25, 25) and (88.75, 25); `half` = x 0–47, drawn vertically with the hoop on top |
| soccer | meters; x 0–105 (attacking toward 105), y 0–68; `half` = attacking half, goal on top |
| baseball | feet from home plate (0, 0); y toward center field, foul lines at 45° |

## How rendering works

`src/lib/charts/` is pure TypeScript shared by server and browser:

- `spec.ts` validates (Zod). `data.ts` filters rows and derives the view (`resolveView`). `render.ts` draws line/area/bar/pie and assembles the figure; `plots.ts` draws scatter, heatmaps and spatial heatmaps; `fields.ts` draws sports surfaces; `color.ts` builds color scales (OKLab interpolation; the default `theme` ramp is CSS `color-mix()` so it flips in dark mode).
- The server renders the default filter state as SVG plus legend, filter controls (disabled), data table and an inert JSON copy of the spec.
- `src/templates/chart-enhancer.tsx` re-runs the same renderer in the browser: real-width redraws, filtering without reloads, tooltips (built with `textContent`), arrow-key navigation (2D for heatmaps and scatter), series toggles, a live record count and a table that follows the filters.

We kept the in-house renderer instead of adopting Apache ECharts. It already server-renders accessible, crawlable SVG that works without JS, it adds no bundle weight on Cloudflare Workers, and existing embeds stay identical. ECharts would have meant a rewrite plus a large client bundle, and its SSR output is less accessible.

## Custom visualizations

Off unless `CUSTOM_VIZ=on`. Flow: an agent calls `create_custom_visualization` and gets status `pending_approval` plus an `approvalUrl`. A site member reviews the code and a sandboxed preview in **Dashboard → Visualizations** and approves the exact code (bound to its SHA-256). Only then does `{{viz:<id>}}` render an iframe. Changing `html`/`css`/`js` resets approval; `data`, `table`, `title`, `description` and `height` updates keep it. Until approval, while the flag is off, and in RSS, readers get the title, description and `table`.

Frame runtime: `window.OpenPress = { data, theme, onTheme(fn), resize(h?) }`, plus CSS variables `--op-fg`, `--op-bg`, `--op-accent` and `--op-font`. Security model: [SECURITY.md](./SECURITY.md#custom-visualizations).

## Demo and tests

- `src/lib/charts/demo.ts` holds synthetic sports data covering every type, filter, color scale and preset. `pnpm demo:viz <email>` publishes them all to that user's site.
- `tests/unit/visualizations.test.ts` covers the schema, v1 byte compatibility, filtering, rendering, color, accessibility markup, escaping, sandbox CSP and the document.
- `tests/integration/visualizations.test.ts` covers MCP, live updates, legacy rows, approval, the frame route, isolation and RSS.
- `tests/e2e/visualizations.spec.ts` covers real-browser filtering, keyboard, touch and phone layout. It also checks that the sandbox probe can't read cookies, storage or the parent page, open popups, or reach the network. Screenshots: `SCREENSHOT_DIR=… pnpm test:e2e visualizations`.
