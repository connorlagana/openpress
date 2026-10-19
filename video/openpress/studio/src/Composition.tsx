import React from "react";
import {
  AbsoluteFill,
  CanvasImage,
  Easing,
  interpolate,
  interpolateColors,
  spring,
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
const ink = "#202724";
const green = "#24845c";
const ease = Easing.bezier(0.22, 1, 0.36, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const move = (t: number, start: number, end: number) =>
  interpolate(t, [start, end], [0, 1], { ...clamp, easing: ease });
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const typed = (text: string, t: number, start: number, end: number) =>
  text.slice(
    0,
    Math.floor(interpolate(t, [start, end], [0, text.length], clamp)),
  );

function Dot({ size = 10, color = green }: { size?: number; color?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
  );
}
function Arrow({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 19V5m-6 6 6-6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Check({ size = 22 }: { size?: number }) {
  return (
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
}
function Cursor({ t }: { t: number }) {
  const enter = move(t, 3.15, 3.7);
  const press = move(t, 3.82, 3.93) - move(t, 3.97, 4.1);
  const opacity = move(t, 3.15, 3.35) * (1 - move(t, 4.1, 4.4));
  return (
    <div
      style={{
        position: "absolute",
        left: mix(900, 696, enter),
        top: mix(390, 270, enter),
        opacity,
        transform: `scale(${1 - press * 0.18})`,
        filter: "drop-shadow(0 3px 4px #0003)",
      }}
    >
      <svg width="40" height="48" viewBox="0 0 32 40">
        <path
          d="M3 2v31l8-9 7 13 6-3-7-12 12-1Z"
          fill={ink}
          stroke="white"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
function Chat({ t, fps }: { t: number; fps: number }) {
  const send = move(t, 3.9, 4.5);
  const expand = move(t, 4.5, 5.3);
  const answer = move(t, 4.65, 5.25);
  const refine = move(t, 8.2, 8.7);
  const publish = move(t, 12.4, 13);
  const first = typed(
    "Create a travel journal called Elsewhere.",
    t,
    0.55,
    3.05,
  );
  const second = typed("Make it warmer.\nThen publish it.", t, 8.65, 10.8);
  const caret = Math.floor(t * 2.5) % 2 === 0;
  const submitPulse = spring({
    frame: Math.max(0, (t - 11.1) * fps),
    fps,
    config: { damping: 18, stiffness: 180 },
  });
  return (
    <div style={{ width: 780, height: 590, position: "relative" }}>
      <div
        style={{
          position: "absolute",
          inset: "0 0 auto",
          height: mix(330, 590, expand),
          borderRadius: 28,
          background: "#ffffff",
          boxShadow: "0 28px 90px #23392b12, 0 2px 8px #23392b06",
          border: "1px solid #e1e7e0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: 78,
            display: "flex",
            alignItems: "center",
            padding: "0 30px",
            gap: 12,
            borderBottom: "1px solid #edf0eb",
            fontSize: 22,
            color: "#65736a",
          }}
        >
          <Dot />
          OpenPress connected
          <span style={{ marginLeft: "auto", fontSize: 18, color: "#909b94" }}>
            Your AI workspace
          </span>
        </div>
        <div
          style={{
            position: "absolute",
            top: mix(110, 104, send),
            left: 30,
            right: 30,
            padding: `${mix(0, 20, send)}px ${mix(0, 24, send)}px`,
            background: interpolateColors(send, [0, 1], ["#ffffff", "#f1f5f0"]),
            borderRadius: 20,
            fontSize: 38,
            lineHeight: 1.3,
            letterSpacing: "-1.1px",
            minHeight: 110,
          }}
        >
          {first}
          <span style={{ opacity: t < 3.1 && caret ? 1 : 0, color: green }}>
            |
          </span>
        </div>
        <div
          style={{
            position: "absolute",
            right: 28,
            top: 238,
            width: 62,
            height: 62,
            borderRadius: 18,
            background: ink,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 1 - send,
            scale: 1 - 0.13 * (move(t, 3.82, 3.93) - move(t, 3.97, 4.1)),
          }}
        >
          <Arrow />
        </div>
        <div
          style={{
            position: "absolute",
            left: 34,
            right: 28,
            top: 258,
            opacity: answer,
            translate: `0 ${16 * (1 - answer)}px`,
            display: "flex",
            gap: 18,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              background: "#e6f2e8",
              color: green,
              display: "grid",
              placeItems: "center",
              borderRadius: 12,
              flexShrink: 0,
            }}
          >
            ✦
          </div>
          <div>
            <div style={{ fontSize: 28, lineHeight: 1.4 }}>
              Let’s give your stories a home.
            </div>
            <div
              style={{
                display: "flex",
                gap: 9,
                alignItems: "center",
                fontSize: 21,
                color: green,
                marginTop: 19,
              }}
            >
              <Check size={20} />
              {t < 12.5 ? "Elsewhere · Draft created" : "Elsewhere · Published"}
            </div>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 24,
            right: 24,
            bottom: 24,
            height: 157,
            borderRadius: 20,
            border: "1px solid #dce4da",
            background: "#fbfcfa",
            opacity: refine,
            translate: `0 ${20 * (1 - refine)}px`,
            padding: "23px 85px 20px 25px",
            fontSize: 32,
            lineHeight: 1.35,
            whiteSpace: "pre-line",
            letterSpacing: "-.6px",
          }}
        >
          {second}
          <span
            style={{
              color: green,
              opacity: t > 8.65 && t < 10.9 && caret ? 1 : 0,
            }}
          >
            |
          </span>
          <div
            style={{
              position: "absolute",
              right: 17,
              bottom: 17,
              width: 52,
              height: 52,
              borderRadius: 15,
              background: t < 11.1 ? ink : green,
              color: "white",
              display: "grid",
              placeItems: "center",
              scale: t < 11.1 ? 1 : 0.88 + 0.12 * submitPulse,
            }}
          >
            {t < 11.1 ? <Arrow size={24} /> : <Check />}
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: -80,
          left: 14,
          display: "flex",
          alignItems: "center",
          gap: 13,
          color: green,
          fontSize: 26,
          opacity: publish,
          translate: `0 ${20 * (1 - publish)}px`,
        }}
      >
        <Check size={26} />
        Your site is live.
      </div>
      <Cursor t={t} />
    </div>
  );
}
function Browser({ t, fps }: { t: number; fps: number }) {
  const warm = move(t, 11.25, 12.65);
  const pub = move(t, 12.6, 13.2);
  const reveal = (start: number) =>
    spring({
      frame: Math.max(0, (t - start) * fps),
      fps,
      config: { damping: 26, stiffness: 120 },
      durationInFrames: Math.round(0.95 * fps),
    });
  const mast = reveal(5.0),
    photo = reveal(5.3),
    title = reveal(5.7),
    detail = reveal(6.1);
  const bg = interpolateColors(warm, [0, 1], ["#ffffff", "#faf6ef"]);
  const accent = interpolateColors(warm, [0, 1], ["#52786a", "#b95835"]);
  return (
    <div
      style={{
        width: 1080,
        height: 710,
        borderRadius: 22,
        background: bg,
        border: "1px solid #d9dfd5",
        boxShadow: "0 40px 100px #3044351c, 0 4px 12px #3044350a",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 53,
          background: "#fff",
          borderBottom: "1px solid #e9ebe6",
          display: "flex",
          alignItems: "center",
          padding: "0 23px",
          gap: 8,
        }}
      >
        <Dot size={10} color="#d4d9d2" />
        <Dot size={10} color="#d4d9d2" />
        <Dot size={10} color="#d4d9d2" />
        <div
          style={{
            position: "absolute",
            left: 283,
            top: 10,
            width: 514,
            height: 32,
            background: interpolateColors(pub, [0, 1], ["#f4f5f2", "#eaf5ec"]),
            borderRadius: 8,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
            fontSize: 18,
            color: pub > 0.5 ? green : "#7b847d",
          }}
        >
          {pub > 0.5 && <Check size={16} />}
          {pub > 0.5 ? "elsewhere.openpress.blog" : "Elsewhere · Preview"}
        </div>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 17,
            color: green,
            opacity: pub,
          }}
        >
          Live ↗
        </span>
      </div>
      <div
        style={{
          padding: "0 38px",
          color: interpolateColors(warm, [0, 1], [ink, "#382a21"]),
        }}
      >
        <div
          style={{
            height: 92,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            opacity: mast,
            translate: `0 ${20 * (1 - mast)}px`,
          }}
        >
          <div
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 44,
              letterSpacing: "-2px",
            }}
          >
            Elsewhere<span style={{ color: accent }}>.</span>
          </div>
          <div
            style={{ display: "flex", gap: 28, fontSize: 18, color: "#79796f" }}
          >
            Journal<span>Places</span>
            <span>About</span>
          </div>
        </div>
        <div
          style={{
            height: 273,
            overflow: "hidden",
            borderRadius: 6,
            clipPath: `inset(${100 * (1 - photo)}% 0 0 0 round 6px)`,
            position: "relative",
          }}
        >
          <CanvasImage
            src={staticFile("travel.jpg")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "50% 51%",
              transform: `scale(${1.1 - photo * 0.1 + Math.max(0, t - 14) * 0.002})`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#bf7930",
              opacity: warm * 0.07,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 17,
              left: 22,
              color: "white",
              fontSize: 14,
              letterSpacing: 2,
            }}
          >
            ITALY / FIELD NOTES No. 01
          </div>
        </div>
        <div
          style={{
            marginTop: 23,
            color: accent,
            fontSize: 15,
            letterSpacing: 2.8,
            textTransform: "uppercase",
            opacity: title,
          }}
        >
          The slow travel journal
        </div>
        <div
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 51,
            letterSpacing: "-2px",
            lineHeight: 1.1,
            marginTop: 10,
            opacity: title,
            translate: `0 ${24 * (1 - title)}px`,
          }}
        >
          Lake Como, without the crowds.
        </div>
        <div
          style={{
            fontSize: 20,
            lineHeight: 1.5,
            marginTop: 14,
            color: "#7c786e",
            opacity: detail,
          }}
        >
          Sleepy villages, lakeside swims, and the long way home.
          <br />A guide to doing less in northern Italy.
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 22,
            paddingTop: 17,
            borderTop: "1px solid #d9d9ce",
            opacity: detail,
            fontSize: 16,
            color: "#827a6d",
          }}
        >
          <span>
            Sofia Chen <span style={{ margin: "0 12px" }}>·</span> 6 min read
          </span>
          <span style={{ color: accent }}>Read the story ↗</span>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          borderRadius: 22,
          boxShadow: `inset 0 0 0 ${2 * Math.sin(warm * Math.PI)}px #c98b5c`,
          opacity: Math.sin(warm * Math.PI),
        }}
      />
    </div>
  );
}
export const OpenPressFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const split = move(t, 4.05, 5.25);
  const hero = move(t, 13.4, 14.8);
  const reset = move(t, 18.5, 19.85);
  const original = 1 - reset;
  const chatScale = mix(mix(1.42, 0.87, split), 1.42, reset);
  const chatX = mix(mix(406, 95, split) - hero * 180, 406, reset);
  const chatY = mix(mix(383, 320, split), 383, reset);
  const browserIn = move(t, 4.45, 5.65);
  const browserX = mix(2040, mix(805, 409, hero), browserIn);
  const browserY = mix(304, 260, hero);
  const browserScale = mix(0.94, 1.02, hero);
  const introOpacity = 1 - move(t, 4.0, 4.5) + move(t, 19.05, 19.65);
  const buildOpacity = move(t, 4.5, 5.05) * (1 - move(t, 8.1, 8.65));
  const refineOpacity = move(t, 8.65, 9.15) * (1 - move(t, 13, 13.5));
  const finalOpacity = move(t, 13.7, 14.4) * (1 - move(t, 18.5, 19.0));
  return (
    <AbsoluteFill
      style={{
        background: "#f7f8f4",
        fontFamily: "Geist, Arial, sans-serif",
        color: ink,
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 68% 66%, #dfeadb 0%, transparent 58%)",
          opacity: 0.6,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1320,
          height: 1320,
          borderRadius: "50%",
          border: "1px solid #e4e9df",
          left: 600,
          top: 60,
          transform: `translate(${split * -120 * original}px, ${hero * -160 * original}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 65,
          left: 92,
          display: "flex",
          alignItems: "center",
          gap: 13,
          fontSize: 29,
          fontWeight: 600,
          letterSpacing: "-1px",
        }}
      >
        <Dot size={16} />
        OpenPress
      </div>
      <div
        style={{
          position: "absolute",
          right: 94,
          top: 73,
          fontSize: 18,
          color: "#89958b",
          letterSpacing: 1,
        }}
      >
        A LITTLE ASK. A WHOLE WEBSITE.
      </div>
      <div
        style={{
          position: "absolute",
          top: 166,
          width: "100%",
          textAlign: "center",
          fontSize: 76,
          lineHeight: 1.08,
          fontWeight: 500,
          letterSpacing: "-4px",
          opacity: Math.min(1, introOpacity),
          translate: `0 ${-20 * split * original}px`,
        }}
      >
        Your next website starts
        <br />
        with a sentence<span style={{ color: green }}>.</span>
      </div>
      <div
        style={{
          position: "absolute",
          top: 184,
          left: 95,
          fontSize: 76,
          fontWeight: 500,
          letterSpacing: "-3px",
          opacity: buildOpacity,
          translate: `0 ${18 * (1 - buildOpacity)}px`,
        }}
      >
        Your words. <span style={{ color: green }}>Taking shape.</span>
      </div>
      <div
        style={{
          position: "absolute",
          top: 184,
          left: 95,
          fontSize: 76,
          fontWeight: 500,
          letterSpacing: "-3px",
          opacity: refineOpacity,
          translate: `0 ${18 * (1 - refineOpacity)}px`,
        }}
      >
        A little more{" "}
        <span
          style={{
            fontFamily: "Georgia, serif",
            fontStyle: "italic",
            color: "#b95835",
          }}
        >
          you.
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          top: 145,
          width: "100%",
          textAlign: "center",
          fontSize: 72,
          fontWeight: 500,
          letterSpacing: "-3.5px",
          opacity: finalOpacity,
          translate: `0 ${18 * (1 - finalOpacity)}px`,
        }}
      >
        From a thought. <span style={{ color: green }}>To a live site.</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: chatX,
          top: chatY,
          transformOrigin: "top left",
          scale: chatScale,
          opacity: 1 - hero + move(t, 19.0, 19.65),
        }}
      >
        <Chat t={reset > 0 ? 0 : t} fps={fps} />
      </div>
      <div
        style={{
          position: "absolute",
          left: browserX,
          top: browserY + reset * 80,
          transformOrigin: "top left",
          scale: browserScale * (1 - reset * 0.08),
          opacity: browserIn * (1 - move(t, 18.5, 19.0)),
          rotate: `${(1 - browserIn) * 3}deg`,
        }}
      >
        <Browser t={t} fps={fps} />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 66,
          left: 96,
          right: 96,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#849085",
          fontSize: 21,
        }}
      >
        <span>Bring your AI. We’ll give it a place to publish.</span>
        <span
          style={{
            color: green,
            display: "flex",
            gap: 11,
            alignItems: "center",
          }}
        >
          <Dot size={7} />
          Free hosting. Built in.
        </span>
      </div>
    </AbsoluteFill>
  );
};
