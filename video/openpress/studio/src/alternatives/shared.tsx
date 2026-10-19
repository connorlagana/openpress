import {
  CanvasImage,
  Easing,
  interpolate,
  interpolateColors,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/fonts";
loadFont({
  family: "Geist",
  url: staticFile("Geist.woff2"),
  weight: "100 900",
});
export const ink = "#202724";
export const green = "#24845c";
export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;
export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const p = (t: number, a: number, b: number) =>
  interpolate(t, [a, b], [0, 1], { ...clamp, easing: ease });
export const lerp = (a: number, b: number, v: number) => a + (b - a) * v;
export const range = (t: number, a: number, b: number, c: number, d: number) =>
  p(t, a, b) * (1 - p(t, c, d));
export const type = (s: string, t: number, a: number, b: number) =>
  s.slice(0, Math.floor(interpolate(t, [a, b], [0, s.length], clamp)));
export const useTime = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return f / fps;
};
export const Brand = ({
  color = ink,
  dot = green,
}: {
  color?: string;
  dot?: string;
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 13,
      fontSize: 32,
      fontWeight: 600,
      letterSpacing: "-1.3px",
      color,
    }}
  >
    <span
      style={{ width: 16, height: 16, borderRadius: 20, background: dot }}
    />
    OpenPress
  </div>
);
export const Check = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="m5 12 4 4L19 6"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export const Arrow = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 19V5m-6 6 6-6 6 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export function Prompt({
  text,
  label = "OpenPress connected",
  dark = false,
  accent = green,
  sent = false,
}: {
  text: string;
  label?: string;
  dark?: boolean;
  accent?: string;
  sent?: boolean;
}) {
  return (
    <div
      style={{
        background: dark ? "#222725" : "white",
        border: `1px solid ${dark ? "#3d443e" : "#dedfd8"}`,
        borderRadius: 24,
        padding: "22px 26px",
        boxShadow: "0 18px 60px #00000012",
        color: dark ? "#f9fff3" : ink,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          fontSize: 19,
          color: dark ? "#a7b3a5" : "#7a8379",
          marginBottom: 14,
        }}
      >
        <span
          style={{ height: 8, width: 8, borderRadius: 8, background: accent }}
        />
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 22,
          minHeight: 50,
        }}
      >
        <div
          style={{
            flex: 1,
            fontSize: 33,
            lineHeight: 1.25,
            letterSpacing: "-.8px",
          }}
        >
          {text}
          <span style={{ color: accent, opacity: sent ? 0 : 1 }}>|</span>
        </div>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 15,
            display: "grid",
            placeItems: "center",
            background: accent,
            color: dark ? "#151c13" : "white",
            flexShrink: 0,
          }}
        >
          {sent ? <Check /> : <Arrow />}
        </div>
      </div>
    </div>
  );
}
export function Journal({
  warm = 0,
  build = 1,
  live = 0,
}: {
  warm?: number;
  build?: number;
  live?: number;
}) {
  const bg = interpolateColors(warm, [0, 1], ["#fff", "#faf2e5"]);
  const fg = interpolateColors(warm, [0, 1], [ink, "#3b291e"]);
  return (
    <div
      style={{
        width: 1120,
        height: 760,
        background: bg,
        color: fg,
        borderRadius: 22,
        overflow: "hidden",
        boxShadow: "0 32px 90px #0003",
        border: "1px solid #ffffff30",
      }}
    >
      <div
        style={{
          height: 53,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 24px",
          background: "#fff",
          borderBottom: "1px solid #e6e5df",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: 10,
              background: "#cbd1ca",
            }}
          />
        ))}
        <div
          style={{
            marginLeft: 130,
            background: live ? "#e5f5e7" : "#f0f2ed",
            padding: "5px 35px",
            borderRadius: 7,
            fontSize: 18,
            color: live ? green : "#7b8279",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {live > 0 && <Check size={18} />}{" "}
          {live ? "elsewhere.openpress.blog" : "Elsewhere · Preview"}
        </div>
      </div>
      <div style={{ padding: "0 38px" }}>
        <div
          style={{
            height: 94,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            opacity: Math.min(1, build * 3),
          }}
        >
          <div
            style={{
              fontFamily: "Georgia,serif",
              fontSize: 43,
              letterSpacing: "-2px",
            }}
          >
            Elsewhere<span style={{ color: "#b75c38" }}>.</span>
          </div>
          <div style={{ fontSize: 17, color: "#8c897d" }}>
            Journal &nbsp;&nbsp; Places &nbsp;&nbsp; About
          </div>
        </div>
        <div
          style={{
            height: 300,
            overflow: "hidden",
            borderRadius: 5,
            clipPath: `inset(${100 * (1 - Math.min(1, build * 1.6))}% 0 0 0)`,
          }}
        >
          <CanvasImage
            src={staticFile("travel.jpg")}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
        <div
          style={{
            opacity: p(build, 0.35, 0.85),
            translate: `0 ${22 * (1 - build)}px`,
          }}
        >
          <div
            style={{
              fontSize: 15,
              letterSpacing: 3,
              color: "#a86242",
              marginTop: 26,
            }}
          >
            THE SLOW TRAVEL JOURNAL
          </div>
          <div
            style={{
              fontFamily: "Georgia,serif",
              fontSize: 52,
              letterSpacing: "-2px",
              marginTop: 12,
            }}
          >
            Lake Como, without the crowds.
          </div>
          <div
            style={{
              fontSize: 21,
              lineHeight: 1.5,
              color: "#857c70",
              marginTop: 13,
            }}
          >
            Sleepy villages, lakeside swims, and the long way home.
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 16,
              color: "#8c8276",
              borderTop: "1px solid #dcd7cc",
              paddingTop: 20,
              marginTop: 27,
            }}
          >
            <span>Sofia Chen · 6 min read</span>
            <span>Read the story ↗</span>
          </div>
        </div>
      </div>
    </div>
  );
}
export function Portfolio({
  bold = 0,
  live = false,
}: {
  bold?: number;
  live?: boolean;
}) {
  const bg = interpolateColors(bold, [0, 1], ["#faf8f1", "#ff6d2c"]);
  return (
    <div
      style={{
        width: 1100,
        height: 730,
        background: bg,
        color: "#211e28",
        border: "2px solid #27232b",
        borderRadius: 22,
        overflow: "hidden",
        boxShadow: "12px 14px 0 #282333",
      }}
    >
      <div
        style={{
          height: 50,
          background: "#fffaf6",
          borderBottom: "1px solid #282333",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          gap: 9,
          color: live ? green : "#8e8383",
        }}
      >
        {live && <Check size={18} />}{" "}
        {live ? "maya.openpress.blog" : "Maya Studio · Preview"}
      </div>
      <div style={{ padding: "28px 38px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          <span>
            MAYA STUDIO
            <span style={{ color: bold > 0.5 ? "#fff" : "#a7a3ad" }}>®</span>
          </span>
          <span style={{ fontWeight: 400, fontSize: 17 }}>
            Work &nbsp;&nbsp; About &nbsp;&nbsp; Contact ↗
          </span>
        </div>
        <div
          style={{
            fontSize: lerp(66, 81, bold),
            fontWeight: lerp(450, 800, bold),
            lineHeight: 0.98,
            letterSpacing: "-4px",
            marginTop: 38,
          }}
        >
          Good design.
          <br />A little unexpected.
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 32 }}>
          <div
            style={{
              width: 490,
              height: 267,
              background: "#343024",
              borderRadius: 8,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <CanvasImage
              src={staticFile("interior.jpg")}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 18,
                left: 20,
                fontSize: 24,
                color: "#fff",
                fontWeight: 500,
              }}
            >
              Soft Space ↗
            </div>
          </div>
          <div
            style={{
              width: 490,
              height: 267,
              background: "#dce3b5",
              borderRadius: 8,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: 230,
                height: 230,
                borderRadius: 120,
                border: "38px solid #485c40",
                left: 260,
                top: 70,
                rotate: "-25deg",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 25,
                top: 20,
                fontSize: 18,
                letterSpacing: 2,
              }}
            >
              BRAND / 2026
            </div>
            <div
              style={{
                position: "absolute",
                left: 22,
                bottom: 17,
                fontSize: 88,
                fontWeight: 800,
                letterSpacing: "-6px",
              }}
            >
              FORMA.
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 18,
            marginTop: 25,
          }}
        >
          <span>Independent designer. Available worldwide.</span>
          <span>Let’s make something ↗</span>
        </div>
      </div>
    </div>
  );
}
