import { LiveStamp } from "./motion";
import { AbsoluteFill, Img, staticFile, interpolateColors } from "remotion";
import { Brand, Check, Prompt, p, lerp, type, useTime, range } from "./shared";

export const Editorial = () => {
  const t = useTime();
  const pull = p(t, 3.7, 6.15) * (1 - p(t, 16.25, 16.85));
  const warm = p(t, 9.7, 11.2);
  const live = p(t, 12.25, 12.8);
  const fade = 1 - p(t, 16.0, 16.5);
  const photoX = lerp(0, 960, pull),
    photoY = lerp(0, 245, pull);
  const photoW = lerp(1920, 830, pull),
    photoH = lerp(1080, 590, pull);
  const textColor = interpolateColors(pull, [0, 1], ["#fff9ed", "#3b3024"]);
  const promptOpacity = range(t, 1.7, 2.3, 12.2, 12.7);
  return (
    <AbsoluteFill
      style={{
        background: interpolateColors(warm, [0, 1], ["#f9f9f4", "#f3e9d9"]),
        fontFamily: "Geist,Arial,sans-serif",
        overflow: "hidden",
        color: "#3b3024",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: photoX,
          top: photoY,
          width: photoW,
          height: photoH,
          borderRadius: pull * 8,
          overflow: "hidden",
        }}
      >
        <Img
          src={staticFile("travel.jpg")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "50% 50%",
            scale: lerp(1.08, 1, pull),
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg,#10271ce0 0%,#10271c30 80%)",
            opacity: 1 - pull,
          }}
        />
      </div>
      <div
        style={{ position: "absolute", left: 106, top: 64, opacity: 1 - pull }}
      >
        <Brand color="#fff9ed" dot="#e5d9b2" />
      </div>
      <div
        style={{
          position: "absolute",
          right: 110,
          top: 76,
          opacity: 1 - pull,
          fontSize: 19,
          letterSpacing: 3,
          color: "#f1e7d4",
        }}
      >
        A PLACE FOR YOUR STORIES
      </div>
      <div
        style={{
          position: "absolute",
          left: 106,
          top: lerp(260, 365, pull),
          color: textColor,
          opacity: Math.min(1, pull * 3) * (1 - p(t, 16, 16.2)),
        }}
      >
        <div
          style={{
            fontSize: lerp(20, 16, pull),
            letterSpacing: 4,
            marginBottom: 26,
          }}
        >
          THE SLOW TRAVEL JOURNAL
        </div>
        <div
          style={{
            fontFamily: "Georgia,serif",
            fontSize: lerp(139, 103, pull),
            lineHeight: 1.03,
            letterSpacing: "-5px",
          }}
        >
          Somewhere
          <br />
          <i>worth sharing.</i>
        </div>
        <div
          style={{
            fontSize: 25,
            lineHeight: 1.5,
            marginTop: 30,
            opacity: pull,
            color: "#8c7a63",
          }}
        >
          Small discoveries. Beautiful places.
          <br />
          Stories that deserve a home.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 106,
          top: 250,
          color: "#fff9ed",
          opacity: 1 - p(t, 3.55, 3.8) + range(t, 16.8, 17.2, 17.6, 18),
          transform: `translateY(${22 * (1 - p(t, 0, 0.6))}px)`,
        }}
      >
        <div style={{ fontSize: 20, letterSpacing: 4, marginBottom: 25 }}>
          FROM A THOUGHT TO A LIVE SITE
        </div>
        <div
          style={{
            fontFamily: "Georgia,serif",
            fontSize: 140,
            lineHeight: 1.04,
            letterSpacing: "-6px",
            clipPath: `inset(0 ${100 * (1 - p(t, 0, 0.8))}% 0 0)`,
          }}
        >
          One sentence.
        </div>
        <div
          style={{
            fontFamily: "Georgia,serif",
            fontSize: 140,
            lineHeight: 1.04,
            letterSpacing: "-6px",
            fontStyle: "italic",
            clipPath: `inset(0 ${100 * (1 - p(t, 0.25, 1))}% 0 0)`,
          }}
        >
          A whole website.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 107,
          top: 155,
          right: 130,
          height: 62,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          opacity: pull,
        }}
      >
        <div
          style={{
            fontFamily: "Georgia,serif",
            fontSize: 54,
            letterSpacing: "-3px",
          }}
        >
          Elsewhere<span style={{ color: "#ad623e" }}>.</span>
        </div>
        <div style={{ fontSize: 20, color: "#8c7a63" }}>
          Journal &nbsp;&nbsp;&nbsp; Places &nbsp;&nbsp;&nbsp; About
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 108,
          top: 235,
          right: 130,
          height: 1,
          background: "#cfbea7",
          opacity: pull,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 970,
          top: 861,
          opacity: pull,
          display: "flex",
          justifyContent: "space-between",
          width: 820,
          fontSize: 19,
          color: "#897a65",
        }}
      >
        <span>Northern Italy / Field notes No. 01</span>
        <span>Explore the journal ↗</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 106,
          top: 777,
          opacity: pull,
          display: "flex",
          alignItems: "center",
          gap: 18,
          fontSize: 22,
        }}
      >
        <span
          style={{
            width: 48,
            height: 48,
            display: "grid",
            placeItems: "center",
            borderRadius: "50%",
            border: "1px solid #cdbca5",
          }}
        >
          ↗
        </span>
        Take the long way.
      </div>
      <div
        style={{
          position: "absolute",
          left: lerp(106, 495, pull),
          bottom: lerp(94, 45, pull),
          width: lerp(1150, 930, pull),
          opacity: promptOpacity,
          translate: `0 ${24 * (1 - p(t, 1.7, 2.3))}px`,
        }}
      >
        <Prompt
          accent="#a36340"
          text={
            t < 8
              ? "Create a home for my travel stories."
              : type("Warm paper. Earthy colors. Publish it.", t, 8.3, 10.3)
          }
          sent={t < 8 || t > 10.4}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 63,
          opacity: live * fade,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 13,
          color: "#387750",
          fontSize: 24,
        }}
      >
        <Check size={24} />
        elsewhere.openpress.blog
        <span
          style={{
            fontSize: 17,
            border: "1px solid #c7d2bb",
            borderRadius: 20,
            padding: "5px 13px",
            marginLeft: 8,
          }}
        >
          Live
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 68,
          left: 0,
          right: 0,
          opacity: live * fade,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
        }}
      >
        <Brand />
        <span
          style={{
            fontSize: 22,
            color: "#8c7a63",
            paddingLeft: 28,
            borderLeft: "1px solid #cdbca5",
          }}
        >
          Your words. Out in the world.
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: lerp(-900, 2000, p(t, 9.65, 10.65)),
          top: 0,
          width: 380,
          height: 1080,
          background:
            "linear-gradient(90deg,transparent,#fff0da88,transparent)",
          rotate: "-20deg",
          opacity: range(t, 9.65, 9.8, 10.5, 10.7),
          pointerEvents: "none",
        }}
      />
      <LiveStamp
        t={t}
        start={12.45}
        color="#e6d5ad"
        dark="#63492f"
        x={1460}
        y={180}
      />
      {Array.from({ length: 5 }, (_, i) => {
        const local = t < 10 ? t : t - 12.35;
        const enter = p(local, 3.65 + i * 0.045, 3.97 + i * 0.045);
        const leave = p(local, 4.02 + i * 0.045, 4.48 + i * 0.045);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: i * 384,
              top: -1080 + enter * 1080 + leave * 1080,
              width: 385,
              height: 1080,
              background: i % 2 ? "#dfd1b9" : "#f3e9d9",
              zIndex: 10,
              pointerEvents: "none",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
