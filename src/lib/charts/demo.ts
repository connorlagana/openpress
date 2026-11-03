// Synthetic demo visualizations: deterministic, made-up sports data (no real
// players or teams) that exercises every chart type, filter control, color
// scale and field preset. Used by tests, the e2e screenshot tour and
// `pnpm demo:viz` to verify rendering end to end.

import type { ChartSpec } from "./types";

function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = (mu = 0, sd = 1) => mu + sd * Math.sqrt(-2 * Math.log(next() || 1e-9)) * Math.cos(2 * Math.PI * next());
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)];
  return { next, normal, pick };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const r1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const TEAMS = ["Harbor Hawks", "Ridge Rams", "Delta Owls", "Summit Bears", "Coast Pilots", "Prairie Foxes", "Iron Bison", "Lake Herons"];
const QBS = ["J. Calder", "M. Okafor", "T. Brandt", "R. Vasquez", "D. Lindqvist", "K. Osei", "S. Moreau", "A. Petrov", "L. Haddad", "C. Nakamura", "B. Ferreira", "N. Kowalski"];

export function demoQbScatter(): ChartSpec {
  const r = rng(7);
  const rows: (string | number)[][] = [];
  for (const season of [2022, 2023, 2024])
    QBS.forEach((p, i) => {
      const skill = (i % 5) * 0.04 - 0.06;
      rows.push([p, TEAMS[i % TEAMS.length], season, r2(skill + r.normal(0, 0.06) + (season - 2022) * 0.01), r1(skill * 30 + r.normal(0, 2)), Math.round(clamp(r.normal(500, 70), 300, 700))]);
    });
  return {
    type: "scatter",
    title: "Quarterback efficiency vs. accuracy",
    subtitle: "EPA per play against completion % over expected (synthetic data)",
    description: "Each dot is a quarterback-season; dots further up and right were both efficient and accurate.",
    source: "OpenPress demo data",
    dataset: {
      fields: [
        { name: "player", type: "string", label: "Quarterback" },
        { name: "team", type: "string", label: "Team" },
        { name: "season", type: "number", label: "Season" },
        { name: "epa", type: "number", label: "EPA/play", format: { decimals: 2 } },
        { name: "cpoe", type: "number", label: "CPOE", format: { suffix: "%", decimals: 1 } },
        { name: "att", type: "number", label: "Attempts" },
      ],
      rows,
    },
    encoding: { x: "cpoe", y: "epa", label: "player", size: "att" },
    filters: [{ field: "season", allowAll: false, default: 2024 }],
    xAxis: { title: "CPOE" },
    yAxis: { title: "EPA per play" },
    style: { showLabels: true, tooltip: { fields: ["team"] } },
    annotations: { lines: [{ axis: "x", value: 0 }, { axis: "y", value: 0, label: "Average" }] },
  };
}

