/**
 * SCENE 6 · 0:39–0:46 — what makes ODIN different.
 * Six real product capabilities as cards that fly into a grid on a stagger,
 * each with a subtle continuous float so the grid never feels static.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Background } from "../components/Background";
import { Eyebrow, Title, Card } from "../components/Primitives";
import { c, font, shadow, brandGradient } from "../theme";
import { enter, revealUp, stagger } from "../utils/anim";

const FEATURES = [
  {
    glyph: "◈",
    title: "Persistent founder memory",
    body: "The score follows the person across ventures. It never resets.",
  },
  {
    glyph: "◷",
    title: "24-hour decision clock",
    body: "Every application gets an answer inside a day. No silent rejections.",
  },
  {
    glyph: "✓",
    title: "Per-claim trust score",
    body: "Each claim is checked against public evidence and flagged if it fails.",
  },
  {
    glyph: "◎",
    title: "Eight sourcing channels",
    body: "Founders surfaced before they raise — code, papers, patents, launches.",
  },
  {
    glyph: "⌗",
    title: "Thesis-native screening",
    body: "Your sectors, stages, geographies and non-negotiables drive every gate.",
  },
  {
    glyph: "◆",
    title: "One human in the loop",
    body: "The system recommends. Only you deploy capital.",
  },
];

export const Scene06Features: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Background intensity={0.55} panX={-14} />

      <AbsoluteFill style={{ alignItems: "center", paddingTop: 96 }}>
        <div style={revealUp(frame, 2)}>
          <Eyebrow>Built for conviction</Eyebrow>
        </div>
        <div style={{ ...revealUp(frame, 10), marginTop: 12 }}>
          <Title size={64}>Everything the fund needs.</Title>
        </div>

        {/* 3 × 2 grid */}
        <div
          style={{
            marginTop: 56,
            display: "grid",
            gridTemplateColumns: "repeat(3, 470px)",
            gap: 26,
          }}
        >
          {FEATURES.map((f, i) => {
            const d = stagger(i, 7, 22);
            const p = enter(frame, d, 190);
            // continuous gentle float, phase-offset per card
            const float = Math.sin((frame + i * 40) / 46) * 5;
            return (
              <div
                key={f.title}
                style={{
                  opacity: interpolate(p, [0, 1], [0, 1], { extrapolateRight: "clamp" }),
                  transform: `translateY(${
                    interpolate(p, [0, 1], [44, 0]) + float
                  }px) scale(${interpolate(p, [0, 1], [0.94, 1])})`,
                  filter: `blur(${interpolate(p, [0, 1], [8, 0], {
                    extrapolateRight: "clamp",
                  })}px)`,
                }}
              >
                <Card pad={30} style={{ height: 210, boxShadow: shadow.soft }}>
                  <div
                    style={{
                      width: 62,
                      height: 62,
                      borderRadius: 20,
                      background: brandGradient,
                      display: "grid",
                      placeItems: "center",
                      color: "#fff",
                      fontSize: 28,
                      marginBottom: 18,
                    }}
                  >
                    {f.glyph}
                  </div>
                  <div
                    style={{
                      fontFamily: font.sans,
                      fontSize: 27,
                      fontWeight: 800,
                      color: c.ink,
                      letterSpacing: "-0.015em",
                    }}
                  >
                    {f.title}
                  </div>
                  <div
                    style={{
                      fontFamily: font.sans,
                      fontSize: 19,
                      lineHeight: 1.45,
                      color: c.muted,
                      marginTop: 8,
                    }}
                  >
                    {f.body}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
