import { WordReveal, Burst, LiveStamp, Confetti } from "./motion";
import { spring, useVideoConfig } from "remotion";
import { AbsoluteFill, interpolateColors } from "remotion";
import {
  Brand,
  Check,
  Portfolio,
  p,
  lerp,
  type,
  useTime,
  range,
} from "./shared";

export const Conversation = () => {
  const t = useTime();
  const { fps } = useVideoConfig();
  const bounce = (start: number) =>
    spring({
      frame: Math.max(0, (t - start) * fps),
      fps,
      config: { damping: 14, stiffness: 160 },
    });
  const split = p(t, 3.4, 4.6),
    bold = p(t, 8.3, 9.6),
    published = p(t, 12.0, 12.55),
    end = p(t, 14.7, 15.4);
  const bubble1 = range(t, 0.2, 0.75, 14.5, 15.0);
  const bubble2 = range(t, 6.3, 6.8, 14.5, 15.0);
  const bubble3 = range(t, 10.3, 10.8, 14.5, 15.0);
  const final = range(t, 15.1, 15.6, 17.4, 17.95);
  return (
    <AbsoluteFill
      style={{
        background: "#e9e1f6",
        fontFamily: "Geist,Arial,sans-serif",
        color: "#282333",
        overflow: "hidden",
      }}
    >
      <Burst t={t} start={8.3} color="#ff8c49" />
      <div
        style={{
          position: "absolute",
          left: 230,
          top: 160,
          opacity: 1 - p(t, 3.15, 3.5),
        }}
      >
        <WordReveal text="YOUR WEBSITE." t={t} start={0} size={117} />
        <WordReveal
          text="TAKING FEEDBACK."
          t={t}
          start={0.2}
          size={117}
          color="#7853b5"
        />
      </div>
      <div style={{ position: "absolute", left: 90, top: 64 }}>
        <Brand color="#282333" dot="#7853b5" />
      </div>
      <div
        style={{
          position: "absolute",
          right: 96,
          top: 78,
          fontSize: 18,
          letterSpacing: 2,
          color: "#8c79a3",
        }}
      >
        A CONVERSATION. A CREATION.
      </div>
      <div
        style={{
          position: "absolute",
          right: -180,
          top: 240,
          width: 740,
          height: 740,
          borderRadius: "50%",
          border: "2px solid #d3c4e8",
          scale: 1 + bold * 0.2 * (1 - end),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: lerp(230, 95, split),
          top: lerp(550, 212, split),
          opacity: bubble1,
          translate: `0 ${70 * (1 - bounce(0.2))}px`,
        }}
      >
        <div
          style={{
            fontSize: 19,
            color: "#8c79a3",
            marginBottom: 17,
            letterSpacing: 2,
          }}
        >
          YOU, TO YOUR AI
        </div>
        <div
          style={{
            background: "#fff",
            border: "2px solid #282333",
            borderRadius: "30px 30px 30px 4px",
            padding: "30px 36px",
            width: lerp(1350, 665, split),
            boxShadow: "7px 8px 0 #d6c8e5",
            fontSize: lerp(73, 43, split),
            lineHeight: 1.15,
            letterSpacing: "-2.2px",
            fontWeight: 500,
          }}
        >
          {type("Build my design portfolio.", t, 0.6, 2.6)}
          <span style={{ color: "#a897bb", opacity: t < 2.7 ? 1 : 0 }}>|</span>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 445,
          opacity: range(t, 4.3, 4.8, 6, 6.4),
          fontSize: 30,
          color: "#7853b5",
        }}
      >
        ✦ &nbsp; Let’s make room for your work.
      </div>
      <div
        style={{
          position: "absolute",
          left: 95,
          top: 450,
          width: 665,
          opacity: bubble2,
          translate: `0 ${70 * (1 - bounce(6.3))}px`,
          scale: 0.9 + 0.1 * bounce(6.3),
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "2px solid #282333",
            borderRadius: "30px 30px 30px 4px",
            padding: "27px 33px",
            fontSize: 42,
            lineHeight: 1.2,
            letterSpacing: "-1.5px",
            boxShadow: "7px 8px 0 #d6c8e5",
          }}
        >
          {type("Bolder. Orange. More me.", t, 6.7, 8.1)}
          <span style={{ color: "#a897bb", opacity: t < 8.2 ? 1 : 0 }}>|</span>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 95,
          top: 650,
          opacity: bubble3,
          translate: `0 ${70 * (1 - bounce(10.3))}px`,
          scale: 0.9 + 0.1 * bounce(10.3),
        }}
      >
        <div
          style={{
            background: "#282333",
            color: "white",
            borderRadius: "28px 28px 28px 4px",
            padding: "26px 35px",
            fontSize: 43,
            letterSpacing: "-1.5px",
            width: 365,
          }}
        >
          {type("Publish it.", t, 10.8, 11.7)}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 820,
          opacity: published * (1 - end),
          display: "flex",
          alignItems: "center",
          gap: 15,
          fontSize: 29,
          color: "#387750",
        }}
      >
        <Check size={32} />
        You’re live. Nice work.
      </div>
      <div
        style={{
          position: "absolute",
          left: lerp(2100, 835, split),
          top: lerp(360, 270, split) - end * 60,
          scale: 0.89,
          rotate: `${lerp(8, lerp(-2, 1.5, bold), split)}deg`,
          transformOrigin: "top left",
          opacity: split * (1 - end),
        }}
      >
        <Portfolio bold={bold} live={published > 0.5} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 290,
          textAlign: "center",
          opacity: final,
          translate: `0 ${40 * (1 - p(t, 15.1, 15.6))}px`,
        }}
      >
        <div
          style={{
            fontSize: 140,
            fontWeight: 650,
            letterSpacing: "-8px",
            lineHeight: 1.05,
          }}
        >
          Make it yours.
          <br />
          <span style={{ color: "#7853b5" }}>Make it live.</span>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 96,
          bottom: 65,
          fontSize: 22,
          color: "#8a789d",
        }}
      >
        Same AI. A whole new possibility.
      </div>
      <div
        style={{
          position: "absolute",
          right: 96,
          bottom: 65,
          fontSize: 22,
          color: "#7853b5",
        }}
      >
        Free hosting included. ↗
      </div>
      <div
        style={{
          position: "absolute",
          left: 235,
          top: 790,
          opacity: range(t, 2.7, 3.2, 3.35, 3.7),
          display: "flex",
          gap: 12,
          color: "#7853b5",
          alignItems: "center",
          fontSize: 25,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 10,
            background: "#7853b5",
          }}
        />
        OpenPress connected
      </div>
      <div
        style={{
          position: "absolute",
          right: 130,
          top: 170,
          opacity: range(t, 8.4, 9, 10, 10.5),
          padding: "10px 24px",
          borderRadius: 30,
          border: "2px solid #282333",
          background: interpolateColors(bold, [0, 1], ["#faf8f1", "#ff6d2c"]),
          fontSize: 24,
          rotate: "-5deg",
        }}
      >
        Now that’s you. ↗
      </div>
      <LiveStamp
        t={t}
        start={12.15}
        color="#c9fc64"
        dark="#282333"
        x={1450}
        y={185}
      />
      <Confetti t={t} start={12.15} color="#7853b5" x={1580} y={315} />
    </AbsoluteFill>
  );
};
