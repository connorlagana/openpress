import { AbsoluteFill, spring, useVideoConfig } from "remotion";
import { p, range } from "./shared";

/** All effects are frame-driven, deterministic, and safe to scrub. */
export function WordReveal({
  text,
  t,
  start = 0,
  color = "inherit",
  size = 160,
}: {
  text: string;
  t: number;
  start?: number;
  color?: string;
  size?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0 .22em",
        fontSize: size,
        fontWeight: 750,
        letterSpacing: "-.065em",
        lineHeight: 1.02,
        color,
      }}
    >
      {text.split(" ").map((word, i) => (
        <span
          key={i}
          style={{
            overflow: "hidden",
            display: "inline-block",
            paddingBottom: ".09em",
            marginBottom: "-.09em",
          }}
        >
          <span
            style={{
              display: "block",
              translate: `0 ${115 * (1 - p(t, start + i * 0.09, start + 0.5 + i * 0.09))}%`,
              rotate: `${7 * (1 - p(t, start + i * 0.09, start + 0.5 + i * 0.09))}deg`,
            }}
          >
            {word}
          </span>
        </span>
      ))}
    </div>
  );
}
export function Wipe({
  t,
  start,
  color,
  label,
}: {
  t: number;
  start: number;
  color: string;
  label: string;
}) {
  const a = p(t, start, start + 0.36),
    b = p(t, start + 0.42, start + 0.95);
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        zIndex: 20,
        background: color,
        clipPath: `polygon(0 ${100 * (1 - a)}%,100% ${100 * (1 - a)}%,100% ${100 * (1 - b)}%,0 ${100 * (1 - b)}%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#182016",
        fontSize: 145,
        fontWeight: 750,
        letterSpacing: "-8px",
      }}
    >
      {label}
    </AbsoluteFill>
  );
}
export function Burst({
  t,
  start,
  color,
  x = 1450,
  y = 610,
}: {
  t: number;
  start: number;
  color: string;
  x?: number;
  y?: number;
}) {
  const q = p(t, start, start + 1.1);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 200,
        height: 200,
        marginLeft: -100,
        marginTop: -100,
        borderRadius: "50%",
        background: color,
        scale: q * 18,
        opacity: range(t, start, start + 0.06, start + 0.6, start + 1.1),
        pointerEvents: "none",
      }}
    />
  );
}
export function LiveStamp({
  t,
  start,
  color = "#c9fc64",
  dark = "#1b2118",
  x = 1450,
  y = 195,
}: {
  t: number;
  start: number;
  color?: string;
  dark?: string;
  x?: number;
  y?: number;
}) {
  const { fps } = useVideoConfig();
  const s = spring({
    frame: Math.max(0, (t - start) * fps),
    fps,
    config: { damping: 12, stiffness: 160 },
  });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 280,
        height: 110,
        display: "grid",
        placeItems: "center",
        background: color,
        color: dark,
        border: `3px solid ${dark}`,
        borderRadius: 15,
        fontSize: 65,
        fontWeight: 750,
        letterSpacing: "-4px",
        boxShadow: `7px 8px 0 ${dark}`,
        opacity: range(t, start, start + 0.08, start + 1.5, start + 1.9),
        scale: 0.35 + 0.65 * s,
        rotate: `${-18 + 10 * s}deg`,
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      LIVE ↗
    </div>
  );
}
export function Confetti({
  t,
  start,
  color = "#c9fc64",
  x = 1600,
  y = 330,
}: {
  t: number;
  start: number;
  color?: string;
  x?: number;
  y?: number;
}) {
  const q = p(t, start, start + 1.2);
  return (
    <>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x + Math.cos(a) * q * 330,
              top: y + Math.sin(a) * q * 230 + q * q * 80,
              width: i % 3 === 0 ? 13 : 6,
              height: 23,
              borderRadius: 2,
              background: i % 2 === 0 ? color : "#fff",
              rotate: `${i * 39 + q * 180}deg`,
              opacity: range(t, start, start + 0.06, start + 0.45, start + 1.2),
              scale: 1 - q * 0.6,
              zIndex: 4,
            }}
          />
        );
      })}
    </>
  );
}