const PLAYERS = ["Guard A", "Wing B", "Big C"];
export function demoShotHeatmap(): ChartSpec {
  const r = rng(11);
  const rows: (string | number)[][] = [];
  const hoop = { x: 5.25, y: 25 };
  for (const season of ["2023-24", "2024-25"])
    PLAYERS.forEach((player, pi) => {
      const mix = [
        [0.55, 0.3, 0.15],
        [0.25, 0.25, 0.5],
        [0.75, 0.2, 0.05],
      ][pi];
      for (let k = 0; k < 260; k++) {
        const u = r.next();
        let x: number;
        let y: number;
        if (u < mix[0]) {
          x = hoop.x + Math.abs(r.normal(0, 2.2));
          y = hoop.y + r.normal(0, 2.5);
        } else if (u < mix[0] + mix[1]) {
          const a = r.normal(0, 0.7);
          const d = clamp(r.normal(15, 3), 8, 21);
          x = hoop.x + Math.abs(Math.cos(a) * d);
          y = hoop.y + Math.sin(a) * d;
        } else {
          const a = (r.next() - 0.5) * 2.6;
          const d = 24 + Math.abs(r.normal(0, 1.2));
          x = Math.max(0.5, hoop.x + Math.cos(a) * d);
          y = clamp(hoop.y + Math.sin(a) * d, 1.5, 48.5);
        }
        const dist = Math.hypot(x - hoop.x, y - hoop.y);
        const made = r.next() < (dist < 5 ? 0.62 : dist < 22 ? 0.42 : 0.36) ? 1 : 0;
        rows.push([player, season, r1(clamp(x, 0, 47)), r1(clamp(y, 0, 50)), made]);
      }
    });
  return {
    type: "spatial_heatmap",
    title: "Where the shots come from",
    subtitle: "Shot density, half court (synthetic data)",
    description: "Density of field-goal attempts by court location; brighter areas saw more attempts.",
    dataset: {
      fields: [
        { name: "player", type: "string", label: "Player" },
        { name: "season", type: "string", label: "Season" },
        { name: "x", type: "number" },
        { name: "y", type: "number" },
        { name: "made", type: "number", label: "Made" },
      ],
      rows,
    },
    encoding: { x: "x", y: "y" },
    field: { preset: "basketball", variant: "half" },
    filters: [
      { field: "player", label: "Player" },
      { field: "season", control: "buttons" },
    ],
    style: { legend: { title: "Shot density" } },
  };
}

export function demoSoccerShots(): ChartSpec {
  const r = rng(23);
  const rows: (string | number)[][] = [];
  for (const team of TEAMS.slice(0, 3))
    for (let k = 0; k < 40; k++) {
      const x = clamp(105 - Math.abs(r.normal(13, 7)), 70, 104);
      const y = clamp(r.normal(34, 9), 8, 60);
      const d = Math.hypot(105 - x, 34 - y);
      const xg = r2(clamp(0.9 * Math.exp(-d / 8) + r.normal(0, 0.03), 0.01, 0.95));
      const u = r.next();
      rows.push([team, r1(x), r1(y), xg, u < xg ? "Goal" : u < xg + 0.35 ? "Saved" : "Missed"]);
    }
  return {
    type: "scatter",
    title: "Shot map",
    subtitle: "Size and color show expected goals (synthetic data)",
    dataset: {
      fields: [
        { name: "team", type: "string", label: "Team" },
        { name: "x", type: "number" },
        { name: "y", type: "number" },
        { name: "xg", type: "number", label: "xG", format: { decimals: 2 } },
        { name: "outcome", type: "string", label: "Outcome" },
      ],
      rows,
    },
    encoding: { x: "x", y: "y", size: "xg", color: "xg", label: "outcome" },
    field: { preset: "soccer", variant: "half", look: "turf" },
    filters: [{ field: "team", control: "buttons" }],
    style: { colorScale: { scheme: "heat" }, legend: { title: "xG" }, opacity: 0.9 },
  };
}

export function demoPointsHeatmap(): ChartSpec {
  const r = rng(31);
  const rows: (string | number)[][] = [];
  for (const season of [2023, 2024])
    TEAMS.forEach((team, ti) => {
      for (let w = 1; w <= 17; w++) rows.push([season, team, w, Math.max(3, Math.round(r.normal(22 + (ti % 4) * 2, 8)))]);
    });
  return {
    type: "heatmap",
    title: "Points scored by week",
    subtitle: "Darker = more points (synthetic data)",
    dataset: {
      fields: [
        { name: "season", type: "number", label: "Season" },
        { name: "team", type: "string", label: "Team" },
        { name: "week", type: "number", label: "Week" },
        { name: "pts", type: "number", label: "Points" },
      ],
      rows,
    },
    encoding: { x: "week", y: "team", value: "pts" },
    filters: [{ field: "season", allowAll: false, default: 2024 }],
    xAxis: { title: "Week" },
    style: { colorScale: { steps: 6 }, legend: { title: "Points" } },
  };
}

