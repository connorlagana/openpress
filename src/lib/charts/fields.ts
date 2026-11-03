// Sport field presets for scatter plots (shot charts) and spatial heatmaps.
// Each preset fixes a documented data coordinate system (capabilities.ts lists
// them for agents) and draws its markings as polylines in those coordinates,
// so any projection (horizontal, rotated vertical, half-field clip) just works.

import type { FieldPreset, FieldSpec } from "./types";

export type Domain = { x0: number; x1: number; y0: number; y1: number };
type Pt = [number, number];
type Shape = { pts: Pt[]; closed?: boolean; cls?: "op-mk" | "op-mk-fill" | "op-mk-thin" };
type Label = { x: number; y: number; text: string };

export type FieldDef = {
  units: string;
  full: Domain;
  half?: Domain;
  /** Which end of the x axis sits at the top when drawn vertically. */
  verticalTop: "low" | "high";
  defaultVertical: { full: boolean; half: boolean };
  coordinates: string;
  shapes(): Shape[];
  labels?(): Label[];
};

const rect = (x0: number, y0: number, x1: number, y1: number, cls?: Shape["cls"]): Shape => ({ pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], closed: true, cls });
const seg = (x0: number, y0: number, x1: number, y1: number, cls?: Shape["cls"]): Shape => ({ pts: [[x0, y0], [x1, y1]], cls });
function arc(cx: number, cy: number, r: number, a0: number, a1: number, cls?: Shape["cls"], n = 40): Shape {
  const pts: Pt[] = [];
  for (let k = 0; k <= n; k++) {
    const a = a0 + ((a1 - a0) * k) / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return { pts, cls };
}
const circle = (cx: number, cy: number, r: number, cls?: Shape["cls"]): Shape => ({ ...arc(cx, cy, r, 0, 2 * Math.PI, cls, 48), closed: true });
const deg = Math.PI / 180;

const football: FieldDef = {
  units: "yards",
  full: { x0: 0, x1: 120, y0: 0, y1: 53.3 },
  half: { x0: 60, x1: 120, y0: 0, y1: 53.3 },
  verticalTop: "high",
  defaultVertical: { full: false, half: true },
  coordinates: "x 0-120 yards along the field (0-10 and 110-120 are end zones, 60 is midfield); y 0-53.3 across, from the bottom sideline. Half variant shows x 60-120.",
  shapes() {
    const s: Shape[] = [rect(0, 0, 120, 53.3), rect(0, 0, 10, 53.3, "op-mk-fill"), rect(110, 0, 120, 53.3, "op-mk-fill")];
    for (let x = 10; x <= 110; x += 5) s.push(seg(x, 0, x, 53.3, x % 10 === 0 ? "op-mk" : "op-mk-thin"));
    for (let x = 11; x < 110; x++) {
      if (x % 5 === 0) continue;
      for (const y of [0, 23.58, 29.05, 52.63]) s.push(seg(x, y, x, y + 0.67, "op-mk-thin"));
    }
    return s;
  },
  labels() {
    const out: Label[] = [];
    for (let x = 20; x <= 100; x += 10) {
      const n = String(50 - Math.abs(60 - x));
      out.push({ x, y: 9, text: n }, { x, y: 44.3, text: n });
    }
    return out;
  },
};

function basketballEnd(mirror: boolean): Shape[] {
  const X = (x: number) => (mirror ? 94 - x : x);
  const dir = mirror ? Math.PI : 0;
  const s: Shape[] = [
    rect(X(0), 17, X(19), 33, "op-mk"),
    arc(X(19), 25, 6, dir - 90 * deg, dir + 90 * deg),
    arc(X(19), 25, 6, dir + 90 * deg, dir + 270 * deg, "op-mk-thin"),
    circle(X(5.25), 25, 0.75),
    seg(X(4), 22, X(4), 28),
    arc(X(5.25), 25, 4, dir - 90 * deg, dir + 90 * deg),
    seg(X(0), 3, X(14.2), 3),
    seg(X(0), 47, X(14.2), 47),
  ];
  const a = Math.asin(22 / 23.75);
  s.push(arc(X(5.25), 25, 23.75, dir - a, dir + a, "op-mk", 60));
  return s;
}

const basketball: FieldDef = {
  units: "feet",
  full: { x0: 0, x1: 94, y0: 0, y1: 50 },
  half: { x0: 0, x1: 47, y0: 0, y1: 50 },
  verticalTop: "low",
  defaultVertical: { full: false, half: true },
  coordinates:
    "NBA court in feet: x 0-94 baseline to baseline, y 0-50 sideline to sideline. Hoops at (5.25, 25) and (88.75, 25). Half variant shows x 0-47 (the hoop at x 5.25) and draws it vertically, hoop at the top, by default.",
  shapes: () => [rect(0, 0, 94, 50), seg(47, 0, 47, 50), circle(47, 25, 6), ...basketballEnd(false), ...basketballEnd(true)],
};

function soccerEnd(mirror: boolean): Shape[] {
  const X = (x: number) => (mirror ? 105 - x : x);
  const dir = mirror ? Math.PI : 0;
  const a = Math.acos(5.5 / 9.15);
  return [
    rect(X(0), 34 - 20.16, X(16.5), 34 + 20.16),
    rect(X(0), 34 - 9.16, X(5.5), 34 + 9.16),
    rect(X(-2), 34 - 3.66, X(0), 34 + 3.66, "op-mk-thin"),
    circle(X(11), 34, 0.3, "op-mk-fill"),
    arc(X(11), 34, 9.15, dir - a, dir + a),
    arc(X(0), 0, 1, dir, dir + (mirror ? -90 : 90) * deg, "op-mk-thin", 8),
    arc(X(0), 68, 1, dir, dir + (mirror ? 90 : -90) * deg, "op-mk-thin", 8),
  ];
}

const soccer: FieldDef = {
  units: "meters",
  full: { x0: -2, x1: 107, y0: 0, y1: 68 },
  half: { x0: 52.5, x1: 107, y0: 0, y1: 68 },
  verticalTop: "high",
  defaultVertical: { full: false, half: true },
  coordinates: "Pitch in meters: x 0-105 goal line to goal line (attacking toward x 105), y 0-68 touchline to touchline. Goals centered at y 34. Half variant shows the attacking half (x 52.5-105), goal at the top by default.",
  shapes: () => [rect(0, 0, 105, 68), seg(52.5, 0, 52.5, 68), circle(52.5, 34, 9.15), circle(52.5, 34, 0.3, "op-mk-fill"), ...soccerEnd(false), ...soccerEnd(true)],
};

const fenceR = (a: number) => 330 + 70 * Math.cos((a - Math.PI / 2) * 2) ** 2;

const baseball: FieldDef = {
  units: "feet",
  full: { x0: -250, x1: 250, y0: -15, y1: 415 },
  verticalTop: "high",
  defaultVertical: { full: false, half: false },
  coordinates: "Feet from home plate at (0, 0): y toward center field, x positive toward first base / right field. Foul lines run at 45°; bases are 90 ft apart; the fence is ~330 ft down the lines and 400 ft to center.",
  shapes() {
    const fence: Pt[] = [];
    for (let k = 0; k <= 60; k++) {
      const a = (45 + (90 * k) / 60) * deg;
      fence.push([fenceR(a) * Math.cos(a), fenceR(a) * Math.sin(a)]);
    }
    const rf = fence[0];
    const lf = fence[fence.length - 1];
    const infield: Pt[] = [];
    for (let k = 0; k <= 60; k++) {
      const a = (-10 + (200 * k) / 60) * deg;
      const p: Pt = [95 * Math.cos(a), 60.5 + 95 * Math.sin(a)];
      if (p[1] >= Math.abs(p[0]) - 0.01) infield.push(p);
    }
    const b = 63.64;
    return [
      { pts: [[0, 0], rf], cls: "op-mk" },
      { pts: [[0, 0], lf], cls: "op-mk" },
      { pts: fence, cls: "op-mk" },
      { pts: infield, cls: "op-mk-thin" },
      { pts: [[0, 0], [b, b], [0, 2 * b], [-b, b]], closed: true, cls: "op-mk" },
      circle(0, 60.5, 9, "op-mk-thin"),
      ...[[b, b], [0, 2 * b], [-b, b]].map(([x, y]) => rect(x - 1.5, y - 1.5, x + 1.5, y + 1.5, "op-mk-fill")),
    ];
  },
};

export const FIELDS: Record<FieldPreset, FieldDef> = { football, basketball, soccer, baseball };

export type FieldFrame = {
  domain: Domain;
  vertical: boolean;
  W: number;
  H: number;
  project(x: number, y: number): Pt;
  /** Data units → pixels. */
  k: number;
};

/** Fit the field (or its half) into width W, keeping its true aspect ratio. */
export function fieldFrame(field: FieldSpec, W: number, pad = 8): FieldFrame {
  const def = FIELDS[field.preset];
  const variant = field.variant === "half" && def.half ? "half" : "full";
  const domain = variant === "half" ? def.half! : def.full;
  const vertical = field.preset !== "baseball" && (field.orientation === "vertical" || ((field.orientation ?? "auto") === "auto" && def.defaultVertical[variant]));
  const dw = domain.x1 - domain.x0;
  const dh = domain.y1 - domain.y0;
  const across = vertical ? dh : dw;
  const along = vertical ? dw : dh;
  // Tall fields are capped so a phone screen still shows the whole thing.
  const k = Math.min((W - 2 * pad) / across, (Math.max(W, 420) * 1.1 - 2 * pad) / along);
  const plotW = across * k;
  const H = Math.round(along * k + 2 * pad);
  const left = (W - plotW) / 2;
  const project = (x: number, y: number): Pt => {
    if (!vertical) return [left + (x - domain.x0) * k, pad + (domain.y1 - y) * k];
    // Rotations (not mirror images) of the horizontal view.
    return def.verticalTop === "low" ? [left + (y - domain.y0) * k, pad + (x - domain.x0) * k] : [left + (domain.y1 - y) * k, pad + (domain.x1 - x) * k];
  };
  return { domain, vertical, W, H, project, k };
}

const f1 = (n: number) => Math.round(n * 10) / 10;

/** Field markings as SVG: one <path> per line style, plus yard numbers. */
export function fieldMarkingsSvg(field: FieldSpec, frame: FieldFrame): string {
  const def = FIELDS[field.preset];
  const groups = new Map<string, string[]>();
  const { domain } = frame;
  for (const s of def.shapes()) {
    const cls = s.cls ?? "op-mk";
    const d = s.pts.map((p, i) => `${i ? "L" : "M"}${frame.project(p[0], p[1]).map(f1).join(" ")}`).join("") + (s.closed ? "Z" : "");
    groups.set(cls, [...(groups.get(cls) ?? []), d]);
  }
  const out = [...groups].map(([cls, ds]) => `<path class="${cls}" d="${ds.join("")}"/>`);
  const inside = (x: number, y: number) => x >= domain.x0 && x <= domain.x1 && y >= domain.y0 && y <= domain.y1;
  const size = Math.max(9, Math.min(16, frame.k * 2.4));
  for (const l of def.labels?.() ?? []) {
    if (!inside(l.x, l.y)) continue;
    const [x, y] = frame.project(l.x, l.y);
    out.push(`<text class="op-mk-num" x="${f1(x)}" y="${f1(y)}" dy="0.35em" text-anchor="middle" font-size="${f1(size)}">${l.text}</text>`);
  }
  return `<g class="op-field${field.look === "turf" ? " op-field-turf" : ""}" aria-hidden="true">${out.join("")}</g>`;
}
