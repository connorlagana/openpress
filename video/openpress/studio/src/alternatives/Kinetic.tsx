import { WordReveal, Wipe, LiveStamp, Confetti } from "./motion";
import { AbsoluteFill } from "remotion";
import {
  Brand,
  Journal,
  Prompt,
  p,
  lerp,
  range,
  type,
  useTime,
} from "./shared";

export const Kinetic = () => {
  const t = useTime();
  const lime = "#c9fc64";
  const intro = range(t, 0.12, 0.7, 2.8, 3.25);
  const build = range(t, 3.1, 3.6, 6.4, 6.8);
  const refine = range(t, 6.8, 7.2, 10.35, 10.7);
  const ship = range(t, 10.8, 11.3, 14.25, 14.7);
  const end = range(t, 14.65, 15.2, 17.1, 17.75);
  const siteEnter = p(t, 3.15, 4.15),
    center = p(t, 10.8, 11.8),
    siteExit = p(t, 14.15, 14.8);
  return (
    <AbsoluteFill
      style={{
        background: "#121914",
        color: "#f5faed",
        fontFamily: "Geist,Arial,sans-serif",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", left: 90, top: 65 }}>
        <Brand color="#f5faed" dot={lime} />
      </div>
      <div
        style={{
          position: "absolute",
          right: 96,
          top: 77,
          fontSize: 18,
          letterSpacing: 2,
          color: "#8e9e88",
        }}
      >
        YOUR AI. NOW WITH A PUBLISH BUTTON.
      </div>
      <div
        style={{
          position: "absolute",
          width: 1200,
          height: 1200,
          borderRadius: "50%",
          border: "1px solid #c9fc6416",
          left: 1100,
          top: -190,
          scale: 1 + 0.1 * Math.sin((t * Math.PI) / 9),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 205,
          opacity: intro,
          translate: `0 ${60 * (1 - p(t, 0.12, 0.7))}px`,
        }}
      >
        <WordReveal text="ONE PROMPT." t={t} start={0.08} size={177} />
        <WordReveal
          text="REAL WEBSITE."
          t={t}
          start={0.3}
          size={177}
          color={lime}
        />
        <div
          style={{
            fontSize: 40,
            color: "#9aa992",
            letterSpacing: "-1.5px",
            marginTop: 28,
          }}
        >
          Built and published by your AI.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 680,
          width: 1450,
          opacity: intro,
          translate: `0 ${40 * (1 - p(t, 0.4, 1))}px`,
        }}
      >
        <Prompt
          dark
          accent={lime}
          text={type("Create a travel journal called Elsewhere.", t, 0.55, 2.6)}
          sent={t > 2.6}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 200,
          opacity: build,
          translate: `0 ${30 * (1 - build)}px`,
          fontSize: 155,
          fontWeight: 750,
          letterSpacing: "-8px",
        }}
      >
        BUILD IT<span style={{ color: lime }}>.</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 220,
          opacity: refine,
          fontSize: 104,
          fontWeight: 700,
          lineHeight: 0.96,
          letterSpacing: "-6px",
        }}
      >
        MAKE IT
        <br />
        <span style={{ color: lime }}>YOURS.</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 490,
          width: 640,
          opacity: range(t, 3.35, 3.8, 10.4, 10.8),
        }}
      >
        <Prompt
          dark
          accent={lime}
          text={
            t < 6.8
              ? "Create a travel journal."
              : type("Warmer colors. Then publish it.", t, 7.1, 9.15)
          }
          sent={t < 6.8 || t > 9.3}
        />
        <div
          style={{
            fontSize: 23,
            color: "#9aa992",
            marginTop: 30,
            opacity: p(t, 4.8, 5.4),
          }}
        >
          {t < 9.5 ? "✦  Your idea, taking shape." : "✓  Theme updated."}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: lerp(2040, lerp(835, 439, center), siteEnter),
          top: lerp(330, 270, center) - siteExit * 70,
          scale: lerp(0.83, 0.93, center),
          transform: `perspective(1800px) rotateY(${(1 - siteEnter) * -30}deg) rotateZ(${(1 - siteEnter) * 7}deg)`,
          transformOrigin: "top left",
          opacity: siteEnter * (1 - siteExit),
        }}
      >
        <Journal
          build={p(t, 3.65, 5.2)}
          warm={p(t, 9.3, 10.3)}
          live={t > 11.1 ? 1 : 0}
        />
      </div>
      <div
        style={{
          position: "absolute",
          top: 135,
          left: 0,
          width: "100%",
          textAlign: "center",
          fontSize: 108,
          fontWeight: 750,
          letterSpacing: "-6px",
          opacity: ship,
        }}
      >
        SHIP IT<span style={{ color: lime }}>.</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 94,
          top: 270,
          opacity: end,
          translate: `0 ${40 * (1 - p(t, 14.65, 15.2))}px`,
        }}
      >
        <div
          style={{
            fontSize: 157,
            fontWeight: 650,
            lineHeight: 0.99,
            letterSpacing: "-9px",
          }}
        >
          Your AI.
          <br />
          <span style={{ color: lime }}>Your website.</span>
        </div>
        <div style={{ fontSize: 40, color: "#a5b29d", marginTop: 35 }}>
          Built. Hosted. Published.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          right: 120,
          top: 400,
          opacity: end,
          rotate: `${lerp(-12, -4, p(t, 14.7, 15.6))}deg`,
          width: 430,
          height: 270,
          borderRadius: 28,
          background: lime,
          color: "#162014",
          padding: 40,
          boxShadow: "16px 18px 0 #0004",
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 600 }}>OPENPRESS</div>
        <div
          style={{
            fontSize: 94,
            fontWeight: 700,
            letterSpacing: "-5px",
            marginTop: 10,
          }}
        >
          LIVE ↗
        </div>
        <div style={{ fontSize: 24, marginTop: 9 }}>Free hosting included.</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 96,
          bottom: 70,
          color: "#91a188",
          fontSize: 22,
        }}
      >
        Bring the idea. Bring your AI.
      </div>
      <div
        style={{
          position: "absolute",
          right: 96,
          bottom: 70,
          color: lime,
          fontSize: 22,
        }}
      >
        OpenPress / Make it live.
      </div>
      <LiveStamp t={t} start={11.25} x={1470} y={200} />
      <Confetti t={t} start={11.25} />
      <Wipe t={t} start={2.85} color={lime} label="LET’S MAKE IT REAL." />
    </AbsoluteFill>
  );
};