export function demoDifferentialHeatmap(): ChartSpec {
  const r = rng(37);
  const labels = Array.from({ length: 10 }, (_, i) => `Wk ${i + 1}`);
  return {
    type: "heatmap",
    title: "Point differential",
    subtitle: "Diverging scale centered on zero (synthetic data)",
    labels,
    series: TEAMS.slice(0, 6).map((name) => ({ name, data: labels.map(() => Math.round(r.normal(0, 11))) })),
    valueFormat: { decimals: 0 },
    style: { colorScale: { scheme: "redBlue", domain: [-21, 0, 21] }, showValues: true, legend: { title: "Margin" } },
  };
}

export function demoPassTargets(): ChartSpec {
  const r = rng(41);
  const rows: number[][] = [];
  for (let k = 0; k < 700; k++) {
    // Catches cluster a few yards past a line of scrimmage near midfield, outside the numbers or over the middle.
    const los = clamp(r.normal(50, 10), 25, 85);
    const depth = Math.abs(r.normal(6, 6));
    rows.push([r1(clamp(los + depth, 11, 109)), r1(clamp(r.pick([9, 26.6, 44]) + r.normal(0, 4), 1, 52.3)), Math.round(depth + Math.abs(r.normal(3, 4)))]);
  }
  return {
    type: "spatial_heatmap",
    title: "Where completions were caught",
    subtitle: "Weighted by yards gained (synthetic data)",
    dataset: {
      fields: [
        { name: "x", type: "number" },
        { name: "y", type: "number" },
        { name: "yards", type: "number", label: "Yards" },
      ],
      rows,
    },
    encoding: { x: "x", y: "y", value: "yards" },
    field: { preset: "football" },
    spatial: { smoothing: 1, binSize: 2.5 },
    style: { colorScale: { scheme: "heat" }, legend: { title: "Yards gained" } },
  };
}

export function demoSprayChart(): ChartSpec {
  const r = rng(53);
  const rows: (string | number)[][] = [];
  for (let k = 0; k < 160; k++) {
    const a = ((45 + r.next() * 90) * Math.PI) / 180;
    const u = r.next();
    const [type, d] = u < 0.45 ? ["Out", r.normal(220, 90)] : u < 0.75 ? ["Single", r.normal(170, 50)] : u < 0.92 ? ["Double", r.normal(300, 40)] : ["Home run", r.normal(395, 20)];
    const dist = clamp(d as number, 40, 440);
    rows.push([type as string, r1(Math.cos(a) * dist), r1(Math.sin(a) * dist), Math.round(dist)]);
  }
  return {
    type: "scatter",
    title: "Spray chart",
    subtitle: "Batted balls by result (synthetic data)",
    dataset: {
      fields: [
        { name: "result", type: "string", label: "Result" },
        { name: "x", type: "number" },
        { name: "y", type: "number" },
        { name: "dist", type: "number", label: "Distance", format: { suffix: " ft" } },
      ],
      rows,
    },
    encoding: { x: "x", y: "y", series: "result" },
    field: { preset: "baseball" },
    style: { colors: ["#9ca3af", "#2a78d6", "#1baf7a", "#e34948"], markSize: 4, tooltip: { fields: ["dist"] } },
  };
}

export function demoTrendWithFilters(): ChartSpec {
  const r = rng(61);
  const rows: (string | number)[][] = [];
  const start = Date.UTC(2024, 8, 8);
  for (let w = 0; w < 18; w++) {
    const date = new Date(start + w * 7 * 86400000).toISOString().slice(0, 10);
    TEAMS.slice(0, 3).forEach((team, ti) => {
      rows.push([date, team, "Points", Math.max(6, Math.round(r.normal(21 + ti * 3, 7)))]);
      rows.push([date, team, "Total yards", Math.max(150, Math.round(r.normal(330 + ti * 20, 55)))]);
    });
  }
  return {
    type: "line",
    title: "Weekly offense",
    subtitle: "Pick a metric and a date range (synthetic data)",
    dataset: {
      fields: [
        { name: "date", type: "date", label: "Game date" },
        { name: "team", type: "string", label: "Team" },
        { name: "metric", type: "string", label: "Metric" },
        { name: "value", type: "number", label: "Value" },
      ],
      rows,
    },
    encoding: { x: "date", y: "value", series: "team" },
    filters: [{ field: "metric", allowAll: false }, { field: "date" }],
    style: { legend: { position: "bottom" } },
  };
}

export function demoCustomBar(): ChartSpec {
  return {
    type: "bar",
    title: "Touchdowns by type",
    labels: ["2021", "2022", "2023", "2024"],
    series: [
      { name: "Passing", data: [36, 35, 29, 28] },
      { name: "Rushing", data: [6, 7, 15, 12] },
    ],
    stacked: true,
    style: { colors: ["#0f766e", "#f59e0b"], background: "#f8fafc", legend: { position: "bottom", title: "Type" } },
    annotations: { lines: [{ axis: "y", value: 40, label: "Franchise record" }] },
  };
}

export const DEMO_CHARTS: { key: string; build: () => ChartSpec }[] = [
  { key: "qb-scatter", build: demoQbScatter },
  { key: "shot-heatmap", build: demoShotHeatmap },
  { key: "soccer-shots", build: demoSoccerShots },
  { key: "points-heatmap", build: demoPointsHeatmap },
  { key: "differential-heatmap", build: demoDifferentialHeatmap },
  { key: "pass-targets", build: demoPassTargets },
  { key: "spray-chart", build: demoSprayChart },
  { key: "trend-filters", build: demoTrendWithFilters },
  { key: "custom-bar", build: demoCustomBar },
];

/** A custom visualization (radial win-probability clock) written the way an agent would. */
export const DEMO_CUSTOM_VIZ = {
  title: "Win probability clock",
  description: "Home win probability through four quarters, drawn as a radial clock. The table lists every sample.",
  css: ".wp{display:grid;place-items:center;padding:8px} svg{width:min(100%,360px);height:auto} text{fill:var(--op-fg);font:12px var(--op-font)} .ring{fill:none;stroke:color-mix(in srgb,var(--op-fg) 15%,transparent)}",
  html: '<div class="wp"><svg viewBox="0 0 320 320" role="img" aria-label="Radial win probability chart"><g id="g"></g></svg></div>',
  js: `const d = OpenPress.data; const g = document.getElementById("g"); const ns = "http://www.w3.org/2000/svg";
const el = (t, a) => { const e = document.createElementNS(ns, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
const cx = 160, cy = 160, r0 = 50, r1 = 140;
for (const p of [0.25, 0.5, 0.75, 1]) g.append(el("circle", { cx, cy, r: r0 + (r1 - r0) * p, class: "ring" }));
const pts = d.samples.map((s, i) => { const a = -Math.PI / 2 + (i / d.samples.length) * 2 * Math.PI; const r = r0 + (r1 - r0) * s.p; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
const path = el("path", { d: "M" + pts.map((p) => p.join(" ")).join("L") + "Z", fill: "none", "stroke-width": 2.5 });
path.style.stroke = "var(--op-accent)"; g.append(path);
const t = el("text", { x: cx, y: cy + 4, "text-anchor": "middle" }); t.textContent = d.home + " " + Math.round(d.samples.at(-1).p * 100) + "%"; g.append(t);`,
  data: { home: "Hawks", samples: Array.from({ length: 48 }, (_, i) => ({ minute: i + 1, p: r2(clamp(0.5 + Math.sin(i / 7) * 0.25 + i / 200, 0.02, 0.98)) })) },
  table: {
    fields: [
      { name: "minute", type: "number" as const, label: "Minute" },
      { name: "p", type: "number" as const, label: "Home win probability", format: { suffix: "", decimals: 2 } },
    ],
    rows: Array.from({ length: 48 }, (_, i) => [i + 1, r2(clamp(0.5 + Math.sin(i / 7) * 0.25 + i / 200, 0.02, 0.98))]),
  },
  height: 380,
};
